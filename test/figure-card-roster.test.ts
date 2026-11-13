import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { FIGURE_IDS } from "../chain/ids.ts";
import { FIGURE_RANK_POLICY } from "../chain/catalog/figure-ranks.ts";
import { FIGURE_ROSTER, figureRosterEntry } from "../chain/catalog/figure-roster.ts";
import { canPreviewFigureRank } from "../src/figures/card-progress.ts";

test("the card roster includes all eleven figures without expanding retained contract IDs", () => {
  assert.equal(FIGURE_ROSTER.length, 11);
  assert.equal(new Set(FIGURE_ROSTER.map(figure => figure.id)).size, 11);
  assert.deepEqual(FIGURE_ROSTER.map(figure => figure.id), FIGURE_RANK_POLICY.map(policy => policy.figureId));
  assert.deepEqual(FIGURE_IDS, ["alexander", "aristotle", "euclid", "cleomenes"]);
  assert.deepEqual(FIGURE_ROSTER.flatMap(figure => figure.legacyFigureId ? [figure.legacyFigureId] : []), [...FIGURE_IDS]);
  assert.equal(figureRosterEntry("alexander")!.name, "Alexander the Great");
  assert.equal(figureRosterEntry("unknown"), undefined);
});

test("each figure has public art with seven honestly marked generic placeholders", () => {
  assert.equal(FIGURE_ROSTER.filter(figure => figure.art.placeholder).length, 7);
  for (const figure of FIGURE_ROSTER) {
    assert.ok(existsSync(new URL("../public" + figure.art.src, import.meta.url)), figure.art.src);
    assert.equal(figure.art.placeholder, figure.legacyFigureId === undefined);
    assert.ok(figure.archetype.length > 0);
    assert.ok(figure.tags.length >= 3);
    assert.equal(figure.biography.id, figure.id);
  }
});

test("rarity variants preserve fixed caps and the three agreed promotion milestones", () => {
  const conditional = FIGURE_ROSTER.filter(figure => figure.variants.length > 1);
  assert.deepEqual(conditional.map(figure => figure.id), ["demetrius", "zeno", "ptolemy"]);
  for (const figure of FIGURE_ROSTER) {
    assert.equal(figure.variants[0].rank, figure.baseRank);
    assert.equal(figure.variants.at(-1)!.rank, figure.maximumRank);
    assert.ok(figure.variants.every(variant => variant.condition.length > 0));
    assert.equal(canPreviewFigureRank(figure.id, "Uncommon"), false);
  }
  for (const id of ["pytheas", "theophrastus", "cleomenes"]) assert.equal(canPreviewFigureRank(id, "Legendary"), false);
  assert.equal(figureRosterEntry("demetrius")!.variants[1].requiredMilestone, "rhodes-captured");
  assert.equal(figureRosterEntry("ptolemy")!.variants[1].requiredMilestone, "ptolemaic-dynasty-founded");
  assert.equal(figureRosterEntry("zeno")!.variants[1].requiredMilestone, "stoic-school-established");
});

test("the complete roster and nested presentation data are immutable", () => {
  assert.ok(Object.isFrozen(FIGURE_ROSTER));
  for (const figure of FIGURE_ROSTER) {
    assert.ok(Object.isFrozen(figure));
    assert.ok(Object.isFrozen(figure.art));
    assert.ok(Object.isFrozen(figure.variants));
    assert.ok(Object.isFrozen(figure.tags));
  }
  assert.throws(() => { (FIGURE_ROSTER[0].tags as string[]).push("invented"); }, TypeError);
});
