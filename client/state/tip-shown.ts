import { useSyncExternalStore } from "react";

/**
 * Whether a tip card is actually on screen. An automatic tip can be open while it waits, unseen, for its section to be
 * drawn; only a tip the player can see holds the life clock, so play never stops for something invisible.
 */
let shown = false;
const listeners = new Set<() => void>();

export const tipShownStore = {
  get: (): boolean => shown,
  set(next: boolean): void {
    if (next === shown) return;
    shown = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

export function useTipShown(): boolean {
  return useSyncExternalStore(tipShownStore.subscribe, tipShownStore.get, () => false);
}
