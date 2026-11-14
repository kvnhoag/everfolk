import type { TutorialHintId } from "./tutorial-hints.ts";
import { availableHints, hintAvailable, triggeredHints, tutorialYearKey, yearAllowsTip, type TutorialContext } from "./tutorial-triggers.ts";

/** "auto": the game opened a hint at its stage. "manual": the player opened the tutorial (button or "?"). */
export type TutorialMode = "auto" | "manual";

/** Sections to light up instead of opening a card, when the player has turned tips off. */
export interface TutorialFlash {
  ids: readonly TutorialHintId[];
  /** Changes on every flash, so the same section can light up again. */
  run: number;
}

export interface TutorialState {
  open: boolean;
  /** Tips open as cards when a new section appears. Off: the section's border glows for a few seconds instead. */
  tipsOn: boolean;
  /** The latest sections lit up while tips are off. */
  flash: TutorialFlash | null;
  mode: TutorialMode;
  /** The current step. Kept after closing so the tutorial reopens where it was. */
  hintId: TutorialHintId | null;
  /** The hints the open card can page through with Back and Next tip; an automatic tip stands alone. */
  queue: readonly TutorialHintId[];
  seen: readonly TutorialHintId[];
  /** Changes on every opening, so the card animates and takes focus again. */
  run: number;
  /** The in-game year (life and age) of the last automatic tip: at most one opens per year, the rest wait. */
  tipYear: string | null;
}

export type TutorialAction =
  | { type: "sync" }
  | { type: "open"; hintId?: TutorialHintId }
  | { type: "next" }
  | { type: "back" }
  | { type: "close" }
  /** The player used these sections: their tips are learned, and an automatic tip on one of them closes. */
  | { type: "used"; hintIds: readonly TutorialHintId[] }
  /** A life was entered mid-way (a loaded save): tips whose stage already passed count as seen. */
  | { type: "enter"; passed: readonly TutorialHintId[] }
  | { type: "tips"; on: boolean };

export const INITIAL_TUTORIAL: TutorialState = Object.freeze({ open: false, tipsOn: true, flash: null, mode: "auto", hintId: null, queue: [], seen: [], run: 0, tipYear: null });

/** Shown when the player asks for help on a screen that has no tips of its own. */
const FALLBACK_HINT: TutorialHintId = "about";

function markSeen(seen: readonly TutorialHintId[], id: TutorialHintId | null): readonly TutorialHintId[] {
  return id === null || seen.includes(id) ? seen : [...seen, id];
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** The hint the Tutorial button opens: the current step while it is on screen, else this screen's most relevant one. */
export function resolveManualHint(context: TutorialContext, current: TutorialHintId | null, seen: readonly TutorialHintId[]): TutorialHintId {
  const available = availableHints(context);
  if (current && available.includes(current)) return current;
  return triggeredHints(context, seen)[0] ?? available.find(id => !seen.includes(id)) ?? available[0] ?? FALLBACK_HINT;
}

function manualQueue(context: TutorialContext, hintId: TutorialHintId): TutorialHintId[] {
  const available = availableHints(context);
  return available.includes(hintId) ? available : [hintId, ...available];
}

/**
 * Opens the next unseen tip that has reached its stage. One tip at a time, and at most one per in-game year: the
 * others wait, in teaching order, for a later year, so the game never stops for several tips in a row.
 */
function autoOpen(state: TutorialState, context: TutorialContext): TutorialState {
  const due = triggeredHints(context, state.seen);
  if (due.length === 0) return state;
  // Tips off: each new section only glows once. It counts as seen, so it does not glow again.
  if (!state.tipsOn) return { ...state, seen: due.reduce(markSeen, state.seen), flash: { ids: due, run: (state.flash?.run ?? 0) + 1 } };
  const next = due.find(id => yearAllowsTip(id, context, state.tipYear));
  if (!next) return state;
  return { ...state, open: true, mode: "auto", hintId: next, queue: [next], run: state.run + 1, tipYear: tutorialYearKey(context) ?? state.tipYear };
}

/** The screen or the life changed: keep, follow, or quietly drop the open card, then let a new stage's hint open. */
function sync(state: TutorialState, context: TutorialContext): TutorialState {
  if (!state.open) return autoOpen(state, context);
  if (state.hintId && hintAvailable(state.hintId, context)) {
    const queue = state.queue.filter(id => id === state.hintId || hintAvailable(id, context));
    return sameList(queue, state.queue) ? state : { ...state, queue };
  }
  if (state.mode === "manual") {
    const available = availableHints(context);
    if (available.length === 0) return { ...state, open: false };
    const hintId = resolveManualHint(context, null, state.seen);
    return { ...state, hintId, queue: manualQueue(context, hintId) };
  }
  // An automatic hint whose section left the screen stays unseen and returns with its section.
  return autoOpen({ ...state, open: false }, context);
}

/** Closing marks the tip seen; the next waiting tip, if any, takes its place. */
function close(state: TutorialState, context: TutorialContext): TutorialState {
  if (!state.open) return state;
  return autoOpen({ ...state, open: false, seen: markSeen(state.seen, state.hintId) }, context);
}

function used(state: TutorialState, context: TutorialContext, hintIds: readonly TutorialHintId[]): TutorialState {
  const fresh = hintIds.filter(id => !state.seen.includes(id));
  const closes = state.open && state.mode === "auto" && state.hintId !== null && hintIds.includes(state.hintId);
  if (closes) return close({ ...state, seen: fresh.reduce(markSeen, state.seen) }, context);
  return fresh.length ? { ...state, seen: fresh.reduce(markSeen, state.seen) } : state;
}

function enter(state: TutorialState, context: TutorialContext, passed: readonly TutorialHintId[]): TutorialState {
  const fresh = passed.filter(id => !state.seen.includes(id));
  if (fresh.length === 0) return state;
  const seen = fresh.reduce(markSeen, state.seen);
  const stale = state.open && state.mode === "auto" && state.hintId !== null && fresh.includes(state.hintId);
  return stale ? autoOpen({ ...state, seen, open: false }, context) : { ...state, seen };
}

/** Pure tutorial transitions. Returns the same object when nothing changes, so subscribers stay quiet. */
export function tutorialReducer(state: TutorialState, action: TutorialAction, context: TutorialContext): TutorialState {
  switch (action.type) {
    case "sync": return sync(state, context);
    case "open": {
      const hintId = action.hintId ?? resolveManualHint(context, state.hintId, state.seen);
      return { ...state, open: true, mode: "manual", hintId, queue: manualQueue(context, hintId), run: state.run + 1 };
    }
    case "close": return close(state, context);
    case "used": return used(state, context, action.hintIds);
    case "enter": return enter(state, context, action.passed);
    // Paging is the player asking for the next tip, so it shows like a tip they opened: it never waits invisibly
    // for a section that is not drawn right now (a faded notice, a board hidden during a decision).
    case "next": {
      if (!state.open) return state;
      const index = state.hintId ? state.queue.indexOf(state.hintId) : -1;
      if (index < 0 || index >= state.queue.length - 1) return close(state, context);
      return { ...state, mode: "manual", hintId: state.queue[index + 1], seen: markSeen(state.seen, state.hintId) };
    }
    case "back": {
      const index = state.hintId ? state.queue.indexOf(state.hintId) : -1;
      return state.open && index > 0 ? { ...state, mode: "manual", hintId: state.queue[index - 1] } : state;
    }
    // The open card stays open; only the next new section changes how it is shown.
    case "tips": return state.tipsOn === action.on ? state : { ...state, tipsOn: action.on };
  }
}

/** The card's place in its queue, for "Tip 2 of 3". */
export function tutorialPosition(state: TutorialState): { index: number; total: number } {
  const index = state.hintId ? state.queue.indexOf(state.hintId) : -1;
  return index < 0 ? { index: 0, total: 1 } : { index, total: state.queue.length };
}

export type TutorialKeyAction = "next" | "back" | "close";

/** Keyboard for the card. Arrows page only through queued tips; Enter on a focused control activates that control. */
export function tutorialKeyAction(key: string, focusOnButton: boolean, paged: boolean): TutorialKeyAction | null {
  if (key === "Escape") return "close";
  if (!paged) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return "next";
  if (key === "ArrowLeft" || key === "ArrowUp") return "back";
  if (key === "Enter" && !focusOnButton) return "next";
  return null;
}
