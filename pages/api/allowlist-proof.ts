// pages/api/allowlist-proof.ts
//
// Creates the AllowListProof PDA for a user wallet using the admin deploy
// keypair as payer.  Because Phantom / Lighthouse is never involved, the
// route tx goes straight to the RPC with no preflight interference.
//
import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/leaderboard/supabaseClient";
import type { LeaderboardEntry } from "@/types/leaderboard";
import {
  publicKey,
  keypairIdentity,
  some,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  mplCandyMachine as mplCoreCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  getMerkleRoot,
  getMerkleProof,
  route,
  safeFetchAllowListProofFromSeeds,
} from "@metaplex-foundation/mpl-core-candy-machine";

async function getTop10Wallets(): Promise<string[]> {
  const { data, error } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data!.map((r) => r.wallet_address);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet } = req.body as { wallet?: string };
  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet" });
  }

  try {
    // Set up Umi with the admin deploy keypair as identity/payer
    const umi = createUmi(process.env.NEXT_PUBLIC_RPC!).use(
      mplCoreCandyMachine()
    );
    if (!process.env.DEPLOY_KEYPAIR) throw new Error("Missing DEPLOY_KEYPAIR");
    const deployBytes = new Uint8Array(
      JSON.parse(process.env.DEPLOY_KEYPAIR) as number[]
    );
    const deployKP = umi.eddsa.createKeypairFromSecretKey(deployBytes);
    umi.use(keypairIdentity(deployKP));

    // Fetch Candy Machine + Guard on-chain
    const cm = await fetchCandyMachine(
      umi,
      publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID!)
    );
    const candyGuard = await fetchCandyGuard(umi, cm.mintAuthority);

    // Find the LFG group
    const group = candyGuard.groups.find((g) => g.label === "LFG");
    if (!group) {
      return res.status(400).json({ error: "LFG group not found on Candy Guard" });
    }
    if (group.guards.allowList.__option !== "Some") {
      return res.status(400).json({ error: "AllowList guard is not active" });
    }

    const merkleRoot = group.guards.allowList.value.merkleRoot;

    // Fetch current top-10 from Supabase (source of truth for the allowlist)
    const top10 = await getTop10Wallets();

    if (!top10.includes(wallet)) {
      return res.status(403).json({ error: "Wallet is not on the current allowlist" });
    }

    // Verify cached leaderboard matches the on-chain Merkle root
    const computedRoot = getMerkleRoot(top10);
    const rootsMatch =
      merkleRoot.length === computedRoot.length &&
      merkleRoot.every((b, i) => b === computedRoot[i]);

    if (!rootsMatch) {
      console.error(
        "[allowlist-proof] Merkle root mismatch — on-chain root doesn't match Supabase leaderboard"
      );
      return res.status(409).json({
        error: "Allowlist Merkle root mismatch. The weekly cron may not have run yet.",
      });
    }

    const userPubKey = publicKey(wallet);

    // Check if the proof PDA already exists (idempotent)
    const existing = await safeFetchAllowListProofFromSeeds(umi, {
      candyGuard: cm.mintAuthority,
      candyMachine: cm.publicKey,
      merkleRoot,
      user: userPubKey,
    });

    if (existing !== null) {
      console.log(`[allowlist-proof] proof already exists for ${wallet}`);
      return res.status(200).json({ success: true, alreadyExists: true });
    }

    // Build and send route tx — admin keypair pays, PDA is created for the user
    await route(umi, {
      guard: "allowList",
      candyMachine: cm.publicKey,
      candyGuard: cm.mintAuthority,
      group: some("LFG"),
      routeArgs: {
        path: "proof",
        merkleRoot,
        merkleProof: getMerkleProof(top10, wallet),
        minter: userPubKey, // PDA is derived for user, not the deploy keypair
      },
    }).sendAndConfirm(umi, {
      confirm: { commitment: "confirmed" },
    });

    console.log(`[allowlist-proof] proof created for ${wallet}`);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("[allowlist-proof] error:", err);
    return res.status(500).json({ error: err?.message ?? "Internal server error" });
  }
}
