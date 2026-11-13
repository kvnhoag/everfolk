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
import { storehouseRows } from "../client/demo/storehouse-model.ts";
import { buildSkillTree, currentSkillTree } from "../client/models/skill-tree.ts";
import { EMAIL_SIGN_IN_NOTE } from "../client/demo/labels.ts";
import { careerEmblem } from "../client/chain/token-page-model.ts";
import { actionName } from "../client/chain/chain-copy.ts";
import { ensureDemoDeeds } from "../chain/catalog/demo-deeds.ts";
import { createEngine } from "../src/index.ts";
import { influenceMarker } from "../client/models/influence-marker.ts";

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
const { default: ResourceYearDetails } = await import("../client/demo/Storehouse.tsx");
const { default: ResourceBar } = await import("../client/demo/ResourceBar.tsx");
const { default: LifeChoiceBoard } = await import("../client/components/LifeChoiceBoard.tsx");
const { default: DecisionDialog } = await import("../client/components/DecisionDialog.tsx");
const { default: EventNotificationStack } = await import("../client/components/EventNotificationStack.tsx");
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

test("DecisionDialog popup, EventNotificationStack, LifeChoiceBoard, and styled trade dropdowns render without mutating state", () => {
  let life = engine.start("choice-board-ui");
  for (let i = 0; i < 16 && life.phase !== "choice"; i++) life = engine.advance(life);
  const before = structuredClone(life);
  const screen = demoScreen(engine.world, life)!;
  const activities = engine.getActivities(life);
  const choices = engine.getChoices(life);
  const decisionEvent = engine.world.events.find(e => e.id === life.pendingEventId)!;

  const boardHtml = renderToStaticMarkup(createElement(LifeChoiceBoard, {
    life,
    world: engine.world,
    activities,
    focusId: "everyday",
    onAdvance: () => {},
    onOpenChronicle: () => {},
    onFocusChange: () => {},
    onActivity: () => {},
  }));
  assert.doesNotMatch(boardHtml, /TURNING POINT/);

  const popupHtml = renderToStaticMarkup(createElement(DecisionDialog, {
    open: true,
    event: decisionEvent,
    life,
    world: engine.world,
    choices,
    demoView: screen,
    onChoose: () => {},
    onSetAside: () => {},
    onEnableAuto: () => {},
  }));
  assert.match(popupHtml, /life-encounter-banner/);
  assert.match(popupHtml, /life-decision-board-grid/);
  assert.match(popupHtml, /CHOICE PREVIEW/);

  const notifHtml = renderToStaticMarkup(createElement(EventNotificationStack, {
    life,
    world: engine.world,
    decisionEvent,
    demoView: screen,
    onOpenDecision: () => {},
  }));
  assert.match(notifHtml, /event-notification-stack/);
  assert.match(notifHtml, /Open decision/);

  const deckHtml = renderToStaticMarkup(createElement(EconomyPanels, {
    screen,
    life,
    world: engine.world,
    activities,
    cashText: "10 dr",
    autoPlay: false,
    onTrade: () => null,
    onPlan: () => null,
    onAutoPlay: () => {},
    onDelegate: () => null,
  }));
  assert.match(deckHtml, /demo-dropdown-trigger/);
  assert.match(deckHtml, /demo-commodity-cell/);
  assert.match(deckHtml, /People &amp; Town/);
  assert.match(deckHtml, /Naukleros Heron/);
  assert.match(deckHtml, /Pakhom of the Fayyum/);
  assert.match(deckHtml, /Strategos Ptolemaios/);
  assert.deepEqual(life, before);
});


test("the inventory details coexist with the command deck without duplicating its resource display", () => {
  const life = engine.start("storehouse-command-deck");
  const screen = demoScreen(engine.world, life)!;
  const storehouse = storehouseRows(engine.world, life)!;
  const before = structuredClone({ life, world: engine.world, screen, storehouse });
  const html = renderToStaticMarkup(createElement(EconomyPanels, {
    screen, life, world: engine.world, activities: engine.getActivities(life),
    cashText: "12 drachmas", autoPlay: false,
    onTrade() { assert.fail("Rendering sent a trade"); },
    onPlan() { assert.fail("Rendering changed the planting plan"); },
    onAutoPlay() { assert.fail("Rendering changed autoplay"); },
    onDelegate() { assert.fail("Rendering delegated decisions"); },
  }));
  const details = renderToStaticMarkup(createElement(ResourceYearDetails, { rows: storehouse }));
  const bar = renderToStaticMarkup(createElement(ResourceBar, { screen, rows: storehouse, cashText: "12 drachmas" }));
  assert.doesNotMatch(html, /aria-label="Storehouse"|storehouse-row/);
  assert.match(bar, /Inventory &amp; Granary/);
  assert.equal((details.match(/class="storehouse-row"/g) ?? []).length, storehouse.length);
  assert.match(details, /Coming year/);
  for (const label of ["Market &amp; Trade", "Farm &amp; Granary", "Career &amp; Army", "People &amp; Town", "Works &amp; Stewards"]) {
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /price history graph/);
  assert.match(html, /demo-dropdown-trigger/);
  assert.match(html, /Naukleros Heron/);
  assert.deepEqual({ life, world: engine.world, screen, storehouse }, before);
});
