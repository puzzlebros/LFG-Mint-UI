// utils/useWalletContextGuard.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export function useWalletContextGuard(opts?: {
  enabled?: boolean;
  debugLog?: (msg: string, obj?: any) => void;

  // NEW (optional): called right before we disconnect
  onStale?: (reason: string, detail?: any) => void;

  // NEW (optional): if true, keep `blocked=true` for a short window after disconnect to avoid races
  blockMs?: number;
}) {
  const {
    enabled = true,
    debugLog,
    onStale,
    blockMs = 800,
  } = opts || {};

  const wallet = useWallet();
  const { connected, connecting, disconnecting, publicKey, wallet: w } = wallet;

  const [isStale, setIsStale] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<number>(0);

  const lastCheckedAt = useRef<number>(0);

  const log = useCallback((msg: string, obj?: any) => debugLog?.(msg, obj), [debugLog]);

  const hardBlock = useCallback(() => {
    setBlockedUntil(Date.now() + blockMs);
  }, [blockMs]);

  const forceDisconnect = useCallback(
    async (reason: string, detail?: any) => {
      try {
        log("WALLET GUARD: disconnecting - " + reason, detail);
        onStale?.(reason, detail);

        setIsStale(true);
        hardBlock();
        await wallet.disconnect();
      } catch (e: any) {
        log("WALLET GUARD: disconnect error", { reason, message: String(e?.message || e) });
      } finally {
        setTimeout(() => setIsStale(false), 250);
      }
    },
    [wallet, log, onStale, hardBlock]
  );

  // Unified capability check (no prompting)
  const hasSigningCapabilities = useCallback(() => {
    const adapter: any = w?.adapter;
    return (
      typeof adapter?.signTransaction === "function" ||
      typeof adapter?.signAllTransactions === "function" ||
      typeof adapter?.signMessage === "function"
    );
  }, [w]);

  // NEW: action-time preflight you can call before mint / tx
  const preflight = useCallback(async () => {
    if (!enabled) return { ok: true as const };

    if (connecting || disconnecting) {
      return { ok: false as const, reason: "wallet is connecting/disconnecting" };
    }

    // stale invariant
    if (connected && !publicKey) {
      await forceDisconnect("preflight: connected=true but publicKey is null");
      return { ok: false as const, reason: "stale: missing publicKey" };
    }

    if (!connected) return { ok: true as const };

    if (!hasSigningCapabilities()) {
      await forceDisconnect("preflight: adapter missing signing capabilities (context lost)", {
        name: (w as any)?.adapter?.name || "unknown",
      });
      return { ok: false as const, reason: "stale: missing signing capabilities" };
    }

    return { ok: true as const };
  }, [
    enabled,
    connected,
    publicKey,
    connecting,
    disconnecting,
    hasSigningCapabilities,
    forceDisconnect,
    w,
  ]);

  // derived: treat as blocked if stale or in the post-disconnect window
  const blocked = useMemo(() => {
    if (!enabled) return false;
    if (isStale) return true;
    if (Date.now() < blockedUntil) return true;
    if (connected && !publicKey) return true; // immediate invariant
    return false;
  }, [enabled, isStale, blockedUntil, connected, publicKey]);

  // 1) Immediate invariant: connected but missing publicKey => stale
  useEffect(() => {
    if (!enabled) return;
    if (connecting || disconnecting) return;

    if (connected && !publicKey) {
      forceDisconnect("connected=true but publicKey is null");
    }
  }, [enabled, connected, publicKey, connecting, disconnecting, forceDisconnect]);

  // 2) Re-check when tab becomes visible again (mobile background/foreground)
  useEffect(() => {
    if (!enabled) return;

    const onVis = async () => {
      if (document.visibilityState !== "visible") return;
      if (!connected) return;
      if (connecting || disconnecting) return;

      // throttle (avoid loops on iOS)
      const now = Date.now();
      if (now - lastCheckedAt.current < 1500) return;
      lastCheckedAt.current = now;

      const adapter: any = w?.adapter;
      const name = adapter?.name || "unknown";
      log("WALLET GUARD: visibility check", { name, connected: true, hasPublicKey: !!publicKey });

      if (!publicKey) {
        await forceDisconnect("visibility: connected but no publicKey", { name });
        return;
      }

      if (!hasSigningCapabilities()) {
        await forceDisconnect("adapter missing signing capabilities (context likely lost)", { name });
      }
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [enabled, connected, connecting, disconnecting, publicKey, w, log, hasSigningCapabilities, forceDisconnect]);

  // 3) Listen for adapter errors if available
  useEffect(() => {
    if (!enabled) return;

    const adapter: any = w?.adapter;
    const onError = (e: any) => {
      log("WALLET GUARD: adapter error", { message: String(e?.message || e), e });
      if (connected) forceDisconnect("adapter emitted error", { message: String(e?.message || e) });
    };

    if (adapter?.on && adapter?.off) {
      adapter.on("error", onError);
      return () => adapter.off("error", onError);
    }
  }, [enabled, connected, w, log, forceDisconnect]);

  return { isStale, blocked, preflight };
}
