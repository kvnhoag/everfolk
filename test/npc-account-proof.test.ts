import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { KeyPair, PublicKey } from "near-api-js";
import { resolveChainConfig } from "../client/chain/config.ts";
import { createEmailSession, type EmailBridge } from "../client/chain/email-session.ts";
import { createWalletSession, PLAY_KEY_REMOVED, type WalletLibraries } from "../client/chain/near-connect-session.ts";
import { createSessionRouter } from "../client/chain/session-router.ts";
import type { AccountProof, WalletSession } from "../client/chain/types.ts";

const cfg = resolveChainConfig({ contractId: "everfolk-lives-demo.testnet", rpcUrl: "https://rpc.invalid" }, {});
const CHALLENGE = "everfolk:npc-account:v1\nnonce:one-time-server-nonce\nlife:42\nplayer:α";
const digest = (message: string) => sha256(new TextEncoder().encode(message));

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

function assertProof(proof: AccountProof, key: KeyPair, accountId: string) {
  assert.equal(proof.accountId, accountId);
  assert.equal(proof.publicKey, key.getPublicKey().toString());
  assert.match(proof.publicKey, /^ed25519:[1-9A-HJ-NP-Za-km-z]+$/);
  assert.match(proof.signature, /^[0-9a-f]{128}$/);
  const signature = hexToBytes(proof.signature);
  assert.equal(PublicKey.fromString(proof.publicKey).verify(digest(CHALLENGE), signature), true);
  assert.equal(key.verify(digest(`${CHALLENGE}\nchanged`), signature), false);
  assert.deepEqual(Object.keys(proof).sort(), ["accountId", "publicKey", "signature"]);
}

function nearHarness(withKey = true, unreadableKey = false) {
  const key = KeyPair.fromRandom("ed25519");
  const accountId = "alice.testnet";
  const store = memoryStore(withKey ? { [`everfolk:play-key:${accountId}`]: key.toString() } : {});
  const log = { generated: 0, connects: 0, transactions: 0, disconnects: 0 };
  const handlers = new Map<string, () => void>();
  const wallet = {
    manifest: { id: "meteor-wallet" },
    async getAccounts() { return [{ accountId }]; },
    async signAndSendTransaction() { log.transactions += 1; throw new Error("A proof must not send a transaction."); },
  };
  const connector = {
    whenManifestLoaded: Promise.resolve(),
    availableWallets: [{ manifest: { features: { signInWithFunctionCallKey: true } } }],
    on(event: string, handler: () => void) { handlers.set(event, handler); },
    async getConnectedWallet() { return { wallet, accounts: [{ accountId }] }; },
    async connect() { log.connects += 1; return wallet; },
    async disconnect() { log.disconnects += 1; },
  };
  const near = {
    KeyPair: {
      fromRandom() { log.generated += 1; return KeyPair.fromRandom("ed25519"); },
      fromString(secret: Parameters<typeof KeyPair.fromString>[0]) {
        if (unreadableKey) throw new Error(`Could not read ${secret}`);
        return KeyPair.fromString(secret);
      },
    },
  };
  const load = async () => ({ connector, near }) as unknown as WalletLibraries;
  return { key, accountId, store, log, load, emitSignOut: () => handlers.get("wallet:signOut")?.() };
}

test("NEAR ownership proofs sign the server challenge hash with the retained play key without wallet prompts", async () => {
  const harness = nearHarness();
  const session = await createWalletSession(cfg, harness);
  const proof = await session.proveAccount!(CHALLENGE);
  assertProof(proof, harness.key, harness.accountId);
  assert.deepEqual(await session.proveAccount!(CHALLENGE), proof, "the same existing game key is reused");
  assert.deepEqual(harness.log, { generated: 0, connects: 0, transactions: 0, disconnects: 0 });
});

test("a missing or unreadable NEAR play key rejects ownership requests without opening the wallet", async () => {
  const missing = nearHarness(false);
  const session = await createWalletSession(cfg, missing);
  await assert.rejects(session.proveAccount!(CHALLENGE), { message: PLAY_KEY_REMOVED });
  assert.equal(session.needsPlayKey, true);
  const unreadable = nearHarness(true, true);
  const unreadableSession = await createWalletSession(cfg, unreadable);
  await assert.rejects(unreadableSession.proveAccount!(CHALLENGE), error => {
    assert.match((error as Error).message, /sign in again/);
    assert.equal((error as Error).message.includes(unreadable.key.toString()), false);
    return true;
  });
  assert.equal(missing.log.generated + missing.log.connects + missing.log.transactions, 0);
  assert.equal(unreadable.log.generated + unreadable.log.connects + unreadable.log.transactions, 0);
});

test("local and wallet-initiated NEAR sign-out prevent further account proofs", async () => {
  for (const external of [false, true]) {
    const harness = nearHarness();
    const session = await createWalletSession(cfg, harness);
    await session.proveAccount!(CHALLENGE);
    if (external) harness.emitSignOut();
    else await session.signOut();
    assert.equal(session.accountId, null);
    assert.equal(harness.store.getItem(`everfolk:play-key:${harness.accountId}`), null);
    await assert.rejects(session.proveAccount!(CHALLENGE), /Connect a NEAR wallet first/);
  }
});

async function emailHarness(sign?: (hash: string, key: KeyPair) => Promise<string>) {
  const key = KeyPair.fromRandom("ed25519");
  const publicKeyHex = bytesToHex(key.getPublicKey().data);
  const log = { hashes: [] as string[], confirmations: 0, logouts: 0 };
  const bridge: EmailBridge = {
    async login() {},
    async verify() { return { publicKeyHex, accessToken: "token", email: "ada@example.com" }; },
    async restore() { return { publicKeyHex: `0X${publicKeyHex.toUpperCase()}`, accessToken: "token", email: "ada@example.com" }; },
    async signHash(hash) {
      log.hashes.push(hash);
      return sign ? sign(hash, key) : `0X${bytesToHex(key.sign(hexToBytes(hash.slice(2))).signature).toUpperCase()}`;
    },
    async logout() { log.logouts += 1; },
  };
  const fetchFn = (async () => new Response(JSON.stringify({ result: { amount: "10000000000000000000000" } }))) as typeof fetch;
  const session = createEmailSession(cfg, bridge, {
    fetch: fetchFn,
    confirm: async () => { log.confirmations += 1; return true; },
  });
  await session.restore();
  return { key, publicKeyHex, log, session };
}

test("email ownership proofs reuse Privy's implicit account key and normalize the signature", async () => {
  const { key, publicKeyHex, log, session } = await emailHarness();
  const proof = await session.proveAccount!(CHALLENGE);
  assertProof(proof, key, publicKeyHex);
  assert.deepEqual(log.hashes, [`0x${bytesToHex(digest(CHALLENGE))}`]);
  assert.equal(log.confirmations, 0);
  await session.signOut();
  await assert.rejects(session.proveAccount!(CHALLENGE), /Sign in first/);
  assert.equal(log.hashes.length, 1);
});

test("email ownership proofs reject malformed signatures", async () => {
  for (const signature of ["0xabcd", `0x${"z".repeat(128)}`, "ab".repeat(65)]) {
    const { session } = await emailHarness(async () => signature);
    await assert.rejects(session.proveAccount!(CHALLENGE), /unreadable signature/);
  }
});

test("email sign-out or a new email sign-in cancels ownership proofs already awaiting Privy", async () => {
  for (const replace of [false, true]) {
    let release: (value: string) => void = () => {};
    const { session, key, log } = await emailHarness(() => new Promise<string>(resolve => { release = resolve; }));
    const pending = session.proveAccount!(CHALLENGE);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(log.hashes.length, 1);
    if (replace) await session.sendCode("grace@example.com");
    else await session.signOut();
    release(`0x${bytesToHex(key.sign(digest(CHALLENGE)).signature)}`);
    await assert.rejects(pending, /signed out/i);
    await assert.rejects(session.proveAccount!(CHALLENGE), /Sign in first/);
  }
});

function proofSession(account: string, key = KeyPair.fromRandom("ed25519")) {
  let accountId: string | null = null;
  let gate: Promise<void> = Promise.resolve();
  const messages: string[] = [];
  const session: WalletSession = {
    get accountId() { return accountId; },
    async signIn() { accountId = account; },
    async signOut() { accountId = null; },
    async call() { throw new Error("No transaction expected."); },
    async proveAccount(message) {
      messages.push(message);
      await gate;
      return { accountId: account, publicKey: key.getPublicKey().toString(), signature: bytesToHex(key.sign(digest(message)).signature) };
    },
  };
  return { session, key, messages, wait: (pending: Promise<void>) => { gate = pending; } };
}

test("the router proves only the chosen account and rejects proofs when signed out", async () => {
  const wallet = proofSession("alice.testnet");
  const email = proofSession("ab".repeat(32));
  const router = createSessionRouter({ wallet: async () => wallet.session, email: async () => email.session }, memoryStore());
  await assert.rejects(router.proveAccount(CHALLENGE), /Sign in first/);
  await router.use("wallet");
  assertProof(await router.proveAccount(CHALLENGE), wallet.key, "alice.testnet");
  await router.use("email");
  assertProof(await router.proveAccount(CHALLENGE), email.key, "ab".repeat(32));
  assert.deepEqual(wallet.messages, [CHALLENGE]);
  assert.deepEqual(email.messages, [CHALLENGE]);
  await router.signOut();
  await assert.rejects(router.proveAccount(CHALLENGE), /Sign in first/);
});

test("the router rejects a proof completed after switching or signing out, including returning to the same session", async () => {
  for (const next of ["signed-out", "email", "same-wallet"] as const) {
    const wallet = proofSession("alice.testnet");
    const email = proofSession("ab".repeat(32));
    const router = createSessionRouter({ wallet: async () => wallet.session, email: async () => email.session }, memoryStore());
    await router.use("wallet");
    let release: () => void = () => {};
    wallet.wait(new Promise<void>(resolve => { release = resolve; }));
    const pending = router.proveAccount(CHALLENGE);
    await router.signOut();
    if (next === "email") await router.use("email");
    if (next === "same-wallet") await router.use("wallet");
    release();
    await assert.rejects(pending, /sign-in changed/i);
    if (next !== "signed-out") assert.ok((await router.proveAccount(CHALLENGE)).accountId);
  }
});

test("the router rejects unsupported ownership signing and account mismatches", async () => {
  const unsupported: WalletSession = { accountId: "alice.testnet", async signIn() {}, async signOut() {}, async call() {} };
  const wallet = proofSession("alice.testnet");
  const router = createSessionRouter({ wallet: async () => unsupported, email: async () => wallet.session }, memoryStore());
  await router.use("wallet");
  await assert.rejects(router.proveAccount(CHALLENGE), /Sign in again/);
  await router.use("email");
  wallet.session.proveAccount = async () => ({ accountId: "bob.testnet", publicKey: wallet.key.getPublicKey().toString(), signature: "a".repeat(128) });
  await assert.rejects(router.proveAccount(CHALLENGE), /did not match/);
});
