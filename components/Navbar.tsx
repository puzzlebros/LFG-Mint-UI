import React, { useEffect, useState, useRef } from "react";
import NextLink from "next/link";
import {
  Flex,
  Box,
  Spacer,
  Button,
  Tooltip,
  Image as ChakraImage,
  Slide,
  IconButton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
import { motion, AnimatePresence } from "framer-motion";
import LogoImage from "./LogoImage";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import { useWallet } from "@solana/wallet-adapter-react";
import { CustomWalletButton } from "./CustomWalletButton";

// Animated IconButton using framer-motion
const MotionIconButton = motion(IconButton);

export default function Navbar() {
  // Leaderboard freeze state and countdown
  const { isFrozen, next, countdown } = useWeeklyCycle();
  // Wallet connection status
  const { connected } = useWallet();

  // Controls slide-in navbar visibility (driven by Unity events)
  const [visible, setVisible] = useState(true);
  // Toggle for mobile menu overlay
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Mounted flag for breakpoint detection
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Ref for Unity iframe if present
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Setup Unity message and visibility handlers
  useEffect(() => {
    const checkIframe = () => {
      iframeRef.current = document.querySelector("iframe[src*='UnityBuild']");
    };
    const observeUnload = () => {
      if (!iframeRef.current) return;
      iframeRef.current.addEventListener("load", () => {
        iframeRef.current?.contentWindow?.addEventListener("unload", () => {
          setVisible(true);
        });
      });
    };
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "gameSession") {
        setVisible(e.data.action === "end");
      }
    };
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        !visible &&
        !document.querySelector("iframe[src*='UnityBuild']")
      ) {
        setVisible(true);
      }
    };

    checkIframe();
    observeUnload();
    window.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [visible]);

  // Determine if mobile layout is active
  const wantsMobile = useBreakpointValue({ base: true, md: false });
  const isMobile = isMounted && !!wantsMobile;

  // Toggle mobile menu
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  // Navigation handlers
  const handlePlay = () => {
    if (!isFrozen) {
      setIsMenuOpen(false);
      window.location.assign("/game");
    }
  };
  const handleMint = () => {
    setIsMenuOpen(false);
    window.location.assign("/mint");
  };

  return (
    <>
      {/* Animated hamburger stays fixed top-right */}
      {isMobile && (
        <MotionIconButton
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          icon={<HamburgerIcon />}
          variant="ghost"
          size="lg"
          w={10}
          h={7}
          onClick={toggleMenu}
          // Closed: vertical (90deg), Open: horizontal (0deg)
          animate={{ rotate: isMenuOpen ? 0 : 90 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          position="fixed"
          top={4}
          right={4}
          zIndex={40}
        />
      )}

      {/* Slide-in Navbar; unaffected by menu open state */}
      <Slide direction="top" in={visible} style={{ zIndex: 30 }}>
        <Box bg="brand.White" boxShadow="0 3px 3px rgba(0,0,0,0.1)">
          <Flex as="nav" align="center" justify="space-between" px={4} py={2}>
            {/* Logo section */}
            <Flex align="center" >
              <NextLink href="/" passHref>
                <Box cursor="pointer">
                  <LogoImage src="/images/LFG_Iso.png" alt="LFG Isotype" boxSize="50px" />
                </Box>
              </NextLink>
              <ChakraImage
                src="/images/LFG_Logo.png"
                alt="LFG Logotype"
                h="40px"
                userSelect="none"
                pointerEvents="none"
              />
            </Flex>

            <Spacer />

            {/* Desktop menu items */}
            {!isMobile && (
              <Flex align="center" gap={7}>
                <Tooltip
                  label={isFrozen ? `Locked until ${next.toLocaleString()}` : `Next freeze in ${countdown}`}
                >
                  <Button size="nav" isDisabled={isFrozen} onClick={handlePlay}>
                    PLAY
                  </Button>
                </Tooltip>
                <NextLink href="/mint" passHref>
                  <Button size="nav" variant="secondary" onClick={handleMint}>
                    MINT
                  </Button>
                </NextLink>
                <CustomWalletButton />
              </Flex>
            )}
          </Flex>

          {/* Frozen banner below nav */}
          {isFrozen && (
            <Box bg="brand.Pink" color="white" textAlign="center" py={2}>
              🎉 Leaderboard frozen until{' '}
              <b>{next.toLocaleDateString()} {next.toLocaleTimeString()}</b>
            </Box>
          )}
        </Box>
      </Slide>

      {/* Fullscreen mobile menu overlay beneath toggle, above content */}
      <AnimatePresence>
        {isMobile && isMenuOpen && (
          <motion.div
            key="menuOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 20 }}
          >
            <Flex direction="column" justify="center" align="center" h="100%" gap={10}>
              <Tooltip
                label={isFrozen ? `Locked until ${next.toLocaleString()}` : `Next freeze in ${countdown}`}
                shouldWrapChildren
              >
                <Button size="nav" variant="primary" isDisabled={isFrozen} onClick={handlePlay}>
                  PLAY
                </Button>
              </Tooltip>
              <Button size="nav" variant="secondary" onClick={handleMint}>
                MINT
              </Button>
              <Box
                onClick={() => {
                  if (!connected) setIsMenuOpen(false);
                }}
              >
                <CustomWalletButton style={{ justifyContent: "center", paddingLeft: 0, paddingRight: 0 }} />
              </Box>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
