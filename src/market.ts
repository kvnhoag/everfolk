import type { JobDefinition, LifeState, MarketOrderRequest, MarketSettlement, WorldPack } from "./types.ts";

const LIMIT = 1_000_000_000_000;
function safe(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > LIMIT) throw new Error("The market transaction exceeds the ledger limit.");
  return value;
}

/** A focus or unaccepted job offer never grants professional purchasing capacity. */
export function hasFullMarketAccess(world: WorldPack, life: Pick<LifeState, "character">): boolean {
  const market = world.economy?.market, jobId = life.character?.jobId;
  if (!market || !jobId) return false;
  return jobId === market.traderJob || world.character?.jobs.some(job => job.id === jobId && job.marketAccess === "full") === true;
}

/** Count both sides of every pending contract; splitting orders cannot add capacity. */
export function marketOrderCapacity(world: WorldPack, life: Pick<LifeState, "character" | "economy">) {
  const model = world.economy?.market, professional = hasFullMarketAccess(world, life);
  const profile = model?.orderLimits?.[professional ? "professional" : "household"];
  const committed = (life.economy?.market?.orders ?? []).reduce((sum, order) => sum + order.quantity, 0);
  return { perOrder: Math.min(model?.maxQuantity ?? 0, profile?.perOrder ?? model?.maxQuantity ?? 0),
    perYear: profile?.perYear, committed, remaining: profile ? Math.max(0, profile.perYear - committed) : undefined, professional };
}

function ownershipLimit(world: WorldPack, assetId: string): number | undefined {
  return world.economy?.uncappedResources ? undefined : world.economy?.assets.find(asset => asset.id === assetId)?.maxOwned;
}

/** Reserved sales remain owned, and pending purchases already commit capacity. */
export function marketCommittedQuantity(life: Pick<LifeState, "economy">, assetId: string): number {
  return (life.economy?.assets[assetId] ?? 0) + (life.economy?.market?.orders ?? []).reduce((sum, order) => sum + (order.asset === assetId ? order.quantity : 0), 0);
}

function receiveGoods(world: WorldPack, life: LifeState, assetId: string, quantity: number): void {
  const next = safe((life.economy!.assets[assetId] ?? 0) + quantity), limit = ownershipLimit(world, assetId);
  if (limit !== undefined && next > limit) throw new Error(`You can own at most ${limit} ${world.economy!.assets.find(asset => asset.id === assetId)!.title.toLowerCase()}.`);
  life.economy!.assets[assetId] = next;
}

/** Prices respond only to events that actually happened in this life. */
export function marketQuote(world: WorldPack, life: Pick<LifeState, "age" | "lastEventAge" | "eventCounts">, assetId: string) {
  const asset = world.economy?.assets.find(item => item.id === assetId);
  if (!asset) throw new Error(`Unknown market good: ${assetId}`);
  const market = world.economy?.market;
  const signals = (market?.shocks ?? []).flatMap(shock => {
    const age = life.lastEventAge[shock.eventId], multiplier = shock.priceMultipliers[assetId];
    return multiplier !== undefined && age !== undefined && age <= life.age && life.age - age < shock.durationYears && (life.eventCounts[shock.eventId] ?? 0) > 0
      ? [{ eventId: shock.eventId, title: shock.title, multiplier }] : [];
  });
  if (!market?.goods.includes(assetId)) return { buy: asset.value, sell: asset.value, signals: [] };
  const multiplier = Math.max(0.25, Math.min(4, signals.reduce((value, signal) => value * signal.multiplier, 1)));
  const price = Math.max(1, Math.round(asset.value * multiplier));
  return { buy: Math.max(1, Math.ceil(price * (1 + market.feePercent / 100))),
    sell: Math.max(1, Math.floor(price * (1 - market.feePercent / 100))), signals };
}

/** Receivables still belong to the household while cash or goods are reserved. */
export function marketOrderValue(world: WorldPack, life: Pick<LifeState, "economy" | "age" | "lastEventAge" | "eventCounts">): number {
  return safe((life.economy?.market?.orders ?? []).reduce((sum, order) => sum + (order.side === "sell" ? order.total
    : order.quantity * marketQuote(world, life as LifeState, order.asset).sell), 0));
}

export function productionCapacity(_world: WorldPack, life: LifeState, job: JobDefinition): number {
  const recipe = job.production;
  if (!recipe) return 0;
  const extra = recipe.skill && recipe.skillPerBatch ? Math.floor((life.character?.skills[recipe.skill] ?? 0) / recipe.skillPerBatch) : 0;
  return Math.min(recipe.maxBatches, recipe.baseBatches + extra);
}

export function productionPlan(world: WorldPack, life: LifeState, job: JobDefinition) {
  const capacity = productionCapacity(world, life, job), recipe = job.production;
  const outputCapacity = Object.entries(recipe?.outputs ?? {}).map(([id, count]) => {
    const limit = ownershipLimit(world, id), gain = count - (recipe?.inputs[id] ?? 0);
    return limit === undefined || gain <= 0 ? capacity : Math.max(0, Math.floor((limit - (life.economy?.assets[id] ?? 0)) / gain));
  });
  const batches = recipe ? Math.min(capacity, ...Object.entries(recipe.inputs).map(([id, count]) => Math.floor((life.economy?.assets[id] ?? 0) / count)), ...outputCapacity) : 0;
  const totals = (items: Record<string, number>) => Object.fromEntries(Object.entries(items).map(([id, count]) => [id, count * batches]));
  return { capacity, batches, inputs: totals(recipe?.inputs ?? {}), outputs: totals(recipe?.outputs ?? {}) };
}

export function marketOrderReason(world: WorldPack, life: LifeState, request: MarketOrderRequest): string | undefined {
  const model = world.economy?.market, economy = life.economy;
  if (!model || !economy?.market) return "There is no annual market in this world.";
  if (life.phase !== "ready") return life.phase === "ended" ? "This life has ended." : "Resolve the current decision first.";
  if (life.age < model.minAge) return `Market contracts are available from age ${model.minAge}.`;
  if (!request || !["buy", "sell"].includes(request.side)) return "Choose a purchase or sale.";
  if (!model.goods.includes(request.asset)) return "This good is not traded in the annual market.";
  const capacity = marketOrderCapacity(world, life);
  if (!Number.isSafeInteger(request.quantity) || request.quantity < 1 || request.quantity > capacity.perOrder) return `Choose a whole quantity from 1 to ${capacity.perOrder}.`;
  if (capacity.remaining !== undefined && request.quantity > capacity.remaining) return `Annual market capacity allows ${capacity.remaining} more ${capacity.remaining === 1 ? "unit" : "units"} this year (${capacity.committed} of ${capacity.perYear} committed). Purchases and sales share this limit. Cancel an order or complete the year.`;
  if (economy.market.orders.length >= model.maxOrders) return `At most ${model.maxOrders} contracts may be pending.`;
  const limit = ownershipLimit(world, request.asset);
  // Both incoming purchases and cancelable sales still commit storage. Reserving
  // goods for sale must not let a purchase make cancellation exceed the cap.
  const committed = marketCommittedQuantity(life, request.asset);
  if (request.side === "buy" && limit !== undefined && committed + request.quantity > limit) return `You can own at most ${limit} ${world.economy!.assets.find(asset => asset.id === request.asset)!.title.toLowerCase()}.`;
  const quote = marketQuote(world, life, request.asset), total = quote[request.side] * request.quantity;
  if (!Number.isSafeInteger(total) || total > LIMIT) return "The market transaction exceeds the ledger limit.";
  if (request.side === "buy" && economy.cash < total) return `Needs ${total} ${world.economy!.currency.short} in cash (you have ${economy.cash}).`;
  if (request.side === "sell" && (economy.assets[request.asset] ?? 0) < request.quantity) return "You do not own enough uncommitted goods for this sale.";
}

export function placeMarketOrder(world: WorldPack, life: LifeState, request: MarketOrderRequest): void {
  const reason = marketOrderReason(world, life, request);
  if (reason) throw new Error(reason);
  const economy = life.economy!, market = economy.market!;
  const unitPrice = marketQuote(world, life, request.asset)[request.side], total = safe(unitPrice * request.quantity);
  if (request.side === "buy") economy.cash -= total;
  else economy.assets[request.asset] -= request.quantity;
  const id = market.nextOrderId;
  market.nextOrderId = safe(id + 1);
  market.orders.push({ id, side: request.side, asset: request.asset, quantity: request.quantity, unitPrice, total, placedAge: life.age, settlesAtAge: life.age + 1 });
}

export function cancelMarketOrder(world: WorldPack, life: LifeState, orderId: number): void {
  if (!world.economy?.market || !life.economy?.market || life.phase !== "ready") throw new Error("Market contracts cannot be changed now.");
  if (!Number.isSafeInteger(orderId) || orderId < 1) throw new Error("Invalid market order identifier.");
  const economy = life.economy, market = economy.market!, order = market.orders.find(item => item.id === orderId);
  if (!order || order.settlesAtAge <= life.age) throw new Error("This market contract is no longer pending.");
  if (order.side === "buy") economy.cash = safe(economy.cash + order.total);
  else receiveGoods(world, life, order.asset, order.quantity);
  market.orders = market.orders.filter(item => item.id !== orderId);
}

export function isTradingFocus(world: WorldPack, life: LifeState, age = life.age): boolean {
  const focus = world.economy?.market?.traderFocusActivity;
  return !!focus && life.character?.lastActivityAges[focus] === age;
}

/** Advance calls this once, before household costs: deliveries, production, sales. */
export function settleMarketYear(world: WorldPack, life: LifeState, completedAge: number, log: (id: string, text: string) => void) {
  const economy = life.economy, market = economy?.market, model = world.economy?.market;
  if (!economy || !market || !model) return { focused: false, productionBatches: 0 };
  const focused = isTradingFocus(world, life, completedAge), currency = world.economy!.currency.short;
  const orders = market.orders.filter(order => order.settlesAtAge <= life.age);
  const settlement: MarketSettlement = { age: life.age, bought: 0, sold: 0, revenue: 0, spent: 0 };
  for (const order of orders.filter(item => item.side === "buy")) {
    receiveGoods(world, life, order.asset, order.quantity);
    settlement.bought += order.quantity; settlement.spent += order.total;
  }
  let productionBatches = 0;
  const job = world.character?.jobs.find(item => item.id === life.character?.jobId);
  if (job?.production && !focused) {
    const plan = productionPlan(world, life, job);
    productionBatches = plan.batches;
    for (const [id, count] of Object.entries(plan.inputs)) economy.assets[id] -= count;
    for (const [id, count] of Object.entries(plan.outputs)) receiveGoods(world, life, id, count);
    const names = (items: Record<string, number>) => Object.entries(items).map(([id, count]) => `${count} ${world.economy!.assets.find(item => item.id === id)!.title.toLowerCase()}`).join(", ");
    log("annual-production", productionBatches > 0 ? `Your ${job.title.toLowerCase()} work uses ${names(plan.inputs)} to produce ${names(plan.outputs)} (${productionBatches} of ${plan.capacity} batches). Sell the finished goods through a market contract to earn cash.`
      : `Your ${job.title.toLowerCase()} work stops for lack of materials or room for finished goods. Order supplies or sell stock through the annual market; no goods or production income are created this year.`);
  }
  for (const order of orders.filter(item => item.side === "sell")) {
    economy.cash = safe(economy.cash + order.total);
    settlement.sold += order.quantity; settlement.revenue = safe(settlement.revenue + order.total);
  }
  market.orders = market.orders.filter(order => order.settlesAtAge > life.age);
  if (orders.length > 0) {
    market.lastSettlement = settlement;
    market.history = [...(market.history ?? []), settlement].slice(-12);
    log("market-settlement", `The year's market contracts settle: ${settlement.bought} goods delivered for ${settlement.spent} ${currency} already reserved; ${settlement.sold} goods sold for ${settlement.revenue} ${currency}. Prices were fixed when each contract was placed.`);
    const idle = !life.character?.jobId && life.character?.lastActivityAge !== completedAge;
    if (settlement.sold > 0 && (focused || idle || life.character?.jobId === model.traderJob)) market.tradingYears++;
  }
  const trader = world.character?.jobs.find(item => item.id === model.traderJob);
  if (trader && market.tradingYears >= model.traderYears && life.age >= trader.minAge &&
    Object.entries(trader.requirements ?? {}).every(([id, value]) => (life.character?.skills[id] ?? 0) >= value) &&
    Object.hasOwn(world.flags, "trader-qualified") && !life.flags["trader-qualified"]) {
    life.flags["trader-qualified"] = true;
    log("trader-career-opening", `After ${market.tradingYears} years of settled trading, you can choose the trader occupation. Your current livelihood remains yours until you accept.`);
  }
  return { focused, productionBatches };
}
