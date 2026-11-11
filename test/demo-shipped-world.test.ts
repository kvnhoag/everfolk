import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoWorld } from "../src/demo/world.ts";
import { worldForVersion } from "../chain/worlds.ts";
import ranked from "../worlds/ranked/alexandria-ranked-1.json" with { type: "json" };
import current from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import legacy from "../worlds/demo/alexandria-demo-1.json" with { type: "json" };
import type { WorldPack } from "../src/types.ts";
import { DEMO_KEY_EVENTS } from "../src/demo/content/world.ts";
import { keyDecisionCategory } from "../chain/catalog/key-decisions.ts";
import { createEngine } from "../src/index.ts";
import { ensureDemoDeeds } from "../chain/catalog/demo-deeds.ts";
import { rankedProgress } from "../client/chain/ranked-progress.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";

test("the playable demo includes the complete authored economy and convoy world", () => {
  assert.deepEqual(current, buildDemoWorld(ranked as unknown as WorldPack));
  assert.ok(current.events.some(event => event.id === "demo-convoy-road"));
  assert.ok(current.events.some(event => event.id === "flood-failure"));
  assert.equal(keyDecisionCategory(DEMO_KEY_EVENTS.flood, current.version), "harvest");
  assert.equal(keyDecisionCategory(DEMO_KEY_EVENTS.levy, current.version), "war");
});

test("restored lives resolve their original demo revision", () => {
  const packs = [ranked, current, legacy] as unknown as [WorldPack, WorldPack, WorldPack];
  assert.equal(worldForVersion(legacy.version, ...packs)?.version, legacy.version);
  assert.equal(worldForVersion(current.version, ...packs)?.version, current.version);
  assert.equal(worldForVersion("unknown", ...packs), null);
});

test("My lives reads demo progress using the life's own world without a caller-supplied pack", async () => {
  const contract = createMockContract();
  const life = await contract.startLife(current.version);
  const engine = createEngine(ensureDemoDeeds(current as unknown as WorldPack));
  const state = engine.start(life.seed);
  const progress = await rankedProgress(life, { getItem: () => engine.save(state) });
  assert.equal(progress.status, "playing");
  assert.equal(progress.age, 0);
});
