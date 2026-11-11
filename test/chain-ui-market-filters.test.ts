import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { MarketRow } from "../client/chain/token-page-model.ts";
import { DEFAULT_FILTER, applyFilter, filterOptions } from "../client/chain/market-filters.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { MarketBody } = await import("../client/chain/Market.tsx");
hooks.deregister();

const row = (patch: Partial<MarketRow>): MarketRow => ({
  tokenId: "1", href: "#/token/1", title: "Scholar of Alexandria", isFigure: false, rarityLabel: "Common", actionName: "Teach",
  seller: "a.testnet", priceText: "1 NEAR", priceYocto: "1", canBuy: true, careerGroup: "letters", rarity: 1, ...patch,
});
const rows = [
  row({ tokenId: "9", priceYocto: "9", careerGroup: "farming", rarity: 1 }),
  row({ tokenId: "10", priceYocto: "10000000000000000000000", careerGroup: "letters", rarity: 2 }),
  row({ tokenId: "3", priceYocto: "500", careerGroup: "farming", rarity: 2 }),
  row({ tokenId: "4", priceYocto: "700", careerGroup: null, rarity: null }),
];

test("price sorts by yocto not text", () => {
  assert.deepEqual(applyFilter(rows, { ...DEFAULT_FILTER, sort: "price-asc" }).map(r => r.priceYocto), ["9", "500", "700", "10000000000000000000000"]);
  assert.equal(applyFilter(rows, { ...DEFAULT_FILTER, sort: "price-desc" })[0].priceYocto, "10000000000000000000000");
});

test("newest puts the highest token id first", () => {
  assert.deepEqual(applyFilter(rows, { ...DEFAULT_FILTER, sort: "newest" }).map(r => r.tokenId), ["10", "9", "4", "3"]);
});

test("filter by Farming keeps only farming rows", () => {
  assert.deepEqual(applyFilter(rows, { ...DEFAULT_FILTER, group: "farming" }).map(r => r.tokenId), ["9", "3"]);
  assert.deepEqual(applyFilter(rows, { ...DEFAULT_FILTER, rarity: 2 }).map(r => r.tokenId), ["3", "10"]);
});

test("filter options count only present values", () => {
  const options = filterOptions(rows);
  assert.deepEqual(options.groups.map(g => [g.id, g.label, g.count]), [["letters", "Scholar of Alexandria", 1], ["farming", "Farmer of Alexandria", 2]]);
  assert.deepEqual(options.rarities.map(r => [r.id, r.count]), [[1, 1], [2, 2]]);
});

test("applyFilter does not mutate its input", () => {
  const frozen = Object.freeze(rows.map(r => Object.freeze({ ...r })));
  const out = applyFilter(frozen, { ...DEFAULT_FILTER, sort: "newest" });
  assert.notEqual(out, frozen);
  assert.deepEqual(frozen.map(r => r.tokenId), ["9", "10", "3", "4"]);
});

test("Market body shows the filter controls and an empty note when nothing matches", () => {
  const html = renderToStaticMarkup(createElement(MarketBody, { rows, onBuy() {} }));
  for (const label of ["Career", "Rarity", "Sort", "Newest minted"]) assert.ok(html.includes(label), label);
  const none = renderToStaticMarkup(createElement(MarketBody, { rows, onBuy() {}, initialFilter: { ...DEFAULT_FILTER, group: "sky" } }));
  assert.ok(none.includes("Nothing matches these filters."));
});
