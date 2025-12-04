// components/mintButton.tsx
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import {
  CandyGuard,
  CandyMachine,
  GuardGroup,
  DefaultGuardSet,
} from "@metaplex-foundation/mpl-core-candy-machine";
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
  debugSimulateSignedTx,
  isWalletInAllowlist,
  getCurrentAllowlist,
} from "@/utils/metaplex/mintHelper";
import { useSolanaTime } from "@/utils/metaplex/SolanaTimeContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { verifyTx } from "@/utils/metaplex/verifyTx";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { AssetV1, fetchAssetV1 } from "@metaplex-foundation/mpl-core";
import { createStandaloneToast } from "@chakra-ui/react";

const toast = createStandaloneToast();

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
  ownedTokens: DigitalAssetWithToken[],
  mintAmount: number,
  setMintsCreated: Dispatch<
    SetStateAction<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined>
  >,
  guardList: GuardReturn[],
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  ownedCoreAssets: DasApiAssetAndAssetMintLimit[],
  walletAddress: string | undefined,         // ⬅️ NEW
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);
  if (!guardToUse.guards) {
    console.error("no guard defined!");
    return;
  }
  const guardGroup = guardToUse as GuardGroup<DefaultGuardSet>;

  // Log identity vs wallet (important!)
  console.log(
    "[mintClick] umi.identity =", umi.identity.publicKey.toString(),
    "wallet =", walletAddress
  );

  // If allowList guard is active, enforce that:
  if (guardGroup.guards.allowList.__option === "Some") {
    const allowlist = getCurrentAllowlist();
    console.log("[mintClick] current allowlist =", allowlist);

    if (!allowlist.length) {
      toast.toast({
        title: "Allowlist not loaded",
        description: "Please wait a moment and try again.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    if (!isWalletInAllowlist(walletAddress)) {
      toast.toast({
        title: "Wallet not in Top 10",
        description: "Only top 10 wallets on the leaderboard can mint right now.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
  }

  try {
    // mark guard as minting
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex === -1) {
      console.error("guard not found");
      return;
    }
    const newGuardList = [...guardList];
    newGuardList[guardIndex].minting = true;
    setGuardList(newGuardList);

    // 1) Allowlist route tx (if needed)
    let routeBuild = await routeBuilder(umi, guardGroup, candyMachine);

    if (routeBuild) {
      toast.toast({
        title: "Allowlist detected. Please sign to be approved to mint.",
        status: "info",
        duration: 900,
        isClosable: true,
      });

      const latestBlockhash = await umi.rpc.getLatestBlockhash({
        commitment: "confirmed",
      });

      routeBuild = routeBuild.setBlockhash(latestBlockhash);
      const routeTx = routeBuild.build(umi);

      // Optional: simulate route before sending
      const routeSim = await debugSimulateSignedTx(umi, routeTx, "allowList.route");
      if (routeSim && routeSim.err) {
        toast.toast({
          title: "Allowlist route simulation failed",
          description: "Check console logs for details.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        throw new Error("Allowlist route simulation failed");
      }

      await umi.rpc.sendTransaction(routeTx, {
        skipPreflight: true,
        maxRetries: 1,
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      });
    }

    // 2) LUT fetch
    let tables: AddressLookupTableInput[] = [];
    const lut = process.env.NEXT_PUBLIC_LUT;
    if (lut) {
      const lutPubKey = publicKey(lut);
      const fetchedLut = await fetchAddressLookupTable(umi, lutPubKey);
      tables = [fetchedLut];
    } else {
      toast.toast({
        title: "The developer should really set a lookup table!",
        status: "warning",
        duration: 900,
        isClosable: true,
      });
    }

    // 3) Generate mint keypairs
    const nftsigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      const nftMint = generateSigner(umi);
      nftsigners.push(nftMint);
    }

    // 4) Mint args (allowList + others)
    const mintArgsArray = mintArgsBuilder(
      guardGroup,
      mintAmount
      // (you can extend to pass ownedTokens / core assets again later)
    );

    const latestBlockhash = await umi.rpc.getLatestBlockhash({
      commitment: "confirmed",
    });

    // 5) Build mint txs
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

    updateLoadingText(
      `Please sign`,
      guardList,
      guardToUse.label,
      setGuardList
    );

    // 6) Joey-style signing
    const signedTransactions = await signAllTransactions(mintTxs);

    // 6.5) SIMULATE SIGNED TXS BEFORE SENDING
    for (let i = 0; i < signedTransactions.length; i++) {
      const simVal = await debugSimulateSignedTx(
        umi,
        signedTransactions[i],
        `mint tx #${i + 1}`
      );

      if (simVal && simVal.err) {
        toast.toast({
          title: "Transaction simulation failed",
          description: "Check console logs for on-chain error.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        throw new Error("Simulation failed before send");
      }
    }

    let signatures: Uint8Array[] = [];
    let amountSent = 0;

    const sendPromises = signedTransactions.map((tx, index) =>
      umi.rpc
        .sendTransaction(tx, {
          skipPreflight: true,
          maxRetries: 1,
          preflightCommitment: "confirmed",
          commitment: "finalized",
        })
        .then((signature) => {
          const sigString = base58.deserialize(signature)[0];
          console.log(
            `Transaction ${index + 1} resolved with signature: ${sigString}`
          );
          amountSent += 1;
          signatures.push(signature);
          return { status: "fulfilled", value: signature };
        })
        .catch((error) => {
          console.error(`Transaction ${index + 1} failed:`, error);
          return { status: "rejected", reason: error };
        })
    );

    await Promise.allSettled(sendPromises);

    if (!signatures.length) {
      throw new Error("no tx was created");
    }

    updateLoadingText(
      `finalizing transaction(s)`,
      guardList,
      guardToUse.label,
      setGuardList
    );

    toast.toast({
      title: `${signatures.length} Transaction(s) sent!`,
      status: "success",
      duration: 3000,
    });

    // 7) Verify & fetch minted NFTs
    const successfulMints = await verifyTx(
      umi,
      signatures,
      nftsigners,
      latestBlockhash,
      "finalized"
    );

    updateLoadingText(
      "Fetching your NFT",
      guardList,
      guardToUse.label,
      setGuardList
    );

    const fetchNftPromises = successfulMints.map((mintResult) =>
      fetchNft(umi, mintResult).then((nftData) => ({
        mint: mintResult,
        nftData,
      }))
    );

    const fetchedNftsResults = await Promise.all(fetchNftPromises);

    const newMintsCreated: {
      mint: PublicKey;
      offChainMetadata?: JsonMetadata;
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
  } catch (e) {
    console.error(`minting failed because of ${e}`);
    toast.toast({
      title: "Your mint failed!",
      description: "Please check console logs and try again.",
      status: "error",
      duration: 9000,
      isClosable: true,
    });
  } finally {
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex !== -1) {
      const newGuardList = [...guardList];
      newGuardList[guardIndex].minting = false;
      newGuardList[guardIndex].loadingText = undefined;
      setGuardList(newGuardList);
    }
    setCheckEligibility(true);
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
};

export function ButtonList({
  umi,
  guardList,
  candyMachine,
  candyGuard,
  ownedTokens = [],
  ownedCoreAssets = [],
  setGuardList,
  setMintsCreated,
  onOpen,
  setCheckEligibility,
  buttonProps,
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
            {/* Show the claim countdown if configured */}
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
    onClick={() =>
      mintClick(
        umi,
        btn,              // guard: GuardReturn
        candyMachine,
        candyGuard,
        ownedTokens,      // ⬅️ added, matches ownedTokens param
        1,                // mintAmount
        setMintsCreated,
        guardList,
        setGuardList,
        onOpen,
        setCheckEligibility,
        ownedCoreAssets,   // ⬅️ added, matches ownedCoreAssets param
            walletPublicKey?.toBase58() ?? undefined  // walletAddress (NEW)

      ).catch((err) => {
        console.error("Unexpected mintClick error:", err);
      })
    }
  >
    {btn.label === "OG" ? (
      <Text as="span">
        {/* main label in default button style */}
        MINT{" "}
        {/* price in copyLight */}
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
      // other guards (e.g. LFG) still use the setting-based label
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