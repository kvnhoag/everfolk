import type { WorldPack } from "../types.ts";
import { scaleCropQuantity } from "../demo/resource-scale.ts";

export const RESOURCE_BALANCE_WORLD_VERSION = "alexandria-lives-9";

/** Smaller household crop stocks and flows for new births. Retained packs stay exact. */
export function buildResourceBalanceWorld(base: WorldPack): WorldPack {
  if (base.version !== "alexandria-lives-8" || !base.demo?.startingResources || !base.vocations) {
    throw new Error("Resource balance requires the retained lives-8 free-play world.");
  }
  const world = structuredClone(base), def = world.demo!;
  world.version = RESOURCE_BALANCE_WORLD_VERSION;
  def.resourceScaleDivisor = 10;
  const scaled = (value: number) => scaleCropQuantity(def, value);
  const fields = (object: object, keys: readonly string[]) => {
    const values = object as Record<string, number>;
    for (const key of keys) if (values[key] !== undefined) values[key] = scaled(values[key]);
  };
  // Keep whole goods, money, plots and percentage modifiers in their own units.
  // Crop prices stay unchanged: fewer crops also mean smaller farming earnings.
  fields(def.household, ["startingGrain", "storeCapacity", "yieldPerPlot", "flaxPerPlot", "adultRation", "dealerExtraCapacity"]);
  fields(def.household.animalFeed, ["ox", "donkey"]);
  const profiles = [def.startingResources!.defaults, ...Object.values(def.startingResources!.origins ?? {})];
  for (const profile of profiles) for (const item of ["grain", "flax"] as const) {
    const range = profile[item];
    if (range) { range.min = Math.floor(range.min / 10); range.max = Math.floor(range.max / 10); }
  }
  // A tenant household starts with seed and food, and earns livestock through play.
  const farmer = def.startingResources!.origins?.["tenant-farming-household"];
  if (farmer) farmer.donkey = { min: 0, max: 0 };
  for (const stock of [def.market.start.grower, def.market.start.merchant, def.market.start.army]) fields(stock, ["grain", "flax"]);
  fields(def.market, ["targetGrainStock", "royalAllocation", "maxOrderQuantity", "growerEating", "armyReserve"]);
  fields(def.market.armyDemand, ["quiet", "recruiting", "war"]);
  if (def.market.depth) {
    fields(def.market.depth.halfUnits, ["grain", "flax"]);
    fields(def.market.depth, ["leanYearMeasuresPerStanding"]);
  }
  fields(def.service, ["ration", "escortCargo"]);
  for (const work of Object.values(def.works.works)) fields(work, ["grain"]);
  fields(def.agents.offerQuantity, ["min", "max"]);
  // Bulk supplies for paid projects follow household units; individual recipe
  // materials and their whole finished goods keep their authored batch sizes.
  for (const action of Object.values(world.vocations!.actions)) if (action.kind === "work" && action.inputs) fields(action.inputs, ["grain", "flax"]);

  // Event costs, gifts and their availability gates use the same crop units.
  // Traverse independent authored data, including childhood household responses.
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const item = value as Record<string, unknown>;
    if (item.type === "demo") {
      const effect = item.effect as Record<string, unknown> | undefined;
      if (effect?.kind === "grain" || effect?.kind === "item" && effect.item === "flax") {
        effect.delta = Math.sign(effect.delta as number) * scaled(Math.abs(effect.delta as number));
      }
      if (effect?.kind === "share-grain" || effect?.kind === "grain-to") effect.quantity = scaled(effect.quantity as number);
      const condition = item.condition as Record<string, unknown> | undefined;
      if (condition?.kind === "item" && ["grain", "flax"].includes(condition.item as string)) condition.value = scaled(condition.value as number);
    }
    for (const [key, child] of Object.entries(item)) {
      if (typeof child === "string" && ["text", "description", "title"].includes(key)) {
        item[key] = child.replace(/\b(\d+) (measures of grain|measures|grain measures|grain|bundles of flax|flax bundles|flax)\b/g,
          (_, quantity: string, label: string) => `${scaled(Number(quantity))} ${label}`)
          .replace(/\b[fF]ifty measures\b/g, "5 measures");
      } else visit(child);
    }
  };
  visit(world.events);
  visit(world.character!.activities);
  visit(world.yearlyRules);
  visit(world.yearlyEffects);
  visit(world.influences);
  world.description += " Household grain and flax reserves, harvests and food requirements use a smaller scale; livestock and crafted goods are earned separately.";
  return world;
}
