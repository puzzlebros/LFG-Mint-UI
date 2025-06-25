import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { publicKey, keypairIdentity, some, none, Umi } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  mplCandyMachine as mplCoreCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  updateCandyGuard,
  getMerkleRoot,
  route,
  getMerkleProof
} from "@metaplex-foundation/mpl-core-candy-machine";
import type { LeaderboardEntry } from "@/types/leaderboard";

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
const deployBytes = new Uint8Array(
  JSON.parse(process.env.DEPLOY_KEYPAIR) as number[]
);
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

  // 2) On-chain: fetch Candy Machine & its guard
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

  // 4) Build new allowlist: use exactly the current top-10
  const merged = top10;
  console.log(`🔀 [update] allowLists["${label}"] set to current top-10:`, merged);

  // 5) Compute new Merkle root
  const merkleRoot = getMerkleRoot(merged);
  console.log(
    "🌿 [update] New Merkle root (base64):",
    Buffer.from(merkleRoot).toString("base64")
  );

  // 6) Build updated groups array: replace only the LFG group
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

  // 7) Send the on-chain update
  console.log("🔔 [update] Sending updated Candy Guard groups on-chain...");
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},    // leave global unchanged
    groups: newGroups,
  })
    .sendAndConfirm(umi)
    .then(() => console.log("✅ On-chain allowList & mintLimit updated"));

  // 8) Seed on-chain PDA proofs for every top-10 wallet
  console.log("🌱 [cron] Seeding allowList proofs on-chain…");
  const keys = merged.map((addr) => publicKey(addr));
  for (const wallet of merged) {
    const userPk      = publicKey(wallet);
    const merkleProof = getMerkleProof(keys, userPk);

    await route(umi, {
      guard:        "allowList",
      candyMachine: cm.publicKey,
      candyGuard:   guardAddr,
      group:        none(),
      routeArgs:    {
        path:        "proof",
        merkleRoot,
        merkleProof,
      },
    })
      .sendAndConfirm(umi);
  }
  console.log("✅ All allowList PDAs seeded");
}
