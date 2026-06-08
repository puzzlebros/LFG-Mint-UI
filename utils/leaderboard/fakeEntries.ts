import { FAKE_ENTRIES_ENABLED, fakeUsernames } from '@/public/data/fakeLeaderboard';
import { getWeeklyCycle } from './useWeeklyCycle';
import type { LeaderboardEntry } from '@/types/leaderboard';

const BASE58_ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10;

// Mulberry32 seeded PRNG — deterministic, stable across page loads for same seed
function prng(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Proper base58 encode of a byte array — matches the Solana address format exactly
function base58Encode(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b !== 0) break;
    leadingZeros++;
  }
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return '1'.repeat(leadingZeros) + digits.reverse().map(d => BASE58_ALPHA[d]).join('');
}

// Generate a fake but properly formatted Solana address (base58 of 32 random bytes)
function fakeWallet(rng: () => number): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Math.floor(rng() * 256);
  return base58Encode(bytes);
}

/**
 * Generates fake leaderboard entries to fill the display up to MAX_ENTRIES.
 * Entries are deterministic per calendar day and accumulate 1-2 per day
 * starting from the beginning of the non-frozen window.
 * These are front-end only and must never reach Supabase or the allowlist.
 */
export function generateFakeEntries(
  realEntries: LeaderboardEntry[],
  now = new Date()
): LeaderboardEntry[] {
  if (!FAKE_ENTRIES_ENABLED) return [];

  const { satUTC, monUTC, isFrozen } = getWeeklyCycle(now);

  const slots = MAX_ENTRIES - realEntries.length;
  if (slots <= 0) return [];

  // Non-frozen: accumulate fakes day-by-day from this week's Monday 00:00 UTC.
  // Frozen (Sat→Mon 00:00): weekStart points to the play week that just ended so
  // the existing fakes stay visible — dayIndex is capped at 4 so no new ones are
  // added. Everything resets at Monday 00:00 (monUTC), the same moment the
  // clear-leaderboard cron fires. Fake wallets never appear in topWallets —
  // those are sourced directly from Supabase.
  const weekStart = isFrozen
    ? new Date(satUTC.getTime() - 5 * MS_PER_DAY)  // previous Monday 00:00
    : monUTC;                                         // next Monday 00:00

  const dayIndex = Math.min(
    Math.floor((now.getTime() - weekStart.getTime()) / MS_PER_DAY),
    4  // cap at Friday (Mon=0…Fri=4); frozen window yields ~5+ days → clamped, no new entries
  );

  const topScore = realEntries.length > 0 ? realEntries[0].score : 1000;
  const bottomScore = realEntries.length > 0 ? realEntries[realEntries.length - 1].score : topScore;

  // Seed anchor: which week this is (changes each week, stable within a week)
  const weekStamp = Math.floor(weekStart.getTime() / MS_PER_DAY);

  const usedNames = new Set<string>();
  const result: LeaderboardEntry[] = [];

  for (let d = 0; d <= dayIndex && result.length < slots; d++) {
    const daySeed = (weekStamp + d) * 1000;

    // 1 or 2 entries this day, seeded by (week + day)
    const countRng = prng(daySeed);
    const countThisDay = Math.floor(countRng() * 2) + 1;

    for (let i = 0; i < countThisDay && result.length < slots; i++) {
      const rng = prng(daySeed + i + 1);

      // Unique name: rotate through list to avoid duplicates
      let name = fakeUsernames[Math.floor(rng() * fakeUsernames.length)];
      if (usedNames.has(name)) {
        name = fakeUsernames[(fakeUsernames.indexOf(name) + result.length + 1) % fakeUsernames.length];
      }
      usedNames.add(name);

      // Score: below the lowest real entry, decreasing by position
      const overallPos = realEntries.length + result.length;
      const decayFactor = Math.max(0.05, 1 - (overallPos + 1) * 0.09);
      const score = Math.max(1, Math.floor(bottomScore * decayFactor * (0.7 + rng() * 0.25)));

      result.push({
        display_name: name,
        score,
        wallet_address: fakeWallet(rng),
      });
    }
  }

  return result;
}
