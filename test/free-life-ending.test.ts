import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: LifeEndingBanner } = await import("../client/components/LifeEndingBanner.tsx");


test("the ending banner leads a free life to its pack, Weave Mode and the Market", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "338 BCE – 274 BCE", lived: "64 years", cause: "Sepsis", ranked: false, packCards: 3, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.match(html, /LIFE COMPLETE/);
  assert.match(html, /Open your pack · 3 cards/);
  assert.match(html, /href="#weave"/);
  assert.match(html, /href="#market"/);
  assert.doesNotMatch(html, /[Mm]int this/);
});

test("a free life that ended before 18 has no pack to open but still points to Weave Mode", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "x", lived: "12 years", ranked: false, packCards: 0, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.doesNotMatch(html, /Open your pack/);
  assert.match(html, /No pack this time/);
  assert.match(html, /href="#weave"/);
});

test("a Weave life's ending sends minting back to Weave Mode instead of a free pack", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "x", lived: "64 years", ranked: true, packCards: 0, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.doesNotMatch(html, /Open your pack|Begin another life/);
  assert.match(html, /href="#market"/);
});
