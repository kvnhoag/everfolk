import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { anotherDialogOpened } from "../client/chain/wallet-host.ts";
import { TUTORIAL_LAYER_CLASS } from "../client/models/tutorial-placement.ts";
import { TUTORIAL_STEPS } from "../client/models/tutorial-steps.ts";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: TutorialButton } = await import("../client/components/TutorialButton.tsx");
const { default: TutorialCard } = await import("../client/components/TutorialCard.tsx");
const { default: TutorialOverlay } = await import("../client/components/TutorialOverlay.tsx");

const noop = () => {};

test("the Tutorial button is a real button with an accessible label", () => {
  const html = renderToStaticMarkup(createElement(TutorialButton, {}));
  assert.match(html, /^<button[^>]*type="button"/);
  assert.match(html, /aria-label="Open the guided tutorial"/);
  assert.match(html, />Tutorial</);
  assert.match(renderToStaticMarkup(createElement(TutorialButton, { tone: "dark" })), /tutorial-button is-dark/);
});

test("the card is a labelled, non-modal dialog with step count, Back, Next, × and Close tutorial", () => {
  const step = TUTORIAL_STEPS[2];
  const html = renderToStaticMarkup(createElement(TutorialCard, { step, index: 2, total: TUTORIAL_STEPS.length, missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.match(html, /^<div[^>]*class="everfolk-tutorial-layer tutorial-card/);
  assert.match(html, /^<div[^>]*popover="manual"/, "A manual popover stays on top without making the game inert.");
  assert.match(html, /^<div[^>]*role="dialog"/);
  assert.match(html, /^<div[^>]*aria-modal="false"/);
  assert.match(html, /^<div[^>]*aria-labelledby="tutorial-card-title"/);
  assert.match(html, /^<div[^>]*aria-describedby="tutorial-card-body"/);
  assert.match(html, /<button[^>]*class="tutorial-card-dismiss"[^>]*aria-label="Close tutorial"/);
  assert.match(html, /id="tutorial-card-title"[^>]*>Weave Mode</);
  assert.match(html, new RegExp(`Step 3 of ${TUTORIAL_STEPS.length}`));
  assert.match(html, /<button[^>]*>Back<\/button>/);
  assert.match(html, /<button[^>]*>Next/);
  assert.match(html, /<button[^>]*>Close tutorial<\/button>/);
  assert.ok(html.includes(step.title));
});

test("Back is disabled on the first step, and the last step finishes with Close tutorial", () => {
  const first = renderToStaticMarkup(createElement(TutorialCard, { step: TUTORIAL_STEPS[0], index: 0, total: TUTORIAL_STEPS.length, missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.match(first, /<button[^>]*disabled=""[^>]*>Back<\/button>/);
  const lastIndex = TUTORIAL_STEPS.length - 1;
  const last = renderToStaticMarkup(createElement(TutorialCard, { step: TUTORIAL_STEPS[lastIndex], index: lastIndex, total: TUTORIAL_STEPS.length, missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.doesNotMatch(last, />Next/);
  assert.match(last, /tutorial-card-primary[^>]*>Close tutorial/);
});

test("a step whose feature is not on screen yet explains it instead", () => {
  const step = TUTORIAL_STEPS.find(item => item.id === "yearly-action")!;
  const html = renderToStaticMarkup(createElement(TutorialCard, { step, index: 12, total: TUTORIAL_STEPS.length, missing: true, onBack: noop, onNext: noop, onClose: noop }));
  assert.ok(html.includes(step.missingBody!.replace(/'/g, "&#x27;")));
});

test("the closed tour renders nothing that could block the page", () => {
  assert.equal(renderToStaticMarkup(createElement(TutorialOverlay, {})), "");
});

test("the Weave screen does not fight the tour for the top layer", () => {
  const layer = { open: true, classList: { contains: (name: string) => name === TUTORIAL_LAYER_CLASS } };
  const game = { open: true, classList: { contains: () => false } };
  assert.equal(anotherDialogOpened([{ target: layer }], {}), false);
  assert.equal(anotherDialogOpened([{ target: game }], {}), true);
});
