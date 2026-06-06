// pages/api/allowlistMint.ts
// Bypasses Phantom/Lighthouse by signing the mint tx server-side with DEPLOY_KEYPAIR.
// The user's route tx (which created their AllowListProof PDA) must have already been
// submitted before calling this endpoint.
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  generateSigner,
  publicKey,
  some,
  transactionBuilder,
  Signer,
} from "@metaplex-foundation/umi";
import {
  mplCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  mintV1,
  safeFetchAllowListProofFromSeeds,
} from "@metaplex-foundation/mpl-core-candy-machine";
import { setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { base58 } from "@metaplex-foundation/umi/serializers";
import nacl from "tweetnacl";
import { PublicKey as Web3PublicKey } from "@solana/web3.js";

type Ok  = { signature: string; mintAddress: string };
type Err = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rpc         = process.env.NEXT_PUBLIC_RPC;
  const cmId        = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID;
  const kpRaw       = process.env.DEPLOY_KEYPAIR;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rpc || !cmId || !kpRaw || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Server misconfiguration: missing env vars" });
  }

  const { ownerWallet, timestamp, signature } = req.body as {
    ownerWallet?: string;
    timestamp?: number;
    signature?: string;
  };

  if (!ownerWallet || !timestamp || !signature) {
    return res.status(400).json({ error: "ownerWallet, timestamp and signature are required" });
  }

  // 1) Replay prevention — challenge must be fresh (within 60 s)
  if (Math.abs(Date.now() - timestamp) > 60_000) {
    return res.status(403).json({ error: "Challenge expired" });
  }

  // 2) Verify ed25519 signature — proves caller controls ownerWallet without exposing the key
  try {
    const message    = new TextEncoder().encode(`lfg-allowlist-mint:${ownerWallet}:${timestamp}`);
    const sigBytes   = base58.serialize(signature);
    const pubkeyBytes = new Web3PublicKey(ownerWallet).toBytes();
    const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
    if (!valid) return res.status(403).json({ error: "Invalid signature" });
  } catch {
    return res.status(403).json({ error: "Signature verification failed" });
  }

  // 3) Verify wallet is in the current top-10 allowlist (Supabase)
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: leaderboard, error: dbErr } = await supabase
    .from("leaderboard")
    .select("wallet_address")
    .order("score", { ascending: false })
    .limit(10);

  if (dbErr || !leaderboard) {
    console.error("[allowlistMint] Supabase error:", dbErr);
    return res.status(500).json({ error: "Failed to fetch allowlist" });
  }

  const allowedWallets = leaderboard.map((r: { wallet_address: string }) => r.wallet_address);
  if (!allowedWallets.includes(ownerWallet)) {
    return res.status(403).json({ error: "Wallet not in current allowlist (top-10)" });
  }

  // 4) Set up server-side UMI with DEPLOY_KEYPAIR as the fee payer / signer
  const umi = createUmi(rpc).use(mplCandyMachine());
  const keypairBytes = new Uint8Array(JSON.parse(kpRaw) as number[]);
  const serverKP = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
  umi.use(keypairIdentity(serverKP));

  try {
    const cm = await fetchCandyMachine(umi, publicKey(cmId));
    const cg = await fetchCandyGuard(umi, cm.mintAuthority);

    // 5) Locate the LFG allowList group and extract the current merkle root
    const lfgGroup = cg.groups.find((g) => g.label === "LFG");
    if (!lfgGroup || lfgGroup.guards.allowList.__option !== "Some") {
      return res.status(500).json({ error: "LFG allowList group not found on candy guard" });
    }
    const merkleRoot = lfgGroup.guards.allowList.value.merkleRoot;

    // 6) Verify the user's AllowListProof PDA exists on-chain.
    //    This PDA was created by the user's own route tx (signed by Phantom before this call).
    //    Its existence proves: the user was in the allowlist AND submitted the route tx.
    //    Seeds: [merkleRoot, ownerWallet, candyGuard, candyMachine]
    const proof = await safeFetchAllowListProofFromSeeds(umi, {
      merkleRoot,
      user: publicKey(ownerWallet),
      candyMachine: cm.publicKey,
      candyGuard: cm.mintAuthority,
    });
    if (proof === null) {
      return res.status(403).json({
        error: "AllowList proof PDA not found — please complete the route step first",
      });
    }

    // 7) Mint server-side.
    //
    // The `minter` slot is passed as a plain { publicKey } object (no signMessage/signTransaction).
    // UMI's isSigner() returns false for this, so the transaction marks minter as isSigner:false —
    // no signature required. On-chain, the allowList guard reads minter.key() = ownerWallet and
    // finds the AllowListProof PDA for ownerWallet (created in step 6). DEPLOY_KEYPAIR signs only
    // as payer; it never touches Phantom and Lighthouse never runs.
    const assetSigner  = generateSigner(umi);
    const priorityFee  = parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001");
    const blockhash    = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    const tx = transactionBuilder()
      .prepend(setComputeUnitPrice(umi, { microLamports: priorityFee }))
      .prepend(setComputeUnitLimit(umi, { units: 400_000 }))
      .add(
        mintV1(umi, {
          candyMachine: cm.publicKey,
          collection: cm.collectionMint,
          asset: assetSigner,
          owner: publicKey(ownerWallet),
          // Non-signing minter: isSigner=false in tx, .publicKey used for PDA derivation only.
          minter: { publicKey: publicKey(ownerWallet) } as unknown as Signer,
          group: some("LFG"),
          candyGuard: cg.publicKey,
          mintArgs: {
            allowList: some({ merkleRoot }),
          },
        })
      )
      .setBlockhash(blockhash);

    const { signature: mintSig } = await tx.sendAndConfirm(umi, {
      send: { skipPreflight: true },
      confirm: { commitment: "confirmed" },
    });

    console.log(
      `[allowlistMint] minted for ${ownerWallet}: sig=${base58.deserialize(mintSig)[0]} asset=${assetSigner.publicKey}`
    );

    return res.status(200).json({
      signature: base58.deserialize(mintSig)[0],
      mintAddress: assetSigner.publicKey.toString(),
    });
  } catch (e: any) {
    console.error("[allowlistMint] error:", e);
    return res.status(500).json({ error: e?.message ?? "Mint failed" });
  }
}
