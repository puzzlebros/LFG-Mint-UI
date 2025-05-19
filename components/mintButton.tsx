// components/mintButton.tsx
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import { CandyGuard, CandyMachine } from "@metaplex-foundation/mpl-core-candy-machine";
import { DasApiAssetAndAssetMintLimit, GuardReturn } from "../utils/metaplex/checkerHelper";
import { PublicKey, Umi, createBigInt } from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mintSettings } from "../settings";
import {
  Button,
  Text,
  Tooltip,
  VStack,
  Divider,
  ButtonProps
} from "@chakra-ui/react";
import { GuardButtonList, mintClick } from "../utils/metaplex/mintHelper";
import { useSolanaTime } from "@/utils/metaplex/SolanaTimeContext";


// ———————— TIMER ————————
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
  useEffect(() => {
    const iv = setInterval(() => setRemaining((r) => r - BigInt(1)), 1000);
    return () => clearInterval(iv);
  }, []);
  const days = remaining / BigInt(86400),
    hrs = (remaining % BigInt(86400)) / BigInt(3600),
    mins = (remaining % BigInt(3600)) / BigInt(60),
    secs = remaining % BigInt(60);

  if (remaining <= BigInt(0)) {
    setCheckEligibility(true);
    return <Text fontSize="sm" fontWeight="bold">00m 00s</Text>;
  }
  const pad = (n: bigint) =>
    n.toLocaleString("en-US", { minimumIntegerDigits: 2, useGrouping: false });
  if (days > BigInt(0))
    return <Text fontSize="sm" fontWeight="bold">
      {pad(days)}d {pad(hrs)}h {pad(mins)}m {pad(secs)}s
    </Text>;
  if (hrs > BigInt(0))
    return <Text fontSize="sm" fontWeight="bold">
      {pad(hrs)}h {pad(mins)}m {pad(secs)}s
    </Text>;
  return <Text fontSize="sm" fontWeight="bold">
    {pad(mins)}m {pad(secs)}s
  </Text>;
};


// ———————— PROPS ————————
type Props = {
  umi: Umi;
  guardList: GuardReturn[];
  candyMachine?: CandyMachine;
  candyGuard?: CandyGuard;
  ownedTokens?: DigitalAssetWithToken[];
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>;
  mintsCreated?: { mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined;
  setMintsCreated: Dispatch<
    SetStateAction<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[]  | undefined>
  >;
  onOpen: () => void;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
  ownedCoreAssets?: DasApiAssetAndAssetMintLimit[];
  buttonProps?: ButtonProps;
};


// ———————— COMPONENT ————————
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

  if (!candyMachine || !candyGuard) return <></>;

  // 1️⃣ Dedupe & drop "default" if more than one guard
  const filtered = guardList
    .filter((g, i, arr) => i === arr.findIndex((x) => x.label === g.label))
    .filter((g, _, all) => (all.length > 1 ? g.label !== "default" : true));

  // 2️⃣ Map to fully typed GuardButtonList entries
  const buttons: GuardButtonList[] = filtered.map((g) => {
    const cfg = mintSettings.find((t) => t.label === g.label);
    const grp = candyGuard.groups.find((gr) => gr.label === g.label);
    return {
      ...g,
      header:      cfg?.header      ?? "",
      mintText:    cfg?.mintText    ?? "",
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
      candyMachine!,
      candyGuard!,
      ownedTokens,
      1,
      guardList,
      setGuardList,
      setCheckEligibility,
      ownedCoreAssets
    )
      .then((newMints) => {
        if (newMints.length > 0) {
          setMintsCreated!(newMints);
          onOpen();
        }
      })
      .catch((err) => {
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
            {isClaim && (
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

            <Tooltip label={btn.tooltip}>
              <Button
                size="default"
                mt="3"
                {...buttonProps}
                isDisabled={!btn.allowed}
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
