import assert from "node:assert/strict";
import test from "node:test";
import { grainStoreAlert, spoilageNote, type GrainStoreFacts } from "../client/demo/grain-store-alert.ts";

const facts = (over: Partial<GrainStoreFacts> = {}): GrainStoreFacts => ({
  grain: 1000, capacity: 1500, expectedHarvest: 600, expectedRent: 100, expectedEating: 600,
  spoilageBps: 800, overCapacitySpoilageBps: 4000, age: 8, tradeAge: 10, plantingAge: 16, ...over,
});

test("an overfull store is a danger with the over-limit rate, and a child is never told to do what they cannot", () => {
  const alert = grainStoreAlert(facts({ grain: 1605 }))!;
  assert.equal(alert.tone, "danger");
  assert.match(alert.text, /over its limit by 105/);
  assert.match(alert.text, /about 40% a year/);
  assert.match(alert.text, /Your family runs the store for now; from age 10 you can sell the extra at the market/);
  assert.doesNotMatch(alert.text, /plant/i, "planting opens at 16, so a child is not told to plant");
  assert.match(grainStoreAlert(facts({ grain: 1605, age: 12 }))!.text, /Sell the extra at the market this year\.$/);
  assert.match(grainStoreAlert(facts({ grain: 1605, age: 16 }))!.text, /Sell the extra at the market this year, or plant more flax/);
});

test("a store that will overflow at harvest is warned about before it happens", () => {
  const alert = grainStoreAlert(facts({ grain: 1500, expectedHarvest: 900, age: 12 }))!;
  assert.equal(alert.tone, "warning");
  assert.match(alert.text, /over its limit by about 200/);
  assert.match(alert.text, /Sell the extra at the market this year/);
});

test("a store with room says nothing, and a world without a market only suggests planting", () => {
  assert.equal(grainStoreAlert(facts()), null);
  assert.match(grainStoreAlert(facts({ grain: 1600, tradeAge: null, age: 16 }))!.text, /Plant more flax/);
  assert.equal(spoilageNote(facts()), "Stored grain loses about 8% a year; grain above the store's limit of 1500 loses about 40%.");
});

test("a harvest that will not feed everyone is warned about, with what the cash covers and what to do at this age", () => {
  const short = { grain: 100, expectedHarvest: 300, expectedRent: 50, expectedEating: 600, grainPrice: 2 };
  const covered = grainStoreAlert(facts({ ...short, cash: 1000, age: 20, flaxPlots: 2 }))!;
  assert.equal(covered.tone, "warning");
  assert.match(covered.text, /about 250 grain short/);
  assert.match(covered.text, /buy it with about 500 of your cash/);
  assert.match(covered.text, /Sow more plots with grain, or buy grain at the market/);
  const uncovered = grainStoreAlert(facts({ ...short, cash: 100, age: 20, flaxPlots: 0 }))!;
  assert.equal(uncovered.tone, "danger");
  assert.match(uncovered.text, /your cash buys only about 50/);
  assert.match(uncovered.text, /goes hungry and loses health/);
  assert.doesNotMatch(uncovered.text, /Sow more plots/, "every plot already grows grain");
  assert.match(grainStoreAlert(facts({ ...short, cash: 0, age: 8 }))!.text, /with no cash to buy it.*Your family runs the store for now/);
});

test("a food shortage outranks an overfull store, and a fed household hears nothing about food", () => {
  assert.equal(grainStoreAlert(facts({ grain: 1000, expectedHarvest: 600, expectedEating: 600, cash: 0, grainPrice: 2 })), null);
});
