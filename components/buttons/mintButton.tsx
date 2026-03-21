// components/mintButton.tsx
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { DasApiAssetAndAssetMintLimit, GuardReturn } from "../../utils/metaplex/checkerHelper";
import { 
  Umi, 
  createBigInt,   
  generateSigner,
  KeypairSigner,
  publicKey,
  PublicKey,
  AddressLookupTableInput,
  Transaction,
  Signer,
} from "@metaplex-foundation/umi";
import { fetchAddressLookupTable } from "@metaplex-foundation/mpl-toolbox";
import { DigitalAssetWithToken, JsonMetadata, fetchJsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mintSettings } from "../../settings";
import {
  Button,
  Text,
  Tooltip,
  VStack,
  Divider,
  ButtonProps
} from "@chakra-ui/react";
import {
  chooseGuardToUse,
  routeBuilder,
  mintArgsBuilder,
  GuardButtonList,
  buildTxs
} from "@/utils/metaplex/mintHelper";
import { useSolanaTime } from "@/utils/metaplex/SolanaTimeContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { verifyTx } from "@/utils/metaplex/verifyTx";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { AssetV1, fetchAssetV1 } from "@metaplex-foundation/mpl-core";
import { createStandaloneToast } from "@chakra-ui/react";
import {
  Connection,
  Transaction as Web3Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  toWeb3JsTransaction,
  toWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";

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

type WalletSignTransactionFn = (
  tx: Web3Transaction | VersionedTransaction
) => Promise<Web3Transaction | VersionedTransaction>;

const isVersionedTx = (
  tx: Web3Transaction | VersionedTransaction
): tx is VersionedTransaction => {
  return "version" in tx;
};

const cloneWeb3Tx = (
  tx: Web3Transaction | VersionedTransaction
): Web3Transaction | VersionedTransaction => {
  if (isVersionedTx(tx)) {
    const cloned = new VersionedTransaction(tx.message);
    cloned.signatures = [...tx.signatures];
    return cloned;
  }

  return Web3Transaction.from(
    tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
  );
};

const extractLocalKeypairs = (localSigners: Signer[]) => {
  return localSigners
    .filter((s): s is KeypairSigner => "secretKey" in s)
    .map((s) => toWeb3JsKeypair(s));
};

const addLocalSignatures = (
  tx: Web3Transaction | VersionedTransaction,
  localSigners: Signer[]
): Web3Transaction | VersionedTransaction => {
  const keypairs = extractLocalKeypairs(localSigners);
  if (!keypairs.length) return tx;

  if (isVersionedTx(tx)) {
    tx.sign(keypairs);
  } else {
    tx.partialSign(...keypairs);
  }

  return tx;
};

const simulateForWalletReview = async (
  connection: Connection,
  tx: Web3Transaction | VersionedTransaction,
  label: string
) => {
  const sim = await connection.simulateTransaction(tx as any, {
    replaceRecentBlockhash: true,
    sigVerify: false,
  });

  if (sim.value.err) {
    const logs = sim.value.logs ?? [];
    console.error(`[${label}] simulation failed err:`, sim.value.err);
    console.error(`[${label}] simulation logs:`, logs);

    const joined = logs.join(" | ");

    if (
      joined.includes("Not enough SOL to pay for the mint") ||
      ((joined.includes("Require") || joined.includes("need")) &&
        joined.includes("lamports")) ||
      joined.includes("insufficient lamports")
    ) {
      throw new Error(
        "Not enough SOL to complete this mint. You need more SOL for account creation and fees."
      );
    }

    if (
      joined.includes("Wallet not in allowlist") ||
      joined.includes("allowlist") ||
      joined.includes("merkle") ||
      joined.includes("proof")
    ) {
      throw new Error(
        "Allowlist proof failed. Your cached allowlist does not match the current on-chain allowlist."
      );
    }

    throw new Error(`${label} simulation failed before wallet prompt.`);
  }
};

const walletFirstSignSendConfirm = async ({
  umi,
  tx,
  localSigners,
  walletSignTransaction,
  latestBlockhash,
  label,
}: {
  umi: Umi;
  tx: Transaction;
  localSigners: Signer[];
  walletSignTransaction: WalletSignTransactionFn;
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number };
  label: string;
}) => {
  const connection = new Connection(umi.rpc.getEndpoint(), "confirmed");

  // Real transaction that will go to the wallet first.
  const walletTx = toWeb3JsTransaction(tx);

  // Separate copy only for simulation so we can reflect the final tx shape
  // without pre-signing the real tx before wallet review.
  const simulationTx = cloneWeb3Tx(walletTx);
  addLocalSignatures(simulationTx, localSigners);

  await simulateForWalletReview(connection, simulationTx, label);

  // Wallet signs FIRST on the real tx.
  const walletSignedTx = await walletSignTransaction(walletTx);

  // Local signers sign AFTER the wallet.
  addLocalSignatures(walletSignedTx, localSigners);

  const signature = await connection.sendRawTransaction(
    walletSignedTx.serialize(),
    {
      skipPreflight: true,  // Lighthouse assertions run post-execution, not in preflight
      maxRetries: 3,
    }
  );

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return base58.serialize(signature);
};

const mintClick = async (
  umi: Umi,
  guard: GuardReturn,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  mintAmount: number,
  setMintsCreated: Dispatch<
    SetStateAction<
      { mint: PublicKey; offChainMetadata?: JsonMetadata | undefined }[] | undefined
    >
  >,
  guardList: GuardReturn[],
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  walletSignTransaction?: WalletSignTransactionFn,
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);

  const isDefaultGroup = guardToUse.label === "default";

  if (!isDefaultGroup && !candyGuard.groups.find((g) => g.label === guardToUse.label)) {
    console.error(`Group label ${guardToUse.label} not found in candyGuard groups!`);
    return;
  }

  if (!walletSignTransaction) {
    throw new Error("Wallet does not support signTransaction.");
  }

  const setMintingState = (minting: boolean) => {
    setGuardList((prev) => {
      const idx = prev.findIndex((g) => g.label === guardToUse.label);
      if (idx === -1) {
        console.error("guard not found");
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], minting };
      return next;
    });
  };

  const setLoadingState = (loadingText: string | undefined) => {
    setGuardList((prev) => {
      const idx = prev.findIndex((g) => g.label === guardToUse.label);
      if (idx === -1) {
        console.error("guard not found");
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], loadingText };
      return next;
    });
  };

  console.log(
    `[mintClick] selected label="${guard.label}" → resolved group="${guardToUse.label}"`
  );
  console.log(
    `[mintClick] guards: allowList=${guardToUse.guards.allowList.__option}, solPayment=${guardToUse.guards.solPayment.__option}`
  );

  try {
    setMintingState(true);

    // 1) Ensure allowlist proof exists and is confirmed before mint.
    // Uses sendAndConfirm with skipPreflight:true so Phantom's Lighthouse
    // assertions run after the route instruction (not in preflight).
    if (guardToUse.guards.allowList.__option === "Some") {
      setLoadingState("Authenticating...");

      const routeTxBuilder = await routeBuilder(umi, guardToUse, candyMachine);

      if (routeTxBuilder.getInstructions().length > 0) {
        try {
          const { signature: routeSig } = await routeTxBuilder.sendAndConfirm(umi, {
            send: { skipPreflight: true },
            confirm: { commitment: "confirmed" },
          });
          console.log(`[allowlist proof] sent+confirmed: ${base58.deserialize(routeSig)[0]}`);
        } catch (error: any) {
          console.error("[allowlist proof] failed:", error);
          throw new Error(
            "Allowlist proof failed. Make sure your wallet is on the current allowlist."
          );
        }
      } else {
        console.log("[allowlist proof] already exists, skipping route tx");
      }
    }

    // 2) Fetch LUT.
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

    // 3) Generate mint signers.
    const nftsigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      nftsigners.push(generateSigner(umi));
    }

    // 4) Build mint transactions.
    const mintArgsArray = mintArgsBuilder(guardToUse, mintAmount);
    const latestBlockhash = await umi.rpc.getLatestBlockhash({
      commitment: "confirmed",
    });

    const mintTxs: { transaction: Transaction; signers: Signer[] }[] =
      await buildTxs(
        umi,
        candyMachine,
        candyGuard,
        nftsigners,
        guardToUse,
        mintArgsArray,
        tables,
        latestBlockhash.blockhash
      );

    if (!mintTxs.length) {
      throw new Error("No mint transaction could be built.");
    }

    setLoadingState("Please sign...");

    // 5) Wallet-first signing, then local mint signer(s), then send.
    let signatures: Uint8Array[] = [];

    const sendResults = await Promise.all(
  mintTxs.map(async ({ transaction, signers }, index) => {
    try {
      const localSigners = signers.filter(
        (s) => s.publicKey !== umi.identity.publicKey
      );

      const signature = await walletFirstSignSendConfirm({
        umi,
        tx: transaction,
        localSigners,
        walletSignTransaction,
        latestBlockhash,
        label: `mint ${index + 1}`,
      });

      signatures.push(signature);

      return {
        status: "fulfilled" as const,
        value: signature,
      };
    } catch (error: any) {
      console.error(`Transaction ${index + 1} failed:`, error);
      return {
        status: "rejected" as const,
        reason: error,
      };
    }
  })
);

    if (!sendResults.some((r) => r.status === "fulfilled")) {
      throw new Error("No mint transaction was sent successfully.");
    }

    setLoadingState("Joining the flock");

    createStandaloneToast().toast({
      title: `${signatures.length} Transaction(s) sent!`,
      status: "success",
      duration: 3000,
    });

    // 6) Verify and fetch minted NFTs.
    const successfulMints = await verifyTx(
      umi,
      signatures,
      nftsigners,
      latestBlockhash,
      "finalized"
    );

    setLoadingState("Fetching your LFG");

    const fetchNftPromises = successfulMints.map((mintResult) =>
      fetchNft(umi, mintResult).then((nftData) => ({
        mint: mintResult,
        nftData,
      }))
    );

    const fetchedNftsResults = await Promise.all(fetchNftPromises);

    const newMintsCreated: {
      mint: PublicKey;
      offChainMetadata: JsonMetadata;
    }[] = [];

    fetchedNftsResults.forEach((acc) => {
      if (acc.nftData.digitalAsset && acc.nftData.jsonMetadata) {
        newMintsCreated.push({
          mint: acc.mint,
          offChainMetadata: acc.nftData.jsonMetadata,
        });
      }
    });

    if (newMintsCreated.length > 0) {
      setMintsCreated(newMintsCreated);
      onOpen();
    }
  } catch (e: any) {
    console.error("minting failed", e);

    createStandaloneToast().toast({
      title: "Your mint failed!",
      description: e?.message ?? "Please try again.",
      status: "error",
      duration: 2000,
      isClosable: true,
    });
  } finally {
    setMintingState(false);
    setCheckEligibility(true);
    setLoadingState(undefined);
  }
};

const Timer = ({
  solanaTime,
  toTime,
  setCheckEligibility,
}: {
  solanaTime: bigint;
  toTime: bigint;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
}) => {
  const [remaining, setRemaining] = useState<bigint>(toTime - solanaTime);

  // tick down once per second
  useEffect(() => {
    const iv = setInterval(() => setRemaining((r) => r - BigInt(1)), 1000);
    return () => clearInterval(iv);
  }, []);

  // notify parent exactly once when timer expires
  useEffect(() => {
    if (remaining <= BigInt(0)) {
      setCheckEligibility(true);
    }
  }, [remaining, setCheckEligibility]);

  // display 00m 00s once expired
  if (remaining <= BigInt(0)) {
    return <Text fontSize="sm" fontWeight="bold">00m 00s</Text>;
  }

  const days = remaining / BigInt(86400);
  const hrs  = (remaining % BigInt(86400)) / BigInt(3600);
  const mins = (remaining % BigInt(3600)) / BigInt(60);
  const secs = remaining % BigInt(60);

  const pad = (n: bigint) =>
    n.toLocaleString("en-US", { minimumIntegerDigits: 2, useGrouping: false });

  if (days > BigInt(0)) {
    return (
      <Text fontSize="sm" fontWeight="bold">
        {pad(days)}d {pad(hrs)}h {pad(mins)}m {pad(secs)}s
      </Text>
    );
  }

  if (hrs > BigInt(0)) {
    return (
      <Text fontSize="sm" fontWeight="bold">
        {pad(hrs)}h {pad(mins)}m {pad(secs)}s
      </Text>
    );
  }

  return (
    <Text fontSize="sm" fontWeight="bold">
      {pad(mins)}m {pad(secs)}s
    </Text>
  );
};

type Props = {
  umi: Umi;
  guardList: GuardReturn[];
  candyMachine?: CandyMachine;
  candyGuard?: CandyGuard;
  ownedTokens?: DigitalAssetWithToken[];
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>;
  setMintsCreated: Dispatch<SetStateAction<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined>>;
  onOpen: () => void;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
  ownedCoreAssets?: DasApiAssetAndAssetMintLimit[];
  buttonProps?: ButtonProps;

  // ✅ NEW
  onBeforeMint?: () => Promise<void>;
};

export function ButtonList({
  umi,
  guardList,
  candyMachine,
  candyGuard,
  setGuardList,
  setMintsCreated,
  onOpen,
  setCheckEligibility,
  buttonProps,

  // ✅ NEW
  onBeforeMint,
}: Props): JSX.Element {
  const solanaTime = useSolanaTime();
const { publicKey: walletPublicKey, signTransaction } = useWallet();

  if (!candyMachine || !candyGuard) return <></>;

  const filtered = guardList
    .filter((g, i, arr) => i === arr.findIndex((x) => x.label === g.label))
    .filter((g, _, all) => (all.length > 1 ? g.label !== "default" : true));

  const buttons: GuardButtonList[] = filtered.map((g) => {
    const cfg = mintSettings.find((t) => t.label === g.label);
    const grp = candyGuard.groups.find((gr) => gr.label === g.label);
    return {
      ...g,
      header: cfg?.header ?? "",
      mintText: cfg?.mintText ?? "",
      buttonLabel: cfg?.buttonLabel ?? "Mint",
      startTime:
        grp?.guards.startDate.__option === "Some"
          ? grp.guards.startDate.value.date
          : createBigInt(0),
      endTime:
        grp?.guards.endDate.__option === "Some"
          ? grp.guards.endDate.value.date
          : createBigInt(0),
      tooltip: g.reason,
      maxAmount: g.maxAmount,
    };
  });

  return (
    <VStack spacing={3} align="center" w="full">
      {buttons.map((btn, idx) => {
        const isClaim = btn.buttonLabel.toUpperCase() === "CLAIM";
        const timerTarget = isClaim ? btn.endTime : btn.startTime;
        return (
          <VStack key={idx} spacing={1} align="center" w="full">
            {isClaim && timerTarget > BigInt(0) && (
              <>
                <Text fontSize="sm" fontWeight="bold">
                  Claim available until
                </Text>
                <Timer
                  solanaTime={solanaTime}
                  toTime={timerTarget}
                  setCheckEligibility={setCheckEligibility}
                />
              </>
            )}

            <Tooltip label={!walletPublicKey ? "Log in to mint" : btn.tooltip}>
              <Button
                size="default"
                mt="2"
                {...buttonProps}
                isDisabled={!walletPublicKey || !btn.allowed}
                isLoading={guardList.find((g) => g.label === btn.label)?.minting}
                loadingText={guardList.find((g) => g.label === btn.label)?.loadingText}
                onClick={async () => {
                  try {
                    if (onBeforeMint) await onBeforeMint();
                    await mintClick(
                      umi,
                      btn,
                      candyMachine,
                      candyGuard,
                      1,
                      setMintsCreated,
                      guardList,
                      setGuardList,
                      onOpen,
                      setCheckEligibility,
                      signTransaction
                    );
                  } catch (err) {
                    console.error("Mint blocked/failed:", err);
                  }
                }}
              >
                {btn.label === "OG" ? (
                  <Text as="span">
                    MINT{" "}
                    <Text
                      as="span"
                      textStyle="copy"
                      color="white"
                      fontSize="1rem"
                      letterSpacing="-0.01em"
                      textTransform="none"
                    >
                      (<b>0.05</b> sol)
                    </Text>
                  </Text>
                ) : (
                  btn.buttonLabel
                )}
              </Button>
            </Tooltip>

            <Divider w="full" borderColor="transparent" />
          </VStack>
        );
      })}
    </VStack>
  );
}