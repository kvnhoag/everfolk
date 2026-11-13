import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "../chain/hash.ts";
import { RANKED_WORLD_VERSION } from "../chain/ids.ts";
import type { EarnedCard } from "../chain/earned-cards.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { parseMintPack, parseTokenView } from "../client/chain/wire.ts";
import { freePlayCardView, keptCardView, packCardView } from "../client/chain/nft-card-view.ts";
import { keptRows } from "../client/chain/token-page-model.ts";
import { getCardArtById } from "../client/models/card-art.ts";
import type { Evidence, LifeView } from "../chain/types.ts";
import type { SignedEvidence } from "../client/chain/types.ts";

const EUCLID: EarnedCard[] = [
  { card_id: "euclid-parent", figure_id: "euclid", kind: "principal", rarity: 4 },
  { card_id: "euclid-epic-female", figure_id: "euclid", kind: "contribution", rarity: 3 },
];

async function signedFor(life: LifeView, earned?: EarnedCard[]): Promise<SignedEvidence> {
  const evidence: Evidence = { v: 1, seed: life.seed, life_id: life.life_id, account_id: life.account_id, world_version: life.world_version,
    world_fingerprint: "f".repeat(64), save_hash: "e".repeat(64), stats: {}, skills: {}, origin_id: "clerk-household", peak_job_id: "copyist",
    accomplishments: [{ id: "a", age: 20 }, { id: "b", age: 30 }], death_age: 61, birth_year: -350, death_year: -289, career_group: "letters",
    matched_figures: [], sources: [], sex: "female", ...(earned ? { earned_cards: earned } : {}) };
  const evidence_json = canonicalJson(evidence);
  return { evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "ab".repeat(64), verifier_kind: "server-signer" };
}

test("a Weave pack shows exactly the earned cards as their approved v14 faces", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  const pack = parseMintPack(await c.openMintPack(life.life_id, await signedFor(life, EUCLID), "letters.teach"));
  assert.deepEqual(pack.cards.map(card => [card.card_id, card.rarity, card.kind]), [["euclid-parent", 4, "figure"], ["euclid-epic-female", 3, "npc"]]);
  for (const [slot, card] of pack.cards.entries()) {
    const view = packCardView(card, slot, pack.evidence_hash, "letters");
    const art = getCardArtById(card.card_id!)!;
    assert.equal(card.edition_key, `card:${card.card_id}:rarity:${card.rarity}`);
    assert.equal(view.framedArt, art.footerlessSrc, "the scene draws the approved card face");
    assert.equal(view.name, art.displayTitle || art.title);
    assert.match(view.editionText!, /^\d{3}\/(∞|\d{3})$/);
  }
});

test("a life that earned no card opens no pack, and earned evidence never mints by roll", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  await assert.rejects(c.openMintPack(life.life_id, await signedFor(life, []), "letters.teach"), /earned no card/);
  await assert.rejects(c.mintLife(life.life_id, await signedFor(life, EUCLID), "letters.teach"), /pack/);
});

test("the minted NFT records the earned card and serial the pack showed", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  const pack = await c.openMintPack(life.life_id, await signedFor(life, EUCLID), "letters.teach");
  const result = await c.chooseMintSlot(life.life_id, 1);
  assert.equal(result.edition_key, "card:euclid-epic-female:rarity:3");
  assert.equal(result.edition_number, pack.cards[1].next_edition_number);
  const [token] = await c.tokensOf(life.account_id);
  const parsed = parseTokenView({ owner_id: life.account_id, metadata: { extra: JSON.stringify(token.extra) } })!;
  assert.equal(parsed.extra.card_id, "euclid-epic-female");
  const view = keptCardView(keptRows([{ ...parsed, token_id: token.token_id }])[0]);
  assert.equal(view.framedArt, getCardArtById("euclid-epic-female")!.footerlessSrc, "My lives shows the card the NFT names");
});

test("chain data with a malformed card id is refused", () => {
  const card = { kind: "npc", figure_id: null, rarity: 0, affection: 50, action_id: "letters.teach" };
  const pack = { life_id: "1", evidence_hash: "a".repeat(64), total_fee: "1", source_share_bps: 0 };
  assert.throws(() => parseMintPack({ ...pack, cards: [{ ...card, card_id: "../alexander" }] }), /card/);
  assert.equal(parseMintPack({ ...pack, cards: [{ ...card, card_id: "aristotle-common-male" }] }).cards[0].card_id, "aristotle-common-male");
});

test("a free life's pack card shows its earned v14 card", () => {
  const life = { seed: "seed-1" };
  const contributor = freePlayCardView({ kind: "npc", figure_id: null, rarity: 2, affection: 40, action_id: "farming.share-seed", card_id: "theophrastus-rare-female" }, "farming", life, "/x.png");
  assert.equal(contributor.framedArt, getCardArtById("theophrastus-rare-female")!.footerlessSrc);
  assert.equal(contributor.role, "Contributor");
  const figure = freePlayCardView({ kind: "figure", figure_id: "euclid", rarity: 4, affection: 40, action_id: "euclid.school", card_id: "euclid-parent" }, "sky", life, "/x.png");
  assert.equal(figure.framedArt, getCardArtById("euclid-parent")!.footerlessSrc);
  assert.equal(figure.role, "Historical figure");
});
