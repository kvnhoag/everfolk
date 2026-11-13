import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createRoyaltyTestSession } from "../client/models/royalty-test.ts";
import { engineForLife, sampleEngine, SAVE_KEY, PRESENTATION_KEY } from "../client/lib/world-session.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: App } = await import("../client/screens/App.tsx");
hooks.deregister();

test("adult class previews render the ordinary game interface without reading personal storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const selectedEngine = sampleEngine, saveKey = SAVE_KEY, presentationKey = PRESENTATION_KEY;
  let storageAccesses = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { storageAccesses++; throw new Error("Personal storage must not be used by a test life."); },
    get sessionStorage() { storageAccesses++; throw new Error("Session storage must not be used by a test life."); },
    matchMedia: () => ({ matches: false }),
  } });
  try {
    for (const preset of ["comfortable", "aristocrat-comfortable"]) {
      const session = createRoyaltyTestSession(preset);
      const before = JSON.stringify(session.life);
      const html = renderToStaticMarkup(createElement(App, { enterGame: true, previewSession: session }));
      assert.match(html, /<div class="everfolk-game">/);
      assert.match(html, /class="site-header"/);
      assert.match(html, /class="page-shell game-dashboard"/);
      assert.match(html, /aria-label="Your life now"/);
      assert.match(html, /role="timer" aria-live="off">Paused</);
      assert.match(html, /Test session/);
      assert.match(html, preset === "comfortable" ? /Royal council/ : /Estate council/);
      assert.doesNotMatch(html, /class="main-menu storybook-menu"/);
      assert.doesNotMatch(html, /class="birth-record birth-intro-record"/);
      assert.equal(engineForLife(session.life), session.engine);
      assert.equal(JSON.stringify(session.life), before);
    }
    assert.equal(storageAccesses, 0);
    assert.equal(sampleEngine, selectedEngine);
    assert.equal(SAVE_KEY, saveKey);
    assert.equal(PRESENTATION_KEY, presentationKey);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("newborn class previews enter the actual birth reveal without managing the council or accessing personal storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const selectedEngine = sampleEngine, saveKey = SAVE_KEY, presentationKey = PRESENTATION_KEY;
  let storageAccesses = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { storageAccesses++; throw new Error("A test birth must not read or write a personal save."); },
    get sessionStorage() { storageAccesses++; throw new Error("A test birth must not use personal presentation markers."); },
    matchMedia: () => ({ matches: false }),
  } });
  try {
    for (const [preset, audience, councilAction] of [
      ["comfortable", "royal", "royal-hold-council"],
      ["aristocrat-comfortable", "aristocrat", "aristocrat-meet-stewards"],
    ] as const) {
      const session = createRoyaltyTestSession(preset, { atBirth: true });
      const { engine, life } = session;
      assert.equal(session.atBirth, true);
      assert.equal(session.preset.age, 0);
      assert.equal(life.age, 0);
      assert.equal(life.phase, "ready");
      assert.deepEqual(life.commands, [], "The test checkpoint is an ordinary birth, not a fabricated adult history.");
      assert.equal(life.eventCounts["royalty-test-checkpoint"], 1);
      assert.deepEqual(life.accomplishments, []);
      const householdActivities = engine.getActivities(life).filter(activity => activity.audience === audience);
      assert.ok(householdActivities.length > 0);
      assert.ok(householdActivities.every(activity => !activity.available), "A newborn must not gain council decisions, lessons or title projects early.");
      assert.throws(() => engine.act(life, councilAction), /unavailable|age|old enough/i);
      assert.deepEqual(engine.replay(life.seed, life.commands), life);
      assert.deepEqual(engine.load(engine.save(life)), life);

      const before = JSON.stringify({ life, world: engine.world });
      const html = renderToStaticMarkup(createElement(App, { enterGame: true, previewSession: session }));
      assert.match(html, /class="birth-record birth-intro-record"/);
      assert.match(html, /<dialog[^>]*class="birth-roll-popover"/);
      assert.match(html, /aria-busy="true"/);
      assert.match(html, /<button(?=[^>]*class="birth-popover-continue")(?=[^>]*disabled="")[^>]*>/);
      assert.doesNotMatch(html, /class="page-shell game-dashboard"|aria-label="Your life now"/);
      assert.doesNotMatch(html, /class="main-menu storybook-menu"|class="household-welcome-dialog"/,
        "The congratulation guide follows the birth reveal instead of stacking on top of it.");
      assert.doesNotMatch(html, /data-final-value=/, "Starting values remain hidden until the normal reveal finishes.");
      assert.equal(engineForLife(life), engine);
      assert.equal(JSON.stringify({ life, world: engine.world }), before);
    }
    assert.equal(storageAccesses, 0);
    assert.equal(sampleEngine, selectedEngine);
    assert.equal(SAVE_KEY, saveKey);
    assert.equal(PRESENTATION_KEY, presentationKey);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
