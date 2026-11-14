import type { Rect } from "./tutorial-placement.ts";
import type { TutorialHintId } from "./tutorial-hints.ts";
import type { TutorialMode } from "./tutorial-navigation.ts";

/**
 * A guided step: an automatic tip that introduces a section. While one is on screen the clock waits and every other
 * control waits too, so a new player cannot skip past what is being taught. Turning the Tutorial off releases it all
 * at once. Pure.
 */

/** Step 1 of every new life: the time bar, the first thing the player can use. */
export const FIRST_STEP: TutorialHintId = "time-bar";

/** A new life with tips on starts with the clock paused until step 1 is done. A save opened mid-life never waits. */
export function guidedStartPaused({ tipsOn, firstStepSeen, age }: { tipsOn: boolean; firstStepSeen: boolean; age: number }): boolean {
  return tipsOn && !firstStepSeen && age === 0;
}

/** The life waited for step 1, and step 1 is now finished or closed (or tips were turned off): start the clock. */
export function firstStepDone({ pending, tipsOn, firstStepSeen }: { pending: boolean; tipsOn: boolean; firstStepSeen: boolean }): boolean {
  return pending && (!tipsOn || firstStepSeen);
}

export interface GuidedLockFacts {
  tipsOn: boolean;
  /** The tip card is really on screen (not waiting for its section). */
  tipShown: boolean;
  mode: TutorialMode;
  /** The tip sits in an open popup (a decision, the Character popup): that popup keeps working. */
  hosted: boolean;
}

export function guidedStepLocked({ tipsOn, tipShown, mode, hosted }: GuidedLockFacts): boolean {
  return tipsOn && tipShown && mode === "auto" && !hosted;
}

export type NextDecisionAction = "wait-for-tip" | "open-decision" | "advance";

/** Next decision during a guided step only points back at the tip. */
export function nextDecisionAction({ phase, locked }: { phase: "ready" | "choice" | "ended"; locked: boolean }): NextDecisionAction {
  if (locked) return "wait-for-tip";
  return phase === "choice" ? "open-decision" : "advance";
}

/** A full-screen veil with holes cut out (even-odd), as a CSS clip-path. Clicks and hovers pass only through the holes. */
export function shieldClipPath(viewport: { width: number; height: number }, holes: readonly Rect[]): string {
  const box = (rect: Rect) => {
    const [x, y, right, bottom] = [rect.left, rect.top, rect.left + rect.width, rect.top + rect.height].map(Math.round);
    return `M${x} ${y}H${right}V${bottom}H${x}Z`;
  };
  return `path(evenodd, "${[`M0 0H${Math.round(viewport.width)}V${Math.round(viewport.height)}H0Z`, ...holes.map(box)].join(" ")}")`;
}
