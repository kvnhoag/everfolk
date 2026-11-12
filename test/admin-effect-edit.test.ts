import assert from "node:assert/strict";
import test from "node:test";
import type { Effect, WorldPack } from "../src/types.ts";
import { validateEditedEffects } from "../client/models/admin/effect-edit.ts";
import raw from "../worlds/alexandria-sample.json" with { type: "json" };

test("an admin can revise commissioned-work rewards without losing its outcome-only accomplishment", () => {
  const world = structuredClone(raw) as WorldPack;
  const effects = world.character!.activities.find(activity => activity.id === "small-figure-order")!.outcomes[0].effects;
  const next = effects.map(effect => effect.type === "cash" && effect.delta > 0 ? { ...effect, delta: effect.delta + 5 } : structuredClone(effect));
  assert.ok(next.some(effect => effect.type === "accomplishment"));
  assert.notDeepEqual(next, effects);
  const before = structuredClone(world);
  assert.doesNotThrow(() => validateEditedEffects(world, effects, next));
  assert.deepEqual(world, before, "Validation must leave the current draft and its other routes unchanged.");
});

test("prestige outcome editing retains its rare-decision context and rejects undeclared achievement IDs", () => {
  const world = structuredClone(raw) as WorldPack;
  const effects = world.events.find(event => event.id === "legacy-sculpture-prestige")!.choices[0].outcomes[0].effects;
  const next = effects.map(effect => effect.type === "cash" ? { ...effect, delta: 65 } : structuredClone(effect));
  assert.doesNotThrow(() => validateEditedEffects(world, effects, next));
  const forged: Effect[] = next.map(effect => effect.type === "accomplishment" ? { ...effect, achievement: "invented-award" } : effect);
  assert.throws(() => validateEditedEffects(world, effects, forged), /unknown achievement/);
});

test("validating in place still rejects an award inserted into passive yearly effects", () => {
  const world = structuredClone(raw) as WorldPack;
  const next: Effect[] = [...world.yearlyEffects, { type: "accomplishment", achievement: "sculpture-first-work" }];
  assert.throws(() => validateEditedEffects(world, world.yearlyEffects, next), /accepted decision or activity outcome/);
});

test("a stale effect editor cannot validate an unrelated detached list", () => {
  const world = structuredClone(raw) as WorldPack;
  const detached = structuredClone(world.yearlyEffects);
  assert.throws(() => validateEditedEffects(world, detached, detached), /no longer matches the current world/);
});
