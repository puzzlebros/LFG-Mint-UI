// utils/leaderboard/updateAllowlist.ts
import "dotenv/config";
import fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  publicKey,
  keypairIdentity,
  some,
  sol,
  dateTime,
  isSome,
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
import { clearLeaderboard } from "./clearLeaderboard";

// — Supabase clients —
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase env vars in .env");
  process.exit(1);
}
const supabase:      SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// — UMI & Candy Machine setup —
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
const CM_PUBKEY    = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!;
if (!CM_PUBKEY) throw new Error("Missing NEXT_PUBLIC_CANDY_MACHINE_ID");

const umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// deploy authority
const walletPath  = process.env.DEPLOY_KEYPAIR!;
const walletBytes = JSON.parse(fs.readFileSync(walletPath, "utf-8")) as number[];
const walletKP    = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(walletBytes));
umi.use(keypairIdentity(walletKP));

// treasury
const treasuryPath   = process.env.TREASURY_KEYPAIR!;
const treasuryBytes  = JSON.parse(fs.readFileSync(treasuryPath, "utf-8")) as number[];
const treasuryKP     = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(treasuryBytes));

// fetch top 10
async function getTop10Wallets(): Promise<string[]> {
  const { data, error } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data?.map(r => r.wallet_address) ?? [];
}

// main
export async function updateAllowlistGuard(): Promise<void> {
  console.log("🔍 Fetching top-10 leaderboard wallets…");
  const top10 = await getTop10Wallets();
  console.log("   →", top10);

  // merge into in-memory map
  const existing = allowLists.get("allowlist") ?? [];
  const merged   = Array.from(new Set([...existing, ...top10]));
  allowLists.set("allowlist", merged);
  console.log("🔀 allowlist merged:", merged);

  // merkle root
  const merkleRoot = getMerkleRoot(merged);
  console.log("🌿 Merkle root:", merkleRoot.toString());

  // fetch on-chain
  console.log("📡 Fetching Candy Machine & Guard…");
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // locate group
  const allowGroup = guardData.groups.find(g => g.label === "LFG");
  if (!allowGroup) throw new Error('No "LFG" group on Candy Guard');

  const { startDate, endDate } = allowGroup.guards;
  if (!isSome(startDate) || !isSome(endDate)) {
    throw new Error("Allowlist guard missing startDate or endDate");
  }

  // compute new window
  const oldEnd  = new Date(Number(endDate.value.date) * 1_000);
  const newStart = oldEnd;
  const newEnd   = new Date(oldEnd.getTime() + 7 * 24 * 60 * 60 * 1_000);
  console.log(`🔧 Extending window to ${newStart.toISOString()} → ${newEnd.toISOString()}`);

  // update Candy Guard
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: { botTax: some({ lamports: sol(0.001), lastInstruction: true }) },
    groups: [{
      label: "allowlist",
      guards: {
        solPayment: some({ lamports: sol(0.1), destination: treasuryKP.publicKey }),
        startDate:  some({ date: dateTime(newStart.toISOString()) }),
        endDate:    some({ date: dateTime(newEnd.toISOString()) }),
        allowList:  some({ merkleRoot }),
        mintLimit:  some({ id: 1, limit: 1 }),
      },
    }],
  }).sendAndConfirm(umi);
  console.log("✅ Candy Guard window extended & root updated");

  // only *now* clear the Supabase leaderboard
  await clearLeaderboard();
}
