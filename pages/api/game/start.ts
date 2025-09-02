// pages/api/game/start.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Connection, PublicKey } from '@solana/web3.js';
import { reverseLookup } from '@bonfida/spl-name-service';

// ──────────────────────────────────────────────────────────────────────────────
// Pull SESSION_JWT_SECRET out, using `!` to assert it is non-null at runtime.
// (If it really isn’t set, we immediately throw.)
// ──────────────────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.SESSION_JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('Missing SESSION_JWT_SECRET environment variable');
}

type Data = {
  token: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | string>
) {
  console.log('🔥 /api/game/start invoked');
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { walletAddress, userName: clientName } = req.body ?? {};
  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).send('Missing walletAddress');
  }

  // ─── Try on‐chain reverse lookup via Bonfida SNS ────────────────────────────
  let finalName = ''
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC
    if (!rpcUrl) throw new Error('Missing NEXT_PUBLIC_RPC')
    const connection = new Connection(rpcUrl, 'confirmed')

    // ⬇️ lazy import so missing deps never kill cold start
    const { reverseLookup } = await import('@bonfida/spl-name-service')
    const maybeName = await reverseLookup(connection, new PublicKey(walletAddress))
    if (typeof maybeName === 'string' && maybeName.trim()) {
      finalName = maybeName.trim()
      console.log(`✅ Reverse‐lookup SNS name: ${finalName}`)
    } else {
      console.log('🔍 No on-chain SNS name')
    }
  } catch (e: any) {
    console.log(`🔍 SNS lookup skipped: ${e?.message || e}`)
  }

  // ─── Fallback to client‐provided or blank ──────────────────────────────────
  if (!finalName) {
    finalName = typeof clientName === 'string' ? clientName.trim() : '';
    if (finalName) {
      console.log(`ℹ️ Using clientName fallback: "${finalName}"`);
    } else {
      console.log(`ℹ️ No clientName provided; using empty string`);
    }
  }

  // ─── Build session payload ────────────────────────────────────────────────
  const sessionId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30‐minute TTL

  const jwtPayload = {
    sessionId,
    walletAddress,
    userName: finalName,
    expiresAt,
  };

  // ─── Sign the JWT with HS256. Use `JWT_SECRET!` so TS knows it's a string. ──
  const token = jwt.sign(jwtPayload, JWT_SECRET, {
    algorithm: 'HS256',
  });

  console.log(
    `🎯 Issued session ${sessionId} for ${walletAddress}, userName="${finalName}", expiresAt=${new Date(
      expiresAt
    ).toISOString()}`
  );
  return res.status(200).json({ token });
}
