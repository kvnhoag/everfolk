import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { getAssetValue, getNetWorth } from "../src/economy.ts";
import { marketQuote } from "../src/market.ts";
import { contentFingerprint } from "../src/random.ts";
import type { WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.34.0.json" with { type: "json" };
import generousResources from "../worlds/alexandria-0.35.0.json" with { type: "json" };
import leanResources from "../worlds/alexandria-0.36.0.json" with { type: "json" };

const world = current as WorldPack;
const rangeFor = (pack: WorldPack, origin: WorldPack["origins"][number], id: string) => origin.assetRanges?.[id] ?? pack.economy!.assets.find(asset => asset.id === id)?.initialRange ?? { min: 0, max: 0 };
const legacyAssetIds = new Set(["tool-chest", "workshop-share"]);

test("new households roll resources within authored origin ranges and wealth counts their market value", () => {
  validateWorld(world);
  assert.equal(world.economy!.uncappedResources, true);
  const engine = createEngine(world);
  const quantities = new Map(world.economy!.assets.map(asset => [asset.id, new Set<number>()]));
  const origins = new Set<string>();
  for (let index = 0; index < 2048 && (index < 128 || origins.size < world.origins.length); index++) {
    const life = engine.start(`household-resources-${index}`);
    const origin = world.origins.find(origin => origin.id === life.originId)!;
    origins.add(origin.id);
    for (const asset of world.economy!.assets) {
      const range = rangeFor(world, origin, asset.id);
      const quantity = life.economy!.assets[asset.id];
      assert.ok(Number.isSafeInteger(quantity) && quantity >= range.min && quantity <= range.max);
      quantities.get(asset.id)!.add(quantity);
      assert.equal(asset.maxOwned, undefined);
    }
    const assetValue = world.economy!.assets.reduce((sum, asset) => sum + marketQuote(world, life, asset.id).sell * life.economy!.assets[asset.id], 0);
    assert.equal(getAssetValue(world, life), assetValue);
    assert.equal(getNetWorth(world, life), life.economy!.cash + assetValue);
    assert.equal(life.stats.wealth, getNetWorth(world, life) / world.economy!.unitsPerPoint);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.equal(origins.size, world.origins.length);
  assert.ok([...legacyAssetIds].every(id => quantities.get(id)!.size > 1), "starting quantities still vary across households and rolls");
});

test("resource purchases use cash without a household ownership ceiling", () => {
  if (world.economy!.market) {
    assert.equal(world.economy!.uncappedResources, true);
    assert.ok([...legacyAssetIds].every(id => world.economy!.market!.goods.includes(id)), "working assets remain available through the market");
    return;
  }
  for (const asset of world.economy!.assets) {
    const buy = world.character!.activities.find(activity => activity.id === `buy-${asset.id}`)!;
    assert.deepEqual(buy.when, { type: "cash", op: "gte", value: asset.value });
    const sell = world.character!.activities.find(activity => activity.id === `sell-${asset.id}`)!;
    assert.deepEqual(sell.when, { type: "asset", asset: asset.id, op: "gte", value: 1 });
  }
});

test("the previous factory stays registered for begun lives with zero starting possessions", async () => {
  const { getArchivedBuiltinWorld, getBuiltinWorld } = await import("../server/content.ts");
  const { engineForLife } = await import("../client/lib/world-session.ts");
  const engine = createEngine(retained);
  const life = engine.start("retained-resource-free-birth");
  assert.deepEqual(Object.values(life.economy!.assets), [0, 0]);
  assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
  const revisionId = `pack-${contentFingerprint(retained)}`;
  assert.deepEqual(getArchivedBuiltinWorld(revisionId)!.pack, retained);
  assert.equal(getBuiltinWorld().pack.version, world.version);
});

test("starting resources stay modest and reflect household trades and means", () => {
  const household = (id: string) => world.origins.find(origin => origin.id === id)!;
  const maximumValue = (origin: WorldPack["origins"][number]) => world.economy!.assets.filter(asset => legacyAssetIds.has(asset.id)).reduce((sum, asset) => sum + rangeFor(world, origin, asset.id).max * asset.value, 0);
  for (const id of ["delta-newcomers", "domestic-service-household", "clerk-household", "musician-household"]) {
    assert.equal(maximumValue(household(id)), 0, `${id} starts without trade tools or investment holdings`);
  }
  for (const id of ["tenant-farming-household", "artisan-household", "weaver-household", "boatbuilder-household", "fishing-household", "bakery-household"]) {
    assert.ok(household(id).assetRanges!["tool-chest"].min >= 1, `${id} starts with working tools`);
  }
  for (const id of ["merchant-household", "bakery-household", "temple-household"]) {
    assert.deepEqual(household(id).assetRanges!["workshop-share"], { min: 0, max: 1 });
  }
  assert.ok(household("royal-household").assetRanges!["workshop-share"].min > 0);
  assert.ok(household("estate-household").assetRanges!["workshop-share"].min > 0);
  assert.ok(world.economy!.assets.every(asset => asset.initialRange?.max === 0), "no generic resource gift bypasses the background profiles");
  for (const origin of world.origins) {
    const previous = generousResources.origins.find(candidate => candidate.id === origin.id)!;
    let maximumQuantity = 0;
    for (const asset of world.economy!.assets.filter(asset => legacyAssetIds.has(asset.id))) {
      const range = origin.assetRanges![asset.id];
      assert.ok(range.max <= previous.assetRanges[asset.id as "tool-chest" | "workshop-share"].max, `${origin.id}: ${asset.id} must not increase`);
      maximumQuantity += range.max;
    }
    assert.ok(maximumQuantity <= 3, `${origin.id} has a modest starting inventory`);
  }
  const averageValue = (pack: WorldPack) => pack.origins.reduce((sum, origin) => sum + origin.weight * pack.economy!.assets.reduce((value, asset) => {
    const range = rangeFor(pack, origin, asset.id);
    return value + (range.min + range.max) / 2 * asset.value;
  }, 0), 0) / pack.origins.reduce((sum, origin) => sum + origin.weight, 0);
  assert.ok(averageValue(world) < averageValue(generousResources as WorldPack) * 0.4, "average starting resource value is cut by at least 60%");
});

test("ordinary farm and craft households have spendable reserves and working tools below wealthy households", () => {
  const ordinary = new Set(["tenant-farming-household", "artisan-household", "weaver-household", "boatbuilder-household", "fishing-household", "bakery-household"]);
  const minimumWorth = (id: string) => {
    const origin = world.origins.find(candidate => candidate.id === id)!;
    return origin.statRanges!.wealth.min * world.economy!.unitsPerPoint + world.economy!.assets.reduce((sum, asset) => sum + rangeFor(world, origin, asset.id).min * asset.value, 0);
  };
  const wealthyFloor = Math.min(minimumWorth("estate-household"), minimumWorth("royal-household"));
  for (const origin of world.origins.filter(origin => ordinary.has(origin.id))) {
    const cash = origin.statRanges!.wealth;
    assert.ok(cash.min * world.economy!.unitsPerPoint >= 40, `${origin.id} has a usable cash cushion`);
    assert.ok(cash.max * world.economy!.unitsPerPoint <= 140, `${origin.id} keeps a moderate cash reserve`);
    assert.ok(origin.assetRanges!["tool-chest"].min >= 1);
    const maximumWorth = cash.max * world.economy!.unitsPerPoint + world.economy!.assets.reduce((sum, asset) => sum + rangeFor(world, origin, asset.id).max * asset.value, 0);
    assert.ok(maximumWorth < wealthyFloor, `${origin.id} remains below the wealthy household tier`);
  }
  const engine = createEngine(world);
  for (let index = 0; index < 2048 && ordinary.size; index++) {
    const life = engine.start(`working-household-reserve-${index}`);
    if (!ordinary.has(life.originId)) continue;
    assert.ok(life.economy!.cash >= 40 && life.economy!.cash <= 140);
    assert.ok(life.economy!.assets["tool-chest"] >= 1);
    assert.ok(getNetWorth(world, life) < wealthyFloor);
    assert.deepEqual(engine.load(engine.save(life)), life);
    ordinary.delete(life.originId);
  }
  assert.equal(ordinary.size, 0, "all ordinary household profiles were exercised");
});

test("the earlier resource rolls remain replayable under their exact archived revision", async () => {
  const { getArchivedBuiltinWorld } = await import("../server/content.ts");
  const { engineForLife } = await import("../client/lib/world-session.ts");
  const engine = createEngine(generousResources);
  const born = engine.start("resource-qa-4");
  assert.deepEqual(born.economy!.assets, { "tool-chest": 3, "workshop-share": 7 });
  const progressed = engine.advance(born);
  assert.deepEqual(engineForLife(progressed).load(engine.save(progressed)), progressed);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, generousResources);
});

test("the lean resource revision keeps its original farm reserves when replayed", async () => {
  const { getArchivedBuiltinWorld } = await import("../server/content.ts");
  const { engineForLife } = await import("../client/lib/world-session.ts");
  const engine = createEngine(leanResources);
  const originalFarmer = engine.world.origins.find(origin => origin.id === "tenant-farming-household")!;
  assert.deepEqual(originalFarmer.statRanges!.wealth, { min: 0, max: 7 });
  assert.deepEqual(originalFarmer.assetRanges!["tool-chest"], { min: 0, max: 0 });
  const life = engine.advance(engine.start("lean-household-reserves-archive"));
  assert.deepEqual(engineForLife(life).load(engine.save(life)), life);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, leanResources);
});
