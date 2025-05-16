// pages/mint.tsx
import { PublicKey, publicKey, Umi, Some } from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useUmi } from "../utils/metaplex/useUmi";
import {
  fetchCandyMachine,
  safeFetchCandyGuard,
  CandyGuard,
  CandyMachine,
  StartDate
} from "@metaplex-foundation/mpl-core-candy-machine";
import { guardChecker } from "../utils/metaplex/checkAllowed";

import {
  Card,
  CardHeader,
  CardBody,
  StackDivider,
  Stack,
  useToast,
  Skeleton,
  useDisclosure,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  Image,
  ModalHeader,
  ModalOverlay,
  Box,
  Divider,
  VStack,
  Flex,
  Heading,
  Center,
  Text,
  Button,
  Grid,
} from "@chakra-ui/react";

import { ButtonList } from "../components/mintButton";
import { ShowNft } from "../components/showNft";
import { InitializeModal } from "../components/initializeModal";
import { image, headerText } from "../settings";
import { GuardReturn, DasApiAssetAndAssetMintLimit } from "../utils/metaplex/checkerHelper";
import { useWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import type { LeaderboardEntry } from "@/types/leaderboard";
import { keyframes } from "@emotion/react";

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
`;

// ——— “vibrating hatch” keyframes ———
const hatch = keyframes`
  0% {
    filter: blur(3px);
    transform: scale(1) translate(0,0) rotate(0deg);
  }
  20% {
    filter: blur(2px);
    transform: scale(1.02) translate(-2px,1px) rotate(-1deg);
  }
  40% {
    filter: blur(1px);
    transform: scale(1.04) translate(2px,-1px) rotate(1deg);
  }
  60% {
    filter: blur(0.5px);
    transform: scale(1.06) translate(-1px,2px) rotate(-2deg);
  }
  80% {
    filter: blur(0.2px);
    transform: scale(1.08) translate(1px,-2px) rotate(2deg);
  }
 100% {
    filter: blur(0);
    transform: scale(1.1) translate(0,0) rotate(0deg);
  }
`;

//
const useCandyMachine = (
  umi: Umi,
  candyMachineId: string,
  checkEligibility: boolean,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>,
  firstRun: boolean,
  setFirstRun: Dispatch<SetStateAction<boolean>>
) => {
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (checkEligibility) {
        if (!candyMachineId) {
          console.error("No candy machine in .env!");
          if (!toast.isActive("no-cm")) {
            toast({
              id: "no-cm",
              title: "No candy machine in .env!",
              description: "Add your candy machine address to the .env file!",
              status: "error",
              duration: 999999,
              isClosable: true,
            });
          }
          return;
        }

        let fetchedCandyMachine: CandyMachine | undefined;
        try {
          fetchedCandyMachine = await fetchCandyMachine(
            umi,
            publicKey(candyMachineId)
          );
        } catch (e) {
          console.error(e);
          toast({
            id: "no-cm-found",
            title: "The CM from .env is invalid",
            description: "Are you using the correct environment?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }
        setCandyMachine(fetchedCandyMachine);
        if (!fetchedCandyMachine) { return; }

        let fetchedCandyGuard: CandyGuard | null = null;
        try {
          fetchedCandyGuard = await safeFetchCandyGuard(
            umi,
            fetchedCandyMachine.mintAuthority
          );
        } catch (e) {
          console.error(e);
          toast({
            id: "no-guard-found",
            title: "No Candy Guard found!",
            description: "Do you have one assigned?",
            status: "error",
            duration: 999999,
            isClosable: true,
          });
        }

        // Convert null to undefined to match our state type
        setCandyGuard(fetchedCandyGuard ?? undefined);
        if (firstRun) {
          setFirstRun(false);
        }
      }
    })();
  }, [umi, candyMachineId, checkEligibility]);

  return { candyMachine, candyGuard, setCandyMachine };
};

export default function MintPage() {
  const umi = useUmi();
  const toast = useToast();
  
  const { publicKey: walletPublicKey } = useWallet();
  const [inTop10, setInTop10] = useState(false);

  useEffect(() => {
    if (!walletPublicKey) {
      setInTop10(false);
      return;
    }

    (async () => {
      try {
        const res = await axios.get<LeaderboardEntry[]>("/api/leaderboard");
        setInTop10(
          res.data.some((e) => 
            e.wallet_address === walletPublicKey.toString()
          )
        );
      } catch (err) {
        console.error("Could not fetch leaderboard", err);
      }
    })();
  }, [walletPublicKey]);

  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();

  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[]>();
  const [isAllowed, setIsAllowed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [ownedCoreAssets, setOwnedCoreAssets] = useState<DasApiAssetAndAssetMintLimit[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([{ label: 'startDefault', allowed: false, maxAmount: 0 }]);
  const [firstRun, setFirstRun] = useState(true);
  const [checkEligibility, setCheckEligibility] = useState<boolean>(true);

  // Check for Candy Machine ID
  if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
    console.error("No candy machine in .env!");
    if (!toast.isActive("no-cm")) {
      toast({
        id: "no-cm",
        title: "No candy machine in .env!",
        description: "Add your candy machine address to the .env file!",
        status: "error",
        duration: 999999,
        isClosable: true,
      });
    }
  }

  // Convert Candy Machine ID from ENV to PublicKey
  const candyMachineId: PublicKey = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      toast({
        title: "No candy machine in .env!",
        status: "error",
        duration: 6000,
      });
      return publicKey("11111111111111111111111111111111");
    }
    return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
  }, [toast]);

  // Fetch CM & Guard
  const { candyMachine, candyGuard, setCandyMachine } = useCandyMachine(
    umi,
    candyMachineId.toString(),
    checkEligibility,
    setCheckEligibility,
    firstRun,
    setFirstRun
  );

  // 🔄 Re-fetch CM after a mint to update available count
  useEffect(() => {
    if (!mintsCreated?.length || !candyMachine) return;
    (async () => {
      try {
        const refreshed = await fetchCandyMachine(umi, candyMachineId);
        setCandyMachine(refreshed);
      } catch (err) {
        console.error("Failed to refresh CM:", err);
      }
    })();
  }, [mintsCreated, candyMachine, candyMachineId]);

  // ▶️ Guard check + StartDate logic
  useEffect(() => {
    const run = async () => {
      if (!candyMachine || !candyGuard || !checkEligibility || isShowNftOpen) return;
      setFirstRun(false);

      // Compute clusterTime as current client‐side UNIX seconds
      const clusterTime = BigInt(Math.floor(Date.now() / 1000));

      // 2️⃣ Extract the on-chain startDate for each group
       candyGuard?.groups.forEach(g => {
        const sd = g.guards.startDate;
        if (sd.__option === 'Some') {
          const d = (sd as Some<StartDate>).value.date;
          console.log(`[${g.label}] onChainStart: ${d} now: ${clusterTime}`);
        }
      });

        // 3️⃣ Run the guard check
        const { guardReturn, ownedTokens, ownedCoreAssets } = await guardChecker(
          umi,
          candyGuard,
          candyMachine,
          clusterTime
        );


      setOwnedTokens(ownedTokens);
      setGuards(guardReturn);
      setOwnedCoreAssets(ownedCoreAssets);
      setIsAllowed(guardReturn.some((g) => g.allowed));
      setLoading(false);
    };
    run();
  }, [umi, candyMachine, candyGuard, checkEligibility, isShowNftOpen]);

  const isMinting = guards.some((g) => g.minting);

  // Page content as a separate component
  const PageContent = () => {

    const allowListLabel = candyGuard?.groups.find(g => g.guards.allowList.__option === 'Some')?.label;
    const allowGuard = guards.find(g => g.label === allowListLabel);

    const showLogin = !walletPublicKey;
    const showClaim = Boolean(walletPublicKey && inTop10 && allowGuard && allowGuard.maxAmount > 0);
    const showMint  = Boolean(walletPublicKey && !showClaim);

    const claimGuardList = useMemo(() => allowGuard ? [allowGuard] : [], [allowGuard]);
    const payGuardList   = useMemo(() => guards.filter(g => g.label !== allowListLabel), [guards, allowListLabel]);

    const availableCount = candyMachine
      ? Number(candyMachine.data.itemsAvailable) - Number(candyMachine.itemsRedeemed)
      : 0;

    return (
      <Flex
        direction={{ base: "column", md: "row" }}
        align="center"
        justify="center"
        h="100vh"
        gap={16}        // 🆕 extra gutter
        px={2}
      >
        {/* ─── LEFT ─── */}
        <VStack
          align="center"
          spacing={6}
          flex={1}
          h="100%"
          justify="center"
        >
          <Heading
            fontSize="5.8rem"
            fontWeight="normal"
            textAlign="center"
            textStyle="condensed"
            lineHeight="4rem"
          >
            {headerText}
          </Heading>

          {showLogin && (
            <Text textAlign="center" textStyle="copy" fontSize="1.5rem">
              <Text as="span" fontWeight="bold">
                Log in to join the flock.
              </Text>
              <br />
                Play to win or mint right away!
            </Text>
          )}
          {showClaim && (
            <Text textAlign="center" textStyle="copy"  fontSize="1.5rem">
              <Text as="span" fontWeight="bold">
                You are a top 10 winner.
              </Text>
              <br />
                Claim your Flamingo FREE!
            </Text>
          )}
          {showMint && (
            <Text textAlign="center" textStyle="copy"  fontSize="1.3rem">
              <Text as="span" fontWeight="bold">
                Support the project.
              </Text>
              <br />
                You can mint your Flamingo
              <br />
                and join the flock.
            </Text>
          )}

          {loading ? (
            <Center w="full">
              <Skeleton h="48px" w="200px" />
            </Center>
          ) : (
          <Center w="full">
            <ButtonList
              guardList={showClaim ? claimGuardList : payGuardList}
              candyMachine={candyMachine}
              candyGuard={candyGuard}
              umi={umi}
              ownedTokens={ownedTokens}
              setGuardList={setGuards}
              setMintsCreated={setMintsCreated}
              onOpen={onShowNftOpen}
              setCheckEligibility={setCheckEligibility}
              ownedCoreAssets={ownedCoreAssets}
              {...(showClaim
                ? {
                    buttonProps: {
                      animation: `${pulse} 1.2s ease-in-out infinite`,
                      colorScheme: "pink",
                    },
                  }
                : {})}
              />
            </Center>
          )}
        </VStack>

        {/* ─── RIGHT ─── */}
        <VStack align="center" spacing={2} flex={1}>
          <Box
            w="100%"
            maxW={{ base: "100%", md: "800px" }}    // ↑ raise your max
            animation={isMinting ? `${hatch} 0.8s ease-in-out infinite` : undefined}
          >
            <Image
              src={image}
              alt="Project artwork"
              rounded="md"
              objectFit="cover"
              w="100%"
              h="auto"
              maxH={{ base: "300px", md: "800px" }}   // optional: cap the height
            />
          </Box>
          {!loading && (
            <Text fontStyle="copy" fontWeight="bold" color="brand.DarkPink">
              LFGs remaining: {availableCount}
            </Text>
          )}
        </VStack>
      </Flex>
    );
  };

  // Return the main layout
  return (
    <Center flexDirection="column" py={10}>
      <Box width="full" maxWidth={{ base: "100%", md: "1000px" }} px={{ base: 4, md: 8 }}>
        <PageContent />
      </Box>

      {/* Show Admin Button + Modal if user is the CM authority */}
      {umi.identity.publicKey === candyMachine?.authority && (
        <>
          <Center>
            <Button size="default" mt={10} onClick={onInitializerOpen}>
              ADMIN
            </Button>
          </Center>

          <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
            <ModalOverlay />
            <ModalContent maxW="600px">
              <ModalHeader>Initializer</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <InitializeModal
                  umi={umi}
                  candyMachine={candyMachine}
                  candyGuard={candyGuard}
                />
              </ModalBody>
            </ModalContent>
          </Modal>
        </>
      )}

      {/* After minting, show minted NFT in a modal */}
      <Modal isOpen={isShowNftOpen} onClose={onShowNftClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>A NEW FLAMINGO HAS BORN...</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ShowNft nfts={mintsCreated} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Center>
  );
}
