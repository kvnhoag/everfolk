import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { MintPack } from "../chain/types.ts";
import type { LivesContract } from "../client/chain/types.ts";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: MintPackView } = await import("../client/chain/MintPack.tsx");
const { default: LifeEndingBanner } = await import("../client/components/LifeEndingBanner.tsx");

const pack = {
  life_id: "freeplay-0", evidence_hash: "0".repeat(64), reroll_fee: "0", total_fee: "0", source_share_bps: 0,
  cards: [0, 1, 2].map(() => ({ kind: "npc", action_id: "letters.teach", rarity: "common", affection: 50, rerolled: false, figure_id: null })),
} as unknown as MintPack;

test("a free life's pack only shows what could have been won and points to Weave Mode", () => {
  const html = renderToStaticMarkup(createElement(MintPackView, { previewOnly: true, practice: true, walletPath: false, initialPack: pack, contract: {} as LivesContract, onClose() {} }));
  assert.match(html, /You could have gotten/);
  assert.match(html, /href="#weave"[^>]*>Play Weave Mode to get real NFTs/);
  assert.doesNotMatch(html, /Mint selected|Reroll|Total paid|Save pack/);
});

test("the ending banner leads a free life to its pack, Weave Mode and the Market", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "338 BCE – 274 BCE", lived: "64 years", cause: "Sepsis", ranked: false, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.match(html, /LIFE COMPLETE/);
  assert.match(html, /Open your pack/);
  assert.match(html, /href="#weave"/);
  assert.match(html, /href="#market"/);
  assert.doesNotMatch(html, /[Mm]int this/);
});

test("a Weave life's ending sends minting back to Weave Mode instead of a free pack", () => {
  const html = renderToStaticMarkup(createElement(LifeEndingBanner, { name: "Herais", dates: "x", lived: "64 years", ranked: true, onChronicle() {}, onOpenPack() {}, onNewLife() {} }));
  assert.doesNotMatch(html, /Open your pack|Begin another life/);
  assert.match(html, /href="#market"/);
});

const { default: LifeMomentsPack } = await import("../client/chain/LifeMomentsPack.tsx");
const moments = [
  { stageId: "infancy", stageTitle: "Infancy", ages: "Ages 0–2", title: "Child of a farm", media: "/a.svg", historical: false },
  { stageId: "youth", stageTitle: "Youth", ages: "Ages 14–17", title: "Euclid, the geometer", media: "/b.svg", historical: true },
];

test("a free life's pack opens into the moments of that life, with no mint", () => {
  const sealed = renderToStaticMarkup(createElement(LifeMomentsPack, { moments, onClose() {} }));
  assert.match(sealed, /Open your pack/);
  assert.doesNotMatch(sealed, /Child of a farm/, "Cards stay hidden until the pack is opened.");
  const opened = renderToStaticMarkup(createElement(LifeMomentsPack, { moments, onClose() {}, initiallyOpen: true }));
  assert.match(opened, /You could have gotten/);
  assert.match(opened, /Infancy[\s\S]*Child of a farm/);
  assert.match(opened, /Youth[\s\S]*Euclid, the geometer/);
  assert.match(opened, /href="#weave"[^>]*>Play Weave Mode to get real NFTs/);
  assert.doesNotMatch(opened, /Mint|NEAR fee|Reroll/);
});
