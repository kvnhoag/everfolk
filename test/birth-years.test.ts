import { test } from "node:test";
import assert from "node:assert/strict";
import { birthYearOf, createEngine, yearAtAge } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const world = shipped as unknown as WorldPack, old = retained as unknown as WorldPack;
const engine = createEngine(world);
const play = (life: LifeState, until: number): LifeState => {
  for (let guard = 0; life.age < until && life.phase !== "ended" && guard < 900; guard++) life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  return life;
};

test("lives in the new world are born across 350–300 BCE, and the calendar follows the birth year", () => {
  const years = Array.from({ length: 60 }, (_, i) => engine.start(`birth-${i}`).birthYear!);
  assert.ok(years.every(year => year <= -300 && year >= -350), years.join(","));
  assert.ok(new Set(years).size > 20, "births are spread out");
  const life = engine.start("birth-calendar");
  assert.equal(life.year, life.birthYear);
  const later = play(life, 5);
  assert.equal(later.year, yearAtAge(life.birthYear!, later.age));
  assert.equal(birthYearOf(world, later), life.birthYear);
});

test("history that happened before a life was born does not happen to it", () => {
  const ids = (life: LifeState) => new Set(life.journal.map(entry => entry.id));
  const lives = Array.from({ length: 40 }, (_, i) => engine.start(`history-${i}`));
  const late = lives.find(life => life.birthYear! > -331)!, early = lives.find(life => life.birthYear! <= -345)!;
  assert.ok(late && early, "both kinds of birth exist");
  assert.ok(!ids(play(late, 6)).has("classical-alexandria-founded"), `born ${late.birthYear}`);
  assert.ok(ids(play(early, 22)).has("classical-alexandria-founded"), `born ${early.birthYear}`);
});

test("a varied-birth life replays exactly", () => {
  const life = play(engine.start("birth-replay"), 30);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("older worlds are all born in their start year", () => {
  const life = createEngine(old).start("birth-old");
  assert.equal(life.birthYear, undefined);
  assert.equal(life.year, old.startYear);
  assert.equal(birthYearOf(old, life), old.startYear);
});

test("birth-year ranges are validated", () => {
  for (const range of [{ from: -300, to: -350 }, { from: -400, to: -300 }, { from: -350 }]) {
    const bad = structuredClone(world);
    (bad as unknown as Record<string, unknown>).birthYears = range;
    assert.throws(() => validateWorld(bad), /birthYears/, JSON.stringify(range));
  }
});
