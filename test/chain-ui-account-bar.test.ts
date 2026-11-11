import assert from "node:assert/strict";
import test from "node:test";
import { accountBarView, explorerUrl, walletLabel } from "../client/chain/account-bar-model.ts";

const NEAR = 10n ** 24n;

test("practice mode says nothing is recorded", () => {
  const view = accountBarView({ mode: "preview", accountId: "you.testnet" });
  assert.equal(view.status, "practice");
  assert.match(view.note, /not recorded/i);
});

test("a live ledger without a wallet offers to connect on testnet", () => {
  const view = accountBarView({ mode: "live", accountId: null });
  assert.equal(view.status, "disconnected");
  assert.equal(view.network, "Testnet");
  assert.equal(view.account, null);
});

test("a connected account shows its name, wallet, balance, earnings and explorer link", () => {
  const view = accountBarView({
    mode: "live", accountId: "cherry.testnet", walletId: "meteor-wallet",
    balanceYocto: (9n * NEAR + NEAR / 2n).toString(), claimableYocto: (3n * NEAR / 10n).toString(),
  });
  if (view.status !== "connected") throw new Error("expected a connected view");
  assert.equal(view.account, "cherry.testnet");
  assert.equal(view.wallet, "Meteor Wallet");
  assert.equal(view.balance, "9.5 NEAR");
  assert.equal(view.claimable, "0.3 NEAR");
  assert.equal(view.accountUrl, "https://testnet.nearblocks.io/address/cherry.testnet");
});

test("nothing to collect hides the claim, and unknown balances read as loading", () => {
  const view = accountBarView({ mode: "live", accountId: "a.testnet", claimableYocto: "0" });
  if (view.status !== "connected") throw new Error("expected a connected view");
  assert.equal(view.claimable, null);
  assert.equal(view.balance, "…");
});

test("explorer links for accounts and transactions", () => {
  assert.equal(explorerUrl({ account: "lives.testnet" }), "https://testnet.nearblocks.io/address/lives.testnet");
  assert.equal(explorerUrl({ tx: "8Hx1" }), "https://testnet.nearblocks.io/txns/8Hx1");
});

test("wallet ids read as product names", () => {
  assert.equal(walletLabel("my-near-wallet"), "MyNearWallet");
  assert.equal(walletLabel("meteor-wallet"), "Meteor Wallet");
  assert.equal(walletLabel("something-else"), "something-else");
  assert.equal(walletLabel(undefined), null);
});

test("account balance comes from the RPC's view_account", async () => {
  const { accountBalance } = await import("../client/chain/rpc.ts");
  const calls: unknown[] = [];
  const fetchFn = async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ result: { amount: "9500000000000000000000000", locked: "0" } }));
  };
  assert.equal(await accountBalance(fetchFn, "https://rpc.test", "cherry.testnet"), "9500000000000000000000000");
  assert.deepEqual((calls[0] as { params: unknown }).params, { request_type: "view_account", finality: "final", account_id: "cherry.testnet" });
});

test("an account that does not exist yet has no balance", async () => {
  const { accountBalance } = await import("../client/chain/rpc.ts");
  const fetchFn = async () => new Response(JSON.stringify({ error: { cause: { name: "UNKNOWN_ACCOUNT" } } }));
  assert.equal(await accountBalance(fetchFn, "https://rpc.test", "nobody.testnet"), null);
});
