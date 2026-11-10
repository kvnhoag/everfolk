import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEvent, WorldPack } from "../src/types.ts";

function automatic(id: string, trigger: LifeEvent["trigger"]): LifeEvent {
  return { id, title: id, text: "A synthetic background story.", trigger,
    mode: "automatic", choices: [], maxOccurrences: trigger.type === "random" ? 100 : 1,
    effects: [{ type: "stat", stat: "knowledge", delta: 1 }] };
}

function decision(id: string, trigger: LifeEvent["trigger"]): LifeEvent {
  return { id, title: id, text: "A synthetic decision.", trigger,
    maxOccurrences: trigger.type === "random" ? 100 : 1,
    choices: [{ id: "continue", text: "Continue", outcomes: [
      { id: "result", text: "A synthetic result.", weight: 1, effects: [] },
    ] }] };
}

function world(extra: Partial<WorldPack> = {}): WorldPack {
  return {
    schemaVersion: 1, id: "paced-test", version: "1", title: "Pacing fixture", description: "Synthetic fixture.",
    startYear: -5, maxAge: 40,
    stats: { knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0 } }, flags: {},
    origins: [{ id: "birth", title: "Birth", text: "A synthetic beginning.", weight: 1, effects: [] }],
    yearlyEffects: [], eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3 },
    events: [automatic("ordinary-year", { type: "random", weight: 1 }),
      decision("birth-care", { type: "age", at: 0 }), decision("daily-decision", { type: "random", weight: 1 })],
    endings: [{ id: "complete", title: "Complete", text: "The synthetic life is complete." }], defaultEnding: "complete",
    ...extra,
  };
}

test("paced worlds give each completed living year its own automatic background story", () => {
  const engine = createEngine(world());
  let state = engine.start("annual-background");
  assert.equal(state.pendingEventId, "birth-care");
  assert.equal(state.eventCounts["ordinary-year"], undefined);
  state = engine.choose(state, "continue");
  for (let year = 1; year <= 15; year++) {
    state = engine.advance(state);
    assert.equal(state.age, year);
    assert.equal(state.eventCounts["ordinary-year"], year);
    assert.equal(state.stats.knowledge, year);
    if (state.phase === "choice") {
      const count = state.journal.length;
      state = engine.choose(state, "continue");
      assert.equal(state.eventCounts["ordinary-year"], year);
      assert.equal(state.journal.length, count + 2, "a choice does not roll another background event");
    }
  }
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("random decisions have a deterministic two-or-three-year global gap", () => {
  const engine = createEngine(world());
  const gaps = new Set<number>();
  for (let seed = 0; seed < 12; seed++) {
    let state = engine.start(`gap-${seed}`);
    let previousDecisionAge = 0;
    state = engine.choose(state, "continue");
    while (state.phase !== "ended") {
      state = engine.advance(state);
      if (state.phase === "choice") {
        const gap = state.age - previousDecisionAge;
        assert.ok(gap === 2 || gap === 3, `unexpected decision gap ${gap}`);
        gaps.add(gap);
        previousDecisionAge = state.age;
        state = engine.choose(state, "continue");
      }
    }
    assert.deepEqual(engine.replay(state.seed, state.commands), state);
  }
  assert.deepEqual([...gaps].sort(), [2, 3]);
});

test("dated history, the annual story and a personal decision coexist in one year", () => {
  const engine = createEngine(world({ eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 2 }, events: [
    decision("birth-care", { type: "age", at: 0 }),
    decision("personal-milestone", { type: "age", at: 1 }),
    automatic("dated-history", { type: "year", at: -3 }),
    automatic("ordinary-year", { type: "random", weight: 1 }),
    decision("daily-decision", { type: "random", weight: 1 }),
  ] }));
  let state = engine.choose(engine.start("three-lanes"), "continue");
  state = engine.advance(state);
  assert.equal(state.phase, "ready", "the age-one personal milestone waits for the decision slot");
  state = engine.advance(state);
  assert.equal(state.year, -3);
  assert.equal(state.pendingEventId, "personal-milestone", "scheduled personal milestones take priority over random choices");
  assert.deepEqual(state.journal.filter(entry => entry.age === 2 && entry.type === "event").map(entry => entry.id),
    ["dated-history", "ordinary-year", "personal-milestone"]);
  state = engine.choose(state, "continue");
  assert.equal(state.phase, "ready");
  assert.equal(state.eventCounts["ordinary-year"], 2);
  assert.equal(state.eventCounts["daily-decision"], undefined);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("fixed-year decisions remain hard anchors even between ordinary decision slots", () => {
  const pack = world({ eventPacing: { minChoiceGapYears: 3, maxChoiceGapYears: 3 } });
  pack.events.push(decision("dated-decision", { type: "year", at: -4 }));
  const engine = createEngine(pack);
  let state = engine.choose(engine.start("dated-anchor"), "continue");
  state = engine.advance(state);
  assert.equal(state.age, 1);
  assert.equal(state.pendingEventId, "dated-decision");
  assert.equal(state.eventCounts["ordinary-year"], 1);
  state = engine.choose(state, "continue");
  assert.equal(state.nextChoiceAge, 4);
});

test("a background event can unlock due history without generating a second random event", () => {
  const pack = world({ flags: { unlocked: { label: "Unlocked", initial: false } } });
  const background = pack.events[0];
  background.effects = [{ type: "flag", flag: "unlocked", value: true }];
  pack.events.push({ ...automatic("unlocked-history", { type: "age", at: 1 }),
    when: { type: "flag", flag: "unlocked", value: true } });
  const engine = createEngine(pack);
  const state = engine.advance(engine.choose(engine.start("unlock"), "continue"));
  assert.equal(state.eventCounts["ordinary-year"], 1);
  assert.equal(state.eventCounts["unlocked-history"], 1);
});

test("invalid global decision-gap policies fail before simulation", () => {
  for (const eventPacing of [
    { minChoiceGapYears: 0, maxChoiceGapYears: 3 },
    { minChoiceGapYears: 3, maxChoiceGapYears: 2 },
    { minChoiceGapYears: 2.5, maxChoiceGapYears: 3 },
    { minChoiceGapYears: 2, maxChoiceGapYears: Infinity },
  ]) assert.throws(() => createEngine(world({ eventPacing })), /eventPacing/);
  assert.throws(() => createEngine(world({ eventPacing: { minChoiceGapYears: 2 } as WorldPack["eventPacing"] })), /required field/);
});
