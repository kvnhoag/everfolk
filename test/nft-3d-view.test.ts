import assert from "node:assert/strict";
import test from "node:test";
import type { MintCard, MintResult } from "../chain/types.ts";
import { FIGURE_CARD_ART, figureCardArt, keptCardView, packCardView, resultCardView } from "../client/chain/nft-card-view.ts";
import { keptRows } from "../client/chain/token-page-model.ts";
import { actionName, figureTitle } from "../client/chain/chain-copy.ts";
import { figureMediaPath } from "../chain/figure-media.ts";
import { LEGACY_LABELS, NFT_LABELS, WEAVE_PACK_LABELS, resolveBoosterLabels, reviewHint } from "../client/lib/booster/labels.mjs";

const npcCard: MintCard = { kind: "npc", figure_id: null, rarity: 1, affection: 60, action_id: "craft.weave" };
const figureCard: MintCard = { kind: "figure", figure_id: "alexander", rarity: 3, affection: 80, action_id: "alexander.levy" };

test("a pack card becomes a 3D card with its figure's card art, rarity, role and deed", () => {
  const card = packCardView(figureCard, 0, "f".repeat(64), "letters");
  assert.deepEqual(card, { name: figureTitle("alexander"), rarity: 3, art: figureCardArt("alexander"), sub: actionName("alexander.levy"), role: "Historical figure" });
});

test("Alexander uses the approved card painting; other figures keep their figure art", () => {
  assert.equal(figureCardArt("alexander"), "/assets/cards/figures/alexander.png");
  assert.equal(figureCardArt("euclid"), figureMediaPath("euclid"));
  for (const art of Object.values(FIGURE_CARD_ART)) assert.match(art, /^\/assets\/cards\/figures\/[a-z-]+\.png$/);
});

test("a person-of-the-city card uses its stage portrait, or a stable generated portrait", () => {
  const staged = packCardView({ ...npcCard, character_name: "Kallias", portrait_media: "/assets/pixel/portraits/a.svg" }, 1, "e".repeat(64), "craft");
  assert.equal(staged.name, "Kallias");
  assert.equal(staged.art, "/assets/pixel/portraits/a.svg");
  const plain = packCardView(npcCard, 2, "e".repeat(64), "craft");
  assert.match(plain.art, /^\/assets\/portraits\/ordinary-v3\/ef-p-[mf]\d\d-[a-z]+-work-v3\.png$/, "a craft card wears work clothes from the v3 portraits");
  assert.equal(plain.role, "Person of the city");
  assert.match(packCardView(npcCard, 2, "e".repeat(64), "military").art, /-military-v3\.png$/);
  assert.match(packCardView(npcCard, 2, "e".repeat(64), "letters").art, /-scholarly-v3\.png$/);
  assert.deepEqual(packCardView(npcCard, 2, "e".repeat(64), "craft"), plain, "the same slot always draws the same portrait");
});

test("a mint result becomes the minted NFT's 3D card", () => {
  const result: MintResult = { token_id: "42", kind: "figure", figure_id: "alexander", rarity: 4, affection: 90 };
  const card = resultCardView(result, "letters", "alexander.found");
  assert.equal(card.name, figureTitle("alexander"));
  assert.equal(card.rarity, 4);
  assert.equal(card.sub, actionName("alexander.found"));
  assert.equal(resultCardView({ ...result, kind: "npc", figure_id: null, rarity: 0 }, "farming").sub, "Kept on NEAR", "without a deed it says where it lives");
});

test("an owned NFT in My lives opens as its own 3D card", () => {
  const [row] = keptRows([{ token_id: "7", owner_id: "me.testnet", extra: { kind: "figure", figure_id: "alexander", rarity: 2, affection: 70, action_id: "alexander.levy", life_id: "1", birth_year: -350, death_year: -300, career_group: "military", sources: [], evidence_hash: "a".repeat(64) } } as never]);
  assert.deepEqual(keptCardView(row), { name: row.title, rarity: 2, art: figureCardArt("alexander"), sub: row.actionName, role: "Historical figure" });
});

test("NFT views name NEAR, not the free Legacy collection", () => {
  assert.deepEqual(resolveBoosterLabels(undefined), LEGACY_LABELS);
  assert.equal(resolveBoosterLabels(NFT_LABELS).footer, "WEAVE MODE · MINTED ON NEAR");
  assert.equal(NFT_LABELS.showCount, false);
  assert.doesNotMatch(JSON.stringify(NFT_LABELS), /Legacy|memorial|FREE TO PLAY/);
  assert.equal(reviewHint(NFT_LABELS, 1, "Alexander", 0), "Your NFT · Alexander");
  assert.equal(reviewHint(LEGACY_LABELS, 3, "Kallias", 1), "3 saved to Legacy · Kallias · 2 / 3");
});

test("a Weave pack is labelled as a verified pack, not the free Legacy collection", () => {
  assert.equal(WEAVE_PACK_LABELS.tag, "WEAVE MODE PACK");
  assert.equal(WEAVE_PACK_LABELS.footer, "WEAVE MODE · VERIFIED PACK");
  assert.equal(WEAVE_PACK_LABELS.showCount, false);
  assert.doesNotMatch(JSON.stringify(WEAVE_PACK_LABELS), /Legacy|PERSONAL|FREE TO PLAY/);
});
