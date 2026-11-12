import assert from "node:assert/strict";
import test from "node:test";
import { resolveChainConfig } from "../client/chain/config.ts";
import { createWalletSession, PLAY_KEY_REMOVED, type WalletLibraries } from "../client/chain/near-connect-session.ts";
import { playKeyRequest } from "../client/chain/play-key.ts";
import type { ContractCall } from "../client/chain/types.ts";

/**
 * NEAR Connect and near-api-js are replaced by fakes: Node tests never import either library.
 * Real ones are exercised in the browser check.
 */

const cfg = resolveChainConfig({ contractId: "everfolk-lives-demo.testnet", rpcUrl: "https://rpc.invalid" }, {});
const SECRET = "ed25519:3D4YudUahN1nawWogh8pAKSj92sUNMdbZGjn7kERKzYoTy8tnFQuwoGUC51DowKqorvkr2pytJSnwuSbsNVfqygr";
const PUBLIC = "ed25519:8hSHprDq2StXwMtNd43wDTXQYsjXcD4MJTXQYsjXcc";
const OK = (hash: string) => ({ status: { SuccessValue: "" }, transaction: { hash } });
const CHECKPOINT: ContractCall = { method: "checkpoint", args: { life_id: "1" }, gas: "30000000000000", deposit: "0", access: "function-call-key" };
const BUY: ContractCall = { method: "buy", args: { token_id: "2" }, gas: "100000000000000", deposit: "25000000000000000000000", access: "wallet" };

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() { return data.size; },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

interface FakeOptions { restored?: boolean; playKeyError?: string; walletError?: string; noKeyWallets?: boolean }

function fakes(options: FakeOptions = {}) {
  const log = { connects: [] as unknown[], walletTx: [] as Record<string, unknown>[], playTx: [] as Record<string, unknown>[], disconnects: 0, signers: [] as string[] };
  const wallet = {
    manifest: { id: "meteor-wallet" },
    async getAccounts() { return [{ accountId: "alice.testnet" }]; },
    async signAndSendTransaction(params: Record<string, unknown>) {
      log.walletTx.push(params);
      if (options.walletError) throw new Error(options.walletError);
      return OK("wallet-hash");
    },
  };
  const handlers = new Map<string, () => void>();
  const connector = {
    whenManifestLoaded: Promise.resolve(),
    availableWallets: [{ manifest: { id: "meteor-wallet", features: { signInWithFunctionCallKey: !options.noKeyWallets, testnet: true } } }],
    on(event: string, handler: () => void) { handlers.set(event, handler); },
    async connect(input: unknown) { log.connects.push(input); return wallet; },
    async disconnect() { log.disconnects += 1; },
    async getConnectedWallet() {
      if (!options.restored) throw new Error("No wallet selected");
      return { wallet, accounts: [{ accountId: "alice.testnet" }] };
    },
  };
  class Account {
    readonly accountId: string;
    constructor(accountId: string) { this.accountId = accountId; }
    async signAndSendTransaction(params: Record<string, unknown>) {
      log.playTx.push({ signerId: this.accountId, ...params });
      if (options.playKeyError) throw new Error(options.playKeyError);
      return OK("play-hash");
    }
  }
  const near = {
    KeyPair: { fromRandom: () => ({ getPublicKey: () => ({ toString: () => PUBLIC }), toString: () => SECRET }) },
    KeyPairSigner: { fromSecretKey: (secret: string) => { log.signers.push(secret); return { secret }; } },
    JsonRpcProvider: class {},
    Account,
    actions: { functionCall: (method: string, args: unknown, gas: bigint, deposit: bigint) => ({ method, args, gas, deposit }) },
  };
  const load = async (): Promise<WalletLibraries> => ({ connector, near } as unknown as WalletLibraries);
  return { load, log, emit: (event: string) => handlers.get(event)?.() };
}

test("wallet sign-in asks for the play key and keeps its secret for this account", async () => {
  const { load, log } = fakes();
  const store = memoryStore();
  const session = await createWalletSession(cfg, { load, store });
  assert.equal(session.accountId, null);
  await session.signIn();
  assert.deepEqual(log.connects, [{ addFunctionCallKey: playKeyRequest(cfg, PUBLIC) }]);
  assert.equal(session.accountId, "alice.testnet");
  assert.equal(session.walletId, "meteor-wallet");
  assert.equal(store.data.get("everfolk:play-key:alice.testnet"), SECRET);
});

test("zero-deposit ranked calls sign with the play key and never open the wallet", async () => {
  const { load, log } = fakes({ restored: true });
  const store = memoryStore({ "everfolk:play-key:alice.testnet": SECRET });
  const session = await createWalletSession(cfg, { load, store });
  const seen: string[] = [];
  session.onTransaction?.((hash, method) => seen.push(`${method}:${hash}`));
  assert.equal(await session.call(CHECKPOINT), null);
  assert.equal(log.walletTx.length, 0, "no wallet popup");
  assert.equal(log.playTx.length, 1);
  assert.equal(log.playTx[0].receiverId, "everfolk-lives-demo.testnet");
  assert.equal(log.playTx[0].signerId, "alice.testnet");
  assert.deepEqual(log.signers, [SECRET]);
  assert.deepEqual(seen, ["checkpoint:play-hash"]);
});

test("calls with a deposit go through the wallet as a NEAR Connect FunctionCall", async () => {
  const { load, log } = fakes({ restored: true });
  const session = await createWalletSession(cfg, { load, store: memoryStore({ "everfolk:play-key:alice.testnet": SECRET }) });
  await session.call(BUY);
  assert.equal(log.playTx.length, 0);
  assert.deepEqual(log.walletTx, [{
    network: "testnet", signerId: "alice.testnet", receiverId: "everfolk-lives-demo.testnet",
    actions: [{ type: "FunctionCall", params: { methodName: "buy", args: { token_id: "2" }, gas: "100000000000000", deposit: "25000000000000000000000" } }],
  }]);
});

test("without a play key, ranked calls fall back to the wallet", async () => {
  const { load, log } = fakes({ restored: true });
  const session = await createWalletSession(cfg, { load, store: memoryStore() });
  await session.call(CHECKPOINT);
  assert.equal(log.playTx.length, 0);
  assert.equal(log.walletTx.length, 1);
});

test("a play key the chain refuses is forgotten and the wallet signs once", async () => {
  const { load, log } = fakes({ restored: true, playKeyError: `Access key ${PUBLIC} does not exist at block height 9` });
  const store = memoryStore({ "everfolk:play-key:alice.testnet": SECRET });
  const session = await createWalletSession(cfg, { load, store });
  await session.call(CHECKPOINT);
  assert.equal(store.data.has("everfolk:play-key:alice.testnet"), false);
  assert.equal(log.walletTx.length, 1);
  await session.call(CHECKPOINT);
  assert.equal(log.playTx.length, 1, "the forgotten key is not tried again");
  assert.equal(log.walletTx.length, 2);
});

test("a refused play key whose wallet fallback fails says so", async () => {
  const { load } = fakes({ restored: true, playKeyError: "Not enough allowance for access key x on account alice.testnet (allowance: 1, cost: 2)", walletError: "User rejected" });
  const session = await createWalletSession(cfg, { load, store: memoryStore({ "everfolk:play-key:alice.testnet": SECRET }) });
  await assert.rejects(session.call(CHECKPOINT), error => {
    assert.match((error as Error).message, /^checkpoint failed: /);
    assert.ok((error as Error).message.includes(PLAY_KEY_REMOVED));
    return true;
  });
});

test("play-key errors never carry the secret", async () => {
  const { load } = fakes({ restored: true, playKeyError: `could not sign with ${SECRET}` });
  const session = await createWalletSession(cfg, { load, store: memoryStore({ "everfolk:play-key:alice.testnet": SECRET }) });
  await assert.rejects(session.call(CHECKPOINT), error => {
    const message = (error as Error).message;
    assert.equal(message.includes(SECRET.slice("ed25519:".length)), false);
    assert.match(message, /\[redacted\]/);
    return true;
  });
});

test("sign-out forgets the play key, disconnects, and the session can no longer sign", async () => {
  const { load, log } = fakes({ restored: true });
  const store = memoryStore({ "everfolk:play-key:alice.testnet": SECRET, "everfolk:play-key:bob.testnet": SECRET });
  const session = await createWalletSession(cfg, { load, store });
  await session.signOut();
  assert.equal(session.accountId, null);
  assert.equal(store.data.has("everfolk:play-key:alice.testnet"), false);
  assert.equal(store.data.has("everfolk:play-key:bob.testnet"), true);
  assert.equal(log.disconnects, 1);
  await assert.rejects(session.call(CHECKPOINT), /Connect a NEAR wallet first\./);
  assert.equal(log.playTx.length + log.walletTx.length, 0);
});

test("a cancelled wallet picker reads as cancelled", async () => {
  const { load } = fakes();
  const loadRejecting = async () => {
    const libraries = await load();
    return { ...libraries, connector: { ...libraries.connector, connect: async () => { throw new Error("User rejected"); } } } as unknown as WalletLibraries;
  };
  const session = await createWalletSession(cfg, { load: loadRejecting, store: memoryStore() });
  await assert.rejects(session.signIn(), /Wallet connection was cancelled\./);
  assert.equal(session.accountId, null);
});

test("without wallets that can add a play key, sign-in explains instead of showing an empty picker", async () => {
  const { load } = fakes({ noKeyWallets: true });
  await assert.rejects(createWalletSession(cfg, { load, store: memoryStore() }), /Wallets could not be loaded\. Check your connection and try again\./);
});

test("a restored session without a play key asks the same wallet for a new one", async () => {
  const { load, log } = fakes({ restored: true });
  const store = memoryStore();
  const session = await createWalletSession(cfg, { load, store });
  assert.equal(session.accountId, "alice.testnet");
  assert.equal(session.needsPlayKey, true);
  await session.signIn();
  assert.deepEqual(log.connects, [{ walletId: "meteor-wallet", addFunctionCallKey: playKeyRequest(cfg, PUBLIC) }], "no picker: straight to the connected wallet");
  assert.equal(store.data.get("everfolk:play-key:alice.testnet"), SECRET);
  assert.equal(session.needsPlayKey, false);
  await session.call(CHECKPOINT);
  assert.equal(log.walletTx.length, 0);
});

test("after a refused key is forgotten, signing in again re-keys and play is popup-free again", async () => {
  const options: FakeOptions = { restored: true, playKeyError: `Access key ${PUBLIC} does not exist at block height 9` };
  const { load, log } = fakes(options);
  const store = memoryStore({ "everfolk:play-key:alice.testnet": SECRET });
  const session = await createWalletSession(cfg, { load, store });
  await session.call(CHECKPOINT);
  assert.equal(session.needsPlayKey, true);
  options.playKeyError = undefined;
  await session.signIn();
  assert.equal(log.connects.length, 1);
  assert.equal(session.needsPlayKey, false);
  await session.call(CHECKPOINT);
  assert.equal(log.walletTx.length, 1, "only the one fallback before re-keying");
});

test("with no wallet session left, stored play keys are forgotten", async () => {
  const { load } = fakes();
  const store = memoryStore({ "everfolk:play-key:alice.testnet": SECRET, "everfolk:sign-in": "wallet" });
  const session = await createWalletSession(cfg, { load, store });
  assert.equal(session.accountId, null);
  assert.equal(store.data.has("everfolk:play-key:alice.testnet"), false);
  assert.equal(store.data.get("everfolk:sign-in"), "wallet", "the router decides about the remembered method");
});

test("NEAR Connect signing out drops the session and its play key", async () => {
  const { load, emit } = fakes({ restored: true });
  const store = memoryStore({ "everfolk:play-key:alice.testnet": SECRET });
  const session = await createWalletSession(cfg, { load, store });
  emit("wallet:signOut");
  assert.equal(session.accountId, null);
  assert.equal(store.data.has("everfolk:play-key:alice.testnet"), false);
});

test("signing out while a fresh key settles stops the move without a wallet popup", async () => {
  const { load, log } = fakes({ playKeyError: `Access key ${PUBLIC} does not exist at block height 9` });
  const session = await createWalletSession(cfg, { load, store: memoryStore(), settleDelayMs: 20 });
  await session.signIn();
  const move = session.call(CHECKPOINT);
  await new Promise(resolve => setTimeout(resolve, 5));
  await session.signOut();
  await assert.rejects(move, /checkpoint failed: .*signed out/i);
  assert.equal(log.playTx.length, 1, "no retry after sign-out");
  assert.equal(log.walletTx.length, 0, "no wallet fallback after sign-out");
});
