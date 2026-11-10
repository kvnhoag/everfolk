import assert from "node:assert/strict";
import test from "node:test";
import type { LifeView } from "../chain/types.ts";
import { handleRankedApi, MAX_RANKED_SAVE_BYTES } from "../server/ranked/routes.ts";
import type { RankedEnvironment } from "../server/ranked/routes.ts";
import { VerificationError, type LifeVerifier, type SignedEvidence } from "../server/ranked/verifier.ts";
import { TestDatabase } from "./support/d1.ts";

const ORIGIN = "https://everfolk.test";
const HASH = "e".repeat(64);
const LIFE: LifeView = {
  life_id: "5", account_id: "alice.testnet", seed: "ab".repeat(32), world_version: "alexandria-ranked-1", status: "alive",
  figure_picks: [], draws: [], checkpoints: [], started_at_ms: 0,
};
const SAVE = { schemaVersion: 1, worldId: "alexandria", worldVersion: "ranked-1", worldFingerprint: "x", seed: LIFE.seed, commands: [] };

const signed = { evidence: { v: 1, life_id: "5" }, evidence_json: '{"life_id":"5","v":1}', evidence_hash: HASH, signature: "a".repeat(128), verifier_kind: "server-signer" } as unknown as SignedEvidence;

function fakeVerifier(result: SignedEvidence | Error): LifeVerifier {
  return {
    kind: "server-signer", publicKey: "ed25519:Fake",
    async verify() { if (result instanceof Error) throw result; return result; },
  };
}

function rpcReturning(value: unknown): typeof fetch {
  const bytes = [...new TextEncoder().encode(JSON.stringify(value))];
  return (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { result: bytes } }))) as typeof fetch;
}

function env(overrides: Partial<RankedEnvironment> = {}): RankedEnvironment {
  const allowAll = { limit: async () => ({ success: true }) };
  return { DB: new TestDatabase(), RANKED_VERIFIER_SECRET: "07".repeat(32), RANKED_CONTRACT_ID: "lives.testnet", NEAR_RPC_URL: "https://rpc.test", RANKED_RATE_LIMITER: allowAll, ...overrides };
}

const post = (body: string) => new Request(`${ORIGIN}/api/ranked/verify`, { method: "POST", headers: { "content-type": "application/json" }, body });
const verifyBody = JSON.stringify({ life_id: "5", save: JSON.stringify(SAVE) });

test("config exposes contract, rpc, world version and verifier key", async () => {
  const response = await handleRankedApi(new Request(`${ORIGIN}/api/ranked/config`), env(), { verifier: async () => fakeVerifier(signed) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { contract_id: "lives.testnet", rpc_url: "https://rpc.test", world_version: "alexandria-ranked-1", verifier_public_key: "ed25519:Fake" });
});

test("missing secret returns 503", async () => {
  const response = await handleRankedApi(new Request(`${ORIGIN}/api/ranked/config`), env({ RANKED_VERIFIER_SECRET: undefined }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not set up/);
});

test("verify stores evidence and returns its url", async () => {
  const e = env();
  const response = await handleRankedApi(post(verifyBody), e, { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.signature, signed.signature);
  assert.equal(result.evidence_url, `${ORIGIN}/api/ranked/evidence/${HASH}`);
  const stored = await handleRankedApi(new Request(result.evidence_url), e);
  assert.equal(stored.status, 200);
  assert.deepEqual(await stored.json(), { evidence: signed.evidence, save: SAVE });
});

test("evidence lookup for an unknown or malformed hash", async () => {
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/evidence/${"f".repeat(64)}`), env())).status, 404);
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/evidence/not-a-hash`), env())).status, 400);
});

test("unknown life returns 404", async () => {
  const response = await handleRankedApi(post(verifyBody), env(), { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(null) });
  assert.equal(response.status, 404);
});

test("a verification failure returns its reason with 400", async () => {
  const response = await handleRankedApi(post(verifyBody), env(), {
    verifier: async () => fakeVerifier(new VerificationError("This life has not ended yet.")), fetch: rpcReturning(LIFE),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "This life has not ended yet." });
});

test("malformed body rejected with 400", async () => {
  for (const body of ["not json", JSON.stringify({ life_id: 5, save: "{}" }), JSON.stringify({ life_id: "5", save: "{bad" }), JSON.stringify({ life_id: "x", save: "{}" })]) {
    const response = await handleRankedApi(post(body), env(), { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) });
    assert.equal(response.status, 400, body);
  }
});

test("oversized save rejected with 413", async () => {
  const huge = JSON.stringify({ life_id: "5", save: "x".repeat(MAX_RANKED_SAVE_BYTES + 1) });
  const response = await handleRankedApi(post(huge), env(), { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) });
  assert.equal(response.status, 413);
});

test("only GET and POST routes exist", async () => {
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/verify`), env())).status, 405);
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/nope`), env())).status, 404);
});

test("the main API handler routes /api/ranked", async () => {
  const { handleApi } = await import("../server/api.ts");
  const response = await handleApi(new Request(`${ORIGIN}/api/ranked/config`), env());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).contract_id, "lives.testnet");
});

test("verify still returns signed evidence when evidence storage is unavailable", async () => {
  const broken = { prepare() { throw new Error("no such table: ranked_evidence"); }, batch: async () => [] } as unknown as RankedEnvironment["DB"];
  const response = await handleRankedApi(post(verifyBody), env({ DB: broken }), { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.signature, signed.signature);
  assert.equal(body.evidence_stored, false);
});

test("a save that is JSON but not a life is rejected with 400", async () => {
  for (const save of ["null", "5", '"x"', '{"commands":"no"}', '{"seed":"ab","commands":[1]}']) {
    const response = await handleRankedApi(post(JSON.stringify({ life_id: "5", save })), env(), { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) });
    assert.equal(response.status, 400, save);
    assert.match((await response.json()).error, /save file/i);
  }
});

test("verify is rate limited per client and recovers after the window", async () => {
  const { createMemoryLimiter } = await import("../server/ranked/rate-limit.ts");
  let now = 0;
  const limiter = createMemoryLimiter({ limit: 2, windowMs: 60_000, now: () => now });
  const deps = { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE), limiter };
  const from = (ip: string) => new Request(`${ORIGIN}/api/ranked/verify`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: verifyBody });
  const e = env();
  assert.equal((await handleRankedApi(from("1.1.1.1"), e, deps)).status, 200);
  assert.equal((await handleRankedApi(from("1.1.1.1"), e, deps)).status, 200);
  const limited = await handleRankedApi(from("1.1.1.1"), e, deps);
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).error, /too many/i);
  assert.equal((await handleRankedApi(from("2.2.2.2"), e, deps)).status, 200, "other clients are unaffected");
  now = 60_001;
  assert.equal((await handleRankedApi(from("1.1.1.1"), e, deps)).status, 200);
});

test("a Cloudflare rate-limit binding is used when present", async () => {
  const calls: string[] = [];
  const binding = { limit: async ({ key }: { key: string }) => { calls.push(key); return { success: false }; } };
  const response = await handleRankedApi(new Request(`${ORIGIN}/api/ranked/verify`, { method: "POST", headers: { "cf-connecting-ip": "3.3.3.3" }, body: verifyBody }),
    env({ RANKED_RATE_LIMITER: binding }), { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) });
  assert.equal(response.status, 429);
  assert.deepEqual(calls, ["verify:3.3.3.3"]);
});
