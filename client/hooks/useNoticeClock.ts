import { useEffect, useMemo, useState } from "react";
import { liveNoticeKeys, nextNoticeFade, startNoticeClocks, type NoticeClock } from "../models/timed-notices.ts";

/**
 * Shows each key once for `durationMs`, then hides it. A key is visible on the render it first appears in, so no
 * notice flickers in late; `onStart` runs once per key when its clock starts (to remember it across reloads).
 */
export function useNoticeClock(keys: readonly string[], durationMs: number, onStart?: (keys: readonly string[]) => void): { live: ReadonlySet<string>; clock: NoticeClock } {
  const [clock, setClock] = useState<NoticeClock>(() => new Map());
  const [now, setNow] = useState(() => Date.now());
  const signature = keys.join("\n");

  useEffect(() => {
    const fresh = keys.filter(key => !clock.has(key));
    if (fresh.length === 0) return;
    setClock(previous => startNoticeClocks(previous, keys, Date.now(), durationMs));
    onStart?.(fresh);
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const delay = nextNoticeFade(clock, keys, Date.now());
    if (delay === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 16);
    return () => window.clearTimeout(timer);
    // `now` re-arms the timer after each fade, so a later notice also leaves on time.
  }, [clock, signature, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(() => new Set(liveNoticeKeys(clock, keys, Math.max(now, 0))), [clock, signature, now]); // eslint-disable-line react-hooks/exhaustive-deps
  return { live, clock };
}
