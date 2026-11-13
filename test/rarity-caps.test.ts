import assert from "node:assert/strict";
import test from "node:test";
import { RARITY_CAPS, designKey, openRarityWeights, raritySupplyText } from "../chain/rarity-caps.ts";

const NPC = [6000, 2500, 1000, 400, 100];

test("each card design has 10 Legendary, 25 Epic and 100 Rare copies; Common and Uncommon are unlimited", () => {
  assert.deepEqual(RARITY_CAPS, [null, null, 100, 25, 10]);
  assert.equal(designKey("alexander", "letters.teach"), "figure:alexander");
  assert.equal(designKey(null, "letters.teach"), "npc:letters.teach");
});

test("sold-out rarities leave the roll and the others keep their odds, as the contract does", () => {
  assert.deepEqual(openRarityWeights(NPC, () => 0), NPC);
  assert.deepEqual(openRarityWeights(NPC, rarity => (rarity === 4 ? 10 : 0)), [6000, 2500, 1000, 400, 0]);
  assert.deepEqual(openRarityWeights(NPC, rarity => (rarity === 3 ? 24 : 0)), NPC, "24 of 25 Epic leaves one");
  assert.deepEqual(openRarityWeights(NPC, () => 1_000), [6000, 2500, 0, 0, 0]);
});

test("supply reads as copies left, or unlimited", () => {
  assert.equal(raritySupplyText(4, 7), "3 of 10 left");
  assert.equal(raritySupplyText(2, 100), "Sold out");
  assert.equal(raritySupplyText(0, 9999), "Unlimited");
});
