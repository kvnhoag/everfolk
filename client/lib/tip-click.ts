import { tutorialHint, type TutorialHintId } from "../models/tutorial-hints.ts";
import type { TutorialState } from "../models/tutorial-navigation.ts";

/**
 * One click both acts and closes: a click on the section a tip points at (Resume, a focus button, a Do card) does its
 * own work first, and only then completes the tip. Closing the tip before the click reaches its control would redraw
 * the screen under the pointer (Resume turning into Pause, a card moving), so the first click would seem to do nothing.
 */

interface Closest { closest(selector: string): unknown }

function isElement(target: unknown): target is Closest {
  return typeof target === "object" && target !== null && typeof (target as Closest).closest === "function";
}

function inside(element: Closest, selector: string): boolean {
  try { return element.closest(selector) !== null; }
  catch { return false; }
}

/** Clicks on the tip card itself or a section's "?" never count as using the section. */
const NOT_A_USE = [".section-help", ".everfolk-tutorial-layer"];

/**
 * The tips a click completes: the section tips it landed in, plus the automatic tip on screen when the click hit any
 * of that tip's targets (tips such as Notifications are not section tips but still close when their target is used).
 */
export function tipsCompletedByClick(target: unknown, sectionTips: readonly TutorialHintId[],
  state: Pick<TutorialState, "open" | "mode" | "hintId">): TutorialHintId[] {
  if (!isElement(target) || NOT_A_USE.some(selector => inside(target, selector))) return [];
  const active = state.open && state.mode === "auto" && state.hintId ? state.hintId : null;
  const hitsActive = active !== null && !sectionTips.includes(active)
    && (tutorialHint(active)?.targets ?? []).some(selector => inside(target, selector));
  return hitsActive ? [...sectionTips, active] : [...sectionTips];
}

/**
 * The click completes the automatic tip on screen: its lock must lift before the click's own handler runs, so a
 * control that checks the lock (Next decision) acts on this same click instead of pointing back at the tip.
 */
export function completesShownTip(hintIds: readonly TutorialHintId[], state: Pick<TutorialState, "open" | "mode" | "hintId">): boolean {
  return state.open && state.mode === "auto" && state.hintId !== null && hintIds.includes(state.hintId);
}

export type Schedule = (run: () => void) => unknown;

const afterHandlers: Schedule = run => setTimeout(run, 0);

/**
 * Completes the tips once the click has reached its own control and that control's handlers have run (a timer fires
 * after the whole event dispatch, React's included). Returns whether anything was scheduled.
 */
export function completeAfterClick(hintIds: readonly TutorialHintId[], complete: (ids: readonly TutorialHintId[]) => void,
  schedule: Schedule = afterHandlers): boolean {
  if (hintIds.length === 0) return false;
  const ids = [...hintIds];
  schedule(() => complete(ids));
  return true;
}
