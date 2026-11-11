import type { TradeItem } from "../../src/demo/types.ts";

export const RESOURCE_IDS = ["grain", "flax", "linen", "drachmas", "ox", "donkey", "silver", "gold", "silk", "labour", "reputation"] as const;
export type ResourceId = typeof RESOURCE_IDS[number];

export const RESOURCES: Record<ResourceId, { label: string; icon: string }> = {
  grain: { label: "Grain", icon: "res-grain" },
  flax: { label: "Flax", icon: "res-flax" },
  linen: { label: "Linen", icon: "res-linen" },
  drachmas: { label: "Drachmas", icon: "res-drachmas" },
  ox: { label: "Ox", icon: "res-ox" },
  donkey: { label: "Donkey", icon: "res-donkey" },
  silver: { label: "Silver", icon: "res-silver" },
  gold: { label: "Gold", icon: "res-gold" },
  silk: { label: "Coan silk", icon: "res-silk" },
  labour: { label: "Labour", icon: "res-labour" },
  reputation: { label: "Reputation", icon: "res-reputation" },
};

/** Icon name for a household resource or a tradeable item. */
export function resourceIcon(id: ResourceId | TradeItem): string {
  return RESOURCES[id].icon;
}
