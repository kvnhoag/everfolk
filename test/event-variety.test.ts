import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { randomEventWeights } from "../src/event-variety.ts";
import type { EventVariety, JournalEntry, LifeEvent, WorldPack } from "../src/types.ts";

const policy: EventVariety = { recentWindow: 6, recentWeight: 0.08, repeatWeight: 0.35 };
function story(id: string, weight = 1, automatic = true): LifeEvent {
  return { id, title: id, text: "A synthetic story.", trigger: { type: "random", weight }, maxOccurrences: 100,
    ...(automatic ? { mode: "automatic" as const } : {}),
    choices: automatic ? [] : [{ id: "ok", text: "Continue", outcomes: [{ id: "done", text: "Done.", weight: 1, effects: [] }] }] };
}
function fixture(variety?: EventVariety): WorldPack {
  return { schemaVersion: 1, id: "variety-test", version: "1", title: "Variety fixture", description: "Synthetic.",
    startYear: -20, maxAge: 40, stats: { knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0 } },
    flags: {}, origins: [{ id: "home", title: "Home", text: "Home.", weight: 1, effects: [] }], yearlyEffects: [],
    eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3, ...(variety ? { variety } : {}) },
    events: [story("a"), story("b"), story("c"), story("d", 1, false), story("e", 1, false)],
    endings: [{ id: "complete", title: "Complete", text: "Complete." }], defaultEnding: "complete" };
}
const record = (id: string, type: JournalEntry["type"] = "event"): JournalEntry => ({ type, id, text: id, age: 1, year: -19 });
const near = (actual: number, expected: number, context = "weight") => assert.ok(Math.abs(actual - expected) < 1e-12, `${context}: ${actual} != ${expected}`);

test("variety softly penalizes recent and frequently seen events while preserving authored weight ratios", () => {
  const events = [story("fresh", 10), story("rare", 0.1), story("seen", 10), story("recent", 10)];
  const state = { eventCounts: { seen: 2, recent: 1 }, journal: [record("recent")] };
  const before = structuredClone(state);
  const weights = randomEventWeights(events, new Map(events.map(event => [event.id, event])), state, policy);
  near(weights.get("fresh")!, 1);
  near(weights.get("rare")!, 0.01);
  near(weights.get("seen")!, 1 / (1 + 2 * (1 / policy.repeatWeight - 1)));
  near(weights.get("recent")!, policy.repeatWeight * policy.recentWeight);
  assert.ok([...weights.values()].every(weight => weight > 0), "no eligible event is forced or removed");
  assert.deepEqual(state, before, "previewing weights cannot mutate frozen life history");
});

test("automatic and decision recency have independent windows and ignore non-story journal entries", () => {
  const a = story("a"), b = story("b"), c = story("c"), d = story("d", 1, false), e = story("e", 1, false);
  const expired = story("expired");
  const history: JournalEntry[] = [record("a"), record("d"), record("expired"), record("b"), record("e"),
    record("b", "choice"), record("a", "outcome"), record("dated-history"), record("care-interrupt"), record("collection-interrupt")];
  const map = new Map([a, b, c, d, e, expired].map(event => [event.id, event]));
  const weights = randomEventWeights([a, b, c, d, e], map, { eventCounts: {}, journal: history }, { ...policy, recentWindow: 2 });
  near(weights.get("a")!, 1, "aged-out background leaves the automatic window");
  near(weights.get("b")!, policy.recentWeight);
  near(weights.get("c")!, 1);
  near(weights.get("d")!, policy.recentWeight);
  near(weights.get("e")!, policy.recentWeight);
});

test("normalization remains finite for subnormal authored weights and large occurrence counts", () => {
  const events = [story("a", Number.MIN_VALUE), story("b", Number.MIN_VALUE)];
  const weights = randomEventWeights(events, new Map(events.map(event => [event.id, event])), {
    eventCounts: { a: Number.MAX_SAFE_INTEGER, b: Number.MAX_SAFE_INTEGER }, journal: [record("a"), record("b")],
  }, { recentWindow: 2, recentWeight: 0.001, repeatWeight: 0.001 });
  assert.deepEqual([...weights.values()], [1, 1]);
});

test("a single eligible story still fills every year and keeps exact replay and save/load", () => {
  const pack = fixture(policy);
  pack.events = [story("only-story", Number.MIN_VALUE)];
  const engine = createEngine(pack);
  let state = engine.start("single-event-variety");
  for (let age = 1; age <= 25; age++) {
    state = engine.advance(state);
    assert.equal(state.eventCounts["only-story"], age);
  }
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("enabled variety substantially reduces consecutive repetition across deterministic lives", () => {
  const pack = fixture();
  pack.events = Array.from({ length: 8 }, (_, i) => story(`story-${i}`));
  const countRepeats = (variety?: EventVariety): number => {
    const engine = createEngine({ ...pack, eventPacing: { ...pack.eventPacing!, ...(variety ? { variety } : {}) } });
    let repeats = 0;
    for (let seed = 0; seed < 40; seed++) {
      let state = engine.start(`repeat-cohort-${seed}`);
      for (let age = 1; age <= 30; age++) state = engine.advance(state);
      const events = state.journal.filter(entry => entry.type === "event");
      for (let i = 1; i < events.length; i++) if (events[i].id === events[i - 1].id) repeats++;
      assert.deepEqual(engine.replay(state.seed, state.commands), state);
    }
    return repeats;
  };
  const legacy = countRepeats(), varied = countRepeats(policy);
  assert.ok(legacy > 100, `legacy cohort should expose the repeated-story problem (${legacy})`);
  assert.ok(varied < legacy * 0.25, `expected substantial reduction, legacy=${legacy}, variety=${varied}`);
  assert.ok(varied > 0, "recency is a soft penalty, never a forced unseen-story rotation");
});

test("packs without variety retain their exact legacy event sequence and random state", () => {
  const engine = createEngine(fixture());
  let state = engine.start("legacy-golden");
  while (state.age < 12) {
    state = engine.advance(state);
    if (state.phase === "choice") state = engine.choose(state, "ok");
  }
  assert.deepEqual(state.journal.filter(entry => entry.type === "event").map(entry => entry.id),
    ["b", "c", "d", "a", "c", "e", "b", "c", "d", "b", "b", "e", "c", "c", "e", "a", "c"]);
  assert.equal(state.rngState, 3105167318);
  assert.equal(state.nextChoiceAge, 13);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("variety policies validate complete bounded settings before simulation", () => {
  for (const value of [
    { ...policy, recentWindow: 0 }, { ...policy, recentWindow: 1001 }, { ...policy, recentWindow: 1.5 },
    { ...policy, recentWeight: 0 }, { ...policy, repeatWeight: Number.MIN_VALUE },
    { ...policy, repeatWeight: 1.01 }, { ...policy, recentWeight: Infinity },
    { recentWindow: 6, recentWeight: 0.1 }, { ...policy, unknown: 1 }, null,
  ]) {
    const world = fixture();
    world.eventPacing!.variety = value as EventVariety;
    assert.throws(() => validateWorld(world), /eventPacing.variety/);
  }
  validateWorld(fixture(policy));
  validateWorld(fixture({ recentWindow: 1000, recentWeight: 1, repeatWeight: 1 }));
});
