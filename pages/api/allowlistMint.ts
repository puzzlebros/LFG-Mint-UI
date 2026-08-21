// pages/api/allowlistMint.ts
// Checks top-10 Supabase rank, then builds a mint transaction that the MINTER pays for.
//
// The LFG free mint runs on the candy guard's "ADMIN" group, which is protected by
// addressGate(DEPLOY_KEYPAIR).  addressGate validates the `minter` account, while the
// SOL fees (network fee + rent + the ~0.003 SOL Metaplex Core creation fee) are charged
// to the `payer` account.  mintV1 exposes those as two independent signers, so we can
// keep DEPLOY_KEYPAIR as the gate-satisfying `minter` while making the claimer the
// `payer` / fee payer.  The server partially signs (minter + new asset keypair) and
// hands the transaction back; the wallet adds the final signature and broadcasts.
//
// Eligibility stays a plain Supabase leaderboard check — no allowList guard, no merkle
// proof route instruction, nothing extra for the wallet to simulate.
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  keypairIdentity,
  createSignerFromKeypair,
  createNoopSigner,
  generateSigner,
  publicKey,
  some,
  signTransaction,
  transactionBuilder,
} from "@metaplex-foundation/umi";
import {
  mplCandyMachine,
  fetchCandyMachine,
  fetchCandyGuard,
  mintV1,
} from "@metaplex-foundation/mpl-core-candy-machine";
import { setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { PublicKey as Web3PublicKey } from "@solana/web3.js";

type Ok = {
  transaction: string;           // base64, partially signed (minter + asset)
  mintAddress: string;
  blockhash: string;
  lastValidBlockHeight: number;
};
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

  const { ownerWallet } = req.body as { ownerWallet?: string };

  if (!ownerWallet) {
    return res.status(400).json({ error: "ownerWallet is required" });
  }

  // 1) ownerWallet must be a well-formed pubkey.
  //    No challenge signature is needed here: the transaction we return is only usable
  //    by ownerWallet itself (it is the fee payer and must add the last signature), so
  //    handing one out to the wrong caller grants nothing. Dropping the extra
  //    signMessage step also keeps the claim at a single wallet prompt.
  try {
    new Web3PublicKey(ownerWallet);
  } catch {
    return res.status(400).json({ error: "Invalid ownerWallet" });
  }

  // 2) Free mint is only open during the weekend freeze [Sat 00:00, Mon 00:00) UTC
  {
    const now     = new Date();
    const wd      = now.getUTCDay();                  // 0=Sun … 6=Sat
    const daysOff = (wd - 6 + 7) % 7;                // days since most recent Saturday
    const satUTC  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysOff, 0, 0, 0, 0));
    const monUTC  = new Date(satUTC.getTime() + 2 * 24 * 60 * 60 * 1000);
    if (!(now >= satUTC && now < monUTC)) {
      return res.status(403).json({ error: "Free mint is only available during the weekend" });
    }
  }

  // 3) Verify wallet is in the current top-10 (Supabase)
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
    return res.status(403).json({ error: "Wallet not in current top-10" });
  }

  // 4) Set up server-side UMI. DEPLOY_KEYPAIR is only the addressGate `minter` now —
  //    it is deliberately NOT the fee payer, so it spends nothing on this mint.
  const umi = createUmi(rpc).use(mplCandyMachine());
  const keypairBytes = new Uint8Array(JSON.parse(kpRaw) as number[]);
  const serverKP = umi.eddsa.createKeypairFromSecretKey(keypairBytes);
  umi.use(keypairIdentity(serverKP));
  const minterSigner = createSignerFromKeypair(umi, serverKP);

  try {
    const cm = await fetchCandyMachine(umi, publicKey(cmId));
    const cg = await fetchCandyGuard(umi, cm.mintAuthority);

    const assetSigner = generateSigner(umi);
    // The claimer signs client-side; server-side it is a placeholder signer so the
    // account lands in the message with the right signer/writable flags.
    const payerSigner = createNoopSigner(publicKey(ownerWallet));

    const priorityFee = parseInt(process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001");
    const blockhash   = await umi.rpc.getLatestBlockhash({ commitment: "confirmed" });

    // Measured on-chain: ~60k CU and ~0.0035 SOL total cost to the payer.
    const builder = transactionBuilder()
      .prepend(setComputeUnitPrice(umi, { microLamports: priorityFee }))
      .prepend(setComputeUnitLimit(umi, { units: 120_000 }))
      .add(
        mintV1(umi, {
          candyMachine: cm.publicKey,
          collection: cm.collectionMint,
          asset: assetSigner,
          owner: publicKey(ownerWallet),
          payer: payerSigner,   // claimer pays network fee + rent + Core creation fee
          minter: minterSigner, // DEPLOY_KEYPAIR satisfies addressGate on the ADMIN group
          group: some("ADMIN"),
          candyGuard: cg.publicKey,
          mintArgs: {},
        })
      )
      .setFeePayer(payerSigner)
      .setBlockhash(blockhash);

    // Partially sign: minter + asset. The claimer's slot stays empty for their wallet.
    // Note the client must use signTransaction (not signAndSendTransaction) — the
    // latter makes Phantom rebuild the message and drop these signatures.
    const partiallySigned = await signTransaction(builder.build(umi), [
      minterSigner,
      assetSigner,
    ]);

    const serialized = umi.transactions.serialize(partiallySigned);

    console.log(
      `[allowlistMint] prepared mint for ${ownerWallet}: asset=${assetSigner.publicKey}`
    );

    return res.status(200).json({
      transaction: Buffer.from(serialized).toString("base64"),
      mintAddress: assetSigner.publicKey.toString(),
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    });
  } catch (e: any) {
    console.error("[allowlistMint] error:", e);
    return res.status(500).json({ error: e?.message ?? "Mint preparation failed" });
  }
}
