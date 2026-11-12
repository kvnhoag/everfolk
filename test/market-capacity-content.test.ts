import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createEngine, validateWorld } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import capacityRelease from "../worlds/alexandria-0.41.0.json" with { type: "json" };
import retained from "../worlds/alexandria-0.40.0.json" with { type: "json" };

const world = capacityRelease as WorldPack;

test("annual order capacity is small and shared across buying and selling", () => {
  validateWorld(world);
  assert.deepEqual(current.economy.market.orderLimits, world.economy!.market!.orderLimits, "Later family releases retain the market allowance.");
  const market = world.economy!.market!;
  assert.deepEqual(market.orderLimits, {
    household: { perOrder: 50, perYear: 100 },
    professional: { perOrder: 100, perYear: 300 },
  });
  assert.equal(market.maxQuantity, 100);
  assert.equal(market.maxOrders, 8);
  assert.match(world.economy!.description, /Purchases and sales share the annual allowance/);
});

test("household limits accommodate each material livelihood at its maximum annual production", () => {
  const limits = world.economy!.market!.orderLimits!.household;
  for (const job of world.character!.jobs) {
    const recipe = job.production;
    if (!recipe) continue;
    const annualInputs = Object.values(recipe.inputs).reduce((sum, amount) => sum + amount * recipe.maxBatches, 0);
    const annualOutputs = Object.values(recipe.outputs).reduce((sum, amount) => sum + amount * recipe.maxBatches, 0);
    assert.ok(annualInputs + annualOutputs <= limits.perYear, `${job.id} can restock and sell one maximum year's production`);
    for (const amount of [...Object.values(recipe.inputs), ...Object.values(recipe.outputs)]) {
      assert.ok(amount * recipe.maxBatches <= limits.perOrder, `${job.id} can order its largest input or output batch`);
    }
  }
});

test("the professional allowance belongs to the established five purchasing and resale roles", () => {
  const professional = world.character!.jobs.filter(job => job.marketAccess === "full").map(job => job.id).sort();
  assert.deepEqual(professional, ["estate-steward", "merchant", "quartermaster", "shopkeeper", "trader"]);
  assert.ok(world.economy!.market!.orderLimits!.professional.perYear > world.economy!.market!.orderLimits!.household.perYear);
});

test("order caps leave existing possessions, starting holdings and production recipes unchanged", () => {
  assert.deepEqual(world.economy!.assets, retained.economy.assets);
  assert.deepEqual(world.origins, retained.origins);
  assert.deepEqual(world.character!.jobs, retained.character.jobs);
  assert.deepEqual(world.events, retained.events);
  assert.equal(world.economy!.uncappedResources, retained.economy.uncappedResources);
});

test("the earlier market-role revision remains exact and registered for replay", async () => {
  const archivedText = readFileSync(new URL("../worlds/alexandria-0.40.0.json", import.meta.url));
  assert.equal(createHash("sha256").update(archivedText).digest("hex"), "117f6a9b503d9140acec5194661e1539a004806090bbb87f924065c7bbb31978");
  assert.equal(retained.version, "0.40.0");
  assert.equal(retained.economy.market.maxQuantity, 10000);
  assert.equal(Object.hasOwn(retained.economy.market, "orderLimits"), false);
  const engine = createEngine(retained), life = engine.start("retained-market-capacity");
  const { engineForLife } = await import("../client/lib/world-session.ts");
  const { getArchivedBuiltinWorld } = await import("../server/content.ts");
  assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, retained);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
