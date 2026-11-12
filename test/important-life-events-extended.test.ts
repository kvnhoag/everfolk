import assert from "node:assert/strict";
import test from "node:test";
import { builtinEngine } from "../client/lib/world-session.ts";
import { buildImportantLifeEvents } from "../client/models/important-life-events.ts";
import { buildLifeEvents } from "../client/models/life-events.ts";
import { demoWorld } from "./fixtures/demo/world.ts";
import type { Effect, JournalEntry, LifeEvent, LifeState, WorldPack } from "../src/types.ts";

function fixture() {
  const world = structuredClone(builtinEngine.world) as WorldPack;
  world.yearlyEffects = []; world.yearlyRules = [];
  delete world.health; delete world.knowledge;
  for (const definition of Object.values(world.stats)) { delete definition.initialRange; delete definition.gainCurve; }
  for (const origin of world.origins) { origin.effects = []; delete origin.statRanges; }
  const life: LifeState = { ...builtinEngine.start("important-facts"), originId: world.origins[0].id, age: 60, journal: [] };
  return { world, life };
}
const entry = (type: JournalEntry["type"], id: string, age = 20): JournalEntry => ({ type, id, age, year: -350 + age, text: `Recorded ${id}.` });
const ids = (life: LifeState, world: WorldPack) => buildImportantLifeEvents(life, world).flatMap(year => year.events.map(event => event.key.split("-").slice(3).join("-")));
function add(world: WorldPack, id: string, effects: Effect[], extra: Partial<LifeEvent> = {}) {
  world.events.push({ id, title: id, text: id, mode: "automatic", trigger: { type: "random", weight: 1 }, choices: [], effects, ...extra });
}

test("routine flavor, minor practice and declined rare opportunities stay in the record without notifying", () => {
  const { world, life } = fixture();
  life.journal = [entry("event", "small-doorway"), entry("event", "first-steps"), entry("event", "background-artisan-household-practice"),
    entry("outcome", "rare-patron-decline-result"), entry("outcome", "masterwork-pottery-practised"), entry("outcome", "sculpture-prestige-declined")];
  const before = JSON.stringify({ world, life });
  assert.deepEqual(ids(life, world), []);
  assert.equal(buildLifeEvents(life, world).flatMap(year => year.events).length, 6);
  assert.equal(JSON.stringify({ world, life }), before);
});

test("shipped career, family, health, mastery and accomplishment outcomes notify once per completed fact", () => {
  const { world, life } = fixture();
  life.journal = [entry("outcome", "work-apprentice-result"), entry("outcome", "work-apprentice-result"),
    entry("outcome", "grow-household-birth"), entry("activity", "child-1"),
    entry("outcome", "dirty-water-illness"), entry("event", "health-onset-dysentery"),
    entry("outcome", "masterwork-pottery-mastered"), entry("outcome", "masterwork-pottery-mastered"),
    entry("outcome", "sculpture-prestige-accepted"), entry("activity", "earned-sculpture-prestige")];
  assert.deepEqual(new Set(ids(life, world)), new Set(["work-apprentice-result", "grow-household-birth", "dirty-water-illness", "masterwork-pottery-mastered", "sculpture-prestige-accepted"]));
  assert.equal(ids(life, world).length, 5, "Already-held job and mastered skill are unchanged; generated facts do not duplicate the source.");
});

test("net state changes count; intermediate setters, capped gains, zero effects and repeat flags stay quiet", () => {
  const { world, life } = fixture();
  world.stats.knowledge.initial = world.stats.knowledge.max;
  world.flags["story-unlock"] = { label: "A new route", initial: false };
  add(world, "cap", [{ type: "stat", stat: "knowledge", delta: 30 }]);
  add(world, "net-zero", [{ type: "job", job: "apprentice" }, { type: "job", job: null }, { type: "asset", asset: "tools", delta: 0 },
    { type: "stat", stat: "bonds", delta: 10 }, { type: "stat", stat: "bonds", delta: -10 }]);
  add(world, "unlock", [{ type: "flag", flag: "story-unlock", value: true }]);
  add(world, "future-route", [], { when: { type: "flag", flag: "story-unlock", value: true } });
  add(world, "assessment-only", [{ type: "flag", flag: "late-sculpture-assessed", value: true }], { when: { type: "flag", flag: "late-sculpture-assessed", value: false } });
  life.journal = [entry("event", "cap"), entry("event", "net-zero"), entry("event", "unlock"), entry("event", "unlock"), entry("event", "assessment-only")];
  assert.deepEqual(ids(life, world), ["unlock"]);
});

test("substantial known numeric changes and net financial shocks notify; annual wages and transfers do not", () => {
  const { world, life } = fixture();
  add(world, "big-learning", [{ type: "stat", stat: "knowledge", delta: 10 }]);
  add(world, "transfer", [{ type: "cash", delta: -20 }, { type: "debt", delta: -20 }]);
  add(world, "minor-cash", [{ type: "cash", delta: 1 }]);
  life.journal = [entry("event", "big-learning"), entry("event", "transfer"), entry("event", "minor-cash"), entry("activity", "asset-income"),
    entry("activity", "auto-debt-payment"), entry("activity", "porter"), entry("event", "household-royal-patronage-changes")];
  assert.deepEqual(new Set(ids(life, world)), new Set(["big-learning", "household-royal-patronage-changes"]));
});

test("uncertain numeric histories stay quiet and unapplied post-ending effects never become story changes", () => {
  const { world, life } = fixture();
  world.stats.knowledge.initialRange = { min: 0, max: 100 };
  add(world, "uncertain-learning", [{ type: "stat", stat: "knowledge", delta: 50 }]);
  add(world, "fatal", [{ type: "end", ending: world.defaultEnding }, { type: "job", job: "apprentice" }]);
  add(world, "no-job", [{ type: "job", job: null }]);
  life.journal = [entry("event", "uncertain-learning"), entry("event", "fatal"), entry("ending", world.defaultEnding), entry("event", "no-job")];
  assert.deepEqual(ids(life, world), [world.defaultEnding]);
});

test("runtime care and relationship warnings notify while routine drift and duplicate severe onset stay quiet", () => {
  const { world, life } = fixture();
  life.journal = [entry("event", "health-age-decline"), entry("event", "knowledge-idle-loss"), entry("event", "health-onset-malaria"),
    entry("event", "health-severe-onset-malaria"), entry("event", "health-continues-malaria"), entry("event", "health-recovery-malaria"),
    entry("event", "relationship-distance-child-1")];
  assert.deepEqual(new Set(ids(life, world)), new Set(["health-severe-onset-malaria", "health-recovery-malaria", "relationship-distance-child-1"]));
});

test("small loan instalments and routine activity fees stay quiet without hiding independent health warnings", () => {
  const { world, life } = fixture();
  const terms = world.economy!.moneylender!;
  world.character!.activities.push({ id: "routine-lesson", text: "Practice", category: "training", outcomes: [{ id: "routine-fee", text: "Practice continues.", weight: 1, effects: [{ type: "cash", delta: -20 }] }] });
  add(world, "big-health-drop", [{ type: "stat", stat: "health", delta: -40 }]);
  life.journal = [entry("outcome", "borrow-moneylender-result"), entry("activity", "moneylender-loan-borrowed"),
    entry("outcome", "pay-moneylender-instalment-result"), entry("activity", "moneylender-loan-payment"),
    entry("outcome", "routine-fee"), entry("event", "big-health-drop"), entry("event", "health-onset-exhaustion")];
  const instalment = world.events.flatMap(event => event.choices.flatMap(choice => choice.outcomes)).find(outcome => outcome.id === "pay-moneylender-instalment-result")!;
  instalment.effects = [{ type: "loan", action: "repay", amount: 1 }];
  assert.ok(terms.principal + terms.fee > 1);
  const importantIds = ids(life, world);
  assert.ok(!importantIds.includes("pay-moneylender-instalment-result"));
  assert.ok(!importantIds.includes("moneylender-loan-payment"));
  assert.ok(!importantIds.includes("routine-fee"));
  assert.ok(importantIds.includes("health-onset-exhaustion"));
});


test("influence-catalog decisions stay pending until their actual outcome is recorded", () => {
  const { world, life } = fixture();
  world.influences = [{ id: "outside-school", label: "A school opens", baseWeight: 5, event: {
    id: "catalog-school", title: "An invitation from a scholar", text: "Will you join the school?", trigger: { type: "random", weight: 1 },
    choices: [{ id: "catalog-accept", text: "Join", outcomes: [{ id: "catalog-joined", text: "You begin a new apprenticeship.", weight: 1, effects: [{ type: "job", job: "apprentice" }] }] }],
  } }];
  life.journal = [{ ...entry("event", "catalog-school"), source: { contractId: "figures.test", tokenId: "lesson-nft" } }];
  assert.equal(buildLifeEvents(life, world).flatMap(year => year.events).length, 0, "An external decision prompt is not a completed fact.");
  assert.deepEqual(ids(life, world), []);
  life.journal.push(entry("outcome", "catalog-joined"));
  const completed = buildLifeEvents(life, world).flatMap(year => year.events);
  assert.equal(completed[0].title, "An invitation from a scholar");
  assert.equal(completed[0].marker?.tokenId, "lesson-nft", "The accepted outcome keeps its original NFT attribution.");
  assert.deepEqual(ids(life, world), ["catalog-joined"]);
});

test("NFT effects use realized journal changes, while capped and effectless deeds stay quiet", () => {
  const { world, life } = fixture();
  world.influences = [{ id: "knowledge-deed", label: "A lesson", baseWeight: 3, effects: [{ type: "stat", stat: "knowledge", delta: 30 }] },
    { id: "empty-deed", label: "Nothing changes", baseWeight: 1, effects: [] }];
  life.journal = [{ ...entry("influence", "knowledge-deed"), deltas: {} },
    { ...entry("influence", "empty-deed"), deltas: {} },
    { ...entry("influence", "knowledge-deed"), deltas: { knowledge: 3 } }];
  assert.deepEqual(ids(life, world), ["knowledge-deed"], "Only the actually effective applied deed appears.");
});

test("demo household crises, responsibility and completed works notify; ordinary settlement ticks do not", () => {
  const { world, life } = fixture();
  world.demo = demoWorld().demo;
  const quiet = ["household-harvest", "household-rent", "household-feed-ox", "household-bought-grain", "household-eat",
    "household-spoilage", "household-spinning", "army-wages", "market-prices", "town-year", "work-well-progress", "offer-declined", "offer-lapsed"];
  const changed = ["household-hunger", "household-ox-died", "household-hand-over", "household-parents-gone", "work-well-built",
    "convoy-contract", "convoy-loss", "convoy-pay-shortfall", "army-ration-shortfall", "army-wage-shortfall"];
  life.journal = [...quiet, ...changed].map(id => entry("event", id));
  const before = JSON.stringify({ life, world });
  assert.deepEqual(new Set(ids(life, world)), new Set(changed));
  assert.equal(JSON.stringify({ life, world }), before);
});

test("demo contracts notify only after actual settlement and do not duplicate their source outcome", () => {
  const { world, life } = fixture();
  world.demo = demoWorld().demo;
  add(world, "contract", [], { mode: undefined, choices: [{ id: "accept-contract", text: "Accept", outcomes: [{
    id: "contract-accepted", text: "You answer the offer.", weight: 1, effects: [{ type: "demo", effect: { kind: "offer", action: "accept" } }],
  }] }] });
  life.journal = [entry("outcome", "contract-accepted"), entry("event", "offer-lapsed"),
    entry("outcome", "contract-accepted"), entry("event", "offer-settled")];
  assert.deepEqual(ids(life, world), ["contract-accepted"]);
});

test("building progress and its regular costs stay quiet until the community work is finished", () => {
  const { world, life } = fixture();
  world.demo = demoWorld().demo;
  add(world, "build-well", [{ type: "cash", delta: -200 }, { type: "demo", effect: { kind: "work", work: "well", progress: 1 } }]);
  life.journal = [entry("event", "build-well"), entry("event", "work-well-progress"),
    entry("event", "build-well"), entry("event", "work-well-built"), entry("event", "reputation-change")];
  assert.deepEqual(ids(life, world), ["build-well"], "One completed work produces one notification.");
});

test("major demo trades notify without making every small purchase a life event", () => {
  const { world, life } = fixture();
  world.demo = demoWorld().demo;
  const threshold = Math.max(10, world.demo!.household.adultRation * world.demo!.market.basePrice.grain);
  life.journal = [{ ...entry("event", "market-trade"), text: "You buy one measure of grain from the merchant for 1 drachmas." },
    { ...entry("event", "market-trade"), text: `You sell grain to the merchant for ${threshold} drachmas.` }];
  assert.deepEqual(ids(life, world), ["market-trade"]);
});

test("demo NFT granary and seed help notify, while a road deed without a convoy has no effect", () => {
  const { world, life } = fixture();
  world.demo = demoWorld().demo;
  world.influences = [{ id: "farming.stock-granary", label: "A granary opens", baseWeight: 3, effects: [{ type: "demo", effect: {
    kind: "grain", delta: world.demo!.household.adultRation, cause: "granary",
  } }] }, { id: "farming.share-seed", label: "Seed arrives", baseWeight: 1, effects: [{ type: "demo", effect: { kind: "harvest-bonus", bps: 1000 } }] },
    { id: "military.guard-road", label: "A road patrol", baseWeight: 3, effects: [{ type: "demo", effect: { kind: "convoy", action: "depart", riskCutBps: 2000 } }] }];
  life.journal = [{ ...entry("influence", "military.guard-road"), deltas: {} },
    { ...entry("influence", "farming.stock-granary"), deltas: {} }, entry("event", "grain-granary"),
    { ...entry("influence", "farming.share-seed"), deltas: {} }, entry("event", "convoy-assigned"),
    { ...entry("influence", "military.guard-road"), deltas: {} }];
  assert.deepEqual(new Set(ids(life, world)), new Set(["farming.stock-granary", "farming.share-seed", "convoy-assigned", "military.guard-road"]));
  assert.equal(ids(life, world).filter(id => id === "military.guard-road").length, 1);
});
