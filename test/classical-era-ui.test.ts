import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { WorldPack } from "../src/types.ts";
import { builtinEngine, selectWorldPack } from "../client/lib/world-session.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.31.0.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: App } = await import("../client/screens/App.tsx");
hooks.deregister();

function render(world: WorldPack) {
  try {
    selectWorldPack(world);
    return renderToStaticMarkup(createElement(App, { startFresh: true }));
  } finally { selectWorldPack(builtinEngine.world); }
}

test("the current birth screen identifies the Rhakotis coast and 350 BCE without a premature Alexandria birthplace", () => {
  const html = render(current as WorldPack);
  assert.match(html, /Current year 350 BCE/);
  assert.match(html, /<dt>PLACE<\/dt><dd>Rhakotis coast, Egypt/);
  assert.match(html, /From Rhakotis to Alexandria/);
  assert.match(html, /birth-popover-reborn/);
  assert.doesNotMatch(html, /<dt>PLACE<\/dt><dd>Alexandria, Egypt|66 BCE|a lighthouse/);
});

test("retained life screens retain their original Alexandria and 66 BCE labels", () => {
  const html = render(previous as WorldPack);
  assert.match(html, /Current year 66 BCE/);
  assert.match(html, /<dt>PLACE<\/dt><dd>Alexandria, Egypt/);
  assert.doesNotMatch(html, /Rhakotis coast, Egypt|350 BCE/);
});
