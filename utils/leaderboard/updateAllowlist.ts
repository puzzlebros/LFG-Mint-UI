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
  
  // Fetch the top 10 wallets from the leaderboard
  const top10 = await getTop10Wallets();

  // Handle the case where there are fewer than 10 wallets
  if (top10.length === 0) {
    console.log("No wallets found in the leaderboard.");
    return;  // Early return if there are no wallets
  }
  
  if (top10.length < 10) {
    console.log(`Fewer than 10 wallets found. Top ${top10.length} wallets will be used.`);
  }

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
  if (!existingGroup) {
    throw new Error('No "LFG" group on Candy Guard');
  }

  // 4) Use the leaderboard top-10 to generate a Merkle root
  const merged = top10;  // Merge the leaderboard wallets
  console.log(`🔀 [update] Updated allowlist with top-10 wallets:`, merged);

  // 5) Compute new Merkle root
  const merkleRoot = getMerkleRoot(merged);
  console.log(
    "🌿 [update] New Merkle root (base64):",
    Buffer.from(merkleRoot).toString("base64")
  );

  const now = Math.floor(Date.now() / 1000);
  const oneWeek = 7 * 24 * 60 * 60;
  const windowId = Math.floor(now / oneWeek) % 256;

  // 6) Build updated groups array: replace only the LFG group, keep others intact
  const newGroups = guardData.groups.map((g) =>
    g.label === label
      ? {
          label,
          guards: {
            allowList: some({ merkleRoot }),
            mintLimit: some({ id: windowId, limit: 1 }), // Ensure the mint limit stays as desired
          },
        }
      : g
  );

  // 7) Send the on-chain update
  console.log("🔔 [update] Sending updated Candy Guard groups on-chain...");
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {}, // leave global guards unchanged
    groups: newGroups,
  })
    .sendAndConfirm(umi)
    .then(() => {
      console.log("✅ On-chain allowList & mintLimit updated");
    })
    .catch((err) => {
      console.error("❌ Failed to update Candy Guard on-chain:", err);
      throw err;
    });
}
