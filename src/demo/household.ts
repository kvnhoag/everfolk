/** Track A (+G) — household, farming, flax, family stages, hunger. */
import type { DemoContext, DemoDefinition, HouseholdState, LifeStateWithDemo, PlanCommand } from "./contracts.ts";
import { LIVESTOCK } from "./types.ts";

export function initialHousehold(def: DemoDefinition): HouseholdState {
  const h = def.household;
  return { grain: h.startingGrain, capacity: h.storeCapacity, plots: h.plots, flaxPlots: 0, flax: 0,
    animals: Object.fromEntries(LIVESTOCK.map(animal => [animal, 0])) as HouseholdState["animals"],
    parents: "working", headSinceAge: null, lastShortfallBps: 0, harvestBonusBps: 0 };
}

/** Grain and flax harvest from plots × labour × flood × skill × ox. */
export function harvest(ctx: DemoContext): void { void ctx; }
/** Tenant rent: a share of the harvest leaves the store. */
export function payRent(ctx: DemoContext): void { void ctx; }
/** Animals then people eat; shortfall bought through `buyForHousehold`; hunger otherwise. */
export function feedHousehold(ctx: DemoContext): void { void ctx; }
/** Spoilage and over-capacity loss; spinning flax into linen with spare labour. */
export function spoilAndSpin(ctx: DemoContext): void { void ctx; }
/** Parents hand over, retire and pass; called once per settled year. */
export function advanceFamily(ctx: DemoContext): void { void ctx; }
/** Free planting plan; throws when invalid. */
export function applyPlan(ctx: DemoContext, command: PlanCommand): void { void ctx; void command; }

export interface HouseholdView {
  grain: number; capacity: number; plots: number; flaxPlots: number; flax: number; linen: number;
  animals: HouseholdState["animals"]; mouths: number; labour: number;
  expectedHarvest: number; expectedRent: number; expectedEating: number; expectedSpoilage: number;
  shortfallBps: number; headOfPlot: boolean; parents: HouseholdState["parents"];
}
export function householdView(def: DemoDefinition, life: LifeStateWithDemo): HouseholdView {
  void def;
  const h = life.demo.household;
  return { grain: h.grain, capacity: h.capacity, plots: h.plots, flaxPlots: h.flaxPlots, flax: h.flax, linen: life.demo.goods.linen,
    animals: h.animals, mouths: 0, labour: 0, expectedHarvest: 0, expectedRent: 0, expectedEating: 0, expectedSpoilage: 0,
    shortfallBps: h.lastShortfallBps, headOfPlot: h.headSinceAge !== null, parents: h.parents };
}
