// utils/leaderboard/updateAllowlist.ts

import "dotenv/config";
import {
  createClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  publicKey,
  keypairIdentity,
  some,
  sol,
  dateTime,
  isSome,
  Umi,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  mplCandyMachine as mplCoreCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  updateCandyGuard,
  getMerkleRoot,
} from "@metaplex-foundation/mpl-core-candy-machine";
import type { LeaderboardEntry } from "@/types/leaderboard";
import { allowLists } from "../../allowlist";

// — Supabase clients —
// We use anon key for reads and service key for deletes/edits
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}
const supabase:      SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// — UMI & Candy Machine setup —
// RPC endpoint (Devnet or Mainnet depending on env)
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
const CM_PUBKEY    = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!;
if (!CM_PUBKEY) {
  throw new Error("Missing NEXT_PUBLIC_CANDY_MACHINE_ID");
}

// Initialize UMI with the Candy Machine plugin
const umi: Umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// ── Load deploy keypair directly from JSON in env ──
const rawDeploy = process.env.DEPLOY_KEYPAIR;
if (!rawDeploy) {
  console.error("❌ Missing DEPLOY_KEYPAIR environment variable");
  process.exit(1);
}
let deployBytes: Uint8Array;
try {
  // rawDeploy is a string like "[164,5,39,114,…]"
  const arr: number[] = JSON.parse(rawDeploy);
  deployBytes = new Uint8Array(arr);
} catch (e) {
  console.error("❌ DEPLOY_KEYPAIR is not valid JSON array:", e);
  process.exit(1);
}
const deployKeypair = umi.eddsa.createKeypairFromSecretKey(deployBytes);
umi.use(keypairIdentity(deployKeypair));

// ── (Optional) Load treasury keypair from JSON in env ──
const rawTreasury = process.env.TREASURY_KEYPAIR;
if (!rawTreasury) {
  console.error("❌ Missing TREASURY_KEYPAIR environment variable");
  process.exit(1);
}
let treasuryBytes: Uint8Array;
try {
  const arr: number[] = JSON.parse(rawTreasury);
  treasuryBytes = new Uint8Array(arr);
} catch (e) {
  console.error("❌ TREASURY_KEYPAIR is not valid JSON array:", e);
  process.exit(1);
}
const treasuryKeypair = umi.eddsa.createKeypairFromSecretKey(treasuryBytes);
// (You can now use treasuryKeypair if needed; here we just load it so Umi has it available.)

/**
 * Fetch the top 10 wallet addresses from Supabase “leaderboard” table.
 */
async function getTop10Wallets(): Promise<string[]> {
  const { data, error } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data?.map((r) => r.wallet_address) ?? [];
}

/**
 * Main routine: 
 *  1) Grab top 10 from Supabase
 *  2) Merge into in-memory allowLists map
 *  3) Compute Merkle root
 *  4) Fetch on-chain Candy Guard, locate "LFG" group
 *  5) Push a new Merkle root + updated dates (oldEnd → oldEnd + 7d)
 */
export async function updateAllowlistGuard(): Promise<void> {
  console.log("🔍 [update] Fetching top-10 from Supabase…");
  const top10 = await getTop10Wallets();
  console.log("   → top10:", top10);

  // Merge into in-memory allowLists (optional local fallback)
  const existing = allowLists.get("allowlist") ?? [];
  const merged   = Array.from(new Set([...existing, ...top10]));
  allowLists.set("allowlist", merged);
  console.log("🔀 [update] merged allowList:", merged);

  // Compute Merkle root of those addresses
  const merkleRoot = getMerkleRoot(merged);
  console.log("🌿 [update] Merkle root:", merkleRoot.toString());

  // Fetch on-chain Candy Machine & Candy Guard
  console.log("📡 [update] Fetching Candy Machine and Candy Guard…");
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // Find the "LFG" group inside Candy Guard
  const allowGroup = guardData.groups.find((g) => g.label === "LFG");
  if (!allowGroup) {
    throw new Error('No "LFG" group found on Candy Guard');
  }

  // Ensure it has startDate and endDate
  const { startDate, endDate } = allowGroup.guards;
  if (!isSome(startDate) || !isSome(endDate)) {
    throw new Error("AllowList guard missing startDate or endDate");
  }

  // Compute new window: oldEnd → oldEnd + 7 days
  const oldEnd   = new Date(Number(endDate.value.date) * 1_000);
  const newStart = oldEnd;
  const newEnd   = new Date(oldEnd.getTime() + 7 * 24 * 60 * 60 * 1_000);
  console.log(`[update] Extending guard window: ${newStart.toISOString()} → ${newEnd.toISOString()}`);

  // Finally, send the on-chain update: preserve global guards, override only "LFG" group
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},
    groups: [
      {
        label: "LFG",
        guards: {
          startDate: some({ date: dateTime(newStart.toISOString()) }),
          endDate:   some({ date: dateTime(newEnd.toISOString()) }),
          allowList: some({ merkleRoot }),
          mintLimit: some({ id: 1, limit: 1 }),
        },
      },
    ],
  }).sendAndConfirm(umi);

  console.log("✅ [update] Candy Guard window extended & Merkle root updated");
}
