import { useCallback, useSyncExternalStore } from "react";

/**
 * The field split a player is still building with − and + (after Crop allocation), before Set planting. It lives
 * outside the card, so closing Inventory & Granary, switching tabs or a new year never loses it. It is dropped when it
 * is set, or ignored once the plan or the plots it was made for change.
 */
export interface PlanDraft {
  plots: number;
  /** The plan in effect when the draft was made (flax plots). */
  current: number;
  flax: number;
}

let draft: PlanDraft | null = null;
const listeners = new Set<() => void>();

/** The draft for this household and plan, or null when there is none. */
export function readPlanDraft(plots: number, current: number): number | null {
  return draft && draft.plots === plots && draft.current === current ? draft.flax : null;
}

/** Keeps `next` as the draft; a draft equal to the plan in effect, or null, clears it. */
export function writePlanDraft(next: PlanDraft | null): void {
  draft = next && next.flax !== next.current ? { ...next } : null;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const snapshot = () => draft;

/** The split shown on the card (the draft, else the plan in effect) and a setter that keeps it as the draft. */
export function usePlanDraft(plots: number, current: number): [number, (flax: number) => void] {
  const stored = useSyncExternalStore(subscribe, snapshot, snapshot);
  const flax = stored && stored.plots === plots && stored.current === current ? stored.flax : current;
  const setFlax = useCallback((next: number) => writePlanDraft({ plots, current, flax: next }), [plots, current]);
  return [flax, setFlax];
}
