import type { TutorialHintId } from "./tutorial-hints.ts";
import { availableHints, hintAvailable, triggeredHints, type TutorialContext, type TutorialView } from "./tutorial-triggers.ts";

/** "auto": the game opened a hint at its stage. "manual": the player opened the tutorial (button or "?"). */
export type TutorialMode = "auto" | "manual";

/** Where the last card closed; automatic hints wait until the player reaches a new screen, popup tab or year. */
export interface TutorialQuiet {
  view: TutorialView;
  section: string | null;
  age: number | null;
}

export interface TutorialState {
  open: boolean;
  mode: TutorialMode;
  /** The current step. Kept after closing so the tutorial reopens where it was. */
  hintId: TutorialHintId | null;
  /** The hints the open card can page through with Back and Next tip. */
  queue: readonly TutorialHintId[];
  seen: readonly TutorialHintId[];
  quiet: TutorialQuiet | null;
  /** Changes on every opening, so the card animates and takes focus again. */
  run: number;
}

export type TutorialAction =
  | { type: "sync" }
  | { type: "open"; hintId?: TutorialHintId }
  | { type: "next" }
  | { type: "back" }
  | { type: "close" };

export const INITIAL_TUTORIAL: TutorialState = Object.freeze({ open: false, mode: "auto", hintId: null, queue: [], seen: [], quiet: null, run: 0 });

/** Shown when the player asks for help on a screen that has no tips of its own. */
const FALLBACK_HINT: TutorialHintId = "about";

function markSeen(seen: readonly TutorialHintId[], id: TutorialHintId | null): readonly TutorialHintId[] {
  return id === null || seen.includes(id) ? seen : [...seen, id];
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function quietHere(quiet: TutorialQuiet | null, context: TutorialContext): boolean {
  return quiet !== null && quiet.view === context.view && quiet.section === context.characterSection && quiet.age === (context.life?.age ?? null);
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

function autoOpen(state: TutorialState, context: TutorialContext): TutorialState {
  if (quietHere(state.quiet, context)) return state;
  const queue = triggeredHints(context, state.seen);
  if (queue.length === 0) return state;
  return { ...state, open: true, mode: "auto", hintId: queue[0], queue, run: state.run + 1 };
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

function close(state: TutorialState, context: TutorialContext): TutorialState {
  if (!state.open) return state;
  return { ...state, open: false, seen: markSeen(state.seen, state.hintId), quiet: { view: context.view, section: context.characterSection, age: context.life?.age ?? null } };
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
    case "next": {
      if (!state.open) return state;
      const index = state.hintId ? state.queue.indexOf(state.hintId) : -1;
      if (index < 0 || index >= state.queue.length - 1) return close(state, context);
      return { ...state, hintId: state.queue[index + 1], seen: markSeen(state.seen, state.hintId) };
    }
    case "back": {
      const index = state.hintId ? state.queue.indexOf(state.hintId) : -1;
      return state.open && index > 0 ? { ...state, hintId: state.queue[index - 1] } : state;
    }
  }
}

/** The card's place in its queue, for "Tip 2 of 3". */
export function tutorialPosition(state: TutorialState): { index: number; total: number } {
  const index = state.hintId ? state.queue.indexOf(state.hintId) : -1;
  return index < 0 ? { index: 0, total: 1 } : { index, total: state.queue.length };
}

export type TutorialKeyAction = "next" | "back" | "close";

/** Keyboard for the card. Arrows page only through queued tips; Enter on a focused button activates that button. */
export function tutorialKeyAction(key: string, focusOnButton: boolean, paged: boolean): TutorialKeyAction | null {
  if (key === "Escape") return "close";
  if (!paged) return null;
  if (key === "ArrowRight" || key === "ArrowDown") return "next";
  if (key === "ArrowLeft" || key === "ArrowUp") return "back";
  if (key === "Enter" && !focusOnButton) return "next";
  return null;
}
