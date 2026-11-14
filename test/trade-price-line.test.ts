import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import type { LifeStateWithDemo, TradeCommand } from "../src/demo/contracts.ts";
import { orderValue } from "../src/demo/market-depth.ts";
import { demoEngine, liveUntil } from "./fixtures/demo/world.ts";
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

const order = (over: Partial<TradeCommand> = {}): TradeCommand => ({ type: "trade", item: "grain", side: "sell", quantity: 400, counterparty: "merchant", reserveOverride: true, ...over });
const each = (total: number, quantity: number): string => Number.isInteger(total / quantity) ? String(total / quantity) : (total / quantity).toFixed(2);
const cashOf = (life: LifeState): number => life.economy!.cash;
const priceLines = (lines: string[]): string[] => lines.filter(line => /^You (get|pay)\b/.test(line));

test("a sale that slides the price says so in one plain line, before confirming", () => {
  const life = liveTo("price-line-sell", 12);
  const quantity = 400;
  const value = orderValue(world.demo!, life.demo, "grain", "sell", quantity);
  assert.notEqual(value.from.bid, value.to.bid, "a sale this size moves the price");
  const preview = tradePreview(engine, life, order({ quantity }));
  const lines = priceLines(preview.lines);
  assert.equal(lines.length, 1, "exactly one line says what you get");
  assert.equal(lines[0], `You get about ${value.total} dr (${each(value.total, quantity)} dr each on average); each extra measure sells for less.`);
});

test("the total in the line is exactly what the sale pays", () => {
  const life = liveTo("price-line-paid", 12);
  for (const quantity of [10, 60, 400]) {
    const preview = tradePreview(engine, life, order({ quantity }));
    const shown = Number(/^You get (?:about )?(\d+) dr/.exec(priceLines(preview.lines)[0])?.[1]);
    assert.equal(shown, preview.total, `${quantity}: the line shows the preview's total`);
    assert.equal(preview.confirmLabel, `Sell ${quantity} grain for ${shown} dr`, `${quantity}: the button shows the same total`);
    const after = engine.demo(life, order({ quantity }));
    assert.equal(cashOf(after) - cashOf(life), shown, `${quantity}: the cash really received is what the line said`);
  }
});

test("a purchase that slides the price says what it costs and that each extra measure costs more", () => {
  const life = liveTo("price-line-buy", 12);
  const quantity = 300;
  const value = orderValue(world.demo!, life.demo, "grain", "buy", quantity);
  const preview = tradePreview(engine, life, order({ side: "buy", quantity, reserveOverride: undefined }));
  const lines = priceLines(preview.lines);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], `You pay about ${value.total} dr (${each(value.total, quantity)} dr each on average); each extra measure costs more.`);
  if (!preview.blocked) assert.equal(cashOf(life) - cashOf(engine.demo(life, order({ side: "buy", quantity, reserveOverride: undefined }))), value.total);
});

test("a flat price is stated plainly, without the sliding warning", () => {
  const fixed = demoEngine();
  const life = liveUntil(fixed, "price-line-flat", state => state.age >= 14 && state.phase === "ready") as LifeStateWithDemo;
  const preview = tradePreview(fixed, life, { type: "trade", item: "grain", side: "sell", quantity: 3, counterparty: "merchant" });
  const lines = priceLines(preview.lines);
  assert.equal(lines.length, 1);
  assert.doesNotMatch(lines[0], /each extra/);
  assert.match(lines[0], /^You get \d+ dr \(\d+ dr each\)\.$/);
  assert.equal(lines[0], `You get ${preview.total} dr (${each(preview.total, 3)} dr each).`);
  assert.equal(Number(/^You get (\d+) dr/.exec(lines[0])?.[1]), preview.total);
});

test("a unit that is not grain is named in the line", () => {
  const life = liveTo("price-line-flax", 12);
  const held = life.demo.household.flax;
  const quantity = Math.max(1, held);
  const preview = tradePreview(engine, life, order({ item: "flax", quantity }));
  const line = priceLines(preview.lines)[0];
  assert.ok(line, "a line says what you get");
  if (/each extra/.test(line)) assert.match(line, /each extra bundle sells for less\.$/);
});
