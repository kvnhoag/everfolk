import type { PlanForecast, PlanSeed } from "./planting-check.ts";

/**
 * Words for the "Plan your fields" card. Before Crop allocation a household plants one crop on every plot, so the card
 * offers two plain choices; afterwards it offers the split. Numbers come from the game's own plan check and forecast.
 */

export const MIX_LOCKED_NOTE = "Mixing crops opens when you learn Crop allocation.";

export interface CropChoice {
  id: "grain" | "flax";
  /** The plan this choice sets: how many plots grow flax. */
  flaxPlots: number;
  title: string;
  icon: string;
  /** One line: what the crop gives and what it needs. */
  line: string;
}

function count(amount: number, one: string, many: string): string {
  return `${amount} ${amount === 1 ? one : many}`;
}

/** "2 grain plots", "1 grain plot and 1 flax plot". */
export function splitText(grainPlots: number, flaxPlots: number): string {
  const parts = [
    ...(grainPlots > 0 ? [count(grainPlots, "grain plot", "grain plots")] : []),
    ...(flaxPlots > 0 ? [count(flaxPlots, "flax plot", "flax plots")] : []),
  ];
  return parts.length ? parts.join(" and ") : "no plots";
}

/** The two single-crop plans, given the seed check of each (null where this world sows without tracking seed). */
export function cropChoices(plots: number, grainSeed: PlanSeed | null, flaxSeed: PlanSeed | null): CropChoice[] {
  const flaxHeld = flaxSeed ? (flaxSeed.flaxSeedHeld === 0 ? "none" : String(flaxSeed.flaxSeedHeld)) : "";
  return [
    { id: "grain", flaxPlots: 0, title: "All grain", icon: "res-grain",
      line: `Food for the household and the rent.${grainSeed ? ` Needs ${grainSeed.grainNeed} grain as seed.` : ""}` },
    { id: "flax", flaxPlots: plots, title: "All flax", icon: "res-flax",
      line: `Fibre to spin into linen and sell.${flaxSeed ? ` Needs ${flaxSeed.flaxNeed} flax seed; you have ${flaxHeld}.` : ""}` },
  ];
}

/** "Planted for next harvest: 2 grain plots, about 180 measures of grain." What is really sown, with its yield. */
export function plantedLine(grainPlots: number, flaxPlots: number, forecast: PlanForecast | null): string {
  if (!forecast) return `Planted for next harvest: ${splitText(grainPlots, flaxPlots)}.`;
  const yields = [
    ...(forecast.grain > 0 ? [`about ${count(forecast.grain, "measure", "measures")} of grain`] : []),
    ...(forecast.flax > 0 ? [`about ${count(forecast.flax, "bundle", "bundles")} of flax`] : []),
  ];
  const sown = splitText(forecast.grainPlots, forecast.flaxPlots);
  return yields.length ? `Planted for next harvest: ${sown}, ${yields.join(" and ")}.` : `Planted for next harvest: ${sown}, but no harvest is expected.`;
}

/** A split chosen with − and + that is not set yet. */
export function pendingLine(grainPlots: number, flaxPlots: number): string {
  return `Not set yet: press Set planting to plant ${splitText(grainPlots, flaxPlots)} for the next harvest.`;
}

/** A plan set before mixing needed Crop allocation stays until the player picks one crop. */
export function mixedCurrentNote(grainPlots: number, flaxPlots: number): string {
  return `Your fields are planned as ${splitText(grainPlots, flaxPlots)}. Choose All grain or All flax to change the plan.`;
}
