import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { LifeState, WorldPack } from "../src/types.ts";
import { createEngine } from "../src/index.ts";
import {
  GAME_SECTIONS, SECTION_TIPS, dashboardColumns, newGuidedStep, sectionAges, sectionFacts, sectionOpenAge, tipsPassedOnEntry, visibleSections,
  type SectionAges, type SectionFacts,
} from "../client/models/onboarding-sections.ts";
import { advanceToDecisionWithFocus } from "../client/models/yearly-focus.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-11.json", import.meta.url), "utf8")) as WorldPack;
const AGES: SectionAges = { focus: 6, action: 6, trade: 12, firstJob: 12, fields: 16 };
const facts = (over: Partial<SectionFacts> = {}): SectionFacts => ({ age: 0, economy: true, learnedSkills: 0, hadDecision: false, ...over });
const at = (age: number, over: Partial<SectionFacts> = {}) => [...visibleSections(facts({ age, ...over }), AGES)];

test("the world's own unlock ages drive the map", () => {
  const life = createEngine(world).start("ages");
  assert.deepEqual(sectionAges(world, life), AGES);
  assert.equal(sectionFacts(world, life).economy, true);
  assert.equal(sectionFacts(world, life).hadDecision, false);
});

test("at birth only the time bar, the story and the life timeline are on screen", () => {
  assert.deepEqual(at(0), ["time-bar", "story", "rail"]);
  assert.deepEqual(at(3), ["time-bar", "story", "rail"], "a small child still has nothing to act on");
});

test("each section appears at the first age the player can act on it, never as a lock", () => {
  assert.deepEqual(at(6), ["time-bar", "story", "rail", "checklist", "focus", "yearly-action", "wealth"]);
  assert.deepEqual(at(12).filter(id => !at(6).includes(id)),
    ["resources", "inventory", "command-deck", "deck-market", "deck-career", "deck-people", "character", "spend"]);
  assert.deepEqual(at(16).filter(id => !at(12).includes(id)), ["conditions", "planting", "deck-farm", "deck-works"]);
  assert.deepEqual(at(18), at(16), "nothing new is left to open at 18");
  assert.equal(at(40).length, GAME_SECTIONS.length - 2, "everything but the two event sections is open in later life");
});

test("Next decision and Auto mode wait for the first decision; the skill tree for the first skill", () => {
  assert.ok(!at(4).includes("decisions"));
  assert.ok(at(4, { hadDecision: true }).includes("decisions"));
  assert.ok(!at(8).includes("skill-tree"));
  assert.ok(at(8, { learnedSkills: 1 }).includes("skill-tree"));
});

test("a world without the household economy never shows its bar or deck", () => {
  const classic = at(30, { economy: false });
  for (const id of ["resources", "inventory", "command-deck", "deck-market", "planting", "conditions"] as const) assert.ok(!classic.includes(id), id);
  assert.ok(classic.includes("focus"));
});

test("open ages are listed for every section; event sections have none", () => {
  assert.equal(sectionOpenAge("resources", AGES), 12);
  assert.equal(sectionOpenAge("planting", AGES), 16);
  assert.equal(sectionOpenAge("decisions", AGES), null);
  assert.equal(sectionOpenAge("skill-tree", AGES), null);
  for (const id of GAME_SECTIONS) assert.ok(sectionOpenAge(id, AGES) === null || Number.isFinite(sectionOpenAge(id, AGES)!), id);
});

test("every section is introduced by exactly one tip, in teaching order", () => {
  // The Character popup is help-only: its "?" explains it, but no tip stops the game for it.
  const helpOnly = ["character", "spend"];
  for (const id of GAME_SECTIONS) assert.equal(SECTION_TIPS.filter(tip => tip.covers.includes(id)).length, helpOnly.includes(id) ? 0 : 1, `${id} has ${helpOnly.includes(id) ? "no" : "one"} tip`);
  for (const tip of SECTION_TIPS) assert.equal(tip.covers[0], tip.section, `${tip.hint} points at its own section first`);
  assert.deepEqual(SECTION_TIPS.map(tip => tip.hint), ["time-bar", "scene", "decision", "focus", "yearly-action", "skills", "market", "planting"]);
});

test("Next decision stops at the year a new section with an unseen tip opens", () => {
  const before = visibleSections(facts({ age: 4 }), AGES);
  assert.equal(newGuidedStep(before, visibleSections(facts({ age: 5 }), AGES), []), null, "nothing new at 5");
  assert.equal(newGuidedStep(before, visibleSections(facts({ age: 6 }), AGES), []), "focus", "focus opens at 6");
  assert.equal(newGuidedStep(before, visibleSections(facts({ age: 6 }), AGES), ["focus", "yearly-action"]), null, "seen tips do not stop it");
  const eleven = visibleSections(facts({ age: 11 }), AGES);
  assert.equal(newGuidedStep(eleven, visibleSections(facts({ age: 12 }), AGES), []), "market", "the market tip introduces the household's goods too");
  assert.equal(newGuidedStep(eleven, visibleSections(facts({ age: 11, learnedSkills: 1 }), AGES), []), "skills");
  assert.equal(newGuidedStep(eleven, visibleSections(facts({ age: 12 }), AGES), ["market"]), null, "nothing else opens a tip that year");
});

test("a save opened mid-life treats the tips of sections already open before this year as seen", () => {
  assert.deepEqual(tipsPassedOnEntry(facts({ age: 0 }), AGES), []);
  assert.deepEqual(tipsPassedOnEntry(facts({ age: 6 }), AGES), ["time-bar", "scene"], "the tips of this year still show");
  assert.deepEqual(tipsPassedOnEntry(facts({ age: 13, learnedSkills: 2, hadDecision: true }), AGES),
    ["time-bar", "scene", "decision", "focus", "yearly-action", "skills", "market"]);
  assert.deepEqual(tipsPassedOnEntry(facts({ age: 40, learnedSkills: 2, hadDecision: true }), AGES), SECTION_TIPS.map(tip => tip.hint));
});

function lifeAt(age: number, seed: string): LifeState {
  const engine = createEngine(world);
  let life = engine.start(seed);
  while ((life.age < age || life.phase === "choice") && life.phase !== "ended") {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

test("with tips on, Next decision stops at the year a section opens; with tips off it runs on", () => {
  const engine = createEngine(world);
  const start = lifeAt(5, "guided-next-decision");
  assert.equal(start.phase, "ready");
  const sectionsNow = visibleSections(sectionFacts(world, start), sectionAges(world, start));
  const stop = (next: LifeState) => newGuidedStep(sectionsNow, visibleSections(sectionFacts(world, next), sectionAges(world, next)), []) !== null;
  const guided = advanceToDecisionWithFocus(engine, start, "everyday", stop);
  assert.ok(guided.age <= 6, `stopped by age 6, not ${guided.age}`);
  assert.ok(guided.phase === "choice" || guided.age === 6, "either a decision came first or it stopped where focus opens");
  const free = advanceToDecisionWithFocus(engine, start, "everyday");
  assert.ok(free.phase !== "ready", "without a stop it runs to the next decision");
});

test("dashboardColumns collapses empty right columns in early childhood and balances age 6 before command-deck opens", () => {
  const layoutAt = (age: number, over: Partial<Parameters<typeof dashboardColumns>[1]> = {}) =>
    dashboardColumns(visibleSections(facts({ age }), AGES), {
      begun: true, demo: true, ended: false, ready: true, hasTitlePaths: false, hasProgressFeedback: false, ...over,
    });

  for (const age of [0, 3]) {
    assert.deepEqual(layoutAt(age), { moveSupportToStory: false, showStoryColumn: false }, `age ${age} ready collapses empty column`);
    assert.deepEqual(layoutAt(age, { ready: false }), { moveSupportToStory: false, showStoryColumn: false }, `age ${age} choice collapses empty column`);
  }
  assert.deepEqual(layoutAt(3, { hasTitlePaths: true }), { moveSupportToStory: false, showStoryColumn: true }, "title paths keep right column shown");
  assert.deepEqual(layoutAt(3, { hasProgressFeedback: true }), { moveSupportToStory: false, showStoryColumn: true }, "progress feedback keeps right column shown");

  assert.deepEqual(layoutAt(6), { moveSupportToStory: true, showStoryColumn: true }, "age 6 balances wealth and life record into story column");
  assert.deepEqual(layoutAt(6, { ready: false }), { moveSupportToStory: true, showStoryColumn: true }, "age 6 choice still keeps support panels balancing story column");

  for (const age of [12, 16]) {
    assert.deepEqual(layoutAt(age), { moveSupportToStory: false, showStoryColumn: true }, `age ${age} fills story column with command deck`);
    assert.deepEqual(layoutAt(age, { ready: false }), { moveSupportToStory: false, showStoryColumn: true }, `age ${age} choice keeps command deck in story column`);
  }

  for (const age of [0, 3, 6, 12, 16]) {
    assert.deepEqual(layoutAt(age, { ended: true }), { moveSupportToStory: false, showStoryColumn: true }, `age ${age} ending keeps story column`);
  }
  assert.deepEqual(layoutAt(0, { begun: false }), { moveSupportToStory: false, showStoryColumn: true });
  assert.deepEqual(layoutAt(0, { demo: false }), { moveSupportToStory: false, showStoryColumn: true });

  const themeCss = readFileSync(new URL("../client/styles/storybook-theme.css", import.meta.url), "utf8");
  assert.match(themeCss, /\.life-layout\.life-layout-single[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(themeCss, /:not\(:has\(\.story-column\s*>\s*\*\)\)/);
});
