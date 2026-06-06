// pages/api/phantom-route-proof.ts
// Submits the Candy Machine allowList route (proof) transaction server-side so
// Phantom's Lighthouse never sees it. The proof PDA is keyed to the user's wallet
// via the `minter` param — the server keypair is only the fee-payer/signer.
//
// Auth: same timestamped challenge pattern as adminMint — the client signs
// `lfg-route-proof:<walletAddress>:<timestamp>` with their wallet, proving ownership
// before the server spends lamports on their behalf.

import type { NextApiRequest, NextApiResponse } from "next";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  publicKey,
  some,
  none,
} from "@metaplex-foundation/umi";
import {
  mplCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  route,
  getMerkleProof,
  safeFetchAllowListProofFromSeeds,
} from "@metaplex-foundation/mpl-core-candy-machine";
import { base58 } from "@metaplex-foundation/umi/serializers";
import nacl from "tweetnacl";
import { PublicKey as Web3PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import type { LeaderboardEntry } from "@/types/leaderboard";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Ok  = { success: true; alreadyExists: boolean };
type Err = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rpc   = process.env.NEXT_PUBLIC_RPC;
  const cmId  = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID;
  const kpRaw = process.env.DEPLOY_KEYPAIR;

  if (!rpc || !cmId || !kpRaw) {
    return res.status(500).json({ error: "Server misconfiguration: missing env vars" });
  }

  const { walletAddress, guardLabel, timestamp, signature } = req.body as {
    walletAddress?: string;
    guardLabel?: string;
    timestamp?: number;
    signature?: string;
  };

  if (!walletAddress || !guardLabel || !timestamp || !signature) {
    return res.status(400).json({ error: "walletAddress, guardLabel, timestamp and signature are required" });
  }

  // 1) Timestamp within 60 s — prevents replay
  if (Math.abs(Date.now() - timestamp) > 60_000) {
    return res.status(403).json({ error: "Challenge expired" });
  }

  // 2) Verify the wallet's ed25519 signature — proves the caller owns the wallet
  try {
    const message  = new TextEncoder().encode(`lfg-route-proof:${walletAddress}:${timestamp}`);
    const sigBytes = base58.serialize(signature);
    const pkBytes  = new Web3PublicKey(walletAddress).toBytes();
    if (!nacl.sign.detached.verify(message, sigBytes, pkBytes)) {
      return res.status(403).json({ error: "Invalid signature" });
    }
  } catch {
    return res.status(403).json({ error: "Signature verification failed" });
  }

  // 3) Fetch the real allowlist from Supabase (real wallets only — no fakes)
  const { data: leaderboard, error: dbError } = await supabase
    .from<"leaderboard", LeaderboardEntry>("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);

  if (dbError || !leaderboard) {
    return res.status(500).json({ error: "Failed to fetch allowlist" });
  }

  const allowlist = leaderboard.map((r) => r.wallet_address);

  if (!allowlist.includes(walletAddress)) {
    return res.status(403).json({ error: "Wallet is not in the allowlist" });
  }

  // 4) Set up UMI with server keypair as payer/signer
  const ACTUAL_CANDY_GUARD_ID = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95";
  const umi = createUmi(rpc).use(mplCandyMachine()).use({
    install(u) {
      const existing = u.programs.get("mplCoreCandyGuard");
      u.programs.add({ ...existing, publicKey: publicKey(ACTUAL_CANDY_GUARD_ID) }, true);
    },
  });
  const keypairBytes = new Uint8Array(JSON.parse(kpRaw) as number[]);
  const serverKP = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
  umi.use(keypairIdentity(serverKP));

  try {
    const cm = await fetchCandyMachine(umi, publicKey(cmId));
    const cg = await fetchCandyGuard(umi, cm.mintAuthority);

    const group = cg.groups.find((g) => g.label === guardLabel);
    const guardToUse = group ?? { label: "default", guards: cg.guards };

    if (guardToUse.guards.allowList.__option !== "Some") {
      return res.status(400).json({ error: "No allowList guard on this group" });
    }

    const merkleRoot  = guardToUse.guards.allowList.value.merkleRoot;
    const userPubkey  = publicKey(walletAddress);

    // 5) Check if proof PDA already exists for this user — skip if so
    const existing = await safeFetchAllowListProofFromSeeds(umi, {
      candyGuard:   cm.mintAuthority,
      candyMachine: cm.publicKey,
      merkleRoot,
      user:         userPubkey,
    });

    if (existing !== null) {
      return res.status(200).json({ success: true, alreadyExists: true });
    }

    // 6) Submit the route transaction:
    //    - server keypair = payer/signer  → Lighthouse never sees this tx
    //    - minter = user's wallet         → proof PDA is keyed to the user
    const merkleProof = getMerkleProof(allowlist, walletAddress);

    await route(umi, {
      guard:        "allowList",
      candyMachine: cm.publicKey,
      candyGuard:   cg.publicKey,
      group:        guardLabel === "default" ? none() : some(guardLabel),
      routeArgs: {
        path:        "proof",
        merkleRoot,
        merkleProof,
        minter:      userPubkey,
      },
    }).sendAndConfirm(umi, {
      send:    { skipPreflight: true },
      confirm: { commitment: "confirmed" },
    });

    return res.status(200).json({ success: true, alreadyExists: false });
  } catch (e: any) {
    console.error("[phantom-route-proof] error:", e);
    return res.status(500).json({ error: e?.message ?? "Route proof failed" });
  }
}
