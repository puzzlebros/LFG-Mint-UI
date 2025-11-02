// /data/mintMessages.ts
export type DayBucket = 'morning' | 'night';

export const mintMessages: Record<DayBucket, string[]> = {
  morning: [
    'A fresh Flamingo takes flight ☀️',
    'Sunrise mint just landed',
    'A new Flamingo joined the flock',
    'Coffee + mint = perfect day',
    'Flock it',
  ],
  night: [
    'Night mint under neon lights 🌙',
    'After-hours Flamingo appears',
    'Late flockin’ mint',
    'Moonlight mint just touched down',
    'Just flock it',
  ],
};

export const defaultHashtags = ['#LetsFlamingo', '#SolanaNFT'];
