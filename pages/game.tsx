// pages/game.tsx

import { useEffect, useRef } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import axios from "axios";
import TutorialPopup from "../components/modals/TutorialPopup";

export default function GamePage() {

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

  // Whenever connection or publicKey changes, push walletData to Unity
  useEffect(() => {
    if (publicKey) {
      // ❶ populate the global
      window.currentWalletData = {
        walletAddress: publicKey.toBase58(),
        userName: "",
      };
    }
    if (connected && iframeRef.current?.contentWindow) {
      const message = {
        type: "walletData",
        payload: window.currentWalletData,
      };
      iframeRef.current.contentWindow.postMessage(message, window.location.origin);
    }
  }, [connected, publicKey]);

  // Start a session on our backend whenever the user enters the game
  const startSession = async () => {
    if (connected && publicKey) {
      try {
        const res = await axios.post("/api/game/start", {
          walletAddress: publicKey.toBase58(),
          userName: "",
        });
        console.log("Session started on server:", res.data);
      } catch (error) {
        console.error("Failed to start session:", error);
      }
    }
  };

  // Send walletData to the iframe manually
  const sendWalletData = () => {
    if (iframeRef.current && publicKey) {
      const messageData = {
        walletAddress: publicKey.toBase58(),
        userName: "",
      };
      const message = { type: "walletData", payload: messageData };
      iframeRef.current.contentWindow?.postMessage(message, window.location.origin);
      console.log("Sending wallet data to Unity:", message);
    } else {
      console.warn("sendWalletData: Wallet not connected or iframe not available.");
    }
  };

  // Called once when the iframe finishes loading
  const handleIframeLoad = () => {
    console.log("Iframe loaded.");
    if (connected && publicKey) {
      sendWalletData();
    }
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

  return (
    <Box width="100%" height="100%" overflow="hidden">
      <TutorialPopup />
      <iframe
        ref={iframeRef}
        src="/UnityBuild/index.html"
        style={{ width: "100%", height: "100%", border: "none" }}
        scrolling="no"
        frameBorder="0"
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </Box>
  );
}
