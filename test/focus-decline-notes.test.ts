import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import legacyPack from "../worlds/alexandria-0.15.0.json" with { type: "json" };
import { yearlyDeclineNotes } from "../client/yearly-focus.ts";

function fixture(age: number): { life: LifeState; world: WorldPack } {
  const engine = createEngine(legacyPack);
  const world = structuredClone(engine.world);
  const life = structuredClone(engine.start("decline-note"));
  life.age = age;
  world.knowledge = { stat: "knowledge", minAge: 12, idleGraceYears: 2, idleLoss: 1, description: "Authored game rules.", ageBands: [
    { minAge: 0, maxAge: 49, loss: 0 }, { minAge: 50, maxAge: 99, loss: 0.5 },
  ] };
  life.knowledge = { lastPracticeAge: null };
  return { life, world };
}

test("decline notes use the current world's actual age bands and retention values", () => {
  const { life, world } = fixture(50);
  const before = structuredClone(life);
  assert.deepEqual(yearlyDeclineNotes(life, world), [
    "Ageing per year: Health 1 · Knowledge 0.5.",
    "Knowledge fades by 1/year after 2 years without learning.",
  ]);
  world.knowledge!.idleLoss = 2;
  world.knowledge!.idleGraceYears = 1;
  assert.equal(yearlyDeclineNotes(life, world)[1], "Knowledge fades by 2/year after 1 year without learning.");
  assert.deepEqual(life, before);
});

test("newborn, completed and legacy lives do not get a false Knowledge-decay hint", () => {
  const { life, world } = fixture(0);
  assert.deepEqual(yearlyDeclineNotes(life, world), []);
  life.age = 15;
  life.knowledge!.lastPracticeAge = life.age;
  assert.deepEqual(yearlyDeclineNotes(life, world), ["Learning practised this year."]);
  delete world.knowledge;
  delete life.knowledge;
  assert.deepEqual(yearlyDeclineNotes(life, world), []);
  life.age = 70;
  life.phase = "ended";
  assert.deepEqual(yearlyDeclineNotes(life, world), []);
});
