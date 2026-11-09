import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { yearAtAge } from "../src/calendar.ts";
import type { JournalEntry, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { buildLifeEvents } from "../client/life-events.ts";

function entry(type: JournalEntry["type"], id: string, text: string, age = 6): JournalEntry {
  return { type, id, text, age, year: yearAtAge(pack.startYear, age) };
}

function fixture(journal: JournalEntry[], age = 6) {
  const world = structuredClone(pack) as WorldPack;
  world.events = [
    { id: "birth", title: "You are born", text: "Your household cares for you. A long birth detail.", trigger: { type: "age", at: 0 }, mode: "automatic", choices: [], effects: [], sourceIds: [] },
    { id: "steps", title: "Your first steps", text: "An entire milestone description. Adults help you balance and walk.", trigger: { type: "age", at: 1 }, mode: "automatic", choices: [], effects: [], sourceIds: ["strabo-alexandria"] },
    { id: "ordinary", title: "An errand", text: "You deliver a jar. The shopkeeper sends you home with a small payment.", trigger: { type: "random", weight: 1 }, mode: "automatic", choices: [], effects: [], sourceIds: [] },
    { id: "letters", title: "Learning letters", text: "A neighbor offers lessons. Your household has to decide whether you should learn.", trigger: { type: "age", at: 6 }, choices: [{ id: "learn", text: "Take the lessons", outcomes: [{ id: "learned", text: "You learn a few letters from your neighbor.", weight: 1, effects: [] }] }], sourceIds: ["education-apprenticeship"] },
    { id: "history", title: "A new ruler", text: "A new ruler takes power in the city.", trigger: { type: "year", at: -60 }, mode: "automatic", choices: [], effects: [], sourceIds: ["strabo-alexandria"] },
  ];
  world.character!.activities = [{ id: "practice", text: "Spend time at the workbench", category: "training", outcomes: [{ id: "practiced", text: "You practise joining two pieces of wood.", weight: 1, effects: [] }] }];
  const initial = createEngine(pack).start("event-feed-fixture");
  const life = { ...initial, age, year: yearAtAge(pack.startYear, age), journal } as LifeState;
  return { world, life };
}

test("the feed omits background paragraphs and decision prompts while keeping automatic milestones short", () => {
  const { world, life } = fixture([
    entry("birth", "origin", "A household: A long paragraph about where you are born.", 0),
    entry("event", "birth", "You are born: Your household cares for you. A long birth detail.", 0),
    entry("year", "age-1", "Age 1", 1),
    entry("event", "steps", "Your first steps: An entire milestone description.", 1),
    entry("event", "ordinary", "An errand: You deliver a jar."),
    entry("event", "letters", "Learning letters: A neighbor offers lessons."),
  ]);
  const years = buildLifeEvents(life, world);
  assert.deepEqual(years.map(year => year.age), [6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(years[0].events.map(event => event.text), [world.events.find(event => event.id === "ordinary")!.text]);
  assert.deepEqual(years.find(year => year.age === 1)!.events.map(event => event.text), ["Your first steps"]);
  assert.deepEqual(years.at(-1)!.events.map(event => event.text), ["You are born"]);
  const text = years.flatMap(year => year.events.map(event => event.text)).join(" ");
  assert.doesNotMatch(text, /long paragraph|entire milestone|has to decide|offers lessons/);
});

test("a resolved milestone appears once as its accepted result rather than prompt, option and result", () => {
  const { world, life } = fixture([
    entry("event", "letters", "Learning letters: A neighbor offers lessons."),
    entry("choice", "learn", "Take the lessons"),
    entry("outcome", "learned", "You learn a few letters from your neighbor."),
  ]);
  const events = buildLifeEvents(life, world)[0].events;
  assert.equal(events.length, 1);
  assert.equal(events[0].text, "You learn a few letters from your neighbor.");
  assert.equal(events[0].title, "Learning letters");
  assert.deepEqual(events[0].sourceIds, ["education-apprenticeship"]);
});

test("activity results retain named people, children and wages without repeating action labels", () => {
  const { world, life } = fixture([
    entry("activity", "porter", "You continue your work as quay porter."),
    entry("activity", "practice", "Spend time at the workbench"),
    entry("outcome", "practiced", "You practise joining two pieces of wood."),
    entry("activity", "met-demetria", "You meet Demetria."),
    entry("activity", "child-1", "Alexia joins your family."),
    entry("activity", "asset-income", "Your assets bring in 10 dr."),
  ]);
  assert.deepEqual(buildLifeEvents(life, world)[0].events.map(event => event.text), [
    "Your assets bring in 10 dr.", "Alexia joins your family.", "You meet Demetria.",
    "You practise joining two pieces of wood.", "You continue your work as quay porter.",
  ]);
});

test("multiple repeated events and results in one year retain their encounter order and distinct keys", () => {
  const { world, life } = fixture([
    entry("event", "ordinary", "First errand."),
    entry("activity", "practice", "Spend time at the workbench"),
    entry("outcome", "practiced", "The first practice finishes."),
    entry("event", "ordinary", "Second errand."),
    entry("activity", "practice", "Spend time at the workbench"),
    entry("outcome", "practiced", "The second practice finishes."),
  ]);
  const events = buildLifeEvents(life, world)[0].events;
  assert.equal(events.length, 4);
  assert.equal(new Set(events.map(event => event.key)).size, 4);
  assert.deepEqual(events.map(event => event.text), [
    "The second practice finishes.", world.events.find(event => event.id === "ordinary")!.text,
    "The first practice finishes.", world.events.find(event => event.id === "ordinary")!.text,
  ]);
});

test("quiet years remain visible and the calendar crosses BCE to CE without a year zero", () => {
  const { world, life } = fixture([], 3);
  world.startYear = -2;
  life.year = 2;
  const years = buildLifeEvents(life, world);
  assert.deepEqual(years.map(year => [year.age, year.year, year.events.length]), [[3, 2, 0], [2, 1, 0], [1, -1, 0], [0, -2, 0]]);
});

test("illness onset, progression, recovery and relationship warnings remain in the life record", () => {
  const { world, life } = fixture([
    entry("event", "health-onset-pneumonia", "You develop pneumonia. You need care."),
    entry("event", "health-continues-pneumonia", "Pneumonia continues. Your health deteriorates."),
    entry("event", "relationship-distance-demetria", "You and Demetria have spent little time together."),
    entry("event", "health-recovery-pneumonia", "You recover from pneumonia."),
  ]);
  const events = buildLifeEvents(life, world)[0].events;
  assert.deepEqual(events.map(event => event.text), [...life.journal].reverse().map(entry => entry.text));
  assert.deepEqual(events[0].sourceIds, world.health!.sourceIds);
  assert.deepEqual(events[1].sourceIds, []);
});

test("named death is concise and exact while unknown legacy results remain readable", () => {
  const { world, life } = fixture([
    entry("outcome", "old-result", "A recorded result from this life's original pack."),
    entry("ending", worldEndingId(), "An entire ending narrative and cause paragraph."),
  ]);
  life.phase = "ended";
  const cause = world.character!.deathCauses.find(cause => cause.id === "malaria") ?? world.character!.deathCauses[0];
  life.deathCauseId = cause.id;
  const events = buildLifeEvents(life, world)[0].events;
  assert.equal(events[0].text, `Cause of death: ${cause.title}.`);
  assert.equal(events[1].text, "A recorded result from this life's original pack.");
  assert.doesNotMatch(events[0].text, /entire ending narrative/);
});

function worldEndingId() { return pack.defaultEnding; }

test("projecting a real played life leaves accepted commands, journal, RNG and exact save unchanged", () => {
  const world = structuredClone(pack) as WorldPack;
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  const engine = createEngine(world);
  let life = engine.start("read-only-event-feed");
  while (life.age < 8) life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  const before = engine.save(life), snapshot = structuredClone(life);
  const years = buildLifeEvents(life, engine.world);
  assert.equal(years.length, life.age + 1);
  assert.deepEqual(life, snapshot);
  assert.equal(engine.save(life), before);
  assert.deepEqual(engine.load(before), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
