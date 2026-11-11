import assert from "node:assert/strict";
import test from "node:test";
import { createSessionRouter, SIGN_IN_STORAGE_KEY, type SignInMethod } from "../client/chain/session-router.ts";
import type { ContractCall, WalletSession } from "../client/chain/types.ts";

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

/** A session that signs in to `account` and records every call and sign-out. */
function fakeSession(account: string, opts: { restored?: boolean } = {}) {
  let accountId: string | null = opts.restored ? account : null;
  const calls: ContractCall[] = [];
  const log = { signIns: 0, signOuts: 0 };
  const session: WalletSession = {
    get accountId() { return accountId; },
    get walletId() { return accountId ? `${account}-wallet` : null; },
    async signIn() { log.signIns += 1; accountId = account; },
    async signOut() { log.signOuts += 1; accountId = null; },
    async call(call) { calls.push(call); return `${account}:${call.method}`; },
  };
  return { session, calls, log };
}

const CHECKPOINT: ContractCall = { method: "checkpoint", args: {}, gas: "30000000000000", deposit: "0", access: "function-call-key" };

function openers(email = fakeSession("abc123"), wallet = fakeSession("alice.testnet")) {
  const opened: SignInMethod[] = [];
  const open = {
    email: async () => { opened.push("email"); return email.session; },
    wallet: async () => { opened.push("wallet"); return wallet.session; },
  };
  return { open, opened, email, wallet };
}

test("router starts signed out", async () => {
  const { open, opened } = openers();
  const router = createSessionRouter(open, memoryStore());
  assert.equal(router.method, null);
  assert.equal(router.accountId, null);
  assert.equal(router.walletId, null);
  await assert.rejects(router.call(CHECKPOINT), /Sign in first\./);
  assert.deepEqual(opened, [], "nothing loads before the player picks a method");
});

test("router uses the chosen method and remembers it", async () => {
  const { open, opened, email } = openers();
  const store = memoryStore();
  const router = createSessionRouter(open, store);
  await router.use("email");
  assert.equal(router.method, "email");
  assert.equal(router.accountId, "abc123");
  assert.equal(router.walletId, "abc123-wallet");
  assert.equal(store.data.get(SIGN_IN_STORAGE_KEY), "email");
  assert.deepEqual(opened, ["email"]);
  assert.equal(await router.call(CHECKPOINT), "abc123:checkpoint");
  assert.equal(email.calls.length, 1);
});

test("router signOut forgets the previous session", async () => {
  const { open, email } = openers();
  const store = memoryStore();
  const router = createSessionRouter(open, store);
  await router.use("email");
  await router.signOut();
  assert.equal(router.method, null);
  assert.equal(router.accountId, null);
  assert.equal(router.walletId, null);
  assert.equal(store.data.has(SIGN_IN_STORAGE_KEY), false);
  assert.equal(email.log.signOuts, 1, "the old session signs out (and forgets its play key)");
  await assert.rejects(router.call(CHECKPOINT), /Sign in first\./);
  assert.equal(email.calls.length, 0, "the stale session can no longer sign");
});

test("router switching method signs the previous session out", async () => {
  const { open, email, wallet } = openers();
  const store = memoryStore();
  const router = createSessionRouter(open, store);
  await router.use("email");
  await router.use("wallet");
  assert.equal(email.log.signOuts, 1);
  assert.equal(router.method, "wallet");
  assert.equal(router.accountId, "alice.testnet");
  assert.equal(router.walletId, "alice.testnet-wallet");
  assert.equal(store.data.get(SIGN_IN_STORAGE_KEY), "wallet");
  await router.call(CHECKPOINT);
  assert.equal(email.calls.length, 0);
  assert.equal(wallet.calls.length, 1);
});

test("router restores the remembered method", async () => {
  const { open, opened, wallet } = openers(fakeSession("abc123"), fakeSession("alice.testnet", { restored: true }));
  const router = createSessionRouter(open, memoryStore({ [SIGN_IN_STORAGE_KEY]: "wallet" }));
  await router.restore();
  assert.deepEqual(opened, ["wallet"]);
  assert.equal(router.method, "wallet");
  assert.equal(router.accountId, "alice.testnet");
  assert.equal(wallet.log.signIns, 0, "restoring never opens a sign-in window");
});

test("router drops a remembered method whose session has ended", async () => {
  const store = memoryStore({ [SIGN_IN_STORAGE_KEY]: "wallet" });
  const { open, wallet } = openers();
  const router = createSessionRouter(open, store);
  await router.restore();
  assert.equal(router.method, null);
  assert.equal(router.accountId, null);
  assert.equal(wallet.log.signIns, 0);
  assert.equal(store.data.has(SIGN_IN_STORAGE_KEY), false);
});

test("router ignores an unknown remembered method", async () => {
  const { open, opened } = openers();
  const router = createSessionRouter(open, memoryStore({ [SIGN_IN_STORAGE_KEY]: "telepathy" }));
  await router.restore();
  assert.equal(router.method, null);
  assert.deepEqual(opened, []);
});

test("router does not install a sign-in that finished after signOut", async () => {
  let release: () => void = () => {};
  const late = fakeSession("abc123");
  const slow: WalletSession = { ...late.session, get accountId() { return late.session.accountId; }, signIn: () => new Promise<void>(resolve => { release = () => { void late.session.signIn().then(resolve); }; }) };
  const router = createSessionRouter({ email: async () => slow, wallet: async () => fakeSession("x").session }, memoryStore());
  const pending = router.use("email");
  await new Promise(resolve => setImmediate(resolve));
  await router.signOut();
  release();
  await assert.rejects(pending, /Sign-in was cancelled\./);
  assert.equal(router.accountId, null);
  await assert.rejects(router.call(CHECKPOINT), /Sign in first\./);
});

test("router forwards transactions from the current session only", async () => {
  const listeners = new Set<(hash: string, method: string) => void>();
  const email = fakeSession("abc123");
  const emailSession: WalletSession = { ...email.session, get accountId() { return email.session.accountId; }, onTransaction(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
  const router = createSessionRouter({ email: async () => emailSession, wallet: async () => fakeSession("alice.testnet").session }, memoryStore());
  const seen: string[] = [];
  router.onTransaction?.(hash => seen.push(hash));
  await router.use("email");
  for (const listener of listeners) listener("h1", "checkpoint");
  await router.use("wallet");
  for (const listener of listeners) listener("h2", "checkpoint");
  assert.deepEqual(seen, ["h1"]);
});

test("router reports the email opener's refusal", async () => {
  const router = createSessionRouter({
    email: async () => { throw new Error("Email sign-in is not set up yet."); },
    wallet: async () => fakeSession("alice.testnet").session,
  }, memoryStore());
  await assert.rejects(router.use("email"), /Email sign-in is not set up yet\./);
  assert.equal(router.method, null);
});

test("router asks the active session for a new play key when it has none", async () => {
  const wallet = fakeSession("alice.testnet", { restored: true });
  let needsPlayKey = true;
  const session: WalletSession = {
    ...wallet.session,
    get accountId() { return wallet.session.accountId; },
    get needsPlayKey() { return needsPlayKey; },
    async signIn() { wallet.log.signIns += 1; needsPlayKey = false; },
  };
  const router = createSessionRouter({ email: async () => fakeSession("x").session, wallet: async () => session }, memoryStore({ [SIGN_IN_STORAGE_KEY]: "wallet" }));
  await router.restore();
  assert.equal(router.needsPlayKey, true);
  await router.use("wallet");
  assert.equal(wallet.log.signIns, 1, "the wallet is asked to add a play key");
  assert.equal(wallet.log.signOuts, 0, "without signing the player out");
  assert.equal(router.needsPlayKey, false);
  await router.use("wallet");
  assert.equal(wallet.log.signIns, 1, "nothing to do once the key is there");
});

test("router signOut drops a sign-in still in progress", async () => {
  // Both sign-ins reach the same (cached) wallet session; releasing finishes every sign-in waiting on it.
  const waiting: (() => void)[] = [];
  const release = () => { for (const resolve of waiting.splice(0)) void late.session.signIn().then(resolve); };
  const late = fakeSession("alice.testnet");
  const slow: WalletSession = { ...late.session, get accountId() { return late.session.accountId; }, signIn: () => new Promise<void>(resolve => { waiting.push(resolve); }) };
  const router = createSessionRouter({ email: async () => fakeSession("x").session, wallet: async () => slow }, memoryStore());
  const first = router.use("wallet");
  await new Promise(resolve => setImmediate(resolve));
  await router.signOut();
  const second = router.use("wallet");
  assert.notEqual(second, first, "a new sign-in starts instead of joining the cancelled one");
  await new Promise(resolve => setImmediate(resolve));
  release();
  await assert.rejects(first, /Sign-in was cancelled\./);
  await second;
  assert.equal(router.accountId, "alice.testnet");
});
