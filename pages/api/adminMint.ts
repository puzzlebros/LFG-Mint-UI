// pages/api/adminMint.ts
// Builds, signs, and broadcasts a mint transaction server-side using DEPLOY_KEYPAIR.
// Only used in admin mode (?admin) so Phantom/Lighthouse is never in the signing path.
import type { NextApiRequest, NextApiResponse } from "next";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  generateSigner,
  publicKey,
  some,
  none,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import {
  mplCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  mintV1,
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

  const rpc   = process.env.NEXT_PUBLIC_RPC;
  const cmId  = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID;
  const kpRaw = process.env.DEPLOY_KEYPAIR;

  if (!rpc || !cmId || !kpRaw) {
    return res.status(500).json({ error: "Server misconfiguration: missing env vars" });
  }

  const { guardLabel, ownerWallet, timestamp, signature } = req.body as {
    guardLabel?: string;
    ownerWallet?: string;
    timestamp?: number;
    signature?: string;
  };

  if (!guardLabel || !ownerWallet || !timestamp || !signature) {
    return res.status(400).json({ error: "guardLabel, ownerWallet, timestamp and signature are required" });
  }

  // 1) Timestamp must be within 60 seconds — prevents replay attacks
  if (Math.abs(Date.now() - timestamp) > 60_000) {
    return res.status(403).json({ error: "Challenge expired" });
  }

  // 2) Verify the ed25519 signature — proves ownerWallet is controlled by the caller.
  //    The Address Gate on the ADMIN candy machine group enforces the allowed wallet on-chain,
  //    so we only need to confirm the caller actually owns the wallet they're minting to.
  try {
    const message = new TextEncoder().encode(`lfg-admin-mint:${ownerWallet}:${timestamp}`);
    const sigBytes = base58.serialize(signature);
    const pubkeyBytes = new Web3PublicKey(ownerWallet).toBytes();
    const valid = nacl.sign.detached.verify(message, sigBytes, pubkeyBytes);
    if (!valid) return res.status(403).json({ error: "Invalid signature" });
  } catch {
    return res.status(403).json({ error: "Signature verification failed" });
  }

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

    const assetSigner = generateSigner(umi);
    const group = guardLabel === "default" ? none<string>() : some(guardLabel);
    const priorityFee = parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001");

    const blockhash = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    const tx = transactionBuilder()
      .prepend(setComputeUnitPrice(umi, { microLamports: priorityFee }))
      .prepend(setComputeUnitLimit(umi, { units: 400_000 }))
      .add(
        mintV1(umi, {
          candyMachine: cm.publicKey,
          collection: cm.collectionMint,
          asset: assetSigner,
          owner: publicKey(ownerWallet),
          group,
          candyGuard: cg.publicKey,
          mintArgs: {},
        })
      )
      .setBlockhash(blockhash);

    const { signature } = await tx.sendAndConfirm(umi, {
      send: { skipPreflight: true },
      confirm: { commitment: "confirmed" },
    });

    return res.status(200).json({
      signature: base58.deserialize(signature)[0],
      mintAddress: assetSigner.publicKey.toString(),
    });
  } catch (e: any) {
    console.error("[adminMint] error:", e);
    return res.status(500).json({ error: e?.message ?? "Mint failed" });
  }
}
