import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine, validateWorld } from "../src/index.ts";
import type { Condition, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.38.0.json" with { type: "json" };

const world = current as WorldPack;
function conditionUses(condition: Condition | undefined, id: string): boolean {
  if (!condition) return false;
  if (condition.type === "asset") return condition.asset === id;
  if (condition.type === "all" || condition.type === "any") return condition.conditions.some(item => conditionUses(item, id));
  return condition.type === "not" && conditionUses(condition.condition, id);
}

test("resources cover every background and occupation with validated contextual references", () => {
  validateWorld(world);
  for (const origin of world.origins) {
    const contextual = world.economy!.assets.filter(item => item.context?.origins?.includes(origin.id));
    assert.ok(contextual.length > 0, `${origin.id} has relevant resources`);
    assert.ok(contextual.some(item => (origin.assetRanges?.[item.id]?.max ?? 0) > 0), `${origin.id} can start with useful supplies`);
    const family = world.events.find(event => event.id === `background-${origin.id}-adult-livelihood`)!.choices.find(choice => choice.id === `${origin.id}-adult-family-work`)!;
    assert.ok(family.outcomes[0].effects.some(effect => effect.type === "asset" && effect.delta > 0), `${origin.id} has an actual resource opportunity`);
  }
  for (const job of world.character!.jobs) assert.ok(world.economy!.assets.some(item => item.context?.jobs?.includes(job.id)), `${job.id} has useful related goods`);
});

test("the expanded catalogue contains usable goods rather than decorative resource counters", () => {
  for (const item of world.economy!.assets) {
    assert.ok(item.category, item.id);
    const used = (item.yearlyIncome ?? 0) > 0 || world.character!.jobs.some(job => item.id in (job.production?.inputs ?? {}) || item.id in (job.production?.outputs ?? {}))
      || world.character!.activities.some(activity => conditionUses(activity.when, item.id) || activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "asset" && effect.asset === item.id)));
    assert.ok(used, `${item.id} is used by a recipe, service order, equipment condition or income`);
  }
  assert.ok(world.economy!.assets.length >= 30);
  assert.ok(new Set(world.economy!.assets.map(item => item.category)).size >= 8);
});

test("new independent food livelihoods consume supplies and have viable ordinary batch margins", () => {
  const fee = world.economy!.market!.feePercent / 100;
  const price = (id: string) => world.economy!.assets.find(item => item.id === id)!.value;
  for (const id of ["baker", "fisher"]) {
    const job = world.character!.jobs.find(job => job.id === id)!, recipe = job.production!;
    assert.ok(recipe);
    assert.ok(job.yearlyEffects.every(effect => effect.type !== "cash" && !(effect.type === "stat" && effect.stat === "wealth")));
    const cost = Object.entries(recipe.inputs).reduce((sum, [id, count]) => sum + count * Math.ceil(price(id) * (1 + fee)), 0);
    const receipt = Object.entries(recipe.outputs).reduce((sum, [id, count]) => sum + count * Math.floor(price(id) * (1 - fee)), 0);
    assert.ok((receipt - cost) * recipe.baseBatches > 10, `${id} can cover ordinary adult costs after selling its base production`);
    assert.ok(world.character!.activities.some(activity => activity.id === `work-${id}`));
  }
});

test("supply orders consume only expendable inputs and keep useful equipment", () => {
  for (const [activityId, equipment] of [["perform-independent-engagement", "musical-instrument"], ["prepare-teaching-notes", "wax-tablets"], ["check-estate-supply-order", "wax-tablets"]]) {
    const activity = world.character!.activities.find(item => item.id === activityId)!;
    assert.ok(conditionUses(activity.when, equipment));
    assert.ok(activity.outcomes[0].effects.some(effect => effect.type === "asset" && effect.delta < 0));
    assert.ok(activity.outcomes[0].effects.every(effect => effect.type !== "asset" || effect.asset !== equipment));
  }
  for (const job of retained.character.jobs) assert.deepEqual(world.character!.jobs.find(item => item.id === job.id)!.yearlyEffects, job.yearlyEffects, `${job.id} keeps its established annual work terms`);
});

test("the previous market revision stays unchanged and replayable", async () => {
  assert.equal(retained.version, "0.38.0");
  assert.equal(retained.economy.assets.length, 16);
  const engine = createEngine(retained), life = engine.start("retained-market-rules");
  const { engineForLife } = await import("../client/lib/world-session.ts");
  const { getArchivedBuiltinWorld } = await import("../server/content.ts");
  assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, retained);
  assert.deepEqual(engine.load(engine.save(life)), life);
  const archived = readFileSync(new URL("../worlds/alexandria-0.38.0.json", import.meta.url), "utf8");
  assert.equal(JSON.parse(archived).version, "0.38.0");
});
