import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { householdView } from "../src/demo/household.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/demo/alexandria-lives-9-wsl-resources.json" with { type: "json" };

const fixture = () => structuredClone(current) as unknown as WorldPack;

test("origin-specific birth storage changes capacity without rerolling household resources or random streams", () => {
  const baseline = createEngine(fixture()), world = fixture();
  world.demo!.startingResources!.storeCapacityByOrigin = { "estate-household": 1500, "royal-household": 1500 };
  const engine = createEngine(world), missing = new Set(world.origins.map(origin => origin.id));
  for (let index = 0; index < 192 && missing.size; index++) {
    const born = engine.start(`birth-storage-${index}`), original = baseline.start(`birth-storage-${index}`);
    missing.delete(born.originId);
    const expected = world.demo!.startingResources!.storeCapacityByOrigin[born.originId] ?? world.demo!.household.storeCapacity;
    assert.equal(born.demo!.household.capacity, expected);
    assert.equal(born.originId, original.originId);
    assert.equal(born.rngState, original.rngState);
    assert.equal(born.demo!.rng, original.demo!.rng);
    assert.deepEqual(born.demo!.household, { ...original.demo!.household, capacity: expected });
    assert.deepEqual(born.demo!.schedule, original.demo!.schedule);
    assert.deepEqual(born.demo!.goods, original.demo!.goods);
    assert.deepEqual(engine.load(engine.save(born)), born);
  }
  assert.equal(missing.size, 0);
});

test("larger birth storage protects privileged reserves from over-capacity spoilage and survives settlement", () => {
  const world = fixture();
  const resources = world.demo!.startingResources!;
  resources.storeCapacityByOrigin = { "estate-household": 1500 };
  resources.origins!["estate-household"]!.grain = { min: 1000, max: 1000 };
  const engine = createEngine(world);
  let born: LifeState | undefined;
  for (let index = 0; index < 128; index++) {
    const life = engine.start(`estate-storage-${index}`);
    if (life.originId === "estate-household") { born = life; break; }
  }
  assert.ok(born);
  const small = structuredClone(born); small.demo!.household.capacity = world.demo!.household.storeCapacity;
  const protectedView = householdView(world.demo!, born as Parameters<typeof householdView>[1]);
  const smallView = householdView(world.demo!, small as Parameters<typeof householdView>[1]);
  assert.equal(protectedView.capacity, 1500);
  assert.ok(protectedView.expectedSpoilage < smallView.expectedSpoilage);
  const next = engine.advance(born);
  assert.equal(next.demo!.household.capacity, 1500);
  assert.deepEqual(engine.load(engine.save(next)), next);
});

test("zero storage is explicit and absent origin overrides keep the authored default", () => {
  const world = fixture();
  world.demo!.startingResources!.storeCapacityByOrigin = Object.fromEntries(world.origins.map(origin => [origin.id, 0]));
  const engine = createEngine(world), life = engine.start("zero-origin-storage");
  assert.equal(life.demo!.household.capacity, 0);
  delete world.demo!.startingResources!.storeCapacityByOrigin;
  assert.equal(createEngine(world).start("zero-origin-storage").demo!.household.capacity, world.demo!.household.storeCapacity);
});

test("birth storage validation accepts safe inclusive bounds and rejects invalid capacities or origins", () => {
  for (const capacity of [0, 1500, 1_000_000_000_000]) {
    const world = fixture();
    world.demo!.startingResources!.storeCapacityByOrigin = { "estate-household": capacity };
    validateWorld(world);
  }
  for (const capacities of [
    { "unknown-household": 1500 },
    { "estate-household": -1 },
    { "estate-household": 1.5 },
    { "estate-household": 1_000_000_000_001 },
    { "estate-household": Number.NaN },
    { "estate-household": Infinity },
  ]) {
    const world = fixture();
    world.demo!.startingResources!.storeCapacityByOrigin = capacities;
    assert.throws(() => validateWorld(world), /storeCapacityByOrigin/);
  }
});
