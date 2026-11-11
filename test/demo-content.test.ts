import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoEngine, demoWorld, liveUntil, withDemo } from "./fixtures/demo/world.ts";
import { buildDemoWorld } from "../src/demo/world.ts";
import { DEMO_KEY_EVENTS } from "../src/demo/content/world.ts";
import { availability, availabilityWithLock } from "../src/demo/availability.ts";
import { matchesCondition } from "../src/conditions.ts";
import { validateWorld } from "../src/validate.ts";
import { UNAVAILABLE_REASON } from "../src/demo/types.ts";
import type { Choice, Condition, LifeEvent, LifeState, WorldPack } from "../src/types.ts";

const rankedText = readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8");
const ranked = JSON.parse(rankedText) as WorldPack;
const world = demoWorld();
const RURAL = ["tenant-farming-household", "soldier-household", "estate-household", "delta-newcomers"];

const event = (id: string): LifeEvent => world.events.find(item => item.id === id)!;
const influenceEvent = (id: string): LifeEvent => world.influences!.find(item => item.id === id)!.event!;
const conditions = (condition: Condition | undefined): Condition[] => !condition ? [] :
  condition.type === "all" || condition.type === "any" ? [condition, ...condition.conditions.flatMap(conditions)]
    : condition.type === "not" ? [condition, ...conditions(condition.condition)] : [condition];
const demoKinds = (condition: Condition | undefined) => conditions(condition).flatMap(item => item.type === "demo" ? [item.condition] : []);
const effectsOf = (choice: Choice) => choice.outcomes.flatMap(outcome => outcome.effects);

test("the demo world validates, builds reproducibly and keeps the ranked world untouched", () => {
  assert.doesNotThrow(() => validateWorld(world));
  assert.equal(JSON.stringify(buildDemoWorld(JSON.parse(rankedText))), JSON.stringify(buildDemoWorld(JSON.parse(rankedText))));
  assert.equal(JSON.stringify(ranked), JSON.stringify(JSON.parse(rankedText)));
  assert.ok(ranked.events.some(item => item.id === "an-unreliable-season"));
});

test("every birth is into a rural household with land", () => {
  assert.deepEqual(world.origins.map(origin => origin.id).sort(), [...RURAL].sort());
  for (const origin of world.origins) assert.match(origin.text, /\b(plot|fields|land)\b/);
  const engine = demoEngine();
  for (let i = 0; i < 20; i++) assert.ok(RURAL.includes(engine.start(`origin-${i}`).originId));
  const json = JSON.stringify(world);
  for (const dropped of ranked.origins.map(origin => origin.id).filter(id => !RURAL.includes(id))) {
    assert.ok(!json.includes(`"origin":"${dropped}"`), `${dropped} is still referenced`);
  }
});

test("the old poor-harvest event is replaced by the flood and levy decisions", () => {
  assert.equal(world.events.some(item => item.id === "an-unreliable-season"), false);
  const flood = event(DEMO_KEY_EVENTS.flood), levy = event(DEMO_KEY_EVENTS.levy);
  for (const key of [flood, levy]) {
    assert.equal(key.trigger.type, "year");
    assert.ok(key.trigger.type === "year" && key.trigger.at <= world.startYear);
    assert.ok((key.maxOccurrences ?? 1) >= 4);
    assert.notEqual(key.mode, "automatic");
  }
  assert.deepEqual(demoKinds(flood.when), [{ kind: "year", family: "flood", level: "low", fresh: true }]);
  assert.ok(demoKinds(levy.when).some(item => item.kind === "year" && item.family === "army" && item.level === "recruiting" && item.fresh === true));
  // Every flood choice changes the household's real accounts.
  for (const choice of flood.choices) assert.ok(effectsOf(choice).some(effect => effect.type === "demo" || effect.type === "cash"), choice.id);
  assert.ok(flood.choices.some(choice => effectsOf(choice).some(effect => effect.type === "demo" && effect.effect.kind === "share-grain")));
  assert.equal(flood.choices[0].when, undefined, "the first flood choice is always open");
  assert.ok(levy.choices.some(choice => choice.when === undefined));
});

test("enlisting at the levy needs the soldier's warfare requirement", () => {
  const levy = event(DEMO_KEY_EVENTS.levy);
  const enlist = levy.choices.find(choice => effectsOf(choice).some(effect => effect.type === "job" && effect.job === "soldier"))!;
  assert.ok(enlist);
  const base = demoEngine().start("levy-check");
  const at = (age: number, warfare: number): LifeState => {
    const life = structuredClone(base) as LifeState;
    life.age = age;
    life.character!.skills.warfare = warfare;
    return life;
  };
  assert.equal(matchesCondition(enlist.when, at(20, 0)), false);
  assert.equal(matchesCondition(enlist.when, at(16, 30)), false);
  assert.equal(matchesCondition(enlist.when, at(20, 10)), true);
  for (const item of [...world.events, ...world.influences!.map(entry => entry.event!).filter(Boolean)]) {
    if (![DEMO_KEY_EVENTS.flood, DEMO_KEY_EVENTS.levy].includes(item.id)) continue;
    for (const choice of item.choices) for (const effect of effectsOf(choice)) {
      if (effect.type === "job" && effect.job) assert.notEqual(availability(world.demo, "job", effect.job).status, "unavailable");
    }
  }
});

test("the flood decision fires once per low-flood episode", () => {
  const engine = demoEngine();
  let checked = 0;
  for (let i = 0; i < 6; i++) {
    const life = liveUntil(engine, `flood-episode-${i}`, () => false, 4_000);
    const fired = life.journal.filter(entry => entry.type === "event" && entry.id === DEMO_KEY_EVENTS.flood).map(entry => entry.age);
    const starts = life.demo!.schedule.flood.map(episode => episode.startAge);
    for (const age of fired) assert.ok(starts.includes(age), `fired at ${age}, not an episode start`);
    assert.equal(new Set(fired).size, fired.length, "fired twice in one episode");
    for (const start of starts.filter(age => age + 2 < life.age)) { assert.ok(fired.includes(start), `missed the episode at ${start}`); checked++; }
  }
  assert.ok(checked > 0, "no low-flood episode was lived through");
});

test("Unavailable and Locked stay distinct", () => {
  const engine = demoEngine();
  const young = engine.start("lock-young");
  const adult = withDemo(young, () => {});
  adult.age = 20;
  adult.phase = "ready";
  adult.pendingEventId = null;
  adult.economy!.cash = 100;
  adult.character!.skills.warfare = 0;
  adult.character!.skills.craft = 0;
  assert.deepEqual(availabilityWithLock(world, adult, "job", "general"), { status: "unavailable", reason: UNAVAILABLE_REASON });
  const soldier = availabilityWithLock(world, adult, "job", "soldier");
  assert.equal(soldier.status, "locked");
  assert.ok(soldier.status === "locked" && /Warfare 10/.test(soldier.reason) && soldier.reason !== UNAVAILABLE_REASON);
  assert.match((availabilityWithLock(world, young, "job", "soldier") as { reason: string }).reason, /age 18/);
  adult.character!.skills.warfare = 12;
  assert.deepEqual(availabilityWithLock(world, adult, "job", "soldier"), { status: "playable" });
  // Skills: learning stays playable; deferred careers are Unavailable; prerequisites lock.
  for (const skill of ["literacy", "reckoning", "farming"]) assert.deepEqual(availabilityWithLock(world, adult, "skill", skill), { status: "playable" });
  for (const skill of ["philosophy", "astronomy", "sculpture", "seamanship"]) assert.equal(availabilityWithLock(world, adult, "skill", skill).status, "unavailable");
  const oratory = availabilityWithLock(world, adult, "skill", "oratory");
  assert.ok(oratory.status === "locked" && /Literacy 10/.test(oratory.reason));
  // Activities and accomplishments.
  assert.equal(availabilityWithLock(world, adult, "activity", "train-philosophy").status, "unavailable");
    assert.equal(availabilityWithLock(world, adult, "activity", "train-literacy").status, "playable");
  const sculpture = world.legacy!.achievements.find(item => item.routeId === "sculpture")!;
  assert.equal(availabilityWithLock(world, adult, "accomplishment", sculpture.id).status, "unavailable");
  // Old worlds never report Unavailable.
  const oldLife = { ...structuredClone(adult), demo: undefined } as LifeState;
  assert.equal(availabilityWithLock(ranked, oldLife, "job", "general").status, "locked");
  assert.equal(availabilityWithLock(ranked, oldLife, "skill", "philosophy").status, "locked");
});

test("future paths and unavailable lists are complete and plain", () => {
  const paths = world.demo!.availability.futurePaths.map(path => path.id);
  for (const id of ["raising-children", "house", "crafts", "scholarship", "generalship"]) assert.ok(paths.includes(id), id);
  assert.deepEqual(world.demo!.availability.playableJobs, ["farmhand", "tenant-farmer", "grain-dealer", "soldier"]);
  for (const id of ["porter", "clerk", "potter", "sailor", "shopkeeper", "officer", "general"]) assert.ok(world.demo!.availability.unavailableJobs.includes(id), id);
});
