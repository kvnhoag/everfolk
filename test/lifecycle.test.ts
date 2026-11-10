import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { HistoricalSource, LifeEvent, WorldPack } from "../src/types.ts";

const fixtureSource: HistoricalSource = {
  id: "fixture-source", title: "Synthetic source fixture, not historical evidence",
  url: "https://example.org/fixture", publisher: "Test fixture", kind: "scholarship",
  period: "Synthetic", geography: "Synthetic", summary: "Tests source-reference validation only.",
  limitations: "Not used by any real game content.", accessed: "2026-11-05",
};

function world(extra: Partial<WorldPack> = {}): WorldPack {
  return {
    schemaVersion: 1, id: "lifecycle-test", version: "1", title: "Lifecycle test", description: "Synthetic test world.",
    startYear: -2, maxAge: 4,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 50 }, knowledge: { label: "Knowledge", min: 0, max: 100, initial: 5 } },
    flags: { learned: { label: "Learned", initial: false } },
    origins: [{ id: "ordinary", title: "Ordinary", text: "A synthetic birth.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    endings: [{ id: "complete", title: "Complete", text: "A synthetic life ends.", kind: "death" }],
    defaultEnding: "complete", ...extra,
  };
}

function mortality(annualProbability: number) {
  return { description: "Synthetic hazard used only by automated tests.", sourceIds: [], bands: [{ minAge: 0, maxAge: 3, annualProbability, ending: "complete" }] };
}

function automatic(id: string, at: number, effects: LifeEvent["effects"] = []): LifeEvent {
  return { id, title: id, text: "An automatic test event.", trigger: { type: "age", at }, mode: "automatic", effects, choices: [] };
}

function decision(id: string, at: number): LifeEvent {
  return { id, title: id, text: "A decision.", trigger: { type: "age", at }, choices: [{ id: "continue", text: "Continue", outcomes: [{ id: "result", text: "A result.", weight: 1, effects: [] }] }] };
}

test("a guaranteed mortality interval can end life before the first birthday", () => {
  const engine = createEngine(world({ mortality: mortality(1) }));
  const born = engine.start("infancy");
  assert.equal(born.phase, "ready");
  const dead = engine.advance(born);
  assert.equal(dead.phase, "ended");
  assert.equal(dead.age, 0);
  assert.equal(dead.year, -2);
  assert.equal(dead.rngState, born.rngState);
  assert.deepEqual(dead.commands, [{ type: "advance" }]);
  assert.equal(dead.journal.filter(entry => entry.type === "year").length, 0);
  assert.equal(born.phase, "ready");
  assert.deepEqual(engine.load(engine.save(dead)), dead);
  assert.throws(() => engine.advance(dead), /ended/);
});

test("zero hazards allow birthdays without consuming random draws and maximum age still ends life", () => {
  const engine = createEngine(world({ mortality: mortality(0) }));
  let state = engine.start("zero-risk");
  const initialRng = state.rngState;
  for (let i = 0; i < 4; i++) state = engine.advance(state);
  assert.equal(state.age, 4);
  assert.equal(state.year, 3);
  assert.equal(state.phase, "ended");
  assert.equal(state.rngState, initialRng);
});

test("mortality uses the completed age at the beginning of an interval", () => {
  const engine = createEngine(world({ mortality: { ...mortality(0), bands: [
    { minAge: 0, maxAge: 1, annualProbability: 0, ending: "complete" },
    { minAge: 2, maxAge: 3, annualProbability: 1, ending: "complete" },
  ] } }));
  let state = engine.advance(engine.advance(engine.start("age-band")));
  assert.equal(state.age, 2);
  assert.equal(state.year, 1);
  assert.equal(state.phase, "ready");
  state = engine.advance(state);
  assert.equal(state.age, 2);
  assert.equal(state.year, 1);
  assert.equal(state.phase, "ended");
});

test("seeded mortality produces reproducible varied lifespans and stable saves", () => {
  const engine = createEngine(world({ mortality: mortality(0.25) }));
  const ages = new Set<number>();
  for (let i = 0; i < 100; i++) {
    let state = engine.start(`lifespan-${i}`);
    while (state.phase !== "ended") state = engine.advance(state);
    ages.add(state.age);
    assert.deepEqual(engine.replay(state.seed, state.commands), state);
    if (i < 5) assert.deepEqual(engine.load(engine.save(state)), state);
  }
  assert.ok(ages.has(0));
  assert.ok(ages.has(4));
  assert.ok(ages.size >= 4);
});

test("mortality is not rerolled by resolving a choice", () => {
  const engine = createEngine(world({ mortality: mortality(1), events: [decision("birth-decision", 0)] }));
  const born = engine.start("decision-before-risk");
  assert.equal(born.phase, "choice");
  const chosen = engine.choose(born, "continue");
  assert.equal(chosen.phase, "ready");
  assert.equal(chosen.rngState, born.rngState);
  assert.equal(engine.advance(chosen).age, 0);
});

test("automatic scheduled events apply consequences and drain before the next decision", () => {
  const engine = createEngine(world({ events: [
    automatic("birth-story", 0, [{ type: "flag", flag: "learned", value: true }]),
    automatic("second-story", 0, [{ type: "stat", stat: "knowledge", delta: 3 }]),
    { ...decision("first-decision", 0), when: { type: "flag", flag: "learned", value: true } },
  ] }));
  const state = engine.start("automatic-birth");
  assert.equal(state.age, 0);
  assert.equal(state.stats.knowledge, 8);
  assert.equal(state.pendingEventId, "first-decision");
  assert.deepEqual(state.journal.filter(entry => entry.type === "event").map(entry => entry.id), ["birth-story", "second-story", "first-decision"]);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("a random automatic event occurs at most once in a tick and can unlock a scheduled event", () => {
  const deferred = automatic("deferred", 0, [{ type: "stat", stat: "knowledge", delta: 2 }]);
  deferred.when = { type: "flag", flag: "learned", value: true };
  const random: LifeEvent = {
    id: "recurring", title: "Recurring", text: "A random automatic event.", mode: "automatic", choices: [],
    trigger: { type: "random", weight: 1 }, maxOccurrences: 10, cooldownYears: 0,
    effects: [{ type: "flag", flag: "learned", value: true }],
  };
  const engine = createEngine(world({ events: [deferred, random] }));
  let state = engine.start("random-automatic");
  assert.equal(state.phase, "ready");
  assert.equal(state.eventCounts.recurring, 1);
  assert.equal(state.eventCounts.deferred, 1);
  assert.equal(state.stats.knowledge, 7);
  state = engine.advance(state);
  assert.equal(state.eventCounts.recurring, 2);
});

test("scheduled automatic events suppress the random event opportunity for that year", () => {
  const random: LifeEvent = { ...automatic("random", 0), trigger: { type: "random", weight: 1 } };
  const engine = createEngine(world({ events: [automatic("scheduled", 0), random] }));
  const state = engine.start("scheduled-first");
  assert.equal(state.eventCounts.scheduled, 1);
  assert.equal(state.eventCounts.random, undefined);
  assert.equal(engine.advance(state).eventCounts.random, 1);
});

test("automatic terminal consequences stop the rest of the same-age event queue", () => {
  const engine = createEngine(world({ events: [
    automatic("terminal", 0, [{ type: "end", ending: "complete" }]),
    decision("unreachable", 0),
  ] }));
  const state = engine.start("automatic-terminal");
  assert.equal(state.phase, "ended");
  assert.equal(state.pendingEventId, null);
  assert.equal(state.eventCounts.unreachable, undefined);
});

test("conditional yearly rules use the new age and their effects run in declaration order", () => {
  const engine = createEngine(world({ yearlyRules: [
    { id: "childhood", when: { type: "age", op: "lte", value: 2 }, effects: [{ type: "stat", stat: "knowledge", delta: 2 }] },
    { id: "later", when: { type: "age", op: "gte", value: 3 }, effects: [{ type: "stat", stat: "health", delta: -3 }] },
    { id: "learn", when: { type: "stat", stat: "knowledge", op: "gte", value: 9 }, effects: [{ type: "flag", flag: "learned", value: true }] },
  ] }));
  let state = engine.advance(engine.advance(engine.start("yearly-rules")));
  assert.equal(state.stats.knowledge, 9);
  assert.equal(state.stats.health, 50);
  assert.equal(state.flags.learned, true);
  state = engine.advance(state);
  assert.equal(state.stats.health, 47);
  assert.equal(state.stats.knowledge, 9);
});

test("a direct ending in yearly rules stops subsequent rules and events", () => {
  const engine = createEngine(world({ yearlyRules: [
    { id: "finish", effects: [{ type: "end", ending: "complete" }] },
    { id: "later", effects: [{ type: "stat", stat: "knowledge", delta: 20 }] },
  ], events: [decision("later-event", 1)] }));
  const state = engine.advance(engine.start("rule-ending"));
  assert.equal(state.phase, "ended");
  assert.equal(state.stats.knowledge, 5);
  assert.equal(state.eventCounts["later-event"], undefined);
});

test("embedded citations and evidence metadata validate across origins, events and endings", () => {
  const pack = world({ sources: [fixtureSource], events: [{
    ...automatic("documented", 0), evidence: "documented-history", sourceIds: [fixtureSource.id],
  }] });
  pack.origins[0].evidence = "historically-inspired";
  pack.origins[0].sourceIds = [fixtureSource.id];
  pack.endings[0].evidence = "fictional";
  pack.endings[0].sourceIds = [];
  assert.doesNotThrow(() => validateWorld(pack));
  const engine = createEngine(pack);
  assert.equal(engine.world.sources?.[0].id, fixtureSource.id);
});

test("malformed, overlapping, incomplete and non-death mortality definitions fail validation", () => {
  for (const bad of [
    [{ minAge: 1, maxAge: 3, annualProbability: 0.1, ending: "complete" }],
    [{ minAge: 0, maxAge: 2, annualProbability: 0.1, ending: "complete" }],
    [{ minAge: 0, maxAge: 2, annualProbability: 0.1, ending: "complete" }, { minAge: 2, maxAge: 3, annualProbability: 0.1, ending: "complete" }],
    [{ minAge: 0, maxAge: 3, annualProbability: 1.1, ending: "complete" }],
    [{ minAge: 0, maxAge: 3, annualProbability: -0.1, ending: "complete" }],
    [{ minAge: 0, maxAge: 3, annualProbability: NaN, ending: "complete" }],
    [{ minAge: 0, maxAge: 3, annualProbability: 0.1, ending: "unknown" }],
  ]) assert.throws(() => createEngine(world({ mortality: { ...mortality(0), bands: bad } })));
  assert.throws(() => createEngine(world({ mortality: mortality(0), endings: [{ id: "complete", title: "Chapter", text: "A chapter ends.", kind: "chapter" }] })), /death ending/);
});

test("malformed automatic events and yearly rules fail validation", () => {
  assert.throws(() => createEngine(world({ events: [{ ...decision("bad", 0), effects: [] }] })), /automatic mode/);
  assert.throws(() => createEngine(world({ events: [{ ...decision("bad", 0), mode: "automatic" }] })), /empty choice list/);
  assert.throws(() => createEngine(world({ yearlyRules: [
    { id: "duplicate", effects: [] }, { id: "duplicate", effects: [] },
  ] })), /duplicate ID/);
  assert.throws(() => createEngine(world({ yearlyRules: [{ id: "unknown", effects: [{ type: "stat", stat: "missing", delta: 1 }] }] })), /unknown stat/);
});

test("unknown source IDs, duplicate citations and unsupported source metadata fail validation", () => {
  assert.throws(() => createEngine(world({ events: [{ ...automatic("bad", 0), sourceIds: ["missing"] }] })), /unknown source/);
  assert.throws(() => createEngine(world({ events: [{ ...automatic("bad", 0), evidence: "historically-inspired" }] })), /at least one source/);
  assert.throws(() => createEngine(world({ sources: [fixtureSource], events: [{ ...automatic("bad", 0), sourceIds: [fixtureSource.id, fixtureSource.id] }] })), /duplicate source/);
  for (const url of ["http://example.org", "javascript:alert(1)", "https://user:password@example.org"]) {
    assert.throws(() => createEngine(world({ sources: [{ ...fixtureSource, url }] })), /HTTPS/);
  }
  assert.throws(() => createEngine(world({ sources: [{ ...fixtureSource, accessed: "2026-02-30" }] })), /valid calendar date/);
  assert.throws(() => createEngine(world({ sources: [fixtureSource, fixtureSource] })), /duplicate ID/);
});
