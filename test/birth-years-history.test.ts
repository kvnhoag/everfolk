import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine, yearAtAge } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { BIRTH_YEAR_RANGE, historyBirthWeights, withHistoryBirthYears } from "../src/vocations/birth-years.ts";
import { LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import lives8 from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import lives9 from "../worlds/demo/alexandria-lives-9.json" with { type: "json" };

const before = lives8 as unknown as WorldPack, current = lives9 as unknown as WorldPack;
const span = (from: number, to: number) => (to < 0 ? to + 1 : to) - (from < 0 ? from + 1 : from) + 1;
const datedHistory = (world: WorldPack) => world.events.filter(event => event.trigger.type === "year" && event.trigger.at !== world.startYear);

test("new births run from 400 to 300 BCE, and the world starts in 400 BCE", () => {
  assert.equal(current.version, LIVES_WORLD_VERSION);
  assert.deepEqual(BIRTH_YEAR_RANGE, { from: -400, to: -300 });
  assert.equal(current.startYear, -400);
  assert.equal(current.birthYears?.from, -400);
  assert.equal(current.birthYears?.to, -300);
  assert.equal(current.birthYears?.weights?.length, span(-400, -300));
  validateWorld(current);
});

test("events open from the world's start move with it; dated history keeps its year", () => {
  const moved = withHistoryBirthYears(before, BIRTH_YEAR_RANGE);
  const anchors = before.events.filter(event => event.trigger.type === "year" && event.trigger.at === before.startYear).map(event => event.id);
  assert.ok(anchors.length > 50);
  for (const id of anchors) assert.deepEqual(moved.events.find(event => event.id === id)!.trigger, { type: "year", at: -400 }, id);
  assert.deepEqual(datedHistory(moved).map(event => [event.id, event.trigger]), datedHistory(before).map(event => [event.id, event.trigger]));
  assert.doesNotMatch(JSON.stringify(moved.character), /"op":"gte","value":-350/, "rules open from the start (astrology) open from 400 BCE");
  assert.equal(before.startYear, -350, "the source world is not changed");
});

test("births lean toward the years whose lives see the most history", () => {
  const weights = historyBirthWeights(before, BIRTH_YEAR_RANGE);
  const weightOf = (year: number) => weights[span(-400, year) - 1];
  assert.ok(weights.every(weight => Number.isInteger(weight) && weight >= 1), "every year stays possible");
  assert.ok(weightOf(-350) > 3 * weightOf(-400), `${weightOf(-350)} vs ${weightOf(-400)}`);
  assert.ok(weightOf(-350) > 3 * weightOf(-300), `${weightOf(-350)} vs ${weightOf(-300)}`);
  const peak = weights.indexOf(Math.max(...weights));
  assert.ok(yearAtAge(-400, peak) >= -360 && yearAtAge(-400, peak) <= -335, `peak at ${yearAtAge(-400, peak)}`);
});

test("rolled births follow the weights, stay in range and replay exactly", () => {
  const engine = createEngine(current);
  const years = Array.from({ length: 400 }, (_, i) => engine.start(`born-${i}`).birthYear!);
  assert.ok(years.every(year => year >= -400 && year <= -300), "all births in range");
  const middle = years.filter(year => year >= -360 && year <= -330).length;
  const edges = years.filter(year => year <= -390 || year >= -310).length;
  assert.ok(middle > 2 * edges, `middle ${middle}, edges ${edges}`);
  assert.ok(years.some(year => year < -380) && years.some(year => year > -320), "both ends still happen");
  const life = engine.start("born-replay");
  assert.equal(life.year, life.birthYear);
  assert.deepEqual(engine.start("born-replay"), life);
});

test("a life born before 350 BCE still meets the everyday events", () => {
  const engine = createEngine(current);
  const early = Array.from({ length: 300 }, (_, i) => engine.start(`early-${i}`)).find(life => life.birthYear! <= -385)!;
  assert.ok(early, "an early birth exists");
  let life = early;
  for (let guard = 0; life.age < 30 && life.phase !== "ended" && guard < 900; guard++) life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.ok(life.journal.filter(entry => entry.type === "event").length > 5, "events reach a life born in the 390s");
});

test("birth weights are validated", () => {
  for (const weights of [[1, 2], Array(101).fill(0), Array(101).fill(-1), Array(101).fill(1.5)]) {
    const bad = structuredClone(current);
    bad.birthYears = { from: -400, to: -300, weights };
    assert.throws(() => validateWorld(bad), /birthYears/, JSON.stringify(weights.slice(0, 3)));
  }
});
