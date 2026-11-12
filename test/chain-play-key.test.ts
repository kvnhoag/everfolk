import assert from "node:assert/strict";
import test from "node:test";
import { resolveChainConfig } from "../client/chain/config.ts";
import { ACCESS_KEY_METHODS } from "../client/chain/contract.ts";
import { forgetAllPlayKeys, forgetPlayKey, isPlayKeyRejected, loadPlayKey, playKeyRequest, savePlayKey, usesPlayKey } from "../client/chain/play-key.ts";
import type { ContractCall } from "../client/chain/types.ts";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    data,
    get length() { return data.size; },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

const call = (method: string, deposit: string, access: ContractCall["access"] = deposit === "0" ? "function-call-key" : "wallet"): ContractCall =>
  ({ method, args: {}, gas: "30000000000000", deposit, access });

const SECRET_A = "ed25519:3D4YudUahN1nawWogh8pAKSj92sUNMdbZGjn7kERKzYoTy8tnFQuwoGUC51DowKqorvkr2pytJSnwuSbsNVfqygr";
const SECRET_B = "ed25519:4F4YudUahN1nawWogh8pAKSj92sUNMdbZGjn7kERKzYoTy8tnFQuwoGUC51DowKqorvkr2pytJSnwuSbsNVfqygr";

test("play key only covers zero-deposit ranked methods", () => {
  assert.equal(usesPlayKey(call("start_life", "0")), true);
  assert.equal(usesPlayKey(call("checkpoint", "0")), true);
  assert.equal(usesPlayKey(call("list", "1")), false);
  assert.equal(usesPlayKey(call("buy", "25000000000000000000000")), false);
  assert.equal(usesPlayKey(call("buy", "0", "function-call-key")), false, "never outside the ranked methods");
  assert.equal(usesPlayKey(call("start_life", "1", "function-call-key")), false, "never with a deposit");
  assert.equal(usesPlayKey(call("draw_npc", "0", "wallet")), false, "only when the call asks for the key");
});

test("play key request names exactly the ranked methods", () => {
  const cfg = resolveChainConfig({ contractId: "everfolk-lives-demo.testnet" }, {});
  const publicKey = "ed25519:8hSHprDq2StXwMtNd43wDTXQYsjXcD4MJTXQYsjXcc";
  const request = playKeyRequest(cfg, publicKey);
  assert.equal(request.contractId, "everfolk-lives-demo.testnet");
  assert.equal(request.publicKey, publicKey);
  assert.equal(request.allowMethods.anyMethod, false);
  assert.deepEqual(request.allowMethods.methodNames, [...ACCESS_KEY_METHODS]);
  assert.deepEqual(request.gasAllowance, { kind: "limited", amount: "1000000000000000000000000" }, "1 NEAR lifetime gas allowance");
});

test("play keys are stored per account and forgotten on sign-out", () => {
  const store = memoryStore();
  assert.equal(loadPlayKey(store, "alice.testnet"), null);
  savePlayKey(store, "alice.testnet", SECRET_A);
  savePlayKey(store, "bob.testnet", SECRET_B);
  assert.equal(store.data.get("everfolk:play-key:alice.testnet"), SECRET_A);
  assert.equal(loadPlayKey(store, "alice.testnet"), SECRET_A);
  assert.equal(loadPlayKey(store, "bob.testnet"), SECRET_B);
  forgetPlayKey(store, "alice.testnet");
  assert.equal(loadPlayKey(store, "alice.testnet"), null);
  assert.equal(loadPlayKey(store, "bob.testnet"), SECRET_B, "another account's key is untouched");
});

test("a malformed stored play key is ignored", () => {
  const store = memoryStore();
  store.setItem("everfolk:play-key:alice.testnet", "not-a-key");
  assert.equal(loadPlayKey(store, "alice.testnet"), null);
  assert.throws(() => savePlayKey(store, "alice.testnet", "not-a-key"), /play key/i);
});

test("a missing or exhausted play key is recognised, contract panics are not", () => {
  assert.equal(isPlayKeyRejected(new Error("Access key ed25519:abc does not exist at block height 12")), true);
  assert.equal(isPlayKeyRejected(new Error("Access key ed25519:abc does not exist on account alice.testnet")), true);
  assert.equal(isPlayKeyRejected(new Error("Not enough allowance for access key ed25519:abc on account alice.testnet (allowance: 1, cost: 2)")), true);
  assert.equal(isPlayKeyRejected(new Error("Access key does not allow method draw_npc")), true);
  assert.equal(isPlayKeyRejected(new Error("Smart contract panicked: life already active")), false);
  assert.equal(isPlayKeyRejected(new Error("Failed to fetch")), false);
  assert.equal(isPlayKeyRejected("Access key ed25519:abc does not exist at block height 12"), true);
});

test("all play keys can be forgotten at once, leaving other storage alone", () => {
  const store = memoryStore();
  savePlayKey(store, "alice.testnet", SECRET_A);
  savePlayKey(store, "bob.testnet", SECRET_B);
  store.setItem("everfolk:sign-in", "wallet");
  forgetAllPlayKeys(store);
  assert.deepEqual(Array.from(store.data.keys()), ["everfolk:sign-in"]);
  assert.doesNotThrow(() => forgetAllPlayKeys({ getItem: () => null, setItem: () => {}, removeItem: () => {} }), "a store without enumeration is left as is");
});
