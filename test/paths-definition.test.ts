import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { pathsDefinition, pathsWorld } from "./paths-fixture.ts";

function without<T extends object>(value: T, key: keyof T): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

const rejects = (patch: (world: WorldPack) => void, message: RegExp) => {
  const world = structuredClone(pathsWorld());
  patch(world);
  assert.throws(() => validateWorld(world), message);
};

test("a world with fields and districts validates", () => {
  validateWorld(pathsWorld());
});

test("paths definitions with unknown or impossible values are rejected", () => {
  rejects(world => { (world.paths!.fields as Record<string, unknown>).alchemy = world.paths!.fields.farming; }, /unknown field/);
  rejects(world => { world.paths!.districts.village.origins = ["palace"]; }, /unknown origin/);
  rejects(world => { world.paths!.fields.farming.skills = ["alchemy"]; }, /unknown skill/);
  rejects(world => { world.paths!.fields.farming.jobs = ["wizard"]; }, /unknown job/);
  rejects(world => { world.paths!.districts.village.profile.farming.people = [-1, 0, 0, 0]; }, /expected/);
  rejects(world => { world.paths!.pay.minBps = 20000; }, /minBps/);
  rejects(world => { world.events[0].fields = ["alchemy" as never]; }, /unknown field/);
  rejects(world => { world.paths!.districts.city.origins = ["farm"]; }, /more than one district/);
  rejects(world => { world.paths!.originAffinity = { farm: { ceramics: 150 } }; }, /expected/);
});

test("paths require life stages", () => {
  assert.throws(() => validateWorld(without(pathsWorld(), "lifeStages")), /requires world.lifeStages/);
});

test("event fields validate in a paths world", () => {
  const world = pathsWorld();
  world.events[0].fields = ["farming", "trade"];
  validateWorld(world);
});

test("a world without paths plays as before", () => {
  const world = without(pathsWorld(), "paths");
  const engine = createEngine(world);
  let life = engine.start("no-paths");
  for (let i = 0; i < 5; i++) life = engine.advance(life);
  assert.equal(life.paths, undefined);
  assert.equal(life.stageRecords, undefined);
  assert.ok(pathsDefinition());
});
