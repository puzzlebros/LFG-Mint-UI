import { useEffect, useMemo, useRef, useCallback } from "react";
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

    const params = new URLSearchParams();
    params.set("v", unityBuildId);

    // Forward ?mlog=1 from /game into the iframe so the probe runs there too.
    if (typeof window !== "undefined") {
      const pageParams = new URLSearchParams(window.location.search);
      if (pageParams.get("mlog") === "1") params.set("mlog", "1");
    }

    // IMPORTANT: we intentionally use the *versioned* path.
    return `/UnityBuild/${unityBuildId}/index.html?${params.toString()}`;
  }, [unityBuildId]);

  // One-time environment log
  useEffect(() => {
    mlog("GamePage mounted");
    mlog("UA", navigator.userAgent);
    mlog("Origin", window.location.origin);
    mlog("NEXT_PUBLIC_UNITY_BUILD_ID", unityBuildId ?? "(missing)");
    mlog("iframeSrc", iframeSrc ?? "(null)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Maintain wallet global (object | null)
  useEffect(() => {
    if (publicKey) {
      window.currentWalletData = { walletAddress: publicKey.toBase58(), userName: "" };
      mlog("Wallet set", window.currentWalletData);
    } else {
      window.currentWalletData = null;
      mlog("Wallet cleared (publicKey null)");
    }

    // Push walletData when possible
    const win = iframeRef.current?.contentWindow;
    if (connected && win && window.currentWalletData !== null) {
      mlog("Posting walletData to iframe (effect)");
      win.postMessage({ type: "walletData", payload: window.currentWalletData }, window.location.origin);
    } else {
      mlog("Not posting walletData (effect)", {
        connected,
        hasIframe: !!win,
        hasWallet: window.currentWalletData !== null,
      });
    }
  }, [connected, publicKey, mlog]);

  // Listen for iframe messages (probe logs/errors)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;

      if (data?.type === "unity-log") {
        mlog("IFRAME", data.payload);
      } else if (data?.type === "unity-error") {
        mlog("IFRAME_ERROR", data.payload);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mlog]);

  const postFocus = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      mlog("focus: no iframe window yet");
      return;
    }
    mlog("Posting focus -> iframe");
    win.postMessage({ type: "focus" }, window.location.origin);
  }, [mlog]);

  const postWallet = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      mlog("wallet: no iframe window yet");
      return;
    }
    if (window.currentWalletData === null) {
      mlog("wallet: currentWalletData is null");
      return;
    }
    mlog("Posting walletData -> iframe (manual)");
    win.postMessage({ type: "walletData", payload: window.currentWalletData }, window.location.origin);
  }, [mlog]);

  const handleIframeLoad = () => {
    mlog("Iframe loaded event fired");

    // Focus immediately, then retry a couple times (iOS sometimes needs a beat)
    postFocus();
    setTimeout(postFocus, 250);
    setTimeout(postFocus, 750);

    if (connected && publicKey) {
      postWallet();
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
