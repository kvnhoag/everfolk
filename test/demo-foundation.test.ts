import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/engine.ts";
import { demoEngine, demoWorld, liveUntil } from "./fixtures/demo/world.ts";
import { availability } from "../src/demo/availability.ts";
import { DEMO_WORLD_VERSION } from "../src/demo/types.ts";
import type { WorldPack } from "../src/types.ts";

test("the demo world assembles, validates and keeps the ranked world untouched", () => {
  const world = demoWorld();
  assert.equal(world.version, DEMO_WORLD_VERSION);
  assert.ok(world.demo);
  const ranked = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;
  assert.equal(ranked.demo, undefined);
  assert.equal(createEngine(ranked).start("same").demo, undefined);
});

test("a demo life starts with household, town and conditions, and replays exactly", () => {
  const engine = demoEngine();
  const life = liveUntil(engine, "foundation-seed", state => state.age >= 12);
  assert.ok(life.demo);
  assert.ok(life.demo.household.grain >= 0);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("unavailable jobs are reported and cannot be granted", () => {
  const world = demoWorld();
  assert.deepEqual(availability(world.demo, "job", "general"), { status: "unavailable", reason: "Not available in this demo." });
  assert.deepEqual(availability(world.demo, "job", "soldier"), { status: "playable" });
  assert.deepEqual(availability(undefined, "job", "general"), { status: "playable" });
  const engine = demoEngine();
  const life = liveUntil(engine, "unavailable-seed", state => state.age >= 30 && state.phase === "ready");
  const general = engine.getActivities(life).find(activity => activity.id === "seek-general-command");
  assert.equal(general?.available, false);
  assert.equal(general?.reason, "Not available in this demo.");
  assert.throws(() => engine.act(life, "seek-general-command"), /Not available in this demo/);
});

test("demo commands are strictly shaped and rejected in old worlds", () => {
  const engine = demoEngine();
  const life = engine.start("shape-seed");
  assert.throws(() => engine.demo(life, { type: "plan", flaxPlots: -1 } as never), /Invalid demo command/);
  assert.throws(() => engine.demo(life, { type: "trade", item: "grain", side: "buy", quantity: 1, counterparty: "merchant", extra: 1 } as never), /Invalid demo command/);
  const ranked = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;
  const old = createEngine(ranked);
  assert.throws(() => old.demo(old.start("x"), { type: "plan", flaxPlots: 0 }), /no demo economy/);
});
