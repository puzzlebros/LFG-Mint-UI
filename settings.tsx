// settings.tsx

// ─────────────────────────────────────────────────────────────────────────────
// Feature toggles.
//
// LEADERBOARD_ENABLED turns the whole weekly ranking mechanic on or off:
//   • home page ranking section + leaderboard table
//   • the Sat→Mon "freeze" that locks the game and gates the free mint
//   • every Supabase read and write (scores, ranks, top-10, weekly clear cron)
//   • the top-10 eligibility check in front of FREE MINT
// With it off, FREE MINT is open to anyone, any day, and nothing touches
// Supabase. The app is just: hero → play the game for fun → free mint.
//
// PUBLIC_SALE_ENABLED turns the paid "OG" mint on or off. With it off the
// FREE MINT button is the only mint offered.
//
// Both default to off. Re-enable by setting the matching env var to "true"
// (on Vercel an env change triggers the redeploy that inlines it).
//
// NOTE: re-enabling LEADERBOARD_ENABLED also means restoring the weekly
// "crons" entry for /api/cron/clear-allowlist in vercel.json — Vercel cron
// schedules are static config and cannot be switched off at runtime.
// ─────────────────────────────────────────────────────────────────────────────
const flag = (v: string | undefined, fallback = false) =>
  v === undefined || v.trim() === "" ? fallback : v.trim().toLowerCase() === "true";

const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt((v ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const LEADERBOARD_ENABLED = flag(process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED);
export const PUBLIC_SALE_ENABLED = flag(process.env.NEXT_PUBLIC_PUBLIC_SALE_ENABLED);

// Game session tracking: the SNS reverse lookup and the signed JWT issued by
// /api/game/start. These exist only to attribute a score to a wallet, so they
// follow the leaderboard by default — a session is useless without one, and
// the leaderboard cannot record anything without a session. Override only if
// you know you want the combination.
export const GAME_SESSIONS_ENABLED = flag(
  process.env.NEXT_PUBLIC_GAME_SESSIONS_ENABLED,
  LEADERBOARD_ENABLED
);

// ── Free mint rate limiting (see pages/api/allowlistMint.ts) ────────────────
// The candy guard's ADMIN group has no mintLimit, so without these an open
// free mint could be drained by a single script. Both are per wallet; set
// either to 0 to switch that layer off.
//
// These raise the cost of a drain, they do not make one impossible. The cap
// below counts assets a wallet currently HOLDS, so someone who transfers their
// mints to a burner resets it; the cooldown is per lambda instance, so it is
// leaky across a cold fleet. A hard per-wallet mint counter needs persistent
// storage (Vercel KV or similar) — deliberately not added here.

/**
 * Max collection assets a wallet may hold before it stops being served.
 * Measured against the live collection when this was set: holdings ran
 * 212 / 58 / 35 / 34 / 19 / 16 / 15 / 12 / 9 … across 33 holders, so 25 turns
 * away only the four largest while leaving every ordinary holder alone.
 * Lower it for tighter supply control, at the cost of blocking collectors.
 */
export const FREE_MINT_PER_WALLET_LIMIT = int(
  process.env.NEXT_PUBLIC_FREE_MINT_PER_WALLET_LIMIT,
  25
);

/** Seconds a wallet must wait between free mint requests. */
export const FREE_MINT_COOLDOWN_SECONDS = int(
  process.env.NEXT_PUBLIC_FREE_MINT_COOLDOWN_SECONDS,
  30
);

/** Candy guard group label used for the free mint. */
export const FREE_MINT_LABEL = "LFG";
/** Candy guard group label used for the paid public sale. */
export const PUBLIC_SALE_LABEL = "OG";

export const mintSettings = [
  {
    label: FREE_MINT_LABEL,
    mintText: "FREE!",
    buttonLabel: "FREE MINT",
    header: LEADERBOARD_ENABLED ? "TOP 10 PRIZE" : "MINT YOUR FLAMINGO",
  },
  { label: PUBLIC_SALE_LABEL, mintText: "0.01 sol", buttonLabel: "MINT", header: "SUPPORT THE PROJECT" },
];

export const image = "/images/Pack.png";
export const headerText = "LET'S FLAMINGO!";
export const description = "The coolest flock in the block. A 5555 NFT collection. Play, win and mint!";
