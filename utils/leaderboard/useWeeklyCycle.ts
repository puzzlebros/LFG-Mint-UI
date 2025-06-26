import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function useWeeklyCycle() {
  const [isFrozen, setIsFrozen] = useState(false);
  const [next, setNext] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState<string>('');
  const router = useRouter();
  
  // Check for the freeze debug parameter in the URL
  const isFreezeDebug = process.env.NODE_ENV === 'development' && router.query.freeze === 'true';

  useEffect(() => {
    if (isFreezeDebug) {
      setIsFrozen(true); // Force the frozen state if the debug flag is present
      return; // Skip the regular cycle if in debug mode
    }

    const tick = () => {
      const now = new Date();

      // 1) Figure out "this week's" Saturday 03:00 UTC
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const date = now.getUTCDate();
      const weekday = now.getUTCDay(); // 0=Sun…6=Sat
      const daysSinceSat = (weekday - 6 + 7) % 7;

      // the most recent (or today’s) Saturday at 03:00 UTC
      const satUTC = new Date(Date.UTC(year, month, date - daysSinceSat, 3, 0, 0, 0));

      // the Sunday 03:00 UTC that follows it
      const sunUTC = new Date(satUTC.getTime() + MS_PER_DAY);

      let nextTransition: Date;
      let frozen: boolean;

      if (now < satUTC) {
        frozen = false;
        nextTransition = satUTC;
      } else if (now >= satUTC && now < sunUTC) {
        frozen = true;
        nextTransition = sunUTC;
      } else {
        frozen = false;
        nextTransition = new Date(satUTC.getTime() + 7 * MS_PER_DAY);
      }

      setIsFrozen(frozen);
      setNext(nextTransition);

      const diffMs = nextTransition.getTime() - now.getTime();
      const hrs = Math.floor(diffMs / 3_600_000);
      const mins = Math.floor((diffMs % 3_600_000) / 60_000);
      setCountdown(`${hrs}h ${mins}m`);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [isFreezeDebug]);

  return { isFrozen, next, countdown };
}
