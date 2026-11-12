import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { advanceDistrict, fieldNeedBps, fieldNeedsView, refreshNeeds } from "../src/paths/index.ts";
import type { LifeState } from "../src/types.ts";
import { pathsWorld } from "./paths-fixture.ts";

const world = pathsWorld();
const engine = createEngine(world);

function bornIn(origin: "farm" | "workshop", seed = "district"): LifeState {
  for (let i = 0; i < 200; i++) {
    const life = engine.start(`${seed}-${i}`);
    if (life.originId === origin) return life;
  }
  throw new Error(`no ${origin} birth`);
}

function play(life: LifeState, years: number): LifeState {
  for (let i = 0; i < years && life.phase !== "ended"; i++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

/** A detached, mutable copy with a demo year we control, for the yearly district step. */
function withYear(life: LifeState, army: "quiet" | "recruiting" | "war", flood: "low" | "normal" | "high" = "normal"): LifeState {
  const copy = structuredClone(life) as LifeState;
  (copy as { demo?: unknown }).demo = { year: { army, flood, road: "safe", fresh: [] } };
  return copy;
}

test("a life starts in its birthplace's district with seeded people and a needs cache", () => {
  const farm = bornIn("farm");
  assert.equal(farm.paths!.home, "village");
  assert.equal(farm.paths!.district, "village");
  const workers = farm.paths!.people.farming[1];
  assert.ok(workers >= 5 && workers <= 7, `village farmers near the profile (${workers})`);
  assert.equal(farm.paths!.needs.farming.label, "steady");
  const workshop = bornIn("workshop");
  assert.equal(workshop.paths!.district, "city");
  assert.ok(workshop.paths!.people.ceramics[1] > farm.paths!.people.ceramics[1]);
  assert.equal(workshop.paths!.affinity.ceramics, 10, "household background affinity");
});

test("the district changes by rule and replays exactly", () => {
  const a = play(bornIn("farm", "replay"), 20), b = play(bornIn("farm", "replay"), 20);
  assert.deepEqual(a.paths, b.paths);
  assert.deepEqual(engine.replay(a.seed, a.commands), a);
  const other = play(bornIn("farm", "other"), 20);
  assert.notDeepEqual(a.paths!.people, other.paths!.people);
});

test("war takes soldiers and raises the soldier need", () => {
  const city = bornIn("workshop");
  const quiet = withYear(city, "quiet");
  const war = withYear(city, "war");
  advanceDistrict(world, quiet);
  advanceDistrict(world, war);
  assert.ok(war.paths!.people.soldiering[1] < quiet.paths!.people.soldiering[1]);
  assert.ok(fieldNeedBps(war, "soldiering") > fieldNeedBps(quiet, "soldiering"));
});

test("a low flood takes farmers", () => {
  const farm = bornIn("farm");
  const normal = withYear(farm, "quiet", "normal");
  const low = withYear(farm, "quiet", "low");
  advanceDistrict(world, normal);
  advanceDistrict(world, low);
  assert.ok(low.paths!.people.farming[1] < normal.paths!.people.farming[1]);
});

test("a field with nobody working is capped as scarce and says so", () => {
  const farm = structuredClone(bornIn("farm")) as LifeState;
  farm.paths!.people.ceramics = [0, 0, 0, 0];
  refreshNeeds(world, farm);
  const view = fieldNeedsView(world, farm).find(item => item.field === "ceramics")!;
  assert.equal(view.working, 0);
  assert.equal(view.needBps, 16000);
  assert.equal(view.label, "scarce");
  assert.match(view.reason, /^No potters/);
});

test("needs are bounded and labelled", () => {
  const farm = structuredClone(bornIn("farm")) as LifeState;
  farm.paths!.people.research = [0, 0, 0, 0];
  farm.paths!.people.farming = [0, 60, 0, 0];
  refreshNeeds(world, farm);
  const research = fieldNeedsView(world, farm).find(item => item.field === "research")!;
  assert.equal(research.needBps, 10000, "no demand and nobody working is steady");
  const village = fieldNeedsView(world, farm);
  const farming = village.find(item => item.field === "farming")!;
  assert.equal(farming.needBps, 7000);
  assert.equal(farming.label, "crowded");
  assert.match(farming.reason, /farmers/);
});

test("reading the needs view changes nothing", () => {
  const life = bornIn("workshop");
  const before = structuredClone(life);
  assert.deepEqual(fieldNeedsView(world, life), fieldNeedsView(world, life));
  assert.deepEqual(life, before);
});
