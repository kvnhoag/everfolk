import { bid, vocationCashDelta } from "./vocations/view.ts";
import type { Choice, EconomyState, Effect, LifeState, WorldPack } from "./types.ts";
import { applyLoanEffect } from "./loans.ts";
import { TRADE_ITEMS } from "./demo/types.ts";
import { marketCommittedQuantity, marketOrderValue, marketQuote } from "./market.ts";

/** Deliberate numeric ceiling keeps all ledger arithmetic safely below 2^53. */
export const ECONOMY_LIMIT = 1_000_000_000_000;

function amount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > ECONOMY_LIMIT) throw new Error(`${label} must stay between 0 and ${ECONOMY_LIMIT}.`);
  return value;
}

type ValuationState = Pick<LifeState, "economy"> & Partial<Pick<LifeState, "age" | "lastEventAge" | "eventCounts" | "demo" | "vocations">>;
/** The merchant's current bid is the realizable market value of each holding. */
export function getDemoResourceValue(world: WorldPack, state: Partial<Pick<LifeState, "demo">>): number {
  if (!world.demo?.startingResources || !state.demo) return 0;
  const demo = state.demo;
  return amount(TRADE_ITEMS.reduce((sum, item) => {
    const quantity = item === "grain" ? demo.household.grain : item === "flax" ? demo.household.flax
      : item === "ox" || item === "donkey" ? demo.household.animals[item] : demo.goods[item];
    const held = amount(quantity, `Household ${item}`);
    const price = amount(demo.town.prices[item].buy, `Market ${item} price`);
    return sum + held * price;
  }, 0), "Household resource market value");
}

export interface VocationHolding { item: string; quality: number; quantity: number; valuedQuantity: number; unitValue: number; material: boolean }

/** Materials use supplier quotes; products share the finite merchant budget and demand. */
export function getVocationHoldings(world: WorldPack, state: Partial<Pick<LifeState, "vocations">>): VocationHolding[] {
  if (!world.vocations || !state.vocations) return [];
  const def = world.vocations;
  const ledger = state.vocations;
  const holdings: VocationHolding[] = [];
  const countedFromLots: Record<string, number> = {};
  const add = (item: string, quality: number, quantity: number) => {
    const material = Boolean(def.materials[item]);
    holdings.push({ item, quality, quantity, valuedQuantity: material ? quantity : 0,
      unitValue: material ? def.materials[item].price : bid(world, item, quality), material });
  };
  for (const lot of ledger.lots ?? []) {
    if (lot.quantity <= 0 || lot.item === "flax" || lot.item === "linen") continue;
    countedFromLots[lot.item] = (countedFromLots[lot.item] ?? 0) + lot.quantity;
    add(lot.item, lot.quality, lot.quantity);
  }
  for (const [item, quantity] of Object.entries(ledger.inventory ?? {})) {
    if (quantity <= 0 || item === "flax" || item === "linen") continue;
    const remaining = quantity - (countedFromLots[item] ?? 0);
    if (remaining <= 0) continue;
    add(item, 1, remaining);
  }
  let budget = ledger.accounts.merchant;
  const demand = { ...ledger.demand };
  for (const holding of holdings.filter(item => !item.material).sort((a, b) => b.unitValue - a.unitValue || a.item.localeCompare(b.item))) {
    holding.valuedQuantity = holding.unitValue > 0 ? Math.min(holding.quantity, demand[holding.item] ?? 0, Math.floor(budget / holding.unitValue)) : 0;
    budget -= holding.valuedQuantity * holding.unitValue;
    demand[holding.item] = (demand[holding.item] ?? 0) - holding.valuedQuantity;
  }
  return holdings;
}

export function getVocationInventoryValue(world: WorldPack, state: Partial<Pick<LifeState, "vocations">>): number {
  return amount(getVocationHoldings(world, state).reduce((sum, item) => sum + item.unitValue * item.valuedQuantity, 0), "Vocation inventory realizable value");
}

export function getAssetValue(world: WorldPack, state: ValuationState): number {
  if (!world.economy || !state.economy) return 0;
  const valuation = { ...state, age: state.age ?? 0, lastEventAge: state.lastEventAge ?? {}, eventCounts: state.eventCounts ?? {} };
  return amount(world.economy.assets.reduce((sum, asset) => sum + marketQuote(world, valuation, asset.id).sell * (state.economy!.assets[asset.id] ?? 0), 0)
    + marketOrderValue(world, valuation) + getDemoResourceValue(world, state) + getVocationInventoryValue(world, state), "Resource market value");
}

export function getNetWorth(world: WorldPack, state: ValuationState): number {
  if (!world.economy || !state.economy) return 0;
  return state.economy.cash + getAssetValue(world, state) - state.economy.debt;
}

export function initialEconomy(world: WorldPack, state: LifeState): EconomyState | undefined {
  if (!world.economy) return;
  // Origin stat arithmetic can carry a binary float residue (0.1 + 0.2).
  // Validated bounds and deltas resolve to whole currency, so round that residue.
  return { cash: amount(Math.round(state.stats[world.economy.stat] * world.economy.unitsPerPoint), "Starting cash"), debt: 0,
    assets: Object.fromEntries(world.economy.assets.map(asset => [asset.id, 0])),
    ...(world.economy.market ? { market: { orders: [], nextOrderId: 1, tradingYears: 0 } } : {}) };
}

export function syncEconomyStat(world: WorldPack, state: LifeState): void {
  if (!world.economy || !state.economy) return;
  const definition = world.stats[world.economy.stat];
  const value = getNetWorth(world, state) / world.economy.unitsPerPoint;
  state.stats[world.economy.stat] = Math.max(definition.min, world.economy.uncappedResources ? value : Math.min(definition.max, value));
}

/** Settle debt only at the engine's annual boundary, after ordinary costs.
 * Repayment transfers existing cash; it never borrows or sells possessions. */
export function repayDebtAutomatically(world: WorldPack, state: LifeState): number {
  if (!world.economy?.autoDebtRepayment || !state.economy || state.phase === "ended") return 0;
  const cash = amount(state.economy.cash, "Cash"), debt = amount(state.economy.debt, "Debt");
  const ordinaryDebt = amount(debt - (state.economy.loan?.balance ?? 0), "Ordinary debt");
  const repaid = Math.min(cash, ordinaryDebt);
  if (repaid === 0) return 0;
  const remainingCash = amount(cash - repaid, "Cash"), remainingDebt = amount(debt - repaid, "Debt");
  state.economy.cash = remainingCash;
  state.economy.debt = remainingDebt;
  syncEconomyStat(world, state);
  return repaid;
}

/** Apply one ledger effect. Insufficient mandatory cash expenses become unpaid debt. */
export function applyEconomyEffect(world: WorldPack, state: LifeState, effect: Effect): boolean {
  if (!world.economy || !state.economy) return false;
  const economy = state.economy;
  if (effect.type === "loan") {
    applyLoanEffect(world, state, effect);
    syncEconomyStat(world, state);
    return true;
  }
  const cashDelta = effect.type === "cash" ? effect.delta
    : effect.type === "stat" && effect.stat === world.economy.stat ? effect.delta * world.economy.unitsPerPoint : undefined;
  if (cashDelta !== undefined) {
    if (!Number.isSafeInteger(cashDelta)) throw new Error("Cash changes must be whole currency amounts.");
    const remaining = economy.cash + cashDelta;
    if (remaining < 0) { economy.debt = amount(economy.debt - remaining, "Debt"); economy.cash = 0; }
    else economy.cash = amount(remaining, "Cash");
  } else if (effect.type === "debt") {
    if (economy.loan && economy.debt + effect.delta < economy.loan.balance) throw new Error("Use a moneylender loan payment to reduce that loan balance.");
    economy.debt = amount(economy.debt + effect.delta, "Debt");
  } else if (effect.type === "asset") {
    const asset = world.economy.assets.find(candidate => candidate.id === effect.asset)!;
    const quantity = amount((economy.assets[effect.asset] ?? 0) + effect.delta, asset.title);
    if (!world.economy.uncappedResources && asset.maxOwned !== undefined && marketCommittedQuantity(state, effect.asset) + effect.delta > asset.maxOwned) throw new Error(`${asset.title} is limited to ${asset.maxOwned}.`);
    economy.assets[effect.asset] = quantity;
  } else return false;
  syncEconomyStat(world, state);
  return true;
}

/** Exact, detached projection; no accepted command, random draw or life mutation. */
export function previewEconomyEffects(world: WorldPack, life: LifeState, effects: readonly Effect[]): EconomyState | undefined {
  if (!world.economy || !life.economy) return;
  const state = { ...life, stats: { ...life.stats }, economy: { ...life.economy, assets: { ...life.economy.assets }, ...(life.economy.loan ? { loan: { ...life.economy.loan } } : {}) } };
  for (const effect of effects) {
    if (effect.type === "end") break;
    applyEconomyEffect(world, state, effect.type === "vocation" ? { type: "cash", delta: vocationCashDelta(world, life, effect.action) } : effect);
  }
  return state.economy;
}

/** Every possible voluntary outcome must be affordable in effect order. */
export function financeActivityReason(world: WorldPack, life: LifeState, activity: Pick<Choice, "outcomes">): string | undefined {
  if (!world.economy || !life.economy) return;
  for (const outcome of activity.outcomes) {
    const state = { ...life, stats: { ...life.stats }, economy: { ...life.economy, assets: { ...life.economy.assets }, ...(life.economy.loan ? { loan: { ...life.economy.loan } } : {}) } };
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      const delta = effect.type === "cash" ? effect.delta
        : effect.type === "stat" && effect.stat === world.economy.stat ? effect.delta * world.economy.unitsPerPoint : 0;
      if (delta < 0 && state.economy.cash < -delta) return `Needs ${-delta} ${world.economy.currency.short} in cash (you have ${state.economy.cash}).`;
      if (effect.type === "debt" && state.economy.debt + effect.delta < 0) return `You do not owe that much debt (currently ${state.economy.debt} ${world.economy.currency.short}).`;
      if (effect.type === "debt" && state.economy.loan && state.economy.debt + effect.delta < state.economy.loan.balance) return "This payment covers household debt only. Use the moneylender loan payment for the remaining balance.";
      if (effect.type === "asset") {
        const asset = world.economy.assets.find(candidate => candidate.id === effect.asset)!;
        const next = (state.economy.assets[effect.asset] ?? 0) + effect.delta;
        if (next < 0) return `You do not own enough ${asset.title.toLowerCase()}.`;
        if (!world.economy.uncappedResources && asset.maxOwned !== undefined && marketCommittedQuantity(state, effect.asset) + effect.delta > asset.maxOwned) return `You can own at most ${asset.maxOwned} ${asset.title.toLowerCase()}.`;
      }
      try { applyEconomyEffect(world, state, effect); } catch (error) { return (error as Error).message; }
    }
  }
}

export function yearlyAssetIncome(world: WorldPack, state: LifeState): number {
  if (!world.economy || !state.economy) return 0;
  return amount(world.economy.assets.reduce((sum, asset) => sum + (asset.yearlyIncome ?? 0) * (state.economy!.assets[asset.id] ?? 0), 0), "Resource annual income");
}
