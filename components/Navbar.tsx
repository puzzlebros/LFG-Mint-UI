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
  Text,
} from "@chakra-ui/react";
import { HamburgerIcon, CloseIcon } from "@chakra-ui/icons";
import { motion, AnimatePresence } from "framer-motion";
import LogoImage from "./fx/LogoImage";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import { CustomWalletButton } from "./buttons/CustomWalletButton";
import { formatRemaining } from '../utils/leaderboard/formatRemaining';

// Variants for fade in/out
const iconVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export default function Navbar() {
  const { isFrozen, next } = useWeeklyCycle();
  const [showFreezeBanner, setShowFreezeBanner] = useState(true)

  const [visible, setVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Mount + Unity iframe visibility logic
  useEffect(() => {
    setIsMounted(true);
    const checkIframe = () => {
      iframeRef.current = document.querySelector("iframe[src*='UnityBuild']");
    };
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
      )
        setVisible(true);
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

  // Breakpoint detection
  const wantsMobile = useBreakpointValue({ base: true, md: false });
  const isMobile = isMounted && !!wantsMobile;

  // Menu toggle
  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
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
  const handleFaq = () => {
  setIsMenuOpen(false);
  window.location.assign("/faq");
  };

  const now = new Date();
  const diffMs = next.getTime() - now.getTime();
  const timeLeft = formatRemaining(diffMs);

  return (
    <>
      <Slide direction="top" in={visible} style={{ zIndex: 30 }}>
        <Box bg="brand.White" boxShadow="0 3px 3px rgba(0,0,0,0.1)">
          <Flex as="nav" align="center" justify="space-between" px={4} py={2} position="relative">
            <Flex align="center">
              <NextLink href="/" passHref>
                <Box
                cursor="pointer"
                onClick={() => setIsMenuOpen(false)}
                >
                  <LogoImage src="/images/LFG_Iso.png" alt="LFG Isotype" boxSize="45px" />
                </Box>
              </NextLink>
              <ChakraImage
                src="/images/LFG_Logo.png"
                alt="LFG Logotype"
                h="35px"
                userSelect="none"
                pointerEvents="none"
              />
            </Flex>
            <Spacer />
            {/* Desktop: show LOG IN then burger */}
            {!isMobile && (
              <Flex align="center" gap={4}>
                <CustomWalletButton />
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
                        color="brand.DarkPurple"
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
                        fontSize="28px"
                        color="brand.DarkPurple"
                        onClick={toggleMenu}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Flex>
            )}
            {/* Mobile: show burger fixed */}
            {isMobile && (
              <Box position="absolute" right={4}>
                <AnimatePresence mode="wait">
                  {isMenuOpen ? (
                    <motion.div
                      key="close_m"
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
                        color="brand.DarkPurple"
                        fontSize="17px"
                        onClick={toggleMenu}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="open_m"
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
                        fontSize="30px"
                        color="brand.DarkPurple"
                        onClick={toggleMenu}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            )}
          </Flex>
          {isFrozen && showFreezeBanner && (
  <Box bg="brand.Pink" color="white" position="relative">
    <Flex
      align="center"
      justify={{ base: "flex-start", md: "center" }} // 👈 left on mobile, centered on desktop
      px={4}
      py={2}
      position="relative"
    >
      {/* Text takes full row width so it can sit flush left on mobile */}
      <Box flex="1">
        <Text
          textAlign={{ base: "left", md: "center" }}
          ml={{ base: 2, md: 0 }}
          pr={{ base: 8, md: 0 }} // space for the close button on mobile
          fontSize={{ base: "0.85rem", md: "0.95rem" }}
          lineHeight={{ base: "1.1rem", md: "1.3rem" }}
        >
          Congratulations to the winners!
          <Box as="span" display={{ base: "block", md: "inline" }}>
            {" "}
            The game will unlock in{" "}
            <Text as="span" fontWeight="bold">
              {timeLeft}
            </Text>
            .
          </Box>
        </Text>
      </Box>

      <IconButton
        aria-label="Dismiss"
        icon={<CloseIcon />}
        variant="ghost"
        size="xs"
        color="white"
        fontSize="10px"
        position="absolute"
        top="50%"
        right={2}
        transform="translateY(-50%)"
        _hover={{ bg: "rgba(255, 255, 255, 0)" }}
        onClick={() => setShowFreezeBanner(false)}
      />
    </Flex>
  </Box>
)}


        </Box>
      </Slide>

      {/* Full-screen menu overlay */}
      <AnimatePresence mode="wait">
        {isMenuOpen && (
          <motion.div
            key="menuOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 20 }}
          >
            <Flex direction="column" justify="center" align="center" h="100%" gap={10}>
              <Tooltip
                label={
                  isFrozen
                    ? `The game is locked on Saturday`
                    : "Start playing now!"
                }
                placement="top"
                hasArrow
              >
                <Button size="default" variant="primary" isDisabled={isFrozen} onClick={handlePlay}>
                  PLAY
                </Button>
              </Tooltip>
              <Button size="default" variant="primary" onClick={handleMint}>
                MINT
              </Button>
                <Button size="default" variant="secondary" onClick={handleFaq}>
                  ABOUT
                </Button>
              {isMobile && (
              <CustomWalletButton
                style={{
                  width: "100%",
                  justifyContent: "center",
                  paddingLeft: 0,
                  paddingRight: 0,
                }}
              />
              )}
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
