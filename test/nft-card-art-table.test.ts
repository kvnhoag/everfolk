import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CARD_ART_CAREER_FIGURE, buildCardArtTable, cardArtFor, cardIdFor } from "../chain/card-art.ts";
import { CAREER_GROUPS, FIGURE_IDS } from "../chain/ids.ts";
import { RARITY_CAPS } from "../chain/rarity-caps.ts";

const manifest = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/manifest.json", import.meta.url), "utf8"));
const known = new Set([...manifest.assets, ...manifest.parentVariants].map((card: { id: string }) => card.id));
const table = buildCardArtTable(manifest, "https://everfolk.life");

test("each career draws from one figure's v14 profession set", () => {
  assert.deepEqual(CARD_ART_CAREER_FIGURE, {
    military: "alexander", letters: "aristotle", commerce: "cleomenes", craft: "lysippos",
    sky: "euclid", performance: "menander", farming: "theophrastus",
  });
  assert.deepEqual(Object.keys(CARD_ART_CAREER_FIGURE).sort(), [...CAREER_GROUPS].sort());
});

test("a person of the city gets their career's profession card at their rarity, in the player's sex", () => {
  assert.equal(cardIdFor({ figure_id: null, rarity: 0, career_group: "military", sex: "female" }), "alexander-common-female");
  assert.equal(cardIdFor({ figure_id: null, rarity: 3, career_group: "sky", sex: "male" }), "euclid-epic-male");
  assert.equal(cardIdFor({ figure_id: null, rarity: 1, career_group: "farming", sex: undefined }), null, "an unrecorded sex is never guessed");
  assert.equal(cardIdFor({ figure_id: null, rarity: 4, career_group: "letters", sex: "male" }), null, "no Legendary profession art exists yet");
});

test("a historical figure gets its main card, or the runtime variant for another rarity", () => {
  assert.equal(cardIdFor({ figure_id: "alexander", rarity: 4, career_group: "military", sex: "male" }), "alexander-parent");
  assert.equal(cardIdFor({ figure_id: "alexander", rarity: 2, career_group: "military", sex: "male" }), "alexander-parent-rare");
  assert.equal(cardIdFor({ figure_id: "cleomenes", rarity: 3, career_group: "commerce", sex: null }), "cleomenes-parent");
  assert.equal(cardIdFor({ figure_id: "cleomenes", rarity: 4, career_group: "commerce", sex: null }), "cleomenes-parent-legendary");
});

test("the contract's card table covers every reachable card with an absolute image and the face's title", () => {
  assert.equal(table.length, FIGURE_IDS.length * 5 + CAREER_GROUPS.length * 4 * 2);
  for (const entry of table) {
    assert.ok(known.has(entry.card_id), `${entry.card_id} is in the v14 collection`);
    assert.match(entry.media, /^https:\/\/everfolk\.life\/assets\/cards\/collection-v14\/[a-z0-9-]+-footerless\.webp$/);
    assert.ok(entry.title.length > 2 && entry.title.length <= 64, entry.card_id);
    assert.equal(entry.edition_limit, RARITY_CAPS[entry.rarity]);
    assert.equal(cardIdFor(entry), entry.card_id, "the table agrees with the shared rule");
    assert.equal(cardArtFor(table, entry)?.card_id, entry.card_id);
  }
  assert.equal(new Set(table.map(entry => entry.card_id)).size, table.length);
  assert.equal(table.find(entry => entry.card_id === "alexander-parent")?.title, "Alexander the Great");
  assert.equal(table.find(entry => entry.card_id === "alexander-common-male")?.title, "Campaign Soldier");
});

test("the table rejects a relative image base, which wallets cannot load", () => {
  assert.throws(() => buildCardArtTable(manifest, "/assets"), /absolute https/);
  assert.equal(buildCardArtTable(manifest, "https://cdn.example/x/")[0].media.startsWith("https://cdn.example/x/assets/"), true);
});
