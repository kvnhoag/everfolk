import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import type { Condition, Effect, LifeState, WorldPack } from "../src/types.ts";

function fixture(): WorldPack {
  const activity = (id: string, effects: Effect[]) => ({ id, text: id, category: "family" as const, minAge: 18, usesYearlyActivity: false,
    outcomes: [{ id: `${id}-done`, text: `${id} completed.`, weight: 1, effects }] });
  return { schemaVersion: 1, id: "child-age-test", version: "1", title: "Child ages", description: "Synthetic household fixture.",
    startYear: -66, maxAge: 90, stats: { bonds: { label: "Bonds", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Home.", weight: 1, effects: [] }], yearlyEffects: [],
    character: { skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [{ id: "partner", name: "Partner", ageOffset: 0, occupation: "Worker", description: "A synthetic adult." }],
      childNames: ["First", "Second"], deathCauseDescription: "Synthetic.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [activity("court", [{ type: "relationship", partner: "partner", status: "courting" }]),
        activity("marry", [{ type: "relationship", partner: "partner", status: "married" }]), activity("have-child", [{ type: "child" }])] },
    events: [{ id: "letters", title: "Letters", text: "Your child asks about a written mark.", trigger: { type: "age", at: 18 },
      when: { type: "child-age", min: 5, max: 10 }, mode: "automatic", choices: [], effects: [] }],
    endings: [{ id: "complete", title: "Complete", text: "Complete." }], defaultEnding: "complete" };
}

test("child-age uses each child's birthAge and inclusive bounds, including multiple children", () => {
  const engine = createEngine(fixture()), life = structuredClone(engine.start("ages"));
  const rule: Condition = { type: "child-age", min: 5, max: 10 };
  assert.equal(matchesCondition(rule, life), false);
  const noCharacter: LifeState = { ...life }; delete noCharacter.character;
  assert.equal(matchesCondition(rule, noCharacter), false);
  life.age = 40;
  life.character!.children = [{ id: "old", name: "Old", birthAge: 20, otherParentId: "partner" },
    { id: "young", name: "Young", birthAge: 35, otherParentId: "partner" }];
  assert.equal(matchesCondition(rule, life), true, "any child in range qualifies, not only the first child");
  life.age = 45;
  assert.equal(matchesCondition(rule, life), true, "upper age bound is inclusive");
  life.age = 46;
  assert.equal(matchesCondition(rule, life), false, "grown children stop triggering a young-child story");
  life.age = 34;
  assert.equal(matchesCondition({ type: "child-age", min: 0, max: 4 }, life), false, "future birth dates cannot qualify as infants");
  assert.equal(matchesCondition({ type: "not", condition: rule }, life), true);
});

test("age-gated parenting events unlock only after an actual child's birthday and replay exactly", () => {
  const engine = createEngine(fixture());
  let life = engine.start("parenting-route");
  while (life.age < 18) life = engine.advance(life);
  life = engine.act(life, "court"); life = engine.act(life, "marry"); life = engine.act(life, "have-child");
  assert.equal(life.character!.children[0].birthAge, 18);
  assert.equal(life.eventCounts.letters, undefined, "an infant cannot request reading lessons");
  while (life.age < 22) life = engine.advance(life);
  assert.equal(life.eventCounts.letters, undefined);
  life = engine.advance(life);
  assert.equal(life.age, 23); assert.equal(life.eventCounts.letters, 1);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("child-age requires a character and complete nonnegative integer bounds", () => {
  for (const condition of [
    { type: "child-age", min: -1, max: 10 }, { type: "child-age", min: 10, max: 5 },
    { type: "child-age", min: 0.5, max: 10 }, { type: "child-age", min: 0, max: 10001 },
    { type: "child-age", min: 0, max: Infinity }, { type: "child-age", min: 0 },
    { type: "child-age", min: 0, max: 10, value: 1 },
  ]) {
    const world = fixture(); world.events[0].when = condition as Condition;
    assert.throws(() => validateWorld(world), /events\[0\].when/);
  }
  const missingCharacter = fixture(); delete missingCharacter.character;
  assert.throws(() => validateWorld(missingCharacter), /requires a character definition/);
  const boundary = fixture(); boundary.events[0].when = { type: "child-age", min: 0, max: 10000 };
  validateWorld(boundary);
});
