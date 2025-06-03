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
// We use ANON key for SELECT and SERVICE role for mutations (if needed)
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
// We will read our keypair JSON from a Base64‐encoded string in env.
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
const CM_PUBKEY    = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!;
if (!CM_PUBKEY) {
  throw new Error("Missing NEXT_PUBLIC_CANDY_MACHINE_ID");
}

const umi: Umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// Instead of reading from disk, parse the base64 JSON from env:
const deployKeypairJsonBase64 = process.env.DEPLOY_KEYPAIR_JSON;
if (!deployKeypairJsonBase64) {
  console.error("❌ Missing DEPLOY_KEYPAIR_JSON");
  process.exit(1);
}
// Step 1: Decode base64 → UTF8 string → parse as JSON array of numbers
const deployKeypairBytes = Uint8Array.from(
  JSON.parse(Buffer.from(deployKeypairJsonBase64, "base64").toString("utf-8"))
);
const deployKeypair = umi.eddsa.createKeypairFromSecretKey(deployKeypairBytes);
umi.use(keypairIdentity(deployKeypair));

// We’ll also parse TREASURY if you ever need it later:
const treasuryKeypairJsonBase64 = process.env.TREASURY_KEYPAIR_JSON;
if (!treasuryKeypairJsonBase64) {
  console.error("❌ Missing TREASURY_KEYPAIR_JSON");
  process.exit(1);
}
const treasuryKeypairBytes = Uint8Array.from(
  JSON.parse(Buffer.from(treasuryKeypairJsonBase64, "base64").toString("utf-8"))
);
const treasuryKeypair = umi.eddsa.createKeypairFromSecretKey(treasuryKeypairBytes);
// (If you don’t actually use treasuryKeypair in this file, it’s fine to drop it; 
//  it’s shown here for completeness.)

// — Fetch top 10 from Supabase leaderboard —
async function getTop10Wallets(): Promise<string[]> {
  const { data, error } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data?.map(r => r.wallet_address) ?? [];
}

// — Main function: merges top 10, updates on-chain Candy Guard —
export async function updateAllowlistGuard(): Promise<void> {
  console.log("🔍 [update] Fetching top-10 from Supabase…");
  const top10 = await getTop10Wallets();
  console.log("   → top10:", top10);

  // Merge into in-memory map (optional fallback)
  const existing = allowLists.get("allowlist") ?? [];
  const merged   = Array.from(new Set([...existing, ...top10]));
  allowLists.set("allowlist", merged);
  console.log("🔀 [update] merged allowList:", merged);

  // Compute Merkle root
  const merkleRoot = getMerkleRoot(merged);
  console.log("🌿 [update] Merkle root:", merkleRoot.toString());

  // Fetch Candy Machine & Guard on Devnet
  console.log("📡 [update] Fetching Candy Machine and Candy Guard…");
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // Find “LFG” group
  const allowGroup = guardData.groups.find((g) => g.label === "LFG");
  if (!allowGroup) {
    throw new Error('No "LFG" group on Candy Guard');
  }

  const { startDate, endDate } = allowGroup.guards;
  if (!isSome(startDate) || !isSome(endDate)) {
    throw new Error("AllowList guard missing startDate or endDate");
  }

  // Compute new window: oldEnd → oldEnd + 7 days
  const oldEnd   = new Date(Number(endDate.value.date) * 1_000);
  const newStart = oldEnd;
  const newEnd   = new Date(oldEnd.getTime() + 7 * 24 * 60 * 60 * 1_000);
  console.log(`[update] Extending window: ${newStart.toISOString()} → ${newEnd.toISOString()}`);

  // Update Candy Guard: preserve global guards (empty {}), override only the “LFG” group
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

  console.log("✅ [update] Candy Guard window extended & Me rkle root updated");
}
