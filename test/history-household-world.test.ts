import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { BIRTH_YEAR_RANGE } from "../src/vocations/birth-years.ts";
import { LIVES_HOUSEHOLD_WORLD_VERSION, LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import { buildHistoryHouseholdWorld } from "../src/vocations/history-household-world.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import lives10 from "../worlds/demo/alexandria-lives-10.json" with { type: "json" };
import lives11 from "../worlds/demo/alexandria-lives-11.json" with { type: "json" };

const household = lives10 as unknown as WorldPack, current = lives11 as unknown as WorldPack;

test("new births use the household-resource world, born across 400–300 BCE where history happens", () => {
  assert.equal(LIVES_WORLD_VERSION, "alexandria-lives-11");
  assert.equal(LIVES_HOUSEHOLD_WORLD_VERSION, "alexandria-lives-10");
  assert.equal(current.version, LIVES_WORLD_VERSION);
  assert.deepEqual({ from: current.birthYears?.from, to: current.birthYears?.to }, BIRTH_YEAR_RANGE);
  assert.equal(current.startYear, -400);
  assert.equal(current.birthYears?.weights?.length, 101);
  validateWorld(current);
});

test("lives-11 is exactly lives-10 with the history birth years, so household reserves are unchanged", () => {
  const rebuilt = buildHistoryHouseholdWorld(household);
  assert.deepEqual(rebuilt, current, "the committed pack matches its builder");
  assert.deepEqual(current.demo, household.demo, "starting resources and storage stay as lives-10 set them");
  assert.deepEqual(current.figurePaths, household.figurePaths);
  assert.equal(household.birthYears?.from, -350, "lives-10 itself is not changed");
});

test("births in lives-11 fall between 400 and 300 BCE and lives-10 saves still load lives-10", async () => {
  const engine = createEngine(current);
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const year = engine.start(seed).birthYear;
    assert.ok(year >= -400 && year <= -300, `${seed}: ${year}`);
  }
  assert.equal((await loadLifeWorld(LIVES_WORLD_VERSION)).version, "alexandria-lives-11");
  assert.equal((await loadLifeWorld("alexandria-lives-10")).version, "alexandria-lives-10");
});
