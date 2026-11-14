import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { WEAVE_WORLD_VERSION, usesDemoCatalog } from "../chain/ids.ts";
import { buildWeaveWorld } from "../chain/weave-world.ts";
import { contractWorldVersion, worldForVersion } from "../chain/worlds.ts";
import { keyDecisionCategory } from "../chain/catalog/key-decisions.ts";
import { DEMO_DEED_INFLUENCES } from "../chain/catalog/demo-deeds.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import { LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import lives11 from "../worlds/demo/alexandria-lives-11.json" with { type: "json" };

const weave = buildWeaveWorld(lives11 as unknown as WorldPack);

test("Weave mode plays the current free-play world, with its eleven historical figure paths", () => {
  assert.equal(WEAVE_WORLD_VERSION, "alexandria-weave-1");
  assert.equal(lives11.version, LIVES_WORLD_VERSION);
  assert.equal(weave.id, "alexandria");
  assert.equal(weave.version, WEAVE_WORLD_VERSION);
  assert.equal(weave.figurePaths?.length, 11);
  assert.deepEqual(weave.birthYears, lives11.birthYears, "births run 400–300 BCE as in free play");
  assert.equal(weave.npcAgents, undefined, "live NPC agents stay in their own world");
  validateWorld(weave);
});

test("the Weave world carries the on-chain deeds and key-decision draws", () => {
  assert.ok(usesDemoCatalog(WEAVE_WORLD_VERSION));
  const influences = new Set((weave.influences ?? []).map(entry => entry.id));
  for (const deed of DEMO_DEED_INFLUENCES) assert.ok(influences.has(deed.id), deed.id);
  assert.equal(keyDecisionCategory("flood-failure", WEAVE_WORLD_VERSION), "harvest");
  assert.equal(keyDecisionCategory("levy-call", WEAVE_WORLD_VERSION), "war");
  assert.ok(weave.events.some(event => event.id === "flood-failure"));
});

test("the verifier, the contract and the client all resolve the same Weave pack", async () => {
  const empty = {} as WorldPack;
  const resolved = worldForVersion(WEAVE_WORLD_VERSION, empty, empty, undefined, undefined, weave);
  assert.equal(resolved?.version, WEAVE_WORLD_VERSION);
  assert.equal(contractWorldVersion(weave), WEAVE_WORLD_VERSION);
  const loaded = await loadLifeWorld(WEAVE_WORLD_VERSION);
  assert.equal(createEngine(loaded).fingerprint, createEngine(weave).fingerprint, "one fingerprint everywhere");
});
