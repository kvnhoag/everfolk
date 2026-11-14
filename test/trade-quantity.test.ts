import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { demoEngine } from "./fixtures/demo/world.ts";
import { demoScreen } from "../client/demo/screen.ts";
import { cleanQuantityText, quantityOf, tradeLimit } from "../client/models/trade-quantity.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: EconomyPanels } = await import("../client/demo/EconomyPanels.tsx");
hooks.deregister();

test("the quantity box may be emptied while typing", () => {
  assert.equal(cleanQuantityText("", 187), "");
  assert.equal(quantityOf(""), 0);
});

test("typing 20 into a field that held 1 gives 20, never 201 or 120", () => {
  // The field reports its whole new value on every keystroke; the clean text is exactly what was typed.
  assert.equal(cleanQuantityText("2", 187), "2");
  assert.equal(cleanQuantityText("20", 187), "20");
  // Select-all then type 2, then 0: each step replaces, never appends to the old value.
  let text = "1";
  for (const typed of ["", "2", "20"]) text = cleanQuantityText(typed, 187);
  assert.equal(text, "20");
  assert.equal(quantityOf(text), 20);
});

test("the quantity box takes digits only and drops leading zeros", () => {
  assert.equal(cleanQuantityText("2a0", 187), "20");
  assert.equal(cleanQuantityText("-5", 187), "5");
  assert.equal(cleanQuantityText("1.5", 187), "15");
  assert.equal(cleanQuantityText(" 4 2 ", 187), "42");
  assert.equal(cleanQuantityText("0020", 187), "20");
  assert.equal(cleanQuantityText("0", 187), "");
  assert.equal(cleanQuantityText("abc", 187), "");
});

test("the quantity box clamps to what is available", () => {
  assert.equal(cleanQuantityText("999", 187), "187");
  assert.equal(cleanQuantityText("187", 187), "187");
  assert.equal(cleanQuantityText("188", 187), "187");
  assert.equal(cleanQuantityText("5", 0), "");
  assert.equal(cleanQuantityText("99999999999999999999999", 500), "500");
});

test("the limit is what is held, what the merchant can pay for or stock, and the order cap", () => {
  const base = { held: 187, merchantCanBuy: 120, merchantStock: 60, maxOrder: 5000 };
  assert.equal(tradeLimit({ ...base, side: "sell", counterparty: "merchant" }), 120);
  assert.equal(tradeLimit({ ...base, side: "sell", counterparty: "army" }), 187);
  assert.equal(tradeLimit({ ...base, side: "buy", counterparty: "merchant" }), 60);
  assert.equal(tradeLimit({ ...base, held: 9000, merchantCanBuy: 9000, side: "sell", counterparty: "merchant" }), 5000);
  assert.equal(tradeLimit({ held: 40, maxOrder: 5000, side: "sell", counterparty: "merchant" }), 40);
  assert.equal(tradeLimit({ held: 0, maxOrder: 5000, side: "sell", counterparty: "merchant" }), 0);
});

test("the trade form's quantity box is a text field for digits that selects all on focus", () => {
  const engine = demoEngine();
  const screen = demoScreen(engine.world, engine.start("quantity-box"))!;
  const html = renderToStaticMarkup(createElement(EconomyPanels, {
    screen, cashText: "12 drachmas", autoPlay: false, onTrade: () => null, onPlan: () => null, onAutoPlay: () => {}, onDelegate: () => null,
  }));
  const label = /<label[^>]*>Quantity<input([^>]*)>/.exec(html);
  assert.ok(label, "the quantity box is rendered inside its label");
  assert.match(label[1], /type="text"/);
  assert.match(label[1], /inputMode="numeric"/);
  assert.match(label[1], /autoComplete="off"/);
  assert.doesNotMatch(label[1], /type="number"/);
  // Event handlers are not in static markup: the focus handler must select the whole old value so typing replaces it.
  assert.match(readFileSync(new URL("../client/demo/EconomyPanels.tsx", import.meta.url), "utf8"), /onFocus=\{event => event\.target\.select\(\)\}/);
});
