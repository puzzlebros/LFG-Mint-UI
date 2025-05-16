import React, { createContext, useContext, useEffect, useState } from "react";
import { getSolanaTime } from "../metaplex/checkerHelper";
import { useUmi } from "../metaplex/useUmi";

type SolanaTimeContextType = {
  solanaTime: bigint;
};

const SolanaTimeContext = createContext<SolanaTimeContextType>({
  solanaTime: BigInt(0),
});

export const useSolanaTime = () => useContext(SolanaTimeContext).solanaTime;

export const SolanaTimeProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => {
  const umi = useUmi();
  const [solanaTime, setSolanaTime] = useState<bigint>(BigInt(0));

  useEffect(() => {
    let isMounted = true;
    let retryDelay = 500;          // start with 500ms back‑off
    const maxInterval = 60_000;    // poll every 60s on success

    const fetchLoop = async () => {
      try {
        const t = await getSolanaTime(umi);
        if (isMounted) {
          setSolanaTime(t);
          retryDelay = 500;        // reset back‑off after a success
        }
      } catch (err: any) {
        console.warn(
          `[SolanaTime] RPC error (${err.code || err.message}), retry in ${retryDelay}ms`
        );
        // schedule a retry after retryDelay
        setTimeout(fetchLoop, retryDelay);
        // exponential back‑off up to our maxInterval
        retryDelay = Math.min(maxInterval, retryDelay * 2);
        return; // bail out so we don’t schedule the normal interval
      }
      // schedule the next regular poll
      setTimeout(fetchLoop, maxInterval);
    };

    fetchLoop();
    return () => {
      isMounted = false;
    };
  }, [umi]);

  return (
    <SolanaTimeContext.Provider value={{ solanaTime }}>
      {children}
    </SolanaTimeContext.Provider>
  );
};