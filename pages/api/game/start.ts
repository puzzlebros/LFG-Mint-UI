// pages/api/game/start.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import { performReverseLookup } from '@bonfida/spl-name-service';

type Data = {
  sessionId: string;
  secretSalt: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | string>
) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { walletAddress, userName: clientName } = req.body;
  if (!walletAddress) {
    return res.status(400).send('Missing walletAddress');
  }

  // ─── Try on‐chain reverse lookup via Bonfida SNS ───────────
  let finalName = '';
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) throw new Error('Missing SOLANA_RPC_URL in env');
    const connection = new Connection(rpcUrl, 'confirmed');
    // performReverseLookup returns the domain (e.g. "alice.sol") or throws / returns null
    const maybeName = await performReverseLookup(
      connection,
      new PublicKey(walletAddress)
    );
    if (typeof maybeName === 'string' && maybeName.trim()) {
      finalName = maybeName.trim();
      console.log(`✅ Reverse‐lookup SNS name for ${walletAddress}: ${finalName}`);
    } else {
      throw new Error('No on‑chain SNS name');
    }
  } catch (err) {
    console.log(`🔍 No on‑chain SNS name for ${walletAddress}: ${(err as Error).message}`);
  }

  // ─── Fallback to client‑provided or blank ────────────────
  if (!finalName) {
    finalName = typeof clientName === 'string' ? clientName.trim() : '';
    if (finalName) {
      console.log(`ℹ️  Using clientName fallback for ${walletAddress}: "${finalName}"`);
    } else {
      console.log(`ℹ️  No clientName provided for ${walletAddress}; using empty string`);
    }
  }

  // ─── Session boilerplate ───────────────────────────────────
  const sessionId  = crypto.randomBytes(16).toString('hex');
  const secretSalt = crypto.randomBytes(16).toString('hex');
  const expiresAt  = Date.now() + 30 * 60 * 1000; // 30 min TTL

  global.sessions = global.sessions || {};
  global.sessions[sessionId] = {
    secretSalt,
    walletAddress,
    userName: finalName,
    createdAt: Date.now(),
    expiresAt,
  };

  console.log(
    `🎯 Session ${sessionId} started for ${walletAddress}; userName="${finalName}". ` +
    `Expires at ${new Date(expiresAt).toISOString()}`
  );
  res.status(200).json({ sessionId, secretSalt });
}
