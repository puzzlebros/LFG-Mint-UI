// utils/leaderboard/clearAllowlist.ts

import "dotenv/config";
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

// — UMI & Candy Machine setup —
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC
  ?? (() => { throw new Error("Missing NEXT_PUBLIC_RPC"); })();

const CM_PUBKEY = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID
  ?? (() => { throw new Error("Missing NEXT_PUBLIC_CANDY_MACHINE_ID"); })();

const umi: Umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// ── Load deploy keypair from raw JSON in env ──
if (!process.env.DEPLOY_KEYPAIR) {
  throw new Error("Missing DEPLOY_KEYPAIR environment variable");
}
let deployBytes: Uint8Array;
try {
  const arr = JSON.parse(process.env.DEPLOY_KEYPAIR) as number[];
  deployBytes = new Uint8Array(arr);
} catch {
  throw new Error("DEPLOY_KEYPAIR is not valid JSON array");
}
const deployKeypair = umi.eddsa.createKeypairFromSecretKey(deployBytes);
umi.use(keypairIdentity(deployKeypair));

// ── Load treasury keypair from raw JSON in env ──
if (!process.env.TREASURY_KEYPAIR) {
  throw new Error("Missing TREASURY_KEYPAIR environment variable");
}
let treasuryBytes: Uint8Array;
try {
  const arr = JSON.parse(process.env.TREASURY_KEYPAIR) as number[];
  treasuryBytes = new Uint8Array(arr);
} catch {
  throw new Error("TREASURY_KEYPAIR is not valid JSON array");
}
const treasuryKeypair = umi.eddsa.createKeypairFromSecretKey(treasuryBytes);

// ────────────────────────────────────────────────
/**
 * clearAllowlistGuard:
 *   1) Fetch on‐chain Candy Guard, find “LFG” group
 *   2) Overwrite its allowList to an empty Merkle root
 *   3) Set startDate = UNIX epoch, endDate = now → expired
 *   4) Clear the Supabase “leaderboard” table
 */
export async function clearAllowlistGuard(): Promise<void> {
  console.log("🔍 [clear] Fetching Candy Machine & Candy Guard…");
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  const allowGroup = guardData.groups.find(g => g.label === "LFG");
  if (!allowGroup) {
    throw new Error('No "LFG" group found on Candy Guard');
  }

  // 2) Empty Merkle root
  const emptyRoot = getMerkleRoot([]);
  const emptyHex  = Buffer.from(emptyRoot).toString("hex");
  console.log("🌑 [clear] Empty Merkle root (hex):", emptyHex);

  // 3) Expire window: epoch → now
  // const epochISO = new Date(0).toISOString();
  // const nowISO   = new Date().toISOString();
  // console.log(`[clear] Expiring guard window ${epochISO} → ${nowISO}`);

  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,
    guards: {},
    groups: [
      {
        label: "LFG",
        guards: {
          // startDate: some({ date: dateTime(epochISO) }),
          // endDate:   some({ date: dateTime(nowISO) }),
          allowList: some({ merkleRoot: emptyRoot }),
          // mintLimit: some({ id: 1, limit: 1 }), // re-enable if desired
        },
      },
    ],
  }).sendAndConfirm(umi);

  console.log("✅ [clear] On‐chain allowList cleared & expired");

  // 4) Clear Supabase leaderboard
  console.log("🗑 [clear] Clearing Supabase leaderboard…");
  const deletedCount = await clearLeaderboard();
  console.log(`✅ [clear] ${deletedCount} leaderboard rows deleted`);
}
