import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { accountBarView } from "../client/chain/account-bar-model.ts";
import { parseSignInConfig } from "../client/chain/sign-in-config.ts";
import { anotherDialogOpened, SPEND_SHEET_CLASS } from "../client/chain/wallet-host.ts";
import { EMAIL_SIGN_IN_NOTE } from "../client/demo/labels.ts";
import { signInEntry } from "../client/chain/sign-in-entry.ts";
import { EMAIL_NOT_LOADED, WrongCodeError } from "../client/chain/sign-in-errors.ts";
import { emailOpener } from "../client/chain/chain-backend.ts";
import { resolveChainConfig } from "../client/chain/config.ts";
import { tokenPageView } from "../client/chain/token-page-model.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SignInPanel, EmailStep, CodeStep, SettingUpStep, stepAfterVerifyError } = await import("../client/chain/SignInPanel.tsx");
const { default: RankedEntry } = await import("../client/chain/RankedEntry.tsx");
const { default: MyLives } = await import("../client/chain/MyLives.tsx");
const { MarketBody } = await import("../client/chain/Market.tsx");
const { TokenPageBody } = await import("../client/chain/TokenPage.tsx");
const { default: EmailSignIn, emailButtonAction } = await import("../client/demo/EmailSignIn.tsx");
const { SpendSheet } = await import("../client/chain/ConfirmSpend.tsx");
hooks.deregister();

const CHAIN_WORDS = /gas|seed|wallet|crypto/i;
const noop = async () => {};
const flow = { sendCode: noop, verify: noop };

test("sign-in panel offers email first and no chain words on the email step", () => {
  const html = renderToStaticMarkup(createElement(SignInPanel, { available: { email: true }, onEmail: flow, onWallet: noop, onClose() {} }));
  const email = html.indexOf("Continue with email");
  const wallet = html.indexOf("Use a NEAR wallet");
  assert.ok(email >= 0 && wallet > email, "email comes before the wallet option");
  assert.match(html, /type="email"/);
  const steps = [
    renderToStaticMarkup(createElement(EmailStep, { busy: false, onSubmit() {} })),
    renderToStaticMarkup(createElement(CodeStep, { email: "ada@example.com", busy: false, onSubmit() {}, onBack() {} })),
    renderToStaticMarkup(createElement(SettingUpStep)),
  ];
  for (const step of steps) assert.doesNotMatch(step, CHAIN_WORDS);
  assert.match(steps[1], /ada@example\.com/);
  assert.match(steps[1], /autoComplete="one-time-code"|autocomplete="one-time-code"/);
  assert.match(steps[2], /Setting up your account…/);
});

test("email sign-in falls back to the note without a Privy App ID", () => {
  assert.deepEqual(parseSignInConfig({ privyAppId: null, funding: false, dripYocto: "1" }), { privyAppId: null });
  assert.deepEqual(parseSignInConfig({ privyAppId: "  " }), { privyAppId: null });
  assert.deepEqual(parseSignInConfig("nonsense"), { privyAppId: null });
  assert.deepEqual(parseSignInConfig({ privyAppId: "cm0abc123def456" }), { privyAppId: "cm0abc123def456" });
  assert.equal(emailButtonAction(false, () => {}), "note");
  assert.equal(emailButtonAction(true, undefined), "note");
  assert.equal(emailButtonAction(true, () => {}), "open");
  assert.match(EMAIL_SIGN_IN_NOTE, /not connected/i);
  const html = renderToStaticMarkup(createElement(SignInPanel, { available: { email: false }, onEmail: flow, onWallet: noop, onClose() {} }));
  assert.doesNotMatch(html, /Continue with email/);
  assert.match(html, /Sign in with email/);
  assert.match(html, /Use a NEAR wallet/);
  assert.match(renderToStaticMarkup(createElement(EmailSignIn, { available: true, onOpen() {} })), /Sign in with email/);
});

test("the spend sheet shows the action, its price and both choices", () => {
  const html = renderToStaticMarkup(createElement(SpendSheet, { text: { title: "Mint this life", price: "0.001 NEAR" }, onConfirm() {}, onCancel() {} }));
  assert.match(html, /Mint this life/);
  assert.match(html, /0\.001 NEAR/);
  assert.ok(html.indexOf("Cancel") >= 0 && html.indexOf("Confirm") >= 0);
  assert.doesNotMatch(html, /gas|seed|wallet/i);
});

test("the ranked screen does not lift itself above the spend sheet", () => {
  const self = { open: true };
  const sheet = { open: true, classList: { contains: (name: string) => name === SPEND_SHEET_CLASS } };
  const other = { open: true, classList: { contains: () => false } };
  assert.equal(anotherDialogOpened([{ target: sheet }], self), false);
  assert.equal(anotherDialogOpened([{ target: other }], self), true);
});

test("the account bar names an email player by email and hides chain details", () => {
  const view = accountBarView({ mode: "live", accountId: "ab".repeat(32), method: "email", email: "ada@example.com", balanceYocto: "100000000000000000000000", claimableYocto: "0" });
  if (view.status !== "connected") throw new Error("expected a connected view");
  assert.equal(view.label, "ada@example.com");
  assert.equal(view.account, "ab".repeat(32));
  assert.equal(view.balance, null, "email players see NEAR only on the spend sheet");
  assert.equal(view.wallet, null);
  const named = accountBarView({ mode: "live", accountId: "cherry.testnet", method: "wallet", walletId: "meteor-wallet", balanceYocto: "1000000000000000000000000" });
  if (named.status !== "connected") throw new Error("expected a connected view");
  assert.equal(named.label, "cherry.testnet");
  assert.equal(named.balance, "1 NEAR");
});

test("account bar, ranked entry and the email button never call the wallet directly for email", () => {
  const email = readFileSync(new URL("../client/demo/EmailSignIn.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(email, /backend\.connect|contract\./);
  const entry = readFileSync(new URL("../client/chain/RankedEntry.tsx", import.meta.url), "utf8");
  assert.match(entry, /SignInPanel/);
});

test("the spend queue asks one question at a time and never for free calls", async () => {
  const { createSpendQueue } = await import("../client/chain/spend-confirmation.ts");
  const queue = createSpendQueue();
  const free = { method: "checkpoint", args: {}, gas: "1", deposit: "0", access: "function-call-key" as const };
  const buy = { method: "buy", args: {}, gas: "1", deposit: "25000000000000000000000", access: "wallet" as const };
  const list = { ...buy, method: "list", deposit: "1" };
  assert.equal(await queue.request(free), true);
  assert.equal(queue.current(), null);
  const first = queue.request(buy);
  const second = queue.request(list);
  assert.deepEqual(queue.current()?.text, { title: "Buy", price: "0.025 NEAR" });
  queue.current()?.answer(false);
  assert.equal(await first, false);
  assert.deepEqual(queue.current()?.text, { title: "List for sale", price: "No NEAR spent" });
  queue.current()?.answer(true);
  assert.equal(await second, true);
  assert.equal(queue.current(), null);
});

function fakeBackend(signin: Record<string, unknown> | undefined, accountId: string | null = null) {
  const contract = { mintTerms: async () => ({ mint_fee: "1000000000000000000000", reroll_fee: "10000000000000000000000" }), activeLifeOf: async () => null, tokensOf: async () => [] };
  return {
    mode: "live", contract, accountId, walletId: null, worldVersion: "w", contractId: "c.testnet", lastTransaction: null, revision: 0,
    connect: noop, disconnect: noop, nearBalance: async () => null,
    signin: signin && { available: { email: true }, method: null, email: null, needsPlayKey: false, emailFlow: flow, useWallet: noop, ...signin },
  };
}
const EMAIL_PATH_WORDS = /gas|recovery phrase|Wallet approvals|Using Meteor/i;

test("the ranked screen offering email sign-in never mentions gas, wallet approvals or a recovery phrase", () => {
  const neutral = renderToStaticMarkup(createElement(RankedEntry, { backend: fakeBackend({}) as never }));
  assert.doesNotMatch(neutral, EMAIL_PATH_WORDS);
  assert.match(neutral, /Sign in to play/);
  const email = renderToStaticMarkup(createElement(RankedEntry, { backend: fakeBackend({ method: "email", email: "ada@example.com" }, "ab".repeat(32)) as never }));
  assert.doesNotMatch(email, EMAIL_PATH_WORDS);
  assert.match(email, /Playing as ada@example\.com/);
  const wallet = renderToStaticMarkup(createElement(RankedEntry, { backend: fakeBackend({ method: "wallet" }, "cherry.testnet") as never }));
  assert.match(wallet, /gas/);
  const legacy = renderToStaticMarkup(createElement(RankedEntry, { backend: fakeBackend(undefined) as never }));
  assert.match(legacy, /Using Meteor Wallet\?/);
  assert.match(legacy, /Connect a NEAR wallet/);
});

test("market, token page and my lives open the sign-in panel when sign-in is available", async () => {
  const calls: string[] = [];
  const handlers = { openPanel: () => calls.push("panel"), connectWallet: () => calls.push("wallet") };
  const withSignIn = signInEntry(fakeBackend({}).signin as never, { signIn: "Sign in to buy", wallet: "Connect a NEAR wallet to buy" }, handlers);
  assert.equal(withSignIn.label, "Sign in to buy");
  withSignIn.onConnect();
  const without = signInEntry(undefined, { signIn: "Sign in to buy", wallet: "Connect a NEAR wallet to buy" }, handlers);
  assert.equal(without.label, "Connect a NEAR wallet to buy");
  without.onConnect();
  assert.deepEqual(calls, ["panel", "wallet"]);

  const panel = createElement(SignInPanel, { available: { email: true }, onEmail: flow, onWallet: noop, onClose() {} });
  const market = renderToStaticMarkup(createElement(MarketBody, { rows: [], onBuy() {}, canConnect: true, connectLabel: "Sign in to buy", onConnect() {}, signInPanel: panel }));
  assert.match(market, /Sign in to buy/);
  assert.match(market, /Continue with email/);
  assert.doesNotMatch(market, /Connect a NEAR wallet to buy/);
  assert.match(renderToStaticMarkup(createElement(MarketBody, { rows: [], onBuy() {}, canConnect: true, onConnect() {} })), /Connect a NEAR wallet to buy/);

  const owned = { owner_id: "alice.testnet", extra: {
    kind: "npc" as const, figure_id: null, rarity: 1, affection: 70, action_id: "letters.teach", life_id: "4", birth_year: -350, death_year: -289,
    career_group: "letters" as const, sources: [{ token_id: "1", bps: 10_000 }], evidence_hash: "e".repeat(64),
  } };
  const view = tokenPageView({ tokenId: "5", token: owned, stats: { lives_influenced: 0, earned: "0" }, balance: "0", listing: null, children: [], sourceTokens: {}, viewer: null } as never);
  const tokenHandlers = { onSetAction() {}, onWithdraw() {}, onList() {}, onUnlist() {}, onBuy() {} };
  const token = renderToStaticMarkup(createElement(TokenPageBody, { tokenId: "5", view, ...tokenHandlers, canConnect: true, connectLabel: "Sign in to buy", onConnect() {}, signInPanel: panel }));
  assert.match(token, /Sign in to buy/);
  assert.match(token, /Continue with email/);
  assert.doesNotMatch(token, /Connect a NEAR wallet/);
  assert.match(renderToStaticMarkup(createElement(TokenPageBody, { tokenId: "5", view, ...tokenHandlers, canConnect: true, onConnect() {} })), /Connect a NEAR wallet/);

  const mine = renderToStaticMarkup(createElement(MyLives, { backend: fakeBackend({}) as never }));
  assert.match(mine, /Sign in to see the lives you keep/);
  assert.doesNotMatch(mine, /Connect a NEAR wallet|your wallet/);
  assert.match(renderToStaticMarkup(createElement(MyLives, { backend: fakeBackend(undefined) as never })), /Connect a NEAR wallet to see the lives you keep/);
});

test("a wrong code goes back to the code step; any other failure starts again from the email", () => {
  assert.deepEqual(stepAfterVerifyError(new WrongCodeError("That code didn't work."), "ada@example.com"), { kind: "code", email: "ada@example.com" });
  assert.deepEqual(stepAfterVerifyError(new Error("New accounts are paused right now — try again later."), "ada@example.com"), { kind: "email" });
});

test("the spend queue refuses a deposit it cannot read", async () => {
  const { createSpendQueue } = await import("../client/chain/spend-confirmation.ts");
  const queue = createSpendQueue();
  const base = { method: "buy", args: {}, gas: "1", access: "wallet" as const };
  assert.equal(await queue.request({ ...base, deposit: "abc" }), false);
  assert.equal(await queue.request({ ...base, deposit: "-1" }), false);
  assert.equal(await queue.request({ ...base, deposit: "" }), false);
  assert.equal(queue.current(), null);
});

test("a failed load of email sign-in reads as friendly text and can be retried", async () => {
  const cfg = resolveChainConfig({}, {});
  let attempts = 0;
  const opener = emailOpener(cfg, "app-id", () => { attempts += 1; return Promise.reject(new TypeError("Failed to fetch dynamically imported module")); });
  await assert.rejects(opener.open(), (error: Error) => error.message === EMAIL_NOT_LOADED);
  await assert.rejects(opener.open(), (error: Error) => error.message === EMAIL_NOT_LOADED);
  assert.equal(attempts, 2);
  await assert.rejects(emailOpener(cfg, null).open(), /not set up yet/);
});
