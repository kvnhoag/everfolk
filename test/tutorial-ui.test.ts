import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { anotherDialogOpened } from "../client/chain/wallet-host.ts";
import { TUTORIAL_LAYER_CLASS } from "../client/models/tutorial-placement.ts";
import { SECTION_HELP_HINTS, tutorialHint } from "../client/models/tutorial-hints.ts";
import { tutorialStore } from "../client/state/tutorial-store.ts";

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
const { default: SectionHelp } = await import("../client/components/SectionHelp.tsx");

const noop = () => {};
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

test("the Tutorial button is a real button with an accessible label", () => {
  const html = renderToStaticMarkup(createElement(TutorialButton, {}));
  assert.match(html, /^<button[^>]*type="button"/);
  assert.match(html, /aria-label="Open the tutorial for this screen"/);
  assert.match(html, /data-tutorial-button=""/, "the closing card can find it");
  assert.match(html, />Tutorial</);
  assert.match(renderToStaticMarkup(createElement(TutorialButton, { tone: "dark" })), /tutorial-button is-dark/);
});

test("a single tip is a labelled, non-modal dialog with Got it and ×, and no paging", () => {
  const hint = tutorialHint("time-bar")!;
  const html = renderToStaticMarkup(createElement(TutorialCard, { hint, index: 0, total: 1, mode: "auto", missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.match(html, new RegExp(`^<div[^>]*class="${TUTORIAL_LAYER_CLASS} tutorial-card`));
  assert.match(html, /^<div[^>]*popover="manual"/, "a manual popover stays on top without making the game inert");
  assert.match(html, /^<div[^>]*role="dialog"/);
  assert.match(html, /^<div[^>]*aria-modal="false"/);
  assert.match(html, /^<div[^>]*aria-labelledby="tutorial-card-title"/);
  assert.match(html, /^<div[^>]*aria-describedby="tutorial-card-body"/);
  assert.match(html, /^<div[^>]*data-hint="time-bar"/);
  assert.match(html, /is-auto/);
  assert.match(html, /<button[^>]*class="tutorial-card-dismiss"[^>]*aria-label="Close tutorial"/);
  assert.match(html, /id="tutorial-card-title"[^>]*>The time bar</);
  assert.match(html, /<button[^>]*tutorial-card-primary[^>]*>Got it<\/button>/);
  assert.doesNotMatch(html, /Next tip/);
  assert.doesNotMatch(html, />Back</);
  assert.doesNotMatch(html, /tutorial-dim/, "automatic tips do not dim the game");
});

test("queued tips show their count with Back and Next tip", () => {
  const hint = tutorialHint("rail")!;
  const html = renderToStaticMarkup(createElement(TutorialCard, { hint, index: 1, total: 3, mode: "manual", missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.match(html, /Tip 2 of 3/);
  assert.match(html, /<button[^>]*tutorial-card-back[^>]*>Back<\/button>/);
  assert.match(html, /<button[^>]*>Next tip/);
  assert.match(html, />Got it</);
  assert.match(html, /tutorial-dim/, "an opened tutorial dims the page around its section");
  const first = renderToStaticMarkup(createElement(TutorialCard, { hint, index: 0, total: 3, mode: "manual", missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.match(first, /<button[^>]*disabled=""[^>]*>Back<\/button>/);
  const last = renderToStaticMarkup(createElement(TutorialCard, { hint, index: 2, total: 3, mode: "manual", missing: false, onBack: noop, onNext: noop, onClose: noop }));
  assert.doesNotMatch(last, /Next tip/);
});

test("a hint whose section is not drawn yet explains itself instead", () => {
  const hint = tutorialHint("notifications")!;
  const html = renderToStaticMarkup(createElement(TutorialCard, { hint, index: 0, total: 1, mode: "manual", missing: true, onBack: noop, onNext: noop, onClose: noop }));
  assert.ok(html.includes(escape(hint.missingBody!)));
});

test("a ? button has an accessible label and a tooltip that describes it", () => {
  const html = renderToStaticMarkup(createElement(SectionHelp, { hint: "market" }));
  const hint = tutorialHint("market")!;
  assert.match(html, /^<span class="section-help"/);
  assert.match(html, new RegExp(`<button[^>]*type="button"[^>]*aria-label="About ${escape(hint.title)}"`));
  const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
  assert.ok(describedBy);
  assert.match(html, new RegExp(`<span[^>]*role="tooltip"[^>]*id="${describedBy}"[^>]*>${escape(hint.help!)}</span>`));
  assert.match(html, />\?</);
});

test("every ? button renders for its section", () => {
  for (const id of SECTION_HELP_HINTS) assert.match(renderToStaticMarkup(createElement(SectionHelp, { hint: id })), /role="tooltip"/, id);
});

test("clicking a ? opens the tutorial at that section's hint", () => {
  tutorialStore.setGameContext({ view: "game", characterSection: null, life: { age: 11, ended: false, decisionPending: false, learnedSkills: 0, focusShown: false, resourcesShown: true, wealthShown: true, deckShown: true, notificationShown: false, tradeAge: 10 } });
  tutorialStore.close();
  tutorialStore.openHint("wealth");
  assert.equal(tutorialStore.getSnapshot().hintId, "wealth");
  assert.equal(tutorialStore.getSnapshot().mode, "manual");
  tutorialStore.close();
  tutorialStore.setGameContext(null);
});

test("the closed tutorial renders nothing that could block the page", () => {
  assert.equal(renderToStaticMarkup(createElement(TutorialOverlay, {})), "");
});

test("the Weave screen does not fight the tutorial for the top layer", () => {
  const layer = { open: true, classList: { contains: (name: string) => name === TUTORIAL_LAYER_CLASS } };
  const gameDialog = { open: true, classList: { contains: () => false } };
  assert.equal(anotherDialogOpened([{ target: layer }], {}), false);
  assert.equal(anotherDialogOpened([{ target: gameDialog }], {}), true);
});
