import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { buildHouseholdResourceWorld, LARGE_RESERVE_ORIGINS } from "../src/vocations/household-resource-world.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import type { WorldPack } from "../src/types.ts";
import original from "../worlds/demo/alexandria-lives-8-wsl-contributions.json" with { type: "json" };
import previous from "../worlds/demo/alexandria-lives-9-wsl-resources.json" with { type: "json" };
import current from "../worlds/demo/alexandria-lives-10.json" with { type: "json" };

const world = current as unknown as WorldPack;

test("every ordinary household keeps modest crop rolls and wealthy households keep their original reserves", () => {
  const source = original as unknown as WorldPack, before = structuredClone(source);
  const built = buildHouseholdResourceWorld(source);
  assert.deepEqual(built, current);
  assert.deepEqual(source, before);
  validateWorld(world);
  for (const origin of world.origins) {
    const resources = world.demo!.startingResources!.origins![origin.id];
    if ((LARGE_RESERVE_ORIGINS as readonly string[]).includes(origin.id)) {
      assert.deepEqual(resources, source.demo!.startingResources!.origins![origin.id]);
      assert.equal(world.demo!.startingResources!.storeCapacityByOrigin![origin.id], 1500);
    } else {
      assert.deepEqual(resources, previous.demo.startingResources.origins[origin.id as keyof typeof previous.demo.startingResources.origins]);
      assert.ok(resources.grain!.max <= 75, `${origin.id}: ordinary crop reserve`);
    }
  }
  assert.deepEqual(world.demo!.household, previous.demo.household, "crop gains and food requirements stay balanced");
});

test("merchant profiles retain their exemption when enabled as a birthplace", () => {
  const base = structuredClone(original) as unknown as WorldPack;
  base.origins.push({ ...structuredClone(base.origins[0]), id: "merchant-household", title: "A merchant household" });
  base.demo!.startingResources!.origins!["merchant-household"] = { grain: { min: 250, max: 450 }, flax: { min: 0, max: 20 }, silver: { min: 0, max: 2 }, linen: { min: 0, max: 4 } };
  const built = buildHouseholdResourceWorld(base);
  assert.deepEqual(built.demo!.startingResources!.origins!["merchant-household"], base.demo!.startingResources!.origins!["merchant-household"]);
  assert.equal(built.demo!.startingResources!.storeCapacityByOrigin!["merchant-household"], 1500);
});

test("rolled ordinary and aristocratic starts use their own reserves and storage without changing replay", () => {
  const engine = createEngine(world), missing = new Set(world.origins.map(origin => origin.id));
  for (let index = 0; index < 256 && missing.size; index++) {
    const life = engine.start(`household-scale-${index}`);
    if (!missing.delete(life.originId)) continue;
    const elite = (LARGE_RESERVE_ORIGINS as readonly string[]).includes(life.originId);
    assert.equal(life.demo!.household.capacity, elite ? 1500 : 150);
    assert.ok(life.demo!.household.grain <= life.demo!.household.capacity);
    if (elite) assert.ok(life.demo!.household.grain >= 600);
    else assert.ok(life.demo!.household.grain <= 75);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.equal(missing.size, 0, "every birthplace was exercised");
});

test("new starts load the household revision and both earlier balances remain replayable", async () => {
  for (const pack of [world, previous as unknown as WorldPack, original as unknown as WorldPack]) {
    assert.equal((await loadLifeWorld(pack.version)).version, pack.version);
    const engine = createEngine(pack), life = engine.start("household-balance-registration");
    assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
  }
});
