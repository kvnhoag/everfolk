import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";

function weightedPack(weight: number): WorldPack {
  return {
    schemaVersion: 1,
    id: "weight-scaling",
    version: "1",
    title: "Weight scaling regression",
    description: "Fictional test data.",
    startYear: 1,
    maxAge: 2,
    stats: { health: { label: "Health", min: 0, max: 10, initial: 5 } },
    flags: {},
    origins: [
      { id: "first", title: "First", text: "First birth.", weight, effects: [] },
      { id: "second", title: "Second", text: "Second birth.", weight, effects: [] },
    ],
    yearlyEffects: [],
    events: [],
    endings: [{ id: "complete", title: "Complete", text: "Life complete." }],
    defaultEnding: "complete",
  };
}

test("equal positive birth weights retain the same odds at subnormal scale", () => {
  const normal = createEngine(weightedPack(1));
  const subnormal = createEngine(weightedPack(Number.MIN_VALUE));
  for (let i = 0; i < 100; i++) {
    const seed = `scale-${i}`;
    assert.equal(subnormal.start(seed).originId, normal.start(seed).originId, `birth weights changed the result for ${seed}`);
  }
});

test("equal positive outcome weights retain the same odds at subnormal scale", () => {
  function outcomeEngine(weight: number) {
    const pack = weightedPack(1);
    pack.origins = [pack.origins[0]];
    pack.events = [{
      id: "choice", title: "Choice", text: "A test decision.", trigger: { type: "age", at: 0 },
      choices: [{ id: "try", text: "Try", outcomes: [
        { id: "first", text: "First result.", weight, effects: [{ type: "stat", stat: "health", delta: 1 }] },
        { id: "second", text: "Second result.", weight, effects: [{ type: "stat", stat: "health", delta: -1 }] },
      ] }],
    }];
    return createEngine(pack);
  }
  const normal = outcomeEngine(1);
  const subnormal = outcomeEngine(Number.MIN_VALUE);
  for (let i = 0; i < 100; i++) {
    const seed = `scale-${i}`;
    assert.equal(
      subnormal.choose(subnormal.start(seed), "try").stats.health,
      normal.choose(normal.start(seed), "try").stats.health,
      `outcome weights changed the result for ${seed}`,
    );
  }
});
