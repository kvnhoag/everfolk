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
  assert.equal(result.save_url, `${result.evidence_url}/save`);
  const stored = await handleRankedApi(new Request(result.evidence_url), e);
  assert.equal(stored.status, 200);
  assert.match(stored.headers.get("content-type")!, /^application\/json/);
  assert.equal(await stored.text(), signed.evidence_json, "the reference URL preserves the signed bytes");
  const replay = await handleRankedApi(new Request(result.save_url), e);
  assert.equal(replay.status, 200);
  assert.equal(await replay.text(), JSON.stringify(SAVE), "the replay remains available separately");
});

test("evidence lookup for an unknown or malformed hash", async () => {
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/evidence/${"f".repeat(64)}`), env())).status, 404);
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/evidence/not-a-hash`), env())).status, 400);
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/evidence/${"f".repeat(64)}/save`), env())).status, 404);
  assert.equal((await handleRankedApi(new Request(`${ORIGIN}/api/ranked/evidence/not-a-hash/save`), env())).status, 400);
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

/** No prefetch: tests can prove that a rejected request was cancelled before being drained. */
function streamingPost(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let read = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (read === chunks.length) { controller.close(); return; }
      controller.enqueue(chunks[read++]);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const request = new Request(`${ORIGIN}/api/ranked/verify`, {
    method: "POST", body: stream, headers, duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, read: () => read, cancelled: () => cancelled };
}

test("oversized chunked uploads are cancelled at the byte limit without Content-Length", async () => {
  const chunk = new Uint8Array(500_000).fill(120);
  const input = streamingPost(Array.from({ length: 12 }, () => chunk));
  const response = await handleRankedApi(input.request, env(), {
    verifier: async () => { throw new Error("oversized uploads must not reach verification"); },
    fetch: async () => { throw new Error("oversized uploads must not reach the RPC"); },
  });
  assert.equal(response.status, 413);
  assert.equal(input.read(), 4, "stop at the first chunk that crosses the cap, rather than reading all 6 MB");
  assert.equal(input.cancelled(), true);
});

test("a small declared Content-Length cannot bypass the streaming byte limit", async () => {
  const input = streamingPost([new Uint8Array(MAX_RANKED_SAVE_BYTES + 4_097)], { "content-length": "1" });
  const response = await handleRankedApi(input.request, env(), { verifier: async () => fakeVerifier(signed) });
  assert.equal(response.status, 413);
  assert.equal(input.cancelled(), true);
});

test("an oversized declared Content-Length cancels before reading the upload", async () => {
  const input = streamingPost([new TextEncoder().encode(verifyBody)], { "content-length": String(MAX_RANKED_SAVE_BYTES + 4_097) });
  const response = await handleRankedApi(input.request, env(), { verifier: async () => fakeVerifier(signed) });
  assert.equal(response.status, 413);
  assert.equal(input.read(), 0);
  assert.equal(input.cancelled(), true);
});

test("a body exactly at the byte cap is accepted and one extra byte is rejected", async () => {
  const empty = JSON.stringify({ life_id: "5", save: JSON.stringify(SAVE), padding: "" });
  const body = JSON.stringify({ life_id: "5", save: JSON.stringify(SAVE), padding: "x".repeat(MAX_RANKED_SAVE_BYTES + 4_096 - empty.length) });
  const bytes = new TextEncoder().encode(body);
  const deps = { verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE) };
  assert.equal(bytes.byteLength, MAX_RANKED_SAVE_BYTES + 4_096);
  const accepted = streamingPost([bytes.subarray(0, 100), bytes.subarray(100)]);
  assert.equal((await handleRankedApi(accepted.request, env(), deps)).status, 200);
  const rejected = streamingPost([bytes, new Uint8Array([32])]);
  assert.equal((await handleRankedApi(rejected.request, env(), deps)).status, 413);
  assert.equal(rejected.cancelled(), true);
});

test("UTF-8 characters split across upload chunks retain their exact value", async () => {
  const save = { ...SAVE, seed: "Αλεξάνδρεια — 🏺" };
  const bytes = new TextEncoder().encode(JSON.stringify({ life_id: "5", save: JSON.stringify(save) }));
  const input = streamingPost(Array.from(bytes, value => new Uint8Array([value])));
  let received: unknown;
  const verifier = fakeVerifier(signed);
  verifier.verify = async (_life, parsed) => { received = parsed; return signed; };
  const response = await handleRankedApi(input.request, env(), { verifier: async () => verifier, fetch: rpcReturning(LIFE) });
  assert.equal(response.status, 200);
  assert.deepEqual(received, save);
});

test("the save limit counts UTF-8 bytes rather than JavaScript characters", async () => {
  const empty = JSON.stringify({ ...SAVE, padding: "" });
  const room = MAX_RANKED_SAVE_BYTES + 1 - new TextEncoder().encode(empty).byteLength;
  const padding = "é".repeat(Math.floor(room / 2)) + (room % 2 ? "x" : "");
  const save = JSON.stringify({ ...SAVE, padding });
  assert.ok(save.length < MAX_RANKED_SAVE_BYTES);
  assert.equal(new TextEncoder().encode(save).byteLength, MAX_RANKED_SAVE_BYTES + 1);
  const response = await handleRankedApi(post(JSON.stringify({ life_id: "5", save })), env(), {
    verifier: async () => fakeVerifier(signed), fetch: rpcReturning(LIFE),
  });
  assert.equal(response.status, 413);
});

test("a rate-limited request is cancelled before its body is read", async () => {
  const input = streamingPost([new TextEncoder().encode(verifyBody)]);
  const response = await handleRankedApi(input.request, env(), {
    limiter: { limit: async () => ({ success: false }) }, verifier: async () => fakeVerifier(signed),
  });
  assert.equal(response.status, 429);
  assert.equal(input.read(), 0);
  assert.equal(input.cancelled(), true);
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
