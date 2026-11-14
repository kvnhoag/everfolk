/**
 * Timing for notices that appear once and fade by themselves (skills learned, the yearly reminder).
 * Pure functions over a map of key -> expiry time, so the stack's lifecycle can be tested without a browser.
 */

export type NoticeClock = ReadonlyMap<string, number>;

/** Starts a clock for every key not yet timed. Keys already timed keep their original expiry; nothing restarts. */
export function startNoticeClocks(clock: NoticeClock, keys: readonly string[], now: number, durationMs: number): NoticeClock {
  const fresh = keys.filter(key => !clock.has(key));
  if (fresh.length === 0) return clock;
  const next = new Map(clock);
  for (const key of fresh) next.set(key, now + durationMs);
  return next;
}

/** The keys still within their time, in the order given. */
export function liveNoticeKeys(clock: NoticeClock, keys: readonly string[], now: number): string[] {
  return keys.filter(key => (clock.get(key) ?? Number.POSITIVE_INFINITY) > now);
}

/** Milliseconds until the next of `keys` fades, or null when none is still showing. */
export function nextNoticeFade(clock: NoticeClock, keys: readonly string[], now: number): number | null {
  const pending = keys.map(key => clock.get(key)).filter((at): at is number => at !== undefined && at > now);
  return pending.length ? Math.min(...pending) - now : null;
}
