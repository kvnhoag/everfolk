/** Track D — seeded year conditions (flood, army, road). Pure; demo random stream only. */
import type { ConditionFamily, DemoContext, DemoDefinition, Episode, LifeStateWithDemo, YearConditions } from "./contracts.ts";

/** At birth: seeded episodes for each family inside its 50–100-year window. */
export function scheduleConditions(ctx: DemoContext): Record<ConditionFamily, Episode[]> {
  void ctx;
  return { flood: [], army: [], road: [] };
}

/** Conditions for the life's current age, from the schedule plus causal pressure (road). */
export function conditionsAt(ctx: DemoContext): YearConditions {
  void ctx;
  return { flood: "normal", army: "quiet", road: "safe", fresh: [] };
}

/** After a year settles: set `demo.year` for the new age and journal what changed. */
export function rollYear(ctx: DemoContext): void {
  ctx.demo.year = conditionsAt(ctx);
}

export interface YearView { flood: string; army: string; road: string; lines: string[] }
/** Read-only "This year" card. */
export function yearView(def: DemoDefinition, life: LifeStateWithDemo): YearView {
  void def;
  const { flood, army, road } = life.demo.year;
  return { flood, army, road, lines: [] };
}
