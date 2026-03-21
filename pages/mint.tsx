// pages/mint.tsx
import { PublicKey, publicKey, Umi } from "@metaplex-foundation/umi";
import { DigitalAssetWithToken, JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
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
  Tooltip,
} from "@chakra-ui/react";
import { ButtonList } from "../components/buttons/mintButton";
import { InitializeModal } from "../components/modals/initializeModal";
import { image, headerText } from "../settings";
import { GuardReturn, DasApiAssetAndAssetMintLimit } from "../utils/metaplex/checkerHelper";
import { useWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import { useLeaderboard } from '../components/LeaderboardContext';
import { keyframes } from "@emotion/react";
import { Footer } from '../components/Footer';
import { useWeeklyCycle } from '../utils/leaderboard/useWeeklyCycle';
import { useWindowSize } from "../utils/useWindowSize";
import Confetti from "react-confetti";
import ShowNft from "../components/modals/showNft";
import { useWalletContextGuard } from "../utils/useWalletContextGuard";


const pulseClaim = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(108, 0, 255, 0.7);
  }
  70% {
    transform: scale(1.04);
    box-shadow: 0 0 0 16px rgba(108, 0, 255, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(108, 0, 255, 0);
  }
`;

const hatch = keyframes`
  0%   { filter: blur(3px); transform: scale(1) translate(0,0) rotate(0deg); }
  20%  { filter: blur(2px); transform: scale(1.02) translate(-2px,1px) rotate(-1deg); }
  40%  { filter: blur(1px); transform: scale(1.04) translate(2px,-1px) rotate(1deg); }
  60%  { filter: blur(0.5px); transform: scale(1.06) translate(-1px,2px) rotate(-2deg); }
  80%  { filter: blur(0.2px); transform: scale(1.08) translate(1px,-2px) rotate(2deg); }
 100%  { filter: blur(0); transform: scale(1.1) translate(0,0) rotate(0deg); }
`;

const gradientShift = keyframes`
  0%   { background-position: 50% 0%; }
  50%  { background-position: 50% 100%; }
  100% { background-position: 50% 0%; }
`;

const DUMMY_NFT: { mint: PublicKey; offChainMetadata: JsonMetadata } = {
  mint: publicKey("11111111111111111111111111111111"),
  offChainMetadata: {
    name: "LFG #DEMO",
    description: "Demo preview of your minted Flamingo. This is local-only.",
    image: "/images/skins/1.png",
    attributes: [
      { trait_type: "Background", value: "Lavender" },
      { trait_type: "Mood", value: "Hyped" },
      { trait_type: "Edition", value: "Demo" },
    ],
  },
};

function hasPostedMint(mintAddress: string | undefined): boolean {
  if (!mintAddress) return false;
  try {
    return !!localStorage.getItem(`mint-posted:${mintAddress}`);
  } catch (e) {
    return false;
  }
}

function setPostedMint(mintAddress: string | undefined): void {
  if (!mintAddress) return;
  try {
    localStorage.setItem(`mint-posted:${mintAddress}`, "1");
  } catch (e) { /* ignore */ }
}

export default function MintPage() {
  const umi = useUmi();
  const toast = useToast();

  // — UI state —
  const { top10Wallets } = useLeaderboard();
  const [loading, setLoading] = useState(true);
  const [guards, setGuards] = useState<GuardReturn[]>([]);
  const [isAllowed, setIsAllowed] = useState(false);
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[]>();
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [ownedCoreAssets, setOwnedCoreAssets] = useState<DasApiAssetAndAssetMintLimit[]>();
  const [checkEligibility, setCheckEligibility] = useState<boolean>(false);
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();
  const { isFrozen } = useWeeklyCycle();

  // wallet + CM
  const wallet = useWallet();
  const { publicKey: walletPublicKey, connected } = wallet;

  useEffect(() => {
  console.log("ENVIRONMENT", process.env.NEXT_PUBLIC_ENVIRONMENT);
  console.log("RPC", process.env.NEXT_PUBLIC_RPC);
  console.log("CM", process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
  console.log("LUT", process.env.NEXT_PUBLIC_LUT);
  console.log("APP_URL", process.env.NEXT_PUBLIC_APP_URL);
}, []);

  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();

  const windowSize = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const { blocked, preflight } = useWalletContextGuard({
  enabled: !isDemo,
  onStale: (reason) => {
    toast({
      title: "Wallet disconnected",
      description: reason,
      status: "warning",
      duration: 6000,
      isClosable: true,
    });
  },
});

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.has("demoNft")) {
      setIsDemo(true);
      setMintsCreated([DUMMY_NFT]);
      onShowNftOpen();
    }
  }, [onShowNftOpen]);

  // confetti when NFT modal opens
  useEffect(() => {
    if (isShowNftOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isShowNftOpen]);

  // wallet in top10?
  useEffect(() => {
    if (isDemo) return;
    if (!walletPublicKey || !top10Wallets || top10Wallets.length === 0) return;
    setIsAllowed(top10Wallets.includes(walletPublicKey.toString()));
  }, [walletPublicKey, top10Wallets, isDemo]);


  // CM ID
  const candyMachineId = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      toast({ title: "No Candy Machine ID in .env", status: "error" });
      return publicKey("11111111111111111111111111111111");
    }
    return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
  }, [toast]);

  // clear on disconnect
  useEffect(() => {
    if (isDemo) return;
    if (!walletPublicKey) {
      console.log("🔌 Wallet disconnected — clearing state");
      setGuards([]);
      setIsAllowed(false);
      setLoading(false);
      setCandyMachine(undefined);
      setCandyGuard(undefined);
    }
  }, [walletPublicKey, isDemo]);

  // fetch CM + Guard once on connect
  useEffect(() => {
    if (isDemo) return;
    if (!walletPublicKey || candyMachine) return;
    console.log("💠 Fetching Candy Machine & Guard…");
    setLoading(true);

    (async () => {
      try {
        const cm = await fetchCandyMachine(umi, candyMachineId);
        const cg = await safeFetchCandyGuard(umi, cm.mintAuthority);
        if (!cg) throw new Error("No Candy Guard found");
        setCandyMachine(cm);
        setCandyGuard(cg);
      } catch (err) {
        console.error(err);
        toast({ title: "Error loading Candy Machine", status: "error" });
      } finally {
        setLoading(false);
        if (walletPublicKey) setCheckEligibility(true);
      }
    })();
  }, [walletPublicKey, candyMachine, candyMachineId, umi, toast, isDemo]);

  const isMinting = guards.some((g) => g.minting);

  // guardChecker
  useEffect(() => {
    if (isDemo) return;
    if (!checkEligibility || isMinting) return;
    if (!walletPublicKey || !candyMachine || !candyGuard) {
      setCheckEligibility(false);
      return;
    }

    console.log("🔍 Running guardChecker…");
    setLoading(true);
    let cancelled = false;

    if (!top10Wallets) {
      console.error("Top-10 wallets data is not available.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const { guardReturn, ownedTokens: ot, ownedCoreAssets: oca } =
          await guardChecker(umi, candyGuard, candyMachine, now, top10Wallets);

        if (!cancelled) {
          console.log("✅ guardReturn:", guardReturn);
          setGuards(guardReturn);
          setOwnedTokens(ot);
          setOwnedCoreAssets(oca);
          setIsAllowed(guardReturn.some((g) => g.allowed));
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Error checking eligibility", status: "error" });
        if (!cancelled) setIsAllowed(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setCheckEligibility(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    checkEligibility,
    walletPublicKey,
    candyMachine,
    candyGuard,
    umi,
    toast,
    isMinting,
    top10Wallets,
    isDemo,
  ]);

  // after mint finishes & modal closes, refresh supply + guards
  const onNftModalClose = () => {
    onShowNftClose();
    console.log("🔄 Re-fetching Candy Machine supply…");
    setLoading(true);
    fetchCandyMachine(umi, candyMachineId)
      .then((cm) => setCandyMachine(cm))
      .catch((err) => {
        console.error(err);
        toast({ title: "Error updating supply", status: "error" });
      })
      .finally(() => {
        setCheckEligibility(true);
        setLoading(false);
      });
  };

  // post to /api/postMint once per mint
  useEffect(() => {
    if (isDemo) return;
    if (!mintsCreated || mintsCreated.length === 0) return;
    const { offChainMetadata, mint } = mintsCreated[mintsCreated.length - 1];
    const mintAddress = mint?.toString();
    if (!offChainMetadata?.name || !offChainMetadata.image || !mintAddress) return;

    if (hasPostedMint(mintAddress)) {
      console.log(`[API POST] Already posted for mint ${mintAddress}, skipping`);
      return;
    }

    axios.post('/api/postMint', {
      name: offChainMetadata.name,
      imageUrl: offChainMetadata.image,
      mintAddress,
    })
      .then(() => setPostedMint(mintAddress))
      .catch(err => console.error("⚠️ postMint failed:", err));
  }, [mintsCreated, isDemo]);

  // refresh on focus
  useEffect(() => {
    if (isDemo) return;
    const onFocus = () => {
      if (walletPublicKey && !isMinting) {
        console.log("Window focus → refresh guard");
        setCheckEligibility(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [walletPublicKey, isMinting, isDemo]);

  const PageContent = () => {
    // allow-list group
    const allowListLabel = candyGuard
      ?.groups.find(g => g.guards.allowList.__option === 'Some')
      ?.label;
    const allowGuard = guards.find(g => g.label === allowListLabel);

    // states
    const showLogin = !connected || !walletPublicKey || blocked;
    const showClaim = Boolean(
      walletPublicKey &&
      allowGuard?.allowed &&
      allowGuard.maxAmount > 0 &&
      isFrozen
    );
    // showMint = any connected wallet that is not in claim state
    const showMint = Boolean(walletPublicKey && !showClaim);

    useEffect(() => {
      if (isDemo) return;
      console.log(
        `Claim eligibility: ${showClaim} Wallet in top-10 (any allowed guard): ${isAllowed}`
      );
    }, [showClaim, isAllowed]);

    // claim uses only allowGuard
    const claimGuardList = useMemo(
      () => (allowGuard ? [allowGuard] : []),
      [allowGuard]
    );

    // pay mint uses non-allowList allowed guards, drop default if multiple
    const payGuardList = useMemo(() => {
      const arr = guards.filter(g => g.label !== allowListLabel && g.allowed);
      return arr.length > 1 ? arr.filter(g => g.label !== 'default') : arr;
    }, [guards, allowListLabel]);

    // items available
    const availableCount = candyMachine
      ? Number(candyMachine.data.itemsAvailable) - Number(candyMachine.itemsRedeemed)
      : 0;

    // dynamic title + description
    let title = headerText;
    let descriptionContent: JSX.Element;

    if (showClaim) {
      title = "MINT YOUR REWARD";
      descriptionContent = (
        <>
          <Text as="span" fontWeight="bold">
            Congrats, Top 10 champ!
          </Text>
          <br />
          You’ve got what it takes, hit the button and mint your NFT
          before the 24 hour window closes.
        </>
      );
    } else if (showMint) {
      title = "GET YOUR LFG";
      descriptionContent = (
        <>
          <b>Want to help the flock grow?</b>
          <br />
          Buy your NFT and fly with us, every mint keeps the project
          soaring and unlocks new adventures for the community.
        </>
      );
    } else if (showLogin) {
      title = "CONNECT YOUR WALLET";
      descriptionContent = (
        <>
          <Text as="span" fontWeight="bold">
            Log in to join the flock.
          </Text>
          <br />
          Play to win or mint right away!
        </>
      );
    } else {
      // fallback – should be rare
      title = headerText;
      descriptionContent = (
        <>
          Connect your wallet to see if you can mint and join the flock.
        </>
      );
    }

    // which guard list + button props
    const activeGuardList = showClaim ? claimGuardList : payGuardList;
    const claimButtonProps = showClaim
      ? { animation: `${pulseClaim} 1.6s ease-in-out infinite` }
      : undefined;

    return (
      <Flex
        direction={{ base: "column", md: "row" }}
        align="center"
        justify="center"
        flex="1"
        gap={{ base: 3, md: 15 }}
        px={2}
        mt="20"
      >
        {/* LEFT: title, description, LFGs remaining, admin */}
        <VStack align="center" spacing={4} flex={1} h="100%" justify="center">
<Heading
  mt={{ base: "-3", md: "-10" }}
  fontSize={{ base: "2.7rem", md: "3.7rem" }}   // smaller on mobile
  fontWeight="normal"
  textAlign="center"
  textStyle="narrow"
  lineHeight={{ base: "2.3rem", md: "3.3rem" }} // adjusted for mobile
>
  {showLogin ? (
    <>
      CONNECT
      <br />
      YOUR WALLET
    </>
  ) : (
    title
  )}
</Heading>

  <Text
    textAlign="center"
    textStyle="copy"
    fontSize={{ base: "1rem", md: "1.2rem" }}     // smaller on mobile
    lineHeight={{ base: "1.3rem", md: "1.7rem" }} // adjusted for mobile
  >
    {descriptionContent}
  </Text>

          {/* Hide LFGs remaining on showLogin */}
          {!showLogin && (
            <Text
              textAlign="center"
              mt={{ base: "-2", md: "-2" }}
              // gradient animation applied at container level
              bgGradient="linear(to-b, brand.Purple, brand.Pink)"
              bgSize="100% 200%"
              animation={`${gradientShift} 3.5s ease-in-out infinite`}
              bgClip="text"
              color="transparent"
              fontSize={{ base: "1.3rem", md: "1.7rem" }}
            >
              {/* label in regular style */}
              <Text
                as="span"
                textStyle="normal"
                fontWeight="normal"
                mr={2}
                bg="inherit"
                bgClip="inherit"
              >
                {availableCount}
              </Text>
              {/* number in narrow style */}
              <Text
                as="span"
                textStyle="narrow"
                fontWeight="normal"
                bg="inherit"
                bgClip="inherit"
              >
                REMAINING
              </Text>
            </Text>
          )}
</VStack>

        {/* RIGHT: pack image + button + price */}
        <VStack align="center" spacing={2} flex={1}>
          {/* Image / skeleton */}
          {walletPublicKey ? (
            (!candyMachine || loading) ? (
              <Skeleton
                w={{ base: "200px", md: "375px" }}
                h={{ base: "200px", md: "475px" }}
                rounded="md"
              />
            ) : (
              <Box
                w="100%"
                maxW={{ base: "250px", md: "800px" }}
                animation={isMinting ? `${hatch} 0.8s ease-in-out infinite` : undefined}
                justifyContent="center"
                display="flex"
              >
                <Image
                  src={image}
                  alt="Project artwork"
                  rounded="md"
                  objectFit="cover"
                  w="90%"
                  h="auto"
                  maxH={{ base: "350px", md: "800px" }}
                />
              </Box>
            )
          ) : (
            <Box w="100%" maxW={{ base: "100%", md: "400" }} justifyContent="center" display="flex">
              <Image
                src={image}
                alt="Project artwork"
                rounded="md"
                objectFit="cover"
                w="90%"
                h="auto"
                maxH={{ base: "300px", md: "400" }}
              />
            </Box>
          )}

          {/* Button + price under image */}
          {walletPublicKey  && !blocked ? (
            (!candyMachine || !candyGuard || loading) ? (
              <Center w="full">
                <Skeleton h="48px" w="200px" />
              </Center>
            ) : (
              <Center w="full">
                <ButtonList
                  guardList={activeGuardList}
                  candyMachine={candyMachine}
                  candyGuard={candyGuard}
                  umi={umi}
                  ownedTokens={ownedTokens}
                  setGuardList={setGuards}
                  setMintsCreated={setMintsCreated}
                  onOpen={onShowNftOpen}
                  setCheckEligibility={setCheckEligibility}
                  ownedCoreAssets={ownedCoreAssets}
                  buttonProps={claimButtonProps}
                  top10Wallets={top10Wallets}
                  onBeforeMint={async () => {
                    const res = await preflight();
                    if (!res.ok) throw new Error(res.reason);
                  }}
                />
              </Center>
            )
          ) : (
            <Center w="full">
              <Tooltip
                label="Connect a wallet to mint"
                hasArrow
                placement="top"
                openDelay={200}
              >
                <span>
                  <Button size="default" isDisabled mt={2}>
                    MINT 
                  </Button>
                </span>
              </Tooltip>
            </Center>
          )}
        </VStack>
      </Flex>
    );
  };

  // main return
  return (
    <Flex direction="column" minH="100vh">
      <Flex
        flex="1"
        direction="column"
        align="center"
        justify="center"
        overflowY="auto"
        minH="0"
        px={{ base: 4, md: 8 }}
      >
        <Box width="full" maxWidth={{ base: "100%", md: "1000px" }} px={{ base: 4, md: 8 }}>
          <PageContent />
        </Box>

        {/* minted NFT modal */}
        <Modal isOpen={isShowNftOpen} onClose={onNftModalClose}>
          <ModalOverlay />
          <ModalContent
            maxW={{ base: "90vw", md: "900px" }}
            w="full"
            borderRadius={0}
          >

            <ModalCloseButton />
            <ModalBody>
              <ShowNft nfts={mintsCreated} />
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* initializer modal */}
        <Modal isOpen={isInitializerOpen} onClose={onInitializerClose}>
          <ModalOverlay />
          <ModalContent maxW="600px">
            <ModalHeader>Initializer</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {candyMachine && candyGuard && (
                <InitializeModal umi={umi} candyMachine={candyMachine} candyGuard={candyGuard} />
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Flex>

      <Footer />

      {/* Confetti overlay */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          initialVelocityY={{ min: 10, max: 20 }}
          initialVelocityX={{ min: -10, max: 10 }}
          colors={["#F279A6", "#6C00FF", "#9D72FF", "#161540"]}
          style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999 }}
        />
      )}
    </Flex>
  );
}
