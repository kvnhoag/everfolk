import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeState } from "../src/types.ts";
import { getLoanSummary, loanDeadlineWarning } from "../client/loan-summary.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

const engine = createEngine(pack);
function borrower(age = 20): LifeState {
  const life = structuredClone(engine.start("loan-deadline"));
  life.age = age;
  life.year = engine.world.startYear + age;
  life.phase = "ready";
  life.pendingEventId = null;
  life.economy!.cash = 47;
  life.economy!.debt = 160;
  life.economy!.loan = { balance: 120, borrowedAge: 18, dueAge: 21, extensions: 0 };
  return life;
}

test("deadline warning begins one year before repayment and quotes the outstanding contract", () => {
  const life = borrower(19);
  assert.equal(loanDeadlineWarning(engine.world, life), undefined);
  assert.equal(getLoanSummary(engine.world, life)!.dueSoon, false);
  life.age = 20;
  const before = structuredClone(life);
  const warning = loanDeadlineWarning(engine.world, life)!;
  assert.equal(warning.title, "Your loan is due next year");
  assert.equal(warning.urgency, "soon");
  assert.equal(warning.balance, 120, "ordinary debt is not quoted as the lender balance");
  assert.equal(warning.cash, 47);
  assert.equal(warning.dueYear, "329 BCE");
  assert.equal(warning.dueAge, 21);
  assert.equal(getLoanSummary(engine.world, life)!.dueSoon, true);
  assert.deepEqual(life, before, "reading a reminder cannot pay, advance or draw randomness");
});

test("each annual deadline stage has a distinct identity and honest urgency", () => {
  const life = borrower(20);
  const near = loanDeadlineWarning(engine.world, life)!;
  life.age = 21;
  const due = loanDeadlineWarning(engine.world, life)!;
  assert.notEqual(due.key, near.key);
  assert.equal(due.urgency, "due");
  assert.equal(due.title, "Your loan is due this year");
  assert.equal(getLoanSummary(engine.world, life)!.due, true);
  life.age = 22;
  const late = loanDeadlineWarning(engine.world, life)!;
  assert.notEqual(late.key, due.key);
  assert.equal(late.urgency, "overdue");
  assert.equal(late.threatened, true);
  assert.equal(late.dangerous, false);
  assert.equal(getLoanSummary(engine.world, life)!.dueSoon, false);
  life.age = 24;
  assert.equal(loanDeadlineWarning(engine.world, life)!.dangerous, true);
});

test("extension moves the warning to the actual new deadline and resets its identity", () => {
  const life = borrower(21);
  const original = loanDeadlineWarning(engine.world, life)!;
  life.economy!.loan!.dueAge = 23;
  life.economy!.loan!.balance = 140;
  life.economy!.loan!.extensions = 1;
  assert.equal(loanDeadlineWarning(engine.world, life), undefined);
  life.age = 22;
  const revised = loanDeadlineWarning(engine.world, life)!;
  assert.notEqual(revised.key, original.key);
  assert.equal(revised.dueYear, "327 BCE");
  assert.equal(revised.balance, 140);
  assert.equal(revised.threatened, false);
  const key = revised.key;
  life.economy!.loan!.balance = 100;
  assert.equal(loanDeadlineWarning(engine.world, life)!.key, key, "instalments do not repeat the same year's reminder");
});

test("settlement, death and worlds without lending never produce a deadline popup", () => {
  const life = borrower();
  life.phase = "ended";
  assert.equal(loanDeadlineWarning(engine.world, life), undefined);
  assert.equal(getLoanSummary(engine.world, life)!.dueSoon, false);
  assert.equal(getLoanSummary(engine.world, life)!.due, false);
  life.phase = "ready";
  delete life.economy!.loan;
  assert.equal(loanDeadlineWarning(engine.world, life), undefined);
  life.economy!.loan = { balance: 0, borrowedAge: 18, dueAge: 21, extensions: 0 };
  assert.equal(loanDeadlineWarning(engine.world, life), undefined);
  const world = structuredClone(engine.world);
  delete world.economy!.moneylender;
  assert.equal(loanDeadlineWarning(world, borrower()), undefined);
});

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: LoanDeadlineDialog } = await import("../client/LoanDeadlineDialog.tsx");
const { MoneylenderNotice } = await import("../client/MoneylenderPanel.tsx");
hooks.deregister();

test("the real reminder dialog and persistent notice expose the due year and manual repayment", () => {
  const life = borrower(), before = structuredClone(life);
  let dismissed = 0, managed = 0;
  const props = { life, world: engine.world, open: true, onDismiss() { dismissed++; }, onManage() { managed++; } };
  const html = renderToStaticMarkup(createElement(LoanDeadlineDialog, props));
  assert.match(html, /Your loan is due next year/);
  assert.match(html, /aria-labelledby=/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /manual repayment/);
  assert.match(html, /120 dr/);
  assert.match(html, /47 dr/);
  assert.match(html, /329 BCE/);
  assert.match(html, /Manage loan/);
  assert.match(html, /Got it/);
  assert.equal(renderToStaticMarkup(createElement(LoanDeadlineDialog, { ...props, open: false })), "");
  const notice = renderToStaticMarkup(createElement(MoneylenderNotice, { life, world: engine.world, onManage() {} }));
  assert.match(notice, /role="status"/);
  assert.match(notice, /Repayment next year/);
  assert.match(notice, /Deadline 329 BCE/);
  assert.equal(dismissed, 0);
  assert.equal(managed, 0);
  assert.deepEqual(life, before);
});
