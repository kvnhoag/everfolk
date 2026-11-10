import { getNetWorth } from "../src/economy.ts";
import { applyStatDelta } from "../src/progression.ts";
import type { Effect, LifeState, WorldPack } from "../src/types.ts";

export interface WealthComparison {
  netWorth: number;
  /** Percentage of reference households with strictly less wealth. Ties are excluded. */
  percentile: number;
  medianWealth: number;
}

interface ReferenceHouseholds {
  weight: number;
  count: number;
  wealthAt: (index: number) => number;
}

/** Count a monotone origin distribution without enumerating its starting range. */
function countBelow(group: ReferenceHouseholds, wealth: number, includeEqual = false): number {
  let low = 0, high = group.count;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const value = group.wealthAt(middle);
    if (value < wealth || includeEqual && value === wealth) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Compare current net worth with the pack's authored starting-household mixture.
 * Origin weights and inclusive, uniform starting rolls define this fixed game
 * baseline; it is not a measured historical or age-adjusted population.
 * Reads only: no sampling, extra engine starts, or simulation RNG use.
 */
export function getWealthComparison(world: WorldPack, life: LifeState): WealthComparison | null {
  const economy = world.economy;
  if (!economy || !life.economy) return null;
  const definition = world.stats[economy.stat];
  const maximumWeight = Math.max(...world.origins.map(origin => origin.weight));
  const groups: ReferenceHouseholds[] = world.origins.map(origin => {
    const range = origin.statRanges?.[economy.stat] ?? definition.initialRange;
    const first = range?.min ?? definition.initial;
    const count = range ? range.max - range.min + 1 : 1;
    const effects: Extract<Effect, { type: "stat" }>[] = [];
    for (const effect of origin.effects) {
      if (effect.type === "end") break;
      if (effect.type === "stat" && effect.stat === economy.stat) effects.push(effect);
    }
    return {
      weight: origin.weight / maximumWeight,
      count,
      wealthAt(index) {
        let value = first + index;
        for (const effect of effects) {
          value = applyStatDelta(definition, value, effect.delta);
        }
        return Math.round(value * economy.unitsPerPoint);
      },
    };
  });
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
  const weightBelow = (wealth: number, includeEqual = false) => groups.reduce((sum, group) =>
    sum + group.weight * (countBelow(group, wealth, includeEqual) / group.count), 0);
  const netWorth = getNetWorth(world, life);
  let low = Math.min(...groups.map(group => group.wealthAt(0)));
  let high = Math.max(...groups.map(group => group.wealthAt(group.count - 1)));
  // Currency amounts are whole numbers. The first amount reaching half the
  // weighted population is a support value, including when clamps create ties.
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (weightBelow(middle, true) >= totalWeight / 2) high = middle;
    else low = middle + 1;
  }
  return { netWorth, percentile: Math.max(0, Math.min(100, weightBelow(netWorth) / totalWeight * 100)), medianWealth: low };
}

export function formatWealthPercentile(percentile: number): string {
  if (percentile > 0 && percentile < 0.1) return "<0.1%";
  if (percentile > 99.9 && percentile < 100) return ">99.9%";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(percentile)}%`;
}

/** Describe the nearest end of society's wealth ranking. */
export function formatWealthStanding(percentile: number): string {
  if (percentile === 50) return "At the median";
  const share = percentile < 50 ? percentile : 100 - percentile;
  return `${percentile < 50 ? "Bottom" : "Top"} ${share === 0 ? "<0.1%" : formatWealthPercentile(share)}`;
}
