import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { LifeView } from "../chain/types.ts";
import { lifeReport, mintRevealView, npcActionMenu } from "../client/chain/life-report-model.ts";
import { tokenPageView } from "../client/chain/token-page-model.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: BornInto } = await import("../client/chain/BornInto.tsx");
const { default: DrawBeat } = await import("../client/chain/DrawBeat.tsx");
const { default: LifeReport } = await import("../client/chain/LifeReport.tsx");
const { default: MintReveal } = await import("../client/chain/MintReveal.tsx");
const { TokenPageBody } = await import("../client/chain/TokenPage.tsx");
const { MarketBody } = await import("../client/chain/Market.tsx");
const { default: DeclineChoice } = await import("../client/chain/DeclineChoice.tsx");
hooks.deregister();

const noop = () => {};
const life: LifeView = {
  life_id: "4", account_id: "bob.testnet", seed: "c".repeat(64), world_version: "alexandria-ranked-1", status: "alive",
  figure_picks: [{ figure_id: "euclid", token_id: "3", action_id: "euclid.school", rarity: 2 }], draws: [], checkpoints: [], started_at_ms: 0,
};

test("birth world lists each line and a begin button", () => {
  const html = renderToStaticMarkup(createElement(BornInto, { lines: ["Euclid (alice.testnet) has opened a school."], onBegin: noop }));
  assert.match(html, /The world you are born into/);
  assert.match(html, /Euclid \(alice\.testnet\) has opened a school\./);
  assert.match(html, /Begin this life/);
});

test("draw beat links the drawn person to its page", () => {
  const draw = { step: 4, category: "education" as const, token_id: "5", action_id: "letters.teach", rarity: 1, commands_hash: "a".repeat(64) };
  const html = renderToStaticMarkup(createElement(DrawBeat, { draw, pending: false, owner: "alice.testnet", onContinue: noop }));
  assert.match(html, /href="#token\/5"/);
  assert.match(html, /Teach the young/);
});

test("life report shows sources, shares, fee and the career menu", () => {
  const report = lifeReport({ life, sources: [{ token_id: "3", impact: 10 }] });
  const html = renderToStaticMarkup(createElement(LifeReport, {
    report, feeText: "1", menu: npcActionMenu("letters"), selectedAction: "letters.teach",
    onSelectAction: noop, onMint: noop, onDecline: noop,
  }));
  assert.match(html, /Who shaped your life/);
  assert.match(html, /Mint this life\?/);
  assert.match(html, /100%/);
  assert.match(html, /Mint for 1 NEAR/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
});

test("reveal names the kept life with rarity and affection", () => {
  const view = mintRevealView({ token_id: "9", kind: "figure", figure_id: "euclid", rarity: 3, affection: 80 }, "letters");
  const html = renderToStaticMarkup(createElement(MintReveal, { view, affection: 80, onClose: noop }));
  assert.match(html, /Euclid, the geometer/);
  assert.match(html, /Epic/);
  assert.match(html, /Affection 80 \/ 100/);
  assert.match(html, /href="#token\/9"/);
});

test("token page shows reach, claim and owner controls only to the owner", () => {
  const token = { owner_id: "alice.testnet", extra: {
    kind: "npc" as const, figure_id: null, rarity: 1, affection: 70, action_id: "letters.teach", life_id: "4", birth_year: -350, death_year: -289,
    career_group: "letters" as const, sources: [{ token_id: "1", bps: 10_000 }], evidence_hash: "e".repeat(64),
  } };
  const half = (10n ** 24n / 2n).toString();
  const input = { tokenId: "5", token, stats: { lives_influenced: 2, earned: half }, balance: half, listing: null, children: ["9"], sourceTokens: {} };
  const handlers = { onSetAction: noop, onWithdraw: noop, onList: noop, onUnlist: noop, onBuy: noop };
  const owner = renderToStaticMarkup(createElement(TokenPageBody, { tokenId: "5", view: tokenPageView({ ...input, viewer: "alice.testnet" }), ...handlers }));
  assert.match(owner, /Affected 2 lives · earned 0\.5 NEAR/);
  assert.match(owner, /Withdraw/);
  assert.match(owner, /Make this its deed/);
  assert.match(owner, /Put it up for sale/);
  const visitor = renderToStaticMarkup(createElement(TokenPageBody, { tokenId: "5", view: tokenPageView({ ...input, viewer: "carol.testnet" }), ...handlers }));
  assert.doesNotMatch(visitor, /Withdraw|Make this its deed|Put it up for sale/);
  assert.match(visitor, /Kept by alice\.testnet/);
});

test("market lists offers with a buy button for others", () => {
  const row = { tokenId: "5", href: "#token/5", title: "Scholar of Alexandria", isFigure: false, rarityLabel: "Common", actionName: "Teach the young", seller: "alice.testnet", priceText: "2 NEAR", priceYocto: "2", canBuy: true };
  const html = renderToStaticMarkup(createElement(MarketBody, { rows: [row], onBuy: noop }));
  assert.match(html, /Scholar of Alexandria/);
  assert.match(html, />Buy</);
  assert.match(renderToStaticMarkup(createElement(MarketBody, { rows: [], onBuy: noop })), /Nothing is for sale right now/);
});

test("declining a mint offers to keep the life for later or close it, and says what closing costs", () => {
  const html = renderToStaticMarkup(createElement(DeclineChoice, { cooldownMinutes: 10, onKeep: noop, onClose: noop, onBack: noop }));
  assert.match(html, /Keep it for later/);
  assert.match(html, /Close this life/);
  assert.match(html, /10 minutes/);
  assert.match(html, /Ranked life/);
});
