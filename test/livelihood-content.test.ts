import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/alexandria-sample.json", import.meta.url), "utf8")) as WorldPack;
validateWorld(world);

test("every background offers its own adulthood work and an independent path", () => {
  for (const origin of world.origins) {
    const event = world.events.find(event => event.id === `background-${origin.id}-adult-livelihood`)!;
    assert.ok(event, origin.id);
    assert.deepEqual(event.when, { type: "origin", origin: origin.id });
    const independent = event.choices.find(choice => choice.id === `${origin.id}-adult-independent-path`)!;
    assert.ok(independent);
    assert.ok(independent.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "job")));
    const farming = event.choices.filter(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === "farmer")));
    assert.equal(farming.length, ["tenant-farming-household", "estate-household"].includes(origin.id) ? 1 : 0);
  }
  assert.ok(world.character!.activities.find(activity => activity.id === "work-farmer"));
  assert.ok(world.events.find(event => event.id === "farmer-checks-seed")?.when?.type === "job");
});

test("material livelihoods consume market stock instead of generating a salary", () => {
  for (const id of ["weaver", "writer", "copyist", "potter", "wood-carver", "sculptor", "boatbuilder"]) {
    const job = world.character!.jobs.find(job => job.id === id)!;
    assert.ok(job.production, id);
    assert.ok(job.production.maxBatches > job.production.baseBatches);
    assert.ok(Object.keys(job.production.inputs).length > 0);
    assert.ok(Object.keys(job.production.outputs).length > 0);
    for (const input of Object.keys(job.production.inputs)) assert.ok(world.economy!.market!.goods.includes(input));
    for (const output of Object.keys(job.production.outputs)) assert.ok(world.economy!.market!.goods.includes(output));
    assert.ok(job.yearlyEffects.every(effect => effect.type !== "cash" && !(effect.type === "stat" && effect.stat === "wealth")));
  }
});

test("trader route is earned through trade and offers an explicit occupation choice", () => {
  assert.ok(world.flags["trader-qualified"]);
  assert.equal(world.economy!.market!.traderYears, 3);
  const trader = world.character!.jobs.find(job => job.id === "trader")!;
  assert.ok(trader.yearlyEffects.every(effect => effect.type !== "cash" && !(effect.type === "stat" && effect.stat === "wealth")));
  const event = world.events.find(event => event.id === "market-trader-opening")!;
  assert.ok(event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job === "trader"))));
  assert.ok(event.choices.some(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "job"))));
});

test("market offers refer to actual game reports and replace immediate finance trades", () => {
  const market = world.economy!.market!;
  for (const shock of market.shocks) {
    assert.ok(world.events.some(event => event.id === shock.eventId));
    for (const id of Object.keys(shock.priceMultipliers)) assert.ok(market.goods.includes(id));
  }
  for (const id of market.goods) {
    assert.ok(!world.character!.activities.some(activity => activity.id === `buy-${id}` || activity.id === `sell-${id}`));
  }
});
