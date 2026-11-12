/**
 * Track B — the free-play trade economy (alexandria-lives-4). Older revisions keep their exact rules:
 * every rule here is opt-in world data read by `src/demo/market-depth.ts` and `src/vocations/trade.ts`.
 *
 * - Grain sells for less the more of it the player brings in a year, and the price recovers over the next years.
 * - Narrower spreads: grain asks 20% over its bid (was 2 dr against 1), other goods 10% (was 25%),
 *   and the workshop merchant pays 90% of a finished good's value (was 80%).
 * - Trades move prices the player can see, and the journal says so.
 * - Finished goods pay a living margin: a full-time potter or weaver out-earns a hired farmhand.
 */
import type { WorldPack } from "../types.ts";
import type { MarketDepthConfig } from "../demo/types.ts";

export const MARKET_DEPTH: MarketDepthConfig = {
  halfUnits: { grain: 1200, flax: 200, silver: 20, gold: 4, silk: 6, linen: 20, ox: 3, donkey: 4 },
  keepBps: 3000,
  minFactorBps: 2500,
  maxFactorBps: 25_000,
  grainAskBps: 7000,
  grainSpreadBps: 2000,
  leanYearMeasuresPerStanding: 250,
  leanYearStandingCap: 4,
};

/** Spread for goods other than grain (older packs: 2500). */
export const GOODS_SPREAD_BPS = 1000;
/** Share of a finished good's value the workshop merchant pays (older packs: 8000). */
export const CRAFT_BID_BPS = 9000;

/** Finished goods' value (older packs: garment 100, dyed 130, vessel 20, decorated 24, clay model 12, relief 90, figure 200). */
export const CRAFT_ASKS: Record<string, number> = {
  garment: 170, "dyed-garment": 210, vessel: 75, "decorated-vessel": 90, "clay-model": 30, "small-relief": 140, "stone-figure": 260,
};

/** Buyers who return each year for each product (older packs: 30 for a whole life). */
export const YEARLY_BUYERS: Record<string, number> = {
  thread: 48, linen: 16, garment: 10, "dyed-garment": 8, "ceremonial-garment": 6,
  vessel: 16, "decorated-vessel": 12, "clay-model": 16, relief: 4, "stone-figure": 2, bust: 2, "large-relief": 1, monument: 1,
};

/** The workshop merchant's finite purse; it pays for every finished good and every restocked material (older packs: 20,000). */
export const WORKSHOP_MERCHANT_CASH = 100_000;

export function applyTradeEconomy(world: WorldPack): void {
  const market = world.demo!.market, vocations = world.vocations!;
  market.spreadBps = GOODS_SPREAD_BPS;
  market.depth = structuredClone(MARKET_DEPTH);
  for (const [recipe, ask] of Object.entries(CRAFT_ASKS)) vocations.recipes[recipe].baseAsk = ask;
  vocations.trade = { bidBps: CRAFT_BID_BPS, yearlyDemand: { ...YEARLY_BUYERS } };
  vocations.accounts.merchant = WORKSHOP_MERCHANT_CASH;
  // One sale sells the whole lot to this year's buyers.
  for (const activity of world.character!.activities) {
    const sale = /^v-sell-(.+)$/.exec(activity.id);
    if (!sale) continue;
    activity.text = `Sell your ${sale[1].replaceAll("-", " ")} lot to this year's funded buyers`;
    for (const outcome of activity.outcomes) outcome.text = activity.text;
  }
}
