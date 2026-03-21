// /data/mintMessages.ts
export type DayBucket = 'morning' | 'night';

export const mintMessages: Record<DayBucket, string[]> = {
  morning: [
    "If you reply I'm following you",
    "Say it back for some luck",
    "Say it back?",
    "Let's get it!",
    "Let's FLAMINGO!",
    "Flock it",
    "LFG",
  ],
  night: [
    'Night mint under neon lights 🌙',
    'After-hours Flamingo appears',
    'Late flockin’ mint',
    'Moonlight mint just touched down',
    'Just flock it',
  ],
};

export const defaultHashtags = ['#LetsFlamingo', '#Solana'];
