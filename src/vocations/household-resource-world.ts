import type { WorldPack } from "../types.ts";
import { buildResourceBalanceWorld } from "./resource-balance-world.ts";

export const HOUSEHOLD_RESOURCE_WORLD_VERSION = "alexandria-lives-10";
/** Commercial and aristocratic birth reserves keep their original quantities. */
export const LARGE_RESERVE_ORIGINS = ["merchant-household", "estate-household", "royal-household"] as const;

/** Keep modest working-household rolls and preserve wealthier families' reserves. */
export function buildHouseholdResourceWorld(base: WorldPack): WorldPack {
  const world = buildResourceBalanceWorld(base);
  world.version = HOUSEHOLD_RESOURCE_WORLD_VERSION;
  const resources = world.demo!.startingResources!;
  resources.storeCapacityByOrigin = {};
  for (const id of LARGE_RESERVE_ORIGINS) {
    const original = base.demo!.startingResources!.origins?.[id];
    if (!original || !world.origins.some(origin => origin.id === id)) continue;
    resources.origins![id] = structuredClone(original);
    resources.storeCapacityByOrigin[id] = base.demo!.household.storeCapacity;
  }
  world.description += " Merchant, estate and royal households retain their larger birth reserves and storage.";
  return world;
}
