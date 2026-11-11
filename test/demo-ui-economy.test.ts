import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { demoEngine } from "./fixtures/demo/world.ts";
import { activityGate, beginOrder, demoScreen, orderPreview, sendDemoCommand } from "../client/demo/screen.ts";
import { availability } from "../src/demo/availability.ts";
import { buildSkillTree, currentSkillTree } from "../client/skill-tree.ts";
import { EMAIL_SIGN_IN_NOTE } from "../client/demo/labels.ts";
import { careerEmblem } from "../client/chain/token-page-model.ts";
import { actionName } from "../client/chain/chain-copy.ts";
import { ensureDemoDeeds } from "../chain/catalog/demo-deeds.ts";
import { createEngine } from "../src/index.ts";
import { influenceMarker } from "../client/influence-marker.ts";

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

const engine = demoEngine();

test("opening the economy panels shows the engine view and changes nothing", () => {
  const life = engine.start("ui-open");
  const before = structuredClone(life);
  const screen = demoScreen(engine.world, life);
  assert.ok(screen);
  assert.equal(screen.household.grain, life.demo?.household.grain);
  assert.equal(screen.market.quotes[0]?.buy, life.demo?.town.prices.grain.buy);
  const calls: string[] = [];
  const html = renderToStaticMarkup(createElement(EconomyPanels, {
    screen, cashText: "12 drachmas", autoPlay: false,
    onTrade() { calls.push("trade"); return "no"; },
    onPlan() { calls.push("plan"); return null; },
    onAutoPlay() { calls.push("auto"); },
    onDelegate() { calls.push("delegate"); return null; },
  }));
  assert.equal(calls.length, 0);
  assert.match(html, /Grain market/);
  assert.match(html, /Household grain/);
  assert.match(html, new RegExp("Store"));
  assert.match(html, new RegExp(String(screen.household.grain)));
  assert.doesNotMatch(html, /A past life kept a granary for you/);
  assert.match(html, /This is not the NFT Market/);
  assert.deepEqual(life, before);
});

test("a granary arrival is visible in household grain with a link to its source NFT", () => {
  const deedEngine = createEngine(ensureDemoDeeds(engine.world));
  const life = deedEngine.influence(deedEngine.start("visible-granary"), {
    type: "influence", mode: "apply", entry: "farming.stock-granary", power: 1,
    source: { contractId: "preview.everfolk.testnet", tokenId: "17" },
  });
  const screen = demoScreen(deedEngine.world, life)!;
  const html = renderToStaticMarkup(createElement(EconomyPanels, {
    screen, cashText: "0 dr", autoPlay: false, onTrade: () => null, onPlan: () => null,
    onAutoPlay: () => {}, onDelegate: () => null,
  }));
  assert.match(html, /A past life kept a granary for you/);
  assert.match(html, /href="#token\/17"/);
  assert.match(html, /Arrived at age 0/);
});

test("a rejected order is shown and not sent twice", () => {
  const life = engine.start("ui-trade");
  const before = structuredClone(life);
  const order = { type: "trade" as const, item: "grain" as const, side: "buy" as const, quantity: 1, counterparty: "merchant" as const };
  const reason = orderPreview(engine.world, life, order);
  assert.equal(reason, "You are too young to trade at the market (from age 12).");
  const slot = { current: false };
  const wallet = () => { throw new Error("wallet"); };
  const first = sendDemoCommand(engine, life, order, slot);
  wallet;
  assert.equal(first.sent, false);
  if (first.sent) throw new Error("sent");
  assert.equal(first.reason, reason);
  assert.equal(beginOrder(slot), true);
  assert.equal(beginOrder(slot), false);
  assert.deepEqual(life, before);
});

test("deed names, the farming emblem and the source line do not need a second catalog", () => {
  assert.equal(actionName("farming.stock-granary"), "Stock the granary");
  assert.equal(careerEmblem("farming"), "farming");
  const marker = influenceMarker({ type: "influence", id: "farming.share-seed", source: { contractId: "demo.near", tokenId: "12" } }, {});
  assert.ok(marker);
  assert.match(marker.text, /a farmer/);
  assert.match(marker.text, /Share seed/);
  assert.equal(marker.tokenId, "12");
});

test("email sign-in is a visible option and does not name a wallet call", () => {
  assert.match(EMAIL_SIGN_IN_NOTE, /not connected/i);
  const source = readFileSync(new URL("../client/demo/EmailSignIn.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /backend\.connect|contract\./);
  assert.match(source, /Sign in with email/);
});


test("unavailable work cannot be funded, and the skill stays visible", () => {
  const life = engine.start("ui-unavailable");
  const world = engine.world;
  assert.equal(availability(world.demo, "job", "general").status, "unavailable");
  const general = engine.getActivities(life).find(item => item.id === "seek-general-command");
  assert.equal(general?.reason, "Not available in this demo.");
  const gate = activityGate(world, general, true, true);
  assert.deepEqual(gate, { action: "blocked", reason: "Not available in this demo." });
  const activities = engine.getActivities(life);
  const model = buildSkillTree(world, life, activities);
  const philosophy = model.nodes.find(node => node.id === "philosophy");
  assert.equal(philosophy?.availability, "unavailable");
  assert.equal(currentSkillTree(model).nodes.some(node => node.id === "philosophy"), true);
});
