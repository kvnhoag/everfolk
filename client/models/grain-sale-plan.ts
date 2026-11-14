import type { LifeState, WorldPack } from "../../src/types.ts";
import type { LifeStateWithDemo, TradeItem } from "../../src/demo/contracts.ts";
import { householdView } from "../../src/demo/household.ts";
import { ordinarySeedGrain, plannedSeed } from "../../src/capabilities/farming.ts";

/**
 * How much grain a household can sell without selling its own food. Pure, from the numbers the game already shows:
 * the store, what the household eats next year, and the seed an ordinary sowing keeps back.
 */
export interface GrainSalePlan {
  /** Grain in store now. */
  store: number;
  /** Grain the household eats in a year. */
  eating: number;
  /** Grain kept back to sow; 0 in worlds that sow without tracking seed. */
  seed: number;
  /** The store above eating plus seed, never negative: the default and the largest ordinary sale. */
  surplus: number;
}

export function planFromFacts(store: number, eating: number, seed: number): GrainSalePlan {
  return { store, eating, seed, surplus: Math.max(0, store - eating - seed) };
}

/** The plan for this life, tried on the engine's own household numbers; null where there is no household. */
export function grainSalePlan(world: WorldPack, life: LifeState): GrainSalePlan | null {
  const def = world.demo;
  if (!def || !life.demo) return null;
  const view = householdView(def, life as LifeStateWithDemo, world);
  const sows = plannedSeed(world, life, life.demo.household.flaxPlots) !== null;
  return planFromFacts(view.grain, view.expectedEating, sows ? ordinarySeedGrain(life, def) : 0);
}

interface QuantityFacts {
  item: TradeItem;
  side: "buy" | "sell";
  /** The most that can be ordered at all (held, merchant cash or stock, order cap). */
  limit: number;
  plan: GrainSalePlan | null;
}

function isGrainSale(facts: QuantityFacts): facts is QuantityFacts & { plan: GrainSalePlan } {
  return facts.item === "grain" && facts.side === "sell" && facts.plan !== null;
}

/** What the quantity box holds when a good or side is chosen: the surplus for a grain sale, else 1; 0 when there is nothing to offer. */
export function startingQuantity(facts: QuantityFacts): number {
  if (isGrainSale(facts)) return Math.min(facts.limit, facts.plan.surplus);
  return Math.min(facts.limit, 1);
}

/** What the Max button sets: the surplus for a grain sale, else the limit. */
export function maxSaleQuantity(facts: QuantityFacts): number {
  return isGrainSale(facts) ? Math.min(facts.limit, facts.plan.surplus) : facts.limit;
}

/** The second confirmation's words when selling `quantity` grain would cut into eating and seed; null when it would not. */
export function leavesGrain(plan: GrainSalePlan, quantity: number): string | null {
  if (quantity <= plan.surplus) return null;
  return `This leaves ${Math.max(0, plan.store - quantity)} grain; your household eats about ${plan.eating} a year.`;
}
