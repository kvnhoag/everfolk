import { applyStatDelta } from "../../src/progression.ts";
import { marketQuote } from "../../src/market.ts";
import type { Effect, WorldPack } from "../../src/types.ts";

export interface UniformRoll { first: number; step: number; count: number }

/** Weighted households with sorted cash values and independent resource rolls. */
export interface SocietyWealthGroup {
  weight: number;
  count: number;
  wealthAt: (index: number) => number;
  resources: UniformRoll[];
}

/** Retrieve the population used for the society percentile and median wealth. */
export function getSocietyWealthData(world: WorldPack): SocietyWealthGroup[] {
  // TODO: Retrieve net-worth data from players' recorded lives for this world
  // and compatible world revision. Refresh the population as new players join
  // and their lives progress; keep the authored mock fallback until data exists.
  return getMockSocietyWealthData(world);
}

/** Authored starting households stand in for player-life data for now. */
function getMockSocietyWealthData(world: WorldPack): SocietyWealthGroup[] {
  const economy = world.economy;
  if (!economy) return [];
  const definition = world.stats[economy.stat];
  const maximumWeight = Math.max(...world.origins.map(origin => origin.weight));
  return world.origins.map(origin => {
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
      resources: economy.assets.map(asset => {
        const range = origin.assetRanges?.[asset.id] ?? asset.initialRange ?? { min: 0, max: 0 };
        const unitPrice = marketQuote(world, { age: 0, lastEventAge: {}, eventCounts: {} }, asset.id).sell;
        return { first: range.min * unitPrice, step: unitPrice, count: range.max - range.min + 1 };
      }).filter(roll => roll.first !== 0 || roll.count > 1),
      wealthAt(index: number) {
        let value = first + index;
        for (const effect of effects) {
          value = applyStatDelta(definition, value, effect.delta);
        }
        return Math.round(value * economy.unitsPerPoint);
      },
    };
  });
}
