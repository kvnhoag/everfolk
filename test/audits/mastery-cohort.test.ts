import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../../src/engine.ts";
import { runFocusedPolicy, FOCUSED_TARGETS } from "../../scripts/skills/focused-policy.ts";
import { buildCohortReport } from "../../scripts/skills/evaluate-focus.mjs";
import type { WorldPack } from "../../src/types.ts";
import shipped from "../../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import evidence from "../../design/skill-tree/mastery-cohort-evidence.json" with { type: "json" };

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

test("cohort evaluator publishes revision, uncertainty, resource bottlenecks, and wealth comparison", () => {
  const sample = buildCohortReport(world, { count: 2, targets: ["FC10", "AT10"], includeLives: false });
  const { fingerprint } = createEngine(world);
  assert.equal(sample.worldVersion, "alexandria-lives-8");
  assert.equal(sample.worldFingerprint, fingerprint);
  assert.equal(sample.results.length, 2);
  for (const row of sample.results) {
    assert.equal(row.ci95Percent.length, 2);
    assert.ok("diedBefore18" in row && "adultMasteryPercent" in row && "medianMasteryAge" in row);
    assert.ok("bottleneckAtStop" in row && "turnDiagnostics" in row);
    assert.equal(row.wealthComparison.lowWealth.attempts + row.wealthComparison.ordinary.attempts, row.attempts);
  }
});

test("published mastery cohort evidence matches current shipped world fingerprint and schema", () => {
  const { fingerprint } = createEngine(world);
  assert.equal(evidence.worldVersion, "alexandria-lives-8");
  assert.equal(evidence.worldFingerprint, fingerprint);
  assert.equal(evidence.cohortSizePerTarget, 100);
  assert.equal(evidence.seeds, "skill-focus-0 … skill-focus-99");
  assert.deepEqual(evidence.results.map(r => r.target), [...FOCUSED_TARGETS]);
  for (const row of evidence.results) {
    assert.equal(row.attempts, 100);
    assert.equal(row.lives.length, 100);
    assert.equal(row.wealthComparison.lowWealth.attempts + row.wealthComparison.ordinary.attempts, 100);
    assert.ok(row.turnDiagnostics.adultTurns > 0);
  }
});
