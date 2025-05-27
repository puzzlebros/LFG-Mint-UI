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
import { HamburgerIcon, CloseIcon } from "@chakra-ui/icons";
import { motion, AnimatePresence } from "framer-motion";
import LogoImage from "./LogoImage";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import { useWallet } from "@solana/wallet-adapter-react";
import { CustomWalletButton } from "./CustomWalletButton";

// Variants for fade in/out
const iconVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export default function Navbar() {
  const { isFrozen, next, countdown } = useWeeklyCycle();
  const { connected } = useWallet();

  const [visible, setVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Mount + Unity iframe visibility logic
  useEffect(() => {
    setIsMounted(true);
    const checkIframe = () => { iframeRef.current = document.querySelector("iframe[src*='UnityBuild']"); };
    const observeUnload = () => {
      if (!iframeRef.current) return;
      iframeRef.current.addEventListener("load", () => {
        iframeRef.current?.contentWindow?.addEventListener("unload", () => setVisible(true));
      });
    };
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "gameSession") setVisible(e.data.action === "end");
    };
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        !visible &&
        !document.querySelector("iframe[src*='UnityBuild']")
      ) setVisible(true);
    };
    checkIframe(); observeUnload();
    window.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [visible]);

  // Breakpoint detection
  const wantsMobile = useBreakpointValue({ base: true, md: false });
  const isMobile = isMounted && !!wantsMobile;

  // Menu toggle
  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const handlePlay = () => { if (!isFrozen) { setIsMenuOpen(false); window.location.assign("/game"); } };
  const handleMint = () => { setIsMenuOpen(false); window.location.assign("/mint"); };

  return (
    <>
      {/* Icon toggle - fade between hamburger and cross */}
      {isMobile && (
        <Box position="fixed" top={4} right={4} zIndex={40}>
          <AnimatePresence mode="wait">
            {isMenuOpen ? (
              <motion.div
                key="close"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={iconVariants}
                transition={{ duration: 0.3 }}
              >
                <IconButton
                  aria-label="Close menu"
                  icon={<CloseIcon />}
                  variant="ghost"
                  size="lg"
                  w={10}
                  h={9}
                  color="brand.Purple"
                  fontSize="17px"
                  onClick={toggleMenu}
                />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={iconVariants}
                transition={{ duration: 0.2 }}
              >
                <IconButton
                  aria-label="Open menu"
                  icon={<HamburgerIcon />}
                  variant="ghost"
                  size="lg"
                  w={10}
                  h={9}
                  fontSize="22px"
                  color="brand.Purple"
                  onClick={toggleMenu}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      )}

      {/* Slide-in Navbar */}
      <Slide direction="top" in={visible} style={{ zIndex: 30 }}>
        <Box bg="brand.White" boxShadow="0 3px 3px rgba(0,0,0,0.1)">
          <Flex as="nav" align="center" justify="space-between" px={4} py={2}>
            <Flex align="center">
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
            {!isMobile && (
              <Flex align="center" gap={7}>
                <Tooltip
                  label={isFrozen ? `Locked until ${next.toLocaleString()}` : `Next freeze in ${countdown}`}
                >
                  <Button size="nav" isDisabled={isFrozen} onClick={handlePlay}>PLAY</Button>
                </Tooltip>
                <NextLink href="/mint" passHref>
                  <Button size="nav" variant="secondary" onClick={handleMint}>MINT</Button>
                </NextLink>
                <CustomWalletButton />
              </Flex>
            )}
          </Flex>
          {isFrozen && (
            <Box bg="brand.Pink" color="white" textAlign="center" py={2}>
              🎉 Leaderboard frozen until{' '}<b>{next.toLocaleDateString()} {next.toLocaleTimeString()}</b>
            </Box>
          )}
        </Box>
      </Slide>

      {/* Mobile full-screen menu overlay */}
      <AnimatePresence mode="wait">
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
                <Button size="nav" variant="primary" isDisabled={isFrozen} onClick={handlePlay}>PLAY</Button>
              </Tooltip>
              <Button size="nav" variant="secondary" onClick={handleMint}>MINT</Button>
              <Box
                onClick={() => { if (!connected) setIsMenuOpen(false); }}
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