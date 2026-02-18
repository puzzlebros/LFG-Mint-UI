// pages/game.tsx
import { useEffect, useMemo, useRef } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import TutorialPopup from "../components/modals/TutorialPopup";
import { useMobileLog } from "../utils/useMobileLog";

export default function GamePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

  const { enabled: mlogEnabled, lines: mlogLines, log: mlog, clear: mlogClear, toggle: mlogToggle } =
    useMobileLog();

  const unityBuildId = process.env.NEXT_PUBLIC_UNITY_BUILD_ID;

  const iframeSrc = useMemo(() => {
    if (!unityBuildId) return null;
    // Versioned path + cache key change for UnityCache
    return `/UnityBuild/${unityBuildId}/index.html?v=${encodeURIComponent(unityBuildId)}`;
  }, [unityBuildId]);

  // Log basic environment info once
  useEffect(() => {
    mlog("GamePage mounted");
    mlog("UA", navigator.userAgent);
    mlog("Origin", window.location.origin);
    mlog("UNITY_BUILD_ID", unityBuildId ?? "(missing)");
    mlog("iframeSrc", iframeSrc ?? "(null)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep wallet data in global (object | null)
  useEffect(() => {
    if (publicKey) {
      window.currentWalletData = { walletAddress: publicKey.toBase58(), userName: "" };
      mlog("Wallet set", window.currentWalletData);
    } else {
      window.currentWalletData = null;
      mlog("Wallet cleared (publicKey null)");
    }

    // Whenever wallet connects/changes, attempt to push to iframe
    if (connected && iframeRef.current?.contentWindow && window.currentWalletData !== null) {
      mlog("Posting walletData to iframe (effect)");
      iframeRef.current.contentWindow.postMessage(
        { type: "walletData", payload: window.currentWalletData },
        window.location.origin
      );
    } else {
      mlog("Not posting walletData (effect)", {
        connected,
        hasIframe: !!iframeRef.current?.contentWindow,
        hasWallet: window.currentWalletData !== null,
      });
    }
  }, [connected, publicKey, mlog]);

  // Receive messages from iframe (optional: add more if you emit them from Unity/index.html)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;

      // If you add postMessage logs from iframe, you’ll see them here.
      if (data?.type === "unity-log") {
        mlog("IFRAME unity-log", data.payload);
      }
      if (data?.type === "unity-error") {
        mlog("IFRAME unity-error", data.payload);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mlog]);

  const focusUnity = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      mlog("focusUnity: no contentWindow yet");
      return;
    }
    mlog("Posting focus to iframe");
    win.postMessage({ type: "focus" }, window.location.origin);
  };

  const sendWalletData = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      mlog("sendWalletData: no contentWindow");
      return;
    }
    if (window.currentWalletData === null) {
      mlog("sendWalletData: walletData is null");
      return;
    }
    mlog("Posting walletData to iframe (manual)");
    win.postMessage({ type: "walletData", payload: window.currentWalletData }, window.location.origin);
  };

  const handleIframeLoad = () => {
    mlog("Iframe loaded event fired");
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
          Set it in Vercel and redeploy.
        </Text>
      </Center>
    );
  }

  return (
    <Box width="100%" height="100%" overflow="hidden" position="relative">
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

      {/* On-screen mobile logger (enable with ?mlog=1) */}
      {mlogEnabled && (
        <Box
          position="fixed"
          left="0"
          right="0"
          bottom="0"
          maxH="45vh"
          overflowY="auto"
          zIndex={999999}
          bg="rgba(0,0,0,0.85)"
          color="green.200"
          fontFamily="mono"
          fontSize="11px"
          lineHeight="1.35"
          p="10px"
          borderTop="1px solid rgba(255,255,255,0.2)"
        >
          <Box display="flex" gap="8px" alignItems="center" mb="6px">
            <Text color="white" fontWeight="bold" m={0}>
              Mobile Log
            </Text>
            <Box as="button" onClick={mlogClear} style={btnStyle}>
              Clear
            </Box>
            <Box as="button" onClick={mlogToggle} style={btnStyle}>
              Hide
            </Box>
          </Box>

          <Box whiteSpace="pre-wrap" wordBreak="break-word">
            {mlogLines.join("\n")}
          </Box>
        </Box>
      )}
    </Box>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#222",
  color: "#fff",
  border: "1px solid #555",
  padding: "4px 8px",
  borderRadius: "4px",
  cursor: "pointer",
};
