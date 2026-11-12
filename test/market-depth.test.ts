/** Lives-4 market depth: trades move prices, the grain spread is narrow, and older worlds keep their fixed quotes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/engine.ts";
import { demoContext } from "../src/demo/state.ts";
import { buyForHousehold, executeTrade, marketView, movePrices, rulePrices } from "../src/demo/market.ts";
import { depthQuote } from "../src/demo/market-depth.ts";
import { demoWorld, liveUntil } from "./fixtures/demo/world.ts";
import type { DemoContext, LifeStateWithDemo, TradeCommand, TradeItem } from "../src/demo/contracts.ts";
import type { Effect, LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const lives4 = shipped as unknown as WorldPack;
const lives3 = retained as unknown as WorldPack;

const adults = new Map<WorldPack, LifeStateWithDemo>();
/** An adult in the ready phase, reached through the real engine. */
function adult(world: WorldPack): LifeStateWithDemo {
  const cached = adults.get(world);
  if (cached) return cached;
  const life = liveUntil(createEngine(world), "market-depth", state => state.age >= 18 && state.phase === "ready") as LifeStateWithDemo;
  assert.equal(life.phase, "ready");
  adults.set(world, life);
  return life;
}

interface Draft { life: LifeStateWithDemo; ctx: DemoContext; lines: { id: string; text: string }[] }
/** A private copy with a calm year, a clear market and plenty of grain and cash. */
function draft(world: WorldPack, patch: (life: LifeStateWithDemo) => void = () => {}): Draft {
  const life = structuredClone(adult(world));
  life.demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [] };
  life.demo.town.merchant.grain = world.demo!.market.targetGrainStock;
  life.demo.town.merchant.cash = 20_000;
  life.demo.household.grain = 6000;
  life.demo.lastTradeAge = null;
  life.economy!.cash = 5000;
  patch(life);
  const lines: Draft["lines"] = [];
  const apply = (effects: readonly Effect[]): void => {
    for (const effect of effects) {
      assert.equal(effect.type, "cash");
      if (effect.type === "cash") life.economy!.cash += effect.delta;
    }
  };
  return { life, ctx: demoContext(world, life, apply, (id, text) => lines.push({ id, text })), lines };
}
const order = (item: TradeItem, side: "buy" | "sell", quantity: number): TradeCommand =>
  ({ type: "trade", item, side, quantity, counterparty: "merchant", reserveOverride: true });
const money = (life: LifeStateWithDemo): number => {
  const t = life.demo.town;
  return life.economy!.cash + t.grower.cash + t.merchant.cash + t.army.purse;
};
const grain = (life: LifeStateWithDemo): number => {
  const t = life.demo.town;
  return life.demo.household.grain + t.grower.grain + t.merchant.grain + t.army.grain;
};
function sell(world: WorldPack, quantity: number, patch?: (life: LifeStateWithDemo) => void): Draft & { proceeds: number } {
  const d = draft(world, patch);
  const before = d.life.economy!.cash;
  executeTrade(d.ctx, order("grain", "sell", quantity));
  return { ...d, proceeds: d.life.economy!.cash - before };
}

test("lives-4: a large grain sale gets a lower average price than a small one", () => {
  const small = sell(lives4, 100), large = sell(lives4, 1500);
  assert.ok(small.proceeds / 100 > large.proceeds / 1500, `small ${small.proceeds / 100} > large ${large.proceeds / 1500} a measure`);
  // The 1,500-measure sale the play-testers made no longer brings 1,500 drachmas.
  assert.ok(large.proceeds < 1500 * 0.8, `1500 measures fetched ${large.proceeds}`);
  assert.ok(large.proceeds > 0);
});

test("lives-4: money and grain are conserved across a sale, a purchase and a household purchase", () => {
  const d = draft(lives4);
  const cash0 = money(d.life), grain0 = grain(d.life);
  executeTrade(d.ctx, order("grain", "sell", 1200));
  assert.equal(money(d.life), cash0, "whatever the merchant pays the household receives");
  assert.equal(grain(d.life), grain0);
  d.life.demo.lastTradeAge = null;
  executeTrade(d.ctx, order("grain", "buy", 300));
  assert.equal(money(d.life), cash0);
  assert.equal(grain(d.life), grain0);
  const bought = buyForHousehold(d.ctx, 250);
  assert.equal(bought, 250);
  assert.equal(money(d.life), cash0);
  assert.equal(grain(d.life), grain0);
  // Goods too: linen sold leaves the household and reaches the merchant, paid in full.
  d.life.demo.lastTradeAge = null;
  d.life.demo.goods.linen = 12;
  const linen0 = d.life.demo.goods.linen + d.life.demo.town.merchant.goods.linen;
  executeTrade(d.ctx, order("linen", "sell", 10));
  assert.equal(d.life.demo.goods.linen + d.life.demo.town.merchant.goods.linen, linen0);
  assert.equal(money(d.life), cash0);
});

test("lives-4: the grain spread is narrow and buying in volume raises the price", () => {
  const { life } = draft(lives4);
  const quote = depthQuote(lives4.demo!, life.demo, "grain");
  assert.ok(quote.ask <= Math.round(quote.bid * 1.25), `ask ${quote.ask} vs bid ${quote.bid} (hundredths of a drachma)`);
  assert.ok(quote.ask < 200, "a measure costs less than the old 2 drachmas");
  const cost = (quantity: number): number => {
    const d = draft(lives4);
    const before = d.life.economy!.cash;
    executeTrade(d.ctx, order("grain", "buy", quantity));
    return before - d.life.economy!.cash;
  };
  assert.ok(cost(800) / 800 > cost(20) / 20, "a large purchase costs more a measure");
  // The linen spread is narrower than the old 25% too.
  const linen = depthQuote(lives4.demo!, life.demo, "linen");
  assert.ok(linen.ask * 10_000 <= linen.bid * 11_500, `linen ask ${linen.ask} bid ${linen.bid} (was 25 and 20)`);
});

test("lives-4: a sale weighs on the price and the price recovers over the following years", () => {
  const { life, ctx } = draft(lives4);
  const clear = depthQuote(lives4.demo!, life.demo, "grain").bid;
  executeTrade(ctx, order("grain", "sell", 1500));
  const stock = lives4.demo!.market.targetGrainStock;
  const after: number[] = [];
  for (let year = 0; year < 8; year++) {
    life.demo.town.merchant.grain = stock;
    movePrices(ctx);
    after.push(depthQuote(lives4.demo!, life.demo, "grain").bid);
  }
  assert.ok(after[0] < clear * 0.8, `next year's price ${after[0]} stays well under ${clear}`);
  for (let i = 1; i < after.length; i++) assert.ok(after[i] >= after[i - 1], `recovers year by year: ${after.join(", ")}`);
  assert.ok(after.at(-1)! >= clear * 0.95, `recovered to ${after.at(-1)} of ${clear}`);
});

test("lives-4: the journal says how the sale moved the price, and the view shows the moved quote", () => {
  const { life, lines } = sell(lives4, 1500);
  const trade = lines.find(line => line.id === "market-trade")!;
  assert.match(trade.text, /^You sell 1500 measures of grain to the merchant for \d+ drachmas/);
  assert.match(trade.text, /price fell from [\d.]+ to [\d.]+ drachmas? a measure/);
  assert.match(trade.text, /barn now holds \d+ measures/);
  const view = marketView(lives4.demo!, life).quotes.find(quote => quote.item === "grain")!;
  assert.equal(Math.round(view.buy * 100), depthQuote(lives4.demo!, life.demo, "grain").bid);
});

test("older worlds keep their fixed prices and journal text", () => {
  for (const world of [lives3, demoWorld()]) {
    assert.equal(world.demo!.market.depth, undefined);
    const { life, lines, proceeds } = sell(world, 1500);
    const price = life.demo.town.prices.grain.buy;
    assert.equal(proceeds, 1500 * price, "every measure at the quoted price");
    assert.deepEqual(lines.filter(line => line.id === "market-trade").map(line => line.text),
      [`You sell 1500 measures of grain to the merchant for ${1500 * price} drachmas.`]);
    assert.equal((life.demo.town as { pressure?: unknown }).pressure, undefined);
    // A calm year at the usual stock: 2 drachmas asked, 1 paid; linen 25 asked, 20 paid.
    const rule = rulePrices(world.demo!, draft(world).life.demo).prices;
    assert.deepEqual([rule.grain.sell, rule.grain.buy, rule.linen.sell, rule.linen.buy], [2, 1, 25, 20]);
  }
});

test("lives-4 replays: the same commands give the same prices", () => {
  const engine = createEngine(lives4);
  const life = adult(lives4) as LifeState;
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("lives-4: bringing grain to market in a lean year raises standing with the volume; older worlds add one", () => {
  const lean = (life: LifeStateWithDemo) => { life.demo.year.flood = "low"; life.demo.reputation = 20; };
  assert.equal(sell(lives4, 1000, lean).life.demo.reputation, 24);
  assert.equal(sell(lives4, 100, lean).life.demo.reputation, 21);
  assert.equal(sell(lives3, 1000, lean).life.demo.reputation, 21);
});
