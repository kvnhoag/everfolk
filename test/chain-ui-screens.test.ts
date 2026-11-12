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
const { default: ActiveLifeCard } = await import("../client/chain/ActiveLifeCard.tsx");
const { default: MintRecovery } = await import("../client/chain/MintRecovery.tsx");
const { default: RankedEnding } = await import("../client/chain/RankedEnding.tsx");
const { default: Figures } = await import("../client/chain/Figures.tsx");
hooks.deregister();

const noop = () => {};
const life: LifeView = {
  life_id: "4", account_id: "bob.testnet", seed: "c".repeat(64), world_version: "alexandria-ranked-1", status: "alive",
  figure_picks: [{ figure_id: "euclid", token_id: "3", action_id: "euclid.school", rarity: 2 }], draws: [], checkpoints: [], started_at_ms: 0,
};

test("a committed mint's ending opens recovery instead of offering verification or another fee", () => {
  const session = {
    life: { ...life, status: "minting" as const },
    finish: async () => { throw new Error("No new verification"); },
    mint: async () => { throw new Error("No second mint fee"); },
    recoverMint: async () => { throw new Error("Only a button may start recovery"); },
    abandon: async () => {},
  };
  const html = renderToStaticMarkup(createElement(RankedEnding, { session, contract: {} as never, onClose: noop }));
  assert.match(html, /Finish keeping this life/);
  assert.match(html, /without paying another mint fee/);
  assert.match(html, /Complete mint/);
  assert.doesNotMatch(html, /Checking your life|Mint for|Give up/);
});

test("mint recovery remains retryable and explains the already committed fee", () => {
  const html = renderToStaticMarkup(createElement(MintRecovery, { busy: true, error: "Network interrupted", onRecover: noop, onBack: noop }));
  assert.match(html, /mint fee is already committed/);
  assert.match(html, /Completing/);
  assert.match(html, /Network interrupted/);
  assert.equal((html.match(/disabled/g) ?? []).length, 2);
});

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
  assert.match(html, /Epic · influence ×2/);
  assert.match(html, />Affection</);
  assert.match(html, /80 \/ 100/);
  assert.match(html, /No\. 9/);
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
  assert.match(html, /Weave Mode/);
});

test("the reveal ledger shows the deed, sources and NEAR links when known", () => {
  const view = mintRevealView({ token_id: "4", kind: "npc", figure_id: null, rarity: 1, affection: 40 }, "letters",
    { evidence: { birth_year: -350, death_year: -290, death_age: 60, sources: [{ token_id: "2", impact: 3 }] }, actionId: "letters.teach", txHash: "Tx1", evidenceUrl: "/api/ranked/evidence/e" });
  const html = renderToStaticMarkup(createElement(MintReveal, { view, affection: 40, onClose: noop }));
  assert.match(html, /Teach the young/);
  assert.match(html, /#2 · 100%/);
  assert.match(html, /nearblocks\.io\/txns\/Tx1/);
  assert.match(html, /Verified evidence/);
});

test("market ledger has tabs with counts", () => {
  const rows = [
    { tokenId: "5", href: "#token/5", title: "Scholar of Alexandria", isFigure: false, rarityLabel: "Common", actionName: "Teach the young", seller: "alice.testnet", priceText: "2 NEAR", priceYocto: "2", canBuy: true, affection: 30, emblem: "literacy" },
    { tokenId: "9", href: "#token/9", title: "Euclid, the geometer", isFigure: true, figureId: "euclid" as const, rarityLabel: "Rare", actionName: "Open a school", seller: "bob.testnet", priceText: "12 NEAR", priceYocto: "12", canBuy: false, affection: 70, emblem: null },
  ];
  const html = renderToStaticMarkup(createElement(MarketBody, { rows, onBuy: noop }));
  assert.match(html, /role="tablist"/);
  assert.match(html, /Famous figures<small>1<\/small>/);
  assert.match(html, /People of the city<small>1<\/small>/);
  assert.match(html, /Affection 70/);
  assert.equal((html.match(/>Buy</g) ?? []).length, 1);
});


test("an ended unminted life shows a mint action and never offers to continue playing", () => {
  const html = renderToStaticMarkup(createElement(ActiveLifeCard, { life, progress: { status: "ended", age: 62 }, onOpen: noop }));
  assert.match(html, /Ended · Ready to mint/);
  assert.match(html, /Review &amp; mint this life/);
  assert.doesNotMatch(html, /Continue this life/);
});

test("an on-chain paid pack can be reopened without a device save", () => {
  const html = renderToStaticMarkup(createElement(ActiveLifeCard, { life, progress: { status: "ended", pack: true }, onOpen: noop }));
  assert.match(html, /Open mint pack/);
  assert.match(html, /any device/);
  assert.doesNotMatch(html, /Keep this browser/);
});


test("figure directory separates historical writings from game qualification rules", () => {
  const html = renderToStaticMarkup(createElement(Figures, { backend: { contract: {}, revision: 0 } as never }));
  assert.match(html, /Aristotle, the philosopher and naturalist/);
  assert.match(html, /Cleomenes of Naucratis, the financial administrator/);
  assert.match(html, /Nicomachean Ethics/);
  assert.match(html, /Elements/);
  assert.match(html, /Authored writings/);
  assert.match(html, /No authored literary work is securely identified/);
  assert.match(html, /How a life qualifies/);
  assert.doesNotMatch(html, /Keep to the Museum|Alexander, the conqueror/);
});
