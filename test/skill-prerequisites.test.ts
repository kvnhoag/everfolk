import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { CharacterActivity, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";

function activity(id: string, effects: Effect[], category: CharacterActivity["category"] = "training"): CharacterActivity {
  return { id, text: id, category, outcomes: [{ id: `${id}-done`, text: "Practice completed.", weight: 1, effects }] };
}

function pack(): WorldPack {
  return {
    schemaVersion: 1, id: "skill-tree-test", version: "1.0.0", title: "Skill tree test",
    description: "Fictional gameplay fixture.", startYear: 1, maxAge: 20,
    stats: { wealth: { label: "Resources", min: 0, max: 100, initial: 20 } },
    flags: {}, origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    endings: [{ id: "death", title: "Life complete", text: "Your life ends.", kind: "death" }], defaultEnding: "death",
    character: {
      skills: {
        pottery: { label: "Pottery", min: 0, max: 100, initial: 0, branch: "Craft and art", tier: 0, trainingActivity: "practice-pottery" },
        carving: { label: "Carving", min: 0, max: 100, initial: 0, prerequisites: { pottery: 10 }, tier: 1, trainingActivity: "practice-carving" },
        sculpture: { label: "Sculpture", min: 0, max: 100, initial: 0, description: "Shape a stone figure.", prerequisites: { pottery: 20, carving: 10 }, tier: 2, trainingActivity: "practice-sculpture" },
      },
      jobs: [], partners: [],
      activities: [
        { ...activity("practice-pottery", [{ type: "skill", skill: "pottery", delta: 10 }, { type: "stat", stat: "wealth", delta: -1 }]), when: { type: "stat", stat: "wealth", op: "gte", value: 1 } },
        { ...activity("practice-carving", [{ type: "skill", skill: "carving", delta: 10 }, { type: "stat", stat: "wealth", delta: -1 }]), when: { type: "stat", stat: "wealth", op: "gte", value: 1 } },
        { ...activity("practice-sculpture", [{ type: "skill", skill: "sculpture", delta: 10 }, { type: "stat", stat: "wealth", delta: -2 }]), when: { type: "stat", stat: "wealth", op: "gte", value: 2 } },
        activity("help-at-home", [{ type: "skill", skill: "sculpture", delta: 3 }], "family"),
      ],
      childNames: ["Child"], deathCauseDescription: "Fictional test cause.",
      deathCauses: [{ id: "illness", title: "Illness", text: "An illness ends your life.", weight: 1 }],
    },
  };
}

function available(engine: LifeEngine, state: LifeState, id: string) {
  return engine.getActivities(state).find(candidate => candidate.id === id)!;
}

test("accepted training unlocks skill-tree prerequisites and guessing an activity cannot bypass them", () => {
  const engine = createEngine(pack());
  let state = engine.start("training-route");
  const before = JSON.stringify(state);
  assert.equal(available(engine, state, "practice-sculpture").available, false);
  assert.match(available(engine, state, "practice-sculpture").reason!, /Sculpture requires Pottery 20 \(currently 0\); Carving 10 \(currently 0\)/);
  assert.throws(() => engine.act(state, "practice-sculpture"), /Pottery 20/);
  assert.throws(() => engine.replay("training-route", [{ type: "act", activity: "practice-sculpture" }]), /Pottery 20/);
  assert.equal(JSON.stringify(state), before);

  state = engine.act(state, "practice-pottery");
  assert.equal(state.character!.skills.pottery, 10);
  assert.equal(state.stats.wealth, 19);
  assert.match(available(engine, state, "practice-carving").reason!, /major activity/);
  state = engine.advance(state);
  assert.equal(available(engine, state, "practice-carving").available, true);
  state = engine.act(state, "practice-carving");
  state = engine.advance(state);
  assert.match(available(engine, state, "practice-sculpture").reason!, /Pottery 20 \(currently 10\)/);
  state = engine.act(state, "practice-pottery");
  state = engine.advance(state);
  assert.equal(available(engine, state, "practice-sculpture").available, true);
  state = engine.act(state, "practice-sculpture");
  assert.deepEqual(state.character!.skills, { pottery: 20, carving: 10, sculpture: 10 });
  assert.equal(state.stats.wealth, 15);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("existing age, cooldown, resource conditions and annual activity budget still apply", () => {
  const world = pack();
  world.character!.skills.pottery.initial = 20;
  world.character!.skills.carving.initial = 10;
  const training = world.character!.activities[2];
  training.minAge = 1;
  training.cooldownYears = 2;
  world.stats.wealth.initial = 3;
  const engine = createEngine(world);
  let state = engine.start("training-constraints");
  assert.match(available(engine, state, training.id).reason!, /age 1/);
  assert.throws(() => engine.act(state, training.id), /age 1/);
  state = engine.act(engine.advance(state), training.id);
  assert.equal(state.stats.wealth, 1);
  assert.match(available(engine, state, "practice-pottery").reason!, /major activity/);
  assert.throws(() => engine.act(state, "practice-pottery"), /major activity/);
  state = engine.advance(state);
  assert.match(available(engine, state, training.id).reason!, /age 3/);
  assert.throws(() => engine.act(state, training.id), /age 3/);
  state = engine.advance(state);
  assert.match(available(engine, state, training.id).reason!, /Resources at least 2 \(you have 1\)/);
  const before = JSON.stringify(state);
  assert.throws(() => engine.act(state, training.id), /Resources/);
  assert.equal(JSON.stringify(state), before);
  state = engine.act(state, "practice-pottery");
  assert.equal(state.stats.wealth, 0);
});

test("all positive training gains across possible outcomes enforce their prerequisites", () => {
  const world = pack();
  const training = world.character!.activities[0];
  training.outcomes.push({ id: "advanced-lesson", text: "A harder lesson.", weight: 1, effects: [{ type: "skill", skill: "sculpture", delta: 1 }] });
  const engine = createEngine(world);
  const start = engine.start("all-outcomes");
  assert.match(available(engine, start, training.id).reason!, /Sculpture requires/);
  assert.throws(() => engine.act(start, training.id), /Sculpture requires/);
});

test("prerequisites do not block passive event, employment or family skill gains", () => {
  const world = pack();
  world.character!.jobs.push({ id: "helper", title: "Helper", description: "Help at a workshop.", minAge: 0, yearlyEffects: [{ type: "skill", skill: "sculpture", delta: 2 }] });
  world.character!.activities.push(activity("take-work", [{ type: "job", job: "helper" }], "career"));
  world.events.push(
    { id: "observe", title: "Watch a sculptor", text: "You watch a sculptor at work.", trigger: { type: "age", at: 1 }, mode: "automatic", effects: [{ type: "skill", skill: "sculpture", delta: 7 }], choices: [] },
    { id: "try", title: "Try carving", text: "You try a small task.", trigger: { type: "age", at: 2 }, choices: [{ id: "help", text: "Help", outcomes: [{ id: "helped", text: "You help.", weight: 1, effects: [{ type: "skill", skill: "sculpture", delta: 4 }] }] }] },
  );
  const engine = createEngine(world);
  let state = engine.act(engine.start("passive-gains"), "take-work");
  state = engine.advance(state);
  assert.equal(state.character!.skills.sculpture, 9);
  state = engine.act(state, "help-at-home");
  assert.equal(state.character!.skills.sculpture, 12);
  state = engine.choose(engine.advance(state), "help");
  assert.equal(state.character!.skills.sculpture, 18);
  assert.equal(state.character!.skills.pottery, 0);
  assert.match(available(engine, state, "practice-sculpture").reason!, /Pottery 20/);
});

test("nonpositive skill effects in training do not require prerequisites", () => {
  const world = pack();
  world.character!.activities.push(activity("review", [
    { type: "skill", skill: "sculpture", delta: 0 }, { type: "skill", skill: "carving", delta: -1 },
  ]));
  const engine = createEngine(world);
  const start = engine.start("review");
  assert.equal(available(engine, start, "review").available, true);
  assert.equal(engine.act(start, "review").character!.skills.sculpture, 0);
});

test("valid skill metadata permits empty prerequisites, free branch labels and inclusive limits", () => {
  const world = pack();
  Object.assign(world.character!.skills.pottery, { description: "a".repeat(1_000), branch: "A branch / with spaces", tier: 8, prerequisites: {} });
  world.character!.skills.sculpture.prerequisites = { pottery: 100, carving: 0.5 };
  assert.doesNotThrow(() => validateWorld(world));
});

const malformedMetadata: [string, unknown, RegExp][] = [
  ["description", "x".repeat(1_001), /description/], ["description", "", /description/], ["description", 1, /description/],
  ["branch", "x".repeat(101), /branch/], ["branch", [], /branch/], ["branch", " ", /branch/],
  ["tier", -1, /tier/], ["tier", 9, /tier/], ["tier", 0.5, /tier/], ["tier", "1", /tier/], ["tier", NaN, /tier/],
  ["prerequisites", [], /prerequisites/], ["prerequisites", null, /prerequisites/], ["prerequisites", "pottery", /prerequisites/],
  ["trainingActivity", null, /trainingActivity/], ["trainingActivity", "UNKNOWN", /trainingActivity/],
  ["initialRange", { min: 0, max: 10 }, /initialRange.*unknown field/], ["unexpected", true, /unexpected.*unknown field/],
];
for (const [index, [field, value, expected]] of malformedMetadata.entries()) {
  test(`skill metadata rejects malformed ${field} (case ${index + 1})`, () => {
    const world = pack();
    (world.character!.skills.pottery as unknown as Record<string, unknown>)[field] = value;
    assert.throws(() => validateWorld(world), expected);
  });
}

const invalidPrerequisites: [Record<string, unknown>, RegExp][] = [
  [{ missing: 1 }, /unknown skill 'missing'/], [{ sculpture: 10 }, /cannot require itself/],
  [{ pottery: 0 }, /above its minimum/], [{ pottery: -1 }, /above its minimum/], [{ pottery: 101 }, /at most its maximum/],
  [{ pottery: Infinity }, /finite number/], [{ pottery: NaN }, /finite number/], [{ pottery: "10" }, /finite number/],
];
for (const [index, [prerequisites, expected]] of invalidPrerequisites.entries()) {
  test(`skill prerequisites reject malformed references or thresholds (case ${index + 1})`, () => {
    const world = pack();
    world.character!.skills.sculpture.prerequisites = prerequisites as Record<string, number>;
    assert.throws(() => validateWorld(world), expected);
  });
}

test("skill prerequisite cycles are rejected independently of skill declaration order", () => {
  for (const reverse of [false, true]) {
    const world = pack();
    world.character!.skills.pottery.prerequisites = { sculpture: 1 };
    if (reverse) world.character!.skills = Object.fromEntries(Object.entries(world.character!.skills).reverse());
    assert.throws(() => validateWorld(world), /prerequisites contain a cycle/);
  }
});

test("trainingActivity must reference training with a positive gain for that skill", () => {
  const mutations: [(world: WorldPack) => void, RegExp][] = [
    [world => { world.character!.skills.pottery.trainingActivity = "missing"; }, /unknown activity 'missing'/],
    [world => { world.character!.skills.pottery.trainingActivity = "help-at-home"; }, /must reference a training activity/],
    [world => { world.character!.skills.pottery.trainingActivity = "practice-carving"; }, /positive effect for this skill/],
    [world => { world.character!.activities[0].outcomes[0].effects[0] = { type: "skill", skill: "pottery", delta: 0 }; }, /positive effect for this skill/],
  ];
  for (const [mutate, expected] of mutations) {
    const world = pack();
    mutate(world);
    assert.throws(() => validateWorld(world), expected);
  }
});

test("legacy packs without prerequisites retain exact state, RNG and replay behavior", () => {
  const legacy = pack();
  for (const skill of Object.values(legacy.character!.skills)) {
    delete skill.description; delete skill.branch; delete skill.tier; delete skill.prerequisites; delete skill.trainingActivity;
  }
  const metadata = structuredClone(legacy);
  Object.assign(metadata.character!.skills.sculpture, { description: "Stone work.", branch: "Craft", tier: 2, prerequisites: {}, trainingActivity: "practice-sculpture" });
  // Random outcomes make a consumed or skipped RNG draw observable.
  for (const world of [legacy, metadata]) world.character!.activities[2].outcomes.push({ id: "extra", text: "A good session.", weight: 2, effects: [{ type: "skill", skill: "sculpture", delta: 12 }] });
  const engines = [createEngine(legacy), createEngine(metadata)];
  let states = engines.map(engine => engine.start("legacy-replay"));
  const comparable = (state: LifeState) => {
    const { worldFingerprint, ...rest } = state;
    return rest;
  };
  assert.deepEqual(comparable(states[0]), comparable(states[1]));
  for (let year = 0; year < 4; year++) {
    states = states.map((state, i) => engines[i].act(state, "practice-sculpture"));
    assert.deepEqual(comparable(states[0]), comparable(states[1]));
    states = states.map((state, i) => engines[i].advance(state));
    assert.deepEqual(comparable(states[0]), comparable(states[1]));
  }
  engines.forEach((engine, i) => {
    assert.deepEqual(engine.replay(states[i].seed, states[i].commands), states[i]);
    assert.deepEqual(engine.load(engine.save(states[i])), states[i]);
  });
});
