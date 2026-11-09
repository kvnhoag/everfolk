import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import pack from "../worlds/alexandria-sample.json" with {type:"json"};

test("retention rules require a separate real stat and bounded loss amounts", () => {
  for (const stat of ["missing", "health", "wealth"]) {
    const world = structuredClone(pack);
    world.knowledge.stat = stat;
    assert.throws(() => validateWorld(world), /world.knowledge.stat/);
  }
  for (const idleLoss of [-1, 101, Infinity]) {
    const world = structuredClone(pack);
    world.knowledge.idleLoss = idleLoss;
    assert.throws(() => validateWorld(world), /world.knowledge.idleLoss/);
  }
});

test("retention age bands must cover the whole life without gaps or invalid loss", () => {
  const gap = structuredClone(pack);
  gap.knowledge.ageBands[1].minAge++;
  assert.throws(() => validateWorld(gap), /ordered and contiguous/);
  const short = structuredClone(pack);
  short.knowledge.ageBands.at(-1)!.maxAge--;
  assert.throws(() => validateWorld(short), /cover every age/);
  const gain = structuredClone(pack);
  gain.knowledge.ageBands[1].loss = -1;
  assert.throws(() => validateWorld(gain), /loss must be within/);
});

test("retention age and grace settings require whole nonnegative years", () => {
  for (const field of ["minAge", "idleGraceYears"] as const) {
    for (const value of [-1, 0.5, 101]) {
      const world = structuredClone(pack);
      world.knowledge[field] = value;
      assert.throws(() => validateWorld(world), new RegExp(`world.knowledge.${field}`));
    }
  }
});
