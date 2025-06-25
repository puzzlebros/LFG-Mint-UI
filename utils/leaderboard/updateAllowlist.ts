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

// — Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// — UMI + Candy Machine plugin
const umi: Umi = createUmi(process.env.NEXT_PUBLIC_RPC!).use(
  mplCoreCandyMachine()
);

// load your deploy keypair
if (!process.env.DEPLOY_KEYPAIR) throw new Error("Missing DEPLOY_KEYPAIR");
const deployBytes = new Uint8Array(
  JSON.parse(process.env.DEPLOY_KEYPAIR) as number[]
);
const deployKP = umi.eddsa.createKeypairFromSecretKey(deployBytes);
umi.use(keypairIdentity(deployKP));

// 1) pull top-10 wallets from leaderboard
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

  // 2) fetch on‐chain candy machine + guard PDA
  const cm = await fetchCandyMachine(
    umi,
    publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!)
  );
  const guardAddr = cm.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // 3) verify your “LFG” group exists
  const label = "LFG";
  if (!guardData.groups.some((g) => g.label === label)) {
    throw new Error('No "LFG" group found on Candy Guard');
  }

  // 4) **build your PublicKey[] once** and use it for both root & proofs
  const keys = top10.map((addr) => publicKey(addr));
  const merkleRoot = getMerkleRoot(keys);
  console.log(
    "🌿 [update] New Merkle root (base64):",
    Buffer.from(merkleRoot).toString("base64")
  );

  // 5) only patch the LFG entry, leave all other groups untouched
  const newGroups = guardData.groups.map((g) =>
    g.label === label
      ? {
          label,
          guards: {
            // two guards: allowList + single-claim
            allowList: some({ merkleRoot }),
            mintLimit: some({ id: 1, limit: 1 }),
          },
        }
      : g
  );

  // 6) write the new merkleRoot on-chain
  console.log("🔔 [update] Sending updated Candy Guard groups on-chain…");
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},       // leave global/default guards alone
    groups: newGroups // full array
  })
    .sendAndConfirm(umi)
    .then(() => console.log("✅ Candy Guard groups updated"));

  // 7) now seed one PDA‐proof per top-10 wallet *under the LFG group*
  console.log("🌱 [cron] Seeding allowList proofs on-chain…");
  for (const userPk of keys) {
    const merkleProof = getMerkleProof(keys, userPk);

    await route(umi, {
      guard:        "allowList",
      candyMachine: cm.publicKey,
      candyGuard:   guardAddr,
      group:        some(label),    // <-- must match your LFG group
      routeArgs:    {
        path:        "proof",
        merkleRoot,
        merkleProof,
      },
    })
      .sendAndConfirm(umi)
      .then(() => console.log(`  • proof seeded for ${userPk.toString()}`))
      .catch((err) => {
        console.error(`  ✗ failed seeding proof for ${userPk.toString()}`, err);
        throw err;
      });
  }

  console.log("✅ All allowList PDAs seeded");
}
