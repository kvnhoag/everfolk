import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  AUTO_MODE_CONFIRM_COPY,
  autoModeToggleAction,
  clearSkippedAutoConfirm,
  parseSkippedAutoConfirmLives,
  recordSkippedAutoConfirm,
  serializeSkippedAutoConfirmLives,
} from "../client/models/auto-mode-confirm.ts";
import { readSkippedAutoConfirmLives, writeSkippedAutoConfirmLives } from "../client/storage/auto-mode-confirm.ts";
import { gameModalShown, gameScreenShown, syncModal } from "../client/models/game-modal.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: AutoModeConfirmDialog } = await import("../client/components/AutoModeConfirmDialog.tsx");
hooks.deregister();

test("turning Auto mode on asks to confirm; turning it off never asks", () => {
  const empty = new Set<string>();
  assert.equal(autoModeToggleAction(false, true, "world:life-1", empty), "confirm");
  assert.equal(autoModeToggleAction(true, false, "world:life-1", empty), "off");
  assert.equal(autoModeToggleAction(false, false, "world:life-1", empty), "off");
});

test("Don't ask again in this life holds for that life, and a different life asks again", () => {
  const initial = new Set<string>();
  assert.equal(autoModeToggleAction(false, true, "world:life-1", initial), "confirm");

  // Canceling ("Keep choosing myself") does not suppress future prompts.
  const afterCancel = recordSkippedAutoConfirm(initial, "world:life-1", false);
  assert.equal(autoModeToggleAction(false, true, "world:life-1", afterCancel), "confirm");

  // Confirming with the checkbox checked skips future prompts in this life, even after turning off and on again.
  const skipped = recordSkippedAutoConfirm(initial, "world:life-1", true);
  assert.equal(autoModeToggleAction(true, false, "world:life-1", skipped), "off");
  assert.equal(autoModeToggleAction(false, true, "world:life-1", skipped), "on");

  // Another life still asks.
  assert.equal(autoModeToggleAction(false, true, "world:life-2", skipped), "confirm");

  // Restarting a life clears the skip flag if the same seed is reused.
  const cleared = clearSkippedAutoConfirm(skipped, "world:life-1");
  assert.equal(autoModeToggleAction(false, true, "world:life-1", cleared), "confirm");
});

test("skipped life keys round-trip through browser storage safely", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
  assert.deepEqual([...readSkippedAutoConfirmLives(storage)], []);
  writeSkippedAutoConfirmLives(new Set(["world:life-1", "world:life-2"]), storage);
  assert.deepEqual([...readSkippedAutoConfirmLives(storage)], ["world:life-1", "world:life-2"]);
  assert.deepEqual(parseSkippedAutoConfirmLives("not-json"), []);
  assert.deepEqual(parseSkippedAutoConfirmLives(serializeSkippedAutoConfirmLives(new Set(["a", "b"]))), ["a", "b"]);
});

test("AutoModeConfirmDialog renders the exact copy and nothing when closed", () => {
  const noop = () => {};
  assert.equal(renderToStaticMarkup(createElement(AutoModeConfirmDialog, { open: false, lifeKey: "w:1", onConfirm: noop, onCancel: noop })), "");

  const html = renderToStaticMarkup(createElement(AutoModeConfirmDialog, { open: true, lifeKey: "w:1", onConfirm: noop, onCancel: noop }));
  assert.match(html, /Let Auto mode choose\?/);
  assert.match(html, /Auto mode picks your turning points and yearly actions for you\. Your life may not turn out the way you intended\./);
  assert.match(html, />Turn on Auto mode<\/button>/);
  assert.match(html, />Keep choosing myself<\/button>/);
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /checked=""/, "Don't ask again starts unchecked");
  assert.ok(html.includes(AUTO_MODE_CONFIRM_COPY.remember.replace(/'/g, "&#x27;")));
});

test("AutoModeConfirmDialog focuses Keep choosing myself by default, submits checkbox state, and closes when hidden", () => {
  class FakeHTMLElement {
    isConnected = true;
    focus() { focused = this; }
  }
  const previousHTMLElement = (globalThis as { HTMLElement?: unknown }).HTMLElement;
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, writable: true, value: FakeHTMLElement });
  const dialog = {
    open: false,
    shows: 0,
    closes: 0,
    showModal() { this.open = true; this.shows += 1; },
    close() { this.open = false; this.closes += 1; },
    contains(target: unknown) { return target === keepChoosingButton; },
  };
  let focused: unknown = null;
  const triggerButton = new FakeHTMLElement();
  const keepChoosingButton = new FakeHTMLElement();

  const previousDocument = globalThis.document;
  const fakeDoc = {
    activeElement: triggerButton,
    body: { style: { overflow: "" } },
  };
  Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: fakeDoc });

  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousDispatcher = internals.H;

  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{ create: () => void | (() => void); deps: readonly unknown[] | undefined; cleanup?: () => void; pending: boolean }> = [];
  let gameScreenVisible = true;
  const confirmed: boolean[] = [];
  let cancelled = 0;

  function renderDialog(open: boolean) {
    let s = 0, r = 0, e = 0;
    internals.H = {
      useContext() { return gameScreenVisible; },
      useId() { return "auto-confirm-test"; },
      useState<S>(init: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
        const i = s++;
        if (!(i in states)) states[i] = typeof init === "function" ? (init as () => S)() : init;
        return [states[i] as S, next => {
          const prev = states[i] as S;
          states[i] = typeof next === "function" ? (next as (p: S) => S)(prev) : next;
        }];
      },
      useRef<R>(init: R) {
        const i = r++;
        if (!(i in refs)) refs[i] = { current: init };
        return refs[i] as { current: R };
      },
      useEffect(create: () => void | (() => void), deps?: readonly unknown[]) {
        const i = e++;
        const prev = effects[i];
        const changed = !prev || deps === undefined || prev.deps === undefined
          || deps.length !== prev.deps.length || deps.some((d, idx) => !Object.is(d, prev.deps![idx]));
        effects[i] = { create, deps, cleanup: prev?.cleanup, pending: changed };
      },
    };
    const element = createElement(AutoModeConfirmDialog, {
      open,
      lifeKey: "w:1",
      onConfirm: remember => confirmed.push(remember),
      onCancel: () => { cancelled += 1; },
    });
    // Render OpenAutoModeConfirmDialog directly when open so we can drive its hooks and refs.
    const inner = (element.type as (props: Record<string, unknown>) => React.ReactElement)(element.props as Record<string, unknown>);
    if (!inner) {
      for (const fx of effects) { fx.cleanup?.(); fx.cleanup = undefined; fx.pending = false; }
      effects.length = 0;
      states.length = 0;
      refs.length = 0;
      return null;
    }
    const tree = (inner.type as (props: Record<string, unknown>) => React.ReactElement)(inner.props as Record<string, unknown>);
    // Attach fake DOM refs before running effects.
    if (refs[0]) refs[0].current = dialog;
    if (refs[1]) refs[1].current = keepChoosingButton;
    for (const fx of effects) {
      if (!fx.pending) continue;
      fx.pending = false;
      fx.cleanup?.();
      const cleanup = fx.create();
      fx.cleanup = typeof cleanup === "function" ? cleanup : undefined;
    }
    return tree;
  }

  try {
    const tree = renderDialog(true)!;
    assert.equal(dialog.open, true, "opens modal when game screen is visible");
    assert.equal(focused, keepChoosingButton, "Keep choosing myself receives default focus");
    fakeDoc.activeElement = keepChoosingButton;

    // Hiding the game screen closes the modal via useGameModal without losing pending state.
    gameScreenVisible = false;
    renderDialog(true);
    assert.equal(dialog.open, false, "closes when game screen is hidden");
    assert.equal(focused, triggerButton, "focus returns to the trigger button");
    assert.equal(syncModal(dialog, gameModalShown(true, gameScreenShown({ homeOpen: true, coveredByScreen: false }))), false);

    // Returning to the game screen reopens the confirm dialog.
    gameScreenVisible = true;
    fakeDoc.activeElement = triggerButton;
    renderDialog(true);
    assert.equal(dialog.open, true, "reopens when returning to the game screen");
    assert.equal(focused, keepChoosingButton);

    // Toggle "Don't ask again in this life" and click "Turn on Auto mode".
    const children = (tree.props as { children: React.ReactElement[] }).children;
    const label = children[2];
    const checkbox = (label.props as { children: React.ReactElement[] }).children[0];
    (checkbox.props as { onChange: (e: { target: { checked: boolean } }) => void }).onChange({ target: { checked: true } });
    const reRendered = renderDialog(true)!;
    const actions = (reRendered.props as { children: React.ReactElement[] }).children[3];
    const confirmButton = (actions.props as { children: React.ReactElement[] }).children[1];
    (confirmButton.props as { onClick: () => void }).onClick();
    assert.deepEqual(confirmed, [true]);

    // Escape (onCancel) invokes onCancel without turning Auto mode on.
    let prevented = false;
    (reRendered.props as { onCancel: (e: { preventDefault(): void }) => void }).onCancel({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(cancelled, 1);
  } finally {
    for (const fx of effects) fx.cleanup?.();
    internals.H = previousDispatcher;
    if (previousHTMLElement === undefined) delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
    else Object.defineProperty(globalThis, "HTMLElement", { configurable: true, writable: true, value: previousHTMLElement });
    if (previousDocument === undefined) delete (globalThis as { document?: unknown }).document;
    else Object.defineProperty(globalThis, "document", { configurable: true, writable: true, value: previousDocument });
  }
});

test("App routes both time-bar Auto mode buttons and DecisionDialog Enable Auto mode through confirm", () => {
  const app = readFileSync(new URL("../client/screens/App.tsx", import.meta.url), "utf8");
  assert.match(app, /onClick=\{\(\) => requestAutoMode\(!game\.autoDecisions\)\}>Auto mode<\/button>/);
  assert.match(app, /requestAutoMode\(!game\.autoDecisions\); if \(playbackMenuRef\.current\) playbackMenuRef\.current\.open = false; \}\}>Auto mode/);
  assert.match(app, /onEnableAuto=\{\(\) => requestAutoMode\(true, true\)\}/);
  assert.match(app, /<AutoModeConfirmDialog open=\{autoConfirm !== null\} lifeKey=\{lifeId\}/);
});
