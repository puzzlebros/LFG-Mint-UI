import {
  publicKey,
  keypairIdentity,
  some,
  dateTime,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  mplCandyMachine as mplCoreCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  updateCandyGuard,
  getMerkleRoot,
} from "@metaplex-foundation/mpl-core-candy-machine";
import fs from "fs";
import { clearLeaderboard } from "./clearLeaderboard";

// … (Supabase client setup omitted for brevity)

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC!;
const CM_PUBKEY    = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!;
const umi = createUmi(RPC_ENDPOINT).use(mplCoreCandyMachine());

// deploy authority
const walletPath  = process.env.DEPLOY_KEYPAIR!;
const walletBytes = JSON.parse(fs.readFileSync(walletPath, "utf-8")) as number[];
const walletKP    = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(walletBytes));
umi.use(keypairIdentity(walletKP));

export async function clearAllowlistGuard(): Promise<void> {
  // 1) Fetch on‐chain Candy Machine & Candy Guard
  const cmData    = await fetchCandyMachine(umi, publicKey(CM_PUBKEY));
  const guardAddr = cmData.mintAuthority;
  const guardData = await fetchCandyGuard(umi, guardAddr);

  // 2) Find the "LFG" group
  const allowGroup = guardData.groups.find(g => g.label === "LFG");
  if (!allowGroup) throw new Error('No "LFG" group on Candy Guard');

  // 3) Build an empty Merkle root (i.e. allowList = [])
  const emptyRoot = getMerkleRoot([]);

  // 4) Compute epoch & now for expiring the guard window
  const epochISO = new Date(0).toISOString();    // 1970-01-01T00:00:00.000Z
  const nowISO   = new Date().toISOString();     // right now

  console.log(
    `🔧 Clearing allowList and expiring window: ${epochISO} → ${nowISO}`
  );

  // 5) Call updateCandyGuard with BOTH “guards” and “groups”
  await updateCandyGuard(umi, {
    candyGuard: guardData.publicKey,

    // If you do not want to change any of the top‐level (global) guards, pass an empty object:
    guards: {},

    // Now override only the "LFG" group:
    groups: [
      {
        label: "LFG",
        guards: {
          startDate: some({ date: dateTime(epochISO) }),
          endDate:   some({ date: dateTime(nowISO) }),
          allowList: some({ merkleRoot: emptyRoot }),
          // If you also want to preserve mintLimit or botTax, you could re‐include them here:
          // mintLimit: some({ id: 1, limit: 1 }),
        },
      },
    ],
  }).sendAndConfirm(umi);

  console.log("✅ On‐chain allowList cleared.");

  // 6) Finally, clear your Supabase leaderboard rows
  const deleted = await clearLeaderboard();
  console.log(`✅ Supabase leaderboard cleared (${deleted} rows deleted).`);
}
