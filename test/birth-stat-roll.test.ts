import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { getNetWorth } from "../src/economy.ts";
import { marketQuote } from "../src/market.ts";
import { pruneRemovedOriginActivities } from "./fixture-features.ts";
import type { Condition, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.5.1.json" with { type: "json" };
import { BIRTH_ORIGIN_REVEAL_MS, BIRTH_ROLL_DURATION_MS, getBirthRollFrame, getBirthRollStats, getCosmeticBirthValue } from "../client/models/birth-stat-roll.ts";

/** Synthetic one-origin fixtures must also prune conditional odds for removed households. */
function pruneRemovedOriginModifiers(world: WorldPack): void {
  const retained = new Set(world.origins.map(origin => origin.id));
  const hasRemovedOrigin = (condition: Condition | undefined): boolean => {
    if (!condition) return false;
    if (condition.type === "origin") return !retained.has(condition.origin);
    if (condition.type === "all" || condition.type === "any") return condition.conditions.some(hasRemovedOrigin);
    return condition.type === "not" && hasRemovedOrigin(condition.condition);
  };
  world.events = world.events.filter(event => !hasRemovedOrigin(event.when));
  for (const choice of [...world.events.flatMap(event => event.choices), ...(world.character?.activities ?? [])]) {
    for (const outcome of choice.outcomes) {
      if (!outcome.weightModifiers) continue;
      outcome.weightModifiers = outcome.weightModifiers.filter(modifier => !hasRemovedOrigin(modifier.when));
      if (!outcome.weightModifiers.length) delete outcome.weightModifiers;
    }
  }
}

test("the origin is revealed before the starting stats settle in order", () => {
  assert.equal(getBirthRollFrame(0, 4).originRevealed, false);
  assert.deepEqual(getBirthRollFrame(0, 4).phases, ["rolling", "rolling", "rolling", "rolling"]);
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
    const resourceRanges = scale === 1 ? [] : engine.world.economy!.assets.map(asset => ({ asset, range: origin.assetRanges?.[asset.id] ?? asset.initialRange ?? { min: 0, max: 0 } }));
    assert.deepEqual(stat.range, {
      min: sourceRange.min * scale + resourceRanges.reduce((sum, { asset, range }) => sum + range.min * marketQuote(engine.world, life, asset.id).sell, 0),
      max: sourceRange.max * scale + resourceRanges.reduce((sum, { asset, range }) => sum + range.max * marketQuote(engine.world, life, asset.id).sell, 0),
    });
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
  pruneRemovedOriginModifiers(world);
  pruneRemovedOriginActivities(world);
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

test("the starting wealth range is shown in whole drachmas in the current free-play world", async () => {
  const { default: lives5 } = await import("../worlds/demo/alexandria-lives-6.json", { with: { type: "json" } });
  const engine = createEngine(lives5 as unknown as WorldPack);
  for (const seed of ["round-a", "round-b", "round-c", "round-d", "round-e"]) {
    const wealth = getBirthRollStats(engine.world, engine.start(seed)).find(stat => stat.id === engine.world.economy?.stat);
    if (!wealth?.range) continue;
    assert.ok(Number.isInteger(wealth.range.min) && Number.isInteger(wealth.range.max), `${seed}: ${wealth.range.min} - ${wealth.range.max}`);
  }
});
