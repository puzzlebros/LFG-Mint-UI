// utils/metaplex/confirmSignature.ts
//
// Confirm a transaction by polling getSignatureStatuses over plain HTTP.
//
// umi.rpc.confirmTransaction delegates to web3.js `onSignature`, which opens a
// WebSocket. The browser now reaches Solana through /api/rpc — an HTTP-only
// JSON-RPC proxy with no WebSocket behind it — so a subscription would simply
// hang until the blockhash expired. Polling also guarantees the app never
// opens a billable streaming connection, which is what drained the RPC plan.
import type { Umi, Commitment } from "@metaplex-foundation/umi";

const RANK: Record<string, number> = { processed: 0, confirmed: 1, finalized: 2 };

export type ConfirmResult = {
  /** Reached the requested commitment. */
  confirmed: boolean;
  /** On-chain execution error, if the transaction landed but failed. */
  error: unknown | null;
  /** Gave up waiting — the transaction may still land. */
  timedOut: boolean;
};

export async function confirmSignature(
  umi: Umi,
  signature: Uint8Array,
  opts: { commitment?: Commitment; timeoutMs?: number; intervalMs?: number } = {}
): Promise<ConfirmResult> {
  const commitment = opts.commitment ?? "confirmed";
  // 90s comfortably outstrips a blockhash's ~60s validity window, so a
  // transaction that is going to land has landed by the time we give up.
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 1_200;
  const want = RANK[commitment] ?? 1;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const [status] = await umi.rpc.getSignatureStatuses([signature]);
      if (status) {
        if (status.error) {
          return { confirmed: false, error: status.error, timedOut: false };
        }
        const have = status.commitment ? RANK[status.commitment] ?? -1 : -1;
        if (have >= want) return { confirmed: true, error: null, timedOut: false };
      }
    } catch {
      // Transient RPC hiccup — keep polling until the deadline.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { confirmed: false, error: null, timedOut: true };
}
