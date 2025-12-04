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
  safeFetchAllowListProofFromSeeds,
} from "@metaplex-foundation/mpl-core-candy-machine";
import {
  some,
  none,
  Umi,
  transactionBuilder,
  TransactionBuilder,
  AddressLookupTableInput,
  Transaction,
  Signer,
  publicKey,
  BlockhashWithExpiryBlockHeight,
} from "@metaplex-foundation/umi";
import { GuardReturn } from "../metaplex/checkerHelper";
import { Connection } from "@solana/web3.js";
import {
  setComputeUnitPrice,
  setComputeUnitLimit,
} from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

export interface GuardButtonList extends GuardReturn {
  header: string;
  mintText: string;
  buttonLabel: string;
  startTime: bigint;
  endTime: bigint;
  tooltip?: string;
}

// ──────────────────────────────────────────────────────────────
// Choose guard group
// ──────────────────────────────────────────────────────────────
export const chooseGuardToUse = (
  guard: GuardReturn,
  candyGuard: CandyGuard
): GuardGroup<DefaultGuardSet> => {
  const group = candyGuard.groups.find((g) => g.label === guard.label);
  return group ?? { label: "default", guards: candyGuard.guards };
};

// ──────────────────────────────────────────────────────────────
// Allowlist cache from leaderboard (top10 wallets)
// ──────────────────────────────────────────────────────────────
let _top10Wallets: string[] = [];

export function cacheLeaderboard(wallets: string[]) {
  _top10Wallets = wallets;
}

// ──────────────────────────────────────────────────────────────
// MintArgs builder — *Joey-style*: only per-mint args
// (allowList + mintLimit + solPayment)
// ──────────────────────────────────────────────────────────────
export const mintArgsBuilder = (
  guardToUse: GuardGroup<DefaultGuardSet>,
  amount: number
): Partial<DefaultGuardSetMintArgs>[] => {
  const { guards } = guardToUse;
  const array: Partial<DefaultGuardSetMintArgs>[] = [];

  for (let i = 0; i < amount; i++) {
    const args: Partial<DefaultGuardSetMintArgs> = {};

    // Allowlist guard (from cached top10 wallets)
    if (guards.allowList.__option === "Some") {
      const allowlist = [..._top10Wallets];

      if (!allowlist || allowlist.length === 0) {
        console.error(`allowlist for guard ${guardToUse.label} not found!`);
      } else {
        args.allowList = some({ merkleRoot: getMerkleRoot(allowlist) });
      }
    }

    // MintLimit guard
    if (guards.mintLimit.__option === "Some") {
      args.mintLimit = some({ id: guards.mintLimit.value.id });
    }

    // SolPayment guard
    if (guards.solPayment.__option === "Some") {
      args.solPayment = some({
        destination: guards.solPayment.value.destination,
      });
    }

    array.push(args);
  }

  return array;
};

// ──────────────────────────────────────────────────────────────
// Optional helper: sendAllowListProof immediately (backend-ish)
// Your frontend currently uses routeBuilder instead, which is fine.
// ──────────────────────────────────────────────────────────────
export async function sendAllowListProof(
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
) {
  if (guardToUse.guards.allowList.__option !== "Some") return;

  const allowlist = [..._top10Wallets];
  if (!allowlist || allowlist.length === 0) {
    console.error("allowlist not found!");
    return;
  }

  const existing = await safeFetchAllowListProofFromSeeds(umi, {
    candyGuard: candyMachine.mintAuthority,
    candyMachine: candyMachine.publicKey,
    merkleRoot: getMerkleRoot(allowlist),
    user: umi.identity.publicKey,
  });

  if (existing === null) {
    await route(umi, {
      guard: "allowList",
      candyMachine: candyMachine.publicKey,
      candyGuard: candyMachine.mintAuthority,
      group:
        guardToUse.label === "default" ? none() : some(guardToUse.label),
      routeArgs: {
        path: "proof",
        merkleRoot: getMerkleRoot(allowlist),
        merkleProof: getMerkleProof(allowlist, umi.identity.publicKey),
      },
    }).sendAndConfirm(umi);
  }
}

// ──────────────────────────────────────────────────────────────
// Route builder (allowList.proof) — used on the client before mint
// Returns a TransactionBuilder or null
// ──────────────────────────────────────────────────────────────
export const routeBuilder = async (
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
): Promise<TransactionBuilder | null> => {
  // No allowlist guard? Nothing to do.
  if (guardToUse.guards.allowList.__option !== "Some") {
    return null;
  }

  const allowlist = [..._top10Wallets];

  if (!allowlist || allowlist.length === 0) {
    console.error("allowlist not found!");
    return null;
  }

  const allowListProof = await safeFetchAllowListProofFromSeeds(umi, {
    candyGuard: candyMachine.mintAuthority,
    candyMachine: candyMachine.publicKey,
    merkleRoot: getMerkleRoot(allowlist),
    user: publicKey(umi.identity),
  });

  // If proof already exists, skip
  if (allowListProof !== null) {
    return null;
  }

  let tx2 = transactionBuilder().add(
    route(umi, {
      guard: "allowList",
      candyMachine: candyMachine.publicKey,
      candyGuard: candyMachine.mintAuthority,
      group:
        guardToUse.label === "default" ? none() : some(guardToUse.label),
      routeArgs: {
        path: "proof",
        merkleRoot: getMerkleRoot(allowlist),
        merkleProof: getMerkleProof(allowlist, publicKey(umi.identity)),
      },
    })
  );

  return tx2;
};

// ──────────────────────────────────────────────────────────────
// Combine multiple builders into as few transactions as possible
// (You’re not using this right now, but keeping for completeness.)
// ──────────────────────────────────────────────────────────────
export const combineTransactions = (
  umi: Umi,
  txs: TransactionBuilder[],
  tables: AddressLookupTableInput[]
) => {
  const returnArray: TransactionBuilder[] = [];
  let builder = transactionBuilder();

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    let oldBuilder = builder;
    builder = builder.add(tx);

    if (!builder.fitsInOneTransaction(umi)) {
      oldBuilder = oldBuilder.setAddressLookupTables(tables);
      returnArray.push(oldBuilder);
      builder = transactionBuilder().add(tx);
    }

    if (i === txs.length - 1) {
      returnArray.push(builder);
    }
  }

  return returnArray;
};

// ──────────────────────────────────────────────────────────────
// Single-mint builder (used if you ever want 1 tx per mint)
// ──────────────────────────────────────────────────────────────
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
  units: number
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
      microLamports: parseInt(
        process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001",
        10
      ),
    })
  );
  tx = tx.setAddressLookupTables(luts);
  tx = tx.setBlockhash(latestBlockhash);

  return tx.build(umi);
};

// ──────────────────────────────────────────────────────────────
// Multi-mint builder — Joey-style:
//  - Prepend CU price/limit once
//  - Add mintV1() per NFT
//  - Split if a tx gets too big
// ──────────────────────────────────────────────────────────────
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
  latestBlockhash: string
): Promise<{ transaction: Transaction; signers: Signer[] }[]> => {
  const baseBuilder = transactionBuilder()
    .prepend(setComputeUnitPrice(umi, { microLamports: 5 }))
    .prepend(setComputeUnitLimit(umi, { units: 1_400_000 }))
    .setBlockhash(latestBlockhash);

  let builder = baseBuilder;
  const transactions: { transaction: Transaction; signers: Signer[] }[] = [];

  for (let i = 0; i < nftMints.length; i++) {
    let before = builder;
    let mintArgs: Partial<DefaultGuardSetMintArgs> | undefined = undefined;

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
      // finalize previous builder
      before = before.setAddressLookupTables(luts);
      const units = await getRequiredCU(umi, before.build(umi));
      console.log(`[mint tx split] estimated CU: ${units}`);

      const [, withoutCU] = before.splitByIndex(1); // strip old CU limit
      const withCU = withoutCU.prepend(
        setComputeUnitLimit(umi, { units })
      );

      transactions.push({
        transaction: withCU.build(umi),
        signers: withCU.getSigners(umi),
      });

      builder = baseBuilder;
      i = i - 1; // retry current mint in a fresh tx
      continue;
    }

    // Last mint → finalize builder
    if (i === nftMints.length - 1) {
      builder = builder.setAddressLookupTables(luts);
      const units = await getRequiredCU(umi, builder.build(umi));
      console.log(`[mint tx final] estimated CU: ${units}`);

      const [, withoutCU] = builder.splitByIndex(1);
      const withCU = withoutCU.prepend(
        setComputeUnitLimit(umi, { units })
      );

      transactions.push({
        transaction: withCU.build(umi),
        signers: withCU.getSigners(umi),
      });
    }
  }

  return transactions;
};

// ──────────────────────────────────────────────────────────────
// CU simulation helper (same as your original, Joey-style)
// ──────────────────────────────────────────────────────────────
export const getRequiredCU = async (
  umi: Umi,
  transaction: Transaction
): Promise<number> => {
  const defaultCU = 800_000;
  const web3tx = toWeb3JsTransaction(transaction);
  const connection = new Connection(umi.rpc.getEndpoint(), "finalized");

  const simulatedTx = await connection.simulateTransaction(web3tx, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });

  if (simulatedTx.value.err || !simulatedTx.value.unitsConsumed) {
    return defaultCU;
  }

  return simulatedTx.value.unitsConsumed + 20_000 || defaultCU;
};
