import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { buildFigurePathWorld } from "../src/figures/world.ts";
import { createEngine } from "../src/engine.ts";
import { yearAtAge } from "../src/calendar.ts";
import type { AccomplishmentRecord, ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-deep-1.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: FigurePaths } = await import("../client/components/FigurePaths.tsx");
hooks.deregister();

function fixture(age = 18) {
  const world = buildFigurePathWorld(retained as unknown as WorldPack);
  const initial = createEngine(world).start("figure-ui-view");
  // These authored view records test rendering, not full-path mechanical reachability.
  const life = structuredClone(initial);
  life.age = age; life.year = yearAtAge(world.startYear, age); life.phase = "ready";
  life.character!.name = "The test reader";
  life.accomplishments = [];
  life.vocations!.capabilityWork ??= {};
  return { world, life };
}
function authoredRecord(world: WorldPack, life: LifeState, achievementId: string, age: number, failed = false): AccomplishmentRecord {
  const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
  assert.ok(definition, achievementId);
  const activity = world.character!.activities.find(activity => activity.outcomes.some(outcome =>
    (!failed || outcome.id.endsWith("-failed")) && outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId)))!;
  assert.ok(activity, "No authored awarding activity: " + achievementId);
  const outcome = activity.outcomes.find(outcome => (!failed || outcome.id.endsWith("-failed")) &&
    outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!;
  const record: AccomplishmentRecord = {
    id: achievementId + ":" + age, achievementId, routeId: definition.routeId, title: definition.title,
    description: definition.description, kind: definition.kind, name: definition.nameTemplate.replaceAll("{name}", life.character!.name!),
    age, year: yearAtAge(world.startYear, age), sourceId: activity.id, outcomeId: outcome.id, people: [...definition.people],
  };
  life.accomplishments!.push(record);
  return record;
}
function activities(world: WorldPack): ActivityAvailability[] {
  return world.character!.activities.map(activity => ({ ...activity, available: true }));
}
function render(world: WorldPack, life: LifeState, id = "alexander", readOnly = false) {
  return renderToStaticMarkup(createElement(FigurePaths, {
    world, life, activities: activities(world), onActivity: () => {}, initialFigureId: id, readOnly,
  }));
}

test("the figure roster renders all eleven figures without granting association or special titles from principal rarity", () => {
  const { world, life } = fixture();
  const html = render(world, life);
  const roster = html.match(/<nav class="figure-roster"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal((roster.match(/aria-pressed=/g) ?? []).length, 11);
  for (const path of world.figurePaths!) assert.ok(roster.includes(path.name), path.name);
  assert.match(html, /Figure · Legendary/);
  assert.match(html, /No contribution title yet/);
  assert.doesNotMatch(html, /Your earned title:/);
  assert.doesNotMatch(html, /Special title earned:/);
});

test("principal rank stays separate from an earned contributor rank", () => {
  const { world, life } = fixture(20);
  authoredRecord(world, life, "fig-aristotle-encounter", 18);
  authoredRecord(world, life, "fig-aristotle-uncommon", 19);
  const html = render(world, life, "aristotle");
  assert.match(html, /Legendary · Your contribution: Uncommon/);
  assert.match(html, /class="figure-contribution-rank">Uncommon/);
  assert.match(html, /Your earned title: <strong>Lyceum Copyist<\/strong>/);
  assert.doesNotMatch(html, /Special title earned:/);
});

test("Euclid's circle route never asserts a personal meeting", () => {
  const { world, life } = fixture(50);
  authoredRecord(world, life, "fig-euclid-encounter", 50);
  const html = render(world, life, "euclid");
  assert.match(html, /Through a teaching circle/);
  assert.match(html, /a personal meeting is not established by the historical evidence/);
  assert.doesNotMatch(html, /Personal encounter recorded/);
  assert.match(html, /300 BCE/);
});

test("a later-school contributor receives the tradition title", () => {
  const { world, life } = fixture(45);
  authoredRecord(world, life, "fig-aristotle-tradition", 30);
  authoredRecord(world, life, "fig-aristotle-uncommon", 31);
  authoredRecord(world, life, "fig-aristotle-rare", 33);
  const html = render(world, life, "aristotle");
  assert.match(html, /Through the later tradition/);
  assert.match(html, /Your earned title: <strong>Researcher in the Aristotelian Tradition<\/strong>/);
  assert.doesNotMatch(html, /Personal encounter recorded/);
  assert.doesNotMatch(html, /Your earned title: <strong>Lyceum Researcher/);
});

test("read-only figure views disable every game action while keeping roster browsing available", () => {
  const { world, life } = fixture();
  const html = render(world, life, "lysippos", true);
  const gameButtons = [...html.matchAll(/<div class="figure-action">[\s\S]*?<button\b([^>]*)>/g)];
  assert.ok(gameButtons.length >= 8);
  assert.ok(gameButtons.every(match => match[1].includes('disabled=""')));
  const roster = html.match(/<nav class="figure-roster"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal((roster.match(/disabled=/g) ?? []).length, 0);
  assert.doesNotMatch(html, /class="figure-supplies"/);
});

test("preparing a one-shot campaign shows its actual 75/25 outcomes", () => {
  const { world, life } = fixture();
  const html = render(world, life, "alexander");
  assert.match(html, /Possible outcomes · one attempt/);
  assert.match(html, /<strong>75%<\/strong>/);
  assert.match(html, /<strong>25%<\/strong>/);
  assert.match(html, /The operation fails to secure its decisive objective/);
  assert.match(html, /funded field operation secures its decisive objective/);
});

test("an unsuccessful Alexander operation shows the terminal result without offering a reroll", () => {
  const { world, life } = fixture(27);
  authoredRecord(world, life, "fig-alexander-encounter", 18);
  authoredRecord(world, life, "fig-alexander-uncommon", 19);
  authoredRecord(world, life, "fig-alexander-rare", 21);
  authoredRecord(world, life, "fig-alexander-epic", 24);
  authoredRecord(world, life, "fig-alexander-campaign-attempt", 26, true);
  const html = render(world, life, "alexander");
  assert.match(html, /Unsuccessful outcome recorded/);
  assert.match(html, /This attempt cannot be repeated/);
  assert.match(html, /Trusted Campaign Commander/);
  assert.doesNotMatch(html, /<button[^>]*>Resolve the decisive campaign operation/);
  assert.doesNotMatch(html, /Special title earned:/);
});

test("failed Rhodes promotion leaves the principal Epic and hides the resolution action", () => {
  const { world, life } = fixture(47);
  for (const [id, age] of [["encounter", 38], ["uncommon", 39], ["rare", 41], ["epic", 44], ["capstone", 46]] as const) authoredRecord(world, life, "fig-demetrius-" + id, age);
  authoredRecord(world, life, "fig-demetrius-promotion-attempt", 46, true);
  const html = render(world, life, "demetrius");
  assert.match(html, /Figure · Epic/);
  assert.match(html, /The figure remains Epic, and the attempt cannot be repeated/);
  assert.doesNotMatch(html, /<button[^>]*>Resolve the Rhodes assault/);
  assert.doesNotMatch(html, /Figure · Legendary/);
});

test("Lysippan project quotes expose actual bronze, fuel, fees and skill gains", () => {
  const { world, life } = fixture();
  life.vocations!.inventory.bronze = 7;
  life.vocations!.inventory.fuel = 6;
  const html = render(world, life, "lysippos");
  assert.match(html, /3 bronze \(have 7\)/);
  assert.match(html, /2 fuel \(have 6\)/);
  assert.match(html, /8 bronze \(have 7\)/);
  assert.match(html, /One work year · fee 8 /);
  assert.match(html, /Sculpture \+3/);
  assert.match(html, /Tool handling \+2/);
  assert.match(html, /Buy 4 bronze units for the workshop/);
});

test("retained worlds without figure metadata render no new progression panel", () => {
  const world = retained as unknown as WorldPack;
  const life = createEngine(world).start("retained-figure-panel");
  assert.equal(render(world, life), "");
});


test("conditional principals advertise Epic–Legendary while retaining the actual current rank", () => {
  const { world, life } = fixture();
  const html = render(world, life, "demetrius");
  const roster = html.match(/<nav class="figure-roster"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.equal((roster.match(/Epic–Legendary/g) ?? []).length, 3);
  assert.match(html, /Figure · Epic–Legendary · Current: Epic/);
  assert.doesNotMatch(html, /Special title earned:/);
  assert.match(html, /Press to preview/);
  const fixed = render(world, life, "pytheas");
  assert.match(fixed, /Figure · Epic<\/p>/);
});
