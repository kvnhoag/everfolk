import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { WorldPack } from "../src/types.ts";
import { demoEngine } from "./fixtures/demo/world.ts";
import { householdView } from "../src/demo/household.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import { RESOURCE_IDS } from "../client/demo/resources.ts";
import { mentionedResources, storehouseRows } from "../client/demo/storehouse-model.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: Storehouse } = await import("../client/demo/Storehouse.tsx");
hooks.deregister();

const engine = demoEngine();
const rankedPack = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;
function rows(life = engine.start("storehouse")) {
  const result = storehouseRows(engine.world, life);
  assert.ok(result);
  return result;
}

test("storehouse lists all eleven resources in order", () => {
  assert.deepEqual(rows().map(row => row.id), [...RESOURCE_IDS]);
});

test("storehouse amounts equal the engine", () => {
  const life = engine.start("storehouse-amounts") as LifeStateWithDemo;
  const byId = Object.fromEntries(rows(life).map(row => [row.id, row]));
  assert.equal(byId.grain.amount, life.demo.household.grain);
  assert.equal(byId.silver.amount, life.demo.goods.silver);
  assert.equal(byId.reputation.amount, life.demo.reputation);
  assert.equal(byId.drachmas.amount, life.economy?.cash ?? 0);
  assert.equal(byId.grain.capacity, householdView(engine.world.demo!, life).capacity);
  assert.equal(byId.flax.capacity, null);
});

test("grain coming flows equal householdView", () => {
  const life = engine.start("storehouse-coming") as LifeStateWithDemo;
  const view = householdView(engine.world.demo!, life);
  const grain = rows(life).find(row => row.id === "grain")!;
  const sum = grain.coming.reduce((total, flow) => total + flow.delta, 0);
  assert.equal(sum, view.expectedHarvest - view.expectedRent - view.expectedEating - view.expectedSpoilage);
  assert.ok(grain.coming.every(flow => flow.delta !== 0));
});

test("after one settled year grain lastYear includes the harvest line", () => {
  let life = engine.start("storehouse-year");
  for (let i = 0; i < 40 && life.phase !== "ended"; i++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
    if (life.journal.some(entry => entry.id === "household-harvest" && entry.age === life.age)) break;
  }
  const harvest = life.journal.find(entry => entry.id === "household-harvest" && entry.age === life.age);
  assert.ok(harvest, "a harvest settlement was recorded at the current age");
  assert.ok(rows(life).find(row => row.id === "grain")!.lastYear.includes(harvest.text));
});

test("a new life shows no last-year lines", () => {
  assert.ok(rows(engine.start("storehouse-new")).every(row => row.lastYear.length === 0));
});

test("reading the storehouse changes nothing", () => {
  const life = engine.start("storehouse-pure");
  const before = structuredClone(life);
  rows(life);
  assert.deepEqual(life, before);
});

test("storehouse is null off the demo world", () => {
  const life = engine.start("storehouse-off");
  assert.equal(storehouseRows(rankedPack, life), null);
});

test("Storehouse renders icons and the empty note", () => {
  const html = renderToStaticMarkup(createElement(Storehouse, { rows: rows() }));
  assert.match(html, /aria-label="Storehouse"/);
  assert.match(html, /<title[^>]*>Grain<\/title>/);
  assert.match(html, /Nothing recorded yet\./);
  assert.match(html, /Coming year/);
});

test("a row without a forecast shows no Coming year block", () => {
  const gold = rows().filter(row => row.id === "gold");
  assert.deepEqual(gold[0].coming, []);
  const html = renderToStaticMarkup(createElement(Storehouse, { rows: gold }));
  assert.doesNotMatch(html, /Coming year/);
  assert.doesNotMatch(html, /No change expected/);
  assert.match(html, /Last year/);
});

test("trade text is matched by whole word, tolerating plurals", () => {
  assert.deepEqual(mentionedResources("You buy a box of golden bolts."), []);
  assert.deepEqual(mentionedResources("You buy 1 ox from the merchant at 9 drachmas each."), ["drachmas", "ox"]);
  assert.deepEqual(mentionedResources("You buy 2 oxen from the merchant."), ["ox"]);
  assert.deepEqual(mentionedResources("You sell 3 bolts of Coan silk."), ["silk"]);
  assert.deepEqual(mentionedResources("You buy 2 donkeys."), ["donkey"]);
});


test("last year stops at settlement and excludes a later trade at the same age", () => {
  let life = engine.start("storehouse-cutoff");
  for (let i = 0; i < 40 && life.phase !== "ended"; i++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
    if (life.journal.some(entry => entry.id === "household-harvest" && entry.age === life.age)) break;
  }
  const trade = { type: "activity" as const, id: "market-trade", text: "You buy 3 measures of grain for 6 drachmas.", age: life.age, year: life.year };
  const afterTrade = { ...life, journal: [...life.journal, trade] };
  assert.ok(rows(afterTrade).some(row => row.lastYear.some(line => /harvest/i.test(line))));
  assert.ok(rows(afterTrade).every(row => !row.lastYear.includes(trade.text)));
});
