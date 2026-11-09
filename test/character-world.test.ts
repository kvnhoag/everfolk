import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import beforeNaming from "../worlds/alexandria-0.5.0.json" with { type: "json" };
import afterNaming from "../worlds/alexandria-0.5.1.json" with { type: "json" };

test("specific cause names preserve the previous life mechanics and mortality outcomes", () => {
  const older = createEngine(beforeNaming), current = createEngine(afterNaming);
  const finish = (engine: LifeEngine, seed: string) => {
    let life = engine.start(seed);
    for (let commands = 0; life.phase !== "ended" && commands < 500; commands++) {
      life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
    }
    assert.equal(life.phase, "ended");
    return { age: life.age, year: life.year, stats: life.stats, character: life.character, deathCauseId: life.deathCauseId, rngState: life.rngState, commands: life.commands };
  };
  for (let seed = 0; seed < 20; seed++) assert.deepEqual(finish(current, `cause-name-parity-${seed}`), finish(older, `cause-name-parity-${seed}`));
});

test("the authored night cargo risk can cause its exact death and replays that decision", () => {
  const world = structuredClone(pack) as WorldPack;
  // Isolate the unchanged authored fatal branch from additional adult illness draws.
  delete world.health!.mortalityCalibration;
  const engine = createEngine(world);
  let state = engine.start("coherent-night-cargo-240");
  for (let commands = 0; commands < 160 && state.phase !== "ended" && (state.age < 25 || state.phase === "choice"); commands++) {
    state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
  }
  assert.equal(state.phase, "ready");
  assert.equal(state.age, 25);
  const nightWork = engine.getActivities(state).find(activity => activity.id === "take-night-cargo-work")!;
  assert.equal(nightWork.available, true, nightWork.reason);
  const dead = engine.act(state, "take-night-cargo-work");
  assert.equal(dead.phase, "ended");
  assert.equal(dead.deathCauseId, "cargo-crush");
  assert.match(dead.deathCauseContext!, /Move heavy cargo at night/);
  assert.deepEqual(engine.replay(dead.seed, dead.commands), dead);
  assert.deepEqual(engine.load(engine.save(dead)), dead);
});

test("every dangerous narrative decision offers a safe alternative and names its fatal cause", () => {
  const causeIds = new Set(pack.character.deathCauses.filter(cause => cause.choiceOnly).map(cause => cause.id));
  const dangerous = pack.events.filter(event => event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "end" && "deathCause" in effect))));
  assert.equal(dangerous.length, 6);
  for (const event of dangerous) {
    assert.ok(event.choices.some(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))), event.id);
    for (const choice of event.choices) for (const outcome of choice.outcomes) for (const effect of outcome.effects) {
      if (effect.type === "end" && "deathCause" in effect) assert.ok(causeIds.has(effect.deathCause), `${event.id}: missing causal-only hazard`);
    }
  }
});

function safeEngine(): LifeEngine {
  const copy = structuredClone(pack);
  copy.mortality.bands.forEach(band => { band.annualProbability = 0; });
  copy.health.incidenceBands.forEach(band => { band.annualProbability = 0; });
  copy.health.declineBands.forEach(band => { band.healthLoss = 0; });
  copy.yearlyEffects.push({ type: "stat", stat: "health", delta: 100 });
  // A well-resourced controlled household keeps these route checks focused on
  // skill and family transitions; the unmodified pack is exercised separately.
  copy.stats.wealth.initial = 80;
  copy.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of copy.origins) origin.statRanges.wealth = { min: 80, max: 80 };
  return createEngine(copy);
}

function settle(engine: LifeEngine, state: LifeState): LifeState {
  while (state.phase === "choice") {
    const choices = engine.getChoices(state);
    const choice = choices.find(candidate => candidate.id === "learn-letters")
      ?? choices.find(candidate => candidate.id === "practice-reading")
      ?? choices.find(candidate => candidate.id === "keep-regular-job")
      ?? choices[0];
    assert.ok(choice, `No offered choice at ${state.pendingEventId}.`);
    state = engine.choose(state, choice.id);
  }
  return state;
}

function ageTo(engine: LifeEngine, state: LifeState, target: number): LifeState {
  state = settle(engine, state);
  while (state.age < target && state.phase !== "ended") state = settle(engine, engine.advance(state));
  return state;
}

test("Alexandria training visibly unlocks authored job and narrative career requirements", () => {
  const engine = safeEngine();
  let state = ageTo(engine, engine.start("alexandria-training"), 14);
  const locked = engine.getActivities(state).find(activity => activity.id === "work-copyist")!;
  assert.equal(locked.available, false);
  assert.throws(() => engine.act(state, "work-copyist"), /Requires Literacy 30/);
  const seamanshipBeforeTraining = state.character!.skills.seamanship;
  state = engine.act(state, "train-seamanship");
  state = engine.act(ageTo(engine, state, 15), "train-seamanship");
  assert.ok(state.character!.skills.seamanship >= seamanshipBeforeTraining + 12, "Both accepted lessons add skill alongside any narrative or job gains.");
  state = engine.act(ageTo(engine, state, 16), "train-seamanship");
  while (state.age < 18) state = settle(engine, engine.advance(state));
  // The narrative may be paced beyond the birthday; check actual skill gates,
  // rather than relying on a fixed global decision schedule.
  state = ageTo(engine, state, 20);
  assert.notEqual(state.character!.jobId, "sailor", "Keep the earlier job so this test exercises the voluntary career unlock.");
  const sailor = engine.getActivities(state).find(activity => activity.id === "work-sailor")!;
  assert.equal(sailor.available, true, sailor.reason);
  state = engine.act(state, "work-sailor");
  assert.equal(state.character!.jobId, "sailor");
  const wealth = state.stats.wealth;
  const skillBeforeWork = state.character!.skills.seamanship;
  state = ageTo(engine, state, 21);
  assert.ok(state.stats.wealth >= wealth, "The authored sailor job pays annual income.");
  assert.ok(state.character!.skills.seamanship > skillBeforeWork);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("Alexandria supports chosen marriages, named children, care, divorce, remarriage and a replayable completed record", () => {
  const engine = safeEngine();
  let state = ageTo(engine, engine.start("alexandria-character-smoke"), 20);
  for (let attempts = 0; state.character!.relationshipStatus !== "courting" && attempts < 6; attempts++) {
    state = engine.act(state, "court-demetria");
    if (state.character!.relationshipStatus !== "courting") state = ageTo(engine, state, state.age + 2);
  }
  assert.equal(state.character!.partnerId, "demetria");
  state = ageTo(engine, state, state.age + 1);
  state = engine.act(state, "marry-demetria");
  assert.equal(state.character!.relationshipStatus, "married");
  state = ageTo(engine, state, state.age + 1);
  for (let attempts = 0; state.character!.children.length === 0 && attempts < 6; attempts++) {
    state = engine.act(state, "grow-household");
    if (!state.character!.children.length) state = ageTo(engine, state, state.age + 2);
  }
  assert.equal(state.character!.children.length, 1);
  const child = state.character!.children[0];
  assert.ok(pack.character.childNames.includes(child.name));
  assert.equal(child.otherParentId, "demetria");
  state = ageTo(engine, state, state.age + 1);
  state = engine.act(state, "care-for-children");
  state = ageTo(engine, state, state.age + 1);
  state = engine.act(state, "divorce");
  assert.equal(state.character!.relationshipStatus, "divorced");
  assert.deepEqual(state.character!.children, [child]);
  state = ageTo(engine, state, state.age + 1);
  for (let attempts = 0; state.character!.relationshipStatus !== "courting" && attempts < 6; attempts++) {
    state = engine.act(state, "court-thais");
    if (state.character!.relationshipStatus !== "courting") state = ageTo(engine, state, state.age + 2);
  }
  state = ageTo(engine, state, state.age + 1);
  state = engine.act(state, "marry-thais");
  assert.equal(state.character!.partnerId, "thais");
  assert.equal(state.character!.children[0].otherParentId, "demetria");
  assert.deepEqual(engine.load(engine.save(state)), state);
  state = ageTo(engine, state, 100);
  assert.equal(state.phase, "ended");
  assert.equal(state.endingId, "end-of-record");
  assert.equal(state.deathCauseId, undefined);
  assert.equal(state.deathCauseContext, undefined);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("varied complete Alexandria lives can exercise available activities without invalid transitions", () => {
  const engine = createEngine(pack);
  for (let seed = 0; seed < 35; seed++) {
    let state = engine.start(`character-coverage-${seed}`);
    for (let step = 0; step < 700 && state.phase !== "ended"; step++) {
      if (state.phase === "choice") {
        const choices = engine.getChoices(state);
        state = engine.choose(state, choices[(seed + state.age) % choices.length].id);
      } else {
        const actions = engine.getActivities(state).filter(activity => activity.available);
        if (actions.length && state.character!.lastActivityAge !== state.age) state = engine.act(state, actions[(seed + state.age) % actions.length].id);
        else state = engine.advance(state);
      }
    }
    assert.equal(state.phase, "ended", state.seed);
    if (engine.world.endings.find(ending => ending.id === state.endingId)?.kind === "death") assert.ok(state.deathCauseId, state.seed);
    else assert.equal(state.deathCauseId, undefined, state.seed);
    assert.deepEqual(engine.replay(state.seed, state.commands), state);
  }
});
