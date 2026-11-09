import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import pack from "../worlds/alexandria-sample.json" with {type:"json"};

test("growth rules reject unordered, missing-baseline and out-of-bounds thresholds", () => {
  for (const curve of [
    [{from:1,multiplier:1}],
    [{from:0,multiplier:1},{from:40,multiplier:0.5},{from:40,multiplier:0.2}],
    [{from:0,multiplier:1},{from:100,multiplier:0.5}],
  ]) {
    const world = structuredClone(pack);
    world.stats.health.gainCurve = curve;
    assert.throws(() => validateWorld(world), /gainCurve.*thresholds/);
  }
});

test("growth multipliers must be finite, positive and diminishing for both stats and skills", () => {
  for (const multiplier of [0, -1, 1.1, Infinity]) {
    const world = structuredClone(pack);
    world.character.skills.literacy.gainCurve[1].multiplier = multiplier;
    assert.throws(() => validateWorld(world), /gainCurve.*multiplier/);
  }
  const increasing = structuredClone(pack);
  increasing.stats.bonds.gainCurve[2].multiplier = 0.8;
  assert.throws(() => validateWorld(increasing), /nonincreasing/);
});

test("currency cannot be discounted by ability progression settings", () => {
  const world = structuredClone(pack);
  Object.assign(world.stats.wealth, {gainCurve:[{from:0,multiplier:0.5}]});
  assert.throws(() => validateWorld(world), /currency-backed wealth must keep exact accounting/);
});

test("removing optional growth rules keeps older pack definitions valid", () => {
  const world = structuredClone(pack);
  for (const definition of [...Object.values(world.stats), ...Object.values(world.character.skills)]) {
    if ("gainCurve" in definition) delete (definition as {gainCurve?:unknown}).gainCurve;
  }
  assert.doesNotThrow(() => validateWorld(world));
});
