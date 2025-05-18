// pages/game.tsx

import { useEffect, useRef } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import axios from "axios";

export default function GamePage() {
  // ────────────────────────────────────────────────────────────────────────────
  // 1. Hooks MUST be called unconditionally, at the top of the component
  // ────────────────────────────────────────────────────────────────────────────
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

  // Whenever connection or publicKey changes, push walletData to Unity
  useEffect(() => {
    if (connected && publicKey && iframeRef.current?.contentWindow) {
      const messageData = {
        walletAddress: publicKey.toBase58(),
        userName: "",
      };
      const message = { type: "walletData", payload: messageData };
      iframeRef.current.contentWindow.postMessage(message, window.location.origin);
      console.log("Sent wallet data to Unity:", message);
    }
  }, [connected, publicKey]);

  // ────────────────────────────────────────────────────────────────────────────
  // 2. All functions below are just helpers—no more hooks!
  // ────────────────────────────────────────────────────────────────────────────

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
      startSession();
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Now we can early‐return for the frozen state
  // ────────────────────────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Finally, render the live game iframe
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <Box width="100%" height="100%" overflow="hidden">
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
