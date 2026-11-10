import type { WorldPack } from "../src/types.ts";

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
