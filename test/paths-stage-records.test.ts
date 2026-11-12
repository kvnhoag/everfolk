import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { recordStage, stageRecordsView } from "../src/paths/index.ts";
import type { LifeState } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import type { WorldPack } from "../src/types.ts";
import { pathsWorld } from "./paths-fixture.ts";

const world = pathsWorld();
const engine = createEngine(world);

function playToEnd(seed: string): LifeState {
  let life = engine.start(seed);
  for (let i = 0; i < 400 && life.phase !== "ended"; i++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

test("a finished life has one contiguous record per stage it lived through", () => {
  const life = playToEnd("records");
  const records = stageRecordsView(world, life);
  assert.deepEqual(records.map(record => record.stageId), ["infancy", "childhood", "adulthood"]);
  assert.deepEqual(records.map(record => [record.fromAge, record.toAge]), [[0, 2], [3, 15], [16, life.age]]);
  assert.match(records[0].title, /^Child of a /);
});

test("stage records survive save, load and replay", () => {
  const life = playToEnd("records-save");
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("a stage record names the field, tier and the people met in it", () => {
  const life = structuredClone(engine.start("record-fields")) as LifeState;
  life.age = 20;
  life.character!.jobId = "farmhand";
  life.character!.skills = { ...life.character!.skills, farming: 30, reckoning: 12, warfare: 0 };
  life.paths!.practitioners = [{ id: "p1", name: "Theon", field: "farming", tier: "master", district: life.paths!.district, metAge: 18 },
    { id: "p2", name: "Iras", field: "farming", tier: "worker", district: life.paths!.district, metAge: 5 }];
  const record = recordStage(world, life, "adulthood", 16, 20);
  assert.equal(record.field, "farming");
  assert.equal(record.tier, "worker");
  assert.equal(record.jobId, "farmhand");
  assert.deepEqual(record.mentors, ["Theon"]);
  assert.deepEqual(record.topSkills, { farming: 30, reckoning: 12 });
  assert.match(record.title, /^Farmer of /);
});

test("without a job, a strong affinity names the field; a weak one does not", () => {
  const life = structuredClone(engine.start("record-affinity")) as LifeState;
  life.age = 14;
  life.paths!.affinity = { ...life.paths!.affinity, ceramics: 25 };
  assert.equal(recordStage(world, life, "childhood", 3, 14).field, "ceramics");
  assert.match(recordStage(world, life, "childhood", 3, 14).title, /^Apprentice potter of /);
  life.paths!.affinity = { ...life.paths!.affinity, ceramics: 19 };
  assert.equal(recordStage(world, life, "childhood", 3, 14).field, null);
});

test("older free-play lives have no stage records", () => {
  const old = createEngine(retained as unknown as WorldPack);
  let life = old.start("old-records");
  for (let i = 0; i < 20 && life.phase !== "ended"; i++) life = life.phase === "choice" ? old.choose(life, old.getChoices(life)[0].id) : old.advance(life);
  assert.equal(life.stageRecords, undefined);
});

test("a stage's record includes its last year's work", async () => {
  const { default: lives } = await import("../worlds/demo/alexandria-lives-8.json", { with: { type: "json" } });
  const shippedWorld = lives as unknown as import("../src/types.ts").WorldPack;
  const shippedEngine = createEngine(shippedWorld);
  let life = shippedEngine.start("stage-record-last-year");
  for (let guard = 0; life.age < 15 && life.phase !== "ended" && guard < 600; guard++) life = life.phase === "choice" ? shippedEngine.choose(life, shippedEngine.getChoices(life)[0].id) : shippedEngine.advance(life);
  const draft = structuredClone(life);
  draft.character!.jobId = "farmhand";
  draft.phase = "ready"; draft.pendingEventId = null;
  const after = shippedEngine.advance(draft);
  const youth = after.stageRecords!.find(record => record.stageId === "youth")!;
  assert.equal(youth.toAge, 15);
  assert.equal(youth.topSkills.farming, after.character!.skills.farming, "the farmhand's last-year farming gain is in the record");
});
