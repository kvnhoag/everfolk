import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { FIGURE_ROSTER, figureRosterEntry } from "../chain/catalog/figure-roster.ts";
import type { FigureCardRank } from "../chain/catalog/figure-roster.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: FigureCardStack } = await import("../client/components/FigureCardStack.tsx");
hooks.deregister();
const figure = (id: string) => { const entry = figureRosterEntry(id); assert.ok(entry); return entry; };
const render = (id: string, rank?: FigureCardRank, recorded = false) => renderToStaticMarkup(createElement(FigureCardStack, { figure: figure(id), rank, recorded, onInspect() { throw new Error("Only pressing preview may inspect a card"); } }));

test("unopened multi-rarity cards show both legal frames, a range and one explicit preview target", () => {
  const html = render("demetrius");
  assert.match(html, /Epic–Legendary/);
  assert.match(html, />2 rarities</);
  assert.equal((html.match(/class="figure-preview-layer/g) ?? []).length, 2);
  assert.match(html, /data-preview-rank="Epic" data-preview-slot="0"/);
  assert.match(html, /data-preview-rank="Legendary" data-preview-slot="1"/);
  assert.match(html, /Press to preview/);
  assert.equal((html.match(/<button /g) ?? []).length, 1);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Inspect Demetrius the Besieger: Epic card/);
  assert.match(html, /class="figure-preview-stage" aria-hidden="true"/);
  assert.doesNotMatch(html, /<dialog|>Mint|>Buy/);
});

test("fixed rarity cards keep a preview cue without advertising unsupported variants", () => {
  const epic = render("pytheas", "Legendary");
  assert.equal((epic.match(/class="figure-preview-layer/g) ?? []).length, 1);
  assert.match(epic, /data-current-rarity="Epic"/);
  assert.match(epic, />1 rarity</);
  assert.doesNotMatch(epic, /Legendary/);
  const legendary = render("alexander", "Rare");
  assert.equal((legendary.match(/class="figure-preview-layer/g) ?? []).length, 1);
  assert.match(legendary, /data-current-rarity="Legendary"/);
  assert.match(legendary, /Press to preview/);
});

test("contribution stacks keep ascending left and right versions around the actual title", () => {
  const html = renderToStaticMarkup(createElement(FigureCardStack, { figure: figure("aristotle"), mode: "contribution", rank: "Rare", title: "Lyceum Researcher", onInspect() {} }));
  assert.match(html, /Common–Epic/);
  assert.equal((html.match(/class="figure-preview-layer/g) ?? []).length, 4);
  assert.match(html, /data-preview-rank="Common" data-preview-slot="-2"/);
  assert.match(html, /data-preview-rank="Uncommon" data-preview-slot="-1"/);
  assert.match(html, /data-preview-rank="Rare" data-preview-slot="0"/);
  assert.match(html, /data-preview-rank="Epic" data-preview-slot="1"/);
  assert.match(html, /aria-label="Lyceum Researcher, Rare contribution card"/);
  assert.match(html, /data-card-art="aristotle-rare-male"/);
  assert.match(html, /aria-label="Inspect Aristotle: Rare contribution card/);
  assert.doesNotMatch(html, /Legendary/);
});

test("saved cards retain their recorded rank while other stacked versions remain previews", () => {
  const html = render("ptolemy", "Epic", true);
  assert.match(html, /data-current-rarity="Epic"/);
  assert.match(html, /Recorded: <strong>Epic<\/strong>/);
  assert.match(html, /Other versions are previews/);
  assert.match(html, /Available variants: Epic–Legendary\. Recorded rank: Epic\./);
  assert.match(html, /data-preview-rank="Legendary" data-preview-slot="1"/);
  assert.doesNotMatch(html, /Recorded: <strong>Legendary|Earned in this life/);
});

test("all eleven closed stacks preserve immutable roster entries and actual selected ranks", () => {
  for (const entry of FIGURE_ROSTER) {
    const before = JSON.stringify(entry);
    const html = render(entry.id);
    assert.match(html, new RegExp('data-figure-stack="' + entry.id + '"'));
    assert.match(html, new RegExp('data-current-rarity="' + entry.baseRank + '"'));
    assert.equal((html.match(/<button /g) ?? []).length, 1);
    assert.equal(JSON.stringify(entry), before);
  }
});
