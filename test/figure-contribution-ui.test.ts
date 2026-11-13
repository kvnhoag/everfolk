import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/engine.ts";
import { yearAtAge } from "../src/calendar.ts";
import { buildContributionTierWorld } from "../src/figures/contribution-world.ts";
import { getFigurePathProgress } from "../src/figures/progress.ts";
import { figureRosterEntry } from "../chain/catalog/figure-roster.ts";
import { contributionCardRanks } from "../client/models/figure-contribution-ranks.ts";
import { legacyFigureCard } from "../client/models/legacy-figure-card.ts";
import type { LegacyEntry } from "../client/storage/legacy-store.ts";
import type { AccomplishmentRecord, WorldPack } from "../src/types.ts";
import type { FigureCardRank } from "../chain/catalog/figure-roster.ts";
import currentCommon from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import base from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: HistoricalFigureCard, displayedFigureCardRank } = await import("../client/components/HistoricalFigureCard.tsx");
const { default: FigureCardStack } = await import("../client/components/FigureCardStack.tsx");
const { default: FigureCardViewer } = await import("../client/components/FigureCardViewer.tsx");
const { default: FigurePaths } = await import("../client/components/FigurePaths.tsx");
hooks.deregister();
const figure = (id: string) => figureRosterEntry(id)!;

function fixture(id = "demetrius", retained = false) {
  const world = retained ? structuredClone(base) as unknown as WorldPack : buildContributionTierWorld(base as unknown as WorldPack);
  // Authored records isolate UI/provenance; full command reachability is tested by the engine suites.
  delete world.birthYears;
  const life = structuredClone(createEngine(world).start("contribution-card-ui"));
  life.age = 90; life.year = yearAtAge(world.startYear, 90); life.phase = "ready";
  const path = world.figurePaths!.find(path => path.id === id)!;
  const start = Math.max(18, path.encounter.fromYear - world.startYear);
  const promotionAge = Math.max(start + 7, 46);
  function add(achievementId: string, activityId: string, age: number) {
    const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
    const activity = world.character!.activities.find(item => item.id === activityId)!;
    const outcome = activity.outcomes.find(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!;
    const record: AccomplishmentRecord = { id: achievementId + ":" + age, achievementId, routeId: definition.routeId, sourceId: activityId, outcomeId: outcome.id,
      title: definition.title, name: definition.nameTemplate, description: definition.description, kind: definition.kind, people: [], age, year: yearAtAge(world.startYear, age) };
    life.accomplishments!.push(record); return record;
  }
  function senior() {
    add(path.encounter.achievementId, path.encounter.activityId, start);
    return path.stages.map((stage, index) => add(stage.achievementId, stage.activityId, start + index + 1));
  }
  function promote() {
    add(path.capstone.achievementId, path.capstone.activityId, start + 6);
    return add(path.promotion!.achievementId, path.promotion!.activityId, promotionAge);
  }
  const entry = (record: AccomplishmentRecord): LegacyEntry => ({ key: record.id, lifeKey: "fixture", worldId: life.worldId, worldVersion: life.worldVersion,
    worldFingerprint: life.worldFingerprint, seed: life.seed, worldTitle: world.title, characterName: "Dion", accomplishment: record });
  const progress = () => getFigurePathProgress(world, path, life);
  const viewer = (rank: FigureCardRank) => renderToStaticMarkup(createElement(FigureCardViewer, { figure: figure(id), initialRank: rank, mode: "contribution", world, life, onClose() {} }));
  return { world, life, path, start, promotionAge, add, senior, promote, progress, entry, viewer };
}

test("catalogue contributions begin at Common and stay below their principal figure rarity", () => {
  for (const id of ["pytheas", "theophrastus", "cleomenes", "demetrius", "ptolemy", "zeno"]) {
    assert.deepEqual(contributionCardRanks(figure(id)), ["Common", "Uncommon", "Rare"]);
    assert.equal(displayedFigureCardRank(figure(id), undefined, "contribution"), "Common");
    const html = renderToStaticMarkup(createElement(FigureCardStack, { figure: figure(id), mode: "contribution", onInspect() {} }));
    assert.match(html, /Common–Rare/); assert.match(html, /data-current-rarity="Common"/);
    assert.doesNotMatch(html, /data-preview-rank="Epic"|data-preview-rank="Legendary"/);
  }
  for (const id of ["alexander", "aristotle", "euclid", "lysippos", "menander"]) {
    assert.deepEqual(contributionCardRanks(figure(id)), ["Common", "Uncommon", "Rare", "Epic"]);
    assert.equal(displayedFigureCardRank(figure(id), undefined, "contribution"), "Common");
    const stack = renderToStaticMarkup(createElement(FigureCardStack, { figure: figure(id), mode: "contribution", onInspect() {} }));
    assert.match(stack, /Common–Epic/);
    assert.match(stack, /data-current-rarity="Common"/);
    assert.equal((stack.match(/class="figure-preview-layer/g) ?? []).length, 4);
    assert.equal(displayedFigureCardRank(figure(id), "Common", "principal"), "Legendary");
  }
  const common = renderToStaticMarkup(createElement(HistoricalFigureCard, { figure: figure("pytheas"), mode: "contribution", rank: "Common" }));
  assert.match(common, /figure-tcg-card--common/); assert.match(common, />Common</);
  assert.equal(displayedFigureCardRank(figure("pytheas"), "Common", "principal"), "Epic");
});

test("new-world frame, stack and viewer share the exact Common/Uncommon/Rare contribution grades", () => {
  const f = fixture("theophrastus"), ranks = contributionCardRanks(figure("theophrastus"), f.progress());
  assert.deepEqual(ranks, ["Common", "Uncommon", "Rare"]);
  const html = f.viewer("Epic");
  assert.match(html, /Contributor card · Common/);
  assert.match(html, /data-variant-rank="Common"/);
  assert.match(html, /Contributions are capped at Rare while this figure is Epic/);
  assert.doesNotMatch(html, /data-variant-rank="Epic"|data-variant-rank="Legendary"/);
  assert.ok(html.includes(f.path.stages[0].title));
});

test("retained Epic contribution records and their stack/viewer grade stay Epic", () => {
  const f = fixture("pytheas", true), records = f.senior(), progress = f.progress();
  const ranks = contributionCardRanks(figure("pytheas"), progress);
  assert.deepEqual(ranks, ["Uncommon", "Rare", "Epic"]);
  const card = legacyFigureCard(f.entry(records[2]), f.world, f.life)!;
  assert.equal(card.rank, "Epic"); assert.deepEqual(card.contributionRanks, ranks);
  const stack = renderToStaticMarkup(createElement(FigureCardStack, { figure: card.figure, rank: card.rank, mode: card.mode, contributionRanks: card.contributionRanks, recorded: true, onInspect() {} }));
  assert.match(stack, /Recorded: <strong>Epic<\/strong>/);
  assert.match(f.viewer("Epic"), /Contributor card · Epic/);
  assert.match(f.viewer("Epic"), /Earned in this life/);
});

test("conditional Epic contribution appears only after true principal promotion and remains unearned until a separate claim", () => {
  const f = fixture(); f.senior();
  f.life.flags["rhodes-captured"] = true;
  assert.deepEqual(contributionCardRanks(figure("demetrius"), f.progress()), ["Common", "Uncommon", "Rare"]);
  f.promote();
  assert.deepEqual(contributionCardRanks(figure("demetrius"), f.progress()), ["Common", "Uncommon", "Rare", "Epic"]);
  assert.equal(f.progress().associationRank, "Rare");
  const html = f.viewer("Epic");
  assert.match(html, /Contributor card · Epic/); assert.match(html, /Preview · Not earned in this life/);
  assert.match(html, /data-variant-count="4"/);
  assert.ok(html.includes(f.path.legendaryContribution!.title));
  assert.doesNotMatch(html, />Earned in this life</);
});

test("the separate Epic recognition is recorded without relabelling the earlier Rare contribution", () => {
  const f = fixture(), records = f.senior(); f.promote();
  const recognition = f.path.legendaryContribution!;
  const record = f.add(recognition.achievementId, recognition.activityId, f.promotionAge + 1);
  assert.equal(f.progress().associationRank, "Epic");
  assert.equal(legacyFigureCard(f.entry(records[2]), f.world, f.life)!.rank, "Rare");
  const card = legacyFigureCard(f.entry(record), f.world, f.life)!;
  assert.equal(card.rank, "Epic"); assert.equal(card.mode, "contribution"); assert.equal(card.title, recognition.title);
  assert.match(f.viewer("Epic"), />Earned in this life</);
});

test("the path exposes the Epic claim separately after Legendary promotion, using the real claim activity", () => {
  const f = fixture(); f.senior();
  const render = () => renderToStaticMarkup(createElement(FigurePaths, { world: f.world, life: f.life, initialFigureId: "demetrius",
    activities: f.world.character!.activities.map(activity => ({ ...activity, available: activity.id === f.path.legendaryContribution!.activityId })), onActivity() { throw new Error("Rendering must never claim"); } }));
  assert.doesNotMatch(render(), /aria-label="Legendary contribution recognition"/);
  f.promote();
  const html = render();
  assert.match(html, /aria-label="Legendary contribution recognition"/);
  assert.match(html, />Record Epic contribution title<\/button>/);
  assert.match(html, /Common–Epic/);
});


test("readable Common titles agree across paths, cards and requirements without rewriting the saved world", () => {
  const world = currentCommon as unknown as WorldPack;
  const life = createEngine(world).start("clear-common-titles");
  const beforeWorld = JSON.stringify(world), beforeLife = JSON.stringify(life);
  for (const [id, title, oldTitle] of [
    ["alexander", "Army Supply Assistant", "Campaign Stores Aide"],
    ["aristotle", "Student of the Lyceum", "Inquiry Note Keeper"],
    ["euclid", "Geometry Assistant", "Diagram Aide"],
    ["lysippos", "Workshop Assistant", "Bronze Workshop Aide"],
    ["menander", "Rehearsal Assistant", "Rehearsal Aide"],
  ]) {
    const pathHtml = renderToStaticMarkup(createElement(FigurePaths, { world, life, activities: [], onActivity() {}, initialFigureId: id }));
    const cardHtml = renderToStaticMarkup(createElement(FigureCardViewer, { figure: figure(id), mode: "contribution", initialRank: "Common", world, life, onClose() {} }));
    for (const html of [pathHtml, cardHtml]) {
      assert.ok(html.includes(title), id);
      assert.ok(!html.includes(oldTitle), id);
    }
  }
  for (const path of world.figurePaths!.filter(path => path.baseRank === "Epic")) {
    const common = getFigurePathProgress(world, path, life).stages[0].definition;
    assert.equal(common.title, path.stages[0].title, path.id + " retains its existing Common title");
    assert.equal(common.traditionTitle, path.stages[0].traditionTitle);
  }
  assert.equal(JSON.stringify(world), beforeWorld);
  assert.equal(JSON.stringify(life), beforeLife);
  assert.deepEqual(createEngine(world).load(createEngine(world).save(life)), life);
});
