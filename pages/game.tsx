import { useEffect, useRef } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import axios from "axios";

export default function GamePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

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

  // Function to start a session on the server.
  const startSession = async () => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();
      const userName = ""; // Optionally, you could derive a display name here.
      try {
        const res = await axios.post("/api/game/start", { walletAddress, userName });
        console.log("Session started on server:", res.data);
        // You can choose to store sessionId / secretSalt if needed.
      } catch (error) {
        console.error("Failed to start session:", error);
      }
    }
  };

  // Function to send wallet data to Unity.
  const sendWalletData = () => {
    if (iframeRef.current && publicKey) {
      const walletAddress = publicKey.toBase58();
      const userName = ""; // Modify if needed
      const messageData = { walletAddress, userName };

      window.currentWalletData = messageData;

      const message = {
        type: "walletData",
        payload: messageData,
      };

      console.log("Sending wallet data to Unity:", message);
      iframeRef.current.contentWindow?.postMessage(message, window.location.origin);
    } else {
      console.warn("sendWalletData: Wallet not connected or iframe not available.");
    }
  };

  // When connected/publicKey updates, ensure that the global wallet data is updated.
  useEffect(() => {
    if (connected && publicKey) {
      const walletAddress = publicKey.toBase58();
      const userName = ""; // optionally set a name
      window.currentWalletData = { walletAddress, userName };

      const message = {
        type: "walletData",
        payload: { walletAddress, userName },
      };

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(message, window.location.origin);
      }
    }
  }, [connected, publicKey]);

  // On iframe load, send wallet data to Unity.
  const handleIframeLoad = () => {
    console.log("Iframe loaded.");
    if (connected && publicKey) {
      sendWalletData();
    }
  };

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
