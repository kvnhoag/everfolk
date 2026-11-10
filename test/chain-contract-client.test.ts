import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "../chain/hash.ts";
import { FIGURE_IDS, RANKED_WORLD_VERSION } from "../chain/ids.ts";
import type { Evidence, LifeView } from "../chain/types.ts";
import { resolveChainConfig } from "../client/chain/config.ts";
import { createLivesContract } from "../client/chain/contract.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { readCallResult } from "../client/chain/outcome.ts";
import type { ContractCall, SignedEvidence, WalletSession } from "../client/chain/types.ts";

const TGAS = 10n ** 12n;
const ONE_NEAR = 10n ** 24n;
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const LIFE_KEYS = ["account_id", "checkpoints", "draws", "figure_picks", "life_id", "seed", "started_at_ms", "status", "world_version"];
const DRAW_KEYS = ["action_id", "category", "commands_hash", "rarity", "step", "token_id"];
const MINT_KEYS = ["affection", "figure_id", "kind", "rarity", "token_id"];

function assertLifeShape(life: LifeView): void {
  assert.deepEqual(Object.keys(life).sort(), LIFE_KEYS);
  assert.match(life.life_id, /^\d+$/);
  assert.match(life.seed, /^[0-9a-f]{64}$/);
  assert.ok(["alive", "minted", "abandoned"].includes(life.status));
  assert.equal(typeof life.started_at_ms, "number");
  for (const pick of life.figure_picks) {
    assert.deepEqual(Object.keys(pick).sort(), ["action_id", "figure_id", "rarity", "token_id"]);
    assert.ok((FIGURE_IDS as readonly string[]).includes(pick.figure_id));
    assert.ok(pick.rarity >= 2 && pick.rarity <= 4, "figures are at least Rare");
  }
}

async function signedEvidenceFor(life: LifeView, overrides: Partial<Evidence> = {}): Promise<SignedEvidence> {
  const sources = [
    ...life.figure_picks.map(pick => ({ token_id: pick.token_id, impact: 15000 })),
    ...life.draws.filter(draw => draw.token_id).map(draw => ({ token_id: draw.token_id as string, impact: 10000 })),
  ];
  const evidence: Evidence = {
    v: 1, seed: life.seed, life_id: life.life_id, account_id: life.account_id, world_version: life.world_version,
    world_fingerprint: "f".repeat(64), save_hash: "e".repeat(64), stats: { bonds: 60 }, skills: {}, origin_id: "citizen-household",
    peak_job_id: "copyist", accomplishments: [], death_age: 61, birth_year: -350, death_year: -289, career_group: "letters",
    matched_figures: [], sources, ...overrides,
  };
  const evidence_json = canonicalJson(evidence);
  return { evidence, evidence_json, evidence_hash: await sha256Hex(evidence_json), signature: "ab".repeat(64), verifier_kind: "server-signer" };
}

// --- mock contract -------------------------------------------------------------------------------

test("mock start, draw, mint round-trip matches T0 shapes", async () => {
  const contract = createMockContract();
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  assertLifeShape(life);
  assert.equal(life.status, "alive");
  assert.equal(life.world_version, RANKED_WORLD_VERSION);
  assert.ok(life.figure_picks.length > 0, "the default mock genesis seeds figure copies");

  const step = life.figure_picks.length;
  const draw = await contract.drawNpc(life.life_id, step, "education", HASH_A);
  assert.deepEqual(Object.keys(draw).sort(), DRAW_KEYS);
  assert.equal(draw.step, step);
  assert.equal(draw.category, "education");
  assert.equal(draw.commands_hash, HASH_A);
  const drawn = [draw.token_id, draw.action_id, draw.rarity];
  assert.ok(drawn.every(value => value === null) || drawn.every(value => value !== null), "a draw is either nobody or a full pick");

  await contract.checkpoint(life.life_id, step + 3, HASH_B);
  const stored = await contract.getLife(life.life_id);
  assert.ok(stored);
  assertLifeShape(stored);
  assert.deepEqual(stored.draws, [draw]);
  assert.deepEqual(stored.checkpoints, [{ step: step + 3, commands_hash: HASH_B }]);
  assert.deepEqual(await contract.activeLifeOf(life.account_id), stored);

  const minted = await contract.mintLife(life.life_id, await signedEvidenceFor(stored), "letters.teach");
  assert.deepEqual(Object.keys(minted).sort(), MINT_KEYS);
  assert.ok(["figure", "npc"].includes(minted.kind));
  assert.ok(minted.affection >= 1 && minted.affection <= 100);
  assert.ok(minted.rarity >= 0 && minted.rarity <= 4);

  assert.equal((await contract.getLife(life.life_id))?.status, "minted");
  assert.equal(await contract.activeLifeOf(life.account_id), null);
  const token = await contract.token(minted.token_id);
  assert.ok(token);
  assert.equal(token.owner_id, life.account_id);
  assert.equal(token.extra.life_id, life.life_id);
  assert.equal(token.extra.evidence_hash, (await signedEvidenceFor(stored)).evidence_hash);
  assert.equal(token.extra.sources.reduce((sum, share) => sum + share.bps, 0), 10000);
  await assert.rejects(contract.mintLife(life.life_id, await signedEvidenceFor(stored), "letters.teach"), /no longer in progress/);
});

test("drawNpc retry with same step returns same draw", async () => {
  const contract = createMockContract();
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  const first = await contract.drawNpc(life.life_id, 4, "war", HASH_A);
  const retry = await contract.drawNpc(life.life_id, 4, "war", HASH_A);
  assert.deepEqual(retry, first);
  assert.equal((await contract.getLife(life.life_id))?.draws.length, 1);
  await assert.rejects(contract.drawNpc(life.life_id, 4, "war", HASH_B), /different record already exists/);
});

test("mock draws are deterministic for the same life and step", async () => {
  const draws = [];
  for (let run = 0; run < 2; run += 1) {
    const contract = createMockContract();
    const life = await contract.startLife(RANKED_WORLD_VERSION);
    draws.push([await contract.drawNpc(life.life_id, 4, "education", HASH_A), await contract.drawNpc(life.life_id, 9, "money", HASH_B)]);
  }
  assert.deepEqual(draws[0], draws[1]);
});

test("mock enforces one alive life per account and steps that never go back", async () => {
  const contract = createMockContract();
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  await assert.rejects(contract.startLife(RANKED_WORLD_VERSION), /already have a ranked life/);
  await assert.rejects(contract.as("other.testnet").startLife("unknown-world"), /not open for ranked play/);

  await contract.checkpoint(life.life_id, 10, HASH_A);
  await contract.checkpoint(life.life_id, 10, HASH_A);
  await assert.rejects(contract.checkpoint(life.life_id, 10, HASH_B), /different record already exists/);
  await assert.rejects(contract.drawNpc(life.life_id, 9, "fate", HASH_A), /must not go backwards/);
  await contract.drawNpc(life.life_id, 10, "fate", HASH_A);
  await assert.rejects(contract.checkpoint(life.life_id, 11, "XYZ"), /64 lowercase hex/);
  await assert.rejects(contract.as("other.testnet").checkpoint(life.life_id, 12, HASH_A), /owner/);
  assert.equal((await contract.getLife(life.life_id))?.checkpoints.length, 1);
});

test("mock abandon deletes the life and applies the cooldown", async () => {
  let now = 1_000;
  const contract = createMockContract({ now: () => now, abandonCooldownMs: 600_000 });
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  await contract.abandonLife(life.life_id);
  assert.equal(await contract.getLife(life.life_id), null);
  await assert.rejects(contract.startLife(RANKED_WORLD_VERSION), /opens in 600 seconds/);
  now += 600_000;
  const next = await contract.startLife(RANKED_WORLD_VERSION);
  assert.notEqual(next.life_id, life.life_id);
});

test("mock mint rejects evidence for another seed or an unknown source", async () => {
  const contract = createMockContract();
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  await assert.rejects(contract.mintLife(life.life_id, await signedEvidenceFor(life, { seed: "0".repeat(64) }), "letters.teach"), /different life seed/);
  await assert.rejects(
    contract.mintLife(life.life_id, await signedEvidenceFor(life, { sources: [{ token_id: "999", impact: 1 }] }), "letters.teach"),
    /did not influence this life/,
  );
  await assert.rejects(contract.mintLife(life.life_id, await signedEvidenceFor(life), "military.mentor"), /career/);
  assert.equal((await contract.getLife(life.life_id))?.status, "alive");
});

test("mock market pays sources, returns proceeds and moves the token", async () => {
  const contract = createMockContract({ genesis: false });
  const source = contract.seedToken({ owner_id: "genesis.testnet", kind: "npc", career_group: "letters", action_id: "letters.teach", rarity: 0, affection: 50 });
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  const evidence = await signedEvidenceFor(life, { sources: [] });
  const minted = await contract.mintLife(life.life_id, evidence, "letters.teach");
  assert.deepEqual(await contract.childrenOf(source), []);

  await assert.rejects(contract.as("buyer.testnet").list(minted.token_id, "100"), /owner/);
  await contract.list(minted.token_id, (10n * ONE_NEAR).toString());
  assert.deepEqual(await contract.listings(), [{ token_id: minted.token_id, seller_id: life.account_id, price: (10n * ONE_NEAR).toString() }]);
  await assert.rejects(contract.buy(minted.token_id, (10n * ONE_NEAR).toString()), /already own/);
  await assert.rejects(contract.as("buyer.testnet").buy(minted.token_id, "1"), /listing price/);

  const proceeds = await contract.as("buyer.testnet").buy(minted.token_id, (10n * ONE_NEAR).toString());
  assert.equal(proceeds, (9n * ONE_NEAR).toString(), "10% royalty: 5% sources (none here → treasury) + 5% treasury");
  assert.equal((await contract.token(minted.token_id))?.owner_id, "buyer.testnet");
  assert.deepEqual(await contract.listings(), []);
});

test("mock mint credits source owners, stats and children", async () => {
  const contract = createMockContract({ genesis: false });
  const teacher = contract.seedToken({ owner_id: "genesis.testnet", kind: "npc", career_group: "letters", action_id: "letters.teach", rarity: 1, affection: 100 });
  const life = await contract.startLife(RANKED_WORLD_VERSION);
  let draw = await contract.drawNpc(life.life_id, 0, "education", HASH_A);
  for (let step = 1; draw.token_id === null; step += 1) draw = await contract.drawNpc(life.life_id, step, "education", HASH_A.replace("a", String(step % 10)));
  assert.equal(draw.token_id, teacher);
  const stored = await contract.getLife(life.life_id);
  assert.ok(stored);
  const minted = await contract.mintLife(life.life_id, await signedEvidenceFor(stored), "letters.lend-books");

  assert.equal(await contract.balanceOf("genesis.testnet"), (ONE_NEAR / 2n).toString(), "50% of the 1 NEAR fee to the only source");
  assert.deepEqual(await contract.tokenStats(teacher), { lives_influenced: 1, earned: (ONE_NEAR / 2n).toString() });
  assert.deepEqual(await contract.childrenOf(teacher), [minted.token_id]);
  await contract.as("genesis.testnet").withdraw();
  assert.equal(await contract.balanceOf("genesis.testnet"), "0");
  await assert.rejects(contract.as("genesis.testnet").withdraw(), /Nothing to withdraw/);

  await contract.setAction(minted.token_id, "letters.teach");
  assert.equal((await contract.token(minted.token_id))?.extra.action_id, "letters.teach");
  await assert.rejects(contract.setAction(minted.token_id, "military.mentor"), /not on this token's menu/);
});

// --- real contract client against a fake wallet and RPC -------------------------------------------

interface Recorder { calls: ContractCall[]; views: { method: string; args: unknown }[] }

function fakeWallet(recorder: Recorder, results: Record<string, unknown> = {}): WalletSession {
  return {
    accountId: "player.testnet",
    async signIn() {},
    async signOut() {},
    async call(call) {
      recorder.calls.push(call);
      return results[call.method] ?? null;
    },
  };
}

function fakeRpc(recorder: Recorder, views: Record<string, unknown>): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.method, "query");
    assert.equal(body.params.request_type, "call_function");
    const args = JSON.parse(Buffer.from(body.params.args_base64, "base64").toString("utf8"));
    recorder.views.push({ method: body.params.method_name, args });
    const value = typeof views[body.params.method_name] === "function"
      ? (views[body.params.method_name] as (a: unknown) => unknown)(args)
      : views[body.params.method_name];
    const bytes = [...Buffer.from(JSON.stringify(value ?? null), "utf8")];
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { result: bytes, logs: [] } }));
  }) as typeof fetch;
}

const cfg = resolveChainConfig({ contractId: "lives.testnet" });

test("contract client sends draw_npc with 100+ Tgas and string life_id", async () => {
  const recorder: Recorder = { calls: [], views: [] };
  const draw = { step: 7, category: "education", token_id: null, action_id: null, rarity: null, commands_hash: HASH_A };
  const contract = createLivesContract(fakeWallet(recorder, { draw_npc: draw }), cfg, { fetch: fakeRpc(recorder, {}) });

  assert.deepEqual(await contract.drawNpc("12", 7, "education", HASH_A), draw);
  const [call] = recorder.calls;
  assert.equal(call.method, "draw_npc");
  assert.deepEqual(call.args, { life_id: "12", step: 7, category: "education", commands_hash: HASH_A });
  assert.equal(typeof call.args.life_id, "string");
  assert.ok(BigInt(call.gas) >= 100n * TGAS, `draw_npc gas ${call.gas}`);
  assert.equal(call.deposit, "0");
  assert.equal(call.access, "function-call-key");

  await assert.rejects(contract.drawNpc("12", -1, "education", HASH_A), /step/);
  await assert.rejects(contract.drawNpc("12", 7, "sorcery" as never, HASH_A), /category/);
  await assert.rejects(contract.drawNpc("12", 7, "education", "ABC"), /hash/);
  await assert.rejects(contract.drawNpc("twelve", 7, "education", HASH_A), /life id/);
  assert.equal(recorder.calls.length, 1, "invalid input never reaches the wallet");
});

test("list goes through the wallet with exactly 1 yoctoNEAR", async () => {
  const recorder: Recorder = { calls: [], views: [] };
  const contract = createLivesContract(fakeWallet(recorder), cfg, { fetch: fakeRpc(recorder, {}) });
  await contract.list("5", "2500000000000000000000000");
  const [call] = recorder.calls;
  assert.equal(call.method, "list");
  assert.deepEqual(call.args, { token_id: "5", price: "2500000000000000000000000" });
  assert.equal(call.deposit, "1");
  assert.equal(call.access, "wallet");
  await assert.rejects(contract.list("5", "0"), /price/);
  await assert.rejects(contract.list("5", "1.5"), /price/);
});

test("gas-only life calls use the function-call key; payable and owner calls use the wallet", async () => {
  const recorder: Recorder = { calls: [], views: [] };
  const life = { life_id: "3", account_id: "player.testnet", seed: HASH_A, world_version: RANKED_WORLD_VERSION, status: "alive",
    figure_picks: [], draws: [], checkpoints: [], started_at_ms: 1 };
  const contract = createLivesContract(fakeWallet(recorder, { start_life: life, buy: "9000" }), cfg, { fetch: fakeRpc(recorder, {}) });
  assert.deepEqual(await contract.startLife(RANKED_WORLD_VERSION), life);
  await contract.checkpoint("3", 5, HASH_B);
  await contract.abandonLife("3");
  await contract.setAction("5", "letters.teach");
  await contract.unlist("5");
  await contract.withdraw();
  assert.equal(await contract.buy("5", "10000"), "9000");

  const byMethod = Object.fromEntries(recorder.calls.map(call => [call.method, call]));
  for (const method of ["start_life", "checkpoint", "abandon_life"]) {
    assert.equal(byMethod[method].access, "function-call-key", method);
    assert.equal(byMethod[method].deposit, "0", method);
  }
  for (const method of ["set_action", "unlist", "withdraw", "buy"]) assert.equal(byMethod[method].access, "wallet", method);
  assert.deepEqual(byMethod.start_life.args, { world_version: RANKED_WORLD_VERSION });
  assert.deepEqual(byMethod.checkpoint.args, { life_id: "3", step: 5, commands_hash: HASH_B });
  assert.deepEqual(byMethod.abandon_life.args, { life_id: "3" });
  assert.deepEqual(byMethod.buy.args, { token_id: "5" });
  assert.equal(byMethod.buy.deposit, "10000");
});

test("mint_life attaches the on-chain mint fee, 150+ Tgas and the signed evidence string", async () => {
  const recorder: Recorder = { calls: [], views: [] };
  const life = { life_id: "3", account_id: "player.testnet", seed: HASH_A, world_version: RANKED_WORLD_VERSION, status: "alive",
    figure_picks: [], draws: [], checkpoints: [], started_at_ms: 1 } satisfies LifeView;
  const minted = { token_id: "8", kind: "npc", figure_id: null, rarity: 1, affection: 40 };
  const contract = createLivesContract(fakeWallet(recorder, { mint_life: minted }), cfg, {
    fetch: fakeRpc(recorder, { get_params: { mint_fee: "1000000000000000000000000", drop_rate_bps: 500 } }),
  });
  const signed = await signedEvidenceFor(life, { sources: [] });
  assert.deepEqual(await contract.mintLife("3", signed, "letters.teach"), minted);
  const [call] = recorder.calls;
  assert.equal(call.method, "mint_life");
  assert.deepEqual(call.args, { life_id: "3", evidence_json: signed.evidence_json, signature: signed.signature, npc_action_id: "letters.teach" });
  assert.equal(call.deposit, "1000000000000000000000000");
  assert.ok(BigInt(call.gas) >= 150n * TGAS);
  assert.equal(call.access, "wallet");

  await assert.rejects(contract.mintLife("4", signed, "letters.teach"), /different life/);
  await assert.rejects(contract.mintLife("3", { ...signed, evidence_hash: HASH_B }, "letters.teach"), /hash/);
  assert.equal(recorder.calls.length, 1);
});

test("views decode JSON-RPC results into T0 shapes", async () => {
  const recorder: Recorder = { calls: [], views: [] };
  const extra = { kind: "npc", figure_id: null, rarity: 1, affection: 40, action_id: "letters.teach", life_id: "3", birth_year: -350,
    death_year: -289, career_group: "letters", sources: [{ token_id: "1", bps: 10000 }], evidence_hash: HASH_A };
  const contract = createLivesContract(fakeWallet(recorder), cfg, {
    fetch: fakeRpc(recorder, {
      get_life: null,
      active_life_of: null,
      balance_of: "42",
      nft_token: { token_id: "8", owner_id: "alice.testnet", metadata: { title: "A life", extra: JSON.stringify(extra) } },
      token_stats: { lives_influenced: 2, earned: "7" },
      children_of: (args: unknown) => {
        const { from_index } = args as { from_index: number };
        return from_index === 0 ? Array.from({ length: 100 }, (_, i) => String(i)) : ["100"];
      },
      listings: [{ token_id: "8", seller_id: "alice.testnet", price: "5" }],
    }),
  });
  assert.equal(await contract.getLife("3"), null);
  assert.equal(await contract.activeLifeOf("player.testnet"), null);
  assert.equal(await contract.balanceOf("alice.testnet"), "42");
  assert.deepEqual(await contract.token("8"), { owner_id: "alice.testnet", extra });
  assert.deepEqual(await contract.tokenStats("8"), { lives_influenced: 2, earned: "7" });
  assert.equal((await contract.childrenOf("1")).length, 101);
  assert.deepEqual(await contract.listings(), [{ token_id: "8", seller_id: "alice.testnet", price: "5" }]);

  const byMethod = (method: string) => recorder.views.filter(view => view.method === method).map(view => view.args);
  assert.deepEqual(byMethod("get_life"), [{ life_id: "3" }]);
  assert.deepEqual(byMethod("active_life_of"), [{ account_id: "player.testnet" }]);
  assert.deepEqual(byMethod("children_of"), [{ token_id: "1", from_index: 0, limit: 100 }, { token_id: "1", from_index: 100, limit: 100 }]);
  assert.deepEqual(byMethod("listings"), [{ from_index: 0, limit: 100 }]);
});

test("view errors surface the contract message", async () => {
  const failing = (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result: { error: "wasm execution failed with error: FunctionCallError(HostError(GuestPanic { panic_msg: \"Token not found\" }))", logs: [] } }))) as typeof fetch;
  const contract = createLivesContract(fakeWallet({ calls: [], views: [] }), cfg, { fetch: failing });
  await assert.rejects(contract.tokenStats("9"), /Token not found/);
  const down = (async () => new Response("bad gateway", { status: 502 })) as typeof fetch;
  await assert.rejects(createLivesContract(fakeWallet({ calls: [], views: [] }), cfg, { fetch: down }).balanceOf("a.testnet"), /502/);
});

test("readCallResult decodes success values and contract panics", () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64");
  assert.deepEqual(readCallResult({ status: { SuccessValue: encode({ ok: 1 }) } }), { ok: 1 });
  assert.equal(readCallResult({ status: { SuccessValue: "" } }), null);
  assert.throws(
    () => readCallResult({ status: { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: Attach at least 100 Tgas to draw" } } } } } }),
    /Attach at least 100 Tgas to draw/,
  );
  assert.throws(() => readCallResult({}), /no final result/);
});

test("chain config defaults to NEAR testnet over FastNEAR", () => {
  const config = resolveChainConfig({}, {});
  assert.equal(config.networkId, "testnet");
  assert.equal(config.rpcUrl, "https://test.rpc.fastnear.com");
  assert.ok(config.contractId.endsWith(".testnet"));
  assert.equal(config.verifyUrl, "/api/ranked/verify");
  assert.equal(resolveChainConfig({}, { VITE_EVERFOLK_CONTRACT_ID: "x.testnet" }).contractId, "x.testnet");
  assert.throws(() => resolveChainConfig({ contractId: "Not An Account" }), /contract account/);
});
