import assert from "node:assert/strict";
import test from "node:test";
import { createRoyaltyTestSession, ROYALTY_TEST_PRESETS } from "../client/models/royalty-test.ts";
import currentWorld from "../worlds/alexandria-sample.json" with { type: "json" };

test("each royalty test preset opens an adult house at its exact values with a usable annual action", () => {
  for (const preset of ROYALTY_TEST_PRESETS) {
    const { engine, life } = createRoyaltyTestSession(preset.id);
    assert.equal(life.age, preset.age);
    assert.equal(life.phase, "ready");
    assert.equal(life.stats.health, 85);
    assert.equal(life.stats.knowledge, 50);
    assert.equal(life.stats.bonds, 60);
    assert.deepEqual(preset.socialClass === "royal" ? life.royalty : life.aristocracy, preset.metrics);
    assert.notEqual(life.character!.lastActivityAge, life.age);
    assert.ok(engine.getActivities(life).find(activity => activity.id === (preset.socialClass === "royal" ? "royal-hold-council" : "aristocrat-meet-stewards"))!.available);
    assert.ok(engine.getActivities(life).every(activity => activity.audience !== "common"));
    assert.equal(life.character!.jobId, null);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("test council decisions and years use the real engine and remain deterministic", () => {
  const { engine, life } = createRoyaltyTestSession();
  const decision = engine.act(life, "royal-send-envoys");
  assert.equal(decision.royalty!.treasury, life.royalty!.treasury - 40);
  assert.equal(decision.royalty!.influence, life.royalty!.influence + 10);
  const next = engine.advance(decision);
  assert.equal(next.age, life.age + 1);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
  assert.deepEqual(createRoyaltyTestSession().life, life);
});

test("the royalty sandbox keeps production setup intact and exposes actual pressure penalties", () => {
  const original = structuredClone(currentWorld);
  const { engine, life } = createRoyaltyTestSession("struggling");
  const next = engine.advance(life);
  assert.ok(next.royalty!.treasury < life.royalty!.treasury, "Active pressure penalties outweigh ordinary estate receipts.");
  assert.notEqual(engine.world.id, currentWorld.id);
  assert.deepEqual(currentWorld, original);
  assert.throws(() => createRoyaltyTestSession("unknown"), /Unknown royalty test preset/);
});
