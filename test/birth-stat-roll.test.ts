import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { getNetWorth } from "../src/economy.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.5.1.json" with { type: "json" };
import { BIRTH_ORIGIN_REVEAL_MS, BIRTH_ROLL_DURATION_MS, getBirthRollFrame, getBirthRollStats, getCosmeticBirthValue } from "../client/birth-stat-roll.ts";

test("the origin is revealed before the starting stats settle in order", () => {
  assert.equal(getBirthRollFrame(0, 4).originRevealed, false);
  assert.deepEqual(getBirthRollFrame(0, 4).phases, ["waiting", "waiting", "waiting", "waiting"]);
  assert.equal(getBirthRollFrame(BIRTH_ORIGIN_REVEAL_MS, 4).originRevealed, true);
  assert.equal(getBirthRollFrame(BIRTH_ORIGIN_REVEAL_MS, 4).phases[0], "rolling");
  assert.deepEqual(getBirthRollFrame(1_500, 4).phases, ["settled", "rolling", "rolling", "rolling"]);
  assert.deepEqual(getBirthRollFrame(2_100, 4).phases, ["settled", "settled", "rolling", "rolling"]);
  assert.equal(getBirthRollFrame(BIRTH_ROLL_DURATION_MS - 1, 4).complete, false);
  assert.deepEqual(getBirthRollFrame(BIRTH_ROLL_DURATION_MS, 4).phases, ["settled", "settled", "settled", "settled"]);
});

test("any stat count completes within the same short reveal without losing cards", () => {
  for (const count of [0, 1, 2, 4, 12, 128]) {
    const frame = getBirthRollFrame(BIRTH_ROLL_DURATION_MS, count);
    assert.equal(frame.complete, true);
    assert.equal(frame.phases.length, count);
    assert.ok(frame.phases.every(phase => phase === "settled"));
  }
});

test("cosmetic values stay within each selected origin range and are reproducible", () => {
  const engine = createEngine(pack);
  const life = engine.start("birth-display-ranges");
  const stats = getBirthRollStats(engine.world, life);
  const origin = engine.world.origins.find(item => item.id === life.originId)!;
  for (const stat of stats) {
    const sourceRange = origin.statRanges![stat.id];
    const scale = engine.world.economy?.stat === stat.id ? engine.world.economy.unitsPerPoint : 1;
    assert.deepEqual(stat.range, { min: sourceRange.min * scale, max: sourceRange.max * scale });
    if (scale !== 1) assert.equal(stat.currency, engine.world.economy!.currency.short);
    const seen = new Set<number>();
    for (let frame = 0; frame < 100; frame++) {
      const value = getCosmeticBirthValue(stat, life.seed, frame);
      assert.equal(value, getCosmeticBirthValue(stat, life.seed, frame));
      assert.ok(Number.isInteger(value) && value >= stat.range!.min && value <= stat.range!.max);
      seen.add(value);
    }
    assert.ok(seen.size > 1, stat.id);
  }
});

test("the display model keeps exact final values without changing the life or RNG", () => {
  const engine = createEngine(pack);
  const life = engine.start("birth-presentation-only");
  const before = engine.save(life);
  const rng = life.rngState;
  const stats = getBirthRollStats(engine.world, life);
  for (const stat of stats) {
    assert.equal(stat.value, engine.world.economy?.stat === stat.id ? getNetWorth(engine.world, life) : life.stats[stat.id]);
    for (let frame = 0; frame < 60; frame++) getCosmeticBirthValue(stat, life.seed, frame);
  }
  assert.equal(life.rngState, rng);
  assert.equal(engine.save(life), before);
  assert.equal(life.commands.length, 0);
});

test("legacy fixed starts include origin offsets in their displayed range", () => {
  const engine = createEngine(legacy);
  for (let index = 0; index < 12; index++) {
    const life = engine.start(`legacy-birth-roll-${index}`);
    for (const stat of getBirthRollStats(engine.world, life)) {
      assert.deepEqual(stat.range, { min: stat.value, max: stat.value });
      assert.equal(getCosmeticBirthValue(stat, life.seed, 30), stat.value);
    }
  }
});

test("birth effect clamping is reflected without mutating the pack ranges", () => {
  const world = structuredClone(pack) as WorldPack;
  world.origins = [world.origins[0]];
  world.events = world.events.filter(event => !event.id.startsWith("background-"));
  world.origins[0].statRanges = { health: { min: 90, max: 99 } };
  world.origins[0].effects = [{ type: "stat", stat: "health", delta: 8 }];
  const engine = createEngine(world);
  const life = engine.start("clamped-birth-roll");
  const health = getBirthRollStats(engine.world, life).find(stat => stat.id === "health")!;
  assert.deepEqual(health.range, { min: 98, max: 100 });
  assert.deepEqual(world.origins[0].statRanges.health, { min: 90, max: 99 });
});

test("later progression does not receive a misleading birth range", () => {
  const engine = createEngine(pack);
  const born = engine.start("later-birth-range");
  const life = engine.advance(born);
  assert.ok(getBirthRollStats(engine.world, life).every(stat => stat.range === undefined));
});

test("cosmetic arithmetic remains bounded for safe integer endpoints and fixed decimal starts", () => {
  const wide = { id: "wide", label: "Wide", value: 0, range: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } };
  for (let frame = 0; frame < 20; frame++) {
    const value = getCosmeticBirthValue(wide, "safe-wide", frame);
    assert.ok(Number.isSafeInteger(value) && value >= wide.range.min && value <= wide.range.max);
  }
  assert.equal(getCosmeticBirthValue({ id: "decimal", label: "Decimal", value: 70.5, range: { min: 70.5, max: 70.5 } }, "fixed", 5), 70.5);
});
