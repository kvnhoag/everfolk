import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEngine, demoWorld, liveUntil } from "./fixtures/demo/world.ts";
import { canonicalJson } from "../src/random.ts";
import { demoContext } from "../src/demo/state.ts";
import {
  armyReserve, buyForHousehold, executeTrade, growerHarvest, marketView, movePrices, rulePrices, townTrades, tradeReason,
} from "../src/demo/market.ts";
import type { DemoContext, DemoState, LifeStateWithDemo, TradeCommand, TradeItem } from "../src/demo/contracts.ts";
import type { Effect, LifeState } from "../src/types.ts";

const world = demoWorld();
const def = world.demo!;
const m = def.market;

/** An adult life in the ready phase, from the real engine. */
function adult(seed = "market-seed"): LifeStateWithDemo {
  const life = liveUntil(demoEngine(), seed, state => state.age >= 16 && state.phase === "ready");
  assert.equal(life.phase, "ready");
  return life as LifeStateWithDemo;
}

interface Draft { life: LifeStateWithDemo; ctx: DemoContext; lines: { id: string; text: string }[] }

/** A private draft and context for module-level tests; cash effects follow the economy rule (never negative here). */
function draft(life: LifeState, patch: (life: LifeStateWithDemo) => void = () => {}): Draft {
  const copy = structuredClone(life) as LifeStateWithDemo;
  patch(copy);
  const lines: Draft["lines"] = [];
  const apply = (effects: readonly Effect[]): void => {
    for (const effect of effects) {
      if (effect.type !== "cash") throw new Error(`unexpected effect ${effect.type}`);
      const next = copy.economy!.cash + effect.delta;
      assert.ok(next >= 0, "the market never sends cash negative");
      copy.economy!.cash = next;
    }
  };
  const ctx = demoContext(world, copy, apply, (id, text) => lines.push({ id, text }));
  return { life: copy, ctx, lines };
}

const order = (item: TradeItem, side: "buy" | "sell", quantity: number, counterparty: "merchant" | "army" = "merchant"): TradeCommand =>
  ({ type: "trade", item, side, quantity, counterparty });

function grainTotal(demo: DemoState): number {
  const t = demo.town;
  return demo.household.grain + t.grower.grain + t.merchant.grain + t.army.grain + (demo.shipment?.cargo ?? 0);
}

function moneyTotal(life: LifeStateWithDemo): number {
  const t = life.demo.town;
  return life.economy!.cash + t.grower.cash + t.merchant.cash + t.army.purse;
}

function number(text: string, pattern: RegExp): number {
  const match = pattern.exec(text);
  return match ? Number(match[1]) : 0;
}

// ── Prices ──────────────────────────────────────────────────────────────────

test("quotes stay within floor and ceiling and answer to stock, army demand and road cost", () => {
  const base = adult();
  const quote = (patch: (demo: DemoState) => void) => {
    const { life } = draft(base, l => patch(l.demo));
    return rulePrices(def, life.demo);
  };
  const calm = (demo: DemoState, stock: number) => {
    demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [] };
    demo.town.merchant.grain = stock;
  };
  const scarce = quote(d => calm(d, 300)).prices.grain.sell;
  const plenty = quote(d => calm(d, 6000)).prices.grain.sell;
  const target = quote(d => calm(d, m.targetGrainStock)).prices.grain.sell;
  assert.ok(scarce > target && target > plenty, `scarce ${scarce} > target ${target} > plenty ${plenty}`);
  assert.equal(target, m.basePrice.grain);

  const war = quote(d => { calm(d, m.targetGrainStock); d.year.army = "war"; }).prices.grain.sell;
  assert.ok(war > target, "army demand raises grain");
  const dangerous = quote(d => { calm(d, m.targetGrainStock); d.year.road = "dangerous"; }).prices.grain.sell;
  assert.ok(dangerous > target, "transport cost raises grain");

  for (const stock of [0, 100, 3000, 100_000]) {
    for (const army of ["quiet", "war"] as const) {
      for (const road of ["safe", "dangerous"] as const) {
        for (const flood of ["low", "high"] as const) {
          const { prices, armyGrainPrice } = quote(d => { calm(d, stock); d.year = { flood, army, road, fresh: [] }; });
          for (const [item, q] of Object.entries(prices) as [TradeItem, { buy: number; sell: number }][]) {
            const floor = Math.max(1, Math.floor(m.basePrice[item] * m.priceFloorBps / 10_000));
            const ceiling = Math.floor(m.basePrice[item] * m.priceCeilingBps / 10_000);
            assert.ok(q.sell >= floor && q.sell <= ceiling, `${item} sell ${q.sell} in [${floor}, ${ceiling}]`);
            assert.ok(q.buy >= 1 && q.buy <= q.sell, `${item} buy ${q.buy} ≤ sell ${q.sell}`);
          }
          assert.ok(armyGrainPrice >= prices.grain.sell);
        }
      }
    }
  }
});

test("goods prices follow the year: war lifts metals, a dangerous road lifts silk, a good flood lowers grain and linen", () => {
  const base = adult();
  const at = (year: Partial<DemoState["year"]>) => draft(base, l => {
    l.demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [], ...year };
    l.demo.town.merchant.grain = m.targetGrainStock;
  }).life.demo;
  const calm = rulePrices(def, at({})).prices;
  const war = rulePrices(def, at({ army: "war" })).prices;
  assert.ok(war.gold.sell > calm.gold.sell && war.silver.sell > calm.silver.sell);
  assert.ok(rulePrices(def, at({ road: "dangerous" })).prices.silk.sell > calm.silk.sell);
  const good = rulePrices(def, at({ flood: "high" })).prices;
  assert.ok(good.linen.sell < calm.linen.sell && good.grain.sell <= calm.grain.sell);
  const levy = rulePrices(def, at({ army: "recruiting" }));
  assert.ok(levy.armyGrainPrice > levy.prices.grain.sell, "levy premium on the army price");
});

test("movePrices writes the rule quotes and draws no randomness", () => {
  const { life, ctx } = draft(adult(), l => { l.demo.town.merchant.grain = 200; });
  const rng = life.demo.rng;
  const expected = rulePrices(def, life.demo);
  movePrices(ctx);
  assert.deepEqual(life.demo.town.prices, expected.prices);
  assert.equal(life.demo.town.armyGrainPrice, expected.armyGrainPrice);
  assert.equal(life.demo.rng, rng);
});

// ── Orders ──────────────────────────────────────────────────────────────────

test("a grain buy moves grain merchant→household and cash household→merchant exactly", () => {
  const { life, ctx, lines } = draft(adult(), l => { l.economy!.cash = 500; });
  const before = structuredClone(life);
  const price = life.demo.town.prices.grain.sell;
  executeTrade(ctx, order("grain", "buy", 40));
  assert.equal(life.demo.household.grain, before.demo.household.grain + 40);
  assert.equal(life.demo.town.merchant.grain, before.demo.town.merchant.grain - 40);
  assert.equal(life.economy!.cash, 500 - 40 * price);
  assert.equal(life.demo.town.merchant.cash, before.demo.town.merchant.cash + 40 * price);
  assert.equal(grainTotal(life.demo), grainTotal(before.demo));
  assert.equal(moneyTotal(life), moneyTotal(before));
  assert.equal(life.demo.lastTradeAge, life.age);
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /40 measures of grain/);
});

test("a sale is the reverse and is limited by the merchant's cash", () => {
  const base = adult();
  const { life, ctx } = draft(base, l => { l.demo.household.grain = 500; });
  const before = structuredClone(life);
  const price = life.demo.town.prices.grain.buy;
  executeTrade(ctx, order("grain", "sell", 100));
  assert.equal(life.demo.household.grain, 400);
  assert.equal(life.demo.town.merchant.grain, before.demo.town.merchant.grain + 100);
  assert.equal(life.economy!.cash, before.economy!.cash + 100 * price);
  assert.equal(life.demo.town.merchant.cash, before.demo.town.merchant.cash - 100 * price);
  assert.equal(moneyTotal(life), moneyTotal(before));

  const poor = draft(base, l => { l.demo.household.grain = 500; l.demo.town.merchant.cash = 5; });
  assert.throws(() => executeTrade(poor.ctx, order("grain", "sell", 100)), /merchant has only 5/);
  assert.equal(poor.life.demo.household.grain, 500);
  assert.equal(poor.life.demo.lastTradeAge, base.demo.lastTradeAge);
  const short = draft(base, l => { l.demo.household.grain = 10; });
  assert.throws(() => executeTrade(short.ctx, order("grain", "sell", 11)), /hold only 10/);
});

test("buys are limited by the merchant's stock and the player's cash", () => {
  const base = adult();
  const empty = draft(base, l => { l.economy!.cash = 10_000; l.demo.town.merchant.grain = 5; });
  assert.throws(() => executeTrade(empty.ctx, order("grain", "buy", 6)), /merchant has only 5/);
  const broke = draft(base, l => { l.economy!.cash = 3; });
  assert.throws(() => executeTrade(broke.ctx, order("grain", "buy", 100)), /You need .* but have 3/);
  const huge = draft(base, l => { l.economy!.cash = 10_000_000; });
  assert.throws(() => executeTrade(huge.ctx, order("grain", "buy", m.maxOrderQuantity + 1)), /at most/);
});

test("one order per year through the engine; the next year opens a new visit", () => {
  const engine = demoEngine();
  const life = adult("one-visit");
  const sold = engine.demo(life, order("grain", "sell", 1));
  assert.equal(sold.demo!.lastTradeAge, sold.age);
  assert.throws(() => engine.demo(sold, order("grain", "sell", 1)), /already made this year's market visit/);
  assert.match(tradeReason(def, sold as LifeStateWithDemo, order("grain", "sell", 1)) ?? "", /already/);
  let next: LifeState = sold;
  while (next.phase !== "ended" && (next.age === sold.age || next.phase !== "ready")) {
    next = next.phase === "choice" ? engine.choose(next, engine.getChoices(next)[0].id) : engine.advance(next);
  }
  assert.equal(tradeReason(def, next as LifeStateWithDemo, order("grain", "sell", 1)), undefined);
  const again = engine.demo(next, order("grain", "sell", 1));
  assert.deepEqual(engine.replay(again.seed, again.commands), again);
});

test("the army buys only grain, only from a grain dealer, and its sale goes through the contract shipment", () => {
  const base = adult();
  const dealer = (patch: (l: LifeStateWithDemo) => void = () => {}) => draft(base, l => {
    l.character!.jobId = "grain-dealer"; l.demo.household.grain = 800; patch(l);
  });
  const notDealer = draft(base, l => { l.character!.jobId = "tenant-farmer"; l.demo.household.grain = 800; });
  assert.throws(() => executeTrade(notDealer.ctx, order("grain", "sell", 100, "army")), /Only a grain dealer/);
  assert.throws(() => executeTrade(dealer().ctx, order("silver", "sell", 1, "army")), /army only buys grain/);
  assert.throws(() => executeTrade(dealer().ctx, order("grain", "buy", 1, "army")), /army does not sell/);
  assert.throws(() => executeTrade(dealer(l => { l.demo.town.army.purse = 10; }).ctx, order("grain", "sell", 100, "army")), /army purse/);

  const ok = dealer();
  const before = structuredClone(ok.life);
  executeTrade(ok.ctx, order("grain", "sell", 100, "army"));
  // Service (track C) moves the grain and the pay; the market only records the visit.
  assert.equal(ok.life.economy!.cash, before.economy!.cash);
  assert.equal(ok.life.demo.town.merchant.grain, before.demo.town.merchant.grain);
  assert.equal(ok.life.demo.lastTradeAge, ok.life.age);
  assert.match(ok.lines.at(-1)!.text, /army/);
});

test("goods and animals trade the same way, and a household keeps only a few animals", () => {
  const base = adult();
  const { life, ctx } = draft(base, l => { l.economy!.cash = 5000; });
  const before = structuredClone(life);
  const silver = life.demo.town.prices.silver.sell;
  executeTrade(ctx, order("silver", "buy", 2));
  assert.equal(life.demo.goods.silver, before.demo.goods.silver + 2);
  assert.equal(life.demo.town.merchant.goods.silver, before.demo.town.merchant.goods.silver - 2);
  assert.equal(life.economy!.cash, 5000 - 2 * silver);

  const ox = draft(base, l => { l.economy!.cash = 5000; });
  executeTrade(ox.ctx, order("ox", "buy", 1));
  assert.equal(ox.life.demo.household.animals.ox, base.demo.household.animals.ox + 1);
  assert.equal(ox.life.demo.town.merchant.animals.ox, base.demo.town.merchant.animals.ox - 1);

  const many = draft(base, l => { l.economy!.cash = 50_000; l.demo.household.animals.donkey = 3; });
  assert.throws(() => executeTrade(many.ctx, order("donkey", "buy", 1)), /at most 3/);

  const linen = draft(base, l => { l.demo.goods.linen = 4; });
  executeTrade(linen.ctx, order("linen", "sell", 4));
  assert.equal(linen.life.demo.goods.linen, 0);
  assert.equal(linen.life.economy!.cash, base.economy!.cash + 4 * base.demo.town.prices.linen.buy);

  const flax = draft(base, l => { l.demo.household.flax = 9; });
  executeTrade(flax.ctx, order("flax", "sell", 9));
  assert.equal(flax.life.demo.household.flax, 0);
  assert.equal(flax.life.demo.town.merchant.flax, base.demo.town.merchant.flax + 9);
});

test("a rejected order through the engine changes nothing", () => {
  const engine = demoEngine();
  const life = adult("rejected-seed");
  const before = canonicalJson(life);
  const tooMuch = life.demo.household.grain + 1;
  assert.throws(() => engine.demo(life, order("grain", "sell", tooMuch)));
  assert.throws(() => engine.demo(life, order("gold", "buy", 1_000)));
  assert.throws(() => engine.demo(life, order("grain", "sell", 1, "army")));
  assert.equal(canonicalJson(life), before);
});

test("buyForHousehold never exceeds the merchant's stock or the player's cash", () => {
  const base = adult();
  const price = base.demo.town.prices.grain.sell;
  const rich = draft(base, l => { l.economy!.cash = 100_000; l.demo.town.merchant.grain = 70; });
  assert.equal(buyForHousehold(rich.ctx, 500), 70);
  assert.equal(rich.life.demo.town.merchant.grain, 0);
  assert.equal(rich.life.economy!.cash, 100_000 - 70 * price);

  const poor = draft(base, l => { l.economy!.cash = price * 7 + (price - 1); });
  const before = structuredClone(poor.life);
  assert.equal(buyForHousehold(poor.ctx, 500), 7);
  assert.equal(poor.life.demo.household.grain, before.demo.household.grain + 7);
  assert.equal(poor.life.economy!.cash, price - 1);
  assert.equal(grainTotal(poor.life.demo), grainTotal(before.demo));
  assert.equal(moneyTotal(poor.life), moneyTotal(before));
  assert.equal(poor.life.demo.lastTradeAge, before.demo.lastTradeAge, "household buying is not the yearly visit");

  const none = draft(base, l => { l.economy!.cash = 0; });
  assert.equal(buyForHousehold(none.ctx, 50), 0);
  assert.equal(none.lines.length, 0);
});

// ── Townspeople ─────────────────────────────────────────────────────────────

test("town trades balance: grower harvest and army eating are the only grain changes; money moves only by allocation and imports", () => {
  for (const flood of ["low", "normal", "high"] as const) {
    for (const army of ["quiet", "war"] as const) {
      const { life, ctx, lines } = draft(adult(), l => {
        l.demo.year = { flood, army, road: "safe", fresh: [] };
        l.demo.town.merchant.goods = { silver: 0, gold: 0, silk: 0, linen: 0 };
      });
      const before = structuredClone(life);
      townTrades(ctx);
      const text = lines.map(line => line.text).join(" ");
      const harvested = number(text, /grower harvests (\d+)/);
      assert.equal(harvested, growerHarvest(def, flood));
      const eaten = number(text, /eat (\d+)/) + number(text, /army eats (\d+)/);
      const spoiled = number(text, /(\d+) spoil/);
      assert.equal(grainTotal(life.demo), grainTotal(before.demo) + harvested - eaten - spoiled);
      const imports = number(text, /imports goods for (\d+)/);
      assert.equal(moneyTotal(life), moneyTotal(before) + m.royalAllocation - imports);
      for (const value of [life.demo.town.grower.grain, life.demo.town.merchant.grain, life.demo.town.army.grain, life.demo.town.merchant.cash, life.demo.town.army.purse]) {
        assert.ok(Number.isSafeInteger(value) && value >= 0);
      }
    }
  }
});

test("royal allocation refills the army purse; the army buys its demand and reserve but keeps wage money", () => {
  const { life, ctx } = draft(adult(), l => {
    l.demo.year = { flood: "normal", army: "recruiting", road: "safe", fresh: [] };
    l.demo.town.army = { grain: 1000, purse: 0 };
    l.demo.town.merchant.grain = 100_000;
  });
  townTrades(ctx);
  const t = life.demo.town;
  const reserve = m.armyPurseReserve!;
  const need = m.armyDemand.recruiting + (armyReserve(m) - 1000);
  const bought = Math.min(need, Math.floor((m.royalAllocation - reserve) / t.armyGrainPrice));
  assert.equal(t.army.purse, m.royalAllocation - bought * t.armyGrainPrice);
  assert.ok(t.army.purse >= reserve, "wage money stays in the purse");
  assert.equal(t.army.grain, 1000 + bought - m.armyDemand.recruiting);

  const fed = draft(adult(), l => {
    l.demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [] };
    l.demo.town.army = { grain: armyReserve(m), purse: 100_000 };
  });
  townTrades(fed.ctx);
  assert.equal(fed.life.demo.town.army.grain, armyReserve(m), "a full reserve buys exactly what it eats");
});

test("imports scale with the road's import factor and are paid from the merchant's cash", () => {
  const run = (road: "safe" | "dangerous") => {
    const { life, ctx } = draft(adult(), l => {
      l.demo.year = { flood: "normal", army: "quiet", road, fresh: [] };
      l.demo.town.merchant.goods = { silver: 0, gold: 0, silk: 0, linen: 0 };
      l.demo.town.merchant.cash = 100_000;
    });
    townTrades(ctx);
    return life.demo.town.merchant.goods;
  };
  const safe = run("safe"), dangerous = run("dangerous");
  assert.equal(safe.silver, m.yearlyImports.silver);
  assert.equal(dangerous.silver, Math.floor(m.yearlyImports.silver * m.importFactorBps.dangerous / 10_000));
  assert.ok(dangerous.silver < safe.silver && dangerous.linen < safe.linen);
  const full = draft(adult(), l => { l.demo.town.merchant.goods = { ...m.start.merchant.goods }; });
  townTrades(full.ctx);
  assert.deepEqual(full.life.demo.town.merchant.goods, m.start.merchant.goods, "imports only restock");
  assert.match(full.lines.map(line => line.text).join(" "), /imports goods for 0 /);
});

// ── Read-only views ─────────────────────────────────────────────────────────

test("marketView and tradeReason never change the life or draw randomness", () => {
  const life = adult("view-seed");
  assert.ok(Object.isFrozen(life.demo.town));
  const before = canonicalJson(life);
  const view = marketView(def, life);
  assert.equal(view.quotes.length, 8);
  assert.equal(view.visitUsed, false);
  const grain = view.quotes.find(q => q.item === "grain")!;
  assert.equal(grain.merchantStock, life.demo.town.merchant.grain);
  assert.equal(grain.merchantCanBuy, Math.floor(life.demo.town.merchant.cash / grain.buy));
  assert.equal(view.armyOpen, false);
  assert.equal(tradeReason(def, life, order("grain", "buy", 1_000_000)), `Orders are limited to at most ${m.maxOrderQuantity} at a time.`);
  assert.equal(tradeReason(def, life, order("grain", "sell", 1, "army")), "Only a grain dealer can sell to the army under contract.");
  assert.equal(canonicalJson(life), before);
});

test("tradeReason agrees with executeTrade", () => {
  const base = adult("agree-seed");
  const orders: TradeCommand[] = [
    order("grain", "buy", 10), order("grain", "sell", 10), order("gold", "buy", 50), order("ox", "buy", 1),
    order("silk", "sell", 1), order("flax", "buy", 5), order("grain", "sell", 5, "army"), order("donkey", "sell", 1),
  ];
  for (const command of orders) {
    const reason = tradeReason(def, base, command);
    const { ctx } = draft(base);
    if (reason === undefined) assert.doesNotThrow(() => executeTrade(ctx, command));
    else assert.throws(() => executeTrade(ctx, command), new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("young children cannot visit the market", () => {
  const child = liveUntil(demoEngine(), "child-seed", state => state.age >= 3 && state.phase === "ready") as LifeStateWithDemo;
  assert.match(tradeReason(def, child, order("grain", "buy", 1)) ?? "", /too young/);
});

// ── Conservation through the real engine ────────────────────────────────────

test("grain across household, grower, merchant and army changes only by harvest, eating, spoilage, rent and army consumption", () => {
  const engine = demoEngine();
  let life = liveUntil(engine, "ledger-seed", state => state.age >= 14 && state.phase === "ready") as LifeStateWithDemo;
  let drift = 0;
  for (let year = 0; year < 12 && life.phase !== "ended"; year++) {
    if (life.phase === "ready" && year % 2 === 0) {
      const command = order("grain", year % 4 === 0 ? "buy" : "sell", 5);
      if (tradeReason(def, life, command) === undefined) life = engine.demo(life, command) as LifeStateWithDemo;
    }
    const start = life.journal.length;
    const town = (s: LifeStateWithDemo) => grainTotal(s.demo) - s.demo.household.grain;
    const beforeTown = town(life), beforeHousehold = life.demo.household.grain;
    life = (life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life)) as LifeStateWithDemo;
    if (life.phase === "ended") break;
    const fresh = life.journal.slice(start);
    const text = fresh.filter(entry => entry.id === "town-year").map(entry => entry.text).join(" ");
    // Household's own flows (its harvest, rent, eating, spoilage) are measured as its change net of
    // grain the town sold it; town flows come from the town's journal lines.
    const toHousehold = fresh.filter(e => e.id === "market-household-buy").reduce((sum, e) => sum + number(e.text, /buys (\d+) measures/), 0);
    const townFlows = number(text, /grower harvests (\d+)/) - number(text, /eat (\d+)/) - number(text, /(\d+) spoil/) - number(text, /army eats (\d+)/);
    assert.equal(town(life) - beforeTown, townFlows - toHousehold, `town grain at age ${life.age}`);
    drift += (life.demo.household.grain - beforeHousehold) - toHousehold;
  }
  assert.ok(Number.isFinite(drift));
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
