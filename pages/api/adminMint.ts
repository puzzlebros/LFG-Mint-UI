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
  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET;

  if (!rpc || !cmId || !kpRaw) {
    return res.status(500).json({ error: "Server misconfiguration: missing env vars" });
  }

  const { guardLabel, ownerWallet } = req.body as {
    guardLabel?: string;
    ownerWallet?: string;
  };

  if (!guardLabel || !ownerWallet) {
    return res.status(400).json({ error: "guardLabel and ownerWallet are required" });
  }

  // Gate to admin wallet if configured
  if (adminWallet && ownerWallet !== adminWallet) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const umi = createUmi(rpc).use(mplCandyMachine());
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
