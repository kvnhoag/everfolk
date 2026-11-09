import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { CharacterActivity, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import { activityPartnerIds } from "../src/character.ts";
import legacy from "../worlds/alexandria-0.6.1.json" with { type: "json" };

function activity(id: string, effects: Effect[], category: CharacterActivity["category"] = "relationship"): CharacterActivity {
  return { id, text: id, category, minAge: 18, outcomes: [{ id: `${id}-done`, text: `${id} done.`, weight: 1, effects }] };
}

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "people-test", version: "1", title: "People", description: "Fictional tests.", startYear: -66, maxAge: 30,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70, initialRange: { min: 60, max: 80 } } }, flags: {},
    origins: [{ id: "shop", title: "Shop", text: "A shop household.", weight: 1, effects: [] }, { id: "port", title: "Port", text: "A port household.", weight: 2, effects: [] }],
    yearlyEffects: [], events: [], endings: [{ id: "death", kind: "death", title: "Death", text: "The life ends." }], defaultEnding: "death",
    character: {
      playerNames: ["Damon", "Menon", "Apollonios"], requireIntroductions: true,
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [],
      partners: [{ id: "anna", name: "Anna", ageOffset: 0, occupation: "Potter", description: "A fictional potter." }, { id: "beth", name: "Beth", ageOffset: 1, occupation: "Trader", description: "A fictional trader." }],
      activities: [
        activity("meet-anna", [{ type: "introduce", partner: "anna" }], "family"),
        activity("meet-again", [{ type: "introduce", partner: "anna" }, { type: "introduce", partner: "anna" }], "family"),
        activity("court-anna", [{ type: "relationship", partner: "anna", status: "courting" }]),
        activity("marry-anna", [{ type: "relationship", partner: "anna", status: "married" }]),
        activity("court-beth", [{ type: "relationship", partner: "beth", status: "courting" }]),
        activity("divorce", [{ type: "divorce" }]),
      ], childNames: ["Kai"], deathCauses: [{ id: "illness", title: "Illness", text: "A fictional illness.", weight: 1 }], deathCauseDescription: "Authored causes.",
    },
  };
}

function ageTo(engine: LifeEngine, life: LifeState, age: number): LifeState {
  while (life.age < age) life = engine.advance(life);
  return life;
}

test("player names vary across seeds and reproduce on start, replay and load", () => {
  const engine = createEngine(fixture());
  const names = new Set<string>();
  for (let index = 0; index < 30; index++) {
    let life = engine.start(`person-${index}`);
    assert.ok(engine.world.character!.playerNames!.includes(life.character!.name!));
    names.add(life.character!.name!);
    assert.deepEqual(engine.start(life.seed), life);
    life = ageTo(engine, life, 19);
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.equal(names.size, 3);
});

test("adding a name pool leaves the selected origin and starting stat rolls intact", () => {
  const named = fixture(), nameless = fixture();
  delete nameless.character!.playerNames;
  const a = createEngine(named), b = createEngine(nameless);
  for (let index = 0; index < 60; index++) {
    const left = a.start(`name-after-stats-${index}`), right = b.start(`name-after-stats-${index}`);
    assert.equal(left.originId, right.originId);
    assert.deepEqual(left.stats, right.stats);
    assert.equal(right.character!.name, undefined);
  }
});

test("legacy fixed starts retain their RNG state and omit new optional identity fields", () => {
  const world = fixture();
  delete world.character!.playerNames; delete world.character!.requireIntroductions;
  world.origins = [world.origins[0]];
  delete world.stats.health.initialRange;
  const engine = createEngine(world), life = engine.start("legacy-no-new-draw");
  assert.equal(life.rngState, seedToUint32(life.seed));
  assert.equal(Object.hasOwn(life.character!, "name"), false);
  assert.equal(Object.hasOwn(life.character!, "knownPartnerIds"), false);
  const named = structuredClone(world);
  named.character!.playerNames = ["Menon", "Damon"];
  assert.equal(createEngine(named).start(life.seed).rngState, nextRandom(life.rngState).state);
  const singleName = structuredClone(world);
  singleName.character!.playerNames = ["Menon"];
  const only = createEngine(singleName).start(life.seed);
  assert.equal(only.character!.name, "Menon");
  assert.equal(only.rngState, life.rngState);
});

test("unknown people have no courtship actions and guessed IDs cannot bypass an introduction", () => {
  const engine = createEngine(fixture());
  const life = ageTo(engine, engine.start("unknown-person"), 18);
  assert.deepEqual(life.character!.knownPartnerIds, []);
  const options = engine.getActivities(life);
  assert.ok(options.some(option => option.id === "meet-anna" && option.available));
  assert.equal(options.some(option => option.id === "court-anna" || option.id === "marry-anna" || option.id === "court-beth"), false);
  assert.throws(() => engine.act(life, "court-anna"), /Meet this person/);
  assert.equal(life.commands.length, 18);
});

test("a recorded introduction unlocks one person without changing relationship status or old snapshots", () => {
  const engine = createEngine(fixture());
  const before = ageTo(engine, engine.start("meet-person"), 18);
  const met = engine.act(before, "meet-anna");
  assert.deepEqual(before.character!.knownPartnerIds, []);
  assert.deepEqual(met.character!.knownPartnerIds, ["anna"]);
  assert.equal(met.character!.relationshipStatus, "single");
  assert.equal(met.character!.partnerId, null);
  assert.equal(met.journal.filter(entry => entry.id === "met-anna" && entry.text === "You meet Anna.").length, 1);
  const next = engine.advance(met);
  assert.ok(engine.getActivities(next).some(option => option.id === "court-anna" && option.available));
  assert.equal(engine.getActivities(next).some(option => option.id === "court-beth"), false);
  assert.deepEqual(engine.load(engine.save(next)), next);
});

test("introductions deduplicate and known people remain after courtship, marriage and divorce", () => {
  const engine = createEngine(fixture());
  let life = ageTo(engine, engine.start("people-persistence"), 18);
  life = engine.act(life, "meet-anna");
  life = engine.act(engine.advance(life), "meet-again");
  assert.deepEqual(life.character!.knownPartnerIds, ["anna"]);
  assert.equal(life.journal.filter(entry => entry.id === "met-anna").length, 1);
  life = engine.act(engine.advance(life), "court-anna");
  assert.equal(life.character!.relationshipStatus, "courting");
  life = engine.act(engine.advance(life), "marry-anna");
  assert.equal(life.character!.relationshipStatus, "married");
  life = engine.act(engine.advance(life), "divorce");
  assert.equal(life.character!.relationshipStatus, "divorced");
  assert.deepEqual(life.character!.knownPartnerIds, ["anna"]);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("known-partner conditions track the actual introduction and prevent repeats", () => {
  const world = fixture();
  world.character!.activities[0].when = { type: "not", condition: { type: "known-partner", partner: "anna" } };
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("known-condition"), 18);
  assert.equal(engine.getActivities(life).find(option => option.id === "meet-anna")!.available, true);
  life = engine.advance(engine.act(life, "meet-anna"));
  assert.equal(engine.getActivities(life).find(option => option.id === "meet-anna")!.available, false);
});

test("partner references include nested relationship conditions even when outcomes only change stats", () => {
  const option = activity("nested-people", [{ type: "stat", stat: "health", delta: 1 }]);
  option.when = { type: "all", conditions: [
    { type: "age", op: "gte", value: 18 },
    { type: "any", conditions: [
      { type: "relationship", status: "courting", partner: "anna" },
      { type: "not", condition: { type: "not", condition: { type: "known-partner", partner: "beth" } } },
    ] },
  ] };
  assert.deepEqual(activityPartnerIds(option), ["anna", "beth"]);
  option.outcomes[0].effects.push({ type: "relationship", partner: "anna", status: "courting" });
  assert.deepEqual(activityPartnerIds(option), ["anna", "beth"], "References are deduplicated.");
  const introduction = activity("meet", [{ type: "introduce", partner: "anna" }], "family");
  assert.deepEqual(activityPartnerIds(introduction), [], "Introducing a person is not a pre-existing relationship reference.");
});

test("after meeting one person, stat-only activities for other people remain absent", () => {
  const world = fixture();
  for (const person of world.character!.partners) {
    const option = activity(`time-with-${person.id}`, [{ type: "stat", stat: "health", delta: 1 }]);
    option.text = `Make time for ${person.name}`;
    option.when = { type: "all", conditions: [{ type: "any", conditions: [
      { type: "relationship", status: "courting", partner: person.id },
      { type: "relationship", status: "married", partner: person.id },
    ] }] };
    world.character!.activities.push(option);
  }
  world.character!.activities[0].when = { type: "not", condition: { type: "known-partner", partner: "anna" } };
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("conditional-name-privacy"), 18);
  assert.equal(engine.getActivities(life).some(option => option.id.startsWith("time-with-")), false);
  assert.ok(engine.getActivities(life).some(option => option.id === "meet-anna" && option.available));
  life = engine.advance(engine.act(life, "meet-anna"));
  const options = engine.getActivities(life);
  assert.ok(options.some(option => option.id === "time-with-anna"));
  assert.equal(options.some(option => option.id === "time-with-beth"), false);
  assert.equal(JSON.stringify(options).includes("Make time for Beth"), false);
  assert.throws(() => engine.act(life, "time-with-beth"), /requirements/);
});

test("legacy worlds still offer and replay their original courtship without introduction state", () => {
  const world = structuredClone(legacy);
  world.mortality.bands.forEach(band => { band.annualProbability = 0; });
  world.events = [];
  world.stats.wealth.initialRange = { min: 80, max: 80 };
  world.origins.forEach(origin => { origin.statRanges.wealth = { min: 80, max: 80 }; });
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("legacy-courtship"), 20);
  assert.equal(life.character!.knownPartnerIds, undefined);
  assert.ok(engine.getActivities(life).some(option => option.id === "court-demetria"));
  life = engine.act(life, "court-demetria");
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.equal(life.character!.name, undefined);
});

test("player pools and introduction configuration reject malformed data", () => {
  for (const names of [[], [""], ["  Menon"], ["Menon "], ["Menon", "Menon"], [1], ["x".repeat(101)], Array.from({ length: 129 }, (_, i) => `Name ${i}`)]) {
    const world = fixture() as any;
    world.character.playerNames = names;
    assert.throws(() => validateWorld(world), /world\.character\.playerNames/);
  }
  const world = fixture() as any;
  world.character.requireIntroductions = "yes";
  assert.throws(() => validateWorld(world), /requireIntroductions/);
});

test("introduction effects and known-person conditions require declared partner IDs", () => {
  const effect = fixture();
  effect.origins[0].effects = [{ type: "introduce", partner: "missing" }];
  assert.throws(() => validateWorld(effect), /unknown partner/);
  const condition = fixture();
  condition.character!.activities[0].when = { type: "known-partner", partner: "missing" };
  assert.throws(() => validateWorld(condition), /unknown partner/);
});
