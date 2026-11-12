/**
 * Track B — market depth (worlds with `market.depth`, alexandria-lives-4 and later).
 *
 * The player's trades weigh on the merchant's prices: each unit sold lowers the next unit's price as the
 * order fills, each unit bought raises it, and the weight stays on the market for the following years,
 * shrinking each year until the price recovers. Quotes here are in hundredths of a drachma; grain keeps
 * them (a narrow spread needs them), other items round to whole drachmas. Pure: callers move the goods
 * and money, so every drachma paid is received and every unit sold is delivered.
 */
import type { DemoDefinition, DemoState, MarketDepthConfig, TradeItem } from "./contracts.ts";
import { BPS, adjustments, priceBounds } from "./market-rules.ts";

const HUNDREDTHS = 100;
/** Orders are priced in at most this many slices; each slice pays the price at its middle. */
const SLICES = 200;
const PRESSURE_LIMIT = 1_000_000_000;

export interface DepthQuote { bid: number; ask: number }
export interface OrderValue { total: number; from: DepthQuote; to: DepthQuote }

function config(def: DemoDefinition): MarketDepthConfig {
  if (!def.market.depth) throw new Error("This world's market has fixed quotes.");
  return def.market.depth;
}

export function pressureOf(demo: DemoState, item: TradeItem): number {
  return demo.town.pressure?.[item] ?? 0;
}

/** How far the player's recent trades have moved an item's price from its clear level, basis points. */
export function pressureFactorBps(depth: MarketDepthConfig, item: TradeItem, pressure: number): number {
  const half = Math.max(1, depth.halfUnits[item]);
  if (pressure >= 0) return Math.max(depth.minFactorBps, Math.floor(BPS * half / (half + pressure)));
  return Math.min(depth.maxFactorBps, Math.floor(BPS * (half - pressure) / half));
}

/** The merchant's ask before the player's trades weigh on it, in hundredths. */
function clearAsk(def: DemoDefinition, demo: DemoState, item: TradeItem): number {
  const m = def.market;
  if (item !== "grain") return demo.town.prices[item].sell * HUNDREDTHS;
  const { floor, ceiling } = priceBounds(m, "grain");
  const raw = Math.round(m.basePrice.grain * HUNDREDTHS * Math.max(0, BPS + adjustments(def, demo).grain) / BPS);
  const usual = Math.min(ceiling * HUNDREDTHS, Math.max(floor * HUNDREDTHS, raw));
  return Math.max(1, Math.round(usual * config(def).grainAskBps / BPS));
}

function quoteAt(def: DemoDefinition, demo: DemoState, item: TradeItem, pressure: number): DepthQuote {
  const depth = config(def);
  const ask = Math.max(1, Math.round(clearAsk(def, demo, item) * pressureFactorBps(depth, item, pressure) / BPS));
  const spread = item === "grain" ? depth.grainSpreadBps : def.market.spreadBps;
  const bid = Math.max(1, Math.floor(ask * BPS / (BPS + spread)));
  if (item === "grain") return { bid, ask };
  // Other goods trade in whole drachmas, never below one.
  return { bid: Math.max(1, Math.floor(bid / HUNDREDTHS)) * HUNDREDTHS, ask: Math.max(1, Math.round(ask / HUNDREDTHS)) * HUNDREDTHS };
}

/** The merchant's current quote for one unit, in hundredths of a drachma. */
export function depthQuote(def: DemoDefinition, demo: DemoState, item: TradeItem): DepthQuote {
  return quoteAt(def, demo, item, pressureOf(demo, item));
}

/** The quote with no trade weight on the market: what the merchant would pay and ask after a clear year. */
export function clearQuote(def: DemoDefinition, demo: DemoState, item: TradeItem): DepthQuote {
  return quoteAt(def, demo, item, 0);
}

/**
 * Whole drachmas for an order of `quantity`, priced slice by slice as it fills: a sale is paid at the
 * falling bid (rounded down), a purchase at the rising ask (rounded up). Pure.
 */
export function orderValue(def: DemoDefinition, demo: DemoState, item: TradeItem, side: "buy" | "sell", quantity: number): OrderValue {
  const start = pressureOf(demo, item), sign = side === "sell" ? 1 : -1;
  const slices = Math.max(1, Math.min(SLICES, quantity));
  let done = 0, hundredths = 0;
  for (let index = 0; index < slices; index++) {
    const units = Math.floor(quantity * (index + 1) / slices) - done;
    const quote = quoteAt(def, demo, item, start + sign * (done + Math.floor(units / 2)));
    hundredths += units * (side === "sell" ? quote.bid : quote.ask);
    done += units;
  }
  const total = side === "sell" ? Math.floor(hundredths / HUNDREDTHS) : Math.ceil(hundredths / HUNDREDTHS);
  return { total, from: quoteAt(def, demo, item, start), to: quoteAt(def, demo, item, start + sign * quantity) };
}

/** Records the weight of a completed order on the market. */
export function addPressure(demo: DemoState, item: TradeItem, side: "buy" | "sell", quantity: number): void {
  const pressure = (demo.town.pressure ??= {});
  const next = (pressure[item] ?? 0) + (side === "sell" ? quantity : -quantity);
  pressure[item] = Math.max(-PRESSURE_LIMIT, Math.min(PRESSURE_LIMIT, next));
}

/** A year passes: the market works off part of the weight. Items whose weight is gone are dropped. */
export function recoverPressure(def: DemoDefinition, demo: DemoState): void {
  const keep = config(def).keepBps, pressure = demo.town.pressure ?? {};
  for (const item of Object.keys(pressure) as TradeItem[]) {
    const next = Math.trunc(pressure[item]! * keep / BPS);
    if (next === 0) delete pressure[item];
    else pressure[item] = next;
  }
}

/** Standing for bringing `quantity` measures of grain to market in a lean year. */
export function leanYearStanding(def: DemoDefinition, quantity: number): number {
  const depth = config(def);
  return Math.min(depth.leanYearStandingCap, Math.max(1, Math.floor(quantity / Math.max(1, depth.leanYearMeasuresPerStanding))));
}

/** A price in hundredths as journal text: grain with two decimals, other goods in whole drachmas. */
export function priceText(item: TradeItem, hundredths: number): string {
  return item === "grain" ? (hundredths / HUNDREDTHS).toFixed(2) : String(Math.round(hundredths / HUNDREDTHS));
}

/** Whole-store liquidation value at the current curve; fixed-price worlds keep their exact arithmetic. */
export function merchantSaleValue(def: DemoDefinition, demo: DemoState, item: TradeItem, quantity: number): number {
  if (quantity <= 0) return 0;
  return def.market.depth ? orderValue(def, demo, item, "sell", quantity).total : quantity * demo.town.prices[item].buy;
}
