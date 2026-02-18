// pages/game.tsx — UPDATED (fix hydration mismatch by client-only iframe)
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Center, Text } from "@chakra-ui/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWeeklyCycle } from "../utils/leaderboard/useWeeklyCycle";
import axios from "axios";
import TutorialPopup from "../components/modals/TutorialPopup";
import MobileLogOverlay from "@/utils/MobileLogOverlay";
import { useMobileLog } from "../utils/useMobileLog";

declare global {
  interface Window {
    currentWalletData: { walletAddress: string; userName: string } | null;
  }
}

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
      res.status === 404 ||
      ascii.toLowerCase().startsWith("<!do") ||
      ascii.toLowerCase().startsWith("<html") ||
      ct.includes("text/html")
    ) {
      log("PROBE WARNING: looks like HTML/route fallback returned for a Unity asset", {
        url,
        status: res.status,
        ct,
        ascii,
      });
    }
  } catch (e: any) {
    log(`PROBE ERROR ${url}`, { message: String(e?.message || e), error: String(e) });
  }
}

// RAW / UNVERSIONED Unity path builder
function getUnityPathsRaw(opts: { origin: string; productName: string }) {
  const { origin, productName } = opts;
  const basePath = "/UnityBuild";
  return {
    iframeSrc: `${basePath}/index.html`,
    files: {
      loader: `${basePath}/Build/${productName}.loader.js`,
      framework: `${basePath}/Build/${productName}.framework.js`,
      wasm: `${basePath}/Build/${productName}.wasm`,
      data: `${basePath}/Build/${productName}.data`,
    },
  };
}

export default function GamePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { isFrozen, next } = useWeeklyCycle();
  const { publicKey, connected } = useWallet();

  // ✅ Prevent SSR/CSR mismatch: don't render iframe until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Query params only matter client-side; keep safe for SSR
  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const mlog = mounted && params.get("mlog") === "1";
  const { lines, hidden, push, clear, toggleHidden } = useMobileLog(mlog);

  const unity = useMemo(() => {
    if (!mounted) {
      return { iframeSrc: "", files: { loader: "", framework: "", wasm: "", data: "" } };
    }
    return getUnityPathsRaw({
      origin: window.location.origin,
      productName: "Jumper",
    });
  }, [mounted]);

  const iframeSrc = useMemo(() => {
    if (!mounted || !unity.iframeSrc) return "";
    const join = unity.iframeSrc.includes("?") ? "&" : "?";
    return mlog ? `${unity.iframeSrc}${join}mlog=1` : unity.iframeSrc;
  }, [mounted, unity.iframeSrc, mlog]);

  // Expose wallet data globally for iframe to read
  useEffect(() => {
    if (!mounted) return;

    if (publicKey) {
      window.currentWalletData = { walletAddress: publicKey.toBase58(), userName: "" };
      push("wallet set", window.currentWalletData);
    } else {
      window.currentWalletData = null;
      push("wallet cleared (publicKey null)");
    }
  }, [mounted, publicKey, push]);

  // Send walletData to iframe
  useEffect(() => {
    if (!mounted) return;

    const hasFrame = !!iframeRef.current?.contentWindow;
    const hasWallet = !!window.currentWalletData;

    push("wallet effect", { connected, hasFrame, hasWallet });

    if (!connected || !hasFrame || !hasWallet) {
      push("Not posting walletData (effect)");
      return;
    }

    const message = { type: "walletData", payload: window.currentWalletData };
    iframeRef.current!.contentWindow!.postMessage(message, window.location.origin);
    push("Posted walletData -> iframe", message);
  }, [mounted, connected, push]);

  // Parent-side probes (only when mlog enabled)
  useEffect(() => {
    if (!mounted) return;
    if (!mlog) return;
    if (!iframeSrc) return;

    push("GamePage mounted");
    push("UA " + navigator.userAgent);
    push("Origin " + window.location.origin);
    push("iframeSrc " + iframeSrc);

    (async () => {
      push("PROBE START (parent)");
      await probeUrl(`${window.location.origin}${unity.files.loader}`, push);
      await probeUrl(`${window.location.origin}${unity.files.framework}`, push);
      await probeUrl(`${window.location.origin}${unity.files.wasm}`, push);
      await probeUrl(`${window.location.origin}${unity.files.data}`, push);
      push("PROBE END (parent)");
    })();
  }, [mounted, mlog, iframeSrc, unity.files, push]);

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
  };

  // Receive logs + probe results from iframe
  useEffect(() => {
    if (!mounted) return;

    const onMsg = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data: any = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "iframeLog") push(`IFRAME: ${String(data.msg || "")}`, data.obj);
      if (data.type === "iframeProbe") push(`IFRAME PROBE: ${String(data.msg || "")}`, data.obj);
      if (data.type === "iframeUnity") push(`UNITY: ${String(data.msg || "")}`, data.obj);

      // support your index.html "mlog" bridge too
      if (data.type === "mlog" && data.payload?.message) {
        push(`IFRAME: ${String(data.payload.message)}`, data.payload.data);
      }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mounted, push]);

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

  // ✅ server + first client render: no iframe => no hydration mismatch
  if (!mounted) {
    return (
      <Center h="100vh" p={4}>
        <Text textStyle="copy" color="brand.DarkPurple">
          Loading…
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
