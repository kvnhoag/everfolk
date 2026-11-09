/** Active presentation time: slow foreground frames count, hidden time does not. */
export function createBirthRollClock(duration: number, initialElapsed = 0) {
  let elapsed = Math.max(0, Math.min(duration, initialElapsed));
  let previous: number | null = null;
  const tick = (now: number): number => {
    if (previous !== null && Number.isFinite(now) && now >= previous) {
      elapsed = Math.min(duration, elapsed + now - previous);
      previous = now;
    }
    return elapsed;
  };
  return {
    tick,
    resume(now: number): void { previous = Number.isFinite(now) && elapsed < duration ? now : null; },
    pause(now: number): number { tick(now); previous = null; return elapsed; },
    finish(): number { elapsed = duration; previous = null; return elapsed; },
  };
}
