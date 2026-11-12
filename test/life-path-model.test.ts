import { test } from "node:test";
import assert from "node:assert/strict";
import { affinityView, createEngine, fieldNeedsView, lifeStageView, stageRecordsView } from "../src/index.ts";
import { lifePathModel } from "../client/models/life-path.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);

function playedTo(age: number, seed: string): LifeState {
  let life = engine.start(seed);
  for (let guard = 0; life.age < age && life.phase !== "ended" && guard < 600; guard++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

test("the life path shows the engine's own views of stage, district, trades, pull, people met and records", () => {
  const life = playedTo(24, "life-path-model");
  const model = lifePathModel(world, life)!;
  assert.equal(model.stage?.title, lifeStageView(world, life.age)!.title);
  assert.equal(model.home, world.paths!.districts[life.paths!.home].title);
  assert.equal(model.current, world.paths!.districts[life.paths!.district].title);
  assert.equal(model.away, life.paths!.home !== life.paths!.district);
  const unusual = fieldNeedsView(world, life).filter(need => need.label !== "steady");
  assert.deepEqual(model.needs.map(need => need.title), unusual.map(need => need.title));
  for (const need of model.needs) assert.match(need.pay, /^\d\.\d×$/);
  const drawn = affinityView(world, life).filter(entry => entry.affinity > 0).slice(0, 3);
  assert.deepEqual(model.affinities.map(entry => [entry.title, entry.value]), drawn.map(entry => [entry.title, entry.affinity]));
  assert.deepEqual(model.people, life.journal.filter(entry => entry.id.startsWith("paths-meet-")).map(entry => entry.text).reverse().slice(0, 5));
  assert.equal(model.records.length, stageRecordsView(world, life).length);
  assert.ok(model.records.every(record => /^\d+–\d+$/.test(record.ages)));
});

test("only people the life has actually met are listed", () => {
  const life = playedTo(6, "life-path-people");
  const met = new Set(life.journal.filter(entry => entry.id.startsWith("paths-meet-")).map(entry => entry.text));
  for (const text of lifePathModel(world, life)!.people) assert.ok(met.has(text));
});

test("reading the life path changes nothing", () => {
  const life = playedTo(12, "life-path-pure");
  const before = structuredClone(life);
  lifePathModel(world, life);
  assert.deepEqual(life, before);
});

test("worlds without life paths have no life path to show", () => {
  const plain = retained as unknown as WorldPack;
  assert.equal(lifePathModel(plain, createEngine(plain).start("life-path-plain")), null);
});
