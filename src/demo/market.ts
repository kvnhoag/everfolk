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
  ArmyLevel, DemoContext, DemoDefinition, DemoState, FloodLevel, Good, LifeStateWithDemo, MarketConfig, RoadLevel,
  TownState, TradeCommand, TradeItem,
} from "./contracts.ts";
import { GOODS, TRADE_ITEMS } from "./types.ts";
import { townDecision } from "./agents.ts";
import { startContractShipment } from "./service.ts";
import { changeReputation } from "./works.ts";
import { farmSaleReason } from "../capabilities/farming.ts";

const BPS = 10_000;
const DEALER_JOB = "grain-dealer";
const CURRENCY = "drachmas";

/** Optional tuning with the defaults used when a world leaves a field out. */
function tuning(m: MarketConfig) {
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

const LABELS: Record<TradeItem, readonly [string, string]> = {
  grain: ["measure of grain", "measures of grain"], flax: ["bundle of flax", "bundles of flax"],
  silver: ["unit of silver", "units of silver"], gold: ["unit of gold", "units of gold"],
  silk: ["bolt of Coan silk", "bolts of Coan silk"], linen: ["bolt of linen", "bolts of linen"],
  ox: ["ox", "oxen"], donkey: ["donkey", "donkeys"],
};

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

function priceBounds(m: MarketConfig, item: TradeItem): { floor: number; ceiling: number } {
  const base = m.basePrice[item];
  const floor = Math.max(1, Math.floor(base * m.priceFloorBps / BPS));
  return { floor, ceiling: Math.max(floor, Math.floor(base * m.priceCeilingBps / BPS)) };
}

/** Base price moved by `adjustBps`, rounded and clamped to the item's floor and ceiling. */
function rulePrice(m: MarketConfig, item: TradeItem, adjustBps: number): number {
  const { floor, ceiling } = priceBounds(m, item);
  const raw = Math.round(m.basePrice[item] * Math.max(0, BPS + adjustBps) / BPS);
  return Math.min(ceiling, Math.max(floor, raw));
}

/** What the merchant pays: its asking price less the spread, never below one drachma. */
function buyPrice(m: MarketConfig, sell: number): number {
  return Math.max(1, Math.floor(sell * BPS / (BPS + m.spreadBps)));
}

function armyPrice(def: DemoDefinition, demo: DemoState, sell: number): number {
  const premium = tuning(def.market).armyPremiumBps[demo.year.army];
  return Math.max(sell, Math.round(sell * (BPS + premium) / BPS));
}

/**
 * Grain: stock below `targetGrainStock` raises the price (up to +100% when empty), stock above lowers
 * it (at most −50%); army demand over the quiet level and the road's transport cost add to it; the
 * flood's crop pressure moves it. Metals answer to the army, silk to the road, flax and linen to the flood.
 */
function adjustments(def: DemoDefinition, demo: DemoState): Record<TradeItem, number> {
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
  if (before.buy === grain.buy && before.sell === grain.sell) return;
  const who = decision?.kind === "prices" && demo.agents.assigned.merchant
    ? `The merchant (run by agent ${demo.agents.assigned.merchant})` : "Following its usual rule, the merchant";
  ctx.journal("market-prices", `${who} now asks ${grain.sell} ${CURRENCY} a measure of grain and pays ${grain.buy}.`);
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
    const cost = quantity * town.prices[item].sell, cash = playerCash(life);
    if (cost > cash) return `You need ${cost} ${CURRENCY} but have ${cash}.`;
    return undefined;
  }
  if (quantity > held) return `You hold only ${held} ${label(item, held)}.`;
  const proceeds = quantity * town.prices[item].buy;
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

// ── Views ───────────────────────────────────────────────────────────────────

export interface QuoteView { item: TradeItem; buy: number; sell: number; merchantStock: number; merchantCanBuy: number }
export interface MarketView {
  quotes: QuoteView[]; armyGrainPrice: number; armyOpen: boolean; visitUsed: boolean;
  merchantCash: number; reasons: string[];
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
    quotes: TRADE_ITEMS.map(item => ({ item, ...t.prices[item], merchantStock: merchantHolding(t, item),
      merchantCanBuy: Math.floor(t.merchant.cash / Math.max(1, t.prices[item].buy)) })),
    armyGrainPrice: t.armyGrainPrice,
    armyOpen: life.character?.jobId === DEALER_JOB && life.demo.shipment === null && reasons.length === 0,
    visitUsed, merchantCash: t.merchant.cash, reasons,
  };
}
