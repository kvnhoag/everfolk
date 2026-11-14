import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import { cashCost, cashNote, type CashNoteChoice } from "../client/models/cash-note.ts";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) {
      return {
        format: "module",
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
          fileName: new URL(url).pathname,
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const { default: ChoiceImpact, CashNoteSuppressedContext } = await import("../client/components/ChoiceImpact.tsx");
const { default: LoanOfferDialog } = await import("../client/components/LoanOfferDialog.tsx");

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const weaveWorld = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-11.json", import.meta.url), "utf8")) as WorldPack;
const paid = { id: "lesson", text: "Lesson", outcomes: [{ id: "a", weight: 1, text: "", effects: [{ type: "stat", stat: "wealth", delta: -2 }] }] } as unknown as Choice;
const free = { id: "walk", text: "Walk", outcomes: [{ id: "a", weight: 1, text: "", effects: [] }] } as unknown as Choice;
const upfrontPaid: CashNoteChoice = {
  id: "small-order", category: "craft", available: false, reason: "Needs 20 dr in cash (you have 9).",
  outcomes: [{ id: "a", weight: 1, text: "", effects: [{ type: "cash", delta: -20 }, { type: "cash", delta: 50 }] }],
};
const life = (cash: number) => ({ economy: { cash, debt: 0, assets: {} } }) as unknown as LifeState;

test("an action's cash cost comes from its own sequential upfront deficit", () => {
  assert.equal(cashCost(paid, world), 20);
  assert.equal(cashCost(upfrontPaid, weaveWorld), 20);
  assert.equal(cashCost(free, world), 0);
});

test("every paid action shows the purse beside its cost, and says plainly when it cannot be afforded", () => {
  assert.deepEqual(cashNote(paid, life(80), world), { affordable: true, text: "You have 80 dr; 60 dr left after." });
  assert.deepEqual(cashNote(paid, life(10), world), { affordable: false, text: "Can't afford: costs 20 dr, you have 10 dr." });
  assert.equal(cashNote(free, life(10), world), null, "free actions say nothing about cash");
});

test("cash notes reflect current cash and vanish when the action is no longer relevant", () => {
  const base = createEngine(weaveWorld).start("cash-note-stale");
  const at28: LifeState = { ...base, age: 28, phase: "ready", economy: { ...base.economy!, cash: 9 } };

  assert.deepEqual(cashNote(upfrontPaid, at28, weaveWorld), { affordable: false, text: "Can't afford: costs 20 dr, you have 9 dr." });
  assert.deepEqual(cashNote(upfrontPaid, { ...at28, economy: { ...at28.economy!, cash: 15 } }, weaveWorld), { affordable: false, text: "Can't afford: costs 20 dr, you have 15 dr." });
  assert.deepEqual(cashNote({ ...upfrontPaid, available: true, reason: undefined }, { ...at28, economy: { ...at28.economy!, cash: 30 } }, weaveWorld), { affordable: true, text: "You have 30 dr; 10 dr left after." });

  // Stale background states hide the activity cash note:
  assert.equal(cashNote(upfrontPaid, { ...at28, phase: "choice" }, weaveWorld), null, "pending decision suppresses background activity purse notes");
  assert.equal(cashNote(upfrontPaid, { ...at28, phase: "ended" }, weaveWorld), null, "ended life hides purse notes");
  assert.equal(cashNote(upfrontPaid, { ...at28, character: { ...at28.character!, lastActivityAge: 28 } }, weaveWorld), null, "already acted this year");
  assert.equal(cashNote({ ...upfrontPaid, minAge: 30 }, at28, weaveWorld), null, "under minimum age");
  assert.equal(cashNote({ ...upfrontPaid, cooldownYears: 2 }, { ...at28, character: { ...at28.character!, lastActivityAges: { "small-order": 27 } } }, weaveWorld), null, "activity on cooldown");
  assert.equal(cashNote({ id: "visit-doctor", category: "health", available: true, outcomes: [{ id: "a", weight: 1, text: "", effects: [{ type: "cash", delta: -20 }, { type: "care" }] }] }, { ...at28, health: { ...at28.health!, lastCareAge: 28 } }, weaveWorld), null, "care already arranged this year");
  assert.equal(cashNote({ ...upfrontPaid, available: false, reason: "Requires Craft 20." }, at28, weaveWorld), null, "blocked for non-cash reason");

  // Pending event choice (not an activity) still reflects current cash inside its dialog:
  assert.deepEqual(cashNote(paid, { ...at28, phase: "choice" }, weaveWorld), { affordable: false, text: "Can't afford: costs 20 dr, you have 9 dr." });
});

test("ChoiceImpact updates cash text, suppresses covered background notes, and omits duplicate cash notes in LoanOfferDialog", () => {
  const base = createEngine(weaveWorld).start("cash-note-ui");
  const at28: LifeState = { ...base, age: 28, phase: "ready", economy: { ...base.economy!, cash: 9 } };
  const activityChoice = { ...paid, category: "craft", available: false, reason: "Needs 20 dr in cash (you have 9)." } as unknown as Choice;

  const shortHtml = renderToStaticMarkup(createElement(ChoiceImpact, { choice: activityChoice, life: at28, world: weaveWorld }));
  assert.match(shortHtml, /Can&#x27;t afford: costs 20 dr, you have 9 dr\.|Can't afford: costs 20 dr, you have 9 dr\./);

  const richerHtml = renderToStaticMarkup(createElement(ChoiceImpact, {
    choice: { ...activityChoice, available: true, reason: undefined } as unknown as Choice,
    life: { ...at28, economy: { ...at28.economy!, cash: 30 } },
    world: weaveWorld,
  }));
  assert.match(richerHtml, /You have 30 dr; 10 dr left after\./);
  assert.doesNotMatch(richerHtml, /Can(?:&#x27;|')t afford/);

  const coveredHtml = renderToStaticMarkup(createElement(
    CashNoteSuppressedContext,
    { value: true },
    createElement(ChoiceImpact, { choice: activityChoice, life: at28, world: weaveWorld }),
  ));
  assert.doesNotMatch(coveredHtml, /Can(?:&#x27;|')t afford/);

  const endedHtml = renderToStaticMarkup(createElement(ChoiceImpact, {
    choice: activityChoice,
    life: { ...at28, phase: "ended" },
    world: weaveWorld,
  }));
  assert.doesNotMatch(endedHtml, /Can(?:&#x27;|')t afford/);

  const loanHtml = renderToStaticMarkup(createElement(LoanOfferDialog, {
    request: { kind: "fund-activity", id: "lesson", snapshot: at28 },
    choice: paid,
    life: at28,
    world: weaveWorld,
    onCancel() {},
    onConfirm() {},
  }));
  assert.match(loanHtml, /Short of cash\?/);
  assert.doesNotMatch(loanHtml, /Can(?:&#x27;|')t afford/);
});
