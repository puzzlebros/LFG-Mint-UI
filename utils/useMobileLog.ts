import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function nowIso() {
  return new Date().toISOString();
}

function safeJson(x: any) {
  try {
    if (x === undefined) return "undefined";
    if (x === null) return "null";
    if (typeof x === "string") return x;
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

export type MobileLogger = (msg: string, obj?: any) => void;

export function useMobileLog(enabled: boolean) {
  const [lines, setLines] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);

  const push = useCallback<MobileLogger>(
    (msg, obj) => {
      if (!enabled) return;
      const line =
        obj !== undefined
          ? `[${nowIso()}] ${msg}\n${safeJson(obj)}`
          : `[${nowIso()}] ${msg}`;
      setLines((prev) => [...prev, line]);
    },
    [enabled]
  );

  const clear = useCallback(() => setLines([]), []);

  const toggleHidden = useCallback(() => setHidden((h) => !h), []);

  // Hijack console + window errors so we see EVERYTHING
  useEffect(() => {
    if (!enabled) return;

    const orig = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    const wrap =
      (lvl: keyof typeof orig) =>
      (...args: any[]) => {
        try {
          const joined = args.map((a) => safeJson(a)).join(" ");
          push(`console.${lvl}: ${joined}`);
        } catch {}
        orig[lvl](...args);
      };

    console.log = wrap("log");
    console.warn = wrap("warn");
    console.error = wrap("error");
    console.info = wrap("info");
    console.debug = wrap("debug");

    const onError = (event: ErrorEvent) => {
      push("window.onerror", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? String(event.error) : null,
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      push("window.unhandledrejection", {
        reason: event.reason ? safeJson(event.reason) : "unknown",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
      console.info = orig.info;
      console.debug = orig.debug;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [enabled, push]);

  return { lines, hidden, push, clear, toggleHidden };
}
