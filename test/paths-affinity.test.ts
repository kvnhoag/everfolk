import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import { affinityView, changeAffinity, eventFieldWeight, fadeAffinity, practiceBonus } from "../src/paths/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import { pathsWorld } from "./paths-fixture.ts";

const decision = (id: string, fields?: LifeEvent["fields"]): LifeEvent => ({
  id, title: id, text: `${id} happens.`, trigger: { type: "random", weight: 1 }, stages: ["childhood", "adulthood"],
  maxOccurrences: 99, cooldownYears: 0, ...(fields ? { fields } : {}),
  choices: [{ id: `${id}-go`, text: "Go", outcomes: [{ id: `${id}-done`, text: "Done.", weight: 1, effects: [] }] }],
});

function world(tagged: boolean): WorldPack {
  return pathsWorld({ events: [decision("pots", tagged ? ["ceramics"] : undefined), decision("fields", tagged ? ["farming"] : undefined), decision("plain")] });
}

function offered(pack: WorldPack, seed: string, setup?: (life: LifeState) => void): string[] {
  const engine = createEngine(pack);
  let life = engine.start(seed);
  if (setup) { life = structuredClone(life) as LifeState; setup(life); }
  const ids: string[] = [];
  for (let i = 0; i < 80 && life.phase !== "ended"; i++) {
    if (life.phase === "choice") { ids.push(life.pendingEventId!); life = engine.choose(life, engine.getChoices(life)[0].id); }
    else life = engine.advance(life);
  }
  return ids;
}

test("with no affinity, field tags leave event draws exactly as they were", () => {
  const seeds = ["a", "b", "c"];
  for (const seed of seeds) {
    const tagged = offered(world(true), seed, life => { for (const field of Object.keys(life.paths!.affinity)) life.paths!.affinity[field as "farming"] = 0; });
    const plain = offered(world(false), seed, life => { for (const field of Object.keys(life.paths!.affinity)) life.paths!.affinity[field as "farming"] = 0; });
    assert.deepEqual(tagged, plain);
  }
});

test("affinity makes a field's events come up more often", () => {
  let pots = 0, fields = 0;
  for (let i = 0; i < 30; i++) {
    const ids = offered(world(true), `pull-${i}`, life => { life.paths!.affinity.ceramics = 100; });
    pots += ids.filter(id => id === "pots").length;
    fields += ids.filter(id => id === "fields").length;
  }
  assert.ok(pots > fields * 1.4, `${pots} vs ${fields}`);
});

test("event weight doubles at full affinity", () => {
  const pack = world(true);
  const life = structuredClone(createEngine(pack).start("weight")) as LifeState;
  life.paths!.affinity.ceramics = 100;
  assert.equal(eventFieldWeight(pack, life, pack.events[0]), 2);
  life.paths!.affinity.ceramics = 50;
  assert.equal(eventFieldWeight(pack, life, pack.events[0]), 1.5);
  assert.equal(eventFieldWeight(pack, life, pack.events[2]), 1);
});

test("practice in a field one is drawn to grows faster", () => {
  const pack = world(true);
  const life = structuredClone(createEngine(pack).start("practice")) as LifeState;
  life.paths!.affinity.ceramics = 100;
  assert.equal(practiceBonus(pack, life, "pottery", 10), 12);
  assert.equal(practiceBonus(pack, life, "farming", 10), 10);
  assert.equal(practiceBonus(pack, life, "pottery", -4), -4);
});

test("affinity changes are bounded, journalled when they matter, and visible", () => {
  const pack = world(true);
  const life = structuredClone(createEngine(pack).start("change")) as LifeState;
  assert.equal(changeAffinity(pack, life, "ceramics", 3, "clay by the door"), undefined);
  assert.match(changeAffinity(pack, life, "ceramics", 200, "a master potter") ?? "", /a master potter/);
  assert.equal(life.paths!.affinity.ceramics, 100);
  const engine = createEngine(pathsWorld({ events: [{ ...decision("kiln", ["ceramics"]), mode: "automatic", choices: [],
    effects: [{ type: "affinity", field: "ceramics", delta: 20, source: "the kiln next door" }], stages: ["childhood"], maxOccurrences: 1 }] }));
  let played = engine.start("visible");
  for (let i = 0; i < 6; i++) played = engine.advance(played);
  const view = affinityView(engine.world, played);
  assert.equal(view[0].field, "ceramics");
  assert.ok(view[0].sources.some(source => /kiln next door/.test(source)));
});

test("unused affinity fades slowly, never below the household background", () => {
  const pack = world(true);
  const life = structuredClone(createEngine(pack).start("fade")) as LifeState;
  life.age = 12;
  life.paths!.affinity.ceramics = 30;
  life.paths!.lastPractice.ceramics = 12;
  for (let age = 13; age <= 17; age++) { life.age = age; fadeAffinity(pack, life); }
  assert.equal(life.paths!.affinity.ceramics, 28);
  const workshop = structuredClone(life) as LifeState;
  workshop.originId = "workshop";
  workshop.paths!.affinity.ceramics = 11;
  for (let age = 18; age <= 40; age++) { workshop.age = age; fadeAffinity(pack, workshop); }
  assert.equal(workshop.paths!.affinity.ceramics, 10);
});

test("path conditions read the life and validate", () => {
  const pack = world(true);
  const life = structuredClone(createEngine(pack).start("conditions")) as LifeState;
  life.paths!.affinity.trade = 40;
  assert.equal(matchesCondition({ type: "affinity", field: "trade", op: "gte", value: 40 }, life), true);
  assert.equal(matchesCondition({ type: "district", district: life.paths!.district }, life), true);
  assert.equal(matchesCondition({ type: "away-from-home" }, life), false);
  assert.equal(matchesCondition({ type: "field-need", field: "farming", label: life.paths!.needs.farming.label }, life), true);
  assert.equal(matchesCondition({ type: "field-people", field: "research", op: "gte", value: 1 }, life), false);
  const bad = (when: unknown) => assert.throws(() => validateWorld(pathsWorld({ events: [{ ...decision("x"), when } as LifeEvent] })), /Invalid world/);
  bad({ type: "affinity", field: "alchemy", op: "gte", value: 1 });
  bad({ type: "district", district: "atlantis" });
  bad({ type: "field-need", field: "farming", label: "rare" });
  bad({ type: "affinity", field: "trade", op: "gte", value: 200 });
});
