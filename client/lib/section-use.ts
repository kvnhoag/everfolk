import { SECTION_TIPS } from "../models/onboarding-sections.ts";
import { tutorialHint, type TutorialHintId } from "../models/tutorial-hints.ts";

/** Clicks that only ask about a section (its "?") or land on a tip card do not count as using it. */
const NOT_A_USE = ".section-help, .everfolk-tutorial-layer";

function inside(element: Element, selector: string): boolean {
  try { return element.closest(selector) !== null; }
  catch { return false; }
}

/**
 * The section tips whose section a click landed in. Using a section once teaches it: its tip closes if it is showing
 * and never opens later.
 */
export function usedSectionTips(target: EventTarget | null): TutorialHintId[] {
  if (!(target instanceof Element) || inside(target, NOT_A_USE)) return [];
  return SECTION_TIPS.flatMap(tip => (tutorialHint(tip.hint)?.targets ?? []).some(selector => inside(target, selector)) ? [tip.hint] : []);
}
