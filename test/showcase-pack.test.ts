import assert from "node:assert/strict";
import test from "node:test";
import { allCardArt, CARD_ART_RANKS } from "../client/models/card-art.ts";
import { createShowcasePackCards } from "../client/models/showcase-pack.ts";

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("showcase draws always contain five distinct approved cards and at least one Legendary", () => {
  const artworks = new Map(allCardArt.map(art => [art.footerlessSrc, art]));
  for (const random of [() => 0, () => 1 - Number.EPSILON, ...Array.from({ length: 512 }, (_, seed) => seededRandom(seed))]) {
    const cards = createShowcasePackCards(random);
    assert.equal(cards.length, 5);
    assert.equal(new Set(cards.map(card => card.framedArt)).size, 5);
    assert.ok(cards.some(card => card.rarity === CARD_ART_RANKS.indexOf("legendary")));
    for (const card of cards) {
      const art = artworks.get(card.framedArt!);
      assert.ok(art, "each draw uses the current approved collection");
      assert.equal(card.rarity, CARD_ART_RANKS.indexOf(art.rarity), "rarity effects match the approved card face");
      assert.match(card.editionText!, /^—\//, "showcase cards do not claim a minted edition");
    }
  }
});

test("fresh draws vary the cards and reveal order, allow extra Legendaries and reach the whole collection", () => {
  const random = seededRandom(42);
  const packs = Array.from({ length: 1024 }, () => createShowcasePackCards(random));
  const signatures = new Set(packs.map(cards => cards.map(card => card.framedArt).join(",")));
  const drawnArtwork = new Set(packs.flatMap(cards => cards.map(card => card.framedArt)));
  const legendaryPositions = new Set(packs.flatMap(cards => cards.flatMap((card, index) => card.rarity === 4 ? [index] : [])));
  assert.equal(signatures.size, packs.length);
  assert.equal(drawnArtwork.size, allCardArt.length);
  assert.equal(legendaryPositions.size, 5);
  assert.ok(packs.some(cards => cards.filter(card => card.rarity === 4).length > 1));
});
