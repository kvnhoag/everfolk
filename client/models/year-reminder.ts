import { PLANTING_HINT_AGE } from "./tutorial-triggers.ts";

/** The age the yearly personal action board appears. */
export const YEARLY_ACTION_AGE = 6;

/** What the current year leaves for the player to do, read from the life. */
export interface YearTaskFacts {
  age: number;
  /** "ready" while the year runs; reminders wait during decisions and stop when the life ends. */
  phase: "ready" | "choice" | "ended";
  /** The household has fields to plan (the free-play economy is on). */
  hasFields: boolean;
  /** The yearly focus buttons are shown at this age. */
  focusShown: boolean;
  /** The yearly action has already been spent this year. */
  actionUsed: boolean;
  /**
   * The field plan needs a look this year: the first year it opens, or the store or the plan has a problem (overfull,
   * no seed, no grain plots). A plan carries over by itself, so a good plan is not asked about again.
   */
  plantingAttention: boolean;
}

export type YearTask = "planting" | "focus" | "action";

/** Each task's section, as selector alternatives (the planting card when the drawer is open, else its toggle). */
export const YEAR_TASK_TARGETS: Record<YearTask, readonly string[]> = {
  planting: [".aoe-planting-row", ".aoe-inventory-toggle"],
  focus: [".yearly-focus"],
  action: [".life-yearly-action-deck"],
};

const LABELS: Record<YearTask, string> = { planting: "plan your fields", focus: "check your focus", action: "choose this year's action" };

/** The tasks still open this year, in the order they appear on screen. */
export function yearTasks(facts: YearTaskFacts): YearTask[] {
  if (facts.phase !== "ready") return [];
  return [
    ...(facts.hasFields && facts.age >= PLANTING_HINT_AGE && facts.plantingAttention ? ["planting" as const] : []),
    ...(facts.focusShown ? ["focus" as const] : []),
    ...(facts.age >= YEARLY_ACTION_AGE && !facts.actionUsed ? ["action" as const] : []),
  ];
}

/** "Plan your fields, check your focus and choose this year's action." */
export function yearReminderText(tasks: readonly YearTask[]): string {
  const parts = tasks.map(task => LABELS[task]);
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] ?? "";
  return joined ? `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.` : "";
}

/** One reminder per life and year; the key never repeats, so a year is only announced once. */
export function yearReminderKey(lifeKey: string, age: number): string {
  return `year-reminder:${lifeKey}:${age}`;
}
