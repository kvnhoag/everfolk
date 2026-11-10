import type { Comparison, Condition, Effect } from "../../src/types.ts";

/** Small builders for authored influence content; output is plain engine JSON. */
export const stat = (id: string, delta: number): Effect => ({ type: "stat", stat: id, delta });
export const skill = (id: string, delta: number): Effect => ({ type: "skill", skill: id, delta });
export const flag = (id: string, value = true): Effect => ({ type: "flag", flag: id, value });
export const cash = (delta: number): Effect => ({ type: "cash", delta });

export const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
export const any = (...conditions: Condition[]): Condition => ({ type: "any", conditions });
export const not = (condition: Condition): Condition => ({ type: "not", condition });
export const age = (op: Comparison, value: number): Condition => ({ type: "age", op, value });
export const ageBetween = (min: number, max: number): Condition[] => [age("gte", min), age("lte", max)];
export const hasFlag = (id: string, value = true): Condition => ({ type: "flag", flag: id, value });
export const hasSkill = (id: string, value: number): Condition => ({ type: "skill", skill: id, op: "gte", value });
export const statAtLeast = (id: string, value: number): Condition => ({ type: "stat", stat: id, op: "gte", value });
export const statAtMost = (id: string, value: number): Condition => ({ type: "stat", stat: id, op: "lte", value });
export const cashAtLeast = (value: number): Condition => ({ type: "cash", op: "gte", value });
export const origin = (id: string): Condition => ({ type: "origin", origin: id });
export const inJob = (...ids: string[]): Condition => any(...ids.map((id): Condition => ({ type: "job", job: id })));

/** Start year of worlds/alexandria-0.33.0.json; every ranked life is born in it. */
export const WORLD_START_YEAR = -350;
/**
 * Activated events are appended after the pack's events, so age-triggered decisions
 * lose every pacing slot to earlier entries. A year trigger at the world's start is
 * the pack's own idiom for "offer as soon as `when` holds": a hard anchor that fires once.
 */
export const WHEN_ELIGIBLE = { type: "year", at: WORLD_START_YEAR } as const;

export const MILITARY_JOBS = ["soldier", "officer", "general"] as const;
/**
 * A season of levy service. It records service without assigning the soldier job:
 * job effects must meet the job's skill requirements when applied, which a
 * levied civilian may not, and a levy should not end the player's own career.
 */
export const LEVY_SERVICE: readonly Effect[] = [flag("army-service")];

/** Freezes catalog data all the way down so no caller can change shared content. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
