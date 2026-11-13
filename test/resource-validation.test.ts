import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import retained from "../worlds/alexandria-0.37.0.json" with { type: "json" };

function pack(): WorldPack {
  return {
    schemaVersion: 1, id: "resource-context", version: "1", title: "Resource relevance", description: "Authored resource fixture.",
    startYear: -30, maxAge: 80, stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored prices.",
      assets: [{ id: "tools", title: "Tools", description: "Working tools.", value: 5, category: "Workshop", context: { origins: ["home"], jobs: ["worker"], activities: ["repair"] } }] },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, partners: [], childNames: ["Child"],
      jobs: [{ id: "worker", title: "Worker", description: "Paid work.", minAge: 14, yearlyEffects: [] }],
      activities: [{ id: "repair", text: "Repair a fitting.", category: "career", outcomes: [{ id: "done", text: "The fitting is repaired.", weight: 1, effects: [] }] }],
      deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }] },
  };
}

test("resource metadata references real content and does not require a market", () => {
  const world = pack();
  assert.doesNotThrow(() => validateWorld(world));
  delete world.character;
  world.economy!.assets[0].context = { origins: ["home"] };
  assert.doesNotThrow(() => validateWorld(world));
  assert.doesNotThrow(() => validateWorld(retained));
});

test("resource metadata remains optional for old or custom worlds", () => {
  const world = pack();
  delete world.economy!.assets[0].context;
  delete world.economy!.assets[0].category;
  assert.doesNotThrow(() => validateWorld(world));
});

const invalid: [string, (world: WorldPack) => void, RegExp][] = [
  ["blank category", world => { world.economy!.assets[0].category = " "; }, /category.*nonempty string/],
  ["oversized category", world => { world.economy!.assets[0].category = "x".repeat(101); }, /category.*at most 100/],
  ["non-string category", world => { (world.economy!.assets[0] as any).category = 2; }, /category.*nonempty string/],
  ["non-object context", world => { (world.economy!.assets[0] as any).context = []; }, /context.*plain JSON object/],
  ["unknown context field", world => { (world.economy!.assets[0].context as any).skills = ["craft"]; }, /context.skills.*unknown field/],
  ["empty context", world => { world.economy!.assets[0].context = {}; }, /at least one relevance list/],
  ["unknown origin", world => { world.economy!.assets[0].context!.origins = ["missing"]; }, /unknown origin/],
  ["unknown job", world => { world.economy!.assets[0].context!.jobs = ["missing"]; }, /unknown job/],
  ["unknown activity", world => { world.economy!.assets[0].context!.activities = ["missing"]; }, /unknown activity/],
  ["empty origin list", world => { world.economy!.assets[0].context!.origins = []; }, /expected 1\.\.256 entries/],
  ["empty job list", world => { world.economy!.assets[0].context!.jobs = []; }, /expected 1\.\.128 entries/],
  ["empty activity list", world => { world.economy!.assets[0].context!.activities = []; }, /expected 1\.\.1000 entries/],
  ["duplicate origin", world => { world.economy!.assets[0].context!.origins = ["home", "home"]; }, /duplicate origin reference/],
  ["duplicate job", world => { world.economy!.assets[0].context!.jobs = ["worker", "worker"]; }, /duplicate job reference/],
  ["duplicate activity", world => { world.economy!.assets[0].context!.activities = ["repair", "repair"]; }, /duplicate activity reference/],
  ["non-array relevance list", world => { (world.economy!.assets[0].context as any).jobs = "worker"; }, /expected a JSON array/],
  ["job without a character system", world => { delete world.character; }, /unknown job/],
];
for (const [label, mutate, expected] of invalid) test(`resource metadata rejects ${label}`, () => {
  const world = pack(); mutate(world);
  assert.throws(() => validateWorld(world), expected);
});
