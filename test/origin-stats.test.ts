import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "birth-ranges", version: "1.0.0", title: "Birth range tests",
    description: "Fictional test data.", startYear: -66, maxAge: 5,
    stats: {
      health: { label: "Health", min: 0, max: 100, initial: 70 },
      wealth: { label: "Resources", min: 0, max: 100, initial: 5 },
      bonds: { label: "Bonds", min: 0, max: 100, initial: 60 },
    },
    flags: {},
    origins: [{ id: "household", title: "A household", text: "A fictional household.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    endings: [{ id: "complete", title: "Complete", text: "The test life ends." }], defaultEnding: "complete",
  };
}

test("starting ranges are reproducible through start, replay, save and load", () => {
  const world = fixture();
  world.stats.health.initialRange = { min: 55, max: 85 };
  world.origins[0].statRanges = { wealth: { min: 10, max: 20 } };
  const engine = createEngine(world);
  let life = engine.start("range-replay");
  assert.deepEqual(engine.start(life.seed), life);
  for (let i = 0; i < 3; i++) life = engine.advance(life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("different seeds vary each ranged stat within the same origin, including both endpoints", () => {
  const world = fixture();
  world.origins[0].statRanges = { health: { min: 67, max: 69 }, wealth: { min: 5, max: 7 } };
  const engine = createEngine(world);
  const health = new Set<number>();
  const wealth = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const life = engine.start(`range-${i}`);
    assert.equal(life.originId, "household");
    assert.ok(Number.isInteger(life.stats.health) && life.stats.health >= 67 && life.stats.health <= 69);
    assert.ok(Number.isInteger(life.stats.wealth) && life.stats.wealth >= 5 && life.stats.wealth <= 7);
    health.add(life.stats.health);
    wealth.add(life.stats.wealth);
  }
  assert.deepEqual([...health].sort(), [67, 68, 69]);
  assert.deepEqual([...wealth].sort(), [5, 6, 7]);
});

test("origin ranges override world ranges, with partial and fixed fallbacks", () => {
  const world = fixture();
  world.stats.health.initialRange = { min: 1, max: 5 };
  world.stats.wealth.initialRange = { min: 20, max: 25 };
  world.origins[0].statRanges = { health: { min: 80, max: 90 } };
  const engine = createEngine(world);
  for (let i = 0; i < 40; i++) {
    const { stats } = engine.start(`fallback-${i}`);
    assert.ok(stats.health >= 80 && stats.health <= 90);
    assert.ok(stats.wealth >= 20 && stats.wealth <= 25);
    assert.equal(stats.bonds, 60);
  }
});

test("each weighted origin uses its own ranges without changing the origin draw", () => {
  const world = fixture();
  world.origins.push({ id: "another", title: "Another household", text: "Another origin.", weight: 2, effects: [] });
  const legacy = createEngine(world);
  world.origins[0].statRanges = { wealth: { min: 1, max: 3 } };
  world.origins[1].statRanges = { wealth: { min: 80, max: 90 } };
  const randomized = createEngine(world);
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const seed = `origin-${i}`;
    const life = randomized.start(seed);
    assert.equal(life.originId, legacy.start(seed).originId);
    const range = world.origins.find(origin => origin.id === life.originId)!.statRanges!.wealth;
    assert.ok(life.stats.wealth >= range.min && life.stats.wealth <= range.max);
    seen.add(life.originId);
  }
  assert.equal(seen.size, 2);
});

test("unranged legacy stats and fixed ranges consume no new random draws", () => {
  const world = fixture();
  world.origins.push({ id: "another", title: "Another household", text: "Another origin.", weight: 1, effects: [] });
  const seed = "legacy-random-stream";
  const legacy = createEngine(world).start(seed);
  assert.equal(legacy.rngState, nextRandom(seedToUint32(seed)).state);
  assert.deepEqual(legacy.stats, { health: 70, wealth: 5, bonds: 60 });
  world.stats.health.initialRange = { min: 70, max: 70 };
  world.origins.forEach(origin => { origin.statRanges = { wealth: { min: 5, max: 5 } }; });
  const fixed = createEngine(world).start(seed);
  assert.equal(fixed.rngState, legacy.rngState);
  assert.equal(fixed.originId, legacy.originId);
  assert.deepEqual(fixed.stats, legacy.stats);
});

test("birth effects apply after starting ranges and before birth events", () => {
  const world = fixture();
  world.origins[0].statRanges = { health: { min: 90, max: 90 } };
  world.origins[0].effects = [{ type: "stat", stat: "health", delta: 15 }];
  world.events = [{ id: "birth-event", title: "Birth", text: "An event.", mode: "automatic", trigger: { type: "age", at: 0 },
    effects: [{ type: "stat", stat: "health", delta: -2 }], choices: [] }];
  assert.equal(createEngine(world).start("effect-order").stats.health, 98);
});

test("ranges support negative values and the full safe-integer interval without unsafe arithmetic", () => {
  const world = fixture();
  world.stats.health = { label: "Wide test", min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER,
    initial: 0, initialRange: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } };
  world.stats.wealth = { label: "Negative test", min: -10, max: 10, initial: 0, initialRange: { min: -5, max: -1 } };
  const engine = createEngine(world);
  const seen = new Set<number>();
  for (let i = 0; i < 50; i++) {
    const { stats } = engine.start(`wide-${i}`);
    assert.ok(Number.isSafeInteger(stats.health));
    assert.ok(stats.health >= Number.MIN_SAFE_INTEGER && stats.health <= Number.MAX_SAFE_INTEGER);
    assert.ok(Number.isInteger(stats.wealth) && stats.wealth >= -5 && stats.wealth <= -1);
    seen.add(stats.health);
  }
  assert.ok(seen.size > 1);
});

test("validation permits empty origin overrides while retaining fixed legacy definitions", () => {
  const world = fixture();
  world.origins[0].statRanges = {};
  assert.doesNotThrow(() => validateWorld(world));
  assert.deepEqual(createEngine(world).start("empty-override").stats, { health: 70, wealth: 5, bonds: 60 });
});

for (const target of ["world", "origin"] as const) {
  for (const [name, range, expected] of [
    ["reversed", { min: 8, max: 2 }, /minimum must not exceed maximum/],
    ["below bounds", { min: -1, max: 20 }, /within stat bounds/],
    ["above bounds", { min: 1, max: 101 }, /within stat bounds/],
    ["fractional", { min: 1.5, max: 20 }, /safe integer/],
    ["nonfinite", { min: 0, max: Infinity }, /finite number/],
    ["unsafe integer", { min: 0, max: Number.MAX_SAFE_INTEGER + 1 }, /safe integer/],
    ["missing endpoint", { min: 0 }, /required field is missing/],
    ["unknown field", { min: 0, max: 10, initial: 5 }, /unknown field/],
    ["null", null, /plain JSON object/],
  ] as const) {
    test(`validation rejects ${name} ${target} starting ranges`, () => {
      const world: any = fixture();
      if (target === "world") world.stats.health.initialRange = range;
      else world.origins[0].statRanges = { health: range };
      assert.throws(() => validateWorld(world), expected);
    });
  }
}

test("validation rejects unknown origin stats and malformed range maps", () => {
  const world: any = fixture();
  world.origins[0].statRanges = { missing: { min: 0, max: 1 } };
  assert.throws(() => validateWorld(world), /unknown stat 'missing'/);
  world.origins[0].statRanges = [];
  assert.throws(() => validateWorld(world), /statRanges: expected a plain JSON object/);
});

test("validation rejects unused starting ranges on character skills", () => {
  const world: any = fixture();
  world.character = {
    skills: { pottery: { label: "Pottery", min: 0, max: 100, initial: 0, initialRange: { min: 0, max: 5 } } },
    jobs: [], partners: [], activities: [], childNames: ["Test child"],
    deathCauses: [{ id: "illness", title: "An illness", text: "A fictional cause.", weight: 1 }],
    deathCauseDescription: "Fictional test outcomes.",
  };
  assert.throws(() => validateWorld(world), /world\.character\.skills\.pottery\.initialRange: unknown field/);
});
