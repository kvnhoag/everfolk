import { useEffect, useMemo, useState } from "react";
import { liveNoticeKeys, nextNoticeFade, startNoticeClocks, type NoticeClock } from "../models/timed-notices.ts";

/**
 * Shows each key once for `durationMs`, then hides it. A key is visible on the render it first appears in, so no
 * notice flickers in late; `onStart` runs once per key when its clock starts (to remember it across reloads).
 */
export function useNoticeClock(keys: readonly string[], durationMs: number, onStart?: (keys: readonly string[]) => void, limit = Number.POSITIVE_INFINITY): { live: ReadonlySet<string>; clock: NoticeClock } {
  const [clock, setClock] = useState<NoticeClock>(() => new Map());
  const [now, setNow] = useState(() => Date.now());
  const signature = keys.join("\n");
  // Waiting notices take a free slot only after earlier notices expire. Their timers have not started yet.
  const live = useMemo(() => new Set(liveNoticeKeys(clock, keys, Math.max(now, Date.now()), limit)), [clock, signature, now, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveSignature = [...live].join("\n");

  useEffect(() => {
    const fresh = [...live].filter(key => !clock.has(key));
    if (fresh.length === 0) return;
    setClock(previous => startNoticeClocks(previous, fresh, Date.now(), durationMs));
    onStart?.(fresh);
  }, [liveSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const delay = nextNoticeFade(clock, [...live], Date.now());
    if (delay === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), delay + 16);
    return () => window.clearTimeout(timer);
    // `now` re-arms the timer after each fade, so a later notice also leaves on time.
  }, [clock, liveSignature, now]); // eslint-disable-line react-hooks/exhaustive-deps

  return { live, clock };
}
