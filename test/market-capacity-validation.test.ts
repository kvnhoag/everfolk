import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import retained from "../worlds/alexandria-0.39.0.json" with { type: "json" };

function pack(): WorldPack {
  const world = structuredClone(retained) as WorldPack;
  Object.assign(world.economy!.market!, { maxQuantity: 100, maxOrders: 8,
    orderLimits: { household: { perOrder: 50, perYear: 100 }, professional: { perOrder: 100, perYear: 300 } } });
  return world;
}

test("order capacity is optional for retained packs and accepts balanced custom profiles", () => {
  assert.doesNotThrow(() => validateWorld(retained));
  assert.doesNotThrow(() => validateWorld(pack()));
  const custom = pack();
  custom.economy!.market!.orderLimits = { household: { perOrder: 1, perYear: 1 }, professional: { perOrder: 1, perYear: 1 } };
  assert.doesNotThrow(() => validateWorld(custom));
});

const invalid: [string, (world: WorldPack) => void, RegExp][] = [
  ["null limits", world => { world.economy!.market!.orderLimits = null as any; }, /orderLimits.*plain JSON object/],
  ["unknown limits field", world => { (world.economy!.market!.orderLimits as any).unlimited = true; }, /orderLimits.unlimited.*unknown field/],
  ["missing household", world => { delete (world.economy!.market!.orderLimits as any).household; }, /orderLimits.household.*required field/],
  ["missing professional", world => { delete (world.economy!.market!.orderLimits as any).professional; }, /orderLimits.professional.*required field/],
  ["non-object profile", world => { world.economy!.market!.orderLimits!.household = [] as any; }, /household.*plain JSON object/],
  ["unknown profile field", world => { (world.economy!.market!.orderLimits!.household as any).cash = 50; }, /household.cash.*unknown field/],
  ["missing per order", world => { delete (world.economy!.market!.orderLimits!.household as any).perOrder; }, /household.perOrder.*required field/],
  ["missing per year", world => { delete (world.economy!.market!.orderLimits!.professional as any).perYear; }, /professional.perYear.*required field/],
  ["zero per order", world => { world.economy!.market!.orderLimits!.household.perOrder = 0; }, /household.perOrder.*safe integer/],
  ["fractional per order", world => { world.economy!.market!.orderLimits!.household.perOrder = 1.5; }, /household.perOrder.*safe integer/],
  ["nonfinite per year", world => { world.economy!.market!.orderLimits!.household.perYear = Infinity; }, /household.perYear.*finite number/],
  ["above hard order maximum", world => { world.economy!.market!.orderLimits!.professional.perOrder = 101; }, /professional.perOrder.*safe integer/],
  ["year below one order", world => { world.economy!.market!.orderLimits!.household.perYear = 49; }, /household.perYear.*safe integer/],
  ["year above possible outstanding commitments", world => { world.economy!.market!.orderLimits!.professional.perYear = 801; }, /professional.perYear.*safe integer/],
  ["professional order below household", world => { world.economy!.market!.orderLimits!.professional.perOrder = 49; }, /professional.*must not be below household/],
  ["professional year below household", world => { world.economy!.market!.orderLimits!.professional = { perOrder: 50, perYear: 99 }; }, /professional.*must not be below household/],
];
for (const [label, change, expected] of invalid) {
  test(`order capacity validation rejects ${label}`, () => {
    const world = pack(); change(world);
    assert.throws(() => validateWorld(world), expected);
  });
}
