// components/mintButton.tsx
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { DasApiAssetAndAssetMintLimit, GuardReturn } from "../utils/metaplex/checkerHelper";
import { 
  Umi, 
  createBigInt,   
  generateSigner,
  signAllTransactions,
  KeypairSigner,
  publicKey,
  PublicKey,
  AddressLookupTableInput,

} from "@metaplex-foundation/umi";
import { fetchAddressLookupTable } from "@metaplex-foundation/mpl-toolbox";
import { DigitalAssetWithToken, JsonMetadata, fetchJsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mintSettings } from "../settings";
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
    SetStateAction<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined>
  >,
  guardList: GuardReturn[],
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
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

    const proofBuilder = await routeBuilder(umi, guardToUse, candyMachine);
    
    if (proofBuilder) {
      createStandaloneToast().toast({
        title: "Allowlist detected. Please sign to be approved to mint.",
        status: "info",
        duration: 900,
        isClosable: true,
      });
      
      const { blockhash, lastValidBlockHeight } = await umi.rpc.getLatestBlockhash({ commitment: "finalized" });
      await umi.rpc.sendTransaction(
        proofBuilder.setBlockhash({ blockhash, lastValidBlockHeight }).build(umi),
        {
          skipPreflight: true,
          maxRetries: 1,
          preflightCommitment: "finalized",
          commitment: "finalized",
        }
      );
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

     // prepare mints
    const nftSigners: KeypairSigner[] = [];
    for (let i = 0; i < mintAmount; i++) {
      nftSigners.push(generateSigner(umi));
    }

   // Build mint args using cached allowlist in mintHelper
    const mintArgs = mintArgsBuilder(guardToUse, mintAmount);
    const { blockhash, lastValidBlockHeight } = await umi.rpc.getLatestBlockhash({ commitment: "finalized" });

     // Build mint transactions
    const mintTxs = await buildTxs(umi, candyMachine, candyGuard, nftSigners, guardToUse, mintArgs, tables, blockhash);
    if (mintTxs.length === 0) {
      console.error("No mint transactions built!");
      return;
    }

    updateLoadingText("Please sign", guardList, guardToUse.label, setGuardList);
    
    const signed = await signAllTransactions(mintTxs);

    const sigs: Uint8Array[] = [];
    // Send all signed transactions to the network
    const sendPromises = signed.map((tx, i) =>
      umi.rpc
        .sendTransaction(tx, {
          skipPreflight: true,
          maxRetries: 1,
          preflightCommitment: "finalized",
          commitment: "finalized",
        })
        .then((s) => {
          console.log(`Transaction ${i + 1} sent: ${base58.deserialize(s)[0]}`);
          sigs.push(s);
          return { status: "fulfilled", value: s } as const;
        })
        .catch((err) => {
          console.error(`Transaction ${i + 1} failed:`, err);
          return { status: "rejected", reason: err } as const;
        })
    );

    await Promise.allSettled(sendPromises);

    updateLoadingText("Finalizing transaction(s)", guardList, guardToUse.label, setGuardList);
    createStandaloneToast().toast({
      title: `${signed.length} Transaction(s) sent!`,
      status: "success",
      duration: 3000,
    });

     // Verify transaction confirmation & fetch minted NFTs
    const successful = await verifyTx(umi, sigs, nftSigners, { blockhash, lastValidBlockHeight }, "finalized");

    updateLoadingText("Fetching your NFT", guardList, guardToUse.label, setGuardList);
    const fetched = await Promise.all(
      successful.map((m) =>
        fetchNft(umi, m).then(({ jsonMetadata }) => ({
          mint: m,
          offChainMetadata: jsonMetadata,
        }))
      )
    );

    setMintsCreated(fetched);
    if (fetched.length) onOpen();
  } catch (e) {
    console.error("minting failed:", e);
    createStandaloneToast().toast({
      title: "Your mint failed!",
      description: "Please try again.",
      status: "error",
      duration: 900,
      isClosable: true,
    });
  } finally {
    const idx = guardList.findIndex((g) => g.label === guardToUse.label);
    if (idx !== -1) {
      const copy = [...guardList];
      copy[idx].minting = false;
      copy[idx].loadingText = undefined;
      setGuardList(copy);
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
  setGuardList,
  setMintsCreated,
  onOpen,
  setCheckEligibility,
  ownedCoreAssets = [],
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


  // 3️⃣ Fire off your helper’s mintClick
  const handleMint = (btn: GuardButtonList) => {
    mintClick(
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
    ).catch((err) => {
      console.error("Unexpected mintClick error:", err);
    });
  };
  
return (
    <VStack spacing={3} align="center" w="full">
      {buttons.map((btn, idx) => {
        const isClaim = btn.buttonLabel.toUpperCase() === "CLAIM";
        const timerTarget = isClaim ? btn.endTime : btn.startTime;
        return (
          <VStack key={idx} spacing={1} align="center" w="full">
            {/* only show the claim countdown if it’s actually configured */}
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
                mt="3"
                {...buttonProps}
                isDisabled={!walletPublicKey || !btn.allowed}
                isLoading={guardList.find((g) => g.label === btn.label)?.minting}
                loadingText={guardList.find((g) => g.label === btn.label)?.loadingText}
                onClick={() => handleMint(btn)}
              >
                {btn.buttonLabel}
              </Button>
            </Tooltip>

            <Text fontStyle="copy" fontWeight="bold">{btn.mintText}</Text>
            <Divider w="full" />
          </VStack>
        );
      })}
    </VStack>
  );
}
