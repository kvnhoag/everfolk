/** Track B — the fixed price rules shared by quotes and market depth. Pure: never changes state. */
import type { ArmyLevel, DemoDefinition, DemoState, FloodLevel, MarketConfig, RoadLevel, TradeItem } from "./contracts.ts";

export const BPS = 10_000;

/** Optional tuning with the defaults used when a world leaves a field out. */
export function tuning(m: MarketConfig) {
  return {
    growerEating: m.growerEating ?? 2800,
    growerSpoilageBps: m.growerSpoilageBps ?? 800,
    growerReleaseBps: m.growerReleaseBps ?? 6000,
    merchantMaxStockBps: m.merchantMaxStockBps ?? 15_000,
    armyPurseReserve: m.armyPurseReserve ?? 1000,
    armyPremiumBps: m.armyPremiumBps ?? { quiet: 0, recruiting: 2500, war: 5000 } satisfies Record<ArmyLevel, number>,
    metalsPressureBps: m.metalsPressureBps ?? { quiet: 0, recruiting: 2000, war: 5000 } satisfies Record<ArmyLevel, number>,
    silkPressureBps: m.silkPressureBps ?? { safe: 0, uneasy: 1500, dangerous: 4000 } satisfies Record<RoadLevel, number>,
    cropPressureBps: m.cropPressureBps ?? { low: 2500, normal: 0, high: -2500 } satisfies Record<FloodLevel, number>,
    maxAnimals: m.maxAnimals ?? 3,
    minTradeAge: m.minTradeAge ?? 12,
    fairTradeReputation: m.fairTradeReputation ?? 1,
  };
}

export function priceBounds(m: MarketConfig, item: TradeItem): { floor: number; ceiling: number } {
  const base = m.basePrice[item];
  const floor = Math.max(1, Math.floor(base * m.priceFloorBps / BPS));
  return { floor, ceiling: Math.max(floor, Math.floor(base * m.priceCeilingBps / BPS)) };
}

/** Base price moved by `adjustBps`, rounded and clamped to the item's floor and ceiling. */
export function rulePrice(m: MarketConfig, item: TradeItem, adjustBps: number): number {
  const { floor, ceiling } = priceBounds(m, item);
  const raw = Math.round(m.basePrice[item] * Math.max(0, BPS + adjustBps) / BPS);
  return Math.min(ceiling, Math.max(floor, raw));
}

/** What the merchant pays: its asking price less the spread, never below one drachma. */
export function buyPrice(m: MarketConfig, sell: number): number {
  return Math.max(1, Math.floor(sell * BPS / (BPS + m.spreadBps)));
}

/**
 * Grain: stock below `targetGrainStock` raises the price (up to +100% when empty), stock above lowers
 * it (at most −50%); army demand over the quiet level and the road's transport cost add to it; the
 * flood's crop pressure moves it. Metals answer to the army, silk to the road, flax and linen to the flood.
 */
export function adjustments(def: DemoDefinition, demo: DemoState): Record<TradeItem, number> {
  const m = def.market, t = tuning(m), year = demo.year;
  const target = Math.max(1, m.targetGrainStock);
  const stockBps = Math.min(BPS, Math.max(-5000, Math.round((m.targetGrainStock - demo.town.merchant.grain) * BPS / target)));
  const demandBps = Math.round(Math.max(0, m.armyDemand[year.army] - m.armyDemand.quiet) * BPS / target);
  const crop = t.cropPressureBps[year.flood];
  const metals = t.metalsPressureBps[year.army];
  return {
    grain: stockBps + demandBps + m.transportCostBps[year.road] + crop,
    flax: crop, linen: crop, silver: metals, gold: metals, silk: t.silkPressureBps[year.road], ox: 0, donkey: 0,
  };
}
