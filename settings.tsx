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
// ─────────────────────────────────────────────────────────────────────────────
const flag = (v: string | undefined, fallback = false) =>
  v === undefined || v.trim() === "" ? fallback : v.trim().toLowerCase() === "true";

export const LEADERBOARD_ENABLED = flag(process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED);
export const PUBLIC_SALE_ENABLED = flag(process.env.NEXT_PUBLIC_PUBLIC_SALE_ENABLED);

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
