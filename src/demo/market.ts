/** Track B — townspeople, prices, trade orders, goods imports, livestock sales. */
import type { DemoContext, DemoDefinition, LifeStateWithDemo, TownState, TradeCommand, TradeItem } from "./contracts.ts";
import { GOODS, LIVESTOCK, TRADE_ITEMS } from "./types.ts";

export function initialTown(def: DemoDefinition): TownState {
  const m = def.market;
  const prices = Object.fromEntries(TRADE_ITEMS.map(item => {
    const sell = m.basePrice[item];
    return [item, { buy: Math.floor(sell * 10_000 / (10_000 + m.spreadBps)), sell }];
  })) as TownState["prices"];
  return {
    grower: { ...m.start.grower },
    merchant: { ...m.start.merchant, goods: { ...m.start.merchant.goods }, animals: { ...m.start.merchant.animals } },
    army: { ...m.start.army },
    prices, armyGrainPrice: m.basePrice.grain,
  };
}
void GOODS; void LIVESTOCK;

/** Grower harvest and sales, merchant–army trade, royal allocation, goods imports. */
export function townTrades(ctx: DemoContext): void { void ctx; }
/** Merchant quotes from stock vs target, army demand and road danger, within floor/ceiling. */
export function movePrices(ctx: DemoContext): void { void ctx; }
/** Settles the player's one order this year atomically; throws (changing nothing) when invalid. */
export function executeTrade(ctx: DemoContext, command: TradeCommand): void { void ctx; void command; }
/** Household shortfall purchase at the merchant's sell price; returns grain bought. */
export function buyForHousehold(ctx: DemoContext, quantity: number): number { void ctx; void quantity; return 0; }

export interface QuoteView { item: TradeItem; buy: number; sell: number; merchantStock: number; merchantCanBuy: number }
export interface MarketView {
  quotes: QuoteView[]; armyGrainPrice: number; armyOpen: boolean; visitUsed: boolean;
  merchantCash: number; reasons: string[];
}
/** Read-only quotes and limits. Never changes state or draws randomness. */
export function marketView(def: DemoDefinition, life: LifeStateWithDemo): MarketView {
  void def;
  const t = life.demo.town;
  return { quotes: TRADE_ITEMS.map(item => ({ item, ...t.prices[item], merchantStock: 0, merchantCanBuy: 0 })),
    armyGrainPrice: t.armyGrainPrice, armyOpen: false, visitUsed: life.demo.lastTradeAge === life.age, merchantCash: t.merchant.cash, reasons: [] };
}
/** Why an order would fail, or undefined when it would settle. Read-only. */
export function tradeReason(def: DemoDefinition, life: LifeStateWithDemo, command: TradeCommand): string | undefined {
  void def; void life; void command;
  return "The grain market is not open yet.";
}
