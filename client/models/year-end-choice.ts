import type { ActivityAvailability, LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import { isUnavailable } from "../../src/demo/availability.ts";
import { YEARLY_ACTION_AGE } from "./year-reminder.ts";
import { focusActivity, YEARLY_FOCUSES, type YearlyFocusId } from "./yearly-focus.ts";

/**
 * The end of a year whose action is still unspent. The game never spends it for the player: the year waits, offers a
 * few real options with the focus's own action recommended, and the player picks one or lets it go. Pure.
 */

/** The kinds of actions the yearly action board offers. */
const YEARLY_KINDS: readonly string[] = ["training", "relationship", "family", "career"];
const OTHER_OPTIONS = 3;

export interface YearEndOption {
  id: string;
  text: string;
  category: string;
  /** The action the player's focus stands for. */
  recommended: boolean;
}

export function yearEndKeyOf(life: Pick<LifeState, "seed" | "age">): string {
  return `${life.seed}:${life.age}`;
}

/** Actions that spend the yearly action. Free ones (ending a friendship, resting while ill) would leave it unspent. */
function yearlyChoices(world: WorldPack, activities: readonly ActivityAvailability[]): ActivityAvailability[] {
  return activities.filter(activity => activity.available && activity.usesYearlyActivity !== false
    && YEARLY_KINDS.includes(activity.category ?? "") && !isUnavailable(world.demo, "activity", activity.id));
}

/** True when the year is about to end with an action the player could still spend. */
export function yearEndChoiceNeeded(engine: Pick<LifeEngine, "world" | "getActivities">, life: LifeState): boolean {
  if (life.phase !== "ready" || life.age < YEARLY_ACTION_AGE || life.character?.lastActivityAge === life.age) return false;
  return yearlyChoices(engine.world, engine.getActivities(life)).length > 0;
}

/**
 * The focus's action first (recommended), then one option of each other kind, so the choice stays short and varied.
 * Without a focus action the list is filled from what remains, so the player always gets a real pick.
 */
export function yearEndOptions(world: WorldPack, activities: readonly ActivityAvailability[], focusId: YearlyFocusId): YearEndOption[] {
  const choices = yearlyChoices(world, activities);
  const focusId_ = focusActivity(world, focusId)?.id;
  const focus = choices.find(activity => activity.id === focusId_);
  const room = OTHER_OPTIONS + (focus ? 0 : 1);
  const rest = choices.filter(activity => activity !== focus);
  const varied = YEARLY_KINDS.map(kind => rest.find(activity => activity.category === kind)).filter((activity): activity is ActivityAvailability => Boolean(activity));
  const others = [...varied, ...rest.filter(activity => !varied.includes(activity))].slice(0, room);
  return [...(focus ? [focus] : []), ...others].map(activity => ({ id: activity.id, text: activity.text, category: activity.category ?? "", recommended: activity === focus }));
}

/** "Study" for the recommended badge; null when the focus has no action of its own. */
export function focusLabel(focusId: YearlyFocusId): string | null {
  return YEARLY_FOCUSES.find(focus => focus.id === focusId && focus.activityId)?.label ?? null;
}
