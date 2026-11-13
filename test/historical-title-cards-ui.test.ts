import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEngine } from "../src/index.ts";
import type { AccomplishmentRecord, LegacyAchievementDefinition, WorldPack } from "../src/types.ts";
import { collectLegacyEntries } from "../client/storage/legacy-store.ts";
import { applyHistoricalTitles } from "../scripts/alexandria-historical-titles.mjs";
import baseline from "../worlds/alexandria-0.44.0.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: HistoricalTitlePaths, buildHistoricalTitlePaths } = await import("../client/components/HistoricalTitlePaths.tsx");
const { default: LegacyGallery } = await import("../client/components/LegacyGallery.tsx");
hooks.deregister();

function fixture() {
  const world = structuredClone(baseline) as WorldPack;
  const life = structuredClone(createEngine(world).start("historical-card-ui"));
  life.age = 23; life.year = -327; life.phase = "ready"; life.pendingEventId = null;
  life.character!.skills.oratory = 35;
  const definition = (id: string, title: string, kind: "ordinary" | "prestige", figure?: { id: string; name: string }): LegacyAchievementDefinition => ({
    id, routeId: "military", title, kind, nameTemplate: `{name}, ${title}`, description: `Completed work for ${figure?.name ?? "a local household"}.`,
    people: [figure?.name ?? "Damon"], ...(figure ? { figure } : {}), evidence: "fictional",
  });
  world.legacy!.achievements = [
    definition("alexander-duty", "A checked dispatch", "ordinary", { id: "alexander", name: "Alexander" }),
    definition("right-hand-of-alexander", "Right Hand of Alexander", "prestige", { id: "alexander", name: "Alexander" }),
    definition("disciple-of-aristotle", "Disciple of Aristotle", "prestige", { id: "aristotle", name: "Aristotle" }),
    definition("local-work", "A local commission", "ordinary"),
  ];
  world.events = world.legacy!.achievements.filter(item => item.figure).map((achievement, index) => ({
    id: `event-${achievement.id}`, title: `An invitation from ${achievement.figure!.name}`, text: "A messenger brings a request.", trigger: { type: "year" as const, at: -332 }, maxOccurrences: 1,
    when: { type: "all" as const, conditions: [
      { type: "year" as const, op: "gte" as const, value: -332 }, { type: "year" as const, op: "lte" as const, value: index === 2 ? -324 : -323 },
      { type: "skill" as const, skill: "oratory", op: "gte" as const, value: 30 },
      ...(index === 1 ? [{ type: "accomplishment" as const, achievement: "alexander-duty", minYears: 1 }] : []),
    ] },
    choices: [{ id: `accept-${achievement.id}`, text: "Accept the request", outcomes: [{ id: `accepted-${achievement.id}`, text: `${achievement.figure!.name} confirms the work.`, weight: 1, effects: [{ type: "accomplishment" as const, achievement: achievement.id }] }] }],
  }));
  const record = (id: string): AccomplishmentRecord => {
    const item = world.legacy!.achievements.find(item => item.id === id)!;
    return { id: `${id}:22`, achievementId: id, routeId: item.routeId, title: item.title, description: item.description, kind: item.kind,
      name: item.nameTemplate.replace("{name}", "Damon"), age: 22, year: -328, sourceId: `event-${id}`, outcomeId: `accepted-${id}`, people: [...item.people], ...(item.figure ? { figure: { ...item.figure } } : {}) };
  };
  return { world, life, record };
}

test("historical paths show exact event prerequisites and distinguish open, collected and expired contacts without mutation", () => {
  const { world, life, record } = fixture();
  life.accomplishments = [record("alexander-duty")];
  life.phase = "choice"; life.pendingEventId = "event-right-hand-of-alexander";
  life.eventCounts[life.pendingEventId] = 1;
  const before = JSON.stringify({ world, life });
  const paths = buildHistoricalTitlePaths(world, life);
  assert.equal(paths.length, 2);
  assert.equal(paths[0].stages[0].state, "earned");
  assert.equal(paths[0].stages[1].state, "offered");
  assert.ok(paths[0].stages[1].requirements.some(requirement => requirement.text.includes("1+ years earlier") && requirement.met));
  const open = renderToStaticMarkup(createElement(HistoricalTitlePaths, { world, life }));
  assert.match(open, /Historical figure cards/);
  assert.match(open, /Right Hand of Alexander/);
  assert.match(open, /Continue the open life event/);
  assert.equal(JSON.stringify({ world, life }), before);

  const later = { ...life, age: 29, year: -321, phase: "ready" as const, pendingEventId: null };
  const expired = buildHistoricalTitlePaths(world, later);
  assert.equal(expired[0].stages[0].state, "earned");
  assert.equal(expired[0].stages[1].state, "closed");
  assert.equal(expired[1].stages[0].state, "closed");
  const closed = renderToStaticMarkup(createElement(HistoricalTitlePaths, { world, life: later }));
  assert.match(closed, /Contact window closed/);
  assert.doesNotMatch(closed, /Eligible for a visit|Event open now/);
});

test("collection preserves historical figure attribution alongside older cards and offers a figure filter", () => {
  const { world, life, record } = fixture();
  life.accomplishments = [record("alexander-duty"), record("right-hand-of-alexander"), record("disciple-of-aristotle"), record("local-work")];
  const entries = collectLegacyEntries(world, life, []);
  const html = renderToStaticMarkup(createElement(LegacyGallery, { entries, currentLifeKey: entries[0].lifeKey }));
  assert.match(html, /Historical figure/);
  assert.match(html, /<option value="alexander">Alexander<\/option>/);
  assert.match(html, /<option value="aristotle">Aristotle<\/option>/);
  assert.equal((html.match(/>Title sub-card<\/span>/g) ?? []).length, 2);
  assert.equal((html.match(/>Milestone sub-card<\/span>/g) ?? []).length, 1);
  assert.equal((html.match(/class="legacy-figure-card"/g) ?? []).length, 2, "One parent card groups each historical figure.");
  assert.equal((html.match(/is-figure-subcard/g) ?? []).length, 3);
  assert.match(html, /A local commission/);
  assert.match(html, /Damon, Right Hand of Alexander/);
  assert.match(html, /<h3 id="[^"]+">Alexander<\/h3>/);
  assert.doesNotMatch(html, /[0-9]<\/strong> prestige|[0-9]<\/strong> ultimate titles/);
});

test("older worlds without figure metadata do not display historical paths or empty figure filters", () => {
  const { world, life, record } = fixture();
  life.accomplishments = [record("local-work")];
  world.legacy!.achievements = world.legacy!.achievements.filter(item => !item.figure);
  assert.deepEqual(buildHistoricalTitlePaths(world, life), []);
  assert.equal(renderToStaticMarkup(createElement(HistoricalTitlePaths, { world, life })), "");
  const html = renderToStaticMarkup(createElement(LegacyGallery, { entries: collectLegacyEntries(world, life, []) }));
  assert.doesNotMatch(html, /Historical figure|All figures|Title sub-card|legacy-figure-card/);
});

test("a figure card keeps separate title sub-cards from different lives without adding an award", () => {
  const { world, life, record } = fixture();
  life.accomplishments = [record("alexander-duty"), record("right-hand-of-alexander")];
  const firstLife = collectLegacyEntries(world, life, []);
  const secondLife = structuredClone(life);
  secondLife.seed = "second-title-life";
  secondLife.character!.name = "Philista";
  secondLife.accomplishments = [record("right-hand-of-alexander")];
  secondLife.accomplishments[0].name = "Philista, Right Hand of Alexander";
  secondLife.accomplishments[0].year = -325;
  const entries = collectLegacyEntries(world, secondLife, firstLife);
  const before = JSON.stringify(entries);
  const html = renderToStaticMarkup(createElement(LegacyGallery, { entries }));
  assert.equal((html.match(/class="legacy-figure-card"/g) ?? []).length, 1);
  assert.equal((html.match(/is-figure-subcard/g) ?? []).length, 3);
  assert.match(html, /Damon, Right Hand of Alexander/);
  assert.match(html, /Philista, Right Hand of Alexander/);
  assert.match(html, /325 BCE/);
  assert.match(html, /3 earned sub-cards/);
  assert.equal(JSON.stringify(entries), before, "The parent card is a view over saved work, without a new award or changed provenance.");
});

test("separate titles for one figure keep separate prerequisites and exhausted invitations do not stay actionable", () => {
  const { world, life } = fixture();
  const generalDuty = { ...world.legacy!.achievements[0], id: "general-duty", title: "An escort completed" };
  const generalTitle = { ...world.legacy!.achievements[1], id: "general-of-alexander", title: "General of Alexander" };
  world.legacy!.achievements.push(generalDuty, generalTitle);
  const dutyEvent = structuredClone(world.events[0]);
  dutyEvent.id = "event-general-duty";
  dutyEvent.choices[0].outcomes[0].effects = [{ type: "accomplishment", achievement: generalDuty.id }];
  const titleEvent = structuredClone(world.events[1]);
  titleEvent.id = "event-general-of-alexander";
  titleEvent.choices[0].outcomes[0].effects = [{ type: "accomplishment", achievement: generalTitle.id }];
  if (titleEvent.when!.type === "all") titleEvent.when!.conditions = titleEvent.when!.conditions.map(condition => condition.type === "accomplishment" ? { ...condition, achievement: generalDuty.id } : condition);
  world.events.push(dutyEvent, titleEvent);
  life.accomplishments = [];
  life.eventCounts["event-alexander-duty"] = 1;
  const path = buildHistoricalTitlePaths(world, life)[0];
  assert.equal(path.branches.length, 2);
  assert.deepEqual(path.branches[0].stages.map(stage => stage.achievement.id), ["alexander-duty", "right-hand-of-alexander"]);
  assert.deepEqual(path.branches[1].stages.map(stage => stage.achievement.id), ["general-duty", "general-of-alexander"]);
  assert.equal(path.branches[0].title.state, "closed");
  assert.equal(path.branches[0].next, undefined);
  assert.equal(path.branches[1].next!.achievement.id, "general-duty");

  const declined = "historical-general-of-alexander-declined";
  life.flags[declined] = true;
  for (const event of [dutyEvent, titleEvent]) if (event.when?.type === "all") event.when.conditions.push({ type: "flag", flag: declined, value: false });
  const ended = buildHistoricalTitlePaths(world, life)[0].branches[1];
  assert.equal(ended.declined, true);
  assert.equal(ended.next, undefined);
  const html = renderToStaticMarkup(createElement(HistoricalTitlePaths, { world, life }));
  assert.match(html, /This invitation path has ended/);
});

test("a failed visit waits for its declared retry year and repeated event and choice gates display once", () => {
  const { world, life } = fixture();
  const event = world.events[0];
  event.maxOccurrences = 3;
  event.cooldownYears = 1;
  event.choices[0].when = structuredClone(event.when);
  life.accomplishments = [];
  life.eventCounts[event.id] = 1;
  life.lastEventAge[event.id] = life.age;
  const waiting = buildHistoricalTitlePaths(world, life)[0].stages[0];
  assert.equal(waiting.state, "locked");
  assert.ok(waiting.requirements.some(requirement => requirement.text === "Next opportunity in 1 year" && !requirement.met));
  assert.equal(waiting.requirements.filter(requirement => requirement.text.includes("Oratory")).length, 1);
  const followingYear = { ...life, age: life.age + 1, year: life.year + 1 };
  const ready = buildHistoricalTitlePaths(world, followingYear)[0].stages[0];
  assert.equal(ready.state, "eligible");
  assert.equal(ready.requirements.some(requirement => requirement.text.startsWith("Next opportunity")), false);
});

test("independent scholarly paths show usable milestones after former personal teaching windows", () => {
  const world = applyHistoricalTitles(structuredClone(baseline)) as WorldPack;
  const life = structuredClone(createEngine(world).start("independent-title-ui"));
  life.age = 70; life.year = -280; life.phase = "ready"; life.pendingEventId = null;
  life.economy!.cash = 1000;
  for (const skill of Object.keys(life.character!.skills)) life.character!.skills[skill] = 100;
  life.flags["heard-aristotle"] = false;
  life.flags["studied-euclidean-proof"] = false;
  const scholarlyIds = ["disciple-of-aristotle", "disciple-of-euclid", "scholar-of-theophrastus"];
  for (const titleId of scholarlyIds) {
    const branch = buildHistoricalTitlePaths(world, life).flatMap(path => path.branches).find(item => item.title.achievement.id === titleId)!;
    assert.equal(branch.next!.state, "eligible", `${titleId}: independent study remains available.`);
    assert.ok(branch.stages.every(stage => !stage.contactWindow), `${titleId}: no personal contact window is displayed.`);
    assert.ok(branch.stages.every(stage => stage.requirements.every(requirement => !/^(Through|Before|In) |heard Aristotle|Euclid.s circle|Traveled to Athens/.test(requirement.text))));
    assert.equal(branch.title.state, "locked", "A title still needs its accepted milestones.");
    life.accomplishments!.push(...branch.stages.slice(0, -1).map((stage, index): AccomplishmentRecord => ({
      id: `${stage.achievement.id}:${64 + index}`, achievementId: stage.achievement.id, routeId: stage.achievement.routeId,
      title: stage.achievement.title, description: stage.achievement.description, kind: stage.achievement.kind,
      name: stage.achievement.nameTemplate.replace("{name}", life.character!.name), age: 64 + index, year: -286 + index,
      sourceId: stage.event!.id, outcomeId: stage.event!.choices[0].outcomes[0].id,
      people: [...stage.achievement.people], figure: { ...stage.achievement.figure! },
    })));
    const prepared = buildHistoricalTitlePaths(world, life).flatMap(path => path.branches).find(item => item.title.achievement.id === titleId)!;
    assert.equal(prepared.title.state, "eligible", `${titleId}: completed independent work opens the title review.`);
  }
  const html = renderToStaticMarkup(createElement(HistoricalTitlePaths, { world, life }));
  assert.match(html, /Complete each path’s required work/);
  assert.match(html, /Eligible for next event/);
  assert.doesNotMatch(html, /Accept an introduction, complete their requests/);
  const service = buildHistoricalTitlePaths(world, life).find(path => path.figure.id === "alexander")!;
  assert.ok(service.branches.every(branch => branch.title.contactWindow && branch.title.state === "closed"));
  assert.match(html, /Contact window closed/);
});

test("an ended open-ended study path describes its closure without inventing expired contact", () => {
  const { world, life } = fixture();
  world.legacy!.achievements = world.legacy!.achievements.filter(item => item.id === "disciple-of-aristotle");
  const event = world.events.find(item => item.id === "event-disciple-of-aristotle")!;
  const declined = "historical-disciple-of-aristotle-declined";
  if (event.when?.type === "all") event.when.conditions = [
    ...event.when.conditions.filter(condition => condition.type !== "year" || condition.op === "gte"),
    { type: "flag", flag: declined, value: false },
  ];
  life.age = 70; life.year = -280;
  life.flags[declined] = true;
  const html = renderToStaticMarkup(createElement(HistoricalTitlePaths, { world, life }));
  assert.match(html, /This path has ended/);
  assert.match(html, /Path closed/);
  assert.doesNotMatch(html, /Contact closed|Contact window closed/);
});
