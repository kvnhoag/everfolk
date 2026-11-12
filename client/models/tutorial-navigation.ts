import type { TutorialCharacterSection, TutorialScreen } from "./tutorial-steps.ts";

/** Where the tour is. `run` changes on every (re)start so the same step navigates again. */
export interface TutorialState {
  readonly open: boolean;
  readonly index: number;
  readonly run: number;
}

export type TutorialAction =
  | { type: "start"; index?: number }
  | { type: "next" }
  | { type: "back" }
  | { type: "go"; index: number }
  | { type: "close" };

export const CLOSED_TUTORIAL: TutorialState = Object.freeze({ open: false, index: 0, run: 0 });

function clamp(index: number, total: number): number {
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, total - 1));
}

/** Pure tour transitions. Returns the same object when nothing changes, so subscribers stay quiet. */
export function tutorialTransition(state: TutorialState, action: TutorialAction, total: number): TutorialState {
  if (action.type === "start") return { open: true, index: clamp(action.index ?? 0, total), run: state.run + 1 };
  if (!state.open) return state;
  if (action.type === "close") return { ...state, open: false };
  if (action.type === "next") return state.index >= total - 1 ? { ...state, open: false } : { ...state, index: state.index + 1 };
  const index = action.type === "back" ? clamp(state.index - 1, total) : clamp(action.index, total);
  return index === state.index ? state : { ...state, index };
}

export type TutorialKeyAction = "next" | "back" | "close";

/** Keyboard for the tour card. Enter on a focused button activates that button instead. */
export function tutorialKeyAction(key: string, focusOnButton: boolean): TutorialKeyAction | null {
  if (key === "Escape") return "close";
  if (key === "ArrowRight" || key === "ArrowDown") return "next";
  if (key === "ArrowLeft" || key === "ArrowUp") return "back";
  if (key === "Enter" && !focusOnButton) return "next";
  return null;
}

/** How the game screen should look for a tour step. "keep" leaves the main menu as it is. */
export interface AppScreenPlan {
  menuOpen: boolean | "keep";
  birthPopoverOpen: boolean;
  panel: "character" | null;
  characterSection?: TutorialCharacterSection;
  /** Begin a rolled life through the normal flow. Never true while a life is in progress. */
  beginLife: boolean;
}

/** Plans the game's own navigation for a step. An existing life is always continued, never replaced. */
export function planAppScreen(screen: TutorialScreen, { hasBegun }: { hasBegun: boolean }): AppScreenPlan {
  switch (screen.kind) {
    case "home": return { menuOpen: true, birthPopoverOpen: false, panel: null, beginLife: false };
    case "new-life": return { menuOpen: true, birthPopoverOpen: !hasBegun, panel: null, beginLife: false };
    case "game": return hasBegun
      ? { menuOpen: false, birthPopoverOpen: false, panel: null, beginLife: false }
      : { menuOpen: "keep", birthPopoverOpen: false, panel: null, beginLife: true };
    case "character": return { menuOpen: hasBegun ? false : "keep", birthPopoverOpen: false, panel: "character", characterSection: screen.section, beginLife: !hasBegun };
    case "chain": return { menuOpen: "keep", birthPopoverOpen: false, panel: null, beginLife: false };
  }
}
