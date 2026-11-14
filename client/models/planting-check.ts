import type { LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import { householdView } from "../../src/demo/household.ts";
import { plannedSeed, sowableFlaxPlots } from "../../src/capabilities/farming.ts";
import { capabilityRewards } from "../../src/deep-capabilities/rewards.ts";

/** Seed a plan needs and what the household holds; null where this world sows without tracking seed. */
export type PlanSeed = NonNullable<ReturnType<typeof plannedSeed>>;

/** What the next harvest would bring under a plan: the plots really sown with each crop and the expected yield. */
export interface PlanForecast {
  grainPlots: number;
  flaxPlots: number;
  /** Measures of grain. */
  grain: number;
  /** Bundles of flax. */
  flax: number;
}

/**
 * A field plan checked before it is set: the game's own reason it cannot be set (tried on a copy of the life, so the
 * check and Set planting always agree), what would go wrong if it were (no seed, no grain plots), and what it brings.
 */
export interface PlantingCheck {
  /** Set planting would be refused with this reason; null when the plan can be set. */
  reason: string | null;
  warnings: string[];
  /** Whether this life may mix grain and flax on its plots (Crop allocation learned, or no skills tracked). */
  mixedUnlocked: boolean;
  seed: PlanSeed | null;
  /** The game's forecast with this plan in place; null when the plan cannot be set. */
  forecast: PlanForecast | null;
}

/** The first age a yearly action buys flax seed, or null when this world sells none. */
export function flaxSeedAge(world: WorldPack): number | null {
  const ages = (world.character?.activities ?? [])
    .filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === "buy-flax-seed")))
    .map(activity => activity.minAge ?? 0);
  return ages.length ? Math.min(...ages) : null;
}

/** Mixing grain and flax needs Crop allocation (FC8) wherever skills are tracked, as the game's own plan rule says. */
export function mixedPlanUnlocked(world: WorldPack, life: LifeState): boolean {
  if (world.deepCapabilities) return capabilityRewards(Object.keys(life.deepCapabilities?.learned ?? {})).farm.mixedCrop;
  if (world.capabilities && life.capabilities) return Boolean(life.capabilities.learned.FC8);
  return true;
}

function plots(count: number, kind: string): string {
  return `${count} ${kind} ${count === 1 ? "plot" : "plots"}`;
}

type SeedEngine = Pick<LifeEngine, "demo" | "world" | "getActivities">;

/** Whether flax seed can be bought now: "yes", "later" (too young), "unaffordable", "blocked" or "never" (none sold). */
function flaxSeedPurchase(engine: SeedEngine, life: LifeState): "yes" | "later" | "unaffordable" | "blocked" | "never" {
  const buyAge = flaxSeedAge(engine.world);
  if (buyAge === null) return "never";
  if (life.age < buyAge) return "later";
  const offers = engine.getActivities(life).filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === "buy-flax-seed")));
  if (offers.some(activity => activity.available)) return "yes";
  return offers.some(activity => /afford/i.test(activity.reason ?? "")) ? "unaffordable" : "blocked";
}

/** The way back to a plan that feeds the household: the All grain choice, or the split once mixing is open. */
function grainAdvice(life: LifeState, world: WorldPack): string {
  return mixedPlanUnlocked(world, life) ? "plant grain on every plot so these fields feed the household." : "switch to All grain so these fields feed the household.";
}

/** One sentence on flax plots the flax seed in store cannot cover, then where to get more (or what to do instead). */
function flaxSeedWarning(engine: SeedEngine, life: LifeState, flaxPlots: number, seed: PlanSeed): string {
  const held = seed.flaxSeedHeld, perPlot = seed.flaxNeed / flaxPlots;
  const sown = Math.min(flaxPlots, Math.floor(held / perPlot)), unsown = flaxPlots - sown;
  const purchase = flaxSeedPurchase(engine, life);
  if (sown === 0 && (purchase === "unaffordable" || purchase === "blocked")) {
    return `No flax seed${held > 0 ? " for a single plot" : ""} and ${purchase === "unaffordable" ? "no money to buy it" : "no way to buy it this year"}: ${grainAdvice(life, engine.world)}`;
  }
  const these = flaxPlots === 1 ? "the flax plot" : "these flax plots";
  const shortfall = held === 0 ? `You have no flax seed, so ${these} will grow grain this year.`
    : sown === 0 ? `You have ${held} flax seed and each flax plot needs ${perPlot}, so ${these} will grow grain this year.`
    : `You have ${held} flax seed, enough for ${sown} of the ${flaxPlots} flax plots, so the other ${unsown === 1 ? "one" : unsown} will grow grain this year.`;
  const buy = purchase === "later" ? ` Flax seed can be bought as a yearly action from age ${flaxSeedAge(engine.world)}.`
    : purchase === "yes" ? " Buy flax seed with a yearly action to grow flax."
    : purchase === "unaffordable" ? " You have no money to buy more." : "";
  return shortfall + buy;
}

function planWarnings(engine: SeedEngine, life: LifeState, flaxPlots: number, seed: PlanSeed | null): string[] {
  const warnings: string[] = [];
  const total = life.demo?.household.plots ?? 0;
  if (seed && seed.flaxNeed > seed.flaxSeedHeld) warnings.push(flaxSeedWarning(engine, life, flaxPlots, seed));
  if (seed && seed.grainNeed > seed.grainHeld) {
    warnings.push(`Sowing ${plots(total - flaxPlots, "grain")} needs ${seed.grainNeed} grain as seed and the store holds ${seed.grainHeld}. The household borrows the rest from the royal granary and repays it from the harvest.`);
  }
  // Without flax seed those plots grow grain, so the plan only stops new grain when the flax seed covers every plot.
  const flaxSown = !seed || seed.flaxSeedHeld >= seed.flaxNeed;
  if (total > 0 && flaxPlots >= total && flaxSown) {
    warnings.push("With no grain plots, no new grain comes in: the household eats only from the store and the market.");
  }
  return warnings;
}

function forecastOf(world: WorldPack, planned: LifeState): PlanForecast | null {
  if (!world.demo || !planned.demo) return null;
  const view = householdView(world.demo, planned as LifeStateWithDemo, world);
  const flaxPlots = Math.min(view.flaxPlots, sowableFlaxPlots(world, planned));
  return { grainPlots: view.plots - flaxPlots, flaxPlots, grain: view.expectedHarvest, flax: view.expectedFlax };
}

export function plantingCheck(engine: SeedEngine, life: LifeState, flaxPlots: number): PlantingCheck {
  // The plan already in effect needs no replay: it stands even if a rule learned since would refuse it now.
  const inEffect = flaxPlots === life.demo?.household.flaxPlots;
  let reason: string | null = null, planned: LifeState | null = inEffect ? life : null;
  if (!inEffect) {
    try { planned = engine.demo(life, { type: "plan", flaxPlots }); }
    catch (error) { reason = error instanceof Error ? error.message : "This plan cannot be set."; }
  }
  const seed = plannedSeed(engine.world, life, flaxPlots);
  return {
    reason, warnings: planWarnings(engine, life, flaxPlots, seed), mixedUnlocked: mixedPlanUnlocked(engine.world, life), seed,
    forecast: planned ? forecastOf(engine.world, planned) : null,
  };
}
