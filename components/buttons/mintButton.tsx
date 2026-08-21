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
  BlockhashWithExpiryBlockHeight,
  signAllTransactions,
} from "@metaplex-foundation/umi";

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
  mintArgsBuilder,
  GuardButtonList,
  buildTxs,
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
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
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

  const { toast } = createStandaloneToast();
  let activeToastId: string | number | undefined;

  try {
    setMintingState(true);

    // 1) Re-fetch CandyMachine + CandyGuard so mintArgs use the current on-chain state.
    const [freshCandyMachine, freshCandyGuard] = await Promise.all([
      fetchCandyMachine(umi, candyMachine.publicKey),
      fetchCandyGuard(umi, candyMachine.mintAuthority),
    ]);
    const freshGuardToUse = chooseGuardToUse(guard, freshCandyGuard);

    // 2) LFG free mint — server checks top-10 rank and partially signs; the CLAIMER pays.
    //    The server returns a transaction whose fee payer is the claimer's wallet and
    //    whose `minter` (addressGate) slot is already signed by DEPLOY_KEYPAIR, so the
    //    project no longer absorbs the ~0.0035 SOL Metaplex Core creation fee.
    //    Must use signTransaction + manual send: signAndSendTransaction would have
    //    Phantom rebuild the message and drop the server's partial signatures.
    if (guard.label === "LFG" && !isAdminMode && walletAddress) {
      setLoadingState("Preparing...");

      const resp = await fetch("/api/allowlistMint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWallet: walletAddress }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Allowlist mint failed");

      const binary = atob(data.transaction as string);
      const txBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) txBytes[i] = binary.charCodeAt(i);

      setLoadingState("Please sign...");
      activeToastId = toast({
        title: "Sign to confirm the mint",
        description:
          "The NFT is free — you only cover the ~0.0035 SOL network cost.",
        status: "info",
        duration: null,
        isClosable: false,
      });
      const signedTx = await umi.identity.signTransaction(
        umi.transactions.deserialize(txBytes)
      );
      toast.close(activeToastId);
      activeToastId = undefined;

      setLoadingState("Minting...");
      const claimSig = await umi.rpc.sendTransaction(signedTx, {
        skipPreflight: true,
        preflightCommitment: "confirmed",
      });

      // Resend every 2 s while waiting so the tx doesn't drop from the retry queue.
      const claimResendTimer = setInterval(async () => {
        try { await umi.rpc.sendTransaction(signedTx, { skipPreflight: true }); } catch {}
      }, 2000);
      try {
        await umi.rpc.confirmTransaction(claimSig, {
          strategy: {
            type: "blockhash",
            blockhash: data.blockhash,
            lastValidBlockHeight: data.lastValidBlockHeight,
          },
          commitment: "confirmed",
        });
      } finally {
        clearInterval(claimResendTimer);
      }

      setLoadingState("Fetching your LFG");
      const { digitalAsset, jsonMetadata } = await fetchNft(umi, publicKey(data.mintAddress));
      if (digitalAsset && jsonMetadata) {
        setMintsCreated([{ mint: publicKey(data.mintAddress), offChainMetadata: jsonMetadata }]);
        onOpen();
      }
      return;
    }

    // 3-admin) Server-side signing — bypasses Phantom/Lighthouse entirely.
    // The API uses DEPLOY_KEYPAIR to build, sign, and broadcast server-side.
    // Exit early so the buildTxs/signAllTransactions path is never entered.
    if (isAdminMode && walletAddress) {
      if (!signMessage) throw new Error("Wallet does not support message signing");
      setLoadingState("Authenticating...");
      // Sign a timestamped challenge — proves ownership of the connected wallet
      // without exposing any secret. The server verifies the signature on-chain.
      const timestamp = Date.now();
      const challenge = new TextEncoder().encode(`lfg-admin-mint:${walletAddress}:${timestamp}`);
      const signature = await signMessage(challenge);
      const signatureB58 = base58.deserialize(signature)[0];

      setLoadingState("Minting...");
      const resp = await fetch("/api/adminMint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardLabel: freshGuardToUse.label,
          ownerWallet: walletAddress,
          timestamp,
          signature: signatureB58,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Admin mint failed");

      setLoadingState("Fetching your LFG");
      const { digitalAsset, jsonMetadata } = await fetchNft(umi, publicKey(data.mintAddress));
      if (digitalAsset && jsonMetadata) {
        setMintsCreated([{ mint: publicKey(data.mintAddress), offChainMetadata: jsonMetadata }]);
        onOpen();
      }
      return;
    }

    // 4) LUT intentionally skipped for wallet-facing mints.
    //
    // When Phantom prepends Lighthouse assertions it adds L2TExMFK to the
    // static account list, which increments static_count and therefore
    // shifts every LUT account index by +1 (LUT indices = static_count +
    // lut_slot).  Lighthouse's assertions were built against the pre-shift
    // indices, so after the shift the assertion that was targeting the new
    // nftMint (expected data_length=0) instead targets the candy machine
    // account (290219 bytes), producing "Some(290219) == Some(0)" and a
    // hard failure.  A single-mint tx fits comfortably in the 1232-byte
    // limit without a LUT (≈14 accounts × 32 bytes + instruction data ≈
    // 700 bytes), so there is no size regression.
    const tables: AddressLookupTableInput[] = [];

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

    // Build transactions, keeping all signers (wallet + local NFT mint keypairs).
    const mintTxs = mintBuilders.map(({ builder, signers }) => ({
      transaction: builder.setBlockhash(latestBlockhash).build(umi),
      signers,
    }));

    setLoadingState("Please sign...");
    activeToastId = toast({
      title: "Sign to confirm the mint",
      description: "Approve in your wallet to complete the mint.",
      status: "info",
      duration: null,
      isClosable: false,
    });

    // UMI's signAllTransactions handles all signers in one pass: batches wallet
    // prompts via signAllTransactions then signs locally with each keypair.
    const signedTxs = await signAllTransactions(mintTxs);
    toast.close(activeToastId);
    activeToastId = undefined;

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
    } else {
      console.error("minting failed", e);
      toast({
        title: "Mint failed",
        description: msg || "Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  } finally {
    if (activeToastId !== undefined) toast.close(activeToastId);
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
  onBeforeMint,
}: Props): JSX.Element {
  const solanaTime = useSolanaTime();
  const { publicKey: walletPublicKey, signMessage } = useWallet();
  const router = useRouter();
  const isAdminMode = router.query.admin !== undefined;

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
        const isClaim = btn.buttonLabel.toUpperCase() === "FREE MINT";
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

            {isClaim && (
              <Text
                textStyle="copy"
                fontSize="11px"
                lineHeight="0.95rem"
                color="gray.400"
                textAlign="center"
                maxW="270px"
                mt="1"
              >
                The NFT is free. You only cover the Solana network + Metaplex
                creation fee (~0.0035 SOL) from your wallet.
              </Text>
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
                      setGuardList,
                      onOpen,
                      setCheckEligibility,
                      isAdminMode,
                      walletPublicKey?.toString(),
                      signMessage,
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
                      (<b>0.01</b> sol)
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