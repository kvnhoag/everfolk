import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import type { LifeStateWithDemo, TradeCommand } from "../src/demo/contracts.ts";
import { orderValue } from "../src/demo/market-depth.ts";
import { householdView } from "../src/demo/household.ts";
import { tradePreview } from "../client/models/trade-preview.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);

function liveTo(seed: string, age: number): LifeStateWithDemo {
  let life: LifeState = engine.start(seed);
  for (let step = 0; step < 400 && !(life.age >= age && life.phase === "ready") && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life as LifeStateWithDemo;
}

const order = (over: Partial<TradeCommand> = {}): TradeCommand => ({ type: "trade", item: "grain", side: "sell", quantity: 10, counterparty: "merchant", ...over });

test("a child's order is previewed as blocked with the market's own reason, and nothing to confirm", () => {
  const child = engine.start("preview-child") as LifeStateWithDemo;
  const preview = tradePreview(engine, child, order());
  assert.match(preview.blocked ?? "", /too young to trade/);
  assert.equal(preview.confirmLabel, null);
});

test("a sale is priced as it fills, shows the price move, the grain left and that it uses the year's visit", () => {
  const life = liveTo("preview-adult", 12);
  const quantity = 40;
  const preview = tradePreview(engine, life, order({ quantity, reserveOverride: true }));
  const value = orderValue(world.demo!, life.demo, "grain", "sell", quantity);
  assert.equal(preview.total, value.total);
  assert.equal(preview.blocked, null);
  assert.equal(preview.confirmLabel, `Sell ${quantity} grain for ${value.total} dr`);
  assert.ok(preview.lines.some(line => /only market visit this year/.test(line)));
  const view = householdView(world.demo!, life, world);
  assert.ok(preview.lines.some(line => line === `Grain in store after: ${view.grain - quantity}`));
  if (value.from.bid !== value.to.bid) assert.ok(preview.lines.some(line => /price falls from/i.test(line)));
});

test("a sale that leaves less than the household eats this year carries a warning", () => {
  const life = liveTo("preview-short", 12);
  const view = householdView(world.demo!, life, world);
  const quantity = Math.min(view.grain, world.demo!.market.maxOrderQuantity);
  const preview = tradePreview(engine, life, order({ quantity, reserveOverride: true }));
  const left = view.grain - quantity + view.expectedHarvest - view.expectedRent;
  if (left < view.expectedEating) assert.ok(preview.warnings.some(line => /household will go short/.test(line)));
  else assert.ok(!preview.warnings.some(line => /household will go short/.test(line)));
});

test("a purchase says what it costs and what arrives", () => {
  const life = liveTo("preview-buy", 12);
  const preview = tradePreview(engine, life, order({ side: "buy", quantity: 5 }));
  const value = orderValue(world.demo!, life.demo, "grain", "buy", 5);
  assert.equal(preview.total, value.total);
  if (!preview.blocked) assert.equal(preview.confirmLabel, `Buy 5 grain for ${value.total} dr`);
  assert.ok(preview.lines.some(line => line.startsWith("You pay")));
});

test("the preview refuses exactly what Confirm would refuse, such as trading while a decision waits", () => {
  let life: LifeState = liveTo("preview-decision", 12);
  for (let step = 0; step < 60 && life.phase !== "choice" && life.phase !== "ended"; step++) life = engine.advance(life);
  if (life.phase !== "choice") return;
  const preview = tradePreview(engine, life, order({ side: "buy", quantity: 1 }));
  assert.ok(preview.blocked, "a waiting decision blocks the order");
  assert.throws(() => engine.demo(life, order({ side: "buy", quantity: 1 })), (error: Error) => error.message === preview.blocked);
  assert.equal(preview.confirmLabel, null);
});
