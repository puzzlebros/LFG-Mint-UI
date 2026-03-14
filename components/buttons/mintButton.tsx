// components/mintButton.tsx
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { DasApiAssetAndAssetMintLimit, GuardReturn } from "../../utils/metaplex/checkerHelper";
import { 
  Umi, 
  createBigInt,   
  generateSigner,
  signAllTransactions,
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
  buildTxs,
  sendAllowListProof
} from "@/utils/metaplex/mintHelper";
import { useSolanaTime } from "@/utils/metaplex/SolanaTimeContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { verifyTx } from "@/utils/metaplex/verifyTx";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { AssetV1, fetchAssetV1 } from "@metaplex-foundation/mpl-core";
import { createStandaloneToast } from "@chakra-ui/react";

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
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);

  if (!candyGuard.groups.find((g) => g.label === guardToUse.label)) {
    console.error(`Group label ${guardToUse.label} not found in candyGuard groups!`);
    return;
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

    // ─────────────────────────────────────────────────────────────
    // 1) Ensure allowlist proof exists and is CONFIRMED before mint
    // ─────────────────────────────────────────────────────────────
    if (guardToUse.guards.allowList.__option === "Some") {
      setLoadingState("Authenticating...");

      const routeTxBuilder = await routeBuilder(umi, guardToUse, candyMachine);

      // Only send a route tx when the proof PDA still needs to be created.
      if (routeTxBuilder.getInstructions().length > 0) {
        const routeBlockhash = await umi.rpc.getLatestBlockhash({
          commitment: "confirmed",
        });

        const routeTx = routeTxBuilder
          .setBlockhash(routeBlockhash.blockhash)
          .build(umi);

        const walletSigner = umi.identity;
        const routeSigners = routeTxBuilder.getSigners(umi);
        const otherSigners = routeSigners.filter(
          (s) => s.publicKey !== walletSigner.publicKey
        );

        const [signedRouteTx] = await signAllTransactions([
          {
            transaction: routeTx,
            signers: [walletSigner, ...otherSigners],
          },
        ]);

        try {
          const routeSig = await umi.rpc.sendTransaction(signedRouteTx, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: "confirmed",
            commitment: "confirmed",
          });

          console.log(
            `[allowlist proof] sent: ${base58.deserialize(routeSig)[0]}`
          );

await umi.rpc.confirmTransaction(routeSig, {
  strategy: {
    type: "blockhash",
    ...routeBlockhash,
  },
  commitment: "confirmed",
});

          console.log("[allowlist proof] confirmed");
        } catch (error: any) {
          console.error("[allowlist proof] failed:", error);

          if (typeof error?.getLogs === "function") {
            try {
              const logs = await error.getLogs();
              console.error("[allowlist proof] logs:", logs);
            } catch (logErr) {
              console.error("[allowlist proof] could not fetch logs:", logErr);
            }
          }

          throw error;
        }
      } else {
        console.log("[allowlist proof] already exists, skipping route tx");
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2) Fetch LUT
    // ─────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────
    // 3) Generate mint signers
    // ─────────────────────────────────────────────────────────────
    const nftsigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      nftsigners.push(generateSigner(umi));
    }

    // ─────────────────────────────────────────────────────────────
    // 4) Build mint transactions
    // ─────────────────────────────────────────────────────────────
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

    // Wallet first, then remaining signers.
    const walletSigner = umi.identity;
    const mintTxsWithWalletFirst = mintTxs.map(({ transaction, signers }) => {
      const otherSigners = signers.filter(
        (s) => s.publicKey !== walletSigner.publicKey
      );

      return {
        transaction,
        signers: [walletSigner, ...otherSigners],
      };
    });

    const signedTransactions = await signAllTransactions(mintTxsWithWalletFirst);

    // ─────────────────────────────────────────────────────────────
    // 5) Send mint transactions
    // ─────────────────────────────────────────────────────────────
    let signatures: Uint8Array[] = [];

    const sendResults = await Promise.all(
      signedTransactions.map(async (tx, index) => {
        try {
          const signature = await umi.rpc.sendTransaction(tx, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: "confirmed",
            commitment: "confirmed",
          });

          console.log(
            `Transaction ${index + 1} resolved with signature: ${
              base58.deserialize(signature)[0]
            }`
          );

          signatures.push(signature);

          return {
            status: "fulfilled" as const,
            value: signature,
          };
        } catch (error: any) {
          console.error(`Transaction ${index + 1} failed:`, error);

          if (typeof error?.getLogs === "function") {
            try {
              const logs = await error.getLogs();
              console.error(`Transaction ${index + 1} logs:`, logs);
            } catch (logErr) {
              console.error("Could not fetch tx logs:", logErr);
            }
          }

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

    // ─────────────────────────────────────────────────────────────
    // 6) Verify and fetch minted NFTs
    // ─────────────────────────────────────────────────────────────
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
  const { publicKey: walletPublicKey } = useWallet();

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
                    // ✅ NEW: preflight gate (e.g. wallet context guard)
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
                      setCheckEligibility
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