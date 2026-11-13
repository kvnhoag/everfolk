import type { LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import { plannedSeed } from "../../src/capabilities/farming.ts";

/**
 * A field plan checked before it is set: the game's own reason it cannot be set (tried on a copy of the life, so the
 * check and Set planting always agree), and what would go wrong if it were (no seed, no grain plots).
 */
export interface PlantingCheck {
  /** Set planting would be refused with this reason; null when the plan can be set. */
  reason: string | null;
  warnings: string[];
}

/** The first age a yearly action buys flax seed, or null when this world sells none. */
export function flaxSeedAge(world: WorldPack): number | null {
  const ages = (world.character?.activities ?? [])
    .filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === "buy-flax-seed")))
    .map(activity => activity.minAge ?? 0);
  return ages.length ? Math.min(...ages) : null;
}

function plots(count: number, kind: string): string {
  return `${count} ${kind} ${count === 1 ? "plot" : "plots"}`;
}

export function plantingCheck(engine: Pick<LifeEngine, "demo" | "world">, life: LifeState, flaxPlots: number): PlantingCheck {
  let reason: string | null = null;
  try { engine.demo(life, { type: "plan", flaxPlots }); }
  catch (error) { reason = error instanceof Error ? error.message : "This plan cannot be set."; }
  const warnings: string[] = [];
  const total = life.demo?.household.plots ?? 0;
  const seed = plannedSeed(engine.world, life, flaxPlots);
  if (seed && seed.flaxNeed > seed.flaxSeedHeld) {
    const buyAge = flaxSeedAge(engine.world);
    const buy = buyAge === null ? "" : life.age < buyAge ? ` Flax seed can be bought as a yearly action from age ${buyAge}.` : " Buy flax seed with your yearly action first.";
    warnings.push(`${plots(flaxPlots, "flax")} need ${seed.flaxNeed} flax seed and you have ${seed.flaxSeedHeld}. Plots without seed lie fallow and grow nothing.${buy}`);
  }
  if (seed && seed.grainNeed > seed.grainHeld) {
    warnings.push(`Sowing ${plots(total - flaxPlots, "grain")} takes ${seed.grainNeed} grain from the store, which holds ${seed.grainHeld}; unsown plots grow nothing.`);
  }
  if (total > 0 && flaxPlots >= total) {
    warnings.push("With no grain plots, no new grain comes in: the household eats only from the store and the market.");
  }
  return { reason, warnings };
}
