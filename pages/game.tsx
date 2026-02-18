import { useEffect, useMemo, useRef } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import axios from "axios";
import TutorialPopup from "../components/modals/TutorialPopup";
import MobileLogOverlay from "@/utils/MobileLogOverlay";
import { useMobileLog } from "../utils/useMobileLog";

function safeHeader(res: Response, key: string) {
  try {
    return res.headers.get(key) || "";
  } catch {
    return "";
  }
}

async function probeUrl(url: string, log: (m: string, o?: any) => void) {
  try {
    log(`PROBE fetch ${url}`);

    const res = await fetch(url, { method: "GET", cache: "no-store" });

    const ct = safeHeader(res, "content-type");
    const ce = safeHeader(res, "content-encoding");
    const cc = safeHeader(res, "cache-control");
    const vary = safeHeader(res, "vary");
    const etag = safeHeader(res, "etag");
    const xvc = safeHeader(res, "x-vercel-cache");
    const xmp = safeHeader(res, "x-matched-path");
    const cl = safeHeader(res, "content-length");

    log(`PROBE result: ${res.status} ${res.statusText}`, {
      "content-type": ct,
      "content-encoding": ce,
      "cache-control": cc,
      vary,
      etag,
      "content-length": cl,
      "x-vercel-cache": xvc,
      "x-matched-path": xmp,
    });

    const buf = await res.clone().arrayBuffer();
    const bytes = new Uint8Array(buf.slice(0, 24));
    const ascii = Array.from(bytes)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
      .join("");
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    log(`PROBE first24 ascii="${ascii}" hex=${hex}`);

    if (
      ascii.toLowerCase().startsWith("<!do") ||
      ascii.toLowerCase().startsWith("<html") ||
      ct.includes("text/html")
    ) {
      log("PROBE WARNING: looks like HTML/route fallback returned for a Unity asset", {
        url,
        ct,
        ascii,
      });
    }
  } catch (e: any) {
    log(`PROBE ERROR ${url}`, { message: String(e?.message || e), error: String(e) });
  }
}

export default function GamePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const mlog = params.get("mlog") === "1";

  // Toggle mode from query so you can debug on mobile easily:
  // /game?mlog=1&unity=uncompressed
  const unityMode = params.get("unity") || "br"; // "br" | "uncompressed"

  // For versioned mode only
  const buildId = process.env.NEXT_PUBLIC_UNITY_BUILD_ID || "0.9.0";

  const { lines, hidden, push, clear, toggleHidden } = useMobileLog(mlog);

  const iframeSrc = useMemo(() => {
    const logFlag = mlog ? "&mlog=1" : "";
    if (unityMode === "uncompressed") {
      // unversioned + uncompressed
      const v = encodeURIComponent(buildId);
      return `/UnityBuild/index.html?v=${v}${logFlag}`;
    }
    // versioned + br (your current)
    const v = encodeURIComponent(buildId);
    return `/UnityBuild/${buildId}/index.html?v=${v}${logFlag}`;
  }, [buildId, mlog, unityMode]);

  // Expose wallet data globally (consistent: object or null)
  useEffect(() => {
    if (publicKey) {
      window.currentWalletData = { walletAddress: publicKey.toBase58(), userName: "" };
      push("wallet set", window.currentWalletData);
    } else {
      window.currentWalletData = null;
      push("wallet cleared (publicKey null)");
    }
  }, [publicKey, push]);

  // Send walletData to iframe (FIXED deps)
  useEffect(() => {
    const hasFrame = !!iframeRef.current?.contentWindow;
    const hasWallet = !!publicKey && !!window.currentWalletData;

    push("wallet effect", { connected, hasFrame, hasWallet });

    if (!connected || !hasFrame || !window.currentWalletData) {
      push("Not posting walletData (effect)");
      return;
    }

    const message = { type: "walletData", payload: window.currentWalletData };
    iframeRef.current!.contentWindow!.postMessage(message, window.location.origin);
    push("Posted walletData -> iframe", message);
  }, [connected, publicKey, push]);

  // Parent-side probes
  useEffect(() => {
    if (!mlog) return;

    push("GamePage mounted");
    push("UA " + navigator.userAgent);
    push("Origin " + window.location.origin);
    push("NEXT_PUBLIC_UNITY_BUILD_ID " + buildId);
    push("unityMode " + unityMode);
    push("iframeSrc " + iframeSrc);

    const base =
      unityMode === "uncompressed"
        ? `${window.location.origin}/UnityBuild/Build`
        : `${window.location.origin}/UnityBuild/${buildId}/Build`;

    (async () => {
      push("PROBE START (parent)");

      // loader is always raw .js
      await probeUrl(`${base}/Jumper.loader.js?v=${encodeURIComponent(buildId)}`, push);

      if (unityMode === "uncompressed") {
        await probeUrl(`${base}/Jumper.framework.js?v=${encodeURIComponent(buildId)}`, push);
        await probeUrl(`${base}/Jumper.wasm?v=${encodeURIComponent(buildId)}`, push);
        await probeUrl(`${base}/Jumper.data?v=${encodeURIComponent(buildId)}`, push);
      } else {
        await probeUrl(`${base}/Jumper.framework.js.br?v=${encodeURIComponent(buildId)}`, push);
        await probeUrl(`${base}/Jumper.wasm.br?v=${encodeURIComponent(buildId)}`, push);
        await probeUrl(`${base}/Jumper.data.br?v=${encodeURIComponent(buildId)}`, push);
      }

      push("PROBE END (parent)");
    })();
  }, [mlog, buildId, iframeSrc, unityMode, push]);

  const startSession = async () => {
    if (connected && publicKey) {
      try {
        const res = await axios.post("/api/game/start", {
          walletAddress: publicKey.toBase58(),
          userName: "",
        });
        push("Session started on server", res.data);
      } catch (error: any) {
        push("Failed to start session", { message: String(error?.message || error) });
      }
    }
  };

  const sendWalletData = () => {
    if (!iframeRef.current?.contentWindow) {
      push("sendWalletData: iframe not available");
      return;
    }
    if (!window.currentWalletData) {
      push("sendWalletData: no wallet data (null)");
      return;
    }

    const message = { type: "walletData", payload: window.currentWalletData };
    iframeRef.current.contentWindow.postMessage(message, window.location.origin);
    push("sendWalletData -> iframe", message);
  };

  const handleIframeLoad = () => {
    push("Iframe loaded event fired");

    iframeRef.current?.contentWindow?.postMessage({ type: "focus" }, window.location.origin);
    push("Posting focus -> iframe");

    iframeRef.current?.contentWindow?.postMessage({ type: "probe" }, window.location.origin);
    push("Posting probe -> iframe");

    if (connected && publicKey) sendWalletData();

    // keep session logic intact
    startSession();
  };

  // Receive logs + probe results from iframe
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data: any = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "iframeLog") push(`IFRAME: ${String(data.msg || "")}`, data.obj);
      if (data.type === "iframeProbe") push(`IFRAME PROBE: ${String(data.msg || "")}`, data.obj);
      if (data.type === "iframeUnity") push(`UNITY: ${String(data.msg || "")}`, data.obj);
      if (data.type === "mlog") {
        // if you migrate iframe to the {type:"mlog"} format, show it too
        push(`IFRAME: ${String(data.payload?.message || "")}`, data.payload?.data);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [push]);

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
        src={iframeSrc}
        style={{ width: "100%", height: "100%", border: "none" }}
        scrolling="no"
        frameBorder={0}
        allowFullScreen
        onLoad={handleIframeLoad}
      />

      <MobileLogOverlay
        enabled={mlog}
        lines={lines}
        hidden={hidden}
        onClear={clear}
        onToggleHidden={toggleHidden}
      />
    </Box>
  );
}
