import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findLifeEvent } from "../client/models/life-event-lookup.ts";
import type { WorldPack } from "../src/types.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;

test("finds ordinary world events", () => {
  assert.equal(findLifeEvent(world, "a-place-to-learn")?.id, "a-place-to-learn");
});

test("finds a decision that came from an on-chain influence (e.g. Euclid's school)", () => {
  const event = findLifeEvent(world, "influence-euclid-school");
  assert.ok(event, "ranked lives must be able to open influence decisions");
  assert.ok(event.choices.length > 0);
});

test("unknown or empty ids find nothing", () => {
  assert.equal(findLifeEvent(world, "no-such-event"), undefined);
  assert.equal(findLifeEvent(world, null), undefined);
});
