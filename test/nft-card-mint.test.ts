import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "../chain/hash.ts";
import { RANKED_WORLD_VERSION } from "../chain/ids.ts";
import { cardIdFor } from "../chain/card-art.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { parseMintPack, parseTokenView } from "../client/chain/wire.ts";
import { freePlayCardView, keptCardView, packCardView } from "../client/chain/nft-card-view.ts";
import { keptRows } from "../client/chain/token-page-model.ts";
import { getCardArtById } from "../client/models/card-art.ts";
import type { Evidence, LifeView } from "../chain/types.ts";
import type { SignedEvidence } from "../client/chain/types.ts";

async function signedFor(life: LifeView, sex?: "male" | "female", career: Evidence["career_group"] = "military"): Promise<SignedEvidence> {
  const evidence: Evidence = { v: 1, seed: life.seed, life_id: life.life_id, account_id: life.account_id, world_version: life.world_version,
    world_fingerprint: "f".repeat(64), save_hash: "e".repeat(64), stats: {}, skills: {}, origin_id: "clerk-household", peak_job_id: "copyist",
    accomplishments: [{ id: "a", age: 20 }, { id: "b", age: 30 }], death_age: 61, birth_year: -350, death_year: -289, career_group: career,
    matched_figures: [], sources: [], ...(sex ? { sex } : {}) };
  const evidence_json = canonicalJson(evidence);
  return { evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "ab".repeat(64), verifier_kind: "server-signer" };
}

test("a pack shows each person of the city as their career's v14 card in the player's sex", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  const pack = parseMintPack(await c.openMintPack(life.life_id, await signedFor(life, "female"), "military.mentor"));
  assert.ok(pack.cards.length >= 3);
  for (const [slot, card] of pack.cards.entries()) {
    const view = packCardView(card, slot, pack.evidence_hash, "military");
    if (card.rarity === 4) { assert.equal(card.card_id, undefined, "Legendary profession art is pending"); continue; }
    assert.equal(card.card_id, cardIdFor({ figure_id: null, rarity: card.rarity, career_group: "military", sex: "female" }));
    assert.match(card.card_id!, /^alexander-(common|uncommon|rare|epic)-female$/);
    assert.equal(card.edition_key, `card:${card.card_id}:rarity:${card.rarity}`);
    const art = getCardArtById(card.card_id!)!;
    assert.equal(view.framedArt, art.footerlessSrc, "the scene draws the approved card face");
    assert.equal(view.art, art.portraitSrc);
    assert.match(view.editionText!, /^\d{3}\/(∞|\d{3})$/);
  }
});

test("the minted NFT records the same card, serial and sex the pack showed", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  const pack = await c.openMintPack(life.life_id, await signedFor(life, "male", "sky"), "sky.omen");
  const slot = pack.cards.findIndex(card => card.card_id);
  const chosen = pack.cards[slot];
  const result = await c.chooseMintSlot(life.life_id, slot);
  assert.equal(result.edition_key, `card:${chosen.card_id}:rarity:${chosen.rarity}`);
  assert.equal(result.edition_number, chosen.next_edition_number);
  const [token] = await c.tokensOf(life.account_id);
  const parsed = parseTokenView({ owner_id: life.account_id, metadata: { extra: JSON.stringify(token.extra) } })!;
  assert.equal(parsed.extra.card_id, chosen.card_id);
  assert.equal(parsed.extra.sex, "male");
  const [row] = keptRows([{ ...parsed, token_id: token.token_id }]);
  const view = keptCardView(row);
  assert.equal(view.framedArt, getCardArtById(chosen.card_id!)!.footerlessSrc, "My lives shows the card the NFT names");
  assert.match(chosen.card_id!, /^euclid-/, "Sky careers draw Euclid's profession set");
});

test("evidence without a recorded sex keeps the earlier portrait, and old tokens never gain a guessed card", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  const pack = await c.openMintPack(life.life_id, await signedFor(life), "military.mentor");
  assert.ok(pack.cards.every(card => card.card_id === undefined));
  const view = packCardView(pack.cards[0], 0, pack.evidence_hash, "military");
  assert.equal(view.framedArt, undefined);
  assert.match(view.art, /\/assets\/portraits\/ordinary-v3\//);
});

test("chain data with a malformed card id is refused", () => {
  const card = { kind: "npc", figure_id: null, rarity: 0, affection: 50, action_id: "military.mentor" };
  const pack = { life_id: "1", evidence_hash: "a".repeat(64), total_fee: "1", source_share_bps: 0 };
  assert.throws(() => parseMintPack({ ...pack, cards: [{ ...card, card_id: "../alexander" }] }), /card/);
  assert.equal(parseMintPack({ ...pack, cards: [{ ...card, card_id: "alexander-common-male" }] }).cards[0].card_id, "alexander-common-male");
});

test("a free life's pack shows the same v14 cards, in the played character's sex", () => {
  const life = { seed: "seed-1", character: { sex: "female" } };
  const person = freePlayCardView({ kind: "npc", figure_id: null, rarity: 2, affection: 40, action_id: "farming.share-seed" }, "farming", life, "/assets/portraits/ordinary-v3/me.png");
  assert.equal(person.framedArt, getCardArtById("theophrastus-rare-female")!.footerlessSrc);
  assert.equal(person.role, "Person of the city");
  const legendary = freePlayCardView({ kind: "npc", figure_id: null, rarity: 4, affection: 40, action_id: "farming.share-seed" }, "farming", life, "/assets/portraits/ordinary-v3/me.png");
  assert.equal(legendary.framedArt, undefined, "Legendary profession art is pending: the life's own portrait stays");
  assert.equal(legendary.art, "/assets/portraits/ordinary-v3/me.png");
  const figure = freePlayCardView({ kind: "figure", figure_id: "euclid", rarity: 4, affection: 40, action_id: "euclid.school" }, "sky", life, "/x.png");
  assert.equal(figure.framedArt, getCardArtById("euclid-parent")!.footerlessSrc);
});
