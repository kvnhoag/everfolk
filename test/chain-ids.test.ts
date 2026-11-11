import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS, RARITY_POWER_BPS } from "../chain/ids.ts";
import { commandsHash, sha256Hex } from "../chain/hash.ts";

test("every figure and NPC action id is unique", () => {
  const ids = [
    ...Object.values(FIGURE_ACTIONS).flat(),
    ...Object.values(NPC_ACTIONS).flatMap(group => group.actions),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(FIGURE_ACTIONS), [...FIGURE_IDS]);
});

test("every NPC career group maps to a known category", () => {
  for (const group of Object.values(NPC_ACTIONS)) {
    assert.ok((CATEGORIES as readonly string[]).includes(group.category), group.category);
  }
});

test("rarity power starts at 1x and rises to 3x", () => {
  assert.deepEqual([...RARITY_POWER_BPS], [10000, 12500, 15000, 20000, 30000]);
});

test("sha256Hex returns lowercase hex", async () => {
  assert.equal(await sha256Hex("[]"), "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945");
});

test("commandsHash hashes the prefix before the step", async () => {
  assert.equal(await commandsHash([{ type: "advance" }], 0), await sha256Hex("[]"));
  assert.equal(await commandsHash([{ type: "advance" }, { type: "choose", choice: "x" }], 1), await sha256Hex('[{"type":"advance"}]'));
});

test("commandsHash ignores key order inside a command", async () => {
  const a = [{ type: "choose", choice: "study" }];
  const b = [{ choice: "study", type: "choose" }];
  assert.equal(await commandsHash(a, 1), await commandsHash(b, 1));
});
