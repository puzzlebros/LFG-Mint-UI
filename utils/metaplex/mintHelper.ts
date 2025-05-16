// utils/metaplex/mintHelper.ts
import { allowLists } from "@/allowlist";
import { verifyTx } from "@/utils/metaplex/verifyTx";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { AssetV1, fetchAssetV1 } from "@metaplex-foundation/mpl-core";
import { DigitalAssetWithToken, JsonMetadata, fetchJsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createStandaloneToast } from "@chakra-ui/react";
import {
  CandyGuard,
  CandyMachine,
  GuardGroup,
  DefaultGuardSet,
  DefaultGuardSetMintArgs,
  getMerkleRoot,
  route,
  getMerkleProof,
  safeFetchAllowListProofFromSeeds,
  mintV1
} from "@metaplex-foundation/mpl-core-candy-machine";
import {
  some,
  Umi,
  transactionBuilder,
  publicKey,
  PublicKey,
  TransactionBuilder,
  none,
  AddressLookupTableInput,
  Transaction,
  Signer,
  BlockhashWithExpiryBlockHeight,
  generateSigner,
  signAllTransactions,
  KeypairSigner
} from "@metaplex-foundation/umi";
import { DasApiAssetAndAssetMintLimit, DigitalAssetWithTokenAndNftMintLimit, GuardReturn } from "../metaplex/checkerHelper";
import { Connection } from "@solana/web3.js";
import { setComputeUnitPrice, setComputeUnitLimit, fetchAddressLookupTable } from "@metaplex-foundation/mpl-toolbox";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { Dispatch, SetStateAction, } from "react";

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

export const mintArgsBuilder = (
  guardToUse: GuardGroup<DefaultGuardSet>,
  ownedTokens: DigitalAssetWithTokenAndNftMintLimit[],
  ownedCoreAssets: DasApiAssetAndAssetMintLimit[],
  amount: number
): Partial<DefaultGuardSetMintArgs>[] => {
  const { guards } = guardToUse;
  const array: Partial<DefaultGuardSetMintArgs>[] = [];
  for (let i = 0; i < amount; i++) {
    const args: Partial<DefaultGuardSetMintArgs> = {};

    if (guards.allowList.__option === 'Some') {
      const list = allowLists.get(guardToUse.label);
      if (list) args.allowList = some({ merkleRoot: getMerkleRoot(list) });
    }
    if (guards.mintLimit.__option === 'Some') {
      args.mintLimit = some({ id: guards.mintLimit.value.id });
    }
    if (guards.solPayment.__option === 'Some') {
      args.solPayment = some({ destination: guards.solPayment.value.destination });
    }
    array.push(args);
  }
  return array;
};

export const routeBuilder = async (
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
): Promise<TransactionBuilder> => {
  let tx = transactionBuilder();
  if (guardToUse.guards.allowList.__option === 'Some') {
    const list = allowLists.get(guardToUse.label);
    if (!list) throw new Error(`Allowlist for \"${guardToUse.label}\" missing`);
    const proof = await safeFetchAllowListProofFromSeeds(umi, {
      candyGuard: candyMachine.mintAuthority,
      candyMachine: candyMachine.publicKey,
      merkleRoot: getMerkleRoot(list),
      user: publicKey(umi.identity),
    });
    if (proof === null) {
      tx = tx.add(
        route(umi, {
          guard: 'allowList',
          candyMachine: candyMachine.publicKey,
          candyGuard: candyMachine.mintAuthority,
          group: guardToUse.label === 'default' ? none() : some(guardToUse.label),
          routeArgs: {
            path: 'proof',
            merkleRoot: getMerkleRoot(list),
            merkleProof: getMerkleProof(list, publicKey(umi.identity)),
          },
        })
      );
    }
  }
  return tx;
};

export const combineTransactions = (
  umi: Umi,
  txs: TransactionBuilder[],
  tables: AddressLookupTableInput[]
): TransactionBuilder[] => {
  const out: TransactionBuilder[] = [];
  let builder = transactionBuilder();
  txs.forEach((t, i) => {
    const prev = builder;
    builder = builder.add(t);
    if (!builder.fitsInOneTransaction(umi)) {
      prev.setAddressLookupTables(tables);
      out.push(prev);
      builder = transactionBuilder().add(t);
    }
    if (i === txs.length - 1) out.push(builder);
  });
  return out;
};

export const buildTx = (
  umi: Umi,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  nftMint: Signer,
  guardToUse: GuardGroup<DefaultGuardSet> | { label: string; guards: undefined },
  mintArgs: Partial<DefaultGuardSetMintArgs> | undefined,
  luts: AddressLookupTableInput[],
  latestBlockhash: BlockhashWithExpiryBlockHeight,
  units: number,
  buyBeer: boolean
): Transaction => {
  let tx = transactionBuilder().add(
    mintV1(umi, {
      candyMachine: candyMachine.publicKey,
      collection: candyMachine.collectionMint,
      asset: nftMint,
      candyGuard: candyGuard.publicKey,
      group: guardToUse.label === 'default' ? none() : some(guardToUse.label),
      mintArgs,
    })
  );
  tx = tx.prepend(setComputeUnitLimit(umi, { units }));
  tx = tx.prepend(
    setComputeUnitPrice(umi, { microLamports: Number(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? 1001) })
  );
  return tx.setAddressLookupTables(luts).setBlockhash(latestBlockhash).build(umi);
};

export const buildTxs = async (
  umi: Umi,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  nftMints: Signer[],
  guardToUse: GuardGroup<DefaultGuardSet> | { label: string; guards: undefined },
  mintArgsArray: Partial<DefaultGuardSetMintArgs>[] | undefined,
  luts: AddressLookupTableInput[],
  latestBlockhash: string,
): Promise<{ transaction: Transaction; signers: Signer[] }[]> => {
  const base = transactionBuilder()
    .prepend(setComputeUnitPrice(umi, { microLamports: 5 }))
    .prepend(setComputeUnitLimit(umi, { units: 1_400_000 }))
    .setBlockhash(latestBlockhash);
  let builder = base;
  const out: { transaction: Transaction; signers: Signer[] }[] = [];
  for (let i = 0; i < nftMints.length; i++) {
    const prev = builder;
    const args = mintArgsArray?.[i];
    builder = builder.add(
      mintV1(umi, {
        candyMachine: candyMachine.publicKey,
        collection: candyMachine.collectionMint,
        asset: nftMints[i],
        candyGuard: candyGuard.publicKey,
        group: guardToUse.label === 'default' ? none() : some(guardToUse.label),
        mintArgs: args,
      })
    );
    if (!builder.fitsInOneTransaction(umi)) {
      prev.setAddressLookupTables(luts);
      const cu = await getRequiredCU(umi, prev.build(umi));
      const [, rest] = prev.splitByIndex(1);
      const withCU = rest.prepend(setComputeUnitLimit(umi, { units: cu }));
      out.push({ transaction: withCU.build(umi), signers: withCU.getSigners(umi) });
      builder = base;
      i--;
      continue;
    }
    if (i === nftMints.length - 1) {
      builder.setAddressLookupTables(luts);
      const cu = await getRequiredCU(umi, builder.build(umi));
      const [, rest] = builder.splitByIndex(1);
      const withCU = rest.prepend(setComputeUnitLimit(umi, { units: cu }));
      out.push({ transaction: withCU.build(umi), signers: withCU.getSigners(umi) });
    }
  }
  return out;
};

export const getRequiredCU = async (umi: Umi, tx: Transaction): Promise<number> => {
  const defaultCU = 800_000;
  const web3Tx = toWeb3JsTransaction(tx);
  const conn = new Connection(umi.rpc.getEndpoint(), 'finalized');
  const sim = await conn.simulateTransaction(web3Tx, { replaceRecentBlockhash: true, sigVerify: false });
  return sim.value.unitsConsumed ? sim.value.unitsConsumed + 20_000 : defaultCU;
};

export interface MintClickParams {
  umi: Umi;
  guard: GuardReturn;
  candyMachine: CandyMachine;
  candyGuard: CandyGuard;
  ownedTokens: DigitalAssetWithTokenAndNftMintLimit[];
  ownedCoreAssets: DasApiAssetAndAssetMintLimit[];
  amount?: number;
}

const updateLoadingText = (
  loadingText: string | undefined,
  guardList: GuardReturn[],
  label: string,
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>
) => {
  const guardIndex = guardList.findIndex((g) => g.label === label);
  if (guardIndex === -1) {
    console.error("guard not found");
    return;
  }
  const newGuardList = [...guardList];
  newGuardList[guardIndex].loadingText = loadingText;
  setGuardList(newGuardList);
};

const fetchNft = async (umi: Umi, nftAdress: PublicKey) => {
  let digitalAsset: AssetV1 | undefined;
  let jsonMetadata: JsonMetadata | undefined;
  try {
    digitalAsset = await fetchAssetV1(umi, nftAdress);
    jsonMetadata = await fetchJsonMetadata(umi, digitalAsset.uri);
  } catch (e) {
    console.error(e);
    createStandaloneToast().toast({
      title: "Nft could not be fetched!",
      description: "Please check your Wallet instead.",
      status: "info",
      duration: 900,
      isClosable: true,
    });
  }

  return { digitalAsset, jsonMetadata };
};

export const mintClick = async (
  umi: Umi,
  guard: GuardReturn,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  ownedTokens: DigitalAssetWithToken[],
  mintAmount: number,
  guardList: GuardReturn[],
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  ownedCoreAssets: DasApiAssetAndAssetMintLimit[]
) : Promise<{ mint: PublicKey; offChainMetadata: JsonMetadata }[]> => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);
  if (!guardToUse.guards) {
    console.error("No guard defined!");
    return [];
  }

  try {
    // — mark minting
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex === -1) {
      console.error("Guard not found");
      return [];
    }
    const newGuardList = [...guardList];
    newGuardList[guardIndex].minting = true;
    setGuardList(newGuardList);

    // — allowlist proof
    let routeBuild = await routeBuilder(umi, guardToUse, candyMachine);
    if (routeBuild && routeBuild.items.length > 0) {
      createStandaloneToast().toast({
        title: "Allowlist detected. Please sign to be approved to mint.",
        status: "info",
        duration: 900,
        isClosable: true,
      });

      const price = parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001");
      const latestBlockhash = await umi.rpc.getLatestBlockhash({ commitment: "finalized" });

      routeBuild = routeBuild
        .prepend(setComputeUnitPrice(umi, { microLamports: price }))
        .setBlockhash(latestBlockhash);

      const builtTx = await routeBuild.buildAndSign(umi);
      await umi.rpc.sendTransaction(builtTx, {
        skipPreflight: true,
        preflightCommitment: "finalized",
        commitment: "finalized",
      });
    }

    // fetch LUT
    let tables: AddressLookupTableInput[] = [];
    if (process.env.NEXT_PUBLIC_LUT) {
      tables = [await fetchAddressLookupTable(umi, publicKey(process.env.NEXT_PUBLIC_LUT))];
    } else {
      createStandaloneToast().toast({
        title: "Set NEXT_PUBLIC_LUT in .env!",
        status: "warning",
        duration: 900,
        isClosable: true,
      });
    }

    // signers
    const nftSigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      nftSigners.push(generateSigner(umi));
    }

    // args + blockhash
    const mintArgsArray = mintArgsBuilder(guardToUse, ownedTokens, ownedCoreAssets, mintAmount);
    const latest = (await umi.rpc.getLatestBlockhash({commitment: "finalized"}));

    // build transactions
    const mintTxs = await buildTxs(
      umi,
      candyMachine,
      candyGuard,
      nftSigners,
      guardToUse,
      mintArgsArray,
      tables,
      latest.blockhash
    );
    if (mintTxs.length === 0) {
      console.error("No mint tx built!");
      return [];
    }
    
    updateLoadingText(`Please sign...`, guardList, guardToUse.label, setGuardList);
    
    // collect signed TXs
    const signedTransactions = await signAllTransactions(mintTxs);

    let signatures: Uint8Array[] = [];
        let amountSent = 0;
        const sendPromises = signedTransactions.map((tx, index) => {
          return umi.rpc
            .sendTransaction(tx, { skipPreflight:true, maxRetries: 1, preflightCommitment: "finalized", commitment: "finalized" })
            .then((signature) => {
              console.log(
                `Transaction ${index + 1} resolved with signature: ${
                  base58.deserialize(signature)[0]
                }`
              );
              amountSent = amountSent + 1;
              signatures.push(signature);
              return { status: "fulfilled", value: signature };
            })
            .catch((error) => {
              console.error(`Transaction ${index + 1} failed:`, error);
              return { status: "rejected", reason: error };
            });
        });

    await Promise.allSettled(sendPromises);

    if (signatures.length === 0) {
      throw new Error("No transactions succeeded");
    }

    updateLoadingText("Finalizing…", guardList, guardToUse.label, setGuardList);

    createStandaloneToast().toast({
      title: `${signedTransactions.length} Transaction(s) sent!`,
      status: "success",
      duration: 3000,
    });

    const successfulMints = await verifyTx(
      umi,
      signatures,
      nftSigners,
      latest,
      "finalized"
    );

    updateLoadingText("Fetching your NFT…", guardList, guardToUse.label, setGuardList);

    // Fetch on-chain metadata for each successful mint
    const fetchedNftsResults = await Promise.all(
      successfulMints.map(async (mintPubKey) => {
        const { digitalAsset, jsonMetadata } = await fetchNft(umi, mintPubKey);
        return { mint: mintPubKey, digitalAsset, jsonMetadata };
      })
    );

    const newMintsCreated: { mint: PublicKey; offChainMetadata: JsonMetadata }[] =
      fetchedNftsResults
        .filter((r) => r.digitalAsset && r.jsonMetadata)
        .map((r) => ({
          mint: r.mint,
          offChainMetadata: r.jsonMetadata!,
        }));

    return newMintsCreated;
  } catch (e) {
    console.error(`minting failed because of`, e);
    createStandaloneToast().toast({
      title: "Your mint failed!",
      description: "Please try again.",
      status: "error",
      duration: 900,
      isClosable: true,
    });
    return [];
  } finally {
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex !== -1) {
      const reset = [...guardList];
      reset[guardIndex].minting = false;
      reset[guardIndex].loadingText = undefined;
      setGuardList(reset);
    }

    setCheckEligibility(true);
    updateLoadingText(undefined, guardList, guardToUse.label, setGuardList);
  }
};
