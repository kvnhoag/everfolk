import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { getMarketCatalogue, getRelevantResources, hasFullMarketAccess } from "../client/models/market.ts";
import { getBirthRollResources, getVisibleBirthRollResources } from "../client/models/birth-stat-roll.ts";

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
    schemaVersion: 1, id: "resource-visibility", version: "1", title: "Resources", description: "Resource display fixture.", startYear: -30, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 20 } }, flags: {},
    origins: [{ id: "weaving-home", title: "Weaving home", text: "A family workshop.", weight: 1, effects: [] },
      { id: "soldier-home", title: "Soldier home", text: "A service household.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "shortage", title: "A shortage", text: "Deliveries are late.", trigger: { type: "age", at: 20 }, mode: "automatic", effects: [], choices: [] }],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored game prices.",
      assets: [
        { id: "thread", title: "Thread", description: "For cloth.", value: 4, category: "Textiles", context: { origins: ["weaving-home"] } },
        { id: "cloth", title: "Cloth", description: "Finished weaving.", value: 15, category: "Textiles" },
        { id: "wax", title: "Wax tablets", description: "Writing supplies.", value: 5, category: "Writing", context: { jobs: ["clerk"], activities: ["record-work"] } },
        { id: "bronze", title: "Bronze fittings", description: "Repair supplies.", value: 8, category: "Equipment", context: { origins: ["soldier-home"], jobs: ["soldier"] } },
        { id: "herbs", title: "Herbs", description: "Unused by this person.", value: 3, category: "Household" },
        { id: "gift", title: "A family gift", description: "A possession from earlier work.", value: 20, category: "Household" },
        { id: "grain", title: "Grain", description: "Common trade goods.", value: 6, category: "Food", context: { jobs: ["trader"] } },
        { id: "timber", title: "Timber", description: "Affected by reports.", value: 10, category: "Equipment" },
      ],
      market: { minAge: 14, feePercent: 5, maxQuantity: 100, maxOrders: 10, traderJob: "trader", traderYears: 3, traderFocusActivity: "focus-trade",
        goods: ["thread", "cloth", "wax", "bronze", "herbs", "gift", "grain", "timber"],
        shocks: [{ eventId: "shortage", title: "Timber deliveries delayed", durationYears: 2, priceMultipliers: { timber: 2 } }] } },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 10 }, literacy: { label: "Literacy", min: 0, max: 100, initial: 10 }, warfare: { label: "Warfare", min: 0, max: 100, initial: 0 } },
      jobs: [
        { id: "weaver", title: "Weaver", description: "Make cloth.", minAge: 14, yearlyEffects: [], production: { inputs: { thread: 2 }, outputs: { cloth: 1 }, baseBatches: 2, maxBatches: 5 } },
        { id: "clerk", title: "Clerk", description: "Keep accounts.", minAge: 18, yearlyEffects: [{ type: "cash", delta: 20 }] },
        { id: "soldier", title: "Soldier", description: "Service work.", minAge: 18, yearlyEffects: [{ type: "cash", delta: 20 }] },
        { id: "trader", title: "Trader", description: "Trade goods.", minAge: 18, yearlyEffects: [] },
      ], partners: [], childNames: ["Child"], deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [
        { id: "focus-trade", text: "Arrange trades.", category: "career", outcomes: [{ id: "focused", text: "Trade accounts checked.", weight: 1, effects: [] }] },
        { id: "record-work", text: "Write an account.", category: "career", minAge: 18,
          when: { type: "all", conditions: [{ type: "job", job: "clerk" }, { type: "skill", skill: "literacy", op: "gte", value: 10 }, { type: "cash", op: "gte", value: 10 }, { type: "asset", asset: "wax", op: "gte", value: 1 }] },
          outcomes: [{ id: "recorded", text: "You complete the account.", weight: 1, effects: [{ type: "asset", asset: "wax", delta: -1 }, { type: "cash", delta: 20 }] }] },
        { id: "polish-bronze", text: "Repair equipment.", category: "career", minAge: 18,
          when: { type: "all", conditions: [{ type: "job", job: "soldier" }, { type: "skill", skill: "warfare", op: "gte", value: 20 }, { type: "asset", asset: "bronze", op: "gte", value: 1 }] },
          outcomes: [{ id: "repaired", text: "Repairs finished.", weight: 1, effects: [{ type: "asset", asset: "bronze", delta: -1 }] }] },
        { id: "either-work", text: "Help a workshop.", category: "career", minAge: 18,
          when: { type: "any", conditions: [
            { type: "all", conditions: [{ type: "job", job: "clerk" }, { type: "asset", asset: "wax", op: "gte", value: 1 }] },
            { type: "all", conditions: [{ type: "job", job: "soldier" }, { type: "asset", asset: "bronze", op: "gte", value: 1 }] },
          ] }, outcomes: [{ id: "helped", text: "You help with familiar work.", weight: 1, effects: [] }] },
        { id: "train-with-herbs", text: "Practise with herbs.", category: "training", outcomes: [{ id: "trained", text: "Lesson complete.", weight: 1, effects: [{ type: "asset", asset: "herbs", delta: -1 }] }] },
        { id: "become-soldier", text: "Choose service work.", category: "career", outcomes: [{ id: "hired", text: "You accept.", weight: 1, effects: [{ type: "job", job: "soldier" }, { type: "asset", asset: "bronze", delta: -1 }] }] },
      ] },
  };
}

function person(world = fixture(), job: string | null = "weaver", age = 20): LifeState {
  const life = structuredClone(createEngine(world).start("resources"));
  life.age = age; life.year = -30 + age; life.originId = "weaving-home"; life.character!.jobId = job;
  return life;
}
const ids = (world: WorldPack, life: LifeState) => getRelevantResources(world, life).map(item => item.asset.id);

test("missing recipe inputs and outputs appear while unrelated empty goods stay hidden", () => {
  const world = fixture(), life = person(world), before = structuredClone(life);
  assert.deepEqual(ids(world, life), ["thread", "cloth"]);
  assert.deepEqual(life, before);
  const catalogue = getMarketCatalogue(world, life);
  assert.equal(catalogue.hiddenCount, 6);
  assert.deepEqual(catalogue.goods.map(asset => asset.id), ["thread", "cloth"]);
});

test("current production supplies lead the default catalogue before possessions from a previous livelihood", () => {
  const world = fixture(), life = person(world);
  world.economy!.market!.goods = ["gift", "herbs", "cloth", "thread"];
  life.economy!.assets.gift = 1;
  const catalogue = getMarketCatalogue(world, life);
  assert.deepEqual(catalogue.goods.map(asset => asset.id), ["thread", "cloth", "gift"]);
  assert.equal(catalogue.all.length, 4);
});

test("occupation changes hide an old household's empty goods and retain owned goods and pending orders", () => {
  const world = fixture(), life = person(world, "clerk");
  life.economy!.assets.gift = 1;
  assert.deepEqual(ids(world, life), ["wax", "gift"]);
  life.economy!.market!.orders.push({ id: 1, side: "sell", asset: "cloth", quantity: 1, unitPrice: 14, total: 14, placedAge: 20, settlesAtAge: 21 });
  assert.deepEqual(ids(world, life), ["cloth", "wax", "gift"]);
  assert.ok(getRelevantResources(world, life).find(item => item.asset.id === "cloth")!.reasons.includes("Pending order"));
});

test("childhood and an unemployed adult retain household resources", () => {
  const world = fixture();
  assert.ok(ids(world, person(world, "clerk", 12)).includes("thread"));
  assert.ok(ids(world, person(world, null, 20)).includes("thread"));
  assert.ok(!ids(world, person(world, "clerk", 20)).includes("thread"));
});

test("material tasks ignore stock and cash gates but respect age, skills and alternative job branches", () => {
  const world = fixture();
  // Remove authored context to exercise discovery from actual activity rules.
  world.economy!.assets.forEach(asset => { delete asset.context; });
  const life = person(world, "clerk"); life.economy!.cash = 0;
  assert.deepEqual(ids(world, life), ["wax"]);
  life.character!.skills.literacy = 0;
  world.character!.activities = world.character!.activities.filter(activity => activity.id !== "either-work");
  assert.deepEqual(ids(world, life), []);
  life.character!.skills.literacy = 10; life.age = 12;
  assert.deepEqual(ids(world, life), []);
  assert.ok(!ids(world, person(world, "soldier")).includes("bronze"), "Insufficient warfare does not advertise unavailable repair work.");
});

test("trade goods and market news become relevant to the trader occupation rather than a focus alone", () => {
  const world = fixture(), life = person(world, "trader");
  life.eventCounts.shortage = 1; life.lastEventAge.shortage = 20;
  assert.deepEqual(ids(world, life), ["grain", "timber"]);
  life.age = 22;
  assert.deepEqual(ids(world, life), ["grain"]);
  life.character!.jobId = "clerk"; life.character!.lastActivityAges["focus-trade"] = 22;
  assert.deepEqual(ids(world, life), ["wax"]);
  life.lastEventAge.shortage = 22;
  assert.deepEqual(ids(world, life), ["wax"], "Trading focus does not expose speculative goods or unrelated news.");
});

test("non-traders cannot reveal unrelated goods through catalogue options or trading focus", () => {
  const world = fixture(), life = person(world);
  const catalogue = getMarketCatalogue(world, life, { showAll: true });
  assert.equal(catalogue.isTrader, false);
  assert.deepEqual(catalogue.goods.map(asset => asset.id), ["thread", "cloth"]);
  assert.ok(!getMarketCatalogue(world, life, { showAll: true, query: "herbs" }).goods.some(asset => asset.id === "herbs"));
  life.character!.lastActivityAges["focus-trade"] = life.age;
  assert.deepEqual(getMarketCatalogue(world, life, { showAll: true }).goods.map(asset => asset.id), ["thread", "cloth"]);
});

test("traders see the full catalogue by default with category filtering and search", () => {
  const world = fixture(), life = person(world, "trader");
  const catalogue = getMarketCatalogue(world, life);
  assert.equal(catalogue.isTrader, true);
  assert.equal(catalogue.canBrowseAll, true);
  assert.equal(hasFullMarketAccess(world, life), true, "Configured trader roles work in retained packs without capability metadata.");
  assert.equal(catalogue.goods.length, 8);
  assert.deepEqual(getMarketCatalogue(world, life, { showAll: true, query: "  TABLETS " }).goods.map(asset => asset.id), ["wax"]);
  assert.deepEqual(getMarketCatalogue(world, life, { showAll: true, category: "Textiles" }).goods.map(asset => asset.id), ["thread", "cloth"]);
  assert.equal(getMarketCatalogue(world, life, { showAll: true, category: "Textiles", query: "bronze" }).goods.length, 0);
});

test("an authored purchasing role receives full market browsing without being the trader", () => {
  const world = fixture();
  world.character!.jobs.push({ id: "estate-buyer", title: "Estate buyer", description: "Purchase supplies for an estate.", minAge: 18, yearlyEffects: [], marketAccess: "full" });
  const life = person(world, "estate-buyer"), before = structuredClone(life);
  const catalogue = getMarketCatalogue(world, life);
  assert.equal(hasFullMarketAccess(world, life), true);
  assert.equal(catalogue.canBrowseAll, true);
  assert.equal(catalogue.isTrader, false);
  assert.equal(catalogue.goods.length, 8);
  assert.deepEqual(getMarketCatalogue(world, life, { query: "herbs" }).goods.map(asset => asset.id), ["herbs"]);
  assert.deepEqual(getMarketCatalogue(world, life, { category: "Textiles" }).goods.map(asset => asset.id), ["thread", "cloth"]);
  assert.deepEqual(life, before, "Browsing never accepts an appointment or mutates the life.");
});

test("a purchasing offer or trading focus does not grant access until the role is held", () => {
  const world = fixture();
  world.character!.jobs.push({ id: "estate-buyer", title: "Estate buyer", description: "Purchase supplies.", minAge: 18, yearlyEffects: [], marketAccess: "full" });
  const life = person(world, "weaver");
  life.character!.lastActivityAges["focus-trade"] = life.age;
  life.flags["buyer-offer"] = true;
  assert.equal(hasFullMarketAccess(world, life), false);
  assert.deepEqual(getMarketCatalogue(world, life, { showAll: true }).goods.map(asset => asset.id), ["thread", "cloth"]);
  life.character!.jobId = "estate-buyer";
  assert.equal(hasFullMarketAccess(world, life), true);
  delete world.economy!.market;
  assert.equal(hasFullMarketAccess(world, life), false, "A role cannot expose a market absent from its world.");
});

test("leaving a purchasing role removes full browsing and ignores its stale search filters", () => {
  const world = fixture();
  world.character!.jobs.push({ id: "estate-buyer", title: "Estate buyer", description: "Purchase supplies.", minAge: 18, yearlyEffects: [], marketAccess: "full" });
  const life = person(world, "estate-buyer");
  life.economy!.assets.herbs = 1;
  life.economy!.market!.orders.push({ id: 1, side: "buy", asset: "timber", quantity: 1, unitPrice: 11, total: 11, placedAge: 20, settlesAtAge: 21 });
  assert.equal(getMarketCatalogue(world, life).goods.length, 8);
  life.character!.jobId = "clerk";
  const catalogue = getMarketCatalogue(world, life, { showAll: true, category: "Equipment", query: "timber" });
  assert.equal(catalogue.canBrowseAll, false);
  assert.deepEqual(new Set(catalogue.goods.map(asset => asset.id)), new Set(["wax", "herbs", "timber"]));
});

test("leaving the trader occupation hides unrelated goods while retaining possessions and pending orders", () => {
  const world = fixture(), life = person(world, "trader");
  life.economy!.assets.herbs = 1;
  life.economy!.market!.orders.push({ id: 1, side: "buy", asset: "timber", quantity: 1, unitPrice: 11, total: 11, placedAge: 20, settlesAtAge: 21 });
  assert.equal(getMarketCatalogue(world, life).goods.length, 8);
  life.character!.jobId = "weaver";
  const catalogue = getMarketCatalogue(world, life, { showAll: true });
  assert.equal(catalogue.isTrader, false);
  assert.deepEqual(new Set(catalogue.goods.map(asset => asset.id)), new Set(["thread", "cloth", "herbs", "timber"]));
});

test("older worlds and metadata without an annual market remain safe to project", () => {
  const world = fixture(), life = person(world, null);
  delete world.economy!.market; delete life.economy!.market;
  assert.deepEqual(ids(world, life), ["thread"]);
  assert.equal(getMarketCatalogue(world, life).goods.length, 0);
  assert.deepEqual(getRelevantResources({ ...world, economy: undefined }, life), []);
});

test("the birth reveal hides unused zero rows while keeping possessions, family resources and possible birth rolls", () => {
  const world = fixture(), life = person(world, null, 0);
  life.economy!.assets.gift = 1;
  const ranged = world.economy!.assets.find(asset => asset.id === "cloth")!;
  ranged.initialRange = { min: 0, max: 1 };
  assert.equal(getBirthRollResources(world, life).length, 8);
  assert.deepEqual(getVisibleBirthRollResources(world, life).map(resource => resource.id), ["resource:thread", "resource:cloth", "resource:gift"]);
});

test("non-trader market renders only useful goods without full-catalogue controls", () => {
  const world = fixture(), life = person(world);
  const markup = renderToStaticMarkup(createElement(MarketPanel, { world, life, onMarketOrder() {}, onCancelMarketOrder() {} }));
  assert.match(markup, /Useful to you now/);
  assert.doesNotMatch(markup, /Browse all goods|Search goods|All market goods/);
  assert.match(markup, /Production material/);
  assert.match(markup, /Produced by your work/);
  assert.doesNotMatch(markup, /Bronze fittings|Wax tablets|Herbs/);
  const empty = person(world, "soldier");
  world.economy!.assets.forEach(asset => { delete asset.context; });
  world.character!.activities = world.character!.activities.filter(activity => activity.id !== "either-work");
  const emptyMarkup = renderToStaticMarkup(createElement(MarketPanel, { world, life: empty }));
  assert.match(emptyMarkup, /No market supplies are needed/);
  assert.doesNotMatch(emptyMarkup, /Browse all goods|Search goods/);
  assert.doesNotMatch(emptyMarkup, /Place buy order/);
});

test("trader market renders unrelated trade goods and catalogue filters immediately", () => {
  const world = fixture(), life = person(world, "trader");
  const markup = renderToStaticMarkup(createElement(MarketPanel, { world, life, onMarketOrder() {}, onCancelMarketOrder() {} }));
  assert.match(markup, /All market goods/);
  assert.match(markup, /Search goods/);
  assert.match(markup, /All categories/);
  assert.match(markup, /Bronze fittings/);
  assert.match(markup, /Wax tablets/);
  assert.match(markup, /Herbs/);
});

test("purchasing-role market explains the current title and renders full catalogue controls", () => {
  const world = fixture();
  world.character!.jobs.push({ id: "estate-buyer", title: "Estate buyer", description: "Purchase supplies.", minAge: 18, yearlyEffects: [], marketAccess: "full" });
  const life = person(world, "estate-buyer");
  const markup = renderToStaticMarkup(createElement(MarketPanel, { world, life, onMarketOrder() {}, onCancelMarketOrder() {} }));
  assert.match(markup, /Your work as estate buyer gives you access to the full market/);
  assert.match(markup, /All market goods/);
  assert.match(markup, /Search goods/);
  assert.match(markup, /Bronze fittings|Herbs/);
  assert.doesNotMatch(markup, /Your trader occupation/);
});
