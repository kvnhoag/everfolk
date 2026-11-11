import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import retained from "../worlds/alexandria-0.35.0.json" with { type: "json" };

function pack(): WorldPack {
  return {
    schemaVersion: 1, id: "market-validation", version: "1", title: "Annual market", description: "Game balance fixture.",
    startYear: -30, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    events: [{ id: "clay-shortage", title: "Clay shortage", text: "Deliveries are delayed.", trigger: { type: "age", at: 18 }, mode: "automatic", choices: [], effects: [] }],
    economy: {
      stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored prices.",
      assets: [
        { id: "clay", title: "Clay", description: "Pottery material.", value: 2 },
        { id: "pots", title: "Pots", description: "Finished pottery.", value: 8 },
      ],
      market: {
        minAge: 18, feePercent: 10, maxQuantity: 100, maxOrders: 20, traderJob: "trader", traderYears: 3,
        traderFocusActivity: "focus-trade", goods: ["clay", "pots"],
        shocks: [{ eventId: "clay-shortage", title: "Clay deliveries delayed", durationYears: 2, priceMultipliers: { clay: 1.5 } }],
      },
    },
    character: {
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 10 } }, partners: [], childNames: ["Child"],
      jobs: [
        { id: "trader", title: "Trader", description: "Trade goods.", minAge: 18, yearlyEffects: [] },
        { id: "potter", title: "Potter", description: "Make pots.", minAge: 18, yearlyEffects: [{ type: "skill", skill: "craft", delta: 1 }],
          production: { inputs: { clay: 2 }, outputs: { pots: 1 }, baseBatches: 1, skill: "craft", skillPerBatch: 10, maxBatches: 10 } },
      ],
      activities: [{ id: "focus-trade", text: "Spend the year trading.", category: "career", outcomes: [{ id: "trade-year", text: "Accounts checked.", weight: 1, effects: [] }] }],
      deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
    },
  };
}

test("annual market validation accepts complete rules and leaves retained pre-market packs valid", () => {
  assert.doesNotThrow(() => validateWorld(pack()));
  assert.doesNotThrow(() => validateWorld(retained));
});

const invalidMarkets: [string, (world: WorldPack) => void, RegExp][] = [
  ["unknown goods", world => { world.economy!.market!.goods.push("missing"); }, /unknown asset/],
  ["duplicate goods", world => { world.economy!.market!.goods.push("clay"); }, /duplicate market good/],
  ["free goods", world => { world.economy!.assets[0].value = 0; }, /safe integer in 1/],
  ["negative fees", world => { world.economy!.market!.feePercent = -1; }, /percentage in 0..50/],
  ["invalid quantities", world => { world.economy!.market!.maxQuantity = 0.5; }, /safe integer/],
  ["unknown trader job", world => { world.economy!.market!.traderJob = "missing"; }, /unknown job/],
  ["unknown focus", world => { world.economy!.market!.traderFocusActivity = "missing"; }, /unknown activity/],
  ["free trade focus", world => { world.character!.activities[0].usesYearlyActivity = false; }, /must use the yearly activity/],
  ["missing event", world => { world.economy!.market!.shocks[0].eventId = "missing"; }, /unknown event/],
  ["duplicate event", world => { world.economy!.market!.shocks.push(structuredClone(world.economy!.market!.shocks[0])); }, /duplicate market event/],
  ["empty shock", world => { world.economy!.market!.shocks[0].priceMultipliers = {}; }, /at least one market good/],
  ["nonfinite shock", world => { world.economy!.market!.shocks[0].priceMultipliers.clay = Infinity; }, /finite number/],
  ["out of bounds shock", world => { world.economy!.market!.shocks[0].priceMultipliers.clay = 4.1; }, /multiplier in 0.25..4/],
  ["unknown shock good", world => { world.economy!.market!.shocks[0].priceMultipliers = { missing: 1.5 }; }, /unknown market good/],
  ["unbounded contract", world => { world.economy!.assets[0].value = 1_000_000_000; world.economy!.market!.maxQuantity = 1_000_000; }, /maximum order value/],
];
for (const [label, change, expected] of invalidMarkets) {
  test(`annual market validation rejects ${label}`, () => {
    const world = pack(); change(world);
    assert.throws(() => validateWorld(world), expected);
  });
}

const invalidProduction: [string, (world: WorldPack) => void, RegExp][] = [
  ["missing market", world => { delete world.economy!.market; }, /requires an annual market/],
  ["missing materials", world => { world.character!.jobs[1].production!.inputs = {}; }, /at least one market good/],
  ["fractional materials", world => { world.character!.jobs[1].production!.inputs.clay = 0.5; }, /safe integer/],
  ["untraded goods", world => { world.character!.jobs[1].production!.outputs = { missing: 1 }; }, /unknown market good/],
  ["invalid capacity", world => { world.character!.jobs[1].production!.maxBatches = 0; }, /safe integer/],
  ["unpaired scaling", world => { delete world.character!.jobs[1].production!.skillPerBatch; }, /supplied together/],
  ["unknown scaling skill", world => { world.character!.jobs[1].production!.skill = "missing"; }, /unknown skill/],
  ["salary without sales", world => { world.character!.jobs[1].yearlyEffects.push({ type: "cash", delta: 1 }); }, /rather than an automatic salary/],
  ["wealth without sales", world => { world.character!.jobs[1].yearlyEffects.push({ type: "stat", stat: "wealth", delta: 1 }); }, /rather than an automatic salary/],
  ["unbounded output", world => { world.character!.jobs[1].production!.outputs.pots = 1_000_000; world.character!.jobs[1].production!.maxBatches = 1_000_000; }, /maximum production value/],
];
for (const [label, change, expected] of invalidProduction) {
  test(`production validation rejects ${label}`, () => {
    const world = pack(); change(world);
    assert.throws(() => validateWorld(world), expected);
  });
}
