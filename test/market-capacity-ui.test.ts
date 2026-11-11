import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/engine.ts";
import type { LifeState, MarketOrder, WorldPack } from "../src/types.ts";
import { hasFullMarketAccess } from "../client/models/market.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: MarketPanel } = await import("../client/components/MarketPanel.tsx");
hooks.deregister();

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "market-capacity-ui", version: "1", title: "Market capacity", description: "Authored display fixture.", startYear: -30, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 100 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "A workshop household.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored prices.",
      assets: [{ id: "thread", title: "Thread", description: "Weaving input.", value: 4 }, { id: "cloth", title: "Cloth", description: "Finished goods.", value: 15 }],
      market: { minAge: 14, feePercent: 5, maxQuantity: 100, maxOrders: 8, traderJob: "trader", traderYears: 3, traderFocusActivity: "focus-trade", goods: ["thread", "cloth"], shocks: [],
        orderLimits: { household: { perOrder: 50, perYear: 100 }, professional: { perOrder: 100, perYear: 300 } } } },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 20 } },
      jobs: [{ id: "weaver", title: "Weaver", description: "Make cloth.", minAge: 14, yearlyEffects: [], production: { inputs: { thread: 2 }, outputs: { cloth: 1 }, baseBatches: 2, maxBatches: 8 } },
        { id: "supplier", title: "Supplier", description: "Arrange varied supplies.", minAge: 18, marketAccess: "full", yearlyEffects: [] },
        { id: "trader", title: "Trader", description: "Buy and sell goods.", minAge: 18, yearlyEffects: [] }],
      activities: [{ id: "focus-trade", text: "Arrange trades.", category: "career", outcomes: [{ id: "focused", text: "Accounts checked.", weight: 1, effects: [] }] }],
      partners: [], childNames: ["Child"], deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }] },
  };
}

function person(world: WorldPack, job = "weaver"): LifeState {
  const life = structuredClone(createEngine(world).start("capacity-display"));
  life.age = 20; life.year = -10; life.character!.jobId = job;
  return life;
}
function order(id: number, side: "buy" | "sell", quantity: number): MarketOrder {
  return { id, side, asset: side === "buy" ? "thread" : "cloth", quantity, unitPrice: 5, total: quantity * 5, placedAge: 20, settlesAtAge: 21 };
}
function markup(world: WorldPack, life: LifeState): string {
  return renderToStaticMarkup(createElement(MarketPanel, { world, life, onMarketOrder() {}, onCancelMarketOrder() {} }));
}
function quantityInput(html: string): string {
  return html.match(/<input[^>]*type="number"[^>]*>/)![0];
}

test("household order controls disclose the per-order and shared yearly allowance", () => {
  const world = fixture(), life = person(world), html = markup(world, life);
  assert.match(html, /Household order limits/);
  assert.match(html, /Up to 50 units per order and 100 units in total each year/);
  assert.match(html, /0 \/ 100 units committed/);
  assert.match(html, /100 units remaining/);
  assert.match(html, /Purchases and sales share this yearly allowance/);
  assert.match(quantityInput(html), /max="50"/);
  assert.match(quantityInput(html), /aria-describedby=/);
});

test("purchasing occupations receive their own capacity and a focus alone does not", () => {
  const world = fixture(), life = person(world, "supplier");
  assert.equal(hasFullMarketAccess(world, life), true);
  const html = markup(world, life);
  assert.match(html, /Purchasing role limits/);
  assert.match(html, /Up to 100 units per order and 300 units in total each year/);
  assert.match(quantityInput(html), /max="100"/);
  life.character!.jobId = "weaver"; life.character!.lastActivityAges["focus-trade"] = life.age;
  assert.match(markup(world, life), /Up to 50 units per order and 100 units in total each year/);
  life.character!.jobId = "trader";
  assert.match(markup(world, life), /Up to 100 units per order and 300 units in total each year/);
});

test("both purchases and sales reduce the maximum quantity still available", () => {
  const world = fixture(), life = person(world);
  life.economy!.market!.orders = [order(1, "buy", 40), order(2, "sell", 40)];
  const html = markup(world, life);
  assert.match(html, /80 \/ 100 units committed/);
  assert.match(html, /20 units remaining/);
  assert.match(quantityInput(html), /max="20"/);
  assert.doesNotMatch(quantityInput(html), /disabled/);
});

test("exhausted or reduced role capacity blocks new orders while leaving cancellation available", () => {
  const world = fixture(), life = person(world);
  for (const quantity of [100, 150]) {
    life.economy!.market!.orders = [order(1, "buy", quantity)];
    const html = markup(world, life);
    assert.match(html, /0 units remaining/);
    assert.match(html, /No capacity remains for new orders/);
    assert.match(quantityInput(html), /disabled=""/);
    const cancel = html.match(/<button[^>]*aria-label="Cancel buy order for [^"]+"[^>]*>/)![0];
    assert.doesNotMatch(cancel, /disabled/);
    const submit = html.match(/<button type="submit"[^>]*>/)![0];
    assert.match(submit, /disabled=""/);
  }
});

test("legacy worlds keep their original quantity control without an invented annual allowance", () => {
  const world = fixture(); delete world.economy!.market!.orderLimits;
  world.economy!.market!.maxQuantity = 10000;
  const html = markup(world, person(world));
  assert.match(html, /Up to 10,000 units per order/);
  assert.match(quantityInput(html), /max="10000"/);
  assert.doesNotMatch(html, /units committed|units remaining|yearly allowance/);
});
