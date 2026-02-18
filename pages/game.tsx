// pages/game.tsx
import { useEffect, useMemo, useRef } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import TutorialPopup from "../components/modals/TutorialPopup";

export default function GamePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

  const unityBuildId = process.env.NEXT_PUBLIC_UNITY_BUILD_ID;

  const iframeSrc = useMemo(() => {
    if (!unityBuildId) return null;
    // bust UnityCache keys + ensure versioned path
    return `/UnityBuild/${unityBuildId}/index.html?v=${encodeURIComponent(unityBuildId)}`;
  }, [unityBuildId]);

  // Keep window.currentWalletData consistent with your global.d.ts: object | null
  useEffect(() => {
    if (publicKey) {
      window.currentWalletData = {
        walletAddress: publicKey.toBase58(),
        userName: "",
      };
    } else {
      window.currentWalletData = null;
    }

    if (
      connected &&
      iframeRef.current?.contentWindow &&
      window.currentWalletData !== null
    ) {
      iframeRef.current.contentWindow.postMessage(
        { type: "walletData", payload: window.currentWalletData },
        window.location.origin
      );
    }
  }, [connected, publicKey]);

  const sendWalletData = () => {
    if (!iframeRef.current?.contentWindow) return;
    if (window.currentWalletData === null) return;

    iframeRef.current.contentWindow.postMessage(
      { type: "walletData", payload: window.currentWalletData },
      window.location.origin
    );
  };

  const focusUnity = () => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: "focus" }, window.location.origin);
  };

  const handleIframeLoad = () => {
    console.log("Iframe loaded.");
    focusUnity();
    if (connected && publicKey) sendWalletData();
  };

  if (isFrozen) {
    return (
      <Center h="100vh" p={4}>
        <Text textStyle="copy" color="brand.DarkPurple">
          The game is currently locked while the leaderboard freezes.
          <br />
          It reopens at <b>{next.toLocaleString()}</b>.
        </Text>
      </Center>
    );
  }

  if (!iframeSrc) {
    return (
      <Center h="100vh" p={4}>
        <Text textStyle="copy" color="red.500">
          Missing NEXT_PUBLIC_UNITY_BUILD_ID.
          <br />
          Set it in Vercel (Production/Preview) and redeploy.
        </Text>
      </Center>
    );
  }

  return (
    <Box width="100%" height="100%" overflow="hidden">
      <TutorialPopup />
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        style={{ width: "100%", height: "100%", border: "none" }}
        scrolling="no"
        frameBorder={0}
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </Box>
  );
}
