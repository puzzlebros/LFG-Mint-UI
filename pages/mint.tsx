// pages/mint.tsx
import { PublicKey, publicKey, Umi } from "@metaplex-foundation/umi";
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
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
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
import { Footer } from '../components/Footer';
import { allowLists } from "../allowlist";
import { faqs } from "../public/data/faqs";


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
  const [candyGuard, setCandyGuard] = useState<CandyGuard | undefined>(undefined);
  const toast = useToast();

  useEffect(() => {
    // Only run the effect when eligibility is checked and we haven't fetched data yet
    if (!checkEligibility) return;

    const fetchData = async () => {
      try {
        console.log("💠 Fetching Candy Machine and Guard...");
        const fetchedCandyMachine = await fetchCandyMachine(umi, publicKey(candyMachineId));
        setCandyMachine(fetchedCandyMachine);

        if (fetchedCandyMachine) {
          const fetchedCandyGuard = await safeFetchCandyGuard(umi, fetchedCandyMachine.mintAuthority);
          setCandyGuard(fetchedCandyGuard ?? undefined);
          if (firstRun) setFirstRun(false);
        }
      } catch (e) {
        console.error("💠 Error fetching Candy Machine/Guard:", e);
        toast({
          title: "Failed to load candy machine/guard",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    };

    fetchData();
  }, [umi, candyMachineId, checkEligibility, firstRun]);

  return { candyMachine, candyGuard, setCandyMachine };
};

export default function MintPage() {
  const umi = useUmi();
  const toast = useToast();
  const { publicKey: walletPublicKey, connected } = useWallet();

// — UI state —
  const [allowlistLoaded, setAllowlistLoaded] = useState(false);
  const [inTop10, setInTop10]                 = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [guards, setGuards]                   = useState<GuardReturn[]>([]);
  const [isAllowed, setIsAllowed]             = useState(false);
  const [mintsCreated, setMintsCreated] = useState<
    { mint: PublicKey; offChainMetadata?: JsonMetadata }[] | undefined
  >(undefined);
  const [ownedTokens, setOwnedTokens]         = useState<DigitalAssetWithToken[]>();
  const [ownedCoreAssets, setOwnedCoreAssets] = useState<DasApiAssetAndAssetMintLimit[]>();
  const [checkEligibility, setCheckEligibility] = useState<boolean>(false);
  

  // — Modals —
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();

  // 1️⃣ Load allowlist once
  useEffect(() => {
    if (allowlistLoaded) return;            // << only once
    console.log("⏳ Loading allowlist…");
    axios.get<string[]>("/api/allowlist")
      .then(({ data }) => {
        allowLists.set("LFG", data);
        console.log("🚀 allowLists['LFG'] loaded:", data);
      })
      .catch((err) => {
        console.error("❌ Failed to fetch allowlist:", err);
        toast({ title: "Could not load allowlist", status: "error" });
      })
      .finally(() => setAllowlistLoaded(true));
  }, [toast, allowlistLoaded]);

  // 2️⃣ Clear on wallet disconnect
  useEffect(() => {
    if (!walletPublicKey) {
      console.log("🔌 Wallet disconnected — clearing state");
      setGuards([]);
      setIsAllowed(false);
      setLoading(false);
    }
  }, [walletPublicKey]);

  // 3️⃣ Leaderboard Top-10
  useEffect(() => {
    if (!walletPublicKey) return setInTop10(false);
    axios.get<LeaderboardEntry[]>("/api/leaderboard")
      .then(({ data }) => {
        setInTop10(data.map((e) => e.wallet_address).includes(walletPublicKey.toString()));
      })
      .catch((err) => console.error("❌ leaderboard fetch failed:", err));
  }, [walletPublicKey]);

  // 4️⃣ CandyMachine & Guard
  const candyMachineId = useMemo(
    () => publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!),
    []
  );
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard]     = useState<CandyGuard>();

  useEffect(() => {
    if (!walletPublicKey || candyMachine) return; // << only if not already loaded
    console.log("💠 Fetching Candy Machine & Guard…");
    (async () => {
      try {
        const cm = await fetchCandyMachine(umi, candyMachineId);
        setCandyMachine(cm);
        const cg = await safeFetchCandyGuard(umi, cm.mintAuthority);
        setCandyGuard(cg!);
      } catch (e) {
        console.error("💠 CM/Guard load error:", e);
        toast({ title: "Error loading Candy Machine", status: "error" });
      }
    })();
  }, [umi, candyMachineId, walletPublicKey, candyMachine, toast]);

  // 5️⃣ Initial guard check on connect
  useEffect(() => {
    if (!walletPublicKey || !allowlistLoaded || !candyMachine || !candyGuard) {
      return;
    }
    console.log("🔍 initial guardChecker…");
    setLoading(true);
    (async () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      try {
        const { guardReturn, ownedTokens, ownedCoreAssets } =
          await guardChecker(umi, candyGuard, candyMachine, now);
        console.log("✅ initial guardReturn:", guardReturn);
        setGuards(guardReturn);
        setOwnedTokens(ownedTokens);
        setOwnedCoreAssets(ownedCoreAssets);
        setIsAllowed(guardReturn.some((g) => g.allowed));
      } catch (err) {
        console.error("🚨 guardChecker error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [walletPublicKey, allowlistLoaded, candyMachine, candyGuard, umi]);

    useEffect(() => {
  // only run when mintsCreated is defined and non‐empty
  if (!mintsCreated || mintsCreated.length === 0) {
    return;
  }
    setCheckEligibility(true);
  }, [mintsCreated]);

  // 6️⃣ Re-run guard check after mint
  useEffect(() => {
    // don’t run until a mint actually happens
    if (!mintsCreated || mintsCreated.length === 0) return;

    // grab the latest mint
    const { offChainMetadata, mint } = mintsCreated[mintsCreated.length - 1];
    if (!offChainMetadata?.name || !offChainMetadata.image) return;

    // fire-and-forget: don’t await or block UI
    axios.post('/api/postMint', {
      name:        offChainMetadata.name,
      imageUrl:    offChainMetadata.image,
      mintAddress: mint.toString(),
    }).catch((err) => {
      console.error("⚠️ postMint failed:", err);
    });
  }, [mintsCreated]);

  // ▶️ isMinting for your hatch animation
  const isMinting = guards.some((g) => g.minting);

  // Page content as a separate component
  const PageContent = () => {

    // Find the allow‐list group label
    const allowListLabel = candyGuard
      ?.groups.find((g) => g.guards.allowList.__option === 'Some')
      ?.label;

    // Find the corresponding guardReturn entry
    const allowGuard = guards.find((g) => g.label === allowListLabel);

    // Booleans for which UI to show
    const showLogin = !connected;
    const showClaim = Boolean(
      walletPublicKey &&
      inTop10 &&
      allowGuard &&
      allowGuard.maxAmount > 0
    );
    const showMint = Boolean(
      walletPublicKey &&
      !showClaim &&
      isAllowed
    );

    // Claim button only uses the one allow‐list guard
    const claimGuardList = useMemo(
      () => (allowGuard ? [allowGuard] : []),
      [allowGuard]
    );

    // Pay/mint buttons use every other guard…
    // but if there’s more than one, drop the "default" placeholder
    const payGuardList = useMemo(() => {
      const list = guards.filter((g) => g.label !== allowListLabel);
      return list.length > 1
        ? list.filter((g) => g.label !== 'default')
        : list;
    }, [guards, allowListLabel]);

    // How many items remain
    const availableCount = candyMachine
      ? Number(candyMachine.data.itemsAvailable) - Number(candyMachine.itemsRedeemed)
      : 0;

    return (
      <Flex
        direction={{ base: "column", md: "row" }}
        align="center"
        justify="center"
        flex="1"
        gap={6}        // 🆕 extra gutter
        px={2}
        mt="20"
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
            lineHeight="4.5rem"
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
            <Text textAlign="center" textStyle="copy" fontSize="1.3rem">
              <Text as="span" fontWeight="bold">
                You are a top 10 winner.
              </Text>
              <br />
              Claim your Flamingo FREE!
            </Text>
          )}
          {showMint && (
            <Text textAlign="center" textStyle="copy" fontSize="1.3rem">
              <Text as="span" fontWeight="bold">
                Support the project.
              </Text>
              <br />
              You can mint your Flamingo
              <br />
              and join the flock.
            </Text>
          )}

          {walletPublicKey ? (
            // Wallet is connected: show either Skeleton (while loading/fetching) or ButtonList
            (!candyMachine || !candyGuard || loading) ? (
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
            )
          ) : (
            // Wallet not connected: show the same "Mint" label but disabled
            <Center w="full">
              <Button size="default" isDisabled>
                Mint
              </Button>
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
          {walletPublicKey ? (
            // Wallet connected: show Skeleton while loading or candyMachine missing, else show image + count
            (!candyMachine || loading) ? (
              <Skeleton
                w={{ base: "200px", md: "375px" }}
                h={{ base: "200px", md: "475px" }}
                rounded="md"
              />
            ) : (
              <>
                <Box
                  w="100%"
                  maxW={{ base: "100%", md: "800px" }}
                  animation={isMinting ? `${hatch} 0.8s ease-in-out infinite` : undefined}
                >
                  <Image
                    src={image}
                    alt="Project artwork"
                    rounded="md"
                    objectFit="cover"
                    w="100%"
                    h="auto"
                    maxH={{ base: "300px", md: "800px" }}
                  />
                </Box>
                <Text fontStyle="copy" fontWeight="bold" color="brand.DarkPink">
                  LFGs remaining: {Number(candyMachine!.data.itemsAvailable) - Number(candyMachine!.itemsRedeemed)}
                </Text>
              </>
            )
          ) : (
            // Wallet not connected: show artwork without loading skeleton
            <Box
              w="100%"
              maxW={{ base: "100%", md: "800px" }}
            >
              <Image
                src={image}
                alt="Project artwork"
                rounded="md"
                objectFit="cover"
                w="100%"
                h="auto"
                maxH={{ base: "300px", md: "800px" }}
              />
            </Box>
          )}
        </VStack>
      </Flex>
    );
  };

  // Return the main layout
  return (
    <Flex
      direction="column"
      minH="100vh"
      bgGradient="linear(to-b, #93D2FF 0%, #BDACFF 29%, #FFBCD5 100%)"
    >
      <Flex
        flex="1"
        direction="column"
        align="center"
        justify="center"
        overflowY="auto"
        minH="0"              // <-- allow Flex child to shrink correctly
        px={{ base: 4, md: 8 }}
      >
        <Box width="full" maxWidth={{ base: "100%", md: "1000px" }} px={{ base: 4, md: 8 }}>
          <PageContent />

          <Box mt={12} px={4}>
  <Text fontSize="2xl" fontWeight="semibold" mb={4}>
    Frequently Asked Questions
  </Text>

  <Accordion allowMultiple>
    {faqs.map(({ question, answer }, idx) => (
      <AccordionItem key={idx} borderColor="gray.200">
        <h2>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              {question}
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          <Text>{answer}</Text>
        </AccordionPanel>
      </AccordionItem>
    ))}
  </Accordion>
</Box>
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
          
      </Flex>
    <Footer />
  </Flex>

  );
}
