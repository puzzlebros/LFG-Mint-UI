// utils/leaderboard/updateAllowlist.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  publicKey,
  keypairIdentity,
  some,
  none,
  Umi,
} from "@metaplex-foundation/umi";
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

// — Supabase client (anon key is fine for reads) —
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// — UMI + Candy Machine setup —
const umi: Umi = createUmi(process.env.NEXT_PUBLIC_RPC!).use(
  mplCoreCandyMachine()
);

// Load the deploy keypair from JSON in env…
if (!process.env.DEPLOY_KEYPAIR) {
  throw new Error("Missing DEPLOY_KEYPAIR");
}
const deployBytes = new Uint8Array(
  JSON.parse(process.env.DEPLOY_KEYPAIR) as number[]
);
const deployKP = umi.eddsa.createKeypairFromSecretKey(deployBytes);
umi.use(keypairIdentity(deployKP));

// 1) Fetch Top-10 wallets from Supabase
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

  // 2) Fetch on-chain Candy Machine & Guard
  const cm = await fetchCandyMachine(
    umi,
    publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!)
  );
  const guardAddr = cm.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // 3) Make sure we actually have an "LFG" group
  const label = "LFG";
  if (!guardData.groups.find((g) => g.label === label)) {
    throw new Error('No "LFG" group found on Candy Guard');
  }

  // 4) Compute the new Merkle root over exactly those top-10
  console.log(`🔀 [update] Setting allowList to exactly top-10`);
  const merkleRoot = getMerkleRoot(top10);
  console.log(
    "🌿 [update] New Merkle root (base64):",
    Buffer.from(merkleRoot).toString("base64")
  );

  // 5) Patch only the LFG entry, keep all others intact
  const newGroups = guardData.groups.map((g) =>
    g.label === label
      ? {
          label,
          guards: {
            // only these two guards for "LFG"
            allowList: some({ merkleRoot }),
            mintLimit: some({ id: 1, limit: 1 }),
          },
        }
      : g
  );

  // 6) Push the update on-chain
  console.log("🔔 [update] Sending updated Candy Guard groups on-chain…");
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},        // leave global/default guards untouched
    groups: newGroups, // full list: only LFG has changed
  })
    .sendAndConfirm(umi)
    .then(() => console.log("✅ Candy Guard groups updated"));

  // 7) Seed the PDA proofs *into the LFG group* so users can’t fake it
  console.log("🌱 [cron] Seeding allowList proofs on-chain for each top-10…");
  const keys = top10.map((addr) => publicKey(addr));

  for (const wallet of top10) {
    const userPk      = publicKey(wallet);
    const merkleProof = getMerkleProof(keys, userPk);

    await route(umi, {
      guard:        "allowList",
      candyMachine: cm.publicKey,
      candyGuard:   guardAddr,
      group:        some(label),    // <— key change here!
      routeArgs: {
        path:        "proof",
        merkleRoot,
        merkleProof,
      },
    })
      .sendAndConfirm(umi)
      .then(() => console.log(`  • PDA proof seeded for ${wallet}`))
      .catch((err) => {
        console.error(`  ✗ failed seeding proof for ${wallet}`, err);
        throw err;
      });
  }
  console.log("✅ All allowList PDAs seeded");
}
