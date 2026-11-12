import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import { meetPractitioner, moveDistrict } from "../src/paths/index.ts";
import type { LifeEvent, LifeState } from "../src/types.ts";
import { pathsWorld } from "./paths-fixture.ts";
import { livesWithPaths } from "./paths-lives-fixture.ts";

const fixture = pathsWorld();
const engine = createEngine(fixture);

function born(origin: string): LifeState {
  for (let i = 0; i < 200; i++) {
    const life = engine.start(`meet-${i}`);
    if (life.originId === origin) return structuredClone(life) as LifeState;
  }
  throw new Error(origin);
}

function tiersMet(origin: string, field: "ceramics", people: [number, number, number, number]): Record<string, number> {
  const counts: Record<string, number> = {};
  const base = born(origin);
  base.paths!.people[field] = people;
  for (let age = 3; age < 203; age++) {
    const life = structuredClone(base) as LifeState;
    life.age = age;
    meetPractitioner(fixture, life, field, "adult");
    const met = life.paths!.practitioners.at(-1);
    if (met) counts[met.tier] = (counts[met.tier] ?? 0) + 1;
  }
  return counts;
}

test("who you can meet depends on the district's people", () => {
  const city = tiersMet("workshop", "ceramics", [3, 6, 2, 1]), village = tiersMet("farm", "ceramics", [1, 1, 0, 0]);
  assert.ok((city.renowned ?? 0) > 0);
  assert.equal(village.renowned ?? 0, 0);
  assert.equal(village.master ?? 0, 0);
  assert.ok((city.master ?? 0) + (city.renowned ?? 0) >= 25, `city masters and renowned met: ${JSON.stringify(city)}`);
});

test("a master's pull follows the tier table and never grants a skill node", () => {
  const life = born("farm");
  life.paths!.people.ceramics = [0, 0, 1, 0];
  const result = meetPractitioner(fixture, life, "ceramics", "young");
  assert.match(result.text, /master potter/);
  assert.deepEqual(result.effects, [
    { type: "affinity", field: "ceramics", delta: 20, source: `${life.paths!.practitioners[0].name}, a master potter` },
    { type: "skill", skill: "pottery", delta: 4 },
  ]);
  assert.deepEqual(life.paths!.introductions, ["ceramics"]);
  assert.equal(matchesCondition({ type: "introduced", field: "ceramics" }, life), true);
  assert.equal(life.capabilities, undefined);
});

test("a learner nudges a little, without proficiency or introduction", () => {
  const life = born("farm");
  life.paths!.people.ceramics = [1, 0, 0, 0];
  const result = meetPractitioner(fixture, life, "ceramics", "child");
  assert.deepEqual(result.effects, [{ type: "affinity", field: "ceramics", delta: 5, source: `${life.paths!.practitioners[0].name}, a young potter` }]);
  assert.deepEqual(life.paths!.introductions, []);
});

test("nobody to meet changes nothing", () => {
  const life = born("farm");
  life.paths!.people.research = [0, 0, 0, 0];
  const before = structuredClone(life);
  const result = meetPractitioner(fixture, life, "research", "adult");
  assert.deepEqual(result.effects, []);
  assert.match(result.text, /No scholar/);
  assert.deepEqual(life, before);
});

test("names come from the world's name pools without touching the life's main random stream", () => {
  const world = livesWithPaths();
  const life = structuredClone(createEngine(world).start("names")) as LifeState;
  life.paths!.people.ceramics = [0, 2, 0, 0];
  const rng = life.rngState;
  const first = structuredClone(life) as LifeState, second = structuredClone(life) as LifeState;
  meetPractitioner(world, first, "ceramics", "adult");
  meetPractitioner(world, second, "ceramics", "adult");
  assert.equal(first.rngState, rng);
  assert.equal(first.paths!.practitioners[0].name, second.paths!.practitioners[0].name);
  const pools = world.character!.identity!.namePools;
  assert.ok([...pools.male, ...pools.female].includes(first.paths!.practitioners[0].name));
});

test("only the player moves; the household stays and the needs follow the new district", () => {
  const world = livesWithPaths();
  const life = structuredClone(createEngine(world).start("move")) as LifeState;
  life.age = 13;
  const household = structuredClone(life.demo!.household);
  const villageNeed = life.paths!.needs.ceramics.bps;
  moveDistrict(world, life, "city", "an apprenticeship with a city potter");
  assert.equal(life.paths!.district, "city");
  assert.equal(life.paths!.home, "village");
  assert.deepEqual(life.demo!.household, household);
  assert.notEqual(life.paths!.needs.ceramics.bps, villageNeed);
  assert.equal(matchesCondition({ type: "away-from-home" }, life), true);
  assert.equal(matchesCondition({ type: "demo", condition: { kind: "item", item: "grain", op: "gte", value: 0 } } as never, life), true);
  const text = moveDistrict(world, life, "home", "homesick");
  assert.equal(life.paths!.district, "city", "one move per life stage");
  assert.match(text, /already moved/);
  life.age = 16;
  moveDistrict(world, life, "home", "a return to the family plot");
  assert.equal(life.paths!.district, "village");
});

test("meeting and moving work as event effects and validate", () => {
  const meet: LifeEvent = { id: "meet", title: "Meet", text: "Someone at work.", trigger: { type: "random", weight: 1 }, stages: ["childhood"], mode: "automatic",
    choices: [], maxOccurrences: 1, effects: [{ type: "meet-practitioner", field: "ceramics", band: "child" }] };
  const world = pathsWorld({ events: [meet] });
  validateWorld(world);
  const played = createEngine(world);
  let life = played.start("meet-effect");
  for (let i = 0; i < 6; i++) life = played.advance(life);
  assert.equal(life.paths!.practitioners.length, life.eventCounts.meet ?? 0);
  assert.deepEqual(played.replay(life.seed, life.commands), life);
  assert.throws(() => validateWorld(pathsWorld({ events: [{ ...meet, effects: [{ type: "meet-practitioner", field: "ceramics", band: "toddler" } as never] }] })), /band/);
  assert.throws(() => validateWorld(pathsWorld({ events: [{ ...meet, effects: [{ type: "move-district", district: "atlantis", reason: "x" } as never] }] })), /district/);
});
