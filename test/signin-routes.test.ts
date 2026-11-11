import assert from "node:assert/strict";
import test from "node:test";
import { handleSignInApi } from "../server/signin/routes.ts";
import type { SignInDependencies, SignInEnvironment } from "../server/signin/routes.ts";
import { createPrivyTokenVerifier, TokenServiceError } from "../server/signin/privy-token.ts";
import { createAccountBalance, createTransfer } from "../server/signin/funder.ts";
import { TestDatabase } from "./support/d1.ts";

const ORIGIN = "https://everfolk.test";
const APP_ID = "privy-app-123";
const SECRET_KEY = "ed25519:SuperSecretFunderKeyThatMustNeverLeak111111111111111111111111";
const DRIP = "100000000000000000000000";
const IMPLICIT = "a".repeat(64);
const NOW = new Date("2026-11-12T10:00:00Z");

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
    accountBalance: async () => null,
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
  const { deps, transfers } = harness({ accountBalance: async () => "0" });
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

test("fund ignores an invalid daily cap and uses the default", async () => {
  const e = env({ EVERFOLK_DRIP_DAILY_CAP: "-3" });
  const { deps } = harness();
  assert.equal((await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps)).status, 200);
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

test("a failed transfer can be retried", async () => {
  const e = env();
  const logged: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    const failing = harness({ transfer: async () => { throw new Error(`rpc exploded near ${SECRET_KEY}`); } });
    const failed = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, failing.deps);
    assert.equal(failed.status, 502);
    assert.ok(!(await failed.text()).includes(SECRET_KEY), "errors never echo the key");
  } finally {
    console.error = originalError;
  }
  assert.ok(logged.length > 0, "transfer failures are logged server-side");
  assert.ok(!JSON.stringify(logged).includes(SECRET_KEY), "logs never contain the key");
  const { deps, transfers } = harness();
  const retried = await handleSignInApi(fund("good:did:privy:alice", { accountId: IMPLICIT }), e, deps);
  assert.equal(retried.status, 200);
  assert.equal(transfers.length, 1);
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
