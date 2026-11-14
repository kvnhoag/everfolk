/**
 * What holds the life clock while the player reads: a tip card or a "?" popover, each under its own key. The clock
 * runs again when the last hold is released, and only if the player had it running (the pause state is untouched).
 * Pure, so the rule is tested.
 */

export type ClockHolds = readonly string[];

export function holdClock(holds: ClockHolds, key: string): ClockHolds {
  return holds.includes(key) ? holds : [...holds, key];
}

export function releaseClock(holds: ClockHolds, key: string): ClockHolds {
  return holds.includes(key) ? holds.filter(item => item !== key) : holds;
}

export function clockHeld(holds: ClockHolds): boolean {
  return holds.length > 0;
}
