// components/useMobileLog.ts
import { useCallback, useEffect, useRef, useState } from "react";

type MobileLog = {
  enabled: boolean;
  lines: string[];
  log: (msg: string, data?: unknown) => void;
  clear: () => void;
  toggle: () => void;
};

export function useMobileLog(): MobileLog {
  const [enabled, setEnabled] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const linesRef = useRef<string[]>([]);

  useEffect(() => {
    // Enable when ?mlog=1 is present, or on mobile by default if you prefer.
    const params = new URLSearchParams(window.location.search);
    const on = params.get("mlog") === "1";
    setEnabled(on);
  }, []);

  const log = useCallback((msg: string, data?: unknown) => {
    const ts = new Date().toISOString();
    const extra =
      data === undefined
        ? ""
        : " " +
          (typeof data === "string"
            ? data
            : (() => {
                try {
                  return JSON.stringify(data);
                } catch {
                  return String(data);
                }
              })());

    const line = `[${ts}] ${msg}${extra}`;

    linesRef.current = [...linesRef.current, line].slice(-300); // keep last 300 lines
    setLines(linesRef.current);

    // Still log to console for desktop debugging
    // eslint-disable-next-line no-console
    console.log(line);
  }, []);

  const clear = useCallback(() => {
    linesRef.current = [];
    setLines([]);
  }, []);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return { enabled, lines, log, clear, toggle };
}
