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
  SendOptions,
} from "@solana/web3.js";
import {
  toWeb3JsTransaction,
  toWeb3JsKeypair,
} from "@metaplex-foundation/umi-web3js-adapters";

const fetchNft = async (umi: Umi, nftAdress: PublicKey) => {
  let digitalAsset: AssetV1 | undefined;
  let jsonMetadata: JsonMetadata | undefined;
  try {
    // RPC may not index the new account immediately after finalization —
    // retry up to 6 times with 2 s backoff before giving up.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        digitalAsset = await fetchAssetV1(umi, nftAdress);
        break;
      } catch (e: any) {
        if (attempt < 5 && e?.name === "AccountNotFoundError") {
          console.log(`[fetchNft] account not indexed yet, retrying (${attempt + 1}/6)…`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
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

// Use sendTransaction with skipPreflight:true.
// Phantom's Lighthouse injects assertion instructions into the transaction ONLY when
// signTransaction is used — those assertions run on-chain and fail with Custom(0x1900)
// because the Candy Machine is a pre-existing 290 KB account, not a new empty account.
// With sendTransaction + skipPreflight:true, Lighthouse only runs in Phantom's internal
// simulation (which may show a warning popup) but is NOT written into the transaction
// bytes, so the on-chain execution succeeds.
// The popup warning is a Phantom domain-trust issue; the permanent fix is submitting
// the domain for review at https://docs.google.com/forms/d/1JgIxdmolgh_80xMfQKBKx9-QPC7LRdN6LHpFFW8BlKM/viewform
type WalletSendTransactionFn = (
  tx: Web3Transaction | VersionedTransaction,
  connection: Connection,
  options?: { signers?: { publicKey: any; secretKey: Uint8Array }[] } & SendOptions
) => Promise<string>;

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

// sendTransaction with skipPreflight:true keeps Lighthouse out of the tx bytes.
// signTransaction causes Phantom to inject Lighthouse assertion instructions that
// fail on-chain with Custom(0x1900) for the pre-existing Candy Machine account.
const walletSendConfirm = async ({
  umi,
  tx,
  localSigners,
  walletSendTransaction,
  label,
}: {
  umi: Umi;
  tx: Transaction;
  localSigners: Signer[];
  walletSendTransaction: WalletSendTransactionFn;
  label: string;
}) => {
  const connection = new Connection(umi.rpc.getEndpoint(), "confirmed");
  const walletTx = toWeb3JsTransaction(tx);

  // Simulate with local sigs for early error detection (insufficient SOL,
  // allowlist proof mismatch, etc.) before prompting the user to sign.
  const simulationTx = cloneWeb3Tx(walletTx);
  addLocalSignatures(simulationTx, localSigners);
  await simulateForWalletReview(connection, simulationTx, label);

  // Refresh blockhash right before sending so it doesn't expire.
  const freshBlockhash = await connection.getLatestBlockhash("confirmed");
  if (isVersionedTx(walletTx)) {
    walletTx.message.recentBlockhash = freshBlockhash.blockhash;
  } else {
    (walletTx as Web3Transaction).recentBlockhash = freshBlockhash.blockhash;
  }

  const localKeypairs = extractLocalKeypairs(localSigners);

  // skipPreflight:true tells Phantom to skip its internal simulation, which is
  // what injects Lighthouse assertions into the transaction bytes. Without this,
  // Lighthouse runs on-chain and fails with Custom(0x1900) for the CM account.
  const signature = await walletSendTransaction(walletTx, connection, {
    signers: localKeypairs,
    skipPreflight: true,
  });

  console.log(`[${label}] tx broadcast: ${signature}`);
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
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  walletSendTransaction?: WalletSendTransactionFn,
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);

  const isDefaultGroup = guardToUse.label === "default";

  if (!isDefaultGroup && !candyGuard.groups.find((g) => g.label === guardToUse.label)) {
    console.error(`Group label ${guardToUse.label} not found in candyGuard groups!`);
    return;
  }

  if (!walletSendTransaction) {
    throw new Error("Wallet does not support sendTransaction.");
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

    // 1) Ensure AllowListProof PDA exists before minting.
    // The proof is created server-side using the admin deploy keypair so
    // Phantom / Lighthouse is never involved in this step.
    if (guardToUse.guards.allowList.__option === "Some") {
      setLoadingState("Authenticating...");

      const walletAddress = umi.identity.publicKey.toString();
      const proofRes = await fetch("/api/allowlist-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress }),
      });

      if (!proofRes.ok) {
        const { error } = await proofRes.json().catch(() => ({ error: "Unknown error" }));
        console.error("[allowlist proof] backend error:", error);
        throw new Error(
          error?.includes("not on the current allowlist")
            ? "Your wallet is not on the current allowlist."
            : `Allowlist proof failed: ${error}`
        );
      }

      const proofData = await proofRes.json();
      console.log(
        proofData.alreadyExists
          ? `[allowlist proof] already existed (pda=${proofData.pda})`
          : `[allowlist proof] created by backend (pda=${proofData.pda})`
      );
    }

    // 2) Re-fetch CandyMachine + CandyGuard from on-chain so mintArgs use the
    //    current merkleRoot — stale React state would produce a wrong PDA
    //    address, causing Lighthouse's pre-condition assertion to fail.
    const [freshCandyMachine, freshCandyGuard] = await Promise.all([
      fetchCandyMachine(umi, candyMachine.publicKey),
      fetchCandyGuard(umi, candyMachine.mintAuthority),
    ]);
    const freshGuardToUse = chooseGuardToUse(guard, freshCandyGuard);
    console.log(
      `[mintClick] fresh merkleRoot: ${
        freshGuardToUse.guards.allowList.__option === "Some"
          ? Buffer.from(freshGuardToUse.guards.allowList.value.merkleRoot).toString("hex").slice(0, 12) + "…"
          : "none"
      }`
    );

    // 3) Skip LUT — Phantom's Lighthouse guard incorrectly asserts data_length==0
    //    for LUT-sourced writable accounts (e.g. the Candy Machine), causing the
    //    tx to fail on-chain. Passing all accounts as static avoids this.
    const tables: AddressLookupTableInput[] = [];

    // 4) Generate mint signers.
    const nftsigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      nftsigners.push(generateSigner(umi));
    }

    // 5) Build mint transactions using fresh on-chain data.
    const mintArgsArray = mintArgsBuilder(freshGuardToUse, mintAmount);
    const latestBlockhash = await umi.rpc.getLatestBlockhash({
      commitment: "confirmed",
    });

    const mintTxs: { transaction: Transaction; signers: Signer[] }[] =
      await buildTxs(
        umi,
        freshCandyMachine,
        freshCandyGuard,
        nftsigners,
        freshGuardToUse,
        mintArgsArray,
        tables,
        latestBlockhash.blockhash
      );

    if (!mintTxs.length) {
      throw new Error("No mint transaction could be built.");
    }

    setLoadingState("Please sign...");

    // 7) Simulate, refresh blockhash, then wallet signs+sends via sendTransaction.
    let signatures: Uint8Array[] = [];

    const sendResults = await Promise.all(
  mintTxs.map(async ({ transaction, signers }, index) => {
    try {
      const localSigners = signers.filter(
        (s) => s.publicKey !== umi.identity.publicKey
      );

      const signature = await walletSendConfirm({
        umi,
        tx: transaction,
        localSigners,
        walletSendTransaction,
        label: `mint ${index + 1}`,
      });

      signatures.push(signature);
      setLoadingState("Confirming...");

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
      // Re-throw the original error so rejection vs real failure can be
      // distinguished in the outer catch block.
      const firstFailed = sendResults.find((r) => r.status === "rejected") as
        | { status: "rejected"; reason: any }
        | undefined;
      throw firstFailed?.reason ?? new Error("No mint transaction was sent successfully.");
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
    const msg: string = e?.message ?? "";
    const isRejected = /user rejected|rejected the request/i.test(msg);

    if (isRejected) {
      // User cancelled in the wallet — no toast needed, they know what they did.
      console.log("[mintClick] transaction cancelled by user");
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
const { publicKey: walletPublicKey, sendTransaction } = useWallet();

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
                      setGuardList,
                      onOpen,
                      setCheckEligibility,
                      sendTransaction as WalletSendTransactionFn
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