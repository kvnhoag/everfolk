import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { demoEngine } from "./fixtures/demo/world.ts";
import { demoScreen } from "../client/demo/screen.ts";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import type { LifeStateWithDemo, TradeCommand } from "../src/demo/contracts.ts";
import { householdView } from "../src/demo/household.ts";
import { ordinarySeedGrain } from "../src/capabilities/farming.ts";
import { confirmStage, tradePreview } from "../client/models/trade-preview.ts";
import { grainSalePlan, leavesGrain, maxSaleQuantity, planFromFacts, startingQuantity } from "../client/models/grain-sale-plan.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: EconomyPanels } = await import("../client/demo/EconomyPanels.tsx");
hooks.deregister();

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);

function liveTo(seed: string, age: number): LifeStateWithDemo {
  let life: LifeState = engine.start(seed);
  for (let step = 0; step < 400 && !(life.age >= age && life.phase === "ready") && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life as LifeStateWithDemo;
}

/** The same life holding exactly `grain` measures in store: the tester's 187. */
function holding(life: LifeStateWithDemo, grain: number): LifeStateWithDemo {
  const copy = structuredClone(life);
  copy.demo.household.grain = grain;
  return copy;
}

/** An adult household with 150 measures to spare above next year's eating and seed. */
function withSpare(seed: string): { life: LifeStateWithDemo; plan: ReturnType<typeof grainSalePlan> & {}; store: number } {
  const base = liveTo(seed, 12), plan0 = grainSalePlan(world, base)!;
  const store = plan0.eating + plan0.seed + 150, life = holding(base, store);
  return { life, plan: grainSalePlan(world, life)!, store };
}

const sell = (quantity: number, over: Partial<TradeCommand> = {}): TradeCommand => ({ type: "trade", item: "grain", side: "sell", quantity, counterparty: "merchant", ...over });

test("the grain a household can spare is the store minus next year's eating and seed", () => {
  const life = holding(liveTo("sale-plan", 12), 187);
  const view = householdView(world.demo!, life, world);
  const plan = grainSalePlan(world, life)!;
  assert.equal(plan.store, 187);
  assert.equal(plan.eating, view.expectedEating);
  assert.equal(plan.seed, ordinarySeedGrain(life, world.demo));
  assert.ok(plan.seed > 0, "this world keeps seed back");
  assert.equal(plan.surplus, Math.max(0, 187 - plan.eating - plan.seed));
  assert.equal(planFromFacts(100, 70, 20).surplus, 10);
  assert.equal(planFromFacts(50, 70, 20).surplus, 0, "never negative");
});

test("for grain the default and the Max are the surplus; other goods keep 1 and the limit", () => {
  const plan = planFromFacts(187, 60, 20);
  assert.equal(plan.surplus, 107);
  assert.equal(startingQuantity({ item: "grain", side: "sell", limit: 187, plan }), 107);
  assert.equal(maxSaleQuantity({ item: "grain", side: "sell", limit: 187, plan }), 107);
  assert.equal(maxSaleQuantity({ item: "grain", side: "sell", limit: 50, plan }), 50, "never above what the merchant takes");
  assert.equal(startingQuantity({ item: "grain", side: "buy", limit: 300, plan }), 1);
  assert.equal(maxSaleQuantity({ item: "grain", side: "buy", limit: 300, plan }), 300);
  assert.equal(startingQuantity({ item: "flax", side: "sell", limit: 40, plan }), 1);
  assert.equal(maxSaleQuantity({ item: "flax", side: "sell", limit: 40, plan }), 40);
  assert.equal(startingQuantity({ item: "grain", side: "sell", limit: 187, plan: null }), 1);
  assert.equal(maxSaleQuantity({ item: "grain", side: "sell", limit: 187, plan: null }), 187);
  // Nothing to spare: nothing is pre-filled, so the first click cannot sell the household's food.
  assert.equal(startingQuantity({ item: "grain", side: "sell", limit: 40, plan: planFromFacts(40, 60, 20) }), 0);
});

test("selling beyond the surplus needs a second confirmation that says what is left and what the household eats", () => {
  const { life, plan, store } = withSpare("sale-beyond");
  assert.equal(plan.surplus, 150);
  const within = tradePreview(engine, life, sell(plan.surplus, { reserveOverride: true }));
  assert.equal(within.blocked, null);
  assert.equal(within.reserveConfirm, null);
  assert.equal(confirmStage(within, false), "go");

  const beyond = tradePreview(engine, life, sell(plan.surplus + 1, { reserveOverride: true }));
  assert.equal(beyond.reserveConfirm, `This leaves ${store - plan.surplus - 1} grain; your household eats about ${plan.eating} a year.`);
  assert.equal(beyond.blocked, null);
  assert.equal(confirmStage(beyond, false), "ask");
  assert.equal(confirmStage(beyond, true), "go");
});

test("selling everything leaves 0 and is asked about before it goes through", () => {
  const { life, plan, store } = withSpare("sale-all");
  const preview = tradePreview(engine, life, sell(store, { reserveOverride: true }));
  assert.equal(preview.reserveConfirm, `This leaves 0 grain; your household eats about ${plan.eating} a year.`);
  assert.equal(leavesGrain(plan, store), preview.reserveConfirm);
  assert.equal(leavesGrain(plan, plan.surplus), null);
  assert.equal(confirmStage(preview, false), "ask");
});

test("buying and blocked orders never ask the grain question", () => {
  const { life, store } = withSpare("sale-other");
  assert.equal(tradePreview(engine, life, { type: "trade", item: "grain", side: "buy", quantity: 5, counterparty: "merchant" }).reserveConfirm, null);
  const blocked = tradePreview(engine, life, sell(store + 1, { reserveOverride: true }));
  assert.ok(blocked.blocked, "an impossible order is blocked, not asked about");
  assert.equal(blocked.reserveConfirm, null);
  assert.equal(confirmStage(blocked, false), "none", "a blocked order has nothing to confirm");
});

test("an army contract for more than the surplus is asked about too", () => {
  const { life: spare, plan, store } = withSpare("sale-army");
  const life = structuredClone(spare);
  life.character!.jobId = "grain-dealer";
  const preview = tradePreview(engine, life, sell(plan.surplus + 5, { counterparty: "army", reserveOverride: true }));
  assert.equal(preview.blocked, null);
  assert.equal(preview.reserveConfirm, `This leaves ${store - plan.surplus - 5} grain; your household eats about ${plan.eating} a year.`);
});

test("the trade form says how much grain the household can spare", () => {
  const demo = demoEngine();
  const screen = demoScreen(demo.world, demo.start("spare-note"))!;
  const html = renderToStaticMarkup(createElement(EconomyPanels, {
    screen, cashText: "12 drachmas", autoPlay: false, onTrade: () => null, onPlan: () => null, onAutoPlay: () => {}, onDelegate: () => null,
  }));
  const spare = Math.max(0, screen.household.grain - screen.household.expectedEating);
  assert.match(html, new RegExp(`Grain to spare: <strong>${spare}</strong>`));
  assert.match(html, new RegExp(`Max \\(${spare}\\)`));
});
