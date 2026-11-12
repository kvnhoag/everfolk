/**
 * Track B — townspeople, prices, trade orders, goods imports, livestock sales.
 *
 * Accounts touched here: the player's cash (only through `ctx.apply`), the household store and holdings,
 * and the town's grower, merchant and army. Every transfer balances: what one side pays the other
 * receives, what one side sells the other gets. The only grain that enters here is the grower's
 * harvest; the only grain that leaves is eaten (grower families, the army) or spoils in the grower's
 * barn. The only money that enters is the declared royal allocation; the only money that leaves pays
 * for the merchant's declared imports (the source of goods). Every movement is journalled.
 */
import type {
  DemoContext, DemoDefinition, DemoState, FloodLevel, Good, LifeStateWithDemo, MarketConfig,
  TownState, TradeCommand, TradeItem,
} from "./contracts.ts";
import { GOODS, TRADE_ITEMS } from "./types.ts";
import { townDecision } from "./agents.ts";
import { startContractShipment } from "./service.ts";
import { changeReputation } from "./works.ts";
import { farmSaleReason } from "../capabilities/farming.ts";
import { BPS, adjustments, buyPrice, rulePrice, tuning } from "./market-rules.ts";
import { addPressure, clearQuote, depthQuote, leanYearStanding, orderValue, pressureFactorBps, priceText, recoverPressure } from "./market-depth.ts";

const DEALER_JOB = "grain-dealer";
const CURRENCY = "drachmas";

const LABELS: Record<TradeItem, readonly [string, string]> = {
  grain: ["measure of grain", "measures of grain"], flax: ["bundle of flax", "bundles of flax"],
  silver: ["unit of silver", "units of silver"], gold: ["unit of gold", "units of gold"],
  silk: ["bolt of Coan silk", "bolts of Coan silk"], linen: ["bolt of linen", "bolts of linen"],
  ox: ["ox", "oxen"], donkey: ["donkey", "donkeys"],
};

/** The goods themselves, for sentences about a market glut or shortage. */
const GOODS_NOUN: Record<TradeItem, string> = { grain: "grain", flax: "flax", silver: "silver", gold: "gold", silk: "Coan silk", linen: "linen", ox: "oxen", donkey: "donkeys" };

function label(item: TradeItem, quantity: number): string {
  return LABELS[item][quantity === 1 ? 0 : 1];
}

function isGood(item: TradeItem): item is Good {
  return (GOODS as readonly string[]).includes(item);
}

export function initialTown(def: DemoDefinition): TownState {
  const m = def.market;
  const prices = Object.fromEntries(TRADE_ITEMS.map(item => {
    const sell = m.basePrice[item];
    return [item, { buy: buyPrice(m, sell), sell }];
  })) as TownState["prices"];
  return {
    grower: { ...m.start.grower },
    merchant: { ...m.start.merchant, goods: { ...m.start.merchant.goods }, animals: { ...m.start.merchant.animals } },
    army: { ...m.start.army },
    prices, armyGrainPrice: m.basePrice.grain,
    ...(m.depth ? { pressure: {} } : {}),
  };
}

// ── Holdings ────────────────────────────────────────────────────────────────

function householdHolding(demo: DemoState, item: TradeItem): number {
  if (item === "grain") return demo.household.grain;
  if (item === "flax") return demo.household.flax;
  if (isGood(item)) return demo.goods[item];
  return demo.household.animals[item];
}

function merchantHolding(town: TownState, item: TradeItem): number {
  const merchant = town.merchant;
  if (item === "grain") return merchant.grain;
  if (item === "flax") return merchant.flax;
  if (isGood(item)) return merchant.goods[item];
  return merchant.animals[item];
}

/** Moves `quantity` from the merchant to the household (negative: the other way). Callers validate first. */
function moveItem(demo: DemoState, item: TradeItem, quantity: number): void {
  const household = demo.household, merchant = demo.town.merchant;
  if (item === "grain") { household.grain += quantity; merchant.grain -= quantity; }
  else if (item === "flax") { household.flax += quantity; merchant.flax -= quantity; }
  else if (isGood(item)) { demo.goods[item] += quantity; merchant.goods[item] -= quantity; }
  else { household.animals[item] += quantity; merchant.animals[item] -= quantity; }
}

function playerCash(life: LifeStateWithDemo): number {
  return life.economy?.cash ?? 0;
}

// ── Prices ──────────────────────────────────────────────────────────────────

function armyPrice(def: DemoDefinition, demo: DemoState, sell: number): number {
  const premium = tuning(def.market).armyPremiumBps[demo.year.army];
  return Math.max(sell, Math.round(sell * (BPS + premium) / BPS));
}

/** The fixed-rule quotes for the current state. Pure: never changes state or draws randomness. */
export function rulePrices(def: DemoDefinition, demo: DemoState): { prices: TownState["prices"]; armyGrainPrice: number } {
  const m = def.market, adjust = adjustments(def, demo);
  const prices = Object.fromEntries(TRADE_ITEMS.map(item => {
    const sell = rulePrice(m, item, adjust[item]);
    return [item, { buy: buyPrice(m, sell), sell }];
  })) as TownState["prices"];
  return { prices, armyGrainPrice: armyPrice(def, demo, prices.grain.sell) };
}

/** Merchant quotes from stock vs target, army demand and road danger, within floor/ceiling. */
export function movePrices(ctx: DemoContext): void {
  const { def, demo } = ctx;
  const rule = rulePrices(def, demo);
  const decision = townDecision(ctx, "merchant");
  // agents.ts accepts only in-band prices, so an agent's quote is used as given.
  const grain = decision?.kind === "prices" ? { buy: decision.grainBuy, sell: decision.grainSell } : rule.prices.grain;
  const before = demo.town.prices.grain;
  demo.town.prices = { ...rule.prices, grain };
  demo.town.armyGrainPrice = armyPrice(def, demo, grain.sell);
  if (def.market.depth) { settleDepthYear(ctx); return; }
  if (before.buy === grain.buy && before.sell === grain.sell) return;
  const who = decision?.kind === "prices" && demo.agents.assigned.merchant
    ? `The merchant (run by agent ${demo.agents.assigned.merchant})` : "Following its usual rule, the merchant";
  ctx.journal("market-prices", `${who} now asks ${grain.sell} ${CURRENCY} a measure of grain and pays ${grain.buy}.`);
}

/** Depth worlds: the market works off part of the player's trade weight; the journal says where prices stand. */
function settleDepthYear(ctx: DemoContext): void {
  const { def, demo } = ctx, depth = def.market.depth!;
  recoverPressure(def, demo);
  const grain = depthQuote(def, demo, "grain");
  ctx.journal("market-prices", `Following its usual rule, the merchant now asks ${priceText("grain", grain.ask)} ${CURRENCY} a measure of grain and pays ${priceText("grain", grain.bid)}.`);
  for (const item of TRADE_ITEMS) {
    const pressure = demo.town.pressure?.[item] ?? 0;
    const shift = pressureFactorBps(depth, item, pressure) - BPS;
    if (Math.abs(shift) < 500) continue;
    const now = depthQuote(def, demo, item), usual = clearQuote(def, demo, item);
    const percent = Math.round(Math.abs(shift) / 100), per = item === "grain" ? "a measure" : `a ${label(item, 1)}`;
    ctx.journal("market-pressure", shift < 0
      ? `The merchant is still selling off the ${GOODS_NOUN[item]} you brought to market: it pays ${priceText(item, now.bid)} ${CURRENCY} ${per}, ${percent}% under its usual ${priceText(item, usual.bid)}. The price recovers as the market clears.`
      : `Your purchases of ${GOODS_NOUN[item]} still keep the price up: the merchant asks ${priceText(item, now.ask)} ${CURRENCY} ${per}, ${percent}% over its usual ${priceText(item, usual.ask)}. The price eases as the market restocks.`);
  }
}

// ── Townspeople ─────────────────────────────────────────────────────────────

/** The grower's harvest: `growerPlots × yieldPerPlot × flood factor`, rounded down. Pure. */
export function growerHarvest(def: DemoDefinition, flood: FloodLevel): number {
  const h = def.household;
  return Math.floor(def.market.growerPlots * h.yieldPerPlot * h.floodFactorBps[flood] / BPS);
}

interface TownYear { allocation: number; harvested: number; eaten: number; spoiled: number; sold: number; soldFor: number; armyBought: number; armyPaid: number; armyEaten: number; imported: number }

/** The grower harvests, its families eat, its barn spoils a share, and it releases a share to the merchant. */
function growerYear(ctx: DemoContext): Pick<TownYear, "harvested" | "eaten" | "spoiled" | "sold" | "soldFor"> {
  const { def, demo } = ctx, m = def.market, t = tuning(m);
  const grower = demo.town.grower, merchant = demo.town.merchant;
  const harvested = growerHarvest(def, demo.year.flood);
  grower.grain += harvested;
  const eaten = Math.min(t.growerEating, grower.grain);
  grower.grain -= eaten;
  const spoiled = Math.floor(grower.grain * t.growerSpoilageBps / BPS);
  grower.grain -= spoiled;
  const decision = townDecision(ctx, "grower");
  const releaseBps = decision?.kind === "release" ? decision.shareBps : t.growerReleaseBps;
  const offered = Math.floor(grower.grain * releaseBps / BPS);
  const room = Math.max(0, Math.floor(m.targetGrainStock * t.merchantMaxStockBps / BPS) - merchant.grain);
  const price = demo.town.prices.grain.buy;
  const sold = Math.min(offered, room, Math.floor(merchant.cash / price));
  const soldFor = sold * price;
  grower.grain -= sold; merchant.grain += sold;
  merchant.cash -= soldFor; grower.cash += soldFor;
  return { harvested, eaten, spoiled, sold, soldFor };
}

/** Grain the army keeps in its stores beyond the year's demand (defaults to its starting stock). */
export function armyReserve(m: MarketConfig): number {
  return m.armyReserve ?? m.start.army.grain;
}

/**
 * The army receives its allocation, buys from the merchant up to its demand plus what it needs to
 * refill its reserve (limited by the merchant's stock and the purse), then eats its demand.
 */
function armyYear(ctx: DemoContext): Pick<TownYear, "allocation" | "armyBought" | "armyPaid" | "armyEaten"> {
  const { def, demo } = ctx, m = def.market;
  const army = demo.town.army, merchant = demo.town.merchant;
  const allocation = m.royalAllocation;
  army.purse += allocation;
  const demand = m.armyDemand[demo.year.army];
  const restock = Math.max(0, armyReserve(m) - army.grain);
  const price = demo.town.armyGrainPrice;
  // The quartermaster keeps a part of the purse back for soldiers' wages.
  const spendable = Math.max(0, army.purse - tuning(m).armyPurseReserve);
  const armyBought = Math.min(demand + restock, merchant.grain, Math.floor(spendable / price));
  const armyPaid = armyBought * price;
  merchant.grain -= armyBought; army.grain += armyBought;
  army.purse -= armyPaid; merchant.cash += armyPaid;
  const armyEaten = Math.min(demand, army.grain);
  army.grain -= armyEaten;
  return { allocation, armyBought, armyPaid, armyEaten };
}

/** Imports restock each good up to its cap, shrunk by the road, paid at base price to outside sellers. */
function importGoods(ctx: DemoContext): number {
  const { def, demo } = ctx, m = def.market, merchant = demo.town.merchant;
  let paid = 0;
  for (const good of GOODS) {
    const cap = m.goodsStockCap?.[good] ?? m.start.merchant.goods[good];
    const shipped = Math.floor(m.yearlyImports[good] * m.importFactorBps[demo.year.road] / BPS);
    const unit = m.basePrice[good];
    const quantity = Math.min(shipped, Math.max(0, cap - merchant.goods[good]), Math.floor(merchant.cash / unit));
    merchant.goods[good] += quantity;
    merchant.cash -= quantity * unit;
    paid += quantity * unit;
  }
  return paid;
}

/** Grower harvest and sales, merchant–army trade, royal allocation, goods imports. */
export function townTrades(ctx: DemoContext): void {
  const grower = growerYear(ctx);
  const army = armyYear(ctx);
  const imported = importGoods(ctx);
  const y: TownYear = { ...grower, ...army, imported };
  ctx.journal("town-year", `By their usual rules: the neighbouring grower harvests ${y.harvested} measures of grain; its families eat ${y.eaten} and ${y.spoiled} spoil in its barn. `
    + `The grower sells ${y.sold} measures to the merchant for ${y.soldFor} ${CURRENCY}. `
    + `The king's allocation adds ${y.allocation} ${CURRENCY} to the army purse; the army buys ${y.armyBought} measures from the merchant for ${y.armyPaid} ${CURRENCY}, and the army eats ${y.armyEaten}. `
    + `The merchant imports goods for ${y.imported} ${CURRENCY}.`);
}

// ── The player's order ──────────────────────────────────────────────────────

function armyReason(life: LifeStateWithDemo, command: TradeCommand): string | undefined {
  const demo = life.demo;
  if (command.item !== "grain") return "The army only buys grain.";
  if (command.side !== "sell") return "The army does not sell grain to the public.";
  if (life.character?.jobId !== DEALER_JOB) return "Only a grain dealer can sell to the army under contract.";
  if (demo.shipment !== null) return "A shipment is already under way; see it through first.";
  const held = demo.household.grain;
  if (command.quantity > held) return `You hold only ${held} ${label("grain", held)}.`;
  const cost = command.quantity * demo.town.armyGrainPrice;
  if (cost > demo.town.army.purse) return `The army purse holds only ${demo.town.army.purse} ${CURRENCY} and cannot pay ${cost} ${CURRENCY}.`;
  return undefined;
}

function merchantReason(def: DemoDefinition, life: LifeStateWithDemo, command: TradeCommand): string | undefined {
  const { item, quantity } = command, town = life.demo.town;
  const held = householdHolding(life.demo, item);
  if (command.side === "buy") {
    const max = tuning(def.market).maxAnimals;
    if (!def.startingResources && (item === "ox" || item === "donkey") && held + quantity > max) return `A household can keep at most ${max} ${label(item, max)}.`;
    const stock = merchantHolding(town, item);
    if (quantity > stock) return `The merchant has only ${stock} ${label(item, stock)} to sell.`;
    const cost = def.market.depth ? orderValue(def, life.demo, item, "buy", quantity).total : quantity * town.prices[item].sell, cash = playerCash(life);
    if (cost > cash) return `You need ${cost} ${CURRENCY} but have ${cash}.`;
    return undefined;
  }
  if (quantity > held) return `You hold only ${held} ${label(item, held)}.`;
  const proceeds = def.market.depth ? orderValue(def, life.demo, item, "sell", quantity).total : quantity * town.prices[item].buy;
  if (proceeds > town.merchant.cash) return `The merchant has only ${town.merchant.cash} ${CURRENCY} and cannot pay ${proceeds} ${CURRENCY}.`;
  return undefined;
}

/** Why an order would fail, or undefined when it would settle. Read-only; the same checks `executeTrade` makes. */
export function tradeReason(def: DemoDefinition, life: LifeStateWithDemo, command: TradeCommand): string | undefined {
  const m = def.market, t = tuning(m);
  if (!TRADE_ITEMS.includes(command.item)) return "That is not traded at the market.";
  if (command.side !== "buy" && command.side !== "sell") return "Choose to buy or to sell.";
  if (command.counterparty !== "merchant" && command.counterparty !== "army") return "Trade with the merchant or the army.";
  if (life.demo.lastTradeAge === life.age) return "You have already made this year's market visit.";
  if (life.age < t.minTradeAge) return `You are too young to trade at the market (from age ${t.minTradeAge}).`;
  if (!Number.isSafeInteger(command.quantity) || command.quantity < 1) return "Choose a whole quantity of at least 1.";
  if (command.quantity > m.maxOrderQuantity) return `Orders are limited to at most ${m.maxOrderQuantity} at a time.`;
  if (command.item === "grain" && command.side === "sell") {
    const reason = farmSaleReason({ demo: def }, life, command.quantity, command.reserveOverride);
    if (reason) return reason;
  }
  return command.counterparty === "army" ? armyReason(life, command) : merchantReason(def, life, command);
}

function tradeWithMerchant(ctx: DemoContext, command: TradeCommand): void {
  if (ctx.def.market.depth) { tradeAtDepth(ctx, command); return; }
  const { item, quantity } = command, demo = ctx.demo, merchant = demo.town.merchant;
  const units = `${quantity} ${label(item, quantity)}`;
  if (command.side === "buy") {
    const cost = quantity * demo.town.prices[item].sell;
    moveItem(demo, item, quantity);
    ctx.apply([{ type: "cash", delta: -cost }]);
    merchant.cash += cost;
    ctx.journal("market-trade", `You buy ${units} from the merchant for ${cost} ${CURRENCY}.`);
    return;
  }
  const proceeds = quantity * demo.town.prices[item].buy;
  moveItem(demo, item, -quantity);
  merchant.cash -= proceeds;
  ctx.apply([{ type: "cash", delta: proceeds }]);
  ctx.journal("market-trade", `You sell ${units} to the merchant for ${proceeds} ${CURRENCY}.`);
  const fair = tuning(ctx.def.market).fairTradeReputation;
  if (item === "grain" && demo.year.flood === "low" && fair > 0) changeReputation(ctx, fair, "you brought grain to market in a lean year");
}

/** The journal line for an order that moved the price: what it fetched, how far the price moved, the merchant's stock. */
function depthText(item: TradeItem, side: "buy" | "sell", quantity: number, value: ReturnType<typeof orderValue>, stock: number, who = "You"): string {
  const units = `${quantity} ${label(item, quantity)}`, per = item === "grain" ? "a measure" : `a ${label(item, 1)}`;
  const [from, to] = side === "sell" ? [value.from.bid, value.to.bid] : [value.from.ask, value.to.ask];
  const deal = side === "sell" ? `${who} sell ${units} to the merchant for ${value.total} ${CURRENCY}` : `${who === "You" ? "You buy" : `${who} buys`} ${units} from the merchant for ${value.total} ${CURRENCY}`;
  const average = item === "grain" && quantity > 0 ? ` (${(value.total / quantity).toFixed(2)} a measure on average)` : "";
  const moved = from === to ? `The price held at ${priceText(item, from)} ${CURRENCY} ${per}.`
    : `The price ${to < from ? "fell" : "rose"} from ${priceText(item, from)} to ${priceText(item, to)} ${CURRENCY} ${per} as ${side === "sell" ? "the merchant took in more than it can sell" : "its stock ran down"}.`;
  const holding = item === "grain" ? `Its barn now holds ${stock} measures.` : `It now holds ${stock} ${label(item, stock)}.`;
  return `${deal}${average}. ${moved} ${holding}`;
}

/** Depth worlds: the order is priced as it fills, and its weight stays on the market. */
function tradeAtDepth(ctx: DemoContext, command: TradeCommand): void {
  const { item, quantity, side } = command, demo = ctx.demo, merchant = demo.town.merchant;
  const value = orderValue(ctx.def, demo, item, side, quantity);
  if (side === "buy") {
    moveItem(demo, item, quantity);
    ctx.apply([{ type: "cash", delta: -value.total }]);
    merchant.cash += value.total;
  } else {
    moveItem(demo, item, -quantity);
    merchant.cash -= value.total;
    ctx.apply([{ type: "cash", delta: value.total }]);
  }
  addPressure(demo, item, side, quantity);
  ctx.journal("market-trade", depthText(item, side, quantity, value, merchantHolding(demo.town, item)));
  if (side === "sell" && item === "grain" && demo.year.flood === "low") changeReputation(ctx, leanYearStanding(ctx.def, quantity), "you brought grain to market in a lean year");
}

/**
 * Settles the player's one order this year. Every check runs before anything changes; on failure it
 * throws with the reason and the engine discards its draft, so the life stays unchanged.
 * An army sale only records the contract: `startContractShipment` (service) moves the grain and the
 * army's pay — directly on a safe road, through a convoy otherwise — so no cash or grain moves here.
 */
export function executeTrade(ctx: DemoContext, command: TradeCommand): void {
  const life = ctx.life as LifeStateWithDemo;
  const reason = tradeReason(ctx.def, life, command);
  if (reason !== undefined) throw new Error(reason);
  ctx.demo.lastTradeAge = life.age;
  if (command.counterparty === "merchant") { tradeWithMerchant(ctx, command); return; }
  const price = ctx.demo.town.armyGrainPrice;
  ctx.journal("market-trade", `You contract to deliver ${command.quantity} ${label("grain", command.quantity)} to the army at ${price} ${CURRENCY} a measure.`);
  startContractShipment(ctx, command.quantity, price);
}

/** Household shortfall purchase at the merchant's sell price; returns grain bought. Not the yearly visit. */
export function buyForHousehold(ctx: DemoContext, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return 0;
  if (ctx.def.market.depth) return buyForHouseholdAtDepth(ctx, quantity);
  const demo = ctx.demo, price = demo.town.prices.grain.sell;
  const bought = Math.min(quantity, demo.town.merchant.grain, Math.floor(playerCash(ctx.life as LifeStateWithDemo) / price));
  if (bought <= 0) return 0;
  const cost = bought * price;
  moveItem(demo, "grain", bought);
  ctx.apply([{ type: "cash", delta: -cost }]);
  demo.town.merchant.cash += cost;
  ctx.journal("market-household-buy", `The household buys ${bought} measures of grain from the merchant for ${cost} ${CURRENCY}.`);
  return bought;
}

/** Depth worlds: the most the household can afford of `quantity` as the price rises, bought in one order. */
function buyForHouseholdAtDepth(ctx: DemoContext, quantity: number): number {
  const demo = ctx.demo, cash = playerCash(ctx.life as LifeStateWithDemo);
  const cost = (units: number): number => orderValue(ctx.def, demo, "grain", "buy", units).total;
  let low = 0, high = Math.min(quantity, demo.town.merchant.grain);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (cost(middle) <= cash) low = middle; else high = middle - 1;
  }
  if (low <= 0) return 0;
  const value = orderValue(ctx.def, demo, "grain", "buy", low);
  moveItem(demo, "grain", low);
  ctx.apply([{ type: "cash", delta: -value.total }]);
  demo.town.merchant.cash += value.total;
  addPressure(demo, "grain", "buy", low);
  ctx.journal("market-household-buy", depthText("grain", "buy", low, value, demo.town.merchant.grain, "The household"));
  return low;
}

// ── Views ───────────────────────────────────────────────────────────────────

export interface QuoteView { item: TradeItem; buy: number; sell: number; merchantStock: number; merchantCanBuy: number }
export interface MarketView {
  quotes: QuoteView[]; armyGrainPrice: number; armyOpen: boolean; visitUsed: boolean;
  merchantCash: number; reasons: string[];
}
function quoteView(def: DemoDefinition, demo: DemoState, item: TradeItem): QuoteView {
  const t = demo.town, merchantStock = merchantHolding(t, item);
  if (!def.market.depth) return { item, ...t.prices[item], merchantStock, merchantCanBuy: Math.floor(t.merchant.cash / Math.max(1, t.prices[item].buy)) };
  // Depth worlds: the current quote after the player's recent trades; grain in hundredths of a drachma.
  const quote = depthQuote(def, demo, item);
  return { item, buy: quote.bid / 100, sell: quote.ask / 100, merchantStock, merchantCanBuy: Math.floor(t.merchant.cash * 100 / quote.bid) };
}

/** Read-only quotes and limits. Never changes state or draws randomness. */
export function marketView(def: DemoDefinition, life: LifeStateWithDemo): MarketView {
  const t = life.demo.town, minAge = tuning(def.market).minTradeAge;
  const visitUsed = life.demo.lastTradeAge === life.age;
  const reasons = [
    ...(visitUsed ? ["You have already made this year's market visit."] : []),
    ...(life.age < minAge ? [`You are too young to trade at the market (from age ${minAge}).`] : []),
  ];
  return {
    quotes: TRADE_ITEMS.map(item => quoteView(def, life.demo, item)),
    armyGrainPrice: t.armyGrainPrice,
    armyOpen: life.character?.jobId === DEALER_JOB && life.demo.shipment === null && reasons.length === 0,
    visitUsed, merchantCash: t.merchant.cash, reasons,
  };
}
