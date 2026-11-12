import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { canonicalJson } from "../src/random.ts";
import { ALEXANDRIA_LIFE_STAGES } from "../src/vocations/life-stage-content.ts";
import { matchStageFigure, stagePortraitPath } from "../chain/stage-figures.ts";
import { FIGURE_IDS, RANKED_WORLD_VERSION } from "../chain/ids.ts";
import { figureMediaPath, figureFrontPath } from "../chain/figure-media.ts";
import { sha256Hex } from "../chain/hash.ts";
import { createLivesContract } from "../client/chain/contract.ts";
import { resolveChainConfig } from "../client/chain/config.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { parseStageMintQuote, parseStageMintResult } from "../client/chain/wire.ts";
import { ObligationTracker } from "../chain/ranked-rules.ts";
import type { Evidence, LifeView, StageMintQuote, StageMintResult } from "../chain/types.ts";
import type { ContractCall, SignedEvidence, WalletSession } from "../client/chain/types.ts";
import type { LifeState } from "../src/types.ts";

const life: LifeView = { life_id: "7", account_id: "player.testnet", seed: "a".repeat(64), world_version: RANKED_WORLD_VERSION, status: "alive", figure_picks: [], draws: [], checkpoints: [], started_at_ms: 1 };
async function signedFor(current = life): Promise<SignedEvidence> {
  const records = ALEXANDRIA_LIFE_STAGES.stages.map((stage, i, all) => ({ stageId: stage.id, title: stage.title, fromAge: stage.minAge,
    toAge: Math.min(all[i + 1]?.minAge ? all[i + 1].minAge - 1 : 61, 61), district: "rhakotis", field: null, tier: "learner",
    jobId: null, topSkills: { literacy: 20 }, nodes: ["letters-1"], reputation: 20, accomplishments: ["first-copy"], mentors: ["Damon"] }));
  const evidence: Evidence = { v: 1, life_id: current.life_id, account_id: current.account_id, seed: current.seed, world_version: current.world_version,
    world_fingerprint: "b".repeat(64), save_hash: "c".repeat(64), stats: {}, skills: {}, origin_id: "clerk-household", peak_job_id: null,
    accomplishments: [], death_age: 61, birth_year: -350, death_year: -289, career_group: "letters", matched_figures: [], sources: [],
    stage_records: records, stage_figures: records.map(r => matchStageFigure(r, { characterName: "Kallias", originId: "clerk-household", sex: "male" })) };
  const evidence_json = canonicalJson(evidence);
  return { evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "ab".repeat(64), verifier_kind: "server-signer" };
}
async function fixture() {
  const signed = await signedFor();
  const quote: StageMintQuote = { total_fee: "14000000000000000000000", source_share_bps: 5000, cards: signed.evidence.stage_figures!.map(fig => ({ stage_id: fig.stageId,
    figure_id: null, title: fig.title, character_name: fig.name, portrait_media: fig.media, stage_record: fig.stageRecord, fee: "2000000000000000000000", action_id: "letters.teach" })) };
  const receipt: StageMintResult = { life_id: life.life_id, total_fee: quote.total_fee, evidence_hash: signed.evidence_hash,
    tokens: quote.cards.map((card, i) => ({ token_id: String(i + 1), kind: "npc", figure_id: null, rarity: 1, affection: 50,
      stage_id: card.stage_id, stage_title: card.title, character_name: card.character_name, portrait_media: card.portrait_media })) };
  return { signed, quote, receipt };
}
function client(views: Record<string, unknown | (() => unknown)>, answer: (call: ContractCall) => unknown) {
  const calls: ContractCall[] = [];
  const wallet: WalletSession = { accountId: life.account_id, async signIn() {}, async signOut() {}, async call(call) { calls.push(call); return answer(call); } };
  const rpc: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); const value = views[body.params.method_name];
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { result: [...Buffer.from(JSON.stringify(typeof value === "function" ? value() : value ?? null))], logs: [] } }));
  };
  return { calls, contract: createLivesContract(wallet, resolveChainConfig({ contractId: "lives.testnet" }), { fetch: rpc }) };
}

test("real adapter pays the quoted album fee in one 300 Tgas wallet call with exact signed bytes", async () => {
  const { signed, quote, receipt } = await fixture();
  const { contract, calls } = client({ stage_mint_quote: quote, get_life: life }, call => {
    assert.equal(call.method, "mint_stage_figures"); return receipt;
  });
  assert.deepEqual(await contract.stageMintQuote("7", signed, "letters.teach"), quote);
  assert.deepEqual(await contract.mintStageFigures("7", signed, "letters.teach", quote.total_fee), receipt);
  assert.deepEqual(calls, [{ method: "mint_stage_figures", args: { life_id: "7", evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: "letters.teach" }, gas: "300000000000000", deposit: quote.total_fee, access: "wallet" }]);
});
test("real adapter recovers a landed album after a lost response without a second payment", async () => {
  const { signed, quote, receipt } = await fixture(); let landed = false;
  const { contract, calls } = client({ get_life: life, stage_mint_quote: quote, stage_mint_result: () => landed ? receipt : null }, () => { landed = true; throw new Error("RPC timeout"); });
  assert.deepEqual(await contract.mintStageFigures("7", signed, "letters.teach"), receipt);
  assert.deepEqual(await contract.mintStageFigures("7", signed, "letters.teach"), receipt);
  assert.equal(calls.length, 1);
});
test("interrupted album retries use zero deposit and the My lives recovery entry point", async () => {
  const { signed, receipt } = await fixture();
  const { contract, calls } = client({ get_life: { ...life, status: "minting" }, stage_mint_status: "pending", mint_result: null }, call => {
    assert.equal(call.method, "retry_stage_mint"); return receipt;
  });
  assert.deepEqual(await contract.mintStageFigures("7", signed, "letters.teach"), receipt);
  assert.deepEqual(await contract.retryMint("7"), receipt.tokens[0]);
  assert.equal(calls.length, 2); assert.ok(calls.every(c => c.deposit === "0" && c.gas === "300000000000000"));
});
test("a rejected payment remains retryable and changed prices require a new review", async () => {
  const { signed, quote } = await fixture();
  const { contract, calls } = client({ get_life: life, stage_mint_quote: quote }, () => { throw new Error("Wallet rejected"); });
  await assert.rejects(contract.mintStageFigures("7", signed, "letters.teach"), /Wallet rejected/);
  await assert.rejects(contract.mintStageFigures("7", signed, "letters.teach", "1"), /Stage prices changed/);
  assert.equal(calls.length, 1);
});
test("wire rejects malformed stage totals and duplicate stage results", async () => {
  const { quote, receipt } = await fixture();
  assert.throws(() => parseStageMintQuote({ ...quote, total_fee: "1" }), /stage mint total/);
  assert.throws(() => parseStageMintResult({ ...receipt, tokens: [receipt.tokens[0], receipt.tokens[0]] }), /duplicate stage token/);
  assert.throws(() => parseStageMintResult({ ...receipt, tokens: [] }), /stage tokens/);
});
test("practice album keeps all seven stages, their records, and an immutable mint receipt", async () => {
  const contract = createMockContract({ genesis: false }); const current = await contract.startLife(RANKED_WORLD_VERSION);
  const signed = await signedFor(current), result = await contract.mintStageFigures(current.life_id, signed, "letters.teach");
  assert.equal(result.tokens.length, 7); assert.equal((await contract.tokensOf(current.account_id)).length, 7);
  assert.equal(await contract.activeLifeOf(current.account_id), null);
  assert.deepEqual(await contract.retryStageMint(current.life_id), result);
  for (const token of result.tokens) {
    const extra = (await contract.token(token.token_id))!.extra;
    assert.equal(extra.stage_record?.mentors[0], "Damon"); assert.equal(extra.stage_record?.nodes[0], "letters-1");
  }
});
test("every portrait path from supported origins, aliases, variants and historical figures exists", () => {
  const base = new URL("../public/assets/pixel/portraits/", import.meta.url);
  const origins = new Set(readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name));
  for (const path of ["../worlds/alexandria-0.42.0.json", "../worlds/demo/alexandria-lives-4.json", "../worlds/demo/alexandria-lives-5.json", "../worlds/demo/alexandria-lives-6.json", "../worlds/demo/alexandria-lives-7.json"]) {
    const url = new URL(path, import.meta.url); if (!existsSync(url)) continue;
    const w = JSON.parse(readFileSync(url, "utf8")); for (const origin of w.origins) origins.add(origin.id);
  }
  ["tenant-farming-household", "domestic-service-household", "boatbuilder-household", "musician-household", "court-household", "unknown", "../unsafe", ""].forEach(id => origins.add(id));
  const paths = new Set<string>();
  for (const originId of origins) for (const sex of ["male", "female", undefined] as const)
    for (const age of [0, 2, 3, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 39, 40, 59, 60, 100]) for (const avatarVariant of [-1, 0, 1, 2, 3, NaN]) {
      paths.add(stagePortraitPath({ originId, sex, age, avatarVariant }));
    }
  for (const id of FIGURE_IDS) { paths.add(figureMediaPath(id)); paths.add(figureFrontPath(id)); }
  for (const path of paths) assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `Missing ${path}`);
  assert.ok(paths.size > 250, `Checked ${paths.size} unique portraits`);
});
test("household-resolved childhood events owe no deed draw; pending player decisions still do", () => {
  const tracker = new ObligationTracker();
  const child = { phase: "living", age: 7, pendingEventId: null, worldVersion: "alexandria-demo-2" } as unknown as LifeState;
  assert.deepEqual(tracker.at(child, 10), []);
  const adult = { ...child, age: 16, phase: "choice", pendingEventId: "flood-failure" } as LifeState;
  assert.deepEqual(tracker.at(adult, 11), [{ kind: "draw", step: 11, category: "harvest" }]);
});
