import assert from "node:assert/strict";
import test from "node:test";
import { allCardArt, cardArtRank, cardEditionText, findCardArt, getFigureCardArt } from "../client/models/card-art.ts";

test("the approved collection covers thirteen figures and four complete gender-paired professions each", () => {
  assert.equal(allCardArt.length, 117);
  const parents = allCardArt.filter(art => art.kind === "parent");
  assert.equal(parents.length, 13);
  assert.equal(new Set(parents.map(art => art.figureId)).size, 13);
  for (const parent of parents) for (const tier of ["common", "uncommon", "rare", "epic"] as const) {
    const male = findCardArt({ figureId: parent.figureId, kind: "contribution", tier, gender: "male" });
    const female = findCardArt({ figureId: parent.figureId, kind: "contribution", tier, gender: "female" });
    assert.ok(male && female, `${parent.figureId}/${tier} requires both variants`);
    assert.notEqual(male.footerlessSrc, female.footerlessSrc);
    assert.equal(male.bodyText, female.bodyText);
    assert.equal(male.rarity, tier);
    assert.equal(female.rarity, tier);
  }
  assert.equal(getFigureCardArt("nearchus")?.kind, "parent", "artwork extends beyond the retained four NFT identifiers");
});

test("known earned titles resolve to their actual profession tier and saved gender", () => {
  assert.equal(findCardArt({ figureId: "alexander", kind: "contribution", title: "Right Hand of Alexander", gender: "female" })?.slug, "alexander-rare-female");
  assert.equal(findCardArt({ title: "General of Alexander", gender: "male" })?.slug, "alexander-epic-male");
  assert.equal(findCardArt({ title: "Disciple of Aristotle", gender: "female" })?.slug, "aristotle-epic-female");
  assert.equal(findCardArt({ figureId: "nearchus", kind: "contribution", title: "Navigator of Nearchus", gender: "female" })?.slug, "nearchus-epic-female");
  assert.equal(findCardArt({ figureId: "eumenes", kind: "contribution", title: "Secretary of Eumenes", gender: "male" })?.slug, "eumenes-epic-male");
  assert.equal(findCardArt({ figureId: "euclid", tier: 2, gender: "female" })?.slug, "euclid-rare-female");
});

test("unknown records and conflicting figures do not manufacture a title or Epic rank", () => {
  assert.equal(findCardArt({ figureId: "aristotle", kind: "contribution", title: "An unfamiliar prestige title" }), undefined);
  assert.equal(findCardArt({ figureId: "aristotle", title: "Right Hand of Alexander" }), undefined);
  assert.equal(findCardArt({ figureId: "unknown", tier: "epic" }), undefined);
  assert.equal(findCardArt({ tier: "epic" }), undefined, "a tier alone does not identify a historical profession");
  assert.equal(findCardArt({ figureId: "alexander", tier: 99 }), undefined);
  assert.equal(findCardArt({ kind: "parent" }), undefined);
  const query = { figureId: "aristotle", kind: "contribution" as const, tier: "rare" as const, seed: "an-older-life" };
  assert.equal(findCardArt(query), findCardArt(query), "older saves select stable representative art without changing identity");
});

test("parent artwork follows the token's recorded rarity instead of increasing it to the base roster rank", () => {
  assert.equal(getFigureCardArt("euclid")?.rarity, "legendary");
  assert.equal(getFigureCardArt("euclid", 2)?.rarity, "rare");
  assert.equal(getFigureCardArt("alexander", 3)?.rarity, "epic");
  assert.equal(getFigureCardArt("cleomenes", "Common")?.rarity, "common");
  assert.equal(getFigureCardArt("alexander", 99), undefined);
  assert.equal(cardArtRank(0), "common");
  assert.equal(cardArtRank(1), "uncommon");
  assert.equal(cardArtRank("Legendary"), "legendary");
});

test("edition text uses recorded serials and never substitutes the creator's example or a token id", () => {
  const art = getFigureCardArt("aristotle")!;
  assert.equal(cardEditionText(art), "—/010");
  assert.equal(cardEditionText(art, art.exampleEdition), "001/010");
  assert.equal(cardEditionText(art, "007/010"), "007/010");
  assert.equal(cardEditionText(art, "123/100"), "123/100", "recorded older copies above a newer cap stay readable");
  assert.equal(cardEditionText(art, "042 · Unlimited"), "042/∞");
  assert.equal(cardEditionText(art, "000/010"), "—/010");
  assert.equal(cardEditionText(art, "Token #42"), "—/010");
  assert.equal(cardEditionText({ editionLimit: null }), "—/∞");
});
