import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { contentFingerprint } from "../src/random.ts";
import { createSeededPlayEngine, MAX_SEEDED_SAVE_LENGTH } from "../src/seeded-play.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

/** Authored fixture: no historical claim, mortality or real NFT ownership. */
function scenarioWorld(): WorldPack {
  return {
    schemaVersion: 1, id: "seeded-school-world", version: "1.0.0",
    title: "A fictional school origin", description: "Seeded-play integration fixture.",
    startYear: -384, maxAge: 5,
    stats: {
      health: { label: "Health", min: 0, max: 100, initial: 70 },
      knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0, initialRange: { min: 0, max: 3 } },
    },
    flags: { reader: { label: "Chose the reader", initial: false } },
    origins: [{
      id: "school-household", title: "A school household", text: "You begin in a fictional teaching household.",
      weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 1 }],
    }],
    yearlyEffects: [],
    events: [
      {
        id: "first-observation", title: "Two ways to look", text: "A household observer offers two approaches.",
        trigger: { type: "age", at: 0 },
        choices: [
          { id: "follow-reader", text: "Stay beside the reader", outcomes: [
            { id: "noticed-pattern", text: "You notice a pattern.", weight: 3, effects: [{ type: "flag", flag: "reader", value: true }, { type: "stat", stat: "knowledge", delta: 5 }] },
            { id: "noticed-question", text: "You return with a question.", weight: 1, effects: [{ type: "flag", flag: "reader", value: true }, { type: "stat", stat: "knowledge", delta: 4 }] },
          ] },
          { id: "watch-shore", text: "Watch the shore", outcomes: [
            { id: "shore-observation", text: "You watch the water.", weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 1 }] },
          ] },
        ],
      },
      {
        id: "later-question", title: "A later question", text: "A new question allows a new decision.",
        trigger: { type: "age", at: 2 },
        choices: [
          { id: "compare-notes", text: "Compare what you recorded", outcomes: [
            { id: "comparison-accepted", text: "The comparison holds.", weight: 2, effects: [{ type: "stat", stat: "knowledge", delta: 3 }] },
            { id: "comparison-revised", text: "One observation needs revision.", weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 1 }] },
          ] },
          { id: "leave-question", text: "Leave the question for later", outcomes: [
            { id: "question-left", text: "You return to ordinary work.", weight: 1, effects: [] },
          ] },
        ],
      },
    ],
    endings: [{ id: "chapter-complete", title: "Chapter complete", text: "The fixture chapter closes." }],
    defaultEnding: "chapter-complete",
    character: {
      identity: { namePools: { male: ["Damon", "Nikon"], female: ["Dione", "Thaleia"] }, avatarVariants: 3 },
      skills: { letters: { label: "Letters", min: 0, max: 100, initial: 0 } },
      jobs: [], partners: [],
      activities: [{
        id: "practice-letters", text: "Practice letters", category: "training", minAge: 1,
        outcomes: [{ id: "letters-practiced", text: "You complete the exercise.", weight: 1, effects: [{ type: "skill", skill: "letters", delta: 3 }] }],
      }],
      childNames: ["Ione"],
      deathCauseDescription: "Fixture fallback, not used by this non-mortality world.",
      deathCauses: [{ id: "fixture-illness", title: "Illness", text: "An illness.", weight: 1 }],
    },
  };
}

function setup() {
  const scenario = { id: "school-origin", version: "1.0.0", title: "School origin", world: scenarioWorld() };
  const grant = {
    id: "fixture-grant-1", token: { network: "testnet", contractId: "collectibles.testnet", tokenId: "school-7" },
    allowSeededPlay: true, scenarioId: scenario.id, scenarioVersion: scenario.version,
    worldFingerprint: contentFingerprint(scenario.world), seed: "recorded-school-seed-7",
  };
  return { scenario, grant, engine: createSeededPlayEngine(scenario, grant) };
}

function completed(engine: ReturnType<typeof createSeededPlayEngine>): LifeState {
  let life = engine.start();
  for (let count = 0; count < 20; count++) {
    if (life.phase === "ended") return life;
    if (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
    else life = engine.advance(life);
  }
  assert.fail("The seeded fixture did not complete.");
}

test("fixed-seed starts use the authored household, calendar and ordinary engine rules", () => {
  const { scenario, grant, engine } = setup();
  const first = engine.start();
  assert.equal(first.seed, grant.seed);
  assert.equal(first.year, -384);
  assert.equal(first.age, 0);
  assert.equal(first.originId, "school-household");
  assert.equal(first.pendingEventId, "first-observation");
  assert.deepEqual(first, engine.start());
  assert.deepEqual(first, createEngine(scenario.world).start(grant.seed));
  // An unexpected JS argument cannot replace the recorded seed.
  assert.equal((engine.start as (seed?: string) => LifeState)("a-better-seed").seed, grant.seed);
});

test("the same recorded seed permits different accepted choices rather than a fixed movie", () => {
  const { engine } = setup();
  const initial = engine.start();
  const reading = engine.choose(initial, "follow-reader");
  const shore = engine.choose(initial, "watch-shore");
  assert.equal(reading.seed, shore.seed);
  assert.equal(reading.flags.reader, true);
  assert.equal(shore.flags.reader, false);
  assert.notEqual(reading.stats.knowledge, shore.stats.knowledge);
  assert.notDeepEqual(reading.commands, shore.commands);
  assert.deepEqual(engine.replay(reading.commands), reading);
  assert.deepEqual(engine.replay(shore.commands), shore);
  assert.equal(initial.commands.length, 0);
});

test("a complete weighted life replays exactly and restores from its seeded save", () => {
  const { engine } = setup();
  const first = completed(engine), second = completed(engine);
  assert.equal(first.phase, "ended");
  assert.deepEqual(second, first);
  assert.deepEqual(engine.replay(first.commands), first);
  assert.deepEqual(engine.load(engine.save(first)), first);
  assert.equal(engine.save(engine.load(engine.save(first))), engine.save(first));
});

test("avatar and activity commands remain normal replayable actions in a fixed origin", () => {
  const { engine } = setup();
  let life = engine.start();
  const nextVariant = (life.character!.avatarVariant! + 1) % 3;
  life = engine.chooseAvatar(life, nextVariant);
  assert.equal(life.character!.avatarVariant, nextVariant);
  assert.throws(() => engine.act(life, "practice-letters"));
  life = engine.choose(life, "follow-reader");
  life = engine.advance(life);
  assert.equal(life.year, -383);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "practice-letters")?.available, true);
  life = engine.act(life, "practice-letters");
  assert.equal(life.character!.skills.letters, 3);
  assert.deepEqual(life.commands.map(command => command.type), ["avatar", "choose", "advance", "act"]);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.throws(() => engine.act(life, "practice-letters"));
});

test("seeded construction requires permission and complete fixed-seed metadata", () => {
  const { scenario, grant } = setup();
  for (const changed of [
    { ...grant, allowSeededPlay: false },
    { ...grant, allowSeededPlay: "true" },
    { ...grant, seed: "" },
    { ...grant, seed: "s".repeat(257) },
    { ...grant, id: "" },
    { ...grant, token: { ...grant.token, tokenId: "" } },
    { ...grant, token: { ...grant.token, contractId: "" } },
  ]) assert.throws(() => createSeededPlayEngine(scenario, changed as typeof grant));
});

test("a grant cannot choose a different scenario, version or pack revision", () => {
  const { scenario, grant } = setup();
  for (const changed of [
    { ...grant, scenarioId: "another-origin" },
    { ...grant, scenarioVersion: "2.0.0" },
    { ...grant, worldFingerprint: "fnv1a64-0000000000000000" },
  ]) assert.throws(() => createSeededPlayEngine(scenario, changed));
  const revised = structuredClone(scenario);
  revised.world.events[0].text = "A changed authored scene.";
  assert.throws(() => createSeededPlayEngine(revised, grant));
});

test("scenario authoring requires one fixed household and a valid simulation pack", () => {
  const { scenario, grant } = setup();
  const variableOrigin = structuredClone(scenario);
  variableOrigin.world.origins.push({ id: "another-household", title: "Another household", text: "Another beginning.", weight: 1, effects: [] });
  assert.throws(() => createSeededPlayEngine(variableOrigin, { ...grant, worldFingerprint: contentFingerprint(variableOrigin.world) }));
  const malformed = structuredClone(scenario);
  malformed.world.startYear = 0;
  assert.throws(() => createSeededPlayEngine(malformed, { ...grant, worldFingerprint: contentFingerprint(malformed.world) }));
});

test("scenario, grant and life snapshots are detached and immutable", () => {
  const { scenario, grant, engine } = setup();
  const initial = engine.start();
  const snapshot = structuredClone(initial);
  scenario.world.stats.knowledge.initialRange = { min: 80, max: 90 };
  scenario.title = "Changed outside the engine";
  grant.seed = "different-outside-seed";
  grant.token.tokenId = "different-outside-token";
  assert.deepEqual(engine.start(), snapshot);
  assert.notEqual(engine.grant.seed, grant.seed);
  assert.notEqual(engine.scenario.title, scenario.title);
  for (const value of [engine, engine.scenario, engine.grant, engine.grant.token, engine.world, initial, initial.stats, initial.character!.skills]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { initial.stats.knowledge = 99; });
  assert.deepEqual(initial, snapshot);
});

test("mutations and previews reject a state from another seed without altering it", () => {
  const { scenario, engine } = setup();
  const foreign = createEngine(scenario.world).start("another-recorded-seed");
  const snapshot = structuredClone(foreign);
  for (const operation of [
    () => engine.getChoices(foreign), () => engine.getActivities(foreign),
    () => engine.choose(foreign, "follow-reader"), () => engine.advance(foreign),
    () => engine.act(foreign, "practice-letters"), () => engine.chooseAvatar(foreign, 0),
    () => engine.save(foreign),
  ]) assert.throws(operation);
  assert.deepEqual(foreign, snapshot);
});

test("seeded export rejects edited origin, stats or command history", () => {
  const { engine } = setup();
  const original = engine.choose(engine.start(), "follow-reader");
  const wrongOrigin = structuredClone(original); wrongOrigin.originId = "another-household";
  const wrongStats = structuredClone(original); wrongStats.stats.knowledge = 99;
  const wrongHistory = structuredClone(original); wrongHistory.commands = [];
  for (const altered of [wrongOrigin, wrongStats, wrongHistory]) assert.throws(() => engine.save(altered));
  assert.deepEqual(engine.replay(original.commands), original);
});

test("a seeded save pins grant, token, scenario, version and fingerprint", () => {
  const { engine } = setup();
  const saved = engine.save(engine.start());
  const fields = ["grantId", "scenarioId", "scenarioVersion", "worldFingerprint"];
  for (const field of fields) {
    const altered = JSON.parse(saved); altered[field] = `changed-${field}`;
    assert.throws(() => engine.load(JSON.stringify(altered)));
  }
  for (const field of ["network", "contractId", "tokenId"]) {
    const altered = JSON.parse(saved); altered.token[field] = `changed-${field}`;
    assert.throws(() => engine.load(JSON.stringify(altered)));
  }
});

test("nested seed replacement and ordinary-save imports cannot bypass the scenario binding", () => {
  const { scenario, grant, engine } = setup();
  const saved = JSON.parse(engine.save(engine.start()));
  for (const change of [
    (value: typeof saved) => { value.save.seed = "arbitrary-seed"; },
    (value: typeof saved) => { value.save.worldVersion = "2.0.0"; },
    (value: typeof saved) => { value.save.worldFingerprint = "fnv1a64-0000000000000000"; },
    (value: typeof saved) => { value.save.extra = "unsupported"; },
  ]) {
    const altered = structuredClone(saved); change(altered);
    assert.throws(() => engine.load(JSON.stringify(altered)));
  }
  const ordinary = createEngine(scenario.world);
  assert.throws(() => engine.load(ordinary.save(ordinary.start(grant.seed))));
  assert.throws(() => ordinary.load(JSON.stringify(saved)));
});

test("malformed, oversized and unsupported seeded saves fail without a reset", () => {
  const { engine } = setup();
  const saved = engine.save(engine.start());
  for (const raw of ["{", "null", "[]", "x".repeat(MAX_SEEDED_SAVE_LENGTH + 1)]) assert.throws(() => engine.load(raw));
  for (const alter of [
    (value: Record<string, unknown>) => { value.mode = "ordinary"; },
    (value: Record<string, unknown>) => { value.schemaVersion = 2; },
    (value: Record<string, unknown>) => { delete value.token; },
    (value: Record<string, unknown>) => { value.allowSeededPlay = true; },
  ]) {
    const changed = JSON.parse(saved); alter(changed);
    assert.throws(() => engine.load(JSON.stringify(changed)));
  }
  assert.equal(engine.save(engine.start()), saved);
});

test("ordinary engine seeds and choices remain independent of seeded-play scenarios", () => {
  const { engine: seeded } = setup();
  const ordinaryWorld = scenarioWorld();
  ordinaryWorld.id = "ordinary-fixture-world";
  ordinaryWorld.startYear = -350;
  ordinaryWorld.origins = [{ id: "ordinary-household", title: "Ordinary household", text: "An ordinary beginning.", weight: 1, effects: [] }];
  ordinaryWorld.events = [];
  const ordinary = createEngine(ordinaryWorld);
  const life = ordinary.start("a-player-chosen-ordinary-seed");
  assert.equal(life.year, -350);
  assert.equal(life.originId, "ordinary-household");
  assert.equal(life.seed, "a-player-chosen-ordinary-seed");
  assert.deepEqual(ordinary.getChoices(life), []);
  assert.throws(() => ordinary.choose(life, "follow-reader"));
  assert.throws(() => seeded.choose(life, "follow-reader"));
  assert.deepEqual(ordinary.load(ordinary.save(life)), life);
});
