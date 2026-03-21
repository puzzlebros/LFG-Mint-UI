// utils/metaplex/mintHelper.ts
import {
  CandyGuard,
  CandyMachine,
  GuardGroup,
  DefaultGuardSet,
  DefaultGuardSetMintArgs,
  getMerkleRoot,
  route,
  getMerkleProof,
  mintV1,
  safeFetchAllowListProofFromSeeds
} from "@metaplex-foundation/mpl-core-candy-machine";
import {
  some,
  Umi,
  transactionBuilder,
  TransactionBuilder,
  none,
  AddressLookupTableInput,
  Transaction,
  Signer,
  publicKey,
  BlockhashWithExpiryBlockHeight,
} from "@metaplex-foundation/umi";
import { GuardReturn } from "../metaplex/checkerHelper";
import { Connection } from "@solana/web3.js";
import { setComputeUnitPrice, setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

export interface GuardButtonList extends GuardReturn {
  header: string;
  mintText: string;
  buttonLabel: string;
  startTime: bigint;
  endTime: bigint;
  tooltip?: string;
}

export const chooseGuardToUse = (
  guard: GuardReturn,
  candyGuard: CandyGuard
): GuardGroup<DefaultGuardSet> => {
  const group = candyGuard.groups.find(g => g.label === guard.label);
  return group ?? { label: 'default', guards: candyGuard.guards };
};

// Called on mint once
let _top10Wallets: string[] = []
export function cacheLeaderboard(wallets: string[]) {
  _top10Wallets = [...wallets];
}

export const mintArgsBuilder = (
  guardToUse: GuardGroup<DefaultGuardSet>,
  amount: number
): Partial<DefaultGuardSetMintArgs>[] => {
  const { guards } = guardToUse;
  const array: Partial<DefaultGuardSetMintArgs>[] = [];
  for (let i = 0; i < amount; i++) {
    const args: Partial<DefaultGuardSetMintArgs> = {};
    
if (guards.allowList.__option === "Some") {
  args.allowList = some({
    merkleRoot: guards.allowList.value.merkleRoot,
  });
}
    // Handling mintLimit guard
    if (guards.mintLimit.__option === 'Some') {
      args.mintLimit = some({ id: guards.mintLimit.value.id });
    }
    
    // Handling solPayment guard
    if (guards.solPayment.__option === 'Some') {
      args.solPayment = some({ destination: guards.solPayment.value.destination });
    }

    array.push(args);
  }
  return array;
};

export async function sendAllowListProof(
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
) {
  if (guardToUse.guards.allowList.__option !== "Some") return;

  const allowlist = [..._top10Wallets];
  const merkleRoot = guardToUse.guards.allowList.value.merkleRoot;
  const computedRoot = getMerkleRoot(allowlist);
  const wallet = umi.identity.publicKey.toString();

  if (!allowlist.includes(wallet)) {
    throw new Error(`Wallet ${wallet} is not present in cached allowlist`);
  }

  const rootsMatch =
    merkleRoot.length === computedRoot.length &&
    merkleRoot.every((b, i) => b === computedRoot[i]);

  if (!rootsMatch) {
    throw new Error(
      "Cached allowlist does not match the on-chain allowlist root"
    );
  }

  console.log("[allowlist] on-chain root:", merkleRoot);
  console.log("[allowlist] computed root:", getMerkleRoot(allowlist));
  console.log("[allowlist] wallet:", wallet);
  console.log("[allowlist] cached count:", allowlist.length);

  const existing = await safeFetchAllowListProofFromSeeds(umi, {
    candyGuard: candyMachine.mintAuthority,
    candyMachine: candyMachine.publicKey,
    merkleRoot,
    user: umi.identity.publicKey,
  });

  if (existing === null) {
    await route(umi, {
      guard: "allowList",
      candyMachine: candyMachine.publicKey,
      candyGuard: candyMachine.mintAuthority,
      group: guardToUse.label === "default" ? none() : some(guardToUse.label),
      routeArgs: {
        path: "proof",
        merkleRoot,
        merkleProof: getMerkleProof(allowlist, umi.identity.publicKey),
      },
    }).sendAndConfirm(umi);
  }
}

export const routeBuilder = async (
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
) => {
  let tx = transactionBuilder();

  if (guardToUse.guards.allowList.__option !== "Some") {
    return tx;
  }

const allowlist = [..._top10Wallets];
  if (allowlist.length === 0) {
    console.error("allowlist not found!");
    return tx;
  }

  const merkleRoot = guardToUse.guards.allowList.value.merkleRoot;

  const allowListProof = await safeFetchAllowListProofFromSeeds(umi, {
    candyGuard: candyMachine.mintAuthority,
    candyMachine: candyMachine.publicKey,
    merkleRoot,
    user: umi.identity.publicKey,
  });

  if (allowListProof === null) {
    tx = tx.add(
      route(umi, {
        guard: "allowList",
        candyMachine: candyMachine.publicKey,
        candyGuard: candyMachine.mintAuthority,
        group: guardToUse.label === "default" ? none() : some(guardToUse.label),
        routeArgs: {
          path: "proof",
          merkleRoot,
          merkleProof: getMerkleProof(allowlist, umi.identity.publicKey),
        },
      })
    );
  }

  return tx;
};

export const combineTransactions = (
  umi: Umi,
  txs: TransactionBuilder[],
  tables: AddressLookupTableInput[]
) => {
  const returnArray: TransactionBuilder[] = [];
  let builder = transactionBuilder();

  // combine as many transactions as possible into one
  for (let i = 0; i <= txs.length - 1; i++) {
    const tx = txs[i];
    let oldBuilder = builder;
    builder = builder.add(tx);

    if (!builder.fitsInOneTransaction(umi)) {
      oldBuilder = oldBuilder.setAddressLookupTables(tables);
      returnArray.push(oldBuilder);
      builder = new TransactionBuilder();
      builder = builder.add(tx);
    }
    if (i === txs.length - 1) {
      returnArray.push(builder);
    }
  }
  return returnArray;
};

export const buildTx = (
  umi: Umi,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  nftMint: Signer,
  guardToUse:
    | GuardGroup<DefaultGuardSet>
    | {
        label: string;
        guards: undefined;
      },
  mintArgs: Partial<DefaultGuardSetMintArgs> | undefined,
  luts: AddressLookupTableInput[],
  latestBlockhash: BlockhashWithExpiryBlockHeight,
  units: number,
) => {
  let tx = transactionBuilder().add(
    mintV1(umi, {
      candyMachine: candyMachine.publicKey,
      collection: candyMachine.collectionMint,
      asset: nftMint,
      group: guardToUse.label === "default" ? none() : some(guardToUse.label),
      candyGuard: candyGuard.publicKey,
      mintArgs,
    })
  );
  tx = tx.prepend(setComputeUnitLimit(umi, { units }));
  tx = tx.prepend(
    setComputeUnitPrice(umi, {
      microLamports: parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001"),
    })
  );
  tx = tx.setAddressLookupTables(luts);
  tx = tx.setBlockhash(latestBlockhash);
  return tx.build(umi);
};

export const buildTxs = async (
  umi: Umi,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  nftMints: Signer[],
  guardToUse:
    | GuardGroup<DefaultGuardSet>
    | {
        label: string;
        guards: undefined;
      },
  mintArgsArray: Partial<DefaultGuardSetMintArgs>[] | undefined,
  luts: AddressLookupTableInput[],
  latestBlockhash: string,
) => {
  const newBuilder = transactionBuilder()
    .prepend(setComputeUnitPrice(umi, { microLamports: 5 }))
    .prepend(setComputeUnitLimit(umi, { units: 1400000 }))
    .setBlockhash(latestBlockhash);
  let builder = newBuilder;
  const transactions: { transaction: Transaction; signers: Signer[] }[] = [];
  for (let i = 0; i < nftMints.length; i++) {
    let before = builder;
    let mintArgs = undefined;
    if (mintArgsArray) {
      mintArgs = mintArgsArray[i];
    }
    builder = builder.add(
      mintV1(umi, {
        candyMachine: candyMachine.publicKey,
        collection: candyMachine.collectionMint,
        asset: nftMints[i],
        group: guardToUse.label === "default" ? none() : some(guardToUse.label),
        candyGuard: candyGuard.publicKey,
        mintArgs,
      })
    );
    if (!builder.fitsInOneTransaction(umi)) {
      before = before.setAddressLookupTables(luts);
      const units = await getRequiredCU(umi, before.build(umi));
      console.log(`[mint tx split] estimated CU: ${units}`); // ⬅️ surface sim cost
      let [CU, withoutCU] = before.splitByIndex(1);
      const withCU = withoutCU.prepend(setComputeUnitLimit(umi, { units }));
      transactions.push({
        transaction: withCU.build(umi),
        signers: withCU.getSigners(umi),
      });
      builder = newBuilder;
      i = i - 1;
      continue;
    }
    if (i === nftMints.length - 1) {
      builder = builder.setAddressLookupTables(luts);
      const units = await getRequiredCU(umi, builder.build(umi));
      console.log(`[mint tx final] estimated CU: ${units}`); // ⬅️ surface sim cost
      let [CU, withoutCU] = builder.splitByIndex(1);
      const withCU = withoutCU.prepend(setComputeUnitLimit(umi, { units }));
      transactions.push({
        transaction: withCU.build(umi),
        signers: withCU.getSigners(umi),
      });
    }
  }

  return transactions;
};

export const getRequiredCU = async (umi: Umi, transaction: Transaction) => {
  const defaultCU = 800_000;
  const web3tx = toWeb3JsTransaction(transaction);
  let connection = new Connection(umi.rpc.getEndpoint(), "finalized");
  const simulatedTx = await connection.simulateTransaction(web3tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });
  if (simulatedTx.value.err || !simulatedTx.value.unitsConsumed) {
    return defaultCU;
  }
  return simulatedTx.value.unitsConsumed + 20_000 || defaultCU;
};