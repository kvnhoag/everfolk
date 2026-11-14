import { useSyncExternalStore } from "react";
import { clockHeld, holdClock, releaseClock, type ClockHolds } from "../models/clock-hold.ts";

/** Holds on the life clock from popovers outside the game's own state (the "?" help tooltips). */
export function createClockHoldStore() {
  let holds: ClockHolds = [];
  const listeners = new Set<() => void>();

  function update(next: ClockHolds): void {
    const changed = clockHeld(next) !== clockHeld(holds);
    holds = next;
    if (changed) for (const listener of [...listeners]) listener();
  }

  return {
    held: (): boolean => clockHeld(holds),
    /** Holds the clock under `key`; the returned function releases it (a second call does nothing). */
    hold(key: string): () => void {
      update(holdClock(holds, key));
      let released = false;
      return () => {
        if (released) return;
        released = true;
        update(releaseClock(holds, key));
      };
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export const clockHoldStore = createClockHoldStore();

/** True while a "?" popover holds the clock. */
export function useClockHeld(): boolean {
  return useSyncExternalStore(clockHoldStore.subscribe, clockHoldStore.held, () => false);
}
