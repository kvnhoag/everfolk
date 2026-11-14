import { useSyncExternalStore } from "react";

/**
 * "Finish this tip first": the short note shown where the player clicked while a guided step holds the page, so a
 * blocked click is never silent. One note at a time; a new click moves it and starts its time again.
 */

export const BLOCKED_NOTE_TEXT = "Finish this tip first: press Got it";
/** How long the note stays at the click point. */
export const BLOCKED_NOTE_MS = 1500;

export interface BlockedNote { top: number; left: number; run: number }

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }

/** Room the note needs; it is placed by these sizes so it never runs off the screen. */
export const BLOCKED_NOTE_SIZE: Size = { width: 260, height: 40 };
const OFFSET = 12;
const EDGE = 8;

/** Just below and right of the click, or flipped to the other side near the screen's edges; always on screen. */
export function blockedNotePlacement(point: Point, viewport: Size, size: Size = BLOCKED_NOTE_SIZE): { top: number; left: number } {
  const fitsRight = point.x + OFFSET + size.width <= viewport.width - EDGE;
  const fitsBelow = point.y + OFFSET + size.height <= viewport.height - EDGE;
  const left = fitsRight ? point.x + OFFSET : point.x - OFFSET - size.width;
  const top = fitsBelow ? point.y + OFFSET : point.y - OFFSET - size.height;
  const clamp = (value: number, max: number) => Math.round(Math.max(EDGE, Math.min(value, Math.max(EDGE, max))));
  return { top: clamp(top, viewport.height - size.height - EDGE), left: clamp(left, viewport.width - size.width - EDGE) };
}

type Timers = { set(run: () => void, ms: number): unknown; clear(handle: unknown): void };

const browserTimers: Timers = { set: (run, ms) => setTimeout(run, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

export function createBlockedNoteStore(timers: Timers = browserTimers) {
  let note: BlockedNote | null = null;
  let timer: unknown = null;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of [...listeners]) listener(); };
  return {
    get: (): BlockedNote | null => note,
    /** Shows the note at a click point for BLOCKED_NOTE_MS. */
    show(point: Point, viewport: Size): void {
      if (timer !== null) timers.clear(timer);
      note = { ...blockedNotePlacement(point, viewport), run: (note?.run ?? 0) + 1 };
      timer = timers.set(() => { note = null; timer = null; emit(); }, BLOCKED_NOTE_MS);
      emit();
    },
    hide(): void {
      if (timer !== null) timers.clear(timer);
      timer = null;
      if (note === null) return;
      note = null;
      emit();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export const blockedNoteStore = createBlockedNoteStore();

export function useBlockedNote(): BlockedNote | null {
  return useSyncExternalStore(blockedNoteStore.subscribe, blockedNoteStore.get, () => null);
}
