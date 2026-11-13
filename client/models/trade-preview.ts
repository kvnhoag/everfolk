import type { LifeEngine, LifeState, WorldPack } from "../../src/types.ts";
import type { DemoDefinition, LifeStateWithDemo, TradeCommand, TradeItem } from "../../src/demo/contracts.ts";
import { orderValue, priceText } from "../../src/demo/market-depth.ts";
import { householdView } from "../../src/demo/household.ts";

/**
 * What a market order will do, shown before anything changes hands: what you give and get, how the price moves as
 * the order fills, what is left in the store, and that it uses the year's only visit. Pure: the order is tried on a
 * copy of the life with the engine's own pricing and checks, so the preview and Confirm always agree.
 */
export interface TradePreview {
  /** The market's reason the order cannot go through, or null. */
  blocked: string | null;
  /** Whole drachmas paid or received (for an army contract, paid on delivery). */
  total: number;
  /** The Confirm button's words, e.g. "Sell 40 grain for 31 dr"; null when the order is blocked. */
  confirmLabel: string | null;
  lines: string[];
  warnings: string[];
}

const UNITS: Record<TradeItem, readonly [string, string]> = {
  grain: ["grain", "grain"], flax: ["flax", "flax"], silver: ["silver", "silver"], gold: ["gold", "gold"],
  silk: ["bolt of silk", "bolts of silk"], linen: ["bolt of linen", "bolts of linen"], ox: ["ox", "oxen"], donkey: ["donkey", "donkeys"],
};
const PER: Partial<Record<TradeItem, string>> = { grain: "a measure", flax: "a bundle" };

function amount(item: TradeItem, quantity: number): string {
  return `${quantity} ${UNITS[item][quantity === 1 ? 0 : 1]}`;
}

function per(item: TradeItem): string {
  return PER[item] ?? "each";
}

interface Priced { total: number; from: number; to: number; text(hundredths: number): string }

function merchantPrice(def: DemoDefinition, life: LifeStateWithDemo, order: TradeCommand): Priced {
  if (def.market.depth) {
    const value = orderValue(def, life.demo, order.item, order.side, order.quantity);
    const [from, to] = order.side === "sell" ? [value.from.bid, value.to.bid] : [value.from.ask, value.to.ask];
    return { total: value.total, from, to, text: hundredths => priceText(order.item, hundredths) };
  }
  const unit = order.side === "sell" ? life.demo.town.prices[order.item].buy : life.demo.town.prices[order.item].sell;
  return { total: order.quantity * unit, from: unit, to: unit, text: price => String(price) };
}

function priceLine(order: TradeCommand, priced: Priced): string {
  const at = `${priced.text(priced.from)} dr ${per(order.item)}`;
  if (priced.from === priced.to) return `Price: ${at}.`;
  const moves = priced.to < priced.from ? "falls" : "rises";
  return `The price ${moves} from ${at} to ${priced.text(priced.to)} dr as your order fills.`;
}

function grainWarnings(def: DemoDefinition, life: LifeStateWithDemo, world: WorldPack | undefined, order: TradeCommand, lines: string[], warnings: string[]): void {
  const view = householdView(def, life, world);
  const change = order.side === "sell" ? -order.quantity : order.quantity;
  const after = view.grain + change;
  lines.push(`Grain in store after: ${after}`);
  const yearEnd = after + view.expectedHarvest - view.expectedRent;
  if (order.side === "sell" && yearEnd < view.expectedEating) {
    warnings.push(`After rent the household will go short this year: it eats about ${view.expectedEating}, and would have ${Math.max(0, yearEnd)}.`);
  }
  if (order.side === "buy" && after > view.capacity) {
    warnings.push(`That is more than your store holds (${view.capacity}); grain above the limit spoils fast.`);
  }
}

/** The engine's refusal of `order` for this life, tried on a copy; null when Confirm would go through. */
function refusal(engine: Pick<LifeEngine, "demo">, life: LifeState, order: TradeCommand): string | null {
  try { engine.demo(life, order); return null; }
  catch (error) { return error instanceof Error ? error.message : "This order cannot go through."; }
}

export function tradePreview(engine: Pick<LifeEngine, "demo" | "world">, state: LifeState, order: TradeCommand): TradePreview {
  const def = engine.world.demo, life = state as LifeStateWithDemo;
  if (!def || !state.demo) return { blocked: "This life has no market.", total: 0, confirmLabel: null, lines: [], warnings: [] };
  const world = engine.world;
  const blocked = refusal(engine, state, order);
  const lines: string[] = [];
  const warnings: string[] = [];
  let total: number;
  let verb: string;
  if (order.counterparty === "army") {
    const price = life.demo.town.armyGrainPrice;
    total = order.quantity * price;
    verb = `Contract ${amount(order.item, order.quantity)} to the army for ${total} dr`;
    lines.push(`The army pays ${price} dr ${per(order.item)} when the grain is delivered.`);
    if (life.demo.year.road !== "safe") warnings.push(`The road is ${life.demo.year.road}: a convoy carries the grain and can lose part of it.`);
  } else {
    const priced = merchantPrice(def, life, order);
    total = priced.total;
    verb = `${order.side === "sell" ? "Sell" : "Buy"} ${amount(order.item, order.quantity)} for ${total} dr`;
    lines.push(order.side === "sell" ? `You get ${total} dr.` : `You pay ${total} dr.`);
    lines.push(priceLine(order, priced));
  }
  if (order.item === "grain") grainWarnings(def, life, world, order, lines, warnings);
  if (order.reserveOverride) warnings.push("This sale uses grain set aside for the household's food or seed.");
  lines.push("This is your only market visit this year.");
  return { blocked, total, confirmLabel: blocked ? null : verb, lines, warnings };
}
