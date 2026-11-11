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

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SignInPanel, EmailStep, CodeStep, SettingUpStep } = await import("../client/chain/SignInPanel.tsx");
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
