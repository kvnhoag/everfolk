import type { LifeState } from "../src/types.ts";

export function playbackYearKey(life: Pick<LifeState, "worldFingerprint" | "seed" | "age">): string {
  return JSON.stringify([life.worldFingerprint, life.seed, life.age]);
}

/** Active year time, normalized so speed changes retain the fraction already lived. */
export function createPlaybackClock(initialKey: string, initialDurationMs: number) {
  let key = initialKey;
  let durationMs = initialDurationMs;
  let progress = 0;
  let previous: number | null = null;
  let generation = 0;
  let running = false;
  let completed = false;

  function tick(now: number): void {
    if (previous !== null && Number.isFinite(now) && now >= previous) {
      progress = Math.min(1, progress + (now - previous) / durationMs);
      previous = now;
    }
  }
  function snapshot() {
    return { progress, remainingMs: Math.max(0, durationMs * (1 - progress)) };
  }
  function reset(nextKey: string): void {
    key = nextKey;
    progress = 0;
    previous = null;
    running = false;
    completed = false;
    generation++;
  }
  return {
    read(now?: number) {
      if (now !== undefined) tick(now);
      return snapshot();
    },
    pause(now: number) {
      tick(now);
      previous = null;
      running = false;
      generation++;
      return snapshot();
    },
    hold(nextKey: string, nextDurationMs: number, now: number) {
      if (nextKey !== key) reset(nextKey);
      tick(now);
      durationMs = nextDurationMs;
      previous = null;
      running = false;
      generation++;
      return snapshot();
    },
    resume(nextKey: string, nextDurationMs: number, now: number): number {
      if (nextKey !== key) reset(nextKey);
      tick(now);
      durationMs = nextDurationMs;
      running = !completed;
      previous = running ? now : null;
      return ++generation;
    },
    isCurrent(token: number): boolean { return running && generation === token; },
    takeDue(token: number, now: number): boolean {
      if (!running || completed || generation !== token) return false;
      tick(now);
      if (progress < 1) return false;
      completed = true;
      previous = null;
      running = false;
      generation++;
      return true;
    },
    reset,
    setYear(nextKey: string): void { if (nextKey !== key) reset(nextKey); },
  };
}
