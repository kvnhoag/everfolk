import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import type { YearlyFocusId } from "./yearly-focus.ts";
import { yearEndChoiceNeeded, yearEndOptions } from "./year-end-choice.ts";

/**
 * Halfway through a year whose action is still unused, the pinned time bar offers it: the focus's own action for one
 * click, or a way to choose. It never runs anything by itself; acting here means the year-end box seldom has to ask.
 * Pure.
 */

/** Share of the year gone before the nudge shows. */
export const NUDGE_AT_PROGRESS = 0.5;

export interface ActionNudge {
  /** The focus's action, offered for one click; null when no focus action can be done this year. */
  focusAction: { id: string; text: string } | null;
}

export function actionNudge(world: WorldPack, life: LifeState, activities: readonly ActivityAvailability[], focusId: YearlyFocusId, progress: number): ActionNudge | null {
  if (!(progress >= NUDGE_AT_PROGRESS)) return null;
  if (!yearEndChoiceNeeded({ world, getActivities: () => [...activities] }, life)) return null;
  const recommended = yearEndOptions(world, activities, focusId).find(option => option.recommended);
  return { focusAction: recommended ? { id: recommended.id, text: recommended.text } : null };
}
