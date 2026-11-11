import type { CharacterActivity, Choice, Effect, LifeState, WorldPack } from "../../src/types.ts";
import { financeActivityReason, getNetWorth, previewEconomyEffects } from "../../src/economy.ts";
import { matchesCondition } from "../../src/engine.ts";
import { getWealthComparison } from "./wealth-comparison.ts";
import { marketOrderValue, marketQuote } from "../../src/market.ts";

export function formatMoney(amount: number, world: WorldPack, full = false): string {
  const currency = world.economy?.currency;
  const value = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(amount);
  return currency ? `${value} ${full ? Math.abs(amount) === 1 ? currency.singular : currency.plural : currency.short}` : value;
}

export function assetValue(world: WorldPack, assets: Record<string, number>, life?: LifeState): number {
  return world.economy?.assets.reduce((sum, asset) => sum + (assets[asset.id] ?? 0) * (life && world.economy?.market?.goods.includes(asset.id) ? marketQuote(world, life, asset.id).sell : asset.value), 0) ?? 0;
}

export interface MoneyImpact { id: "cash" | "assets" | "debt"; label: string; min: number; max: number; inverse: boolean }
/** Immediate, bounded money outcomes only. No annual income or speculative resale. */
export function getMoneyImpact(choice: Choice, life: LifeState, world: WorldPack): MoneyImpact[] {
  if (!world.economy || !life.economy) return [];
  const current = life.economy;
  // Unavailable voluntary actions have no executable outcome. Show their quoted
  // cash/asset/debt terms, rather than implying that they can buy on credit.
  const quoted = "category" in choice && Boolean(financeActivityReason(world, life, choice as CharacterActivity));
  const previews = choice.outcomes.map(outcome => {
    if (!quoted) return previewEconomyEffects(world, life, outcome.effects) ?? current;
    const next = { ...current, assets: { ...current.assets }, ...(current.loan ? { loan: { ...current.loan } } : {}) };
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "cash") next.cash += effect.delta;
      if (effect.type === "stat" && effect.stat === world.economy!.stat) next.cash += effect.delta * world.economy!.unitsPerPoint;
      if (effect.type === "asset") next.assets[effect.asset] = (next.assets[effect.asset] ?? 0) + effect.delta;
      if (effect.type === "debt") next.debt += effect.delta;
      if (effect.type === "loan" && world.economy!.moneylender) {
        const lender = world.economy!.moneylender;
        if (effect.action === "borrow") { next.cash += lender.principal; next.debt += lender.principal + lender.fee; }
        if (effect.action === "repay") { const payment = effect.amount ?? current.loan?.balance ?? 0; next.cash -= payment; next.debt -= payment; }
        if (effect.action === "extend") next.debt += lender.extensionFee;
      }
    }
    return next;
  });
  const entries: { id: MoneyImpact["id"]; label: string; before: number; values: number[]; inverse: boolean }[] = [
    { id: "cash", label: "Cash", before: current.cash, values: previews.map(item => item.cash), inverse: false },
    { id: "assets", label: "Assets", before: assetValue(world, current.assets, life), values: previews.map(item => assetValue(world, item.assets, life)), inverse: false },
    { id: "debt", label: "Debt", before: current.debt, values: previews.map(item => item.debt), inverse: true },
  ];
  return entries.flatMap(item => {
    const deltas = item.values.map(value => value - item.before);
    const min = Math.min(...deltas), max = Math.max(...deltas);
    return min === 0 && max === 0 ? [] : [{ id: item.id, label: item.label, min, max, inverse: item.inverse }];
  });
}

export function directMoneyDelta(effects: readonly Effect[], world: WorldPack): number {
  if (!world.economy) return 0;
  let total = 0;
  for (const effect of effects) {
    if (effect.type === "end") break;
    if (effect.type === "stat" && effect.stat === world.economy.stat) total += effect.delta * world.economy.unitsPerPoint;
    if (effect.type === "cash") total += effect.delta;
  }
  return total;
}

export function getWealthSummary(world: WorldPack, life: LifeState) {
  if (!world.economy || !life.economy) return null;
  const assets = world.economy.assets.map(asset => ({ ...asset, value: world.economy?.market?.goods.includes(asset.id) ? marketQuote(world, life, asset.id).sell : asset.value, quantity: life.economy!.assets[asset.id] ?? 0 }))
    .filter(asset => asset.quantity > 0);
  const job = world.character?.jobs.find(item => item.id === life.character?.jobId);
  const trading = Boolean(world.economy.market && life.character?.lastActivityAges[world.economy.market.traderFocusActivity] === life.age);
  const jobCash = trading ? 0 : directMoneyDelta(job?.yearlyEffects ?? [], world);
  const committedValue = marketOrderValue(world, life);
  const fixedYearlyCash = directMoneyDelta(world.yearlyEffects, world);
  const conditionalCosts = (world.yearlyRules ?? []).flatMap(rule => {
    const amount = directMoneyDelta(rule.effects, world);
    return amount < 0 ? [{ id: rule.id, amount: -amount, active: matchesCondition(rule.when, life), fromAge: rule.when?.type === "age" && rule.when.op === "gte" ? rule.when.value : undefined }] : [];
  });
  const lessonPrices = [...new Set((world.character?.activities ?? []).filter(activity => activity.category === "training")
    .flatMap(activity => activity.outcomes.map(outcome => -directMoneyDelta(outcome.effects, world)))
    .filter(amount => amount > 0))].sort((a, b) => a - b);
  return {
    cash: life.economy.cash, debt: life.economy.debt, normalDebt: life.economy.debt - (life.economy.loan?.balance ?? 0), assets, assetTotal: assetValue(world, life.economy.assets, life), committedValue,
    netWorth: getNetWorth(world, life), comparison: getWealthComparison(world, life), job, jobCash, trading, fixedYearlyCash, conditionalCosts,
    assetIncome: assets.reduce((sum, asset) => sum + (asset.yearlyIncome ?? 0) * asset.quantity, 0),
    currentCosts: -Math.min(0, fixedYearlyCash) + conditionalCosts.filter(item => item.active).reduce((sum, item) => sum + item.amount, 0),
    lessonPrices, affordableLessons: lessonPrices.length ? Math.floor(life.economy.cash / lessonPrices[0]) : 0,
  };
}
