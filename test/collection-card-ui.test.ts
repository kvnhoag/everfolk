import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { getFigureCardArt } from "../client/models/card-art.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: EverfolkCard } = await import("../client/chain/EverfolkCard.tsx");
const { default: FigureArtwork } = await import("../client/chain/FigureArtwork.tsx");
hooks.deregister();

test("a known parent uses the complete approved face once, with its recorded serial", () => {
  const art = getFigureCardArt("euclid", 4)!;
  const html = renderToStaticMarkup(createElement(EverfolkCard, { title: "Euclid", isFigure: true, figureId: "euclid", rarity: 4, tokenId: "999", editionText: "007/010" }));
  assert.ok(html.includes(`src="${art.footerlessSrc}"`));
  assert.match(html, /data-card-art="euclid-parent"/);
  assert.match(html, />007\/010<\/text>/);
  assert.doesNotMatch(html, /ef-card-portrait-wrap|ef-card-header|ef-card-identity/, "the approved frame must not sit inside a second generic frame");
  assert.doesNotMatch(html, /001\/010|999\/010/);
  const biography = renderToStaticMarkup(createElement("span", null, art.bodyText)).slice(6, -7);
  assert.ok(html.includes(biography), "the approved biography remains available to assistive technology");
});

test("an unassigned copy has an honest placeholder rather than a forged example serial", () => {
  const html = renderToStaticMarkup(createElement(EverfolkCard, { title: "Alexander", isFigure: true, figureId: "alexander", rarity: 3, tokenId: "42" }));
  assert.match(html, /data-rarity="epic"/);
  assert.match(html, />—\/025<\/text>/);
  assert.doesNotMatch(html, /001\/025|042\/025|LEGENDARY/);
});

test("a custom stage portrait keeps the person's own image and identity", () => {
  const portrait = "/assets/portraits/ordinary-v3/custom-life.png";
  const html = renderToStaticMarkup(createElement(EverfolkCard, { title: "Kallias", isFigure: true, figureId: "alexander", rarity: 4, portraitMedia: portrait, subtitle: "A lived stage" }));
  assert.ok(html.includes(`src="${portrait}"`));
  assert.match(html, /Kallias/);
  assert.match(html, /A lived stage/);
  assert.doesNotMatch(html, /data-card-art=|collection-card-art-image/);
});

test("Common and Uncommon retain their separate numeric ranks", () => {
  for (const [rarity, label] of [[0, "Common"], [1, "Uncommon"]] as const) {
    const html = renderToStaticMarkup(createElement(EverfolkCard, { title: "A citizen", rarity, portraitMedia: "/assets/pixel/portraits/citizen.svg" }));
    assert.ok(html.includes(`aria-label="A citizen, ${label}"`));
    assert.ok(html.includes(`ef-card-badge rarity-${rarity}`));
    assert.ok(html.includes(`✦ ${label}`));
  }
});

test("approved card actions stay outside the front and keyboard interaction is retained", () => {
  const html = renderToStaticMarkup(createElement(EverfolkCard, { title: "Euclid", isFigure: true, figureId: "euclid", rarity: 4, affection: 73, priceNear: "2.5", actions: createElement("button", { type: "button" }, "View deed") }));
  assert.match(html, /role="button" tabindex="0"/);
  assert.match(html, /<\/figure><\/div><\/div><div class="ef-card-collection-details">/);
  assert.match(html, /ef-card-collection-details[\s\S]*Affection 73\/100[\s\S]*2\.5 NEAR[\s\S]*<button type="button">View deed<\/button>/);
  const staticCard = renderToStaticMarkup(createElement(EverfolkCard, { title: "Euclid", isFigure: true, figureId: "euclid", interactive: false }));
  assert.doesNotMatch(staticCard, /role="button"|tabindex="0"/);
});

test("FigureArtwork can deliver the approved full face or the unchanged inner illustration", () => {
  const art = getFigureCardArt("aristotle", 4)!;
  const full = renderToStaticMarkup(createElement(FigureArtwork, { figureId: "aristotle", rarity: 4, fullCard: true, editionText: "012/010" }));
  assert.ok(full.includes(`src="${art.footerlessSrc}"`));
  assert.match(full, />012\/010<\/text>/, "older recorded serials remain unchanged even above a revised cap");
  const inner = renderToStaticMarkup(createElement(FigureArtwork, { figureId: "aristotle" }));
  assert.ok(inner.includes(`src="${art.portraitSrc}"`));
  assert.match(inner, /width="840" height="1050"/);
  assert.doesNotMatch(inner, /collection-card-art/);
});
