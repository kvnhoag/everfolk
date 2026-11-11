import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { payoutPreview, previewForInput } from "../client/chain/payout-preview.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { createPreviewLedger } from "../client/chain/preview-ledger.ts";
import { createLivesContract } from "../client/chain/contract.ts";
import { resolveChainConfig } from "../client/chain/config.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SellYours } = await import("../client/chain/SellYours.tsx");
const { MarketBody } = await import("../client/chain/Market.tsx");
const { TokenPageBody } = await import("../client/chain/TokenPage.tsx");
hooks.deregister();

const TERMS = { royaltySourcesBps: 500, royaltyTreasuryBps: 500 };
const PRICE = "25000000000000000000000";
const ITEM = { tokenId: "7", title: "A scribe", href: "#token/7", listedPriceText: null, hasSources: true };
const noop = () => {};

function render(items: readonly (typeof ITEM)[], typed?: string): string {
  return renderToStaticMarkup(createElement(SellYours, { items, terms: TERMS, busy: false, onList: noop, onUnlist: noop, initialPrices: typed === undefined ? undefined : { "7": typed } }));
}

test("payout preview of 0.025 NEAR with sources", () => {
  assert.deepEqual(payoutPreview(PRICE, TERMS, true), {
    sellerYocto: "22500000000000000000000", sourcesYocto: "1250000000000000000000", treasuryYocto: "1250000000000000000000",
  });
});

test("without sources the sources share goes to the treasury", () => {
  assert.deepEqual(payoutPreview(PRICE, TERMS, false), {
    sellerYocto: "22500000000000000000000", sourcesYocto: "0", treasuryYocto: "2500000000000000000000",
  });
});

test("parts always sum to the price", () => {
  for (const price of ["1", "3", "9999", "10001", PRICE, "123456789012345678901234567", "340282366920938463463374607431768211455"]) {
    for (const hasSources of [true, false]) {
      const p = payoutPreview(price, { royaltySourcesBps: 333, royaltyTreasuryBps: 777 }, hasSources);
      assert.equal(BigInt(p.sellerYocto) + BigInt(p.sourcesYocto) + BigInt(p.treasuryYocto), BigInt(price));
    }
  }
});

test("payoutPreview rejects invalid inputs via the form", () => {
  for (const bad of ["0", "-1", "abc", "", "1e3", "0.0000000000000000000000001"]) {
    assert.equal(previewForInput(bad, TERMS, true), null, bad);
    assert.doesNotMatch(render([ITEM], bad), /You receive/, bad);
  }
  assert.match(render([ITEM], "0.025"), /You receive 0\.0225 NEAR · Earlier lives receive 0\.0012 · Treasury 0\.0012/);
});

test("SellYours shows Take off the market for a listed NFT", () => {
  const html = render([{ ...ITEM, listedPriceText: "0.025 NEAR" }]);
  assert.match(html, /Take off the market/);
  assert.match(html, /0\.025 NEAR/);
  assert.doesNotMatch(html, /Put it up for sale/);
});

test("placeholder suggests 0.025", () => {
  assert.match(render([ITEM]), /placeholder="0\.025"/);
});

test("marketTerms is served by the mock, the preview ledger and the contract client", async () => {
  assert.deepEqual(await createMockContract().marketTerms(), TERMS);
  assert.deepEqual(await (await createPreviewLedger()).marketTerms(), TERMS);
  const fetchStub = (async (_u: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(Buffer.from(body.params.args_base64, "base64").toString(), "{}");
    assert.equal(body.params.method_name, "get_params");
    const bytes = [...Buffer.from(JSON.stringify({ mint_fee: "1", royalty_sources_bps: 400, royalty_treasury_bps: 600 }))];
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { result: bytes, logs: [] } }));
  }) as typeof fetch;
  const contract = createLivesContract({ accountId: null, signIn: async () => {}, signOut: async () => {}, call: async () => null }, resolveChainConfig({ contractId: "lives.testnet" }), { fetch: fetchStub });
  assert.deepEqual(await contract.marketTerms(), { royaltySourcesBps: 400, royaltyTreasuryBps: 600 });
});

test("marketTerms rejects malformed params", async () => {
  const fetchStub = (async (_u: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const bytes = [...Buffer.from(JSON.stringify({ royalty_sources_bps: 9000, royalty_treasury_bps: 9000 }))];
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { result: bytes, logs: [] } }));
  }) as typeof fetch;
  const contract = createLivesContract({ accountId: null, signIn: async () => {}, signOut: async () => {}, call: async () => null }, resolveChainConfig({ contractId: "lives.testnet" }), { fetch: fetchStub });
  await assert.rejects(contract.marketTerms(), /market terms/);
});

test("Market shows the Yours tab only when signed in, listing own NFTs", () => {
  const base = { rows: [], onBuy: noop };
  assert.doesNotMatch(renderToStaticMarkup(createElement(MarketBody, base)), />Yours</);
  const html = renderToStaticMarkup(createElement(MarketBody, { ...base, initialTab: "yours", yours: { items: [ITEM], terms: TERMS, onList: noop, onUnlist: noop } }));
  assert.match(html, />Yours</);
  assert.match(html, /A scribe/);
  assert.match(html, /placeholder="0\.025"/);
  assert.doesNotMatch(html, /market-filters/);
});

test("the token page sale box uses the 0.025 placeholder", () => {
  const view = { listing: null, canList: true, sources: [], isOwner: true, currentAction: { id: "a", name: "A", description: "" }, menu: [], children: [], figureId: null, kindLabel: "", title: "T", rarityLabel: "", lifeLine: "", owner: "x", affectionText: "", affection: 1, evidenceHref: null, reach: "", claimableText: null, canChangeAction: false, isFigure: false, canBuy: false, canUnlist: false };
  const html = renderToStaticMarkup(createElement(TokenPageBody, { tokenId: "1", view: view as never, onSetAction: noop, onWithdraw: noop, onList: noop, onUnlist: noop, onBuy: noop }));
  assert.match(html, /placeholder="0\.025"/);
});
