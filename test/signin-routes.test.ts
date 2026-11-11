import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DRIP_DAILY_CAP, FUNDER_RESERVE_YOCTO, handleSignInApi } from "../server/signin/routes.ts";
import type { SignInDependencies, SignInEnvironment } from "../server/signin/routes.ts";
import { createPrivyTokenVerifier, TokenServiceError } from "../server/signin/privy-token.ts";
import { createAccountBalance, createTransfer, isRejectedBeforeInclusion, redact, TransferNotSentError } from "../server/signin/funder.ts";
import { TestDatabase } from "./support/d1.ts";

const ORIGIN = "https://everfolk.test";
const APP_ID = "privy-app-123";
const SECRET_KEY = "ed25519:SuperSecretFunderKeyThatMustNeverLeak111111111111111111111111";
const DRIP = "100000000000000000000000";
const IMPLICIT = "a".repeat(64);
const NOW = new Date("2026-11-12T10:00:00Z");
const FUNDER = "funder.testnet";
const FUNDER_RICH = "10000000000000000000000000";
const funderOr = (other: string | null) => async (id: string) => (id === FUNDER ? FUNDER_RICH : other);

const allowAll = { limit: async () => ({ success: true }) };

function env(overrides: Partial<SignInEnvironment> = {}): SignInEnvironment {
  return {
    DB: new TestDatabase(), VITE_EVERFOLK_PRIVY_APP_ID: APP_ID, EVERFOLK_FUNDER_ACCOUNT_ID: "funder.testnet",
    EVERFOLK_FUNDER_PRIVATE_KEY: SECRET_KEY, NEAR_RPC_URL: "https://rpc.test", ...overrides,
  };
}

interface Harness { deps: SignInDependencies; transfers: Array<{ to: string; yocto: string }> }

function harness(overrides: Partial<SignInDependencies> = {}): Harness {
  const transfers: Array<{ to: string; yocto: string }> = [];
  const deps: SignInDependencies = {
    verifyToken: async token => {
      if (!token.startsWith("good:")) throw new Error("forged");
      return { userId: token.slice("good:".length) };
    },
    transfer: async (to, yocto) => { transfers.push({ to, yocto }); return { hash: `tx-${transfers.length}` }; },
    accountBalance: funderOr(null),
    now: () => NOW,
    limiter: allowAll,
    ...overrides,
  };
  return { deps, transfers };
}

const fund = (token: string | null, body: unknown, ip = "1.2.3.4") => new Request(`${ORIGIN}/api/signin/fund`, {
  method: "POST",
  headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const config = () => new Request(`${ORIGIN}/api/signin/config`);

test("config hides the funder key", async () => {
  const response = await handleSignInApi(config(), env(), harness().deps);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.ok(!text.includes(SECRET_KEY), "the private key never appears in the response");
  assert.ok(!text.includes("funder.testnet"), "the funder account is not advertised either");
  assert.deepEqual(JSON.parse(text), { privyAppId: APP_ID, funding: true, dripYocto: DRIP });
});

test("config reports funding false without a key", async () => {
  const noKey = await (await handleSignInApi(config(), env({ EVERFOLK_FUNDER_PRIVATE_KEY: undefined }))).json();
  assert.equal(noKey.funding, false);
  const noDb = await (await handleSignInApi(config(), env({ DB: undefined }))).json();
  assert.equal(noDb.funding, false);
  const noApp = await (await handleSignInApi(config(), env({ VITE_EVERFOLK_PRIVY_APP_ID: undefined }))).json();
  assert.deepEqual(noApp, { privyAppId: null, funding: false, dripYocto: DRIP });
});

test("config uses a valid drip from env and falls back on invalid values", async () => {
  const custom = await (await handleSignInApi(config(), env({ EVERFOLK_DRIP_YOCTO: "5000" }))).json();
  assert.equal(custom.dripYocto, "5000");
  for (const bad of ["0", "-1", "abc", "1.5", "1e24", ""]) {
    const fallback = await (await handleSignInApi(config(), env({ EVERFOLK_DRIP_YOCTO: bad }))).json();
    assert.equal(fallback.dripYocto, DRIP, `drip ${JSON.stringify(bad)} falls back`);
  }
});

test("fund sends 0.1 NEAR once per Privy user", async () => {
  const e = env();
  const { deps, transfers } = harness();
  const first = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { funded: true, hash: "tx-1" });
  assert.deepEqual(transfers, [{ to: IMPLICIT, yocto: DRIP }]);
  const second = await handleSignInApi(fund("good:did:privy:alice", { accountId: "b".repeat(64) }), e, deps);
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { funded: false, reason: "already-funded" });
  assert.equal(transfers.length, 1, "the same Privy user is never funded twice");
});

test("concurrent fund calls for one Privy user transfer once", async () => {
  const e = env();
  const { deps, transfers } = harness();
  const results = await Promise.all([1, 2, 3].map(() => handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps)));
  const bodies = await Promise.all(results.map(response => response.json()));
  assert.equal(transfers.length, 1);
  assert.equal(bodies.filter(body => body.funded === true).length, 1);
});

test("fund refuses a forged token", async () => {
  const { deps, transfers } = harness();
  const forged = await handleSignInApi(fund("forged-token", { accountId: IMPLICIT }), env(), deps);
  assert.equal(forged.status, 401);
  const missing = await handleSignInApi(fund(null, { accountId: IMPLICIT }), env(), deps);
  assert.equal(missing.status, 401);
  assert.equal(transfers.length, 0);
});

test("fund refuses a named account", async () => {
  const { deps, transfers } = harness();
  for (const accountId of ["alice.testnet", "A".repeat(64), "a".repeat(63), 42, null]) {
    const response = await handleSignInApi(fund("good:did:privy:alice", { accountId }), env(), deps);
    assert.equal(response.status, 400, `accountId ${JSON.stringify(accountId)} is refused`);
  }
  assert.equal((await handleSignInApi(fund("good:did:privy:alice", "not json"), env(), deps)).status, 400);
  assert.equal(transfers.length, 0);
});

test("fund refuses an account that already has NEAR", async () => {
  const e = env();
  const { deps, transfers } = harness({ accountBalance: async () => "1" });
  const response = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps);
  assert.equal(response.status, 409);
  assert.equal(transfers.length, 0);
  const retry = harness();
  const later = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, retry.deps);
  assert.equal(later.status, 200, "a refusal does not use up the user's one funding");
});

test("fund treats a zero balance as unfunded", async () => {
  const { deps, transfers } = harness({ accountBalance: funderOr("0") });
  const response = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), env(), deps);
  assert.equal(response.status, 200);
  assert.equal(transfers.length, 1);
});

test("fund never funds one account for two Privy users", async () => {
  const e = env();
  const { deps, transfers } = harness();
  assert.equal((await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps)).status, 200);
  const other = await handleSignInApi(fund("good:did:privy:bob", { accountId: IMPLICIT }), e, deps);
  assert.equal(other.status, 409);
  assert.equal(transfers.length, 1);
});

test("fund stops at the daily cap", async () => {
  const e = env({ EVERFOLK_DRIP_DAILY_CAP: "1" });
  const { deps, transfers } = harness();
  assert.equal((await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps)).status, 200);
  const capped = await handleSignInApi(fund("good:did:privy:bob", { accountId: "b".repeat(64) }), e, deps);
  assert.equal(capped.status, 429);
  assert.equal(transfers.length, 1);
  const tomorrow = harness({ now: () => new Date("2026-11-13T00:00:01Z") });
  const nextDay = await handleSignInApi(fund("good:did:privy:bob", { accountId: "b".repeat(64) }), e, tomorrow.deps);
  assert.equal(nextDay.status, 200, "the cap resets at 00:00 UTC");
});

test("fund ignores an invalid daily cap and uses the default of 5", async () => {
  assert.equal(DEFAULT_DRIP_DAILY_CAP, 5);
  for (const cap of [undefined, "-3", "0", "abc", "99999999999999999999"]) {
    const e = env({ EVERFOLK_DRIP_DAILY_CAP: cap });
    const { deps, transfers } = harness();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const account = i.toString(16).repeat(64);
      statuses.push((await handleSignInApi(fund(`good:did:privy:user${i}`, { accountId: account }), e, deps)).status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429], `cap ${JSON.stringify(cap)} falls back to 5`);
    assert.equal(transfers.length, 5);
  }
});

test("fund pauses when the funder cannot cover a drip plus its reserve", async () => {
  assert.equal(FUNDER_RESERVE_YOCTO, "50000000000000000000000");
  const threshold = (BigInt(DRIP) + BigInt(FUNDER_RESERVE_YOCTO)).toString();
  const below = (BigInt(threshold) - 1n).toString();
  const e = env();
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const funderBalance of [below, "0", null]) {
      const { deps, transfers } = harness({ accountBalance: async id => (id === FUNDER ? funderBalance : null) });
      const response = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).error, "Funding is paused.");
      assert.equal(transfers.length, 0);
    }
  } finally {
    console.error = originalError;
  }
  const rows = (e.DB as TestDatabase).sqlite.prepare("SELECT COUNT(*) AS n FROM signin_funding").get() as { n: number };
  assert.equal(rows.n, 0, "a paused request claims nothing");
  const topped = harness({ accountBalance: async id => (id === FUNDER ? threshold : null) });
  assert.equal((await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, topped.deps)).status, 200);
});

test("fund limits each client to 6 attempts a minute", async () => {
  const { deps, transfers } = harness({ limiter: undefined });
  const ip = "9.9.9.9";
  const statuses: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    statuses.push((await handleSignInApi(fund("forged", { accountId: IMPLICIT }, ip), env(), deps)).status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 401, 429]);
  assert.equal(transfers.length, 0);
});

test("fund is unavailable when funding is not configured", async () => {
  const { deps, transfers } = harness();
  for (const missing of [{ EVERFOLK_FUNDER_PRIVATE_KEY: undefined }, { EVERFOLK_FUNDER_ACCOUNT_ID: undefined }, { DB: undefined }, { VITE_EVERFOLK_PRIVY_APP_ID: undefined }]) {
    const response = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), env(missing), deps);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes(SECRET_KEY));
  }
  assert.equal(transfers.length, 0);
});

function quietly<T>(run: (logged: unknown[]) => Promise<T>): Promise<T> {
  const logged: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  return run(logged).finally(() => { console.error = originalError; });
}

test("a transfer that may have been sent keeps the reservation", async () => {
  const e = env();
  let attempts = 0;
  const timingOut = harness({
    transfer: async (_to, _yocto, onSigned) => {
      attempts += 1;
      await onSigned?.("signed-hash");
      throw new Error(`TransactionTimeoutError near ${SECRET_KEY}`);
    },
  });
  await quietly(async logged => {
    const response = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, timingOut.deps);
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.ok(!text.includes(SECRET_KEY));
    assert.deepEqual(JSON.parse(text), { funded: false, reason: "pending", error: "Your account is still being set up." });
    assert.ok(!JSON.stringify(logged).includes(SECRET_KEY), "logs never contain the key");
  });
  const row = (e.DB as TestDatabase).sqlite.prepare("SELECT tx_hash FROM signin_funding WHERE privy_user_id = ?").get("did:privy:alice") as { tx_hash: string };
  assert.equal(row.tx_hash, "signed-hash", "the signed hash is recorded before broadcast");
  const retry = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, timingOut.deps);
  assert.deepEqual(await retry.json(), { funded: false, reason: "already-funded" });
  assert.equal(attempts, 1, "a quick retry never sends a second drip");
});

test("a transfer proven not sent can be retried", async () => {
  const e = env();
  const rejected = harness({
    transfer: async (_to, _yocto, onSigned) => {
      await onSigned?.("signed-hash");
      throw new TransferNotSentError(`rejected by the node near ${SECRET_KEY}`);
    },
  });
  await quietly(async logged => {
    const failed = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, rejected.deps);
    assert.equal(failed.status, 502);
    assert.ok(!(await failed.text()).includes(SECRET_KEY), "errors never echo the key");
    assert.ok(logged.length > 0, "transfer failures are logged server-side");
    assert.ok(!JSON.stringify(logged).includes(SECRET_KEY), "logs never contain the key");
  });
  const { deps, transfers } = harness();
  const retried = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps);
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), { funded: true, hash: "tx-1" });
  assert.equal(transfers.length, 1);
});

test("redact removes the trimmed key and its bare base58 part", () => {
  const base58 = "3xYzSecretBase58Part";
  assert.equal(redact(`a ${base58} b ed25519:${base58} c`, `  ed25519:${base58}\n`), "a [redacted] b [redacted] c");
  assert.equal(redact("nothing here", undefined), "nothing here");
});

test("logs redact a key that env padded with whitespace", async () => {
  const bare = "PaddedSecretBase58KeyValue";
  const e = env({ EVERFOLK_FUNDER_PRIVATE_KEY: `  ed25519:${bare}  ` });
  const leaky = harness({ transfer: async () => { throw new TransferNotSentError(`boom ${bare}`); } });
  await quietly(async logged => {
    await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, leaky.deps);
    assert.ok(logged.length > 0);
    assert.ok(!JSON.stringify(logged).includes(bare));
  });
});

test("unknown routes and methods are refused", async () => {
  assert.equal((await handleSignInApi(new Request(`${ORIGIN}/api/signin/nope`), env())).status, 404);
  assert.equal((await handleSignInApi(new Request(`${ORIGIN}/api/signin/fund`), env())).status, 405);
  assert.equal((await handleSignInApi(new Request(`${ORIGIN}/api/signin/config`, { method: "POST" }), env())).status, 405);
});

// --- Privy access-token verification -------------------------------------------------------------

const encoder = new TextEncoder();
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const b64json = (value: unknown) => b64url(encoder.encode(JSON.stringify(value)));

async function keyPair() {
  return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
}

async function sign(privateKey: CryptoKey, header: Record<string, unknown>, claims: Record<string, unknown>): Promise<string> {
  const input = `${b64json(header)}.${b64json(claims)}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, encoder.encode(input));
  return `${input}.${b64url(new Uint8Array(signature))}`;
}

async function jwksFetch(publicKey: CryptoKey, kid: string, calls: string[]): Promise<typeof fetch> {
  const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid, alg: "ES256", use: "sig" };
  return (async (input: string | URL | Request) => {
    calls.push(String(input));
    return Response.json({ keys: [jwk] });
  }) as typeof fetch;
}

const nowSeconds = Math.floor(NOW.getTime() / 1000);
const goodClaims = { iss: "privy.io", aud: APP_ID, sub: "did:privy:alice", iat: nowSeconds - 10, exp: nowSeconds + 3600 };

test("privy token verification checks issuer, audience and expiry", async () => {
  const keys = await keyPair();
  const calls: string[] = [];
  const verify = createPrivyTokenVerifier({ fetch: await jwksFetch(keys.publicKey, "k1", calls), now: () => NOW });
  const header = { alg: "ES256", typ: "JWT", kid: "k1" };

  assert.deepEqual(await verify(await sign(keys.privateKey, header, goodClaims), APP_ID), { userId: "did:privy:alice" });
  assert.deepEqual(await verify(await sign(keys.privateKey, header, { ...goodClaims, aud: ["other", APP_ID] }), APP_ID), { userId: "did:privy:alice" });
  assert.equal(calls[0], `https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`);
  assert.equal(calls.length, 1, "the JWKS is cached per isolate");

  const rejects = async (token: string, label: string) => assert.rejects(verify(token, APP_ID), undefined, label);
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, iss: "evil.io" }), "wrong issuer");
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, aud: "another-app" }), "wrong audience");
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, exp: nowSeconds - 1 }), "expired");
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, exp: undefined }), "no expiry");
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, nbf: nowSeconds + 3600 }), "not yet valid");
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, iat: nowSeconds + 3600 }), "issued in the future");
  await rejects(await sign(keys.privateKey, header, { ...goodClaims, sub: "" }), "no subject");
  await rejects(await sign(keys.privateKey, { ...header, alg: "HS256" }, goodClaims), "wrong algorithm");
  await rejects(await sign(keys.privateKey, { alg: "none" }, goodClaims), "alg none");

  const other = await keyPair();
  await rejects(await sign(other.privateKey, header, goodClaims), "signed by another key");
  const good = await sign(keys.privateKey, header, goodClaims);
  const [h, , s] = good.split(".");
  await rejects(`${h}.${b64json({ ...goodClaims, sub: "did:privy:mallory" })}.${s}`, "tampered payload");
  await rejects("not-a-jwt", "malformed");
  await rejects(`${h}..${s}`, "empty payload");
});

test("privy token verification matches kid and tolerates a missing kid", async () => {
  const keys = await keyPair();
  const calls: string[] = [];
  const verify = createPrivyTokenVerifier({ fetch: await jwksFetch(keys.publicKey, "k1", calls), now: () => NOW });
  await assert.rejects(verify(await sign(keys.privateKey, { alg: "ES256", kid: "unknown" }, goodClaims), APP_ID));
  assert.deepEqual(await verify(await sign(keys.privateKey, { alg: "ES256" }, goodClaims), APP_ID), { userId: "did:privy:alice" });
});

// --- Balance lookup over RPC ----------------------------------------------------------------------

function rpc(reply: unknown): typeof fetch {
  return (async () => Response.json(reply)) as typeof fetch;
}

test("account balance reads view_account and treats unknown accounts as empty", async () => {
  const seen: unknown[] = [];
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    seen.push(JSON.parse(String(init?.body)));
    return Response.json({ jsonrpc: "2.0", id: "everfolk", result: { amount: "250", locked: "0" } });
  }) as typeof fetch;
  assert.equal(await createAccountBalance("https://rpc.test", fetcher)(IMPLICIT), "250");
  assert.deepEqual((seen[0] as { params: unknown }).params, { request_type: "view_account", finality: "final", account_id: IMPLICIT });

  const unknown = rpc({ jsonrpc: "2.0", error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_ACCOUNT", info: {} }, code: -32000, message: "Server error" } });
  assert.equal(await createAccountBalance("https://rpc.test", unknown)(IMPLICIT), null);

  const broken = rpc({ jsonrpc: "2.0", error: { name: "INTERNAL_ERROR", cause: { name: "INTERNAL_ERROR" }, message: "boom" } });
  await assert.rejects(createAccountBalance("https://rpc.test", broken)(IMPLICIT));
});

test("fund reports an unreachable balance lookup without transferring", async () => {
  const { deps, transfers } = harness({ accountBalance: async () => { throw new Error("rpc down"); } });
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), env(), deps);
    assert.equal(response.status, 503);
  } finally {
    console.error = originalError;
  }
  assert.equal(transfers.length, 0);
});

test("unreachable Privy keys are a service outage, not a bad token", async () => {
  const down = (async () => { throw new Error("network down"); }) as typeof fetch;
  const verify = createPrivyTokenVerifier({ fetch: down, now: () => NOW });
  const keys = await keyPair();
  await assert.rejects(verify(await sign(keys.privateKey, { alg: "ES256", kid: "k1" }, goodClaims), APP_ID), TokenServiceError);
  const { deps, transfers } = harness({ verifyToken: async () => { throw new TokenServiceError("keys down"); } });
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await handleSignInApi(fund("anything", { accountId: IMPLICIT }), env(), deps)).status, 503);
  } finally {
    console.error = originalError;
  }
  assert.equal(transfers.length, 0);
});

test("the API handler dispatches sign-in routes", async () => {
  const { handleApi } = await import("../server/handler.ts");
  const response = await handleApi(config(), env({ EVERFOLK_FUNDER_PRIVATE_KEY: undefined }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { privyAppId: APP_ID, funding: false, dripYocto: DRIP });
});

test("the real transfer never echoes a malformed funder key", async () => {
  const badKey = "ed25519:0OIl-not-base58-secret";
  const transfer = createTransfer({ accountId: "funder.testnet", privateKey: badKey, rpcUrl: "http://127.0.0.1:9" });
  await assert.rejects(transfer(IMPLICIT, DRIP), (error: Error) => {
    assert.ok(!error.message.includes(badKey), error.message);
    return true;
  });
});

// --- Real near-api-js transfer against a stubbed RPC (no network) ----------------------------------

const BLOCK_HASH = "11111111111111111111111111111111";

async function withRpc<T>(sendTx: () => unknown, run: (sends: () => number) => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { id: string; method: string };
    const reply = (body: Record<string, unknown>) => Response.json({ jsonrpc: "2.0", id: request.id, ...body });
    if (request.method === "query") return reply({ result: { nonce: 7, permission: "FullAccess", block_hash: BLOCK_HASH, block_height: 1 } });
    if (request.method === "block") return reply({ result: { header: { hash: BLOCK_HASH, height: 1 } } });
    if (request.method === "send_tx") {
      sends += 1;
      const answer = sendTx();
      return answer instanceof Response ? answer : reply(answer as Record<string, unknown>);
    }
    return reply({ error: { name: "REQUEST_VALIDATION_ERROR", cause: { name: "METHOD_NOT_FOUND", info: { method_name: request.method } } } });
  }) as typeof fetch;
  try { return await run(() => sends); } finally { globalThis.fetch = originalFetch; }
}

async function realTransfer() {
  const { KeyPair } = await import("near-api-js");
  const key = KeyPair.fromRandom("ed25519").toString();
  const signedHashes: string[] = [];
  const transfer = createTransfer({ accountId: FUNDER, privateKey: key, rpcUrl: "https://rpc.test" });
  return { key, signedHashes, send: () => transfer(IMPLICIT, DRIP, async hash => { signedHashes.push(hash); }) };
}

const outcome = (status: unknown) => ({ result: { status, transaction: { hash: "x" }, transaction_outcome: { id: "x", block_hash: BLOCK_HASH }, receipts_outcome: [], final_execution_status: "EXECUTED_OPTIMISTIC" } });

test("real transfer: success returns the signed hash recorded before broadcast", async () => {
  const { signedHashes, send } = await realTransfer();
  await withRpc(() => outcome({ SuccessValue: "" }), async sends => {
    const { hash } = await send();
    assert.deepEqual(signedHashes, [hash]);
    assert.equal(sends(), 1);
  });
});

test("real transfer: a node timeout is not proof of not sending, and is not resent", async () => {
  const { key, signedHashes, send } = await realTransfer();
  await withRpc(() => ({ error: { name: "HANDLER_ERROR", cause: { name: "TIMEOUT_ERROR", info: {} }, message: "Timeout" } }), async sends => {
    await assert.rejects(send(), (error: Error) => {
      assert.ok(!(error instanceof TransferNotSentError), error.message);
      assert.ok(!error.message.includes(key.split(":")[1]));
      return true;
    });
    assert.equal(signedHashes.length, 1);
    assert.equal(sends(), 1, "the signed transaction is broadcast once");
  });
});

test("real transfer: an unavailable RPC during broadcast keeps the drip pending and is not resent", async () => {
  const { send } = await realTransfer();
  await withRpc(() => new Response("unavailable", { status: 503 }), async sends => {
    await assert.rejects(send(), (error: Error) => !(error instanceof TransferNotSentError));
    assert.equal(sends(), 1);
  });
});

test("real transfer: a rejected nonce or a refunded failure is proof of not sending", async () => {
  const invalidNonce = { error: { name: "HANDLER_ERROR", cause: { name: "INVALID_TRANSACTION", info: {} }, data: { TxExecutionError: { InvalidTxError: { InvalidNonce: { ak_nonce: 9, tx_nonce: 8 } } } }, message: "Invalid" } };
  const failure = outcome({ Failure: { ActionError: { index: 0, kind: { AccountDoesNotExist: { account_id: IMPLICIT } } } } });
  for (const reply of [invalidNonce, failure]) {
    const { send } = await realTransfer();
    await withRpc(() => reply, async () => {
      await assert.rejects(send(), TransferNotSentError);
    });
  }
});

test("rejection classification uses near-api-js error types", async () => {
  const errors = await import("near-api-js/rpc-errors");
  assert.equal(isRejectedBeforeInclusion(new errors.InvalidNonceError(9n as never, 8n as never, "h", "b")), true);
  assert.equal(isRejectedBeforeInclusion(new errors.InvalidTransactionError()), true);
  assert.equal(isRejectedBeforeInclusion(new errors.TransactionTimeoutError()), false);
  assert.equal(isRejectedBeforeInclusion(new errors.ActionExecutionError("x", 0, "h", "b")), false);
  assert.equal(isRejectedBeforeInclusion(new Error("RetriesExceeded")), false);
});
