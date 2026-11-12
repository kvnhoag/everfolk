import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import retained from "../worlds/alexandria-0.38.0.json" with { type: "json" };

function pack(): WorldPack {
  return {
    schemaVersion: 1, id: "market-roles", version: "1", title: "Market roles", description: "Authored capability fixture.", startYear: -30, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored prices.",
      assets: [{ id: "oil", title: "Oil", description: "A trade good.", value: 5 }],
      market: { minAge: 18, feePercent: 5, maxQuantity: 100, maxOrders: 20, traderJob: "trader", traderYears: 3,
        traderFocusActivity: "focus-trade", goods: ["oil"], shocks: [] } },
    character: { skills: { reckoning: { label: "Reckoning", min: 0, max: 100, initial: 10 } }, partners: [], childNames: ["Child"],
      jobs: [{ id: "trader", title: "Trader", description: "Buy and sell goods.", minAge: 18, yearlyEffects: [] },
        { id: "supplier", title: "Supplier", description: "Arrange varied supplies.", minAge: 18, marketAccess: "full", yearlyEffects: [] }],
      activities: [{ id: "focus-trade", text: "Check the trade accounts.", category: "career", outcomes: [{ id: "done", text: "Accounts checked.", weight: 1, effects: [] }] }],
      deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }] },
  };
}

test("market-capable jobs validate while the capability remains optional for retained worlds", () => {
  assert.doesNotThrow(() => validateWorld(pack()));
  const withoutCapability = pack();
  delete withoutCapability.character!.jobs[1].marketAccess;
  assert.doesNotThrow(() => validateWorld(withoutCapability));
  assert.doesNotThrow(() => validateWorld(retained));
});

for (const value of ["limited", "all", "FULL", "", true, false, 1, null, {}, [], undefined]) {
  test(`market role validation rejects ${JSON.stringify(value) ?? "undefined"} as a capability`, () => {
    const world = pack();
    (world.character!.jobs[1] as any).marketAccess = value;
    assert.throws(() => validateWorld(world), /marketAccess.*expected the full market capability/);
  });
}

test("full market capability requires an annual market", () => {
  const world = pack();
  delete world.economy!.market;
  assert.throws(() => validateWorld(world), /marketAccess.*requires an annual market/);
});
