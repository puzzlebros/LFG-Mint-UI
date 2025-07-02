// utils/metaplex/mintHelper.ts
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

// Called on mint once
let _top10Wallets: string[] = []
export function cacheLeaderboard(wallets: string[]) {
  _top10Wallets = wallets
}

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
    
    if (guards.allowList.__option === "Some") {
    const allowlist = _top10Wallets;
    if (!allowlist) {
      console.error(`allowlist for guard ${guardToUse.label} not found!`);
    } else {
      args.allowList = some({ merkleRoot: getMerkleRoot(allowlist) });
    }
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

export const routeBuilder = async (
  umi: Umi,
  guardToUse: GuardGroup<DefaultGuardSet>,
  candyMachine: CandyMachine
): Promise<TransactionBuilder> => {
  let tx = transactionBuilder();

  if (guardToUse.guards.allowList.__option === "Some") {
    // 1️⃣ Sort your list to guarantee the same tree on client & cron
    const allowlist = [..._top10Wallets].sort();
    const walletKey = umi.identity.publicKey;
    const cmKey     = candyMachine.publicKey;
    const cgKey     = candyMachine.mintAuthority;

    // 2️⃣ Compute the root & proof
    const merkle     = getMerkleRoot(allowlist);
    const proofArr   = getMerkleProof(allowlist, walletKey);

    // 3️⃣ Log everything, including both hex & base64 of the root
    console.log("▶️ routeBuilder inputs:");
    console.log("   allowlist (sorted):", allowlist);
    console.log("   wallet key:         ", walletKey.toString());
    console.log("   candyMachine key:   ", cmKey.toString());
    console.log("   candyGuard key:     ", cgKey.toString());
    console.log("   merkleRoot (hex):   ", Buffer.from(merkle).toString("hex"));
    console.log("   merkleRoot (base64):", Buffer.from(merkle).toString("base64"));
    console.log("   proof length:       ", proofArr.length);
    console.log(
      "   proof (base64):     ",
      proofArr.map((b) => Buffer.from(b).toString("base64"))
    );

    // 4️⃣ Fetch any on-chain PDA
    const proofAccount = await safeFetchAllowListProofFromSeeds(umi, {
      candyGuard:   cgKey,
      candyMachine: cmKey,
      merkleRoot:   merkle,
      user:         walletKey,
    });
    console.log("🔍 on-chain proof account:", proofAccount);

    // 5️⃣ If no PDA, add the route instruction with our sorted data
    if (proofAccount === null) {
      console.log("➕ No proof found → adding route instruction");
      tx = tx.add(
        route(umi, {
          guard:        "allowList",
          candyMachine: cmKey,
          candyGuard:   cgKey,
          group:
            guardToUse.label === "default"
              ? none()
              : some(guardToUse.label),
          routeArgs: {
            path:        "proof",
            merkleRoot:  merkle,
            merkleProof: proofArr,
          },
        })
      );
    } else {
      console.log("✅ Proof PDA already exists; skipping route.");
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
  umi: Umi,                                  // 1
  guard: GuardReturn,                        // 2
  candyMachine: CandyMachine,                // 3
  candyGuard: CandyGuard,                    // 4
  ownedTokens: DigitalAssetWithToken[],      // 5
  mintAmount: number,                        // 6
  mintsCreated: {                            // 7
    mint: PublicKey;
    offChainMetadata?: JsonMetadata;
  }[] | undefined,
  setMintsCreated: Dispatch<                 // 8
    SetStateAction<
      { mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined
    >
  >,
  guardList: GuardReturn[],                  // 9
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>, // 10
  onOpen: () => void,                        // 11
  setCheckEligibility: Dispatch<SetStateAction<boolean>>, // 12
  ownedCoreAssets: DasApiAssetAndAssetMintLimit[]        // 13
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);
  if (!guardToUse.guards) {
    console.error("no guard defined!");
    return;
  }

  try {
    //find the guard by guardToUse.label and set minting to true
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex === -1) {
      console.error("guard not found");
      return;
    }
    const newGuardList = [...guardList];
    newGuardList[guardIndex].minting = true;
    setGuardList(newGuardList);

    let routeBuild = await routeBuilder(umi, guardToUse, candyMachine);
    if (routeBuild) {
      createStandaloneToast().toast({
        title: "Allowlist detected. Please sign to be approved to mint.",
        status: "info",
        duration: 900,
        isClosable: true,
      });
      const latestBlockhash = (await umi.rpc.getLatestBlockhash({commitment: "finalized"}));
      routeBuild = routeBuild.setBlockhash(latestBlockhash)
      await umi.rpc
      .sendTransaction(routeBuild.build(umi), { skipPreflight:true, maxRetries: 1, preflightCommitment: "finalized", commitment: "finalized" })
    }

    // fetch LUT
    let tables: AddressLookupTableInput[] = [];
    const lut = process.env.NEXT_PUBLIC_LUT;
    if (lut) {
      const lutPubKey = publicKey(lut);
      const fetchedLut = await fetchAddressLookupTable(umi, lutPubKey);
      tables = [fetchedLut];
    } else {
      createStandaloneToast().toast({
        title: "The developer should really set a lookup table!",
        status: "warning",
        duration: 900,
        isClosable: true,
      });
    }

    let nftsigners = [] as KeypairSigner[];

    for (let i = 0; i < mintAmount; i++) {
      const nftMint = generateSigner(umi);
      nftsigners.push(nftMint);
    }

    const mintArgsArray = mintArgsBuilder(guardToUse, ownedTokens, ownedCoreAssets, mintAmount);
    const latestBlockhash = (await umi.rpc.getLatestBlockhash({commitment: "finalized"}));

    const mintTxs: { transaction: Transaction; signers: Signer[] }[] =
      await buildTxs(
        umi,
        candyMachine,
        candyGuard,
        nftsigners,
        guardToUse,
        mintArgsArray,
        tables,
        latestBlockhash.blockhash,
      );
    if (!mintTxs.length) {
      console.error("no mint tx built!");
      return;
    }

    updateLoadingText(`Please sign`, guardList, guardToUse.label, setGuardList);
    
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

    if (!(await sendPromises[0]).status === true) {
      // throw error that no tx was created
      throw new Error("no tx was created");
    }
    updateLoadingText(
      `finalizing transaction(s)`,
      guardList,
      guardToUse.label,
      setGuardList
    );

    createStandaloneToast().toast({
      title: `${signedTransactions.length} Transaction(s) sent!`,
      status: "success",
      duration: 3000,
    });
    const successfulMints = await verifyTx(umi, signatures, nftsigners, latestBlockhash, "finalized");
    updateLoadingText(
      "Fetching your NFT",
      guardList,
      guardToUse.label,
      setGuardList
    );
    // Filter out successful mints and map to fetch promises
    const fetchNftPromises = successfulMints.map((mintResult) =>
      fetchNft(umi, mintResult).then((nftData) => ({
        mint: mintResult,
        nftData,
      }))
    );

    const fetchedNftsResults = await Promise.all(fetchNftPromises);
    // Prepare data for setting mintsCreated
    let newMintsCreated: { mint: PublicKey; offChainMetadata: JsonMetadata }[] =
      [];
    fetchedNftsResults.map((acc) => {
      if (acc.nftData.digitalAsset && acc.nftData.jsonMetadata) {
        newMintsCreated.push({
          mint: acc.mint,
          offChainMetadata: acc.nftData.jsonMetadata,
        });
      }
      return acc;
    }, []);

    // Update mintsCreated only if there are new mints
    if (newMintsCreated.length > 0) {
      setMintsCreated(newMintsCreated);
      onOpen();
    }
  } catch (e) {
    console.error(`minting failed because of ${e}`);
    createStandaloneToast().toast({
      title: "Your mint failed!",
      description: "Please try again.",
      status: "error",
      duration: 900,
      isClosable: true,
    });
  } finally {
    //find the guard by guardToUse.label and set minting to true
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex === -1) {
      console.error("guard not found");
      return;
    }
    const newGuardList = [...guardList];
    newGuardList[guardIndex].minting = false;
    setGuardList(newGuardList);
    setCheckEligibility(true);
    updateLoadingText(undefined, guardList, guardToUse.label, setGuardList);
  }
};
