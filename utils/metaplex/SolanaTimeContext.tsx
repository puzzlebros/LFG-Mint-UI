//utils/metaplex/SolanaTimeContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getSolanaTime } from "../metaplex/checkerHelper";
import { useUmi } from "../metaplex/useUmi";

type SolanaTimeContextType = {
  solanaTime: bigint;
  /** Register interest in fresh chain time; call the returned fn to release. */
  retain: () => () => void;
};

const SolanaTimeContext = createContext<SolanaTimeContextType>({
  solanaTime: BigInt(0),
  retain: () => () => {},
});

/** Read the last known chain time. Does NOT start polling. */
export const useSolanaTime = () => useContext(SolanaTimeContext).solanaTime;

/**
 * Keep chain time fresh while `enabled` is true.
 *
 * Polling used to run unconditionally from _app — on every page, for every
 * open tab, 2 RPC calls a minute (getSlot + getBlockTime) whether or not
 * anything read the value. Its only consumer is the countdown Timer on the
 * mint page, which renders solely when a candy guard group carries a
 * startDate or endDate, and no group currently does. That idle poll cost
 * roughly 2,880 RPC credits per day per open tab against a 1M monthly plan.
 *
 * Gating it here rather than deleting it means a dated guard added later
 * switches the poll back on by itself.
 */
export const useSolanaTimeWhen = (enabled: boolean) => {
  const { retain } = useContext(SolanaTimeContext);
  useEffect(() => {
    if (!enabled) return;
    return retain();
  }, [enabled, retain]);
};

export const SolanaTimeProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const umi = useUmi();
  const [solanaTime, setSolanaTime] = useState<bigint>(BigInt(0));
  const [consumers, setConsumers] = useState(0);

  const retain = useCallback(() => {
    setConsumers((n) => n + 1);
    return () => setConsumers((n) => Math.max(0, n - 1));
  }, []);

  useEffect(() => {
    // Nobody is displaying a countdown — issue no RPC at all.
    if (consumers === 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 500;
    const maxInterval = 60_000;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(fetchLoop, ms);
    };

    const fetchLoop = async () => {
      if (cancelled) return;
      try {
        const t = await getSolanaTime(umi);
        if (cancelled) return;
        setSolanaTime(t);
        retryDelay = 500;
        schedule(maxInterval);
      } catch (err: any) {
        // Previously the retry was scheduled without any cancellation check and
        // the timeout was never cleared, so unmounted loops kept issuing calls.
        console.warn(
          `[SolanaTime] RPC error (${err?.code || err?.message}), retry in ${retryDelay}ms`
        );
        const wait = retryDelay;
        retryDelay = Math.min(maxInterval, retryDelay * 2);
        schedule(wait);
      }
    };

    fetchLoop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [umi, consumers]);

  const value = useMemo(() => ({ solanaTime, retain }), [solanaTime, retain]);

  return (
    <SolanaTimeContext.Provider value={value}>
      {children}
    </SolanaTimeContext.Provider>
  );
};
