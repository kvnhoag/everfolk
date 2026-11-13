import assert from "node:assert/strict";
import test from "node:test";
import type { MintCard, MintResult } from "../chain/types.ts";
import { boosterArtwork, keptCardView, packCardView, refreshSavedBoosterCard, resultCardView } from "../client/chain/nft-card-view.ts";
import { keptRows } from "../client/chain/token-page-model.ts";
import { actionName, figureTitle } from "../client/chain/chain-copy.ts";
import { figureMediaPath } from "../chain/figure-media.ts";
import { getFigureCardArt } from "../client/models/card-art.ts";
import { LEGACY_LABELS, NFT_LABELS, resolveBoosterLabels, reviewHint } from "../client/lib/booster/labels.mjs";

const npcCard: MintCard = { kind: "npc", figure_id: null, rarity: 1, affection: 60, action_id: "craft.weave" };
const figureCard: MintCard = { kind: "figure", figure_id: "alexander", rarity: 3, affection: 80, action_id: "alexander.levy" };

test("a pack card becomes a 3D card with its figure art, rarity and deed", () => {
  const card = packCardView(figureCard, 0, "f".repeat(64), "letters");
  const art = getFigureCardArt("alexander", 3)!;
  assert.equal(card.name, figureTitle("alexander"));
  assert.equal(card.rarity, 3);
  assert.equal(card.sub, actionName("alexander.levy"));
  assert.equal(card.art, art.portraitSrc);
  assert.equal(card.framedArt, art.footerlessSrc);
  assert.equal(card.editionText, "—/025", "an unminted draw must not acquire the creator's example 001 serial");
});

test("a person-of-the-city card uses its stage portrait, or a stable generated portrait", () => {
  const staged = packCardView({ ...npcCard, character_name: "Kallias", portrait_media: "/assets/pixel/portraits/a.svg" }, 1, "e".repeat(64), "craft");
  assert.equal(staged.name, "Kallias");
  assert.equal(staged.art, "/assets/pixel/portraits/a.svg");
  const plain = packCardView(npcCard, 2, "e".repeat(64), "craft");
  assert.match(plain.art, /^\/assets\/pixel\/portraits\/.+\.svg$/);
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
  const view = keptCardView(row);
  assert.equal(view.name, row.title);
  assert.equal(view.rarity, 2);
  assert.equal(view.art, getFigureCardArt("alexander", 2)!.portraitSrc);
  assert.equal(view.framedArt, getFigureCardArt("alexander", 2)!.footerlessSrc);
  assert.equal(view.sub, row.actionName);
  assert.equal(view.editionText, "—/100");
});

test("retained NFT ranks and recorded editions select matching approved faces", () => {
  for (let rarity = 0; rarity <= 4; rarity++) {
    const view = resultCardView({ token_id: "999", kind: "figure", figure_id: "alexander", rarity, affection: 90, edition_number: 7, edition_limit: rarity < 2 ? null : [null, null, 100, 25, 10][rarity] });
    const art = getFigureCardArt("alexander", rarity)!;
    assert.equal(view.rarity, rarity);
    assert.equal(view.framedArt, art.footerlessSrc);
    assert.equal(view.editionText, rarity < 2 ? "007/∞" : `007/${String(art.editionLimit).padStart(3, "0")}`);
    assert.doesNotMatch(view.editionText!, /999/, "the token id is not a copy serial");
  }
});

test("custom stage portraits stay authoritative, including on figure records", () => {
  const custom = "/assets/portraits/ordinary-v3/my-person.png";
  assert.deepEqual(boosterArtwork("alexander", 4, custom, "seed", "007/010"), { art: custom });
  const oldMedia = boosterArtwork("alexander", 4, "https://everfolk.example/assets/figures/alexander.png", "seed", "007/010");
  assert.equal(oldMedia.framedArt, getFigureCardArt("alexander", 4)!.footerlessSrc);
  assert.equal(oldMedia.editionText, "007/010");
});

test("saved figure previews upgrade only their view, leaving selections and identities untouched", () => {
  const saved = { name: "Alexander", rarity: 3, art: figureMediaPath("alexander"), sub: "Found and build" };
  const before = JSON.stringify(saved);
  const view = refreshSavedBoosterCard(saved);
  assert.equal(JSON.stringify(saved), before);
  assert.equal(view.name, saved.name);
  assert.equal(view.sub, saved.sub);
  assert.equal(view.rarity, saved.rarity);
  assert.equal(view.framedArt, getFigureCardArt("alexander", 3)!.footerlessSrc);
  const citizen = { ...saved, name: "Alexander", art: "/assets/pixel/portraits/ordinary.svg" };
  assert.equal(refreshSavedBoosterCard(citizen), citizen, "a person's name never assigns them historical figure art");
});

test("NFT views name NEAR, not the free Legacy collection", () => {
  assert.deepEqual(resolveBoosterLabels(undefined), LEGACY_LABELS);
  assert.equal(resolveBoosterLabels(NFT_LABELS).footer, "WEAVE MODE · MINTED ON NEAR");
  assert.equal(NFT_LABELS.showCount, false);
  assert.doesNotMatch(JSON.stringify(NFT_LABELS), /Legacy|memorial|FREE TO PLAY/);
  assert.equal(reviewHint(NFT_LABELS, 1, "Alexander", 0), "Your NFT · Alexander");
  assert.equal(reviewHint(LEGACY_LABELS, 3, "Kallias", 1), "3 saved to Legacy · Kallias · 2 / 3");
});
