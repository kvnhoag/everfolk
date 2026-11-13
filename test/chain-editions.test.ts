import assert from "node:assert/strict";
import test from "node:test";
import { editionKey, editionLimit, RARITY_EDITION_LIMITS } from "../chain/editions.ts";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "../chain/hash.ts";
import { RANKED_WORLD_VERSION } from "../chain/ids.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { createLivesContract } from "../client/chain/contract.ts";
import { resolveChainConfig } from "../client/chain/config.ts";
import { parseEditionSupply, parseMintResult, parseTokenView, parseMintPack, parseStageMintQuote } from "../client/chain/wire.ts";
import type { Evidence, LifeView } from "../chain/types.ts";
import type { SignedEvidence, WalletSession } from "../client/chain/types.ts";

async function signedFor(life: LifeView, stage = false, historical = false): Promise<SignedEvidence> {
  const record = { stageId: "adult", title: "A working life", fromAge: 18, toAge: 39, district: "rhakotis", field: "letters", tier: "practitioner", topSkills: { literacy: 30 }, nodes: [], reputation: 20, accomplishments: [], mentors: [] };
  const evidence: Evidence = { v: 1, seed: life.seed, life_id: life.life_id, account_id: life.account_id, world_version: life.world_version,
    world_fingerprint: "f".repeat(64), save_hash: "e".repeat(64), stats: {}, skills: {}, origin_id: "clerk-household", peak_job_id: "copyist",
    accomplishments: [], death_age: 61, birth_year: -350, death_year: -289, career_group: "letters", matched_figures: historical ? ["euclid"] : [], sources: [],
    ...(stage ? { stage_records: [record], stage_figures: [{ stageId: "adult", kind: historical ? "historical" : "generic", ...(historical ? { figureId: "euclid" as const } : {}), title: record.title, name: "Person "+life.life_id, characterName: "Person "+life.life_id, summary: "A working life.", media: "/portrait.svg", stageRecord: record }] } : {}) };
  const evidence_json = canonicalJson(evidence);
  return { evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "ab".repeat(64), verifier_kind: "server-signer" };
}

test("edition caps and card identities keep rarities and designs independent", () => {
  assert.deepEqual(RARITY_EDITION_LIMITS, [null, null, 100, 25, 10]);
  assert.throws(() => editionLimit(5), /rarity/);
  // A card from the v14 collection is its own design, as the contract counts it (contract/src/card_art.rs).
  assert.equal(editionKey({ figure_id: "euclid", career_group: "letters", rarity: 4 }), "card:euclid-parent:rarity:4");
  assert.equal(editionKey({ figure_id: "euclid", career_group: "letters", rarity: 2 }), "card:euclid-parent-rare:rarity:2");
  assert.equal(editionKey({ figure_id: null, career_group: "military", rarity: 3, sex: "female" }), "card:alexander-epic-female:rarity:3");
  assert.notEqual(editionKey({ figure_id: null, career_group: "military", rarity: 3, sex: "male" }), editionKey({ figure_id: null, career_group: "military", rarity: 3, sex: "female" }));
  // Without a recorded sex, or for a Legendary person of the city, the earlier career design remains.
  assert.equal(editionKey({ figure_id: null, career_group: "letters", rarity: 0 }), "npc:letters:rarity:0");
  assert.equal(editionKey({ figure_id: null, career_group: "letters", rarity: 4, sex: "male" }), "npc:letters:rarity:4");
  const stage = { figure_id: null, career_group: "letters", rarity: 1, stage_id: "adult", stage_record: { district: "rhakotis", field: null, tier: "learner" } };
  assert.equal(editionKey(stage), 'stage:["adult","rhakotis",null,"learner"]:rarity:1');
  assert.notEqual(editionKey(stage), editionKey({ ...stage, stage_record: { ...stage.stage_record, tier: 1 } }));
  assert.notEqual(editionKey(stage), editionKey({ ...stage, rarity: 0 }));
});

test("supply views return current minted plus one and null only for exhausted finite editions", async () => {
  const c = createMockContract({ genesis: false });
  const key = "npc:letters:rarity:4";
  assert.deepEqual(await c.editionSupply(key, 4), { edition_key: key, rarity: 4, minted: 0, next_edition_number: 1, edition_limit: 10 });
  for (let i = 1; i <= 10; i++) {
    const id = c.seedToken({ owner_id: "seed.testnet", kind: "npc", career_group: "letters", rarity: 4, affection: 50 });
    assert.equal((await c.token(id))!.extra.edition_number, i);
  }
  assert.deepEqual(await c.editionSupply(key, 4), { edition_key: key, rarity: 4, minted: 10, next_edition_number: null, edition_limit: 10 });
  assert.throws(() => c.seedToken({ owner_id: "seed.testnet", kind: "npc", career_group: "letters", rarity: 4, affection: 50 }), /sold out/);
  const next = c.seedToken({ owner_id: "seed.testnet", kind: "npc", career_group: "military", rarity: 4, affection: 50 });
  assert.equal(next, "11", "an exhausted edition does not consume a global token id");
  assert.equal((await c.token(next))!.extra.edition_number, 1);
  assert.equal((await c.editionSupply("npc:letters:rarity:3", 3)).minted, 0);
});

test("Common and Uncommon retain sequential serials past 100 without a finite cap", async () => {
  const c = createMockContract({ genesis: false });
  for (const rarity of [0, 1]) {
    let last = "";
    for (let i = 0; i < 105; i++) last = c.seedToken({ owner_id: "seed.testnet", kind: "npc", career_group: "letters", rarity, affection: 50 });
    const extra = (await c.token(last))!.extra;
    assert.equal(extra.edition_number, 105);
    assert.equal(extra.edition_limit, null);
    assert.equal((await c.editionSupply(`npc:letters:rarity:${rarity}`, rarity)).next_edition_number, 106);
  }
});

test("mint receipts, recovery and collection reads preserve the assigned serial", async () => {
  const c = createMockContract({ genesis: false });
  for (let rarity = 0; rarity < 5; rarity++) for (let i = 0; i < 3; i++) c.seedToken({ owner_id: "seed.testnet", kind: "npc", career_group: "letters", rarity, affection: 50 });
  const life = await c.startLife(RANKED_WORLD_VERSION);
  const minted = await c.mintLife(life.life_id, await signedFor(life), "letters.teach");
  assert.equal(minted.edition_number, 4);
  assert.equal(minted.edition_limit, editionLimit(minted.rarity));
  assert.equal((await c.editionSupply(minted.edition_key!, minted.rarity)).next_edition_number, 5);
  assert.deepEqual(await c.retryMint(life.life_id), minted);
  assert.deepEqual(await c.mintResult(life.life_id), minted);
  const token = (await c.tokensOf(life.account_id)).find(t => t.token_id === minted.token_id)!;
  assert.equal(token.extra.edition_key, minted.edition_key);
  assert.equal(token.extra.edition_number, minted.edition_number);
  await c.setAction(minted.token_id, "letters.lend-books");
  assert.equal((await c.token(minted.token_id))!.extra.edition_number, 4);
});

test("stage albums share unlimited Uncommon counts across people without a 100-copy rollover", async () => {
  const c = createMockContract({ genesis: false });
  let last;
  for (let i = 1; i <= 100; i++) {
    const life = await c.startLife(RANKED_WORLD_VERSION);
    last = await c.mintStageFigures(life.life_id, await signedFor(life, true), "letters.teach");
    assert.equal(last.tokens[0].edition_number, i);
    assert.equal(last.tokens[0].rarity, 1);
  }
  const life = await c.startLife(RANKED_WORLD_VERSION), signed = await signedFor(life, true);
  const quote = await c.stageMintQuote(life.life_id, signed, "letters.teach");
  assert.equal(quote.cards[0].rarity, 1);
  assert.equal(quote.cards[0].edition_limit, null);
  assert.equal(quote.cards[0].next_edition_number, 101);
  const minted = await c.mintStageFigures(life.life_id, signed, "letters.teach");
  assert.equal(minted.tokens[0].edition_limit, null);
  assert.equal(minted.tokens[0].edition_number, 101);
  assert.deepEqual(await c.retryStageMint(life.life_id), minted);
  assert.deepEqual(await c.stageMintResult(life.life_id), minted);
  assert.equal((await c.editionSupply(last!.tokens[0].edition_key!, 1)).minted, 101);
});

test("mint-pack previews refresh counts while only the chosen card receives an edition number", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION), signed = await signedFor(life, true);
  const pack = await c.openMintPack(life.life_id, signed, "letters.teach");
  assert.ok(pack.cards.every(card => card.minted === 0 && card.next_edition_number === 1 && !Object.hasOwn(card, "edition_number")));
  const result = await c.chooseMintSlot(life.life_id, 1);
  assert.equal(result.edition_number, 1);
  assert.equal(result.edition_key, pack.cards[1].edition_key);
  assert.deepEqual(await c.chooseMintSlot(life.life_id, 1), result, "retrying a completed choice never allocates another serial");
  assert.equal((await c.editionSupply(result.edition_key!, result.rarity)).minted, 1);
  assert.deepEqual(await c.mintResult(life.life_id), result);
});

test("wire preserves legacy tokens and historical over-cap serials, but rejects partial or forged edition fields", () => {
  const old = { token_id: "999", kind: "npc", figure_id: null, rarity: 4, affection: 50 };
  assert.deepEqual(parseMintResult(old), old);
  const numbered = { ...old, edition_key: "npc:letters:rarity:4", edition_number: 11, edition_limit: 10 };
  assert.deepEqual(parseMintResult(numbered), numbered, "historical over-cap tokens remain readable after migration");
  const extra = { ...numbered, life_id: "1", action_id: "letters.teach", sources: [], evidence_hash: "a".repeat(64) };
  assert.equal(parseTokenView({ owner_id: "owner.testnet", metadata: { extra: JSON.stringify(extra) } })!.extra.edition_number, 11);
  assert.equal(parseEditionSupply({ edition_key: numbered.edition_key, rarity: 4, minted: 11, edition_limit: 10, next_edition_number: null }).minted, 11);
  for (const [rarity, originalLimit] of [[1, 100], [2, 50]]) {
    const historical = { ...old, rarity, edition_key: `npc:letters:rarity:${rarity}`, edition_number: 12, edition_limit: originalLimit };
    assert.equal(parseMintResult(historical).edition_limit, originalLimit, "recorded limits are immutable");
    assert.throws(() => parseEditionSupply({ edition_key: historical.edition_key, rarity, minted: 12, edition_limit: originalLimit, next_edition_number: 13 }), /edition supply/, "live supply uses current policy");
  }
  for (const bad of [{ ...old, edition_number: 1 }, { ...numbered, edition_number: 0 }, { ...numbered, edition_number: 1.5 }, { ...numbered, edition_limit: 25 }, { ...numbered, edition_key: "npc:letters:rarity:3" }]) assert.throws(() => parseMintResult(bad), /edition/);
  assert.throws(() => parseEditionSupply({ edition_key: numbered.edition_key, rarity: 4, minted: 4, edition_limit: 10, next_edition_number: 4 }), /next edition/);
});

test("adapter retrieves edition supply and numbered mint/NFT answers from onchain JSON", async () => {
  const key = "npc:letters:rarity:4", calls: { method: string; args: unknown }[] = [];
  const numbered = { token_id: "9", kind: "npc", figure_id: null, rarity: 4, affection: 50, edition_key: key, edition_number: 5, edition_limit: 10 };
  const wallet: WalletSession = { accountId: "player.testnet", async signIn() {}, async signOut() {}, async call() { return numbered; } };
  const views: Record<string, unknown> = { edition_supply: { edition_key: key, rarity: 4, minted: 5, next_edition_number: 6, edition_limit: 10 }, mint_result: numbered,
    nft_token: { owner_id: "player.testnet", metadata: { extra: JSON.stringify({ ...numbered, life_id: "1", action_id: "letters.teach", sources: [], evidence_hash: "a".repeat(64) }) } } };
  const rpc: typeof fetch = async (_url, init) => {
    const request = JSON.parse(String(init?.body)), method = request.params.method_name;
    calls.push({ method, args: JSON.parse(Buffer.from(request.params.args_base64, "base64").toString("utf8")) });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { result: [...Buffer.from(JSON.stringify(views[method]))], logs: [] } }));
  };
  const c = createLivesContract(wallet, resolveChainConfig({ contractId: "lives.testnet" }), { fetch: rpc });
  assert.equal((await c.editionSupply(key, 4)).next_edition_number, 6);
  assert.deepEqual(calls[0], { method: "edition_supply", args: { edition_key: key, rarity: 4 } });
  assert.equal((await c.mintResult("1"))!.edition_number, 5);
  assert.equal((await c.token("9"))!.extra.edition_number, 5);
  views.edition_supply = { ...(views.edition_supply as object), edition_key: "npc:war:rarity:4" };
  await assert.rejects(c.editionSupply(key, 4), /different card edition/);
});

test("wire rejects inconsistent edition previews on packs and quotes", () => {
  const card = { kind: "npc", figure_id: null, rarity: 1, affection: 50, action_id: "letters.teach", edition_key: "npc:letters:rarity:1", minted: 4, edition_limit: null, next_edition_number: 5 };
  const pack = { life_id: "1", evidence_hash: "a".repeat(64), cards: [card, card, card], total_fee: "1", source_share_bps: 5000 };
  assert.equal(parseMintPack(pack).cards[0].next_edition_number, 5);
  assert.throws(() => parseMintPack({ ...pack, cards: [{ ...card, next_edition_number: 4 }, card, card] }), /next edition/);
  const quoteCard = { stage_id: "adult", figure_id: null, title: "A life", character_name: "Person", portrait_media: "/x.svg", stage_record: {}, fee: "1", action_id: "letters.teach", rarity: 0,
    edition_key: 'stage:["adult","rhakotis",null,"learner"]:rarity:0', minted: 101, edition_limit: null, next_edition_number: 102 };
  assert.equal(parseStageMintQuote({ cards: [quoteCard], total_fee: "1", source_share_bps: 5000 }).cards[0].next_edition_number, 102);
});

test("concurrent stage mints assign distinct sequential numbers from the same Uncommon count", async () => {
  const c = createMockContract({ genesis: false });
  const results = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
    const owner = c.as("concurrent" + index + ".testnet"), life = await owner.startLife(RANKED_WORLD_VERSION);
    return (await owner.mintStageFigures(life.life_id, await signedFor(life, true), "letters.teach")).tokens[0];
  }));
  assert.ok(results.every(r => r.rarity === 1 && r.edition_limit === null));
  assert.deepEqual(results.map(r => r.edition_number).sort((a,b) => a! - b!), Array.from({ length: 20 }, (_,i) => i + 1));
  assert.equal(new Set(results.map(r => r.token_id)).size, 20);
  assert.equal((await c.editionSupply(results[0].edition_key!, 1)).next_edition_number, 21);
});

test("paid pack reservations protect the final Rare slot through competing mint and choice", async () => {
  const c = createMockContract({ genesis: false, figureSupplyCap: 1000 });
  for (let i = 0; i < 99; i++) c.seedToken({ owner_id: "seed.testnet", kind: "figure", figure_id: "euclid", rarity: 2, affection: 50 });
  const owner = c.as("reserved.testnet"), life = await owner.startLife(RANKED_WORLD_VERSION);
  const pack = await owner.openMintPack(life.life_id, await signedFor(life, true, true), "letters.teach");
  assert.deepEqual(pack.cards.map(card => card.rarity), [2,1,1,1]);
  assert.equal(pack.cards[0].next_edition_number, 100);
  const competing = await c.startLife(RANKED_WORLD_VERSION), competingSigned = await signedFor(competing, true, true);
  const quote = await c.stageMintQuote(competing.life_id, competingSigned, "letters.teach");
  assert.equal(quote.cards[0].rarity, 1, "a new mint cannot consume the paid pack's remaining Rare place");
  await c.mintStageFigures(competing.life_id, competingSigned, "letters.teach");
  const chosen = await owner.chooseMintSlot(life.life_id, 0);
  assert.equal(chosen.edition_number, 100);
  assert.equal(chosen.edition_limit, 100);
  assert.equal((await c.editionSupply(chosen.edition_key!, 2)).next_edition_number, null);
  assert.throws(() => c.seedToken({ owner_id: "seed.testnet", kind: "figure", figure_id: "euclid", rarity: 2, affection: 50 }), /sold out/, "Rare copy 101 cannot be issued");
  assert.deepEqual(await owner.retryMint(life.life_id), chosen);
});

test("stage quote hash stays stable as only the live serial preview advances", async () => {
  const c = createMockContract({ genesis: false }), life = await c.startLife(RANKED_WORLD_VERSION), signed = await signedFor(life, true);
  const first = await c.stageMintQuote(life.life_id, signed, "letters.teach");
  assert.match(first.quote_hash!, /^[0-9a-f]{64}$/);
  const other = c.as("other.testnet"), competing = await other.startLife(RANKED_WORLD_VERSION);
  await other.mintStageFigures(competing.life_id, await signedFor(competing, true), "letters.teach");
  const second = await c.stageMintQuote(life.life_id, signed, "letters.teach");
  assert.equal(second.cards[0].next_edition_number, 2);
  assert.equal(second.quote_hash, first.quote_hash, "the reviewed design/rarity/fees did not change");
  const result = await c.mintStageFigures(life.life_id, signed, "letters.teach", first.total_fee, first.quote_hash);
  assert.equal(result.tokens[0].edition_number, 2);
});

test("same-fee card identity changes invalidate the reviewed quote before a mint", async () => {
  const c = createMockContract({ genesis: false });
  const life = await c.startLife(RANKED_WORLD_VERSION), signed = await signedFor(life, true);
  const reviewed = await c.stageMintQuote(life.life_id, signed, "letters.teach");
  assert.equal(reviewed.cards[0].rarity, 1);
  const changed = structuredClone(signed);
  changed.evidence.stage_figures![0].characterName = "Another person";
  changed.evidence_json = canonicalJson(changed.evidence);
  changed.evidence_hash = await sha256Hex(changed.evidence_json);
  const latest = await c.stageMintQuote(life.life_id, changed, "letters.teach");
  assert.equal(latest.cards[0].rarity, 1);
  assert.equal(latest.total_fee, reviewed.total_fee);
  assert.notEqual(latest.quote_hash, reviewed.quote_hash);
  const before = (await c.tokensOf(life.account_id)).length;
  await assert.rejects(c.mintStageFigures(life.life_id, changed, "letters.teach", reviewed.total_fee, reviewed.quote_hash), /Stage cards changed/);
  assert.equal((await c.tokensOf(life.account_id)).length, before);
  assert.equal((await c.getLife(life.life_id))!.status, "alive");
  const result = await c.mintStageFigures(life.life_id, changed, "letters.teach", latest.total_fee, latest.quote_hash);
  assert.equal(result.tokens[0].rarity, 1);
});
