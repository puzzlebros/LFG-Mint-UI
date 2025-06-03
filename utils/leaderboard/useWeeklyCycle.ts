// utils/leaderboard/useWeeklyCycle.ts
import { useState, useEffect } from 'react';

export function useWeeklyCycle() {
  const [isFrozen, setIsFrozen] = useState(false);
  const [next, setNext]         = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    let debugOverride = false;

    // DEV-only URL override
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'devnet') {
      const params = new URLSearchParams(window.location.search);
      debugOverride = params.get('freeze') === 'true';
    }

    const tick = () => {
      const now = new Date();

      if (debugOverride) {
        // instantly freeze + fake “unfreeze” 1h later in DEV
        setIsFrozen(true);
        setNext(new Date(now.getTime() + 3_600_000));
        setCountdown('debug');
        return;
      }

      // —— your real Saturday‐freeze logic —— 
      // For example: freeze all day Saturday, unfreeze on Sunday 00:00.
      const day = now.getDay();          // 6 = Saturday
      const isSat = day === 6;
      setIsFrozen(isSat);

      // compute next transition
      const nextDate = new Date(now);
      if (isSat) {
        // unfreeze point: next Sunday 00:00 UTC
        nextDate.setDate(now.getUTCDate() + 1);
        nextDate.setHours(0, 0, 0, 0);
      } else {
        // freeze starts next Saturday 00:00 UTC
        const daysUntilSat = (6 - day + 7) % 7;
        nextDate.setUTCDate(now.getUTCDate() + daysUntilSat);
        nextDate.setUTCHours(0, 0, 0, 0);
      }
      setNext(nextDate);

      // countdown text
      const diffMs = nextDate.getTime() - now.getTime();
      const hrs = Math.floor(diffMs / 3_600_000);
      const mins = Math.floor((diffMs % 3_600_000) / 60_000);
      setCountdown(`${hrs}h ${mins}m`);
    };

    tick();
    const id = setInterval(tick, 60_000); // recalc every minute
    return () => clearInterval(id);
  }, []);

  return { isFrozen, next, countdown };
}
