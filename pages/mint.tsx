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
  getMerkleRoot
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
import { keyframes } from "@emotion/react";
import { Footer } from '../components/Footer';

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
`;

const hatch = keyframes`
  0%   { filter: blur(3px); transform: scale(1) translate(0,0) rotate(0deg); }
  20%  { filter: blur(2px); transform: scale(1.02) translate(-2px,1px) rotate(-1deg); }
  40%  { filter: blur(1px); transform: scale(1.04) translate(2px,-1px) rotate(1deg); }
  60%  { filter: blur(0.5px); transform: scale(1.06) translate(-1px,2px) rotate(-2deg); }
  80%  { filter: blur(0.2px); transform: scale(1.08) translate(1px,-2px) rotate(2deg); }
 100%  { filter: blur(0); transform: scale(1.1) translate(0,0) rotate(0deg); }
`;

export default function MintPage() {
  const umi = useUmi();
  const toast = useToast();
  const { publicKey: walletPublicKey, connected } = useWallet();

  // — UI state —
  const [loading, setLoading] = useState(true);
  const [guards, setGuards] = useState<GuardReturn[]>([]);
  const [mintsCreated, setMintsCreated] = useState<{ mint: PublicKey; offChainMetadata?: JsonMetadata }[]>();
  const [ownedTokens, setOwnedTokens] = useState<DigitalAssetWithToken[]>();
  const [ownedCoreAssets, setOwnedCoreAssets] = useState<DasApiAssetAndAssetMintLimit[]>();
  const [checkEligibility, setCheckEligibility] = useState<boolean>(false);

  // CandyMachine & Guard
  const candyMachineId = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_CANDY_MACHINE_ID) {
      toast({ title: "No Candy Machine ID in .env", status: "error" });
      // fallback dummy
      return publicKey("11111111111111111111111111111111");
    }
    return publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID);
  }, [toast]);

  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyGuard, setCandyGuard] = useState<CandyGuard>();

  // — Modals —
  const { isOpen: isShowNftOpen, onOpen: onShowNftOpen, onClose: onShowNftClose } = useDisclosure();
  const { isOpen: isInitializerOpen, onOpen: onInitializerOpen, onClose: onInitializerClose } = useDisclosure();

 // New: whenever candyGuard loads, fetch the top-10 from your API,
  // compute the Merkle root client-side and log it.
  useEffect(() => {
    if (!candyGuard) return;

    // find the label of your allowList group
    const allowLabel = candyGuard.groups.find(
      (g) => g.guards.allowList.__option === "Some"
    )?.label;

    if (!allowLabel) {
      console.warn("No allowList guard on this Candy Guard");
      return;
    }

    (async () => {
      try {
        // (1) pull the current top-10 from your own endpoint
        const res = await fetch("/api/allowlist");
        const leaves: string[] = await res.json();

        // (2) map to PublicKey[]
        const keys = leaves.map((addr) => publicKey(addr));

        // (3) compute the Merkle root
        const root = getMerkleRoot(keys);

        // (4) hex-encode for human-readable logging
        const hex = Array.from(root)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        console.groupCollapsed("🪵 allowlist debug");
        console.log("Label:", allowLabel);
        console.log("Leaves:", leaves);
        console.log("Computed Merkle Root (hex):", hex);
        console.log(
  "▶️ Merkle root (base64):",
  Buffer.from(root).toString("base64"));
        console.groupEnd();
      } catch (err) {
        console.error("Failed to compute UI Merkle root:", err);
      }
    })();
  }, [candyGuard]);

  // Clear on wallet disconnect
  useEffect(() => {
    if (!walletPublicKey) {
      console.log("🔌 Wallet disconnected — clearing state");
      setGuards([]);
      setLoading(false);
      setCandyMachine(undefined);
      setCandyGuard(undefined);
    }
  }, [walletPublicKey]);

  // Fetch CandyMachine & Guard ONCE, when wallet connects
  useEffect(() => {
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
        // kick off one guard check now that CM+guard are loaded
        if (walletPublicKey) setCheckEligibility(true);
      }
    })();
  }, [walletPublicKey, candyMachine, candyMachineId, umi, toast]);

  // Run guardChecker when eligibility flag flips
  const isMinting = guards.some((g) => g.minting);
  useEffect(() => {
    if (!checkEligibility || isMinting) return;
    if (!walletPublicKey || !candyMachine || !candyGuard) {
      setCheckEligibility(false);
      return;
    }

    console.log("🔍 Running guardChecker…");
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const { guardReturn, ownedTokens: ot, ownedCoreAssets: oca } =
          await guardChecker(umi, candyGuard, candyMachine, now);

        if (!cancelled) {
          console.log("✅ guardReturn:", guardReturn);
          setGuards(guardReturn);
          setOwnedTokens(ot);
          setOwnedCoreAssets(oca);
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Error checking eligibility", status: "error" });
      } finally {
        if (!cancelled) {
          setLoading(false);
          setCheckEligibility(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [checkEligibility, walletPublicKey, candyMachine, candyGuard, umi, toast, isMinting]);

  // After mint, re-fetch supply & re-run guard
  const onNftModalClose = () => {
    // (1) close the popup
    onShowNftClose();

    // (2) pull fresh CM data so `itemsRedeemed` / `itemsAvailable` updates
    console.log("🔄 Re-fetching Candy Machine supply…");
    setLoading(true);
    fetchCandyMachine(umi, candyMachineId)
      .then((cm) => setCandyMachine(cm))
      .catch((err) => {
        console.error(err);
        toast({ title: "Error updating supply", status: "error" });
      })
      .finally(() => {
        // (3) now that supply is updated, re-run guardChecker exactly once
        setCheckEligibility(true);
        setLoading(false);
      });
  };

  // Post-mint webhook
  useEffect(() => {
    if (!mintsCreated?.length) return;
    const { offChainMetadata, mint } = mintsCreated[mintsCreated.length - 1];
    if (!offChainMetadata?.name || !offChainMetadata.image) return;
    axios.post('/api/postMint', {
      name: offChainMetadata.name,
      imageUrl: offChainMetadata.image,
      mintAddress: mint.toString(),
    }).catch(err => console.error("⚠️ postMint failed:", err));
  }, [mintsCreated]);

  // Refresh guards on window focus
  useEffect(() => {
    const onFocus = () => {
      if (walletPublicKey && !isMinting) {
        console.log("Window focus → refresh guard");
        setCheckEligibility(true);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [walletPublicKey, isMinting]);

  // Renders mint / claim buttons based on on-chain guard
  const PageContent = () => {
    // Find allow-list group label
    const allowListLabel = candyGuard
      ?.groups.find(g => g.guards.allowList.__option === 'Some')
      ?.label;
    const allowGuard = guards.find(g => g.label === allowListLabel);

    // Show states
    const showLogin = !connected;
    const showClaim = Boolean(
      walletPublicKey &&
      allowGuard?.allowed &&
      allowGuard.maxAmount > 0
    );
    const showMint = Boolean(
      walletPublicKey &&
      !showClaim &&
      guards.some((g) => g.allowed)
    );

    // Lists to hand off to <ButtonList>
    const claimGuardList = allowGuard ? [allowGuard] : [];
    const payGuardList = useMemo(() => {
      const arr = guards.filter((g) => g.allowed && g.label !== allowListLabel);
      return arr.length > 1
        ? arr.filter((g) => g.label !== "default")
        : arr;
    }, [guards, allowListLabel]);
    
    // Items available
    const availableCount = candyMachine
      ? Number(candyMachine.data.itemsAvailable) - Number(candyMachine.itemsRedeemed)
      : 0;

    return (
      <Flex
        direction={{ base: "column", md: "row" }}
        align="center"
        justify="center"
        flex="1"
        gap={6}
        px={2}
        mt="20"
      >
        {/* LEFT */}
        <VStack align="center" spacing={6} flex={1} h="100%" justify="center">
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
              <Text as="span" fontWeight="bold">Log in to join the flock.</Text><br/>
              Play to win or mint right away!
            </Text>
          )}
          {showClaim && (
            <Text textAlign="center" textStyle="copy" fontSize="1.3rem">
              <Text as="span" fontWeight="bold">You are a top 10 winner.</Text><br/>
              Claim your Flamingo FREE!
            </Text>
          )}
          {showMint && (
            <Text textAlign="center" textStyle="copy" fontSize="1.3rem">
              <Text as="span" fontWeight="bold">Support the project.</Text><br/>
              Mint your Flamingo<br/>and join the flock.
            </Text>
          )}

          {walletPublicKey ? (
            (!candyMachine || !candyGuard || loading) ? (
              <Center w="full"><Skeleton h="48px" w="200px" /></Center>
            ) : (
              <Center w="full">
                <ButtonList
                  guardList={ showClaim ? claimGuardList : payGuardList }
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
                    ? { buttonProps: { animation: `${pulse} 1.2s ease-in-out infinite`, colorScheme: "pink" } }
                    : {})}
                />
              </Center>
            )
          ) : (
            <Center w="full"><Button size="default" isDisabled>Mint</Button></Center>
          )}

          {/* ADMIN */}
          {umi.identity.publicKey === candyMachine?.authority && (
            <Button size="default" mt={6} onClick={onInitializerOpen}>ADMIN</Button>
          )}
        </VStack>

        {/* RIGHT */}
        <VStack align="center" spacing={2} flex={1}>
          {walletPublicKey ? (
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
                  LFGs remaining: {availableCount}
                </Text>
              </>
            )
          ) : (
            <Box w="100%" maxW={{ base: "100%", md: "800px" }}>
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

  // Main return
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
        minH="0"
        px={{ base: 4, md: 8 }}
      >
        <Box width="full" maxWidth={{ base: "100%", md: "1000px" }} px={{ base: 4, md: 8 }}>
          <PageContent />
        </Box>

        {/* Show minted NFT */}
        <Modal isOpen={isShowNftOpen} onClose={onNftModalClose}>
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
              <InitializeModal umi={umi} candyMachine={candyMachine!} candyGuard={candyGuard!}/>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Flex>
      <Footer/>
    </Flex>
  );
}
