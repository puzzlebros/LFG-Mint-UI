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

// — Supabase admin client —
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}
const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// — UMI & Candy Machine setup — same as update
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
const CM_PUBKEY    = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!;
if (!CM_PUBKEY) {
  throw new Error("Missing NEXT_PUBLIC_CANDY_MACHINE_ID");
}
const umi: Umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// Load DEPLOY keypair from base64 env (just like updateAllowlist)
const deployKeypairJsonBase64 = process.env.DEPLOY_KEYPAIR!;
const deployKeypairBytes = Uint8Array.from(
  JSON.parse(Buffer.from(deployKeypairJsonBase64, "base64").toString("utf-8"))
);
const deployKeypair = umi.eddsa.createKeypairFromSecretKey(deployKeypairBytes);
umi.use(keypairIdentity(deployKeypair));

// Load TREASURY if needed
const treasuryKeypairJsonBase64 = process.env.TREASURY_KEYPAIR!;
const treasuryKeypairBytes      = Uint8Array.from(
  JSON.parse(Buffer.from(treasuryKeypairJsonBase64, "base64").toString("utf-8"))
);
const treasuryKeypair = umi.eddsa.createKeypairFromSecretKey(treasuryKeypairBytes);
// (If you don’t use treasuryKeypair in this file, you can omit it.)

/**
 * clearAllowlistGuard:
 *   1) Overwrite on-chain “LFG” group to an empty Merkle root (nobody can mint)
 *   2) Set startDate = epoch, endDate = now → guard window expired
 *   3) Clear Supabase “leaderboard” table
 */
export async function clearAllowlistGuard(): Promise<void> {
  console.log("🔍 [clear] Fetching Candy Machine & Candy Guard…");
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // Find the “LFG” group
  const allowGroup = guardData.groups.find((g) => g.label === "LFG");
  if (!allowGroup) {
    throw new Error('No "LFG" group on Candy Guard');
  }

  // Build a Merkle root of an empty array
  const emptyRoot = getMerkleRoot([]);

  // Expire window: startDate=epoch, endDate=now
  const epochISO = new Date(0).toISOString();
  const nowISO   = new Date().toISOString();
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
          // If you want to keep mintLimit or botTax, re‐apply it here.
          // mintLimit: some({ id: 1, limit: 1 }),
        },
      },
    ],
  }).sendAndConfirm(umi);

  console.log("✅ [clear] On-chain allowList cleared & expired");

  // Now delete all rows from Supabase “leaderboard”
  console.log("🗑 [clear] Deleting all rows from Supabase leaderboard…");
  const deletedCount = await clearLeaderboard();
  console.log(`✅ [clear] Supabase leaderboard cleared (${deletedCount} rows deleted)`);
}
