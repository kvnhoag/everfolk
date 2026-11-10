import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "../chain/hash.ts";
import { FIGURE_IDS, RANKED_WORLD_VERSION } from "../chain/ids.ts";
import type { Evidence, LifeView } from "../chain/types.ts";
import { resolveChainConfig } from "../client/chain/config.ts";
import { createLivesContract } from "../client/chain/contract.ts";
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
