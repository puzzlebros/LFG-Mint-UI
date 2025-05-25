// pages/api/game/submit.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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
  console.log('Body:', JSON.stringify(req.body));
  console.log('Global sessions:', Object.keys(global.sessions || {}));

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // Accept userName from client along with sessionId, finalScore, hmac
  const { sessionId, finalScore, hmac, userName } = req.body;
  if (!sessionId || finalScore == null || !hmac) return res.status(400).send('Missing fields');

  global.sessions = global.sessions || {};
  const session = global.sessions[sessionId];
  if (!session) return res.status(400).send('Invalid sessionId');

  // Check session expiry
  if (Date.now() > session.expiresAt) {
    delete global.sessions[sessionId];
    return res.status(400).send('Session expired');
  }

  const { secretSalt, walletAddress } = session;
  // Validate HMAC
  const expectedHmac = crypto
    .createHmac('sha256', secretSalt)
    .update(sessionId + finalScore)
    .digest('hex');

  if (expectedHmac !== hmac) return res.status(403).send('HMAC mismatch – submission rejected');

  // Init Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch current score
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

  // Use client-provided userName if non-empty, otherwise fallback to walletAddress
  const displayName = (typeof userName === 'string' && userName.trim() !== '')
    ? userName.trim()
    : walletAddress;

  if (finalScore > currentScore) {
    // Upsert with correct display_name
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
    console.log(`Updated leaderboard for ${walletAddress} as ‘${displayName}’: ${finalScore}`);
  } else {
    console.log(`No update for ${walletAddress}: submitted ${finalScore} vs current ${currentScore}`);
  }

  // 2) compute rank *for this finalScore* by counting everyone strictly above it:
  const { error: countError, count } = await supabase
  .from('leaderboard')
  .select('score', { count: 'exact', head: true })
  .gt('score', finalScore);
    if (countError) {
      console.error('Error counting leaderboard:', countError);
      return res.status(500).send('Database count error');
    }
    const rank = (count ?? 0) + 1;

  // Invalidate session
  delete global.sessions[sessionId];

  res.status(200).json({
    success: true,
    newHighScore: newHigh,
    bestScore: newHigh ? finalScore : currentScore,
    rank
  });
}
