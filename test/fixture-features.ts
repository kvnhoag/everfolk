import type { Condition, WorldPack } from "../src/types.ts";

/** A synthetic single-origin fixture cannot keep tasks or discovery links to
 * households removed from that fixture. Full-world coverage keeps these links. */
export function pruneRemovedOriginActivities(world: WorldPack): void {
  const origins = new Set(world.origins.map(origin => origin.id));
  const referencesMissing = (condition: Condition | undefined): boolean => {
    if (!condition) return false;
    if (condition.type === "origin") return !origins.has(condition.origin);
    if (condition.type === "all" || condition.type === "any") return condition.conditions.some(referencesMissing);
    return condition.type === "not" && referencesMissing(condition.condition);
  };
  if (world.character) world.character.activities = world.character.activities.filter(activity => !referencesMissing(activity.when));
  const retained = {
    origins,
    jobs: new Set(world.character?.jobs.map(job => job.id) ?? []),
    activities: new Set(world.character?.activities.map(activity => activity.id) ?? []),
  };
  for (const asset of world.economy?.assets ?? []) {
    if (!asset.context) continue;
    for (const key of ["origins", "jobs", "activities"] as const) {
      const filtered = asset.context[key]?.filter(id => retained[key].has(id));
      if (filtered?.length) asset.context[key] = filtered;
      else delete asset.context[key];
    }
    if (!Object.keys(asset.context).length) delete asset.context;
  }
}

/** Isolated chronology, social and skill fixtures remove market news entirely.
 * Their event subsets cannot retain signal references to the removed stories. */
export function withoutMarketSignals(world: WorldPack): WorldPack {
  if (world.economy?.market) world.economy.market.shocks = [];
  return world;
}

/** Remove optional credit when a synthetic fixture deliberately narrows events.
 * Keeping its activities without the configured collection events is invalid.
 * The current loan route is exercised by dedicated ledger/content tests. */
export function withoutMoneylender(world: WorldPack): WorldPack {
  if (!world.economy?.moneylender) return world;
  const referencesLoan = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(referencesLoan);
    const data = value as Record<string, unknown>;
    return data.type === "loan" || data.type === "loan-overdue" || Object.values(data).some(referencesLoan);
  };
  world.events = world.events.filter(event => !referencesLoan(event));
  if (world.character) world.character.activities = world.character.activities.filter(activity => !referencesLoan(activity));
  delete world.economy.moneylender;
  return world;
}
