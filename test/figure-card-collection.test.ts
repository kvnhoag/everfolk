import assert from "node:assert/strict";
import test from "node:test";
import type { LegacyEntry } from "../client/storage/legacy-store.ts";
import { groupFigureCards } from "../client/models/figure-card-collection.ts";

function entry(key: string, figure?: { id: string; name: string }, lifeKey = "first-life"): LegacyEntry {
  return {
    key, lifeKey, worldId: "alexandria", worldVersion: "0.47.0", worldFingerprint: "world-revision",
    seed: lifeKey, characterName: lifeKey === "first-life" ? "Damon" : "Philista", worldTitle: "Alexandria",
    accomplishment: {
      id: `${key}:24`, achievementId: key, routeId: "philosophy", title: key, description: "An independently reviewed work.",
      kind: "ordinary", name: key, age: 24, year: -326, sourceId: `event-${key}`, outcomeId: `accepted-${key}`,
      people: ["Local readers"], ...(figure ? { figure } : {}),
    },
  };
}

test("figure parents collect their own ordered sub-cards while older career records stay separate", () => {
  const alexander = { id: "alexander", name: "Alexander" }, aristotle = { id: "aristotle", name: "Aristotle" };
  const input = [entry("local-work"), entry("alexander-duty", alexander), entry("aristotelian-observations", aristotle),
    entry("right-hand-of-alexander", alexander), entry("signature-work")];
  input[3].accomplishment.kind = "prestige";
  const before = structuredClone(input);
  Object.freeze(input);
  input.forEach(item => { Object.freeze(item.accomplishment.figure); Object.freeze(item.accomplishment); Object.freeze(item); });
  const grouped = groupFigureCards(input);
  assert.deepEqual(grouped.figures.map(group => group.figure), [alexander, aristotle]);
  assert.deepEqual(grouped.figures[0].entries.map(item => item.key), ["alexander-duty", "right-hand-of-alexander"]);
  assert.deepEqual(grouped.figures[1].entries.map(item => item.key), ["aristotelian-observations"]);
  assert.deepEqual(grouped.otherEntries.map(item => item.key), ["local-work", "signature-work"]);
  assert.equal(grouped.figures[0].entries[0], input[1], "Display grouping preserves the saved record and its provenance.");
  assert.equal(grouped.otherEntries[0], input[0]);
  assert.deepEqual(input, before, "Grouping never edits stored entries or adds an accomplishment.");
  assert.notEqual(grouped.figures[0].figure, input[1].accomplishment.figure, "Parent display metadata cannot mutate a saved sub-card.");
});

test("the same title earned in two lives remains two dated sub-cards under one figure", () => {
  const figure = { id: "euclid", name: "Euclid" };
  const first = entry("euclid-life-one", figure), second = entry("euclid-life-two", figure, "second-life");
  for (const item of [first, second]) {
    item.accomplishment.achievementId = "disciple-of-euclid";
    item.accomplishment.title = "Disciple of Euclid";
    item.accomplishment.kind = "prestige";
  }
  second.accomplishment.year = -298;
  const grouped = groupFigureCards([second, first]);
  assert.equal(grouped.figures.length, 1);
  assert.deepEqual(grouped.figures[0].entries, [second, first]);
  assert.deepEqual(grouped.figures[0].entries.map(item => [item.key, item.lifeKey, item.accomplishment.year]), [
    ["euclid-life-two", "second-life", -298], ["euclid-life-one", "first-life", -326],
  ]);
  assert.deepEqual(grouped.otherEntries, []);
});

test("independent study keeps figure attribution without requiring that figure among contacts", () => {
  const record = entry("checked-inquiry", { id: "theophrastus", name: "Theophrastus" });
  assert.equal(record.accomplishment.people.includes("Theophrastus"), false);
  const grouped = groupFigureCards([record]);
  assert.deepEqual(grouped.figures[0].figure, { id: "theophrastus", name: "Theophrastus" });
  assert.deepEqual(grouped.figures[0].entries, [record]);
  assert.equal(grouped.figures[0].entries[0].accomplishment.kind, "ordinary", "A figure parent does not manufacture a title award.");
  assert.deepEqual(groupFigureCards([]), { figures: [], otherEntries: [] });
});
