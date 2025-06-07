// pages/api/game/submit.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

////////////////////////////////////////////////////////////////////////////////
// Grab environment‐vars. Use `!` so TS knows they’re non‐null strings. If any
// are actually missing at runtime, we throw immediately.
////////////////////////////////////////////////////////////////////////////////
const JWT_SECRET = process.env.SESSION_JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('Missing SESSION_JWT_SECRET');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase configuration');
}

// ──────────────────────────────────────────────────────────────────────────────
// Define the exact shape we expect after `jwt.verify` decodes our token.
// ──────────────────────────────────────────────────────────────────────────────
interface SessionPayload {
  sessionId: string;
  walletAddress: string;
  userName: string;
  expiresAt: number;
}

type Data = {
  success: boolean;
  newHighScore: boolean;
  bestScore: number;
  rank: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | string>
) {
  console.log('🔥 /api/game/submit invoked');
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { token, finalScore, userName: clientName } = req.body ?? {};
  if (!token || finalScore == null) {
    return res.status(400).send('Missing fields');
  }

  // ─── 1) Verify & decode the JWT ──────────────────────────────────────────
  let payload: SessionPayload;
  try {
    // `jwt.verify` may return `string | object | Jwt | JwtPayload`, so first
    // cast to `unknown`, then to our `SessionPayload`. This silences TS errors.
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    payload = (decoded as unknown) as SessionPayload;
  } catch (err) {
    console.error('🔐 JWT verification failed:', err);
    return res.status(400).send('Invalid or expired token');
  }

  const { sessionId, walletAddress, userName: origUserName, expiresAt } = payload;

  // ─── 2) Check that we haven’t expired ────────────────────────────────────
  if (Date.now() > expiresAt) {
    return res.status(400).send('Session expired');
  }

  // ─── 3) Determine displayName: prefer the client‐sent name if non‐empty ───
  const displayName =
    typeof clientName === 'string' && clientName.trim() !== ''
      ? clientName.trim()
      : origUserName || walletAddress;

  // ─── 4) Upsert into Supabase leaderboard ──────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 4.a) Fetch existing score for this wallet, if any
  const { data: currentData, error: selectError, status } = await supabase
    .from('leaderboard')
    .select('score')
    .eq('wallet_address', walletAddress)
    .single();

  if (selectError && status !== 406) {
    console.error('Error selecting score:', selectError);
    return res.status(500).send('Database error');
  }

  const currentScore = currentData ? currentData.score : 0;
  let newHigh = false;

  // 4.b) If finalScore beats current, upsert:
  if (finalScore > currentScore) {
    const { error: upsertError } = await supabase
      .from('leaderboard')
      .upsert({
        wallet_address: walletAddress,
        display_name: displayName,
        score: finalScore,
      });
    if (upsertError) {
      console.error('Error upserting score:', upsertError);
      return res.status(500).send('Database update error');
    }
    newHigh = true;
  }

  // 4.c) Compute rank (how many have strictly higher score)
  const { error: countError, count } = await supabase
    .from('leaderboard')
    .select('score', { count: 'exact', head: true })
    .gt('score', finalScore);

  if (countError) {
    console.error('Error counting leaderboard:', countError);
    return res.status(500).send('Database count error');
  }
  const rank = (count ?? 0) + 1;

  // ─── 5) Return success response ──────────────────────────────────────────
  return res.status(200).json({
    success: true,
    newHighScore: newHigh,
    bestScore: newHigh ? finalScore : currentScore,
    rank,
  });
}
