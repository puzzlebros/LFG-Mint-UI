//components/Navbar.tsx
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
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  useBreakpointValue,
} from "@chakra-ui/react";
import LogoImage from "./LogoImage";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import { CustomWalletButton } from "./CustomWalletButton";

function Navbar() {
  const { isFrozen, next, countdown } = useWeeklyCycle();
  const [visible, setVisible] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const wantsMobile = useBreakpointValue({ base: true, md: false });
  const isMobile = mounted && wantsMobile;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "gameSession") {
        if (event.data.action === "start") {
          setVisible(false);
        }
        if (event.data.action === "end") {
          setVisible(true);
        }
      }
    };

    const checkIframeExistence = () => {
      const iframe = document.querySelector("iframe[src*='UnityBuild']");
      iframeRef.current = iframe as HTMLIFrameElement | null;
    };

    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        !visible &&
        !document.querySelector("iframe[src*='UnityBuild']")
      ) {
        console.warn("👁️ Unity iframe missing on tab focus — showing Navbar as fallback.");
        setVisible(true);
      }
    };

    // Also listen for iframe unload directly (e.g. if iframe crashes)
    const observeIframeUnload = () => {
      if (!iframeRef.current) return;
      iframeRef.current.addEventListener("load", () => {
        iframeRef.current?.contentWindow?.addEventListener("unload", () => {
          console.warn("🧩 Unity iframe unloaded — restoring Navbar.");
          setVisible(true);
        });
      });
    };

    checkIframeExistence();
    observeIframeUnload();

    window.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [visible]);

  return (
    <Slide direction="top" in={visible} style={{ zIndex: 10 }}>
      <Box bg="brand.White" boxShadow="0 3px 3px rgba(0,0,0,0.1)">
        <Flex as="nav" align="center" justify="space-between" px={4} py={2}>

          {/* — Logo on the left — */}
          <Flex align="center" gap={2}>
            <NextLink href="/" passHref>
              <Box cursor="pointer">
                <LogoImage
                  src="/images/LFG_Iso.png"
                  alt="LFG Isotype"
                  boxSize="40px"
                />
              </Box>
            </NextLink>
            <ChakraImage
              src="/images/LFG_Logo.png"
              alt="LFG Logotype"
              h="40px"
              objectFit="contain"
              userSelect="none"
              pointerEvents="none"
            />
          </Flex>

          <Spacer />

          {isMobile ? (
            // ─── Mobile ───
            <Box display="flex" alignItems="center">
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="Open menu"
                  variant="ghost"
                  width="40px"
                  icon={
                    <ChakraImage
                      src="/images/LFG_Iso.png"
                      alt="Menu"
                      boxSize="24px"
                    />
                  }
                />
                <MenuList>
                  {/* PLAY */}
                  <MenuItem as="div" p={0}>
                    <Tooltip
                      label={
                        isFrozen
                          ? `Game locked until ${next.toLocaleString()}`
                          : `Next freeze in ${countdown}`
                      }
                    >
                      <Button
                        size="nav"
                        isDisabled={isFrozen}
                        w="full"
                        onClick={() => !isFrozen && window.location.assign("/game")}
                      >
                        PLAY
                      </Button>
                    </Tooltip>
                  </MenuItem>

                  {/* MINT */}
                  <NextLink href="/mint" passHref>
                    <MenuItem as="div" p={0}>
                      <Button
                        size="nav"
                        w="full"
                        onClick={() => window.location.assign("/mint")}
                      >
                        MINT
                      </Button>
                    </MenuItem>
                  </NextLink>

                  {/* LOG IN / Wallet */}
                  <MenuItem as="div" p={0}> <CustomWalletButton/> </MenuItem>

                </MenuList>
              </Menu>
            </Box>
          ) : (
            // — desktop: all three buttons inline —
            <Box display="flex" alignItems="center" gap="7">
              <Tooltip
                label={
                  isFrozen
                    ? `Game locked until ${next.toLocaleString()}`
                    : `Next freeze in ${countdown}`
                }
              >
                <Button
                  size="nav"
                  isDisabled={isFrozen}
                  onClick={() => !isFrozen && window.location.assign("/game")}
                >
                  PLAY
                </Button>
              </Tooltip>

              <NextLink href="/mint" passHref>
                <Button size="nav" variant="secondary">MINT</Button>
              </NextLink>
              
              <CustomWalletButton/>
              
            </Box>
          )}
        </Flex>
        
        {/* — frozen banner — */}
        {isFrozen && (
            <Box
              bg="brand.Pink"
              color="white"
              textAlign="center"
              py={2}
            >
              🎉 Leaderboard is frozen for winners to claim! It unlocks on{' '}
              <b>{next.toLocaleDateString()} at {next.toLocaleTimeString()}</b>.
            </Box>
          )}
      </Box>
    </Slide>
  );
}

export default Navbar;
