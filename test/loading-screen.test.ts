import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LoadingScreen } = await import("../client/screens/LoadingScreen.tsx");
hooks.deregister();

test("loading shows a visible percentage and an accessible determinate bar alongside the walking scene", () => {
  const html = renderToStaticMarkup(createElement(LoadingScreen, { phase: "world", progress: 65 }));
  assert.match(html, /Loading world…/);
  assert.match(html, />65%<\/span>/);
  assert.match(html, /<progress[^>]*value="65"[^>]*max="100"[^>]*aria-label="Loading Everfolk"/);
  assert.match(html, /aria-valuetext="65% — Loading world…"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /class="loading-soldier"/);
  assert.doesNotMatch(html, /loading-preview-enter/);
});

test("the server-rendered opening frame and restoring phase have progress before hydration", () => {
  for (const [props, percent] of [[{}, 5], [{ phase: "restoring" as const }, 20]] as const) {
    const html = renderToStaticMarkup(createElement(LoadingScreen, props));
    assert.match(html, new RegExp(`<progress[^>]*value="${percent}"`));
    assert.ok(html.includes(`${percent}%`));
  }
});

test("ready preview shows a completed bar without an entry button", () => {
  const html = renderToStaticMarkup(createElement(LoadingScreen, { preview: true }));
  assert.match(html, /Ready to play/);
  assert.match(html, /<progress[^>]*value="100"/);
  assert.match(html, /aria-busy="false"/);
  assert.doesNotMatch(html, /<a\b|<button\b/);
  assert.doesNotMatch(html, /Enter Everfolk|Loading game…/);
});

test("progress remains a valid percentage at boundary and invalid inputs", () => {
  for (const [progress, expected] of [[-10, 0], [150, 100], [44.6, 45], [NaN, 5], [Infinity, 5]]) {
    const html = renderToStaticMarkup(createElement(LoadingScreen, { progress }));
    assert.match(html, new RegExp(`<progress[^>]*value="${expected}"`));
  }
});
