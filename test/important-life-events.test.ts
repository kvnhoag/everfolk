import assert from "node:assert/strict";
import test from "node:test";
import { builtinEngine } from "../client/lib/world-session.ts";
import { buildImportantLifeEvents } from "../client/models/important-life-events.ts";
import { buildLifeEvents } from "../client/models/life-events.ts";
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


test("vocation crises, completed community works and applied influences remain important", () => {
  const { world, life } = fixture();
  // The projection only needs the presence of the vocation economy, never its balances.
  world.demo = {} as NonNullable<WorldPack["demo"]>;
  life.journal = [entry("event", "household-harvest"), entry("event", "market-prices"),
    entry("event", "household-hunger"), entry("event", "convoy-loss"), entry("event", "work-well-progress"),
    entry("event", "work-well-built"), entry("event", "year-road-dangerous"), entry("influence", "past-life-granary")];
  assert.deepEqual(new Set(ids(life, world)), new Set([
    "household-hunger", "convoy-loss", "work-well-built", "year-road-dangerous", "past-life-granary",
  ]));
});
