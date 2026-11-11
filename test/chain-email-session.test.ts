import assert from "node:assert/strict";
import test from "node:test";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { actions, base64Decode, createTransaction, encodeTransaction, KeyPair, SignedTransaction } from "near-api-js";
import { resolveChainConfig } from "../client/chain/config.ts";
import { accountLabel, confirmText, createEmailSession, NOT_ENOUGH_NEAR, NOT_SET_UP, type EmailBridge } from "../client/chain/email-session.ts";
import { WrongCodeError } from "../client/chain/sign-in-errors.ts";
import { implicitAccountId, PrivyNearSigner } from "../client/chain/privy-signer.ts";
import type { ContractCall } from "../client/chain/types.ts";

/** Privy is replaced by a bridge that signs with a real ed25519 key; the RPC and the funding route by a fake fetch. */

const cfg = resolveChainConfig({ contractId: "everfolk-lives-demo.testnet", rpcUrl: "https://rpc.invalid" }, {});
const CHECKPOINT: ContractCall = { method: "checkpoint", args: { life_id: "1" }, gas: "30000000000000", deposit: "0", access: "function-call-key" };
const BUY: ContractCall = { method: "buy", args: { token_id: "2" }, gas: "100000000000000", deposit: "25000000000000000000000", access: "wallet" };
const BLOCK_HASH = "11111111111111111111111111111111";
const FAST = { pollDelayMs: 0, pollAttempts: 3 };

function keyBridge() {
  const keyPair = KeyPair.fromRandom("ed25519");
  const publicKeyHex = bytesToHex(keyPair.getPublicKey().data);
  const log = { codes: [] as string[], emails: [] as string[], hashes: 0, logouts: 0 };
  const bridge: EmailBridge = {
    async login(email) { log.emails.push(email); },
    async verify(code) { log.codes.push(code); return { publicKeyHex, accessToken: "token-1", email: "ada@example.com" }; },
    async signHash(hex0x) {
      log.hashes += 1;
      return `0x${bytesToHex(keyPair.sign(hexToBytes(hex0x.slice(2))).signature)}`;
    },
    async logout() { log.logouts += 1; },
  };
  return { bridge, keyPair, publicKeyHex, log };
}

interface ChainOptions { funded?: boolean; amount?: string; fundStatus?: number; fundBody?: unknown; fundsOnPost?: boolean; sendError?: unknown }

/** Answers `/api/signin/fund` and the NEAR RPC (`view_account`, `view_access_key`, `send_tx`). */
function fakeChain(options: ChainOptions = {}) {
  let funded = options.funded ?? false;
  const log = { fundPosts: [] as { auth: string | null; body: unknown }[], sent: [] as string[], rpc: [] as string[] };
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  const unknownAccount = { error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_ACCOUNT", info: {} }, data: "account does not exist while viewing" } };
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/signin/fund") {
      log.fundPosts.push({ auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });
      if (options.fundsOnPost !== false && (options.fundStatus ?? 200) === 200) funded = true;
      return reply(options.fundBody ?? { funded: true, hash: "drip" }, options.fundStatus ?? 200);
    }
    const body = JSON.parse(String(init?.body)) as { method: string; params: Record<string, string> };
    log.rpc.push(body.params.request_type ?? body.method);
    if (body.params.request_type === "view_account") return reply(funded ? { result: { amount: options.amount ?? "100000000000000000000000" } } : unknownAccount);
    if (body.params.request_type === "view_access_key") return reply(funded ? { result: { nonce: 5, block_hash: BLOCK_HASH, block_height: 1 } } : unknownAccount);
    if (body.method === "send_tx") {
      log.sent.push(body.params.signed_tx_base64);
      if (options.sendError) return reply({ error: options.sendError });
      return reply({ result: { status: { SuccessValue: "" }, transaction: { hash: `tx-${log.sent.length}` } } });
    }
    return reply({ error: { name: "UNEXPECTED" } }, 500);
  }) as typeof fetch;
  return { fetchFn, log };
}

async function signedIn(chain: ReturnType<typeof fakeChain>, confirm: (call: ContractCall) => Promise<boolean> = async () => true) {
  const key = keyBridge();
  const confirms: ContractCall[] = [];
  const session = createEmailSession(cfg, key.bridge, { fetch: chain.fetchFn, confirm: async call => { confirms.push(call); return confirm(call); }, ...FAST });
  await session.sendCode("ada@example.com");
  await session.verify("123456");
  return { session, key, confirms };
}

test("privy signer produces a signature near-api-js accepts", async () => {
  const { bridge, keyPair } = keyBridge();
  const signer = new PrivyNearSigner(keyPair.getPublicKey(), bridge.signHash);
  assert.equal((await signer.getPublicKey()).toString(), keyPair.getPublicKey().toString());
  const transaction = createTransaction("alice.testnet", keyPair.getPublicKey(), "bob.testnet", 1n, [actions.transfer(1n)], new Uint8Array(32));
  const { txHash, signedTransaction } = await signer.signTransaction(transaction);
  assert.equal(keyPair.verify(txHash, signedTransaction.signature.data), true);
  assert.deepEqual(txHash, sha256(encodeTransaction(transaction)));
});

test("privy signer refuses a signature of the wrong length", async () => {
  const { keyPair } = keyBridge();
  const signer = new PrivyNearSigner(keyPair.getPublicKey(), async () => "0xabcd");
  const transaction = createTransaction("alice.testnet", keyPair.getPublicKey(), "bob.testnet", 1n, [actions.transfer(1n)], new Uint8Array(32));
  await assert.rejects(signer.signTransaction(transaction), /signature/i);
});

test("implicit account id is the lowercase public key hex", () => {
  const hex = "AB".repeat(32);
  assert.equal(implicitAccountId(hex), "ab".repeat(32));
  assert.equal(implicitAccountId(`0x${hex}`), "ab".repeat(32));
  assert.throws(() => implicitAccountId("abc"), /account/i);
  assert.throws(() => implicitAccountId("zz".repeat(32)), /account/i);
});

test("email session funds once then signs silently", async () => {
  const chain = fakeChain();
  const { session, key, confirms } = await signedIn(chain);
  assert.equal(session.accountId, key.publicKeyHex);
  assert.equal(session.email, "ada@example.com");
  assert.equal(session.walletId, null);
  assert.equal(session.needsPlayKey, false);
  assert.deepEqual(key.log.emails, ["ada@example.com"]);
  assert.deepEqual(chain.log.fundPosts, [{ auth: "Bearer token-1", body: { accountId: key.publicKeyHex } }]);

  const hashes: string[] = [];
  session.onTransaction?.(hash => hashes.push(hash));
  assert.equal(await session.call(CHECKPOINT), null);
  assert.equal(confirms.length, 0, "a zero-deposit move never asks");
  assert.equal(key.log.hashes, 1);
  assert.deepEqual(hashes, ["tx-1"]);

  const signed = SignedTransaction.decode(base64Decode(chain.log.sent[0]));
  assert.equal(signed.transaction.signerId, key.publicKeyHex);
  assert.equal(signed.transaction.receiverId, cfg.contractId);
  assert.equal(signed.transaction.nonce, 6n);
  assert.equal(signed.transaction.actions[0].functionCall?.methodName, "checkpoint");
  // Borsh decoding yields the raw enum: `{ ed25519Signature: { data: number[] } }`.
  const signature = Uint8Array.from(signed.signature.ed25519Signature?.data ?? []);
  assert.equal(key.keyPair.verify(sha256(encodeTransaction(signed.transaction)), signature), true);

  await session.signOut();
  assert.equal(session.accountId, null);
  await session.verify("654321");
  assert.equal(chain.log.fundPosts.length, 1, "an account that already holds NEAR is not funded again");
});

test("deposit calls need confirmation", async () => {
  const chain = fakeChain();
  let answer = false;
  const { session, key, confirms } = await signedIn(chain, async () => answer);
  await assert.rejects(session.call(BUY), (error: Error) => error.message === "Cancelled.");
  assert.deepEqual(confirms, [BUY]);
  assert.equal(key.log.hashes, 0, "nothing is signed after a cancel");
  assert.equal(chain.log.sent.length, 0);
  answer = true;
  await session.call(BUY);
  assert.equal(key.log.hashes, 1);
  assert.equal(chain.log.sent.length, 1);
});

test("signing out while the sheet is open never signs the old call", async () => {
  const chain = fakeChain();
  let release: (value: boolean) => void = () => {};
  const { session, key } = await signedIn(chain, () => new Promise<boolean>(resolve => { release = resolve; }));
  const pending = session.call(BUY);
  await new Promise(resolve => setImmediate(resolve));
  await session.signOut();
  release(true);
  await assert.rejects(pending, /signed out/i);
  assert.equal(key.log.hashes, 0);
  assert.equal(key.log.logouts, 1);
  await assert.rejects(session.call(CHECKPOINT), /Sign in first/);
});

test("emailSession maps an unfunded-account error", async () => {
  const chain = fakeChain({ fundStatus: 502, fundBody: { funded: false, reason: "pending", error: "Your account is still being set up." }, fundsOnPost: false });
  const { session, key } = await signedIn(chain);
  assert.equal(session.accountId, key.publicKeyHex, "a pending drip still signs the player in");
  await assert.rejects(session.call(BUY), (error: Error) => error.message === NOT_SET_UP);
  assert.equal(NOT_SET_UP, "Your account is still being set up — try again in a moment.");
});

const NOT_ENOUGH_BALANCE = { name: "HANDLER_ERROR", cause: { name: "INVALID_TRANSACTION" }, data: { TxExecutionError: { InvalidTxError: { NotEnoughBalance: { balance: "0" } } } } };

test("emailSession maps a NotEnoughBalance rejection on an empty account to still being set up", async () => {
  const chain = fakeChain({ funded: true, amount: "0", fundBody: { funded: false, reason: "already-funded" }, fundsOnPost: false, sendError: NOT_ENOUGH_BALANCE });
  const { session } = await signedIn(chain);
  await assert.rejects(session.call(CHECKPOINT), (error: Error) => error.message === NOT_SET_UP);
});

test("a player who spent the drip is told they lack NEAR, not that setup is pending", async () => {
  const chain = fakeChain({ funded: true, amount: "1000", sendError: NOT_ENOUGH_BALANCE });
  const { session } = await signedIn(chain);
  assert.equal(chain.log.fundPosts.length, 0);
  await assert.rejects(session.call(BUY), (error: Error) => error.message === NOT_ENOUGH_NEAR);
  assert.equal(NOT_ENOUGH_NEAR, "You don't have enough NEAR for this.");
});

test("a deposit that is not a number is refused without signing", async () => {
  const chain = fakeChain({ funded: true });
  const { session, key, confirms } = await signedIn(chain, async () => false);
  await assert.rejects(session.call({ ...BUY, deposit: "abc" }), (error: Error) => error.message === "Cancelled.");
  assert.equal(confirms.length, 1);
  assert.equal(key.log.hashes, 0);
});

test("funding refusals read as friendly text and leave the player signed out", async () => {
  for (const status of [503, 429]) {
    const chain = fakeChain({ fundStatus: status, fundBody: { error: "Funding is paused." } });
    const key = keyBridge();
    const session = createEmailSession(cfg, key.bridge, { fetch: chain.fetchFn, confirm: async () => true, ...FAST });
    await session.sendCode("ada@example.com");
    await assert.rejects(session.verify("123456"), (error: Error) => error.message === "New accounts are paused right now — try again later.");
    assert.equal(session.accountId, null);
    assert.equal(key.log.logouts, 1);
  }
});

test("an account that already holds NEAR is treated as funded", async () => {
  const chain = fakeChain({ fundStatus: 409, fundBody: { error: "This account is already set up." } });
  const key = keyBridge();
  const session = createEmailSession(cfg, key.bridge, { fetch: chain.fetchFn, confirm: async () => true, ...FAST });
  await session.sendCode("ada@example.com");
  await session.verify("123456");
  assert.equal(session.accountId, key.publicKeyHex);
});

test("a wrong code and a bad address read as friendly text", async () => {
  const chain = fakeChain();
  const key = keyBridge();
  const bridge: EmailBridge = { ...key.bridge, async verify() { throw new Error("Invalid code"); }, async login() { throw new Error("400 invalid_data"); } };
  const session = createEmailSession(cfg, bridge, { fetch: chain.fetchFn, confirm: async () => true, ...FAST });
  await assert.rejects(session.sendCode("ada@example.com"), /couldn't send a code/i);
  await assert.rejects(session.verify("000000"), (error: Error) => error instanceof WrongCodeError && /code didn't work/i.test(error.message));
  assert.equal(chain.log.fundPosts.length, 0);
});

test("account label shows the email for email players", () => {
  const implicit = "ab".repeat(32);
  assert.equal(accountLabel(implicit, "email", "ada@example.com"), "ada@example.com");
  assert.equal(accountLabel("cherry.testnet", "wallet", null), "cherry.testnet");
});

test("account label falls back to Your Everfolk account", () => {
  assert.equal(accountLabel("ab".repeat(32), "email", null), "Your Everfolk account");
});

test("confirm text names the NFT action and its price", () => {
  assert.deepEqual(confirmText({ ...BUY, method: "open_mint_pack", deposit: "1000000000000000000000" }), { title: "Mint this life", price: "0.001 NEAR" });
  assert.deepEqual(confirmText(BUY), { title: "Buy", price: "0.025 NEAR" });
  assert.equal(confirmText(CHECKPOINT), null);
  assert.deepEqual(confirmText({ ...BUY, method: "list", args: { token_id: "2", price: "25000000000000000000000" }, deposit: "1" }), { title: "List for sale", price: "Asking price 0.025 NEAR", note: "Listing is free; the buyer pays this price." });
  assert.deepEqual(confirmText({ ...BUY, method: "list", args: { token_id: "2" }, deposit: "1" }), { title: "List for sale", price: "No NEAR spent", note: "Listing is free; the buyer pays this price." });
});

test("a remembered player is restored without a code, and a new code replaces them", async () => {
  const chain = fakeChain({ funded: true });
  const key = keyBridge();
  const bridge: EmailBridge = { ...key.bridge, async restore() { return { publicKeyHex: key.publicKeyHex, accessToken: "token-1", email: "ada@example.com" }; } };
  const session = createEmailSession(cfg, bridge, { fetch: chain.fetchFn, confirm: async () => true, ...FAST });
  await session.restore();
  assert.equal(session.accountId, key.publicKeyHex);
  assert.equal(chain.log.fundPosts.length, 0, "a funded account is not funded again");
  await session.sendCode("grace@example.com");
  assert.equal(session.accountId, null, "a new sign-in drops the remembered player");
});

test("a remembered player that Privy has forgotten stays signed out", async () => {
  const chain = fakeChain({ funded: true });
  const key = keyBridge();
  const session = createEmailSession(cfg, { ...key.bridge, async restore() { return null; } }, { fetch: chain.fetchFn, confirm: async () => true, ...FAST });
  await session.restore();
  assert.equal(session.accountId, null);
  await assert.rejects(session.signIn(), /code from your email/);
});


test("email calls hide technical failures and retain meaningful game errors", async () => {
  for (const [raw, expected] of [
    ["Exceeded prepaid gas while calling buy", "That didn't go through — try again."],
    ["Smart contract panicked: This token is not for sale", "This token is not for sale"],
  ]) {
    const { session } = await signedIn(fakeChain({ funded: true, sendError: { message: raw } }));
    await assert.rejects(session.call(BUY), { message: expected });
  }
});

test("signing out cancels every pending spend request before anything is signed", async () => {
  const { createSpendQueue } = await import("../client/chain/spend-confirmation.ts");
  const queue = createSpendQueue();
  const key = keyBridge();
  const chain = fakeChain({ funded: true });
  const session = createEmailSession(cfg, key.bridge, { fetch: chain.fetchFn, confirm: queue.request, cancelConfirmations: queue.cancelAll, ...FAST });
  await session.verify("123456");
  const pending = [session.call(BUY), session.call(BUY)];
  const checks = pending.map(call => assert.rejects(call, /Cancelled/));
  assert.ok(queue.current());
  await session.signOut();
  await Promise.all(checks);
  assert.equal(queue.current(), null);
  assert.equal(key.log.hashes, 0);
  assert.equal(chain.log.sent.length, 0);
});
