// utils/leaderboard/updateAllowlist.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { publicKey, keypairIdentity, some, Umi } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  mplCandyMachine as mplCoreCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  updateCandyGuard,
  getMerkleRoot,
  route,
  getMerkleProof,
} from "@metaplex-foundation/mpl-core-candy-machine";
import type { LeaderboardEntry } from "@/types/leaderboard";

// — Supabase client —
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// — UMI + mpl-CandyMachine plugin —
const umi: Umi = createUmi(process.env.NEXT_PUBLIC_RPC!).use(
  mplCoreCandyMachine()
);

// Load deploy keypair
if (!process.env.DEPLOY_KEYPAIR) throw new Error("Missing DEPLOY_KEYPAIR");
const deployBytes = new Uint8Array(
  JSON.parse(process.env.DEPLOY_KEYPAIR) as number[]
);
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(deployBytes)));

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

  // 1) fetch on-chain candy machine and its guard
  const cm = await fetchCandyMachine(
    umi,
    publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!)
  );
  const guardAddr = cm.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // 2) make sure “LFG” exists
  const label = "LFG";
  if (!guardData.groups.find((g) => g.label === label)) {
    throw new Error(`Missing required group label "${label}"`);
  }

  // 3) build leaves in the Supabase order (no sorting!)
  const keys = top10.map((w) => publicKey(w));
  console.log("▶︎ Using leaves:", keys.map((k) => k.toString()));

  // 4) compute and upload the new Merkle root
  const merkleRoot = getMerkleRoot(keys);
  console.log(
    "🌿 [update] New Merkle root (base64):",
    Buffer.from(merkleRoot).toString("base64")
  );

  const newGroups = guardData.groups.map((g) =>
    g.label === label
      ? {
          label,
          guards: {
            allowList: some({ merkleRoot }),
            mintLimit: some({ id: 1, limit: 1 }),
          },
        }
      : g
  );

  console.log("🔔 [update] Sending updated Candy Guard groups…");
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},     // leave defaults untouched
    groups: newGroups,
  }).sendAndConfirm(umi);
  console.log("✅ Candy Guard groups updated");

  // 5) seed every PDA proof against the same-unsorted array
  console.log("🌱 [cron] Seeding allowList PDA proofs…");
  for (const userPk of keys) {
    const proof = getMerkleProof(keys, userPk);
    await route(umi, {
      guard: "allowList",
      candyMachine: cm.publicKey,
      candyGuard: guardAddr,
      group: some(label),
      routeArgs: {
        path: "proof",
        merkleRoot,
        merkleProof: proof,
      },
    }).sendAndConfirm(umi);
    console.log(`  • Proof seeded for ${userPk.toString()}`);
  }
  console.log("✅ All allowList PDA proofs seeded");
}
