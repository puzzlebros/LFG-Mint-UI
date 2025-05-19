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
  Tooltip
} from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';

import HorizontalScroller, { ScrollerItem } from '../components/HorizontalScroller';
import Leaderboard                              from '../components/Leaderboard';
import TraitDresser                             from '../components/TraitDresser';
import InteractiveHeading                       from '@/components/InteractiveHeading';
import Cloud from "../components/Cloud";
import { useWeeklyCycle } from '../utils/leaderboard/useWeeklyCycle';
import { Footer } from '../components/Footer'

// ParallaxImage runs only on the client
const ParallaxImage = dynamic(() => import('../components/ParallaxImage'), { ssr: false });

export default function HomePage() {
  const [isInTop10, setIsInTop10] = useState(false);
  const { publicKey } = useWallet();
  const myWallet      = publicKey?.toString();
  const router = useRouter();

  // freeze state + countdown
  const { isFrozen, next, countdown } = useWeeklyCycle();
    
  // ref to measure container size
  const welcomeRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

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
      text: 'RANKING',
      textStyle: "condensed",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.DarkPurple", fontSize: "3rem" } // plus any other TextProps
    },
    { //iconSrc: '/images/logo-nav.png',
      text: 'RANKING',
      textStyle: "normal",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.DarkPurple", fontSize: "3rem" } // plus any other TextProps
    },
    { //iconSrc: '/images/logo-nav.png', 
      text: 'RANKING',
      textStyle: "narrow",           // pulls your theme’s `textStyles.condensed`
      textProps: { color: "brand.DarkPurple", fontSize: "3rem" } // plus any other TextProps
    },
  ];

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
  ];

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
      h="100%"
      overflowY="auto"
      overflowX="hidden"
      scrollSnapType="y mandatory"
      scrollSnapStop="always"
      display="flex"
      flexDirection="column"
      sx={{ '&::-webkit-scrollbar': { display: 'none' }, touchAction: 'pan-y', }}
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
            color="#FFF"
            fontSize="48rem"
            fontWeight="normal"
            letterSpacing="0.01em"
            lineHeight="0.8"
            minWidth={25}
            maxWidth={115}
            minSlant={-30}
            maxSlant={20}
            previewWidth={0}
            previewSlant={0}
            transitionDuration={0.2}
          >
            LFG
          </InteractiveHeading>
        </Flex>

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
        as="section"
        flex="none"
        w="100%"
        h="100%"
        scrollSnapAlign="start"
        scrollSnapStop="always"
        position="relative"
        // bgImage="url('/images/game-bg.png')"
        bgSize="cover"
        bgPosition="center"
      >
        <Center h="100%">
          <Stack
          spacing={2}
          textAlign="center"
          align="center"
          w="full"           // let it grow to the viewport…
          maxW="420px"       // …but no wider than 600px
          mx="auto"          // center it horizontally
          >
            {isFrozen ? (
                    <>
                      <Heading
                        as="h1"
                        fontSize="7rem"
                        textStyle="condensed"
                        color="brand.DarkPurple"
                        lineHeight="6rem"
                      >
                        RANKING PAUSED
                      </Heading>
                      <Text
                        textStyle="copy"
                        fontSize="1.3rem"
                        whiteSpace="normal"
                        wordBreak="break-word"
                        mt="7"
                        mr="5"
                        ml="5"
                      >
                        The leaderboard is currently frozen until{" "}
                        <Text as="span" fontWeight="bold">
                          {next.toLocaleString()}
                        </Text>
                        . Come back then to see the latest standings!
                      </Text>
                    </>
                  ) : (
                    <>
                      <Heading
                        as="h1"
                        fontSize="7rem"
                        textStyle="condensed"
                        lineHeight="6rem"
                      >
                        LET&apos;S JUMP!
                      </Heading>
                      <Text
                        textStyle="copy"
                        fontSize="1.3rem"
                        whiteSpace="normal"
                        wordBreak="break-word"
                        mt="7"
                        mr="5"
                        ml="5"
                      >
                        <Text as="span" fontWeight="bold">
                          Jump into the action and climb your way up to the ranking.
                        </Text>
                        <br />
                        If you manage to get into the top 10, you will be able to claim
                        a FREE mint from the collection.
                      </Text>
                    </>
                  )}

            <Tooltip
            label={
              isFrozen
                ? `Leaderboard frozen until ${next.toLocaleString()}`
                : `Next freeze in ${countdown}`
            }
          >
            <Button
              mt="10"
              size="default"
              isDisabled={isFrozen}
              onClick={() => !isFrozen && window.location.assign("/game")}
            >
              PLAY
            </Button>
          </Tooltip>

          </Stack>
        </Center>

        {/* <Box position="absolute" top="50%" left="5%" transform="translateY(-50%)" zIndex={0}>
          <ParallaxImage
            src="/images/game-floating.png"
            alt="Game Floating"
            width="300px"
          />
        </Box> */}

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
        bg="brand.White"
      >
        <Center h="100%" mt="-3">
          <Stack spacing={2} textAlign="center" align="center" maxW="600px" w="100%">

            <Heading 
            size="xl"
            fontSize="7rem"
            textStyle="condensed"
            mt="2"
            >
              TOP 10</Heading>

            {/* <Text textStyle="copy" color="brand.DarkPurple">
              See where you stand in the community!
            </Text> */}

            <Center w="100%" mt="-4">
              <Leaderboard
                onTopStatus={setIsInTop10}
                withBorders
                columnWidths={{
                  position: "45px",
                  user:     "150px",
                  score:    "100px",
                  wallet:   "420px",
                }}
                height="auto"
              />
            </Center>

            {myWallet && isInTop10 && isFrozen && (
              <Button 
              size="default"
              onClick={() => (window.location.href = '/mint')}>
                CLAIM
              </Button>
            )}

          </Stack>
        </Center>

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

      {/** ——— Mint + Trait-Dresser Section ——— **/}
      <Box
        as="section"
        flex="none"
        w="100%"
        h="100vh"
        scrollSnapAlign="start"
        scrollSnapStop="always"
        position="relative"
        overflow="hidden"
        // bgImage="url('/images/mint-bg.png')"
        // bgSize="cover"
        // bgPosition="center"
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
            fontSize="22rem"
            fontWeight="normal"
            letterSpacing="0.01em"
            lineHeight="1"
            color="brand.Pink"
          >
            MINTMINT
          </InteractiveHeading>
        </Box>

        {/* Layer 2: centered TraitDresser */}
        <Box
          position="absolute"
          inset="0"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1}
        >
          <TraitDresser
            skinSrc="/images/skins/1.png"
            skinSize={480}
            traitPaths={{
              eyes:    ['/images/traits/eyes/1.png','/images/traits/eyes/2.png','/images/traits/eyes/3.png'],
              head:    ['/images/traits/head/1.png','/images/traits/head/2.png','/images/traits/head/3.png'],
              clothes: ['/images/traits/clothes/1.png','/images/traits/clothes/2.png','/images/traits/clothes/3.png'],
            }}
          />
        </Box>

        {/* Layer 3: Mint button */}
        <Box
          position="absolute"
          bottom="10%"
          left="50%"
          transform="translateX(-50%)"
          zIndex={2}
        >
          <Button
            size="default"
            onClick={() => (window.location.href = '/mint')}
          >
            MINT
          </Button>
        </Box>
            <Footer />
        
      </Box>
    </Box>
  );
}
