import assert from "node:assert/strict";
import test from "node:test";
import { scaleCropQuantity } from "../src/demo/resource-scale.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };

test("bulk crop scaling is opt-in and retains positive whole seed inputs", () => {
  for (const value of [0, 1, 2, 10, 20, 240, 500]) assert.equal(scaleCropQuantity(undefined, value), value);
  assert.equal(scaleCropQuantity({ resourceScaleDivisor: 10 }, 650), 65);
  assert.equal(scaleCropQuantity({ resourceScaleDivisor: 10 }, 2), 1);
  assert.equal(scaleCropQuantity({ resourceScaleDivisor: 10 }, 0), 0);
  assert.equal(scaleCropQuantity({ resourceScaleDivisor: 10 }, -100), -10);
});

test("crop scale divisors are bounded positive whole opt-in values", () => {
  const world = structuredClone(retained) as unknown as WorldPack;
  world.demo!.resourceScaleDivisor = 10;
  validateWorld(world);
  for (const divisor of [0, -1, 1.5, 101, Number.NaN]) {
    world.demo!.resourceScaleDivisor = divisor;
    assert.throws(() => validateWorld(world), /resourceScaleDivisor/);
  }
  delete world.demo!.resourceScaleDivisor;
  validateWorld(world);
});
