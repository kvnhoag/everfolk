import assert from "node:assert/strict";
import test from "node:test";
import { FIGURE_RANK_POLICY, rosterRankFor, type ResolvedFigureMilestone } from "../chain/catalog/figure-ranks.ts";

test("the agreed fixed Legendary and Epic roster stays strict", () => {
  for (const id of ["alexander", "aristotle", "euclid", "lysippos", "menander"] as const) {
    assert.equal(rosterRankFor(id).rarity, 4, id);
  }
  for (const id of ["pytheas", "theophrastus", "cleomenes"] as const) {
    assert.equal(rosterRankFor(id).rarity, 3, id);
  }
  assert.equal(new Set(FIGURE_RANK_POLICY.map(rule => rule.figureId)).size, 11);
});

test("Rhodes must actually be captured in an explicit alternate-history branch", () => {
  for (const resolution of ["attempted", "failed", "succeeded"] as const) {
    for (const branch of ["historical", "alternate-history"] as const) {
      const result = rosterRankFor("demetrius", [{ figureId: "demetrius", milestone: "rhodes-captured", resolution, branch }]);
      const earnsLegendary = resolution === "succeeded" && branch === "alternate-history";
      assert.equal(result.rank, earnsLegendary ? "Legendary" : "Epic");
      assert.equal(result.alternateHistory, earnsLegendary);
    }
  }
});

test("Ptolemy needs a successful dynasty founding before the Legendary tier and founder title", () => {
  assert.equal(rosterRankFor("ptolemy").title, "Ptolemy I Soter");
  for (const resolution of ["attempted", "failed", "succeeded"] as const) {
    const result = rosterRankFor("ptolemy", [{ figureId: "ptolemy", milestone: "ptolemaic-dynasty-founded", resolution, branch: "historical" }]);
    assert.equal(result.rank, resolution === "succeeded" ? "Legendary" : "Epic");
    assert.equal(result.title.includes("dynasty founder"), resolution === "succeeded");
  }
});

test("Zeno's provisional Legendary gate requires an established Stoic school", () => {
  for (const resolution of ["attempted", "failed", "succeeded"] as const) {
    const result = rosterRankFor("zeno", [{ figureId: "zeno", milestone: "stoic-school-established", resolution, branch: "historical" }]);
    assert.equal(result.rank, resolution === "succeeded" ? "Legendary" : "Epic");
    assert.equal(result.title.includes("founder of Stoicism"), resolution === "succeeded");
  }
});

test("one figure's successful milestone cannot promote another or lift the fixed Epic ceiling", () => {
  const milestones: ResolvedFigureMilestone[] = [{ figureId: "ptolemy", milestone: "ptolemaic-dynasty-founded", resolution: "succeeded", branch: "historical" }];
  const snapshot = structuredClone(milestones);
  for (const id of ["demetrius", "zeno", "theophrastus", "cleomenes", "pytheas"] as const) assert.equal(rosterRankFor(id, milestones).rank, "Epic");
  assert.deepEqual(milestones, snapshot);
  assert.equal(rosterRankFor("ptolemy", milestones).rank, rosterRankFor("ptolemy", milestones).rank);
});
