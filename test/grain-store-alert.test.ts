import assert from "node:assert/strict";
import test from "node:test";
import { grainStoreAlert, spoilageNote, type GrainStoreFacts } from "../client/demo/grain-store-alert.ts";

const facts = (over: Partial<GrainStoreFacts> = {}): GrainStoreFacts => ({
  grain: 1000, capacity: 1500, expectedHarvest: 600, expectedRent: 100, expectedEating: 600,
  spoilageBps: 800, overCapacitySpoilageBps: 4000, age: 8, tradeAge: 10, ...over,
});

test("an overfull store is a danger, with the over-limit rate and what a child can do", () => {
  const alert = grainStoreAlert(facts({ grain: 1605 }))!;
  assert.equal(alert.tone, "danger");
  assert.match(alert.text, /over its limit by 105/);
  assert.match(alert.text, /about 40% a year/);
  assert.match(alert.text, /sell at the market from age 10; until then, plant more flax/);
});

test("a store that will overflow at harvest is warned about before it happens", () => {
  const alert = grainStoreAlert(facts({ grain: 1500, expectedHarvest: 900, age: 12 }))!;
  assert.equal(alert.tone, "warning");
  assert.match(alert.text, /over its limit by about 200/);
  assert.match(alert.text, /Sell the extra at the market this year/);
});

test("a store with room says nothing, and a world without a market only suggests planting", () => {
  assert.equal(grainStoreAlert(facts()), null);
  assert.match(grainStoreAlert(facts({ grain: 1600, tradeAge: null }))!.text, /Plant more flax/);
  assert.equal(spoilageNote(facts()), "Stored grain loses about 8% a year; grain above the store's limit of 1500 loses about 40%.");
});
