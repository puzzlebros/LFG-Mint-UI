// pages/api/rpc.ts
//
// Server-side JSON-RPC proxy. The browser talks to THIS route; only this route
// knows the Helius URL (and therefore the API key).
//
// Why: NEXT_PUBLIC_* values are inlined into the client bundle, so shipping the
// Helius URL as NEXT_PUBLIC_RPC published the API key to every visitor. It was
// lifted and used to run LaserStream streaming — a product this app never
// calls — which burned the whole monthly credit allowance in four days.
//
// Three layers here, in order of how much they actually buy you:
//   1. the key is server-side only, so there is nothing to steal from the page;
//   2. a method allowlist, so even a direct caller can only reach the handful
//      of cheap read methods the app really uses — no LaserStream, no
//      arbitrary Helius product;
//   3. an origin check and a per-IP rate limit, to stop casual reuse.
//
// HTTP only — there is deliberately no WebSocket upgrade path (Vercel
// functions cannot proxy one anyway). The client confirms transactions by
// polling getSignatureStatuses instead; see utils/metaplex/confirmSignature.ts.
import type { NextApiRequest, NextApiResponse } from "next";

/** Methods the app actually issues. Anything else is refused and logged. */
const ALLOWED_METHODS = new Set([
  // accounts / balances
  "getAccountInfo", "getMultipleAccounts", "getProgramAccounts", "getBalance",
  "getMinimumBalanceForRentExemption", "getTokenAccountsByOwner",
  "getTokenAccountBalance", "getTokenLargestAccounts",
  // chain state
  "getLatestBlockhash", "getBlockHeight", "getSlot", "getBlockTime",
  "getEpochInfo", "getVersion", "getHealth", "getGenesisHash",
  "getRecentPrioritizationFees", "getFeeForMessage",
  // transactions
  "sendTransaction", "simulateTransaction", "getSignatureStatuses",
  "getTransaction", "getSignaturesForAddress",
  // Helius DAS (read-only metadata)
  "getAsset", "getAssetsByOwner", "getAssetsByGroup", "searchAssets",
]);

// Per-IP sliding window. In-process, so it is per lambda instance and therefore
// leaky across a cold fleet — it is a brake on sustained abuse, not a hard cap.
const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = Number.parseInt(process.env.RPC_PROXY_MAX_PER_10S ?? "120", 10);
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  if (!Number.isFinite(MAX_PER_WINDOW) || MAX_PER_WINDOW <= 0) return false;
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) {
    hits.forEach((times, key) => {
      if (!times.some((t) => t > cutoff)) hits.delete(key);
    });
  }
  return recent.length > MAX_PER_WINDOW;
}

function clientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  return (raw?.split(",")[0] ?? req.socket.remoteAddress ?? "unknown").trim();
}

/**
 * Same-origin check. Only enforced when the caller sends Origin or Referer —
 * browsers always do for a cross-site POST, which is the case we care about.
 * A bare curl sends neither and still has to pass the method allowlist and the
 * rate limit.
 */
function originAllowed(req: NextApiRequest): boolean {
  const host = req.headers.host;
  if (!host) return true;
  const stated = (req.headers.origin as string) || (req.headers.referer as string);
  if (!stated) return true;
  try {
    return new URL(stated).host === host;
  } catch {
    return false;
  }
}

function methodsOf(body: unknown): string[] {
  const one = (b: any) => (b && typeof b.method === "string" ? b.method : "");
  if (Array.isArray(body)) return body.map(one);
  return [one(body)];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const upstreamUrl = process.env.HELIUS_RPC ?? process.env.NEXT_PUBLIC_RPC;
  if (!upstreamUrl) {
    console.error("[rpc] Missing HELIUS_RPC");
    return res.status(500).json({ error: "RPC not configured" });
  }
  if (process.env.HELIUS_RPC === undefined) {
    console.warn(
      "[rpc] Falling back to NEXT_PUBLIC_RPC. Set HELIUS_RPC and delete " +
        "NEXT_PUBLIC_RPC — while it exists the key is still in the client bundle."
    );
  }

  if (!originAllowed(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (rateLimited(clientIp(req))) {
    res.setHeader("Retry-After", "10");
    return res.status(429).json({ error: "Too many RPC requests" });
  }

  const methods = methodsOf(req.body);
  const blocked = methods.filter((m) => !ALLOWED_METHODS.has(m));
  if (blocked.length > 0) {
    // Logged so a method the app legitimately needs shows up in Vercel logs
    // rather than failing silently.
    console.warn("[rpc] blocked method(s):", blocked.join(", "));
    return res.status(403).json({ error: `RPC method not allowed: ${blocked[0]}` });
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.status(upstream.status).send(text);
  } catch (e: any) {
    console.error("[rpc] upstream error:", e?.message ?? e);
    return res.status(502).json({ error: "Upstream RPC error" });
  }
}
