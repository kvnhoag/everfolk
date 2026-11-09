import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import beforeBalance from "../worlds/alexandria-0.17.0.json" with { type: "json" };

const engine = createEngine(pack);
type Career = "stay" | "sail" | "study";

function choiceFor(engine: LifeEngine, state: LifeState, career: Career): string {
  const choices = engine.getChoices(state);
  if (state.pendingEventId === "a-place-on-the-manifest") {
    const chosen = choices.find(choice => choice.id === (career === "stay" && state.character?.jobId === "porter" ? "keep-regular-job" : career));
    assert.ok(chosen, `The ${career} career must be available after its required training.`);
    return chosen.id;
  }
  if (state.pendingEventId === "the-first-letters") return "learn-letters";
  assert.ok(choices.length > 0, "An offered decision must have a way forward.");
  return (choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0]).id;
}

function until(engine: LifeEngine, seed: string, career: Career, stop: (state: LifeState) => boolean, trainSkills = true): LifeState {
  let state = engine.start(seed);
  for (let step = 0; step < 500 && !stop(state) && state.phase !== "ended"; step++) {
    if (state.phase === "choice") state = engine.choose(state, choiceFor(engine, state, career));
    else {
      // Build the actual graded skills through accepted player commands. The
      // narrative literacy flag alone no longer grants every kind of work.
      const trainingId = state.age < 18 && state.character!.skills.literacy < 30 ? "train-literacy"
        : state.age < 18 && state.character!.skills.seamanship < 15 ? "train-seamanship" : undefined;
      const training = trainSkills ? engine.getActivities(state).find(activity => activity.id === trainingId && activity.available) : undefined;
      state = training ? engine.act(state, training.id) : engine.advance(state);
    }
  }
  return state;
}

function withoutMortality(): LifeEngine {
  const copy = structuredClone(pack) as WorldPack;
  // These controlled qualification checks deliberately take the original
  // opening route. The unmodified opening groups are covered separately; a
  // different valid first job must not displace this test's porter fixture.
  const opening = new Set(["a-child-in-the-courtyard", "the-first-letters", "a-place-to-learn", "the-first-wages", "a-place-on-the-manifest"]);
  copy.events = copy.events.filter(event => !event.exclusiveGroup || opening.has(event.id)).map(event => {
    const { exclusiveGroup: _exclusiveGroup, ...retained } = event;
    return retained;
  });
  copy.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  // This progression fixture isolates skill gates from household affordability;
  // unmodified-pack mortality and bounded-stat coverage stays above.
  copy.stats.wealth.initial = 80;
  copy.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of copy.origins) origin.statRanges = { ...origin.statRanges, wealth: { min: 80, max: 80 } };
  return createEngine(copy);
}

test("Alexandria records birth automatically in 66 BCE without a household-care decision", () => {
  const state = engine.start("birth-screen");
  assert.equal(state.age, 0);
  assert.equal(state.year, -66);
  assert.equal(state.phase, "ready");
  assert.equal(state.pendingEventId, null);
  assert.deepEqual(engine.getChoices(state), []);
  assert.equal(state.commands.length, 0);
  assert.equal(state.journal[0].type, "birth");
  assert.equal(state.journal.some(entry => entry.age > 0), false);
});

test("Alexandria newborns vary within their household's configured starting ranges", () => {
  const households = new Map(pack.origins.map(origin => [origin.id, new Set<string>()]));
  for (let index = 0; index < 128; index++) {
    const life = engine.start(`alexandria-origin-cohort-${index}`);
    const origin = engine.world.origins.find(origin => origin.id === life.originId)!;
    assert.equal(life.pendingEventId, null);
    assert.equal(life.age, 0);
    for (const [stat, definition] of Object.entries(engine.world.stats)) {
      const range = origin.statRanges?.[stat] ?? definition.initialRange;
      assert.ok(range, `${origin.id}: ${stat} has a starting range`);
      assert.ok(Number.isInteger(life.stats[stat]) && life.stats[stat] >= range.min && life.stats[stat] <= range.max, `${origin.id}: ${stat} follows its own range`);
    }
    households.get(origin.id)!.add(JSON.stringify(life.stats));
    assert.deepEqual(engine.start(life.seed), life);
  }
  for (const [origin, variations] of households) assert.ok(variations.size > 1, `${origin} produces different individuals`);
});

test("an automatic birth and its continuation survive save/load without skipping childhood", () => {
  const state = engine.start("birth-save");
  const restored = engine.load(engine.save(state));
  assert.deepEqual(restored, state);
  const nextYear = engine.advance(restored);
  assert.equal(nextYear.age, 1);
  assert.equal(nextYear.phase, "ready");
  assert.deepEqual(nextYear, engine.advance(state));
});

test("all three careers can pass the former age-23 boundary and end in old-age death", () => {
  const engine = createEngine(beforeBalance);
  // Discovered by a bounded search across coverage-0..coverage-2999. This seed
  // covers long lived paths; it is not a claim that every birth reaches adulthood.
  for (const career of ["stay", "sail", "study"] as const) {
    const state = until(engine, "coverage-1", career, state => state.phase === "ended");
    assert.equal(state.phase, "ended");
    assert.ok(state.age >= 70 && state.age <= pack.maxAge);
    assert.equal(engine.world.endings.find(ending => ending.id === state.endingId)?.kind, "death");
    assert.equal(state.endingId, "death-in-later-life");
    if (career === "stay") {
      assert.ok(state.journal.some(entry => entry.type === "choice" && entry.id === "keep-regular-job"));
    } else assert.equal(state.flags[career === "sail" ? "sailed" : "studied"], true);
    assert.ok(state.commands.some(command => command.type === "act" && command.activity === "train-seamanship"));
    assert.ok(state.commands.some(command => command.type === "act" && command.activity === "train-literacy"));
    assert.ok(state.journal.some(entry => entry.age > 23));
    assert.ok(state.journal.some(entry => entry.id === "care-between-generations"));
    assert.ok(state.journal.some(entry => entry.id === "putting-things-in-order"));
    assert.equal(state.pendingEventId, null);
    for (const [id, value] of Object.entries(state.stats)) {
      assert.ok(Number.isFinite(value));
      assert.ok(value >= engine.world.stats[id].min && value <= engine.world.stats[id].max);
    }
    assert.deepEqual(engine.load(engine.save(state)), state);
  }
});

test("graded childhood training opens careers and the selected named job receives its own follow-up", () => {
  const safeEngine = withoutMortality();
  const followups = { sail: "letters-across-the-water", study: "the-unfamiliar-page", stay: "the-neighbors-request" };
  for (const career of ["stay", "sail", "study"] as const) {
    const adult = until(safeEngine, `training-${career}`, career, state => state.pendingEventId === "a-place-on-the-manifest");
    assert.ok(adult.age >= 16 && adult.age <= 19, "The personal milestone may wait for the next decision interval.");
    assert.equal(adult.flags.literate, true);
    assert.ok(adult.character!.skills.literacy >= 30);
    assert.ok(adult.character!.skills.seamanship >= 15);
    assert.equal(adult.character!.jobId, "porter", "The earlier work milestone already started this occupation.");
    assert.deepEqual(safeEngine.getChoices(adult).map(choice => choice.id), ["sail", "study", "keep-regular-job"]);
    let next = safeEngine.choose(adult, career === "stay" ? "keep-regular-job" : career);
    assert.equal(next.character!.jobId, career === "stay" ? "porter" : career === "sail" ? "sailor" : "copyist");
    // The new household opportunity can take one decision slot before the
    // named occupation's follow-up; it must not replace that follow-up.
    while (next.phase !== "ended" && next.pendingEventId !== followups[career] && next.age <= adult.age + 6) {
      if (next.phase === "choice") {
        assert.ok(next.pendingEventId?.startsWith("background-"), `Unexpected intervening story: ${next.pendingEventId}`);
        next = safeEngine.choose(next, safeEngine.getChoices(next)[0].id);
      } else next = safeEngine.advance(next);
    }
    assert.ok(next.age - adult.age >= 2 && next.age - adult.age <= 6);
    assert.equal(next.pendingEventId, followups[career]);
  }
});

test("a literacy flag alone does not bypass graded copyist and sailor requirements", () => {
  const safeEngine = withoutMortality();
  const adult = until(safeEngine, "learning-without-extra-training", "stay", state => state.pendingEventId === "a-place-on-the-manifest", false);
  assert.equal(adult.flags.literate, true);
  assert.ok(adult.character!.skills.literacy < 30);
  assert.ok(adult.character!.skills.seamanship < 15);
  assert.equal(adult.character!.jobId, "porter");
  assert.deepEqual(safeEngine.getChoices(adult).map(choice => choice.id), ["keep-regular-job"]);
  const before = structuredClone(adult);
  assert.throws(() => safeEngine.choose(adult, "study"), /unavailable/);
  assert.throws(() => safeEngine.choose(adult, "sail"), /unavailable/);
  assert.deepEqual(adult, before, "Rejected career requests must preserve the current snapshot.");
});
