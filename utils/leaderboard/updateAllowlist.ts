// utils/leaderboard/updateAllowlist.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  publicKey,
  keypairIdentity,
  some,
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

// — Supabase client (anon key sufficient for read) —
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// — UMI + Candy Machine setup —
const umi: Umi = createUmi(process.env.NEXT_PUBLIC_RPC!).use(
  mplCoreCandyMachine()
);

// Load deploy keypair from raw JSON in env…
if (!process.env.DEPLOY_KEYPAIR) throw new Error("Missing DEPLOY_KEYPAIR");
const deployBytes = new Uint8Array(JSON.parse(process.env.DEPLOY_KEYPAIR) as number[]);
const deployKP = umi.eddsa.createKeypairFromSecretKey(deployBytes);
umi.use(keypairIdentity(deployKP));

// 1) Fetch Top-10 from Supabase
async function getTop10Wallets(): Promise<string[]> {
  const { data, error } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data!.map((r) => r.wallet_address);
}

export async function updateAllowlistGuard(): Promise<void> {
  console.log("🔍 [update] Fetching top-10 from Supabase…");
  const top10 = await getTop10Wallets();
  console.log("   → top10:", top10);

  // 2) On-chain: fetch CM & guard
  const cm = await fetchCandyMachine(
    umi,
    publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!)
  );
  const guardAddr = cm.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // 3) Find the "LFG" group
  const label = "LFG";
  const existingGroup = guardData.groups.find((g) => g.label === label);
  if (!existingGroup) throw new Error('No "LFG" group on Candy Guard');

  // 4) Merge top10 into in-memory allowLists
  const merged = Array.from(
    new Set([...(allowLists.get(label) || []), ...top10])
  );
  allowLists.set(label, merged);
  console.log(`🔀 [update] allowLists["${label}"] =`, merged);

  // 5) Compute new Merkle root
  const merkleRoot = getMerkleRoot(merged);
  console.log(
    "🌿 [update] Merkle root (base64):",
    Buffer.from(merkleRoot).toString("base64")
  );

  // 6) Build a new groups array: replace only LFG, keep everyone else intact
  const newGroups = guardData.groups.map((g) =>
    g.label === label
      ? {
          label,
          guards: {
            // preserve existing guard types if you have them:
            // startDate: existingGroup.guards.startDate,
            // endDate:   existingGroup.guards.endDate,
            allowList: some({ merkleRoot }),
            mintLimit: some({ id: 1, limit: 1 }),
          },
        }
      : g
  );

  // 7) Send the on-chain update
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},     // leave any global guards untouched
    groups: newGroups,
  }).sendAndConfirm(umi);

  console.log("✅ [update] on-chain allowList & mintLimit updated");
}
