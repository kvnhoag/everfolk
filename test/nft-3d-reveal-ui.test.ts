import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) {
      const source = readFileSync(new URL(url), "utf8");
      const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname });
      return { format: "module", source: output.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { default: MintReveal } = await import("../client/chain/MintReveal.tsx");
const { mintRevealView } = await import("../client/chain/life-report-model.ts");
hooks.deregister();

const result = { token_id: "42", kind: "figure" as const, figure_id: "alexander" as const, rarity: 4, affection: 90 };
const card = { name: "Alexander", rarity: 4, art: "/assets/figures/alexander.png", sub: "Levy troops" };

test("a freshly minted NFT opens as a 3D card before its ledger details", () => {
  const html = renderToStaticMarkup(createElement(MintReveal, { view: mintRevealView(result, "military"), affection: 90, card, onClose() {} }));
  assert.match(html, /nft-card-viewer/);
  assert.match(html, /<iframe[^>]*title="Your Everfolk legacy pack"/);
  assert.doesNotMatch(html, /See its page/, "details wait until the 3D view is closed");
});

test("without a card the mint result shows its ledger details as before", () => {
  const html = renderToStaticMarkup(createElement(MintReveal, { view: mintRevealView(result, "military"), affection: 90, onClose() {} }));
  assert.match(html, /See its page/);
  assert.doesNotMatch(html, /View in 3D|<iframe/);
});
