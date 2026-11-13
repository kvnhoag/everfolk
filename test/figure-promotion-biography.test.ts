import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { biographyFor } from "../chain/catalog/figure-biographies.ts";
import { FIGURE_ROSTER, figureCardBiography, figureRosterEntry, type FigureCardRank } from "../chain/catalog/figure-roster.ts";
import promotions from "../chain/catalog/figure-promotions.json" with { type: "json" };
import { getFigureCardArt } from "../client/models/card-art.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: HistoricalFigureCard } = await import("../client/components/HistoricalFigureCard.tsx");
const { default: FigureCardViewer } = await import("../client/components/FigureCardViewer.tsx");
hooks.deregister();

const promotedIds = ["demetrius", "ptolemy", "zeno"] as const;
const namedFeats = { demetrius: /captur\w* Rhodes/i, ptolemy: /Ptolemaic dynasty/i, zeno: /Stoic school/i };
const figure = (id: string) => { const entry = figureRosterEntry(id); assert.ok(entry, id); return entry; };
const textMarkup = (value: string) => renderToStaticMarkup(createElement("span", null, value)).slice(6, -7);
const renderViewer = (id: string, rank: FigureCardRank, mode: "principal" | "contribution" = "principal") =>
  renderToStaticMarkup(createElement(FigureCardViewer, { figure: figure(id), initialRank: rank, mode, onClose: () => {} }));
const viewerSummary = (html: string) => {
  const match = html.match(/<p class="figure-card-viewer-summary">([\s\S]*?)<\/p>/);
  assert.ok(match, "The selected variant has a biography summary");
  return match[1];
};

test("selecting a promoted principal shows the feat in its Legendary biography and preserves its Epic biography", () => {
  for (const id of promotedIds) {
    const entry = figure(id);
    assert.equal(figureCardBiography(entry, "Epic"), biographyFor(id).biography);
    assert.equal(figureCardBiography(entry, "Legendary"), promotions[id].biography);
    assert.equal(viewerSummary(renderViewer(id, "Epic")), textMarkup(biographyFor(id).biography));
    assert.equal(viewerSummary(renderViewer(id, "Legendary")), textMarkup(promotions[id].biography));
    assert.notEqual(promotions[id].biography, biographyFor(id).biography);
  }
});

test("Legendary faces explain each Epic-to-Legendary promotion and Demetrius's alternate-history capture", () => {
  for (const id of promotedIds) {
    const art = getFigureCardArt(id, "Legendary");
    assert.ok(art, id);
    assert.equal(art.bodyText, promotions[id].biography);
    assert.match(art.bodyText, namedFeats[id]);
    assert.match(art.bodyText, /\bEpic\b[\s\S]*\bLegendary\b/i);
    const html = renderToStaticMarkup(createElement(HistoricalFigureCard, { figure: figure(id), rank: "Legendary" }));
    assert.ok(html.includes(textMarkup(art.bodyText)), `${id}'s promotion biography appears on the face`);
  }
  const demetrius = getFigureCardArt("demetrius", "Legendary")!;
  assert.match(demetrius.bodyText, /alternate[ -]history/i);
  assert.doesNotMatch(demetrius.bodyText, /ended in negotiation|ended in negotiated peace/i);
});

test("contribution previews and fixed Legendary principals keep their historical biography", () => {
  for (const id of promotedIds) {
    assert.equal(viewerSummary(renderViewer(id, "Epic", "contribution")), textMarkup(biographyFor(id).biography));
  }
  for (const entry of FIGURE_ROSTER.filter(entry => entry.baseRank === "Legendary")) {
    assert.equal(figureCardBiography(entry, "Legendary"), biographyFor(entry.id).biography);
    assert.equal(viewerSummary(renderViewer(entry.id, "Legendary")), textMarkup(biographyFor(entry.id).biography));
  }
});

test("promotion copy does not overwrite the reviewed Epic card copy or historical research", () => {
  const reviewed = JSON.parse(readFileSync(new URL("../artwork/cards/framed-collection-v14/catalog.json", import.meta.url), "utf8"));
  for (const id of promotedIds) {
    const epic = getFigureCardArt(id, "Epic");
    const baseline = reviewed.assets.find((card: { figureId: string; kind: string }) => card.figureId === id && card.kind === "parent");
    assert.ok(epic && baseline, id);
    assert.equal(epic.bodyText, baseline.bodyText);
    assert.equal(figure(id).biography, biographyFor(id));
    assert.doesNotMatch(biographyFor(id).biography, /\bEpic\b|\bLegendary\b|alternate[ -]history/i);
  }
  assert.match(biographyFor("demetrius").biography, /negotiated peace/i);
  assert.match(getFigureCardArt("demetrius", "Epic")!.bodyText, /ended in negotiation/i);
});

test("delivered and active Legendary variant metadata retain the same promotion biography", () => {
  const registry = JSON.parse(readFileSync(new URL("../client/models/card-art-registry.json", import.meta.url), "utf8"));
  const manifest = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/manifest.json", import.meta.url), "utf8"));
  for (const id of promotedIds) {
    for (const source of [registry, manifest]) {
      const variant = source.parentVariants.find((card: { figureId: string; rarity: string }) => card.figureId === id && card.rarity === "legendary");
      assert.ok(variant, `${id}'s delivered Legendary variant`);
      assert.equal(variant.bodyText, promotions[id].biography);
    }
  }
});

test("portable Legendary templates render the promotion biography in both SVG overlays", () => {
  const root = new URL("../artwork/card-art-handoff-v1/", import.meta.url);
  const kit = JSON.parse(readFileSync(new URL("data/cards.json", root), "utf8"));
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const decode = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) =>
    entity.startsWith("#") ? String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === "x" ? 2 : 1), entity[1].toLowerCase() === "x" ? 16 : 10)) : entities[entity.toLowerCase()]);
  for (const id of promotedIds) {
    const variant = kit.parentVariants.find((card: { figureId: string; rarity: string }) => card.figureId === id && card.rarity === "legendary");
    assert.ok(variant, `${id}'s portable Legendary template`);
    const expected = promotions[id].biography;
    assert.equal(variant.bodyText, expected, `${id}'s portable biography`);
    assert.equal(variant.copy.bodyText, expected, `${id}'s renderer copy`);
    for (const path of [variant.overlaySvg, variant.footerlessOverlaySvg]) {
      const svg = readFileSync(new URL(path, root), "utf8");
      const match = svg.match(/<text\b[^>]*\bid="Biography_live"[^>]*>([\s\S]*?)<\/text>/);
      assert.ok(match, `${path} contains the live biography`);
      const rendered = decode(match[1].replace(/<[^>]+>/g, " "));
      assert.equal(normalize(rendered), normalize(expected), `${path} renders the promoted story`);
    }
  }
});
