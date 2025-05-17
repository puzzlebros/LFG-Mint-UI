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
} from "@metaplex-foundation/mpl-core-candy-machine";
import { guardChecker } from "../utils/metaplex/checkAllowed";
import {
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
  VStack,
  Flex,
  Heading,
  Center,
  Text,
  Button,
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
      console.log("💠 [useCandyMachine] checkEligibility=", checkEligibility);
      if (!checkEligibility) return;

      try {
        console.log("💠 fetching CandyMachine…");
        const fetched = await fetchCandyMachine(umi, publicKey(candyMachineId));
        console.log("💠 fetchedCandyMachine:", fetched);
        setCandyMachine(fetched);
        if (!fetched) return;

        console.log("💠 fetching CandyGuard…");
        const guard = await safeFetchCandyGuard(umi, fetched.mintAuthority);
        console.log("💠 fetchedCandyGuard:", guard);
        setCandyGuard(guard ?? undefined);
        if (firstRun) setFirstRun(false);
      } catch (e) {
        console.error("💠 useCandyMachine error", e);
        toast({
          title: "Failed to load candy machine/guard",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    })();
  }, [umi, candyMachineId, checkEligibility]);

  return { candyMachine, candyGuard, setCandyMachine };
};

export default function MintPage() {
  const umi = useUmi();
  const toast = useToast();
  const { publicKey: walletPublicKey } = useWallet();

// — UI state —
  const [inTop10, setInTop10] = useState(false);
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[]>();
  const [isAllowed, setIsAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [ownedCoreAssets, setOwnedCoreAssets] = useState<DasApiAssetAndAssetMintLimit[]>();
  const [guards, setGuards] = useState<GuardReturn[]>([{ label: 'startDefault', allowed: false, maxAmount: 0 }]);
  const [firstRun, setFirstRun] = useState(true);
  const [checkEligibility, setCheckEligibility] = useState(true);

  // — Modals —
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();

  // ───────── when wallet connects/disconnects ─────────
  useEffect(() => {
    if (!walletPublicKey) {
      // on disconnect: disable buttons immediately
      setGuards([{ label: 'startDefault', allowed: false, reason: 'Please connect your wallet to mint', maxAmount: 0 }]);
      setIsAllowed(false);
      setLoading(false);
      setCheckEligibility(false);
    } else {
      // on (re)connect: trigger a guard‐check
      setCheckEligibility(true);
    }
  }, [walletPublicKey]);

  // — Leaderboard fetch —
  useEffect(() => {
    if (!walletPublicKey) {
      setInTop10(false);
      return;
    }
    (async () => {
      try {
        const { data } = await axios.get<LeaderboardEntry[]>("/api/leaderboard");
        setInTop10(data.some(e => e.wallet_address === walletPublicKey.toString()));
      } catch (err) {
        console.error("Could not fetch leaderboard", err);
      }
    })();
  }, [walletPublicKey]);

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
    console.log("🚦 guardChecker effect:", {
      checkEligibility,
      hasCandyMachine: !!candyMachine,
      hasCandyGuard:   !!candyGuard,
    });
    
    if (!walletPublicKey) {
      console.log("⏭ guard-check skipped: no wallet");
      return;
    }

    if (!checkEligibility || !candyMachine || !candyGuard) {
      console.log("⏭ guardChecker skipped");
      return;
    }

    setLoading(true);
    let cancelled = false;

    (async () => {
      console.log("🔍 running guardChecker…");
      try {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const { guardReturn, ownedTokens, ownedCoreAssets } =
          await guardChecker(umi, candyGuard, candyMachine, now);

        if (!cancelled) {
          console.log("✅ guardChecker returned:", guardReturn);
          setGuards(guardReturn);
          setOwnedTokens(ownedTokens);
          setOwnedCoreAssets(ownedCoreAssets);
          setIsAllowed(guardReturn.some((g) => g.allowed));
        }
      } catch (err) {
        console.error("🚨 guardChecker error", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setCheckEligibility(false);
          console.log("🔚 guardChecker done, loading=false");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
 }, [umi, candyMachine, candyGuard, checkEligibility, walletPublicKey]);

  // ▶️ Re-trigger guard-check once your mint completes
  useEffect(() => {
    if (mintsCreated?.length) {
      setCheckEligibility(true);
    }
  }, [mintsCreated]);

  const isMinting = guards.some(g => g.minting);

  // Page content as a separate component
  const PageContent = () => {

    const allowListLabel = candyGuard?.groups.find(g => g.guards.allowList.__option === 'Some')?.label;
    const allowGuard = guards.find(g => g.label === allowListLabel);

    const showLogin = !walletPublicKey;
    const showClaim = Boolean(walletPublicKey && inTop10 && allowGuard && allowGuard.maxAmount > 0);
    const showMint  = Boolean(walletPublicKey && !showClaim && isAllowed);

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
            <Text textAlign="center" textStyle="copy" fontSize="1.3rem">
              <Text as="span" fontWeight="bold">
                Log in to join the flock.
              </Text>
              <br />
                Play to win or mint right away!
            </Text>
          )}
          {showClaim && (
            <Text textAlign="center" textStyle="copy"  fontSize="1.3rem">
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

          {/* ─── ADMIN BUTTON (in-column) ─── */}
          {umi.identity.publicKey === candyMachine?.authority && (
            <Button size="default" mt={6} onClick={onInitializerOpen}>
              ADMIN
            </Button>
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
    <Box
      minH="100vh"
      bgGradient="linear(
      to-b,
      #93D2FF 0%,
      #BDACFF 29%,
      #FFBCD5 100%
      )"
    >
    
    <Center flexDirection="column" py={10}>
      <Box width="full" maxWidth={{ base: "100%", md: "1000px" }} px={{ base: 4, md: 8 }}>
        <PageContent />
      </Box>

      {/* Show minted NFT */}
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

      {/* InitializeModal */}
      <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
        <ModalOverlay />
        <ModalContent maxW="600px">
          <ModalHeader>Initializer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <InitializeModal
              umi={umi}
              candyMachine={candyMachine!}
              candyGuard={candyGuard!}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Center>
    +    </Box>
  );
}
