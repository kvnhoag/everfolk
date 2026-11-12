import { test } from "node:test";
import assert from "node:assert/strict";
import { runFocusedPolicy, FOCUSED_TARGETS } from "../scripts/skills/focused-policy.ts";
import type { WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };

const world = shipped as unknown as WorldPack;

test("focused play can master every specialization in the new free-play world", () => {
  for (const target of FOCUSED_TARGETS) {
    let mastered = false, last = "";
    for (let i = 0; i < 4 && !mastered; i++) {
      const life = runFocusedPolicy(world, target, `skill-focus-${i}`);
      mastered = life.mastered; last = `${life.next}: ${life.reason}`;
    }
    assert.ok(mastered, `${target} not mastered in 4 focused lives (last stop ${last})`);
  }
});

test("a focused scholar no longer starves in early adulthood", () => {
  // Before the household survival rules this life died of hunger at 25 with the plot fallow.
  const life = runFocusedPolicy(world, "PS10", "skill-focus-2");
  assert.ok(life.age > 25, `ended at ${life.age}`);
});
