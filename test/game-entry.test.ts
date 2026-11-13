import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { builtinEngine, engineForLife, exportLife, selectWorldPack, WEALTH_OBSERVATIONS_KEY } from "../client/lib/world-session.ts";
import { getAssetValue } from "../src/economy.ts";
import { createSampleLife, persistBirthPresentation, persistLife } from "../client/mutations/lives.ts";
import type { LifeState } from "../src/types.ts";
import type { StorageLike } from "../client/types/session.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: App } = await import("../client/screens/App.tsx");
hooks.deregister();

function renderSavedLife(life: LifeState, enterGame = false, begun = false) {
  const values = new Map<string, string>();
  const storage: StorageLike = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
  persistLife(storage, life);
  if (begun) persistBirthPresentation(storage, life, true);
  const before = [...values];
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, matchMedia: () => ({ matches: false }) } });
  try {
    const html = renderToStaticMarkup(createElement(App, { enterGame }));
    assert.deepEqual([...values].filter(([key]) => key !== WEALTH_OBSERVATIONS_KEY), before, "entry must preserve the exact saved life and presentation markers");
    const observations = values.get(WEALTH_OBSERVATIONS_KEY);
    if (begun || life.phase === "ended") {
      const world = engineForLife(life).world;
      assert.deepEqual(JSON.parse(observations ?? "null"), {
        [`${world.id}::${world.version}`]: { [`${life.worldFingerprint}:${life.seed}`]: Math.round(life.economy!.cash + getAssetValue(world, life)) },
      }, "restoring a begun or completed life records its household assets once");
    } else assert.equal(observations, undefined, "an unbegun birth is not a recorded-life benchmark");
    return html;
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

test("the ordinary game route retains its title menu", () => {
  selectWorldPack(builtinEngine.world);
  const html = renderSavedLife(createSampleLife("entry-title-menu"));
  assert.match(html, /<main[^>]*class="ef-home"[^>]*aria-labelledby=/);
  assert.match(html, /class="everfolk-game" hidden=""/);
});

test("explicit loading-screen entry opens a pending birth without another title menu", () => {
  const life = createSampleLife("entry-pending-birth");
  const saved = exportLife(life);
  const html = renderSavedLife(life, true);
  assert.doesNotMatch(html, /<main[^>]*class="ef-home"/);
  assert.match(html, /<div class="everfolk-game">/);
  assert.match(html, /class="birth-record birth-intro-record"/);
  assert.equal(exportLife(life), saved);
});

test("explicit loading-screen entry restores an existing character directly and paused", () => {
  const life = createSampleLife("entry-existing-save");
  const html = renderSavedLife(life, true, true);
  assert.doesNotMatch(html, /<main[^>]*class="ef-home"/);
  assert.match(html, /<div class="everfolk-game">/);
  assert.match(html, /aria-label="Your life now"/);
  assert.match(html, /aria-label="Play automatic progression" aria-pressed="false"/);
  assert.match(html, /role="timer" aria-live="off">Paused</);
  assert.doesNotMatch(html, /class="birth-record birth-intro-record"/);
});

test("explicit loading-screen entry preserves a completed life and opens its summary", () => {
  let life = createSampleLife("entry-ended-save");
  for (let command = 0; life.phase !== "ended" && command < 1500; command++) {
    life = life.phase === "choice" ? builtinEngine.choose(life, builtinEngine.getChoices(life)[0].id) : builtinEngine.advance(life);
  }
  assert.equal(life.phase, "ended");
  const html = renderSavedLife(life, true);
  assert.doesNotMatch(html, /<main[^>]*class="ef-home"/);
  assert.match(html, /<div class="everfolk-game">/);
  assert.match(html, /aria-label="Life summary"/);
  assert.match(html, /class="life-ending-banner has-section-help"[^>]*aria-labelledby="life-ending-title"/);
  assert.match(html, /Read the full chronicle/);
});
