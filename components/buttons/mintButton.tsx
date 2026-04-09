// components/mintButton.tsx
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import {
  CandyGuard,
  CandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
} from "@metaplex-foundation/mpl-core-candy-machine";
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
  signAllTransactions,
  BlockhashWithExpiryBlockHeight,
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
import { useRouter } from "next/router";
import { useWallet } from "@solana/wallet-adapter-react";
import { verifyTx } from "@/utils/metaplex/verifyTx";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { AssetV1, fetchAssetV1 } from "@metaplex-foundation/mpl-core";
import { createStandaloneToast } from "@chakra-ui/react";

const fetchNft = async (umi: Umi, nftAdress: PublicKey) => {
  let digitalAsset: AssetV1 | undefined;
  let jsonMetadata: JsonMetadata | undefined;
  try {
    // RPC may not index the new account immediately after confirmation —
    // retry up to 15 times with 3 s backoff (45 s total) before giving up.
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        digitalAsset = await fetchAssetV1(umi, nftAdress);
        break;
      } catch (e: any) {
        if (attempt < 14 && e?.name === "AccountNotFoundError") {
          console.log(`[fetchNft] account not indexed yet, retrying (${attempt + 1}/15)…`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }
        throw e;
      }
    }
    if (digitalAsset) {
      jsonMetadata = await fetchJsonMetadata(umi, digitalAsset.uri);
    }
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
  allowlist: string[],
  setMintsCreated: Dispatch<
    SetStateAction<
      { mint: PublicKey; offChainMetadata?: JsonMetadata | undefined }[] | undefined
    >
  >,
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  isAdminMode: boolean,
  walletAddress: string | undefined,
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);

  const isDefaultGroup = guardToUse.label === "default";

  if (!isDefaultGroup && !candyGuard.groups.find((g) => g.label === guardToUse.label)) {
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

    // 1) Re-fetch CandyMachine + CandyGuard so mintArgs use the current on-chain state.
    const [freshCandyMachine, freshCandyGuard] = await Promise.all([
      fetchCandyMachine(umi, candyMachine.publicKey),
      fetchCandyGuard(umi, candyMachine.mintAuthority),
    ]);
    const freshGuardToUse = chooseGuardToUse(guard, freshCandyGuard);

    // 2) Route allowlist proof via user's wallet — no server API needed.
    if (freshGuardToUse.guards.allowList.__option === "Some") {
      setLoadingState("Authenticating...");
      const routeTxBuilder = await routeBuilder(umi, freshGuardToUse, freshCandyMachine, allowlist);
      if (routeTxBuilder.getInstructions().length > 0) {
        const { signature: routeSig } = await routeTxBuilder.sendAndConfirm(umi, {
          send: { skipPreflight: true },
          confirm: { commitment: "confirmed" },
        });
        console.log(`[allowlist proof] sent+confirmed: ${base58.deserialize(routeSig)[0]}`);
      } else {
        console.log("[allowlist proof] already exists, skipping route tx");
      }
    }

    // 3-admin) Server-side signing — bypasses Phantom/Lighthouse entirely.
    // The API uses DEPLOY_KEYPAIR to build, sign, and broadcast server-side.
    // Exit early so the buildTxs/signAllTransactions path is never entered.
    if (isAdminMode && walletAddress) {
      setLoadingState("Minting...");
      const resp = await fetch("/api/adminMint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardLabel: freshGuardToUse.label,
          ownerWallet: walletAddress,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Admin mint failed");
      console.log(`[admin mint] confirmed: ${data.signature} mint: ${data.mintAddress}`);

      setLoadingState("Fetching your LFG");
      const { digitalAsset, jsonMetadata } = await fetchNft(umi, publicKey(data.mintAddress));
      if (digitalAsset && jsonMetadata) {
        setMintsCreated([{ mint: publicKey(data.mintAddress), offChainMetadata: jsonMetadata }]);
        onOpen();
      }
      return;
    }

    // 4) Load LUT if configured — reduces tx size for complex mints.
    let tables: AddressLookupTableInput[] = [];
    const lutAddress = process.env.NEXT_PUBLIC_LUT;
    if (lutAddress) {
      const fetchedLut = await fetchAddressLookupTable(umi, publicKey(lutAddress));
      tables = [fetchedLut];
    }

    // 5) Generate mint signers.
    const nftsigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      nftsigners.push(generateSigner(umi));
    }

    // 6) Build mint transactions — CU simulation runs here with a temp blockhash
    //    (replaceRecentBlockhash:true means simulation is blockhash-agnostic).
    const mintArgsArray = mintArgsBuilder(freshGuardToUse, mintAmount);
    const tempBlockhash = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    const mintBuilders = await buildTxs(
      umi,
      freshCandyMachine,
      freshCandyGuard,
      nftsigners,
      freshGuardToUse,
      mintArgsArray,
      tables,
      tempBlockhash.blockhash
    );

    if (!mintBuilders.length) {
      throw new Error("No mint transaction could be built.");
    }

    // Fetch a fresh blockhash after CU simulation so the signed transaction
    // has maximum validity window — minimises expiry risk during wallet prompt.
    const latestBlockhash: BlockhashWithExpiryBlockHeight =
      await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    const mintTxs: { transaction: Transaction; signers: Signer[] }[] =
      mintBuilders.map(({ builder, signers }) => ({
        transaction: builder.setBlockhash(latestBlockhash).build(umi),
        signers,
      }));

    setLoadingState("Please sign...");

    // 7) Sign all transactions in a single wallet prompt, then submit each
    //    with skipPreflight and keep resending every 2 s until confirmed or
    //    the blockhash expires — prevents TransactionExpiredBlockheightExceededError.
    const signedTxs = await signAllTransactions(mintTxs);

    const signatures: Uint8Array[] = [];
    for (let i = 0; i < signedTxs.length; i++) {
      const tx = signedTxs[i];
      let sig: Uint8Array;
      try {
        sig = await umi.rpc.sendTransaction(tx, {
          skipPreflight: true,
          preflightCommitment: "confirmed",
        });
      } catch (err) {
        console.error(`Transaction ${i + 1} initial send failed:`, err);
        continue;
      }
      console.log(`[mint ${i + 1}] broadcast: ${base58.deserialize(sig)[0]}`);
      signatures.push(sig);

      // Resend every 2 s while waiting for confirmation so the tx doesn't
      // drop silently from the validator's retry queue.
      const resendTimer = setInterval(async () => {
        try { await umi.rpc.sendTransaction(tx, { skipPreflight: true }); } catch {}
      }, 2000);
      try {
        await umi.rpc.confirmTransaction(sig, {
          strategy: { type: "blockhash", ...latestBlockhash },
          commitment: "confirmed",
        });
        console.log(`[mint ${i + 1}] confirmed`);
      } catch (e) {
        console.error(`[mint ${i + 1}] confirmation failed:`, e);
      } finally {
        clearInterval(resendTimer);
      }
    }

    if (signatures.length === 0) {
      throw new Error("No mint transaction was sent successfully.");
    }

    setLoadingState("Joining the flock");

    // 7) Verify and fetch minted NFTs.
    const successfulMints = await verifyTx(
      umi,
      signatures,
      nftsigners,
      latestBlockhash,
      "confirmed"
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
    const msg: string = e?.message ?? "";
    const name: string = e?.name ?? "";
    // Wallet adapter wraps rejections in WalletSignTransactionError;
    // some wallets also fire a disconnect event on cancel (WalletDisconnectedError).
    // All of these are user-initiated — swallow silently.
    const isRejected =
      /user rejected|rejected the request|user denied|transaction was not confirmed/i.test(msg) ||
      /WalletSign|WalletDisconnected|WalletNotConnected/i.test(name) ||
      /disconnected|emitter/i.test(msg);

    if (isRejected) {
      console.log("[mintClick] transaction cancelled by user:", name || msg);
    } else {
      console.error("minting failed", e);
      createStandaloneToast().toast({
        title: "Mint failed",
        description: msg || "Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
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
  allowlist?: string[];
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>;
  setMintsCreated: Dispatch<SetStateAction<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined>>;
  onOpen: () => void;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
  ownedCoreAssets?: DasApiAssetAndAssetMintLimit[];
  buttonProps?: ButtonProps;
  onBeforeMint?: () => Promise<void>;
};

export function ButtonList({
  umi,
  guardList,
  candyMachine,
  candyGuard,
  allowlist = [],
  setGuardList,
  setMintsCreated,
  onOpen,
  setCheckEligibility,
  buttonProps,
  onBeforeMint,
}: Props): JSX.Element {
  const solanaTime = useSolanaTime();
  const { publicKey: walletPublicKey, wallet } = useWallet();
  const router = useRouter();
  const isAdminMode = router.query.admin !== undefined;

  const isPhantom = !isAdminMode && (wallet?.adapter?.name?.toLowerCase().includes("phantom") ?? false);

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

            <Tooltip label={!walletPublicKey ? "Log in to mint" : isPhantom ? "Phantom is not supported — please use Solflare" : btn.tooltip}>
              <Button
                size="default"
                mt="2"
                {...buttonProps}
                isDisabled={!walletPublicKey || !btn.allowed || isPhantom}
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
                      allowlist,
                      setMintsCreated,
                      setGuardList,
                      onOpen,
                      setCheckEligibility,
                      isAdminMode,
                      walletPublicKey?.toString(),
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