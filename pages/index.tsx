// pages/index.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Flex,
  Center,
  Stack,
  Heading,
  Text,
  Button,
  Tooltip,
  Image as ChakraImage,
  useBreakpointValue,
  useDisclosure
} from '@chakra-ui/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletContextGuard } from "../utils/useWalletContextGuard";
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import ThemedModal from '../components/modals/ThemedModal';
import { keyframes } from '@emotion/react'
import HorizontalScroller, { ScrollerItem } from '../components/fx/HorizontalScroller';
import Leaderboard                              from '../components/Leaderboard';
import TraitDresser                             from '../components/fx/TraitDresser';
import InteractiveHeading                       from '@/components/fx/InteractiveHeading';
import Cloud from "../components/fx/Cloud";
import Balloon from '../components/fx/Balloon'
import { useWeeklyCycle } from '../utils/leaderboard/useWeeklyCycle';
import { Footer } from '../components/Footer'
import { ChevronDownIcon } from '@chakra-ui/icons'
import { formatRemaining } from '../utils/leaderboard/formatRemaining';
import CongratsPopup from '../components/modals/CongratsPopup';
import Confetti from 'react-confetti';
import { useWindowSize } from "../utils/useWindowSize";

// define a simple float animation
const floatKeyframes = `
@keyframes float {
  0%,100%   { transform: translateY(0px); }
  50%       { transform: translateY(-20px); }
}
`

export default function HomePage() {
  useWalletContextGuard({ enabled: true });
  const { publicKey, connected } = useWallet();
  const myWallet = publicKey?.toString();
  const hasWallet = !!myWallet && connected;
  const { setVisible } = useWalletModal();
  const router = useRouter();

  const [isInTop10, setIsInTop10] = useState(false);
  const { isFrozen, next, countdown } = useWeeklyCycle();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hasShown, setHasShown] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mintHeadingRandomKey, setMintHeadingRandomKey] = useState(0);

  const bumpMintHeadingRandom = () =>
  setMintHeadingRandomKey((k) => k + 1);

  const {
    isOpen: isEntryOpen,
    onOpen: onEntryOpen,
    onClose: onEntryClose,
  } = useDisclosure();

  const handleWelcomeCtaClick = () => {
    if (!publicKey) {
      // no wallet connected → show entry modal
      onEntryOpen();
    } else {
      // wallet already connected → go straight to the game
      window.location.assign('/game');
    }
  };

  const windowSize = useWindowSize();

  useEffect(() => {
    if (isFrozen && isInTop10 && !hasShown) {
      onOpen();
      setHasShown(true);
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [isFrozen, isInTop10, hasShown, onOpen]);

  function handleClose() {
    onClose();
    setShowConfetti(false);
  }
    
  // ref to measure container size
  const welcomeRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const gameRef = useRef<HTMLDivElement>(null)
  const [gameDims, setGameDims] = useState({ w: 0, h: 0 })
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const now    = new Date()
  const diffMs = next.getTime() - now.getTime()
  const timeLeft = formatRemaining(diffMs);

  useEffect(() => {
  function updateGame() {
    if (gameRef.current) {
      const { width, height } = gameRef.current.getBoundingClientRect()
      setGameDims({ w: width, h: height })
    }
  }
  updateGame()
  window.addEventListener('resize', updateGame)
  return () => window.removeEventListener('resize', updateGame)
}, [])

  const welcomeScroller: ScrollerItem[] = [
    { text: 'PLAY',
      textStyle: "normal",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.Pink", fontSize: "2rem" } // plus any other TextProps
    },
    { text: 'RANK',
      textStyle: "condensed",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.Pink", fontSize: "2rem" } // plus any other TextProps
    },
    { textStyle: "narrow",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.Pink", fontSize: "2rem" }, // plus any other TextProps
      text: 'MINT'
    },
    { //iconSrc: '/images/logo-nav.png', 
      textStyle: "extraCondensedOblique",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.Pink", fontSize: "2rem" }, // plus any other TextProps
      text: 'COLLECT',
    },
  ];

  const rankingScroller: ScrollerItem[] = [
    { //iconSrc: '/images/logo-nav.png',
      text: 'WINNERS',
      textStyle: "condensed",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.DarkPurple", fontSize: "3rem" } // plus any other TextProps
    },
    { //iconSrc: '/images/logo-nav.png',
      text: 'RANKING',
      textStyle: "normal",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.DarkPurple", fontSize: "3rem" } // plus any other TextProps
    },
    { //iconSrc: '/images/logo-nav.png', 
      text: 'TOP 10',
      textStyle: "narrow",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.DarkPurple", fontSize: "3rem" } // plus any other TextProps
    },
  ];

  const traitSize = useBreakpointValue({ base: 330, md: 480 });

  const mintHeroSize = useBreakpointValue({
    base: "30rem",
    md:   "48rem",
  });

  const mintBgText = useBreakpointValue({
    base: `MI\nNT`,
    md:   "MINTMINT",
  });

  const welcomeTitleSize = useBreakpointValue({ base: "6rem", md: "7.5rem" });
  const welcomeCopySize = useBreakpointValue({ base: "1rem", md: "1.2rem" });
  const welcomeCopyAltSize = useBreakpointValue({ base: "1rem", md: "1.1rem" });
  const welcomeCopyLineHeight = useBreakpointValue({ base: "1rem", md: "1.5rem" });
  const mintBgSize = useBreakpointValue({ base: "24rem", md: "22rem" });
  const rankingHeadingSize = useBreakpointValue({ base: "2.7rem", md: "3.5rem"});
  const rankingCopySize = useBreakpointValue({ base: "1rem", md: "1.15rem" });
  const rankingHeadingMargin = useBreakpointValue({ base: "35px", md: "15px"});
  const mintButtonMargin = useBreakpointValue({ base: "7%", md: "7%"});
  const colScore  = useBreakpointValue({ base: "100px", md: "130px" });
  const colWallet = useBreakpointValue({ base: "130px", md: "190px" });

  // when mount or resize, capture dimensions
  useEffect(() => {
    function update() {
      if (welcomeRef.current) {
        const { width, height } = welcomeRef.current.getBoundingClientRect();
        setDims({ w: width, h: height });
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cloudUrls = [
    "/images/clouds/Cloud_1.png",
    "/images/clouds/Cloud_2.png",
    "/images/clouds/Cloud_3.png",
    "/images/clouds/Cloud_4.png",
    "/images/clouds/Cloud_5.png",
    "/images/clouds/Cloud_6.png",
    "/images/clouds/Cloud_7.png",
    "/images/clouds/Cloud_8.png",
  ];

  const balloonUrls = [
  '/images/balloons/Balloon_1.png',
  '/images/balloons/Balloon_2.png',
  '/images/balloons/Balloon_3.png',
  ];

  // define desktop positions
  const islandsDesktop = [
    { src: "/images/islands/Island_1.png", top: "25%", left: "12%", size: "100px", delay: "0s" },
    { src: "/images/islands/Island_2.png", top: "32%", left: "75%", size: "160px", delay: "0.7s" },
    { src: "/images/islands/Island_3.png", top: "57%", left: "20%", size: "220px", delay: "1.3s" },
    { src: "/images/islands/Island_4.png", top: "75%", left: "65%", size: "80px",  delay: "2s" },
  ];

  const FloatingIslands = useBreakpointValue({
    base: [],              // no islands on mobile
    md:   islandsDesktop,  // only desktop islands
  })!;

  const floatAnim = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-20px); }
`

const pulseClaim = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(108, 0, 255, 0.7);   /* brand.Purple-ish */
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

  // listen to game ranking button
  useEffect(() => {
    if (router.asPath.includes('#ranking')) {
      const el = document.getElementById('ranking');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [router.asPath]);

  return (
    <Box
      w="100%"
      h="100svh"
      overflowY="auto"
      overflowX="hidden"
      scrollSnapType="y mandatory"
      scrollSnapStop="always"
      overscrollBehaviorY="contain"
      display="flex"
      flexDirection="column"
      sx={{ WebkitOverscrollBehavior: 'contain', '&::-webkit-scrollbar': { display: 'none' }, touchAction: 'pan-y', }}
      minH="0"
    >
      {/** ——— Welcome Section ——— **/}
      <Box
        ref={welcomeRef}
        as="section"
        flex="none"
        w="100%"
        h="100%"
        scrollSnapAlign="start"
        scrollSnapStop="always"
        position="relative"
        bgGradient="linear(
        to-b,
        #93D2FF 0%,
        #BDACFF 29%,
        #FFBCD5 100%
        )"
        pt={4}      // space below navbar
        pb="100px"   // reserve space for the fixed scroller
        overflow="hidden"
      >
        {/* — Clouds behind everything — */}
        {dims.h > 0 && cloudUrls.map((src, i) => (
          <Cloud
            key={i}
            src={src}
            containerWidth={dims.w}
            containerHeight={dims.h}
          />
        ))}
        
        <Flex
          position="relative"
          direction="column"
          align="center"
          justify="center"
          h="100%"
          zIndex={1}
        >
          <InteractiveHeading
            enableMobileAutoAnimate={false}
            color="#FFF"
            fontSize={mintHeroSize}
            fontWeight="normal"
            letterSpacing="0.001em"
            lineHeight="0.8"
            /* desktop tilt range */
            minWidth={25}
            maxWidth={115}
            minSlant={-30}
            maxSlant={20}
            /* mobile-specific tilt range */
            minWidthMobile={15}
            maxWidthMobile={50}
            minSlantMobile={-30}
            maxSlantMobile={20}
            previewWidth={0}
            previewSlant={0}
            transitionDuration={0.2}
          >
            LFG
          </InteractiveHeading>

          </Flex>
          <Box
            as="style"
            dangerouslySetInnerHTML={{ __html: floatKeyframes }}
          />
          <Center position="absolute" bottom="50px" w="100%" zIndex={3}>
            <ChevronDownIcon
              boxSize="45px"
              animation="float 2s ease-in-out infinite"
              color="brand.Lavender"
              cursor="pointer"
              onClick={() => {
                document.getElementById('game')?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
          </Center>
          {/* fixed scroller at bottom */}
          <HorizontalScroller
            items={welcomeScroller}
            speed={5}
            height="50px"
            bgColor="brand.DarkPurple"
            zIndex={2}
            align="bottom"
          />
        </Box>

      {/** ——— Game Section ——— **/}
      <Box
          ref={gameRef}
          id="game"
          as="section"
          flex="none"
          w="100%"
          h="100%"
          scrollSnapAlign="start"
          scrollSnapStop="always"
          position="relative"
          bgSize="cover"
          bgPosition="center"
          overflow="visible"
        >
        {/* inject both keyframes */}
        <Box as="style" dangerouslySetInnerHTML={{
          __html: `
            @keyframes float {
              0%,100% { transform: translateY(0); }
              50%     { transform: translateY(-20px); }
            }
            @keyframes vibrate {
              0%   { transform: translate(0); }
              25%  { transform: translate(-1px,1px); }
              50%  { transform: translate(1px,-1px); }
              75%  { transform: translate(-1px,-1px); }
              100% { transform: translate(1px,1px); }
            }
          `
        }} />

        {/* side-floating islands */}
        {gameDims.h > 0 &&
          FloatingIslands.map(({ src, top, left, size, delay }, idx) => (
            <Box
            key={idx}
            position="absolute"
            top={top}
            left={left}
            pointerEvents="none"
            zIndex={0}
            animation={`${floatAnim} 4s ease-in-out ${delay} infinite`}
            >
              <ChakraImage
                src={src}
                boxSize={size}
                objectFit="contain"
                alt={`island-${idx}`}
              />
            </Box>
          ))
        }

        {/* rising balloons */}
        {gameDims.h > 0 &&
          balloonUrls.map((src, i) => (
            <Balloon
              key={i}
              src={src}
              minScale={0.7}
              maxScale={3.5}
              // here we say: anything scaled above 1.3 floats on top:
              highScaleThreshold={2.7}
              // and big balloons get zIndex: 5
              highScaleZIndex={5}
            />
          ))
        }

        <Center h="100%">
          <Stack spacing={2} textAlign="center" align="center" w="full" maxW="550px" mx="auto" mt={5}>
              <>
                <Heading
                  as="h1"
                  fontSize={welcomeTitleSize}
                  textStyle="condensed"
                  lineHeight="6rem"
                >
                  GM, DEGEN
                </Heading>
                <Text
                  textStyle="copy"
                  fontSize="1.2rem"
                  lineHeight="1.5rem"
                  whiteSpace="normal"
                  wordBreak="break-word"
                  mt={{ base: "1", md: "5" }}
                  mr="5"
                  ml="5"
                >
                  <Text as="span" fontWeight="bold" fontSize="1.5rem" lineHeight="2.3rem">
                    Fly to the moon. Free mint each Saturday.
                  </Text>
                  <br/><br/>
                  <Text as="span" fontWeight="regular" fontSize={welcomeCopySize} lineHeight={welcomeCopyLineHeight}>
                    Connect your Solana wallet and play the game.<br/>
                    The ranking freezes every Saturday.<br/>
                    Winners can free mint flamingos during that day.<br/>
                    16 grails are hidden inside the collection. Good luck!<br/>
                    <br/>
                    <b>Play. Rank. Mint. Repeat.</b>
                    <br/>
                  </Text>

                </Text>
              </>
              {isFrozen ? (
  <Tooltip
    label="The game is locked during Saturday"
    hasArrow
    placement="top"
  >
    <Box>
      <Button
        mt={{ base: "3", md: "8" }}
        size="default"
        isDisabled
        pointerEvents="none"
      >
        LET'S GO!
      </Button>
    </Box>
  </Tooltip>
) : (
  <Button
        mt={{ base: "3", md: "8" }}
    size="default"
    onClick={handleWelcomeCtaClick}   // 👈 now goes through our modal logic
  >
    LET'S GO
  </Button>
)}
          </Stack>
        </Center>
        </Box>

      {/** ——— Ranking Section ——— **/}
      <Box
        id="ranking"
        as="section"
        flex="none"
        w="100%"
        h="100%"
        scrollSnapAlign="start"
        scrollSnapStop="always"
        position="relative"
  bg={isFrozen ? undefined : 'brand.White'}
  bgGradient={
    isFrozen
      ? 'linear(to-b, var(--chakra-colors-brand-gradientStart) 0%, var(--chakra-colors-brand-gradientMid) 29.5%, var(--chakra-colors-brand-gradientEnd) 100%)'
      : undefined
  }
        >
        <Center h="100%" >
          <Stack 
          spacing={2} 
          textAlign="center" 
          align="center" 
          maxW="850px" 
          w="90%">
            <Heading
              size="xl"
              fontSize={rankingHeadingSize}
              textStyle="narrow"
              lineHeight="4rem"
              mt={rankingHeadingMargin}
            >
              {isFrozen
                ? 'MINT DAY'
                : (
                  'WANNA GET WL?'
                )
              }
            </Heading>

            {/* ── Copy variations ── */}
      <Text
  textStyle="copy"
  fontSize={rankingCopySize}
  textAlign="center"
  mb={{ base: "2", md: "4" }}

>
  {isFrozen ? (
    hasWallet && isInTop10 ? (
      <>
        Congrats! You’ve got {' '}
        <Text as="span" color="brand.Purple" fontWeight="bold">
          {timeLeft}
        </Text>{' '}
        to mint your flamingo before the next round begins!
      </>
    ) : (
      <>
        Not this time, but don’t give up! You can try again in {' '}
        <Text as="span" color="brand.Purple" fontWeight="bold">
          {timeLeft}
        </Text>
        .
      </>
    )
  ) : (
    <>
      Play, rank and{' '}
      <Text as="span" color="brand.Purple" fontWeight="bold">
        FREE MINT
      </Text>{' '}
      from the collection{' '}
      <Text as="span" display={{ base: 'block', md: 'inline' }}>
        in the next{' '}
        <Text as="span" color="brand.Purple" fontWeight="bold">
          {timeLeft}
        </Text>
      </Text>
    </>
  )}
</Text>

            <Center w="100%" mt="-4">
              <Leaderboard
                onTopStatus={setIsInTop10}
                withBorders
                bgColor="transparent"
                columnWidths={{
                  position: "45px",
                  user:     "150px",
                  score:    colScore,
                  wallet:   colWallet,
                }}
                height="auto"
              />
            </Center>

{isFrozen && hasWallet && isInTop10 ? (
  // Frozen window + winner → CLAIM
  <Button
    mt={{ base: "0", md: "2" }}
    size="default"
    animation={`${pulseClaim} 1.6s ease-in-out infinite`}
    onClick={() => (window.location.href = '/mint')}
  >
    CLAIM
  </Button>
) : hasWallet ? (
  // Wallet connected (any other case) → PLAY
  <Button
    mt={{ base: "0", md: "2" }}
    size="default"
    onClick={() => window.location.assign('/game')}
  >
    PLAY
  </Button>
) : (
  // No wallet → CONNECT (opens wallet adapter modal)
  <Button
    mt={{ base: "0", md: "2" }}
    size="default"
    onClick={() => setVisible(true)}
  >
    CONNECT
  </Button>
)}

          </Stack>
        </Center>

<Box display={{ base: "none", md: "block" }}>
  <HorizontalScroller
    items={rankingScroller}
    speed={20}
    height="50px"
    bgColor="brand.Purple"
    zIndex={2}
    fixed={false}
    align="bottom"
  />
</Box>
        </Box>

{/** ——— Mint Section ——— **/}
<Box
  as="section"
  flex="none"
  w="100%"
  h="100vh"
  scrollSnapAlign="start"
  scrollSnapStop="always"
  position="relative"
  overflow="hidden"
>
  {/* Layer 1: background heading */}
  <Box
    position="absolute"
    inset="0"
    display="flex"
    alignItems="center"
    justifyContent="center"
    zIndex={0}
    pointerEvents="none"
    mt="-30"
  >
    <InteractiveHeading
      minWidth={45}
      maxWidth={85}
      minSlant={-10}
      maxSlant={30}
      previewWidth={80}
      previewSlant={0}
      transitionDuration={0.2}
      fontSize={mintBgSize}
      fontWeight="normal"
      letterSpacing="0.01em"
      lineHeight=".75"
      color="brand.Pink"
      whiteSpace="pre"
      // 👇 NEW: whenever this changes (on mobile) we randomize once
      randomizeOnMobileKey={mintHeadingRandomKey}
    >
      {mintBgText}
    </InteractiveHeading>
  </Box>

  {/* Layer 2: centered TraitDresser with button positioned relative */}
  <Box
    position="absolute"
    inset="0"
    display="flex"
    alignItems="center"
    justifyContent="center"
    zIndex={1}
  >
    <Box display="flex" flexDirection="column" alignItems="center" mt="10vh">
      <TraitDresser
        skinSrc="/images/skins/1.png"
        skinSize={traitSize}
        traitPaths={{
          clothes: [
            '/images/traits/clothes/1.png',
            '/images/traits/clothes/2.png',
            '/images/traits/clothes/3.png',
          ],
          beak: ['/images/traits/beak/1.png'],
          eyes: [
            '/images/traits/eyes/1.png',
            '/images/traits/eyes/2.png',
            '/images/traits/eyes/3.png',
          ],
          head: [
            '/images/traits/head/1.png',
            '/images/traits/head/2.png',
            '/images/traits/head/3.png',
          ],
        }}
        // 👇 NEW: every cycle (tap on mobile) bumps the heading random key
        onCycle={bumpMintHeadingRandom}
      />
      <Button
        mt={mintButtonMargin}
        size="default"
        onClick={() => (window.location.href = '/mint')}
      >
        MINT
      </Button>
    </Box>
  </Box>

  {/* Layer 3: footer */}
  <Box position="absolute" bottom="0" left="0" w="100%" zIndex="3">
    <Footer />
  </Box>
</Box>


      {/* Confetti overlay */}
      {isClient && showConfetti && (
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
      <CongratsPopup isOpen={isOpen} onClose={handleClose} />
      {/* Entry modal for “LET'S GO” when no wallet is connected */}
      <ThemedModal
  isOpen={isEntryOpen}
  onClose={onEntryClose}
  title="LET'S FUCKING GO"
    headerProps={{
    fontSize: { base: "3rem", md: "3.5rem" },
    lineHeight: { base: "2.4rem", md: "3rem" },
  }}
  bodyProps={{
    fontSize: { base: "1rem", md: "1.2rem" },
  }}
  footer={
    
  <Stack
    direction={{ base: 'column', md: 'row' }}
    spacing={3}
    w="100%"
    justify="center"
    align="center"
  >
    <Button
      variant="primary"
      size="popup"
      onClick={() => {
        onEntryClose();
        window.location.assign('/game'); // PLAY AS GUEST
      }}
    >
      PLAY AS GUEST
    </Button>

    <Button
      variant="secondary"
      size="popup"
      onClick={() => {
        if (!publicKey) {
          setVisible(true); // open wallet adapter modal
        }
        onEntryClose();
      }}
    >
      CONNECT WALLET
    </Button>
  </Stack>
  }
>
  Try for fun as a guest, or connect your wallet to record your score and claim your spot.
</ThemedModal>

    </Box>
  );
}