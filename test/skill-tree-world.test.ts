import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import beforeBalance from "../worlds/alexandria-0.17.0.json" with { type: "json" };
import treeRelease from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.7.0.json" with { type: "json" };

const expectedPaths = {
  craft: ["Crafts", 0, {}],
  pottery: ["Crafts", 1, { craft: 15 }],
  carving: ["Crafts", 1, { craft: 15 }],
  sculpture: ["Crafts", 2, { carving: 20, pottery: 10 }],
  literacy: ["Letters & ideas", 0, {}],
  oratory: ["Letters & ideas", 1, { literacy: 10 }],
  philosophy: ["Letters & ideas", 2, { literacy: 20, oratory: 10 }],
  reckoning: ["Numbers & sky", 0, {}],
  astronomy: ["Numbers & sky", 1, { reckoning: 15, literacy: 10 }],
  astrology: ["Numbers & sky", 2, { astronomy: 10, reckoning: 10 }],
  seamanship: ["Practical service", 0, {}],
  warfare: ["Practical service", 1, { craft: 10 }],
  music: ["Performance", 0, {}],
} as const;

test("Alexandria authors thirteen skill nodes with real training routes and no cycles", () => {
  const skills = createEngine(pack).world.character!.skills;
  assert.equal(pack.version, "0.34.0");
  assert.deepEqual(Object.keys(skills).sort(), Object.keys(expectedPaths).sort());
  const visited = new Set<string>();
  function visit(id: string, path = new Set<string>()) {
    assert.equal(path.has(id), false, `A learning path cycles through ${id}.`);
    if (visited.has(id)) return;
    const next = new Set(path).add(id);
    for (const prerequisite of Object.keys(skills[id].prerequisites ?? {})) visit(prerequisite, next);
    visited.add(id);
  }
  for (const [id, [branch, tier, prerequisites]] of Object.entries(expectedPaths)) {
    const skill = skills[id];
    assert.equal(skill.branch, branch);
    assert.equal(skill.tier, tier);
    assert.deepEqual(skill.prerequisites ?? {}, prerequisites);
    assert.ok(skill.description && skill.description.length > 20, id);
    assert.equal(skill.trainingActivity, `train-${id}`);
    const action = pack.character.activities.find(activity => activity.id === skill.trainingActivity)!;
    assert.equal(action.category, "training");
    assert.ok(action.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "skill" && effect.skill === id && effect.delta > 0)), id);
    visit(id);
  }
  assert.equal(visited.size, 13);
});

test("skill paths add no birth draws and preserve the existing life content and career odds", () => {
  const stripped = structuredClone(treeRelease) as WorldPack;
  for (const skill of Object.values(stripped.character!.skills)) {
    for (const field of ["description", "branch", "tier", "prerequisites", "trainingActivity"] as const) delete skill[field];
  }
  stripped.version = previous.version;
  assert.deepEqual(stripped, previous, "Only the pack version and skill definitions change.");
  const before = createEngine(previous), after = createEngine(treeRelease);
  for (let index = 0; index < 40; index++) {
    const seed = `skill-tree-birth-parity-${index}`;
    const a = before.start(seed), b = after.start(seed);
    for (const field of ["originId", "stats", "character", "rngState", "pendingEventId", "journal", "commands"] as const) {
      assert.deepEqual(b[field], a[field], `${seed}: ${field}`);
    }
  }
  for (const [id, weights] of [["seek-officer-commission", [15, 85]], ["seek-general-command", [2, 98]], ["seek-court-appointment", [3, 97]]] as const) {
    const action = pack.character.activities.find(activity => activity.id === id)!;
    assert.ok(action, id);
    assert.deepEqual(action.outcomes.map(outcome => outcome.weight), weights, id);
  }
});

function controlledEngine(): LifeEngine {
  // These established route schedules predate the stricter balance. Current
  // career entry under the new rewards is exercised in strict-progression-life.
  const world = structuredClone(beforeBalance);
  world.mortality.bands.forEach(band => { band.annualProbability = 0; });
  world.health.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health.declineBands.forEach(band => { band.healthLoss = 0; });
  world.stats.wealth.initial = 80;
  world.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of world.origins) origin.statRanges.wealth = { min: 80, max: 80 };
  return createEngine(world);
}

function settle(engine: LifeEngine, state: LifeState): LifeState {
  while (state.phase === "choice") {
    const choices = engine.getChoices(state);
    const choice = choices.find(candidate => candidate.id === "learn-letters")
      ?? choices.find(candidate => candidate.id === "practice-reading")
      ?? choices.find(candidate => candidate.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end")))
      ?? choices[0];
    state = engine.choose(state, choice.id);
  }
  return state;
}

function ageTo(engine: LifeEngine, state: LifeState, age: number): LifeState {
  state = settle(engine, state);
  while (state.age < age && state.phase !== "ended") state = settle(engine, engine.advance(state));
  assert.equal(state.age, age);
  assert.equal(state.phase, "ready");
  return state;
}

function available(engine: LifeEngine, state: LifeState, id: string) {
  const activity = engine.getActivities(state).find(candidate => candidate.id === id)!;
  assert.ok(activity, id);
  return activity;
}

/** Uses the annual command budget and checks the immediate authored cost/gain. */
function train(engine: LifeEngine, state: LifeState, age: number, skill: string): LifeState {
  state = ageTo(engine, state, age);
  const id = `train-${skill}`;
  const action = engine.world.character!.activities.find(activity => activity.id === id)!;
  assert.equal(available(engine, state, id).available, true, `${id}: ${available(engine, state, id).reason}`);
  const result = engine.act(state, id);
  for (const effect of action.outcomes[0].effects) {
    if (effect.type === "stat") {
      const definition = engine.world.stats[effect.stat];
      assert.equal(result.stats[effect.stat], Math.max(definition.min, Math.min(definition.max, state.stats[effect.stat] + effect.delta)), `${id}: ${effect.stat}`);
    }
    if (effect.type === "skill") {
      const definition = engine.world.character!.skills[effect.skill];
      assert.equal(result.character!.skills[effect.skill], Math.max(definition.min, Math.min(definition.max, state.character!.skills[effect.skill] + effect.delta)), `${id}: ${effect.skill}`);
    }
  }
  assert.equal(result.character!.lastActivityAge, age);
  assert.equal(available(engine, result, id).available, false);
  assert.throws(() => engine.act(result, id), /major activity for this year/);
  return result;
}

test("workshop training reaches sculpture through pottery and carving before qualifying for its job", () => {
  const engine = controlledEngine();
  let life = ageTo(engine, engine.start("skill-tree-workshop"), 10);
  assert.equal(available(engine, life, "train-pottery").available, false);
  assert.match(available(engine, life, "train-pottery").reason!, /Tool handling 15/);
  for (const [age, skill] of [[10, "craft"], [11, "craft"], [12, "pottery"], [13, "pottery"], [14, "carving"], [15, "carving"], [16, "carving"]] as const) life = train(engine, life, age, skill);
  life = ageTo(engine, life, 17);
  assert.equal(available(engine, life, "train-sculpture").available, true);
  life = train(engine, life, 17, "sculpture");
  life = ageTo(engine, life, 18);
  assert.equal(available(engine, life, "work-sculptor").available, false);
  assert.match(available(engine, life, "work-sculptor").reason!, /Sculpture 25/);
  for (const age of [18, 19, 20]) life = train(engine, life, age, "sculpture");
  life = ageTo(engine, life, 21);
  assert.equal(available(engine, life, "work-sculptor").available, true);
  life = engine.act(life, "work-sculptor");
  assert.equal(life.character!.jobId, "sculptor");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("reading and speech form a reachable route to philosophy and its existing tutor requirements", () => {
  const engine = controlledEngine();
  let life = engine.start("skill-tree-ideas");
  for (const [age, skill] of [[6, "literacy"], [7, "literacy"], [14, "oratory"], [15, "oratory"], [16, "philosophy"], [17, "philosophy"], [18, "philosophy"], [19, "philosophy"]] as const) life = train(engine, life, age, skill);
  life = ageTo(engine, life, 22);
  assert.equal(available(engine, life, "work-philosophy-tutor").available, true);
  life = engine.act(life, "work-philosophy-tutor");
  assert.equal(life.character!.jobId, "philosophy-tutor");
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("counting and reading unlock observation before astrology while seamanship stays a root skill", () => {
  const engine = controlledEngine();
  let life = engine.start("skill-tree-sky");
  for (const [age, skill] of [[6, "literacy"], [8, "reckoning"], [9, "reckoning"], [10, "literacy"], [11, "literacy"], [12, "reckoning"], [14, "astronomy"]] as const) life = train(engine, life, age, skill);
  life = ageTo(engine, life, 15);
  assert.equal(available(engine, life, "train-astrology").available, false);
  life = train(engine, life, 15, "astronomy");
  life = ageTo(engine, life, 16);
  assert.equal(available(engine, life, "train-astrology").available, true);
  for (const [age, skill] of [[16, "astrology"], [17, "seamanship"], [18, "astronomy"], [19, "astronomy"], [20, "astrology"], [21, "astrology"], [22, "astrology"]] as const) life = train(engine, life, age, skill);
  life = ageTo(engine, life, 23);
  assert.equal(available(engine, life, "work-sky-table-calculator").available, true);
  assert.equal(available(engine, life, "work-astrologer").available, false, "The existing 29 BCE date gate still applies.");
  life = ageTo(engine, life, 37);
  assert.equal(available(engine, life, "work-astrologer").available, true);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("equipment practice opens military training without requiring a seafaring career", () => {
  const engine = controlledEngine();
  let life = engine.start("skill-tree-service");
  life = train(engine, life, 10, "craft");
  life = train(engine, life, 14, "warfare");
  life = train(engine, life, 15, "warfare");
  life = ageTo(engine, life, 18);
  assert.ok(life.character!.skills.seamanship < 15, "Passive harbor experience does not require seafaring training.");
  assert.equal(life.commands.some(command => command.type === "act" && command.activity === "train-seamanship"), false);
  assert.equal(available(engine, life, "enlist-royal-army").available, true);
  life = engine.act(life, "enlist-royal-army");
  assert.equal(life.character!.jobId, "soldier");
  assert.equal(available(engine, ageTo(engine, life, 22), "seek-officer-commission").available, false);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
