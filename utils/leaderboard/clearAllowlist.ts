// utils/leaderboard/clearAllowlist.ts

import "dotenv/config";
import {
  createClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  publicKey,
  keypairIdentity,
  some,
  dateTime,
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
import { clearLeaderboard } from "./clearLeaderboard";

// — Supabase admin client (for DELETE)
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}
const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// — UMI & Candy Machine setup —
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
const CM_PUBKEY    = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!;
if (!CM_PUBKEY) {
  throw new Error("Missing NEXT_PUBLIC_CANDY_MACHINE_ID");
}
const umi: Umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// ── Load deploy keypair from raw JSON in env ──
const rawDeploy = process.env.DEPLOY_KEYPAIR;
if (!rawDeploy) {
  console.error("❌ Missing DEPLOY_KEYPAIR environment variable");
  process.exit(1);
}
let deployBytes: Uint8Array;
try {
  const arr: number[] = JSON.parse(rawDeploy);
  deployBytes = new Uint8Array(arr);
} catch (e) {
  console.error("❌ DEPLOY_KEYPAIR is not valid JSON array:", e);
  process.exit(1);
}
const deployKeypair = umi.eddsa.createKeypairFromSecretKey(deployBytes);
umi.use(keypairIdentity(deployKeypair));

// ── Load treasury keypair from raw JSON in env ──
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
// (If you don’t actually need treasuryKeypair here, you can simply parse it and ignore it.)

/**
 * clearAllowlistGuard:
 *   1) Fetch on-chain Candy Guard, find “LFG” group
 *   2) Overwrite its allowList to an empty Merkle root
 *   3) Set startDate=1970, endDate=now (to expire the guard)
 *   4) Clear the Supabase “leaderboard” table
 */
export async function clearAllowlistGuard(): Promise<void> {
  console.log("🔍 [clear] Fetching Candy Machine & Candy Guard…");
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // 1) Locate the “LFG” group
  const allowGroup = guardData.groups.find((g) => g.label === "LFG");
  if (!allowGroup) {
    throw new Error('No "LFG" group found on Candy Guard');
  }

  // 2) Compute an “empty” Merkle root → nobody can mint
  const emptyRoot = getMerkleRoot([]);

  // 3) Expire window immediately: epoch → now
  const epochISO = new Date(0).toISOString();  // 1970-01-01T00:00:00.000Z
  const nowISO   = new Date().toISOString();   // “right now”
  console.log(`[clear] Expiring guard window ${epochISO} → ${nowISO}, clearing allowList`);

  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},
    groups: [
      {
        label: "LFG",
        guards: {
          startDate: some({ date: dateTime(epochISO) }),
          endDate:   some({ date: dateTime(nowISO) }),
          allowList: some({ merkleRoot: emptyRoot }),
          // If you want to preserve mintLimit or botTax, re-include them here:
          // mintLimit: some({ id: 1, limit: 1 }),
        },
      },
    ],
  }).sendAndConfirm(umi);

  console.log("✅ [clear] On-chain allowList cleared & window expired");

  // 4) Clear all rows from Supabase “leaderboard”
  console.log("🗑 [clear] Deleting all rows from Supabase leaderboard…");
  const deletedCount = await clearLeaderboard();
  console.log(`✅ [clear] Supabase leaderboard cleared (${deletedCount} rows)`);
}
