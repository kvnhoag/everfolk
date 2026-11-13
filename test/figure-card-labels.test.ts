import test from "node:test";
import assert from "node:assert/strict";
import { cardVariantLabel, figureRarityLabel } from "../client/models/figure-card-labels.ts";
import { figureRosterEntry } from "../chain/catalog/figure-roster.ts";

test("all three conditionally Legendary figures advertise both legal rarities", () => {
  for (const id of ["demetrius", "ptolemy", "zeno"]) assert.equal(figureRarityLabel(figureRosterEntry(id)!), "Epic–Legendary");
  for (const id of ["pytheas", "theophrastus", "cleomenes"]) assert.equal(figureRarityLabel(figureRosterEntry(id)!), "Epic");
  for (const id of ["alexander", "aristotle", "euclid", "lysippos", "menander"]) assert.equal(figureRarityLabel(figureRosterEntry(id)!), "Legendary");
});

test("range labels use rarity order, preserve inputs and do not invent extra variants", () => {
  const ranks = ["Epic", "Uncommon", "Rare", "Epic"] as const;
  assert.equal(cardVariantLabel(ranks), "Uncommon–Epic");
  assert.deepEqual(ranks, ["Epic", "Uncommon", "Rare", "Epic"]);
  assert.equal(cardVariantLabel(["Legendary", "Common", "Rare"]), "Common–Legendary");
  assert.equal(cardVariantLabel(["Epic", "Epic"]), "Epic");
  assert.equal(cardVariantLabel([]), "");
});
