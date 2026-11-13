import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { FIGURE_ROSTER, figureRosterEntry } from "../chain/catalog/figure-roster.ts";
import type { FigureCardRank } from "../chain/catalog/figure-roster.ts";
import { findCardArt, cardArtRank } from "../client/models/card-art.ts";
import { createEngine } from "../src/engine.ts";
import type { AccomplishmentRecord, LifeState, WorldPack } from "../src/types.ts";
import { yearAtAge } from "../src/calendar.ts";
import current from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: HistoricalFigureCard, displayedFigureCardRank } = await import("../client/components/HistoricalFigureCard.tsx");
const { default: FigureCardViewer } = await import("../client/components/FigureCardViewer.tsx");
hooks.deregister();
const figure = (id: string) => { const entry = figureRosterEntry(id); assert.ok(entry, id); return entry; };
const renderCard = (id: string, rank?: FigureCardRank, mode: "principal" | "contribution" = "principal") => renderToStaticMarkup(createElement(HistoricalFigureCard, { figure: figure(id), rank, mode }));
const renderViewer = (id: string, rank?: FigureCardRank, mode: "principal" | "contribution" = "principal") => renderToStaticMarkup(createElement(FigureCardViewer, { figure: figure(id), initialRank: rank, mode, onClose: () => {} }));

test("all eleven figure cards render a portrait, readable identity and their allowed principal rank", () => {
  assert.equal(FIGURE_ROSTER.length, 11);
  for (const entry of FIGURE_ROSTER) {
    const html = renderCard(entry.id);
    assert.match(html, new RegExp('data-figure-card="' + entry.id + '"'));
    assert.match(html, new RegExp('data-rarity="' + entry.baseRank.toLowerCase() + '"'));
    assert.ok(html.includes(entry.name));
    assert.ok(html.includes(findCardArt({ figureId: entry.id, kind: "parent", tier: cardArtRank(entry.baseRank) })!.footerlessSrc));
    assert.ok(!html.includes(entry.art.src), "legacy sprite must not replace approved card art");
    assert.ok(html.includes(entry.archetype));
    assert.equal((html.match(/<img /g) ?? []).length, 1);
    assert.equal((html.match(/<button /g) ?? []).length, 0);
  }
});

test("approved artwork replaces all seven legacy placeholder portraits", () => {
  const temporary = FIGURE_ROSTER.filter(entry => entry.art.placeholder);
  assert.equal(temporary.length, 7);
  for (const entry of temporary) {
    assert.doesNotMatch(renderCard(entry.id), /Placeholder art/);
    assert.match(renderCard(entry.id), /collection-card-art-image/);
  }
  assert.doesNotMatch(renderCard("alexander"), /Placeholder art/);
});

test("a static card has no ownership or upgrade action; its inspect trigger is one keyboard button", () => {
  const html = renderToStaticMarkup(createElement(HistoricalFigureCard, { figure: figure("menander"), onInspect: () => { throw new Error("Rendering must not inspect or grant a card"); } }));
  assert.equal((html.match(/<button /g) ?? []).length, 1);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-label="Inspect Menander/);
  assert.match(html, /figure-tcg-inspect/);
  assert.doesNotMatch(html, /Mint|Buy|Earned in this life/);
});

test("a requested principal grade cannot invent a Legendary Pytheas or a Rare Alexander", () => {
  assert.equal(displayedFigureCardRank(figure("pytheas"), "Legendary"), "Epic");
  assert.equal(displayedFigureCardRank(figure("alexander"), "Rare"), "Legendary");
  assert.match(renderCard("pytheas", "Legendary"), /data-rarity="epic"/);
  assert.doesNotMatch(renderCard("pytheas", "Legendary"), /data-rarity="legendary"/);
});

test("contribution cards include Common through Epic and cannot become Legendary", () => {
  for (const rank of ["Common", "Uncommon", "Rare", "Epic"] as const) {
    const html = renderCard("aristotle", rank, "contribution");
    assert.match(html, new RegExp('data-rarity="' + rank.toLowerCase() + '"'));
    assert.match(html, /Contribution/);
    assert.ok(html.includes(findCardArt({ figureId: "aristotle", kind: "contribution", tier: cardArtRank(rank) })!.footerlessSrc));
  }
  assert.equal(displayedFigureCardRank(figure("aristotle"), "Legendary", "contribution"), "Common");
});

test("contributor faces use their recorded gender and never invent an issued edition", () => {
  for (const gender of ["male", "female"] as const) {
    const html = renderToStaticMarkup(createElement(HistoricalFigureCard, { figure: figure("alexander"), mode: "contribution", rank: "Common", gender }));
    assert.ok(html.includes(findCardArt({ figureId: "alexander", kind: "contribution", tier: "common", gender })!.footerlessSrc));
    assert.match(html, /Edition —\/∞/);
    assert.doesNotMatch(html, /figure-tcg-architecture|alexander-front\.png/);
  }
});

test("the viewer is a labelled native modal with close controls and no mint action", () => {
  const html = renderViewer("demetrius");
  assert.match(html, /<dialog /);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby=/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /aria-label="Close card preview"/);
  assert.match(html, /Back to the collection/);
  assert.match(html, /Catalogue preview/);
  assert.doesNotMatch(html, />Mint|>Buy/);
});

test("only genuinely multi-rarity principals receive rarity variant controls", () => {
  for (const id of ["demetrius", "ptolemy", "zeno"]) {
    const html = renderViewer(id);
    assert.match(html, /Preview rarity variant/);
    assert.match(html, /data-rarity="epic"/);
    assert.match(html, /data-rarity="legendary"/);
    assert.match(html, /Previewing a variant changes this view only/);
  }
  assert.doesNotMatch(renderViewer("pytheas"), /Preview rarity variant/);
  assert.doesNotMatch(renderViewer("alexander"), /Preview rarity variant/);
});

test("a contribution preview exposes Common Uncommon Rare Epic without altering the principal rarity", () => {
  const html = renderViewer("aristotle", "Rare", "contribution");
  assert.match(html, /Contributor card · Rare/);
  assert.match(html, /data-rarity="common"/);
  assert.match(html, /data-rarity="uncommon"/);
  assert.match(html, /data-rarity="rare"/);
  assert.match(html, /data-rarity="epic"/);
  assert.doesNotMatch(html, /data-rarity="legendary"/);
  assert.match(html, /Complete and record the Rare contribution projects for Aristotle/);
});

test("a new life sees proof requirements rather than a free earned variant", () => {
  const world = current as unknown as WorldPack;
  const life = createEngine(world).start("tcg-inspection-no-free-card");
  const before = JSON.stringify(life);
  const html = renderToStaticMarkup(createElement(FigureCardViewer, { figure: figure("ptolemy"), initialRank: "Legendary", onClose: () => {}, world, life }));
  assert.match(html, /Preview · Not earned in this life/);
  assert.match(html, /Requires proof/);
  assert.equal(JSON.stringify(life), before);
  assert.doesNotMatch(html, />Earned in this life</);
});

test("an upgrade control renders the supplied real-action availability without activating it", () => {
  let activated = false;
  const html = renderToStaticMarkup(createElement(FigureCardViewer, {
    figure: figure("menander"), mode: "contribution", onClose: () => {},
    upgradeAction: { label: "Record Rare contribution", enabled: false, reason: "Complete two work years first.", onActivate() { activated = true; } },
  }));
  assert.match(html, /Next earned upgrade/);
  assert.match(html, /disabled=""[^>]*>Record Rare contribution/);
  assert.match(html, /Complete two work years first/);
  assert.equal(activated, false);
});

test("a closed viewer adds no dialog, backdrop or game control to the document", () => {
  assert.equal(renderToStaticMarkup(createElement(FigureCardViewer, { figure: null, onClose: () => {} })), "");
});

test("the card finish preserves motion alternatives, responsive sizing and non-colour rarity cues", () => {
  const css = readFileSync(new URL("../client/styles/figure-cards.css", import.meta.url), "utf8") + readFileSync(new URL("../client/styles/figure-card-viewer.css", import.meta.url), "utf8");
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /animation:none/);
  assert.match(css, /@keyframes figure-card-pop-in/);
  assert.match(css, /100dvh/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /figure-tcg-card--rare[^}]*border-style:double/);
  assert.match(css, /figure-tcg-card--legendary:before/);
});


test("a contribution preview derives the selected grade's truthful tradition title from the actual path", () => {
  const world = structuredClone(current) as unknown as WorldPack;
  delete world.birthYears;
  const life = structuredClone(createEngine(world).start("card-tradition-grade"));
  life.age = 45; life.year = yearAtAge(life.birthYear ?? world.startYear, life.age); life.phase = "ready";
  const path = world.figurePaths!.find(path => path.id === "aristotle")!;
  function record(achievementId: string, age: number) {
    const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
    const source = world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId)))!;
    const outcome = source.outcomes.find(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!;
    // Authored view records isolate rendering; mechanical reachability is tested by the path suites.
    const entry: AccomplishmentRecord = { id: achievementId + ":" + age, achievementId, routeId: definition.routeId, title: definition.title, description: definition.description, kind: definition.kind, name: definition.nameTemplate, age, year: yearAtAge(life.birthYear ?? world.startYear, age), sourceId: source.id, outcomeId: outcome.id, people: [] };
    life.accomplishments!.push(entry);
  }
  record(path.tradition!.achievementId, 30);
  record(path.stages[0].achievementId, 31);
  record(path.stages[1].achievementId, 33);
  const html = renderToStaticMarkup(createElement(FigureCardViewer, {
    figure: figure("aristotle"), mode: "contribution", initialRank: "Rare", world, life, onClose: () => {},
    contributionTitle: "This initial title must not override the selected grade",
  }));
  assert.ok(html.includes(path.stages[1].traditionTitle));
  assert.doesNotMatch(html, /This initial title must not override/);
  assert.match(html, />Earned in this life</);
  assert.ok(html.includes(path.stages[1].description));
  const unlock = html.match(/data-requirement-id="unlock"[\s\S]*?<\/li>/)?.[0] ?? "";
  assert.match(unlock, /type="checkbox"[^>]*disabled=""[^>]*checked=""/);
  assert.match(html, /Complete 2 qualifying work years/);
  assert.match(html, /Record the accepted Rare contribution title/);
  assert.ok(!html.includes('class="figure-tcg-title">' + path.stages[1].title + "</span>"));
});


test("the floating inspector groups legal variant cards beside a separately scrollable details region", () => {
  const html = renderViewer("demetrius");
  assert.match(html, /aria-label="Rarity card stack"/);
  assert.match(html, /aria-roledescription="carousel"/);
  assert.equal((html.match(/class="figure-card-stack-item/g) ?? []).length, 2);
  assert.match(html, /data-stack-slot="0" data-stack-side="active" data-variant-rank="Epic"/);
  assert.match(html, /data-stack-slot="1" data-stack-side="right" data-variant-rank="Legendary"/);
  assert.match(html, /aria-label="Preview Legendary variant"/);
  assert.match(html, /aria-label="Previous rarity variant"/);
  assert.match(html, /aria-label="Next rarity variant"/);
  assert.match(html, /aria-label="Figure details" tabindex="0"/);
});

test("contributor decks expose all four legal versions and single-rarity figures need no carousel controls", () => {
  const html = renderViewer("aristotle", "Rare", "contribution");
  assert.equal((html.match(/class="figure-card-stack-item/g) ?? []).length, 4);
  assert.match(html, /data-stack-slot="0" data-stack-side="active" data-variant-rank="Rare"/);
  assert.match(html, /data-stack-slot="1" data-stack-side="right" data-variant-rank="Epic"/);
  assert.match(html, /data-stack-slot="-1" data-stack-side="left" data-variant-rank="Uncommon"/);
  assert.match(html, /data-stack-slot="-2" data-stack-side="left" data-variant-rank="Common"/);
  assert.doesNotMatch(html, /Preview Legendary variant/);
  const fixed = renderViewer("pytheas");
  assert.equal((fixed.match(/class="figure-card-stack-item/g) ?? []).length, 1);
  assert.doesNotMatch(fixed, /aria-label="Next rarity variant"|aria-label="Previous rarity variant"/);
});


test("rarity navigation marks the ordered first and last boundaries", () => {
  const first = renderViewer("aristotle", "Common", "contribution");
  assert.match(first, /aria-label="Previous rarity variant" disabled=""/);
  assert.match(first, /aria-label="Next rarity variant">/);
  const middle = renderViewer("aristotle", "Rare", "contribution");
  assert.match(middle, /aria-label="Previous rarity variant">/);
  assert.match(middle, /aria-label="Next rarity variant">/);
  const last = renderViewer("aristotle", "Epic", "contribution");
  assert.match(last, /aria-label="Next rarity variant" disabled=""/);
  assert.match(last, /aria-label="Previous rarity variant">/);
});


test("every principal preview shows its figure-specific unlock line without initial change markers", () => {
  for (const entry of FIGURE_ROSTER) {
    for (const variant of entry.variants) {
      const html = renderViewer(entry.id, variant.rank);
      assert.match(html, /Unlock requirements for this rarity/);
      assert.match(html, /figure-card-requirement-list/);
      assert.doesNotMatch(html, /data-requirement-change=/);
    }
  }
  const dynasty = renderViewer("ptolemy", "Legendary");
  assert.match(dynasty, /<strong[^>]*>Found the Ptolemaic dynasty<\/strong>/);
  assert.match(dynasty, /working succession settlement/);
});

test("contributor previews show full authored project requirements even without a life", () => {
  const world = current as unknown as WorldPack;
  const path = world.figurePaths!.find(path => path.id === "aristotle")!;
  const html = renderToStaticMarkup(createElement(FigureCardViewer, { figure: figure("aristotle"), initialRank: "Rare", mode: "contribution", world, onClose: () => {} }));
  assert.ok(html.includes(path.stages[1].description));
  assert.match(html, /Complete 2 qualifying work years/);
  assert.match(html, /Record the accepted Rare contribution title/);
});


test("catalogue requirements are read-only checkboxes with labels and no premature completion", () => {
  const html = renderViewer("ptolemy", "Legendary");
  const checklist = html.match(/<ul class="figure-card-requirement-list">[\s\S]*?<\/ul>/)?.[0] ?? "";
  const checkboxes = checklist.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
  assert.ok(checkboxes.length >= 3);
  for (const checkbox of checkboxes) {
    assert.match(checkbox, /disabled=""/);
    assert.match(checkbox, /aria-labelledby=/);
    assert.doesNotMatch(checkbox, / checked=/);
  }
  assert.doesNotMatch(checklist, /figure-card-requirement-dot|figure-card-requirement-notification/);
});


test("all fixed Legendary figures open a four-rarity contribution fan at Common without lowering the principal", () => {
  for (const id of ["alexander", "aristotle", "euclid", "lysippos", "menander"]) {
    const entry = figure(id), before = JSON.stringify(entry);
    const html = renderViewer(id, undefined, "contribution");
    assert.match(html, /Contributor card · Common/);
    assert.match(html, /data-variant-count="4"/);
    assert.match(html, /data-stack-slot="0" data-stack-side="active" data-variant-rank="Common"/);
    assert.match(html, /data-stack-slot="1" data-stack-side="right" data-variant-rank="Uncommon"/);
    assert.match(html, /data-stack-slot="2" data-stack-side="right" data-variant-rank="Rare"/);
    assert.match(html, /data-stack-slot="3" data-stack-side="right" data-variant-rank="Epic"/);
    assert.doesNotMatch(html, /data-variant-rank="Legendary"/);
    assert.match(renderViewer(id), /Historical figure card · Legendary/);
    assert.equal(JSON.stringify(entry), before);
  }
});
