import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, Effect, LifeEngine, LifeEvent, LifeState, WorldPack } from "../src/types.ts";

function decision(effects: Effect[] = [], id = "continue"): Choice {
  return {
    id,
    text: "Continue",
    outcomes: [{ id: "result", text: "Something changes.", weight: 1, effects }],
  };
}

function scheduled(id: string, age: number, effects: Effect[] = []): LifeEvent {
  return { id, title: id, text: "A test event.", trigger: { type: "age", at: age }, choices: [decision(effects)] };
}

function world(overrides: Partial<WorldPack> = {}): WorldPack {
  return {
    schemaVersion: 1,
    id: "test-world",
    version: "1.0.0",
    title: "Fictional engine test world",
    description: "Testing data, not historical evidence.",
    startYear: 100,
    maxAge: 8,
    stats: {
      health: { label: "Health", min: 0, max: 10, initial: 5 },
      wealth: { label: "Wealth", min: 0, max: 10, initial: 5 },
    },
    flags: { trained: { label: "Trained", initial: false } },
    origins: [{ id: "ordinary", title: "Ordinary", text: "An ordinary birth.", weight: 1, effects: [] }],
    yearlyEffects: [],
    events: [],
    endings: [{ id: "complete", title: "Life complete", text: "A life ends." }],
    defaultEnding: "complete",
    ...overrides,
  };
}

function finish(engine: LifeEngine, initial: LifeState): LifeState {
  let state = initial;
  for (let commands = 0; commands < 500; commands++) {
    if (state.phase === "ended") return state;
    state = state.phase === "choice"
      ? engine.choose(state, engine.getChoices(state)[0].id)
      : engine.advance(state);
  }
  assert.fail("A bounded test life did not terminate.");
}

test("the same seed and accepted commands reproduce an entire life", () => {
  const engine = createEngine(world({
    origins: [
      { id: "ordinary", title: "Ordinary", text: "Birth one.", weight: 1, effects: [] },
      { id: "fortunate", title: "Fortunate", text: "Birth two.", weight: 3, effects: [{ type: "stat", stat: "wealth", delta: 2 }] },
    ],
    events: [{
      id: "opportunity", title: "Opportunity", text: "Take a chance.",
      trigger: { type: "random", weight: 1 }, maxOccurrences: 3, cooldownYears: 2,
      when: { type: "age", op: "gte", value: 1 },
      choices: [{ id: "try", text: "Try", outcomes: [
        { id: "gain", text: "A gain.", weight: 2, effects: [{ type: "stat", stat: "wealth", delta: 2 }] },
        { id: "loss", text: "A loss.", weight: 1, effects: [{ type: "stat", stat: "wealth", delta: -2 }] },
      ] }],
    }],
  }));
  const first = finish(engine, engine.start("repeatable-life"));
  const second = finish(engine, engine.start("repeatable-life"));
  assert.deepEqual(second, first);
  assert.deepEqual(engine.replay(first.seed, first.commands), first);
});

test("weighted birth backgrounds produce varied deterministic starts", () => {
  const engine = createEngine(world({ origins: [
    { id: "rare", title: "Rare", text: "Rare birth.", weight: 1, effects: [] },
    { id: "common", title: "Common", text: "Common birth.", weight: 3, effects: [] },
  ] }));
  const counts = { rare: 0, common: 0 };
  for (let i = 0; i < 400; i++) counts[engine.start(`birth-${i}`).originId as keyof typeof counts]++;
  assert.ok(counts.rare > 0);
  assert.ok(counts.common > counts.rare * 1.5);
  assert.equal(counts.rare + counts.common, 400);
});

test("rejected commands preserve the original state and random stream", () => {
  const engine = createEngine(world({ events: [scheduled("first", 0)] }));
  const before = engine.start("invalid-commands");
  const snapshot = structuredClone(before);
  assert.throws(() => engine.advance(before));
  assert.throws(() => engine.choose(before, "missing-choice"));
  assert.deepEqual(before, snapshot);
  assert.equal(before.rngState, snapshot.rngState);
  assert.ok(Object.isFrozen(before));
  assert.ok(Object.isFrozen(before.stats));
  const after = engine.choose(before, "continue");
  assert.deepEqual(before, snapshot);
  assert.equal(after.phase, "ready");
  assert.throws(() => engine.choose(after, "continue"));
});

test("all scheduled events at the same age are offered before time advances", () => {
  const engine = createEngine(world({ events: [scheduled("first", 0), scheduled("second", 0), scheduled("third", 1)] }));
  let state = engine.start("scheduled-queue");
  assert.equal(state.pendingEventId, "first");
  state = engine.choose(state, "continue");
  assert.equal(state.age, 0);
  assert.equal(state.pendingEventId, "second");
  state = engine.choose(state, "continue");
  assert.equal(state.phase, "ready");
  state = engine.advance(state);
  assert.equal(state.age, 1);
  assert.equal(state.pendingEventId, "third");
  assert.deepEqual(state.eventCounts, { first: 1, second: 1, third: 1 });
});

test("a scheduled event can become eligible after another choice at its due age", () => {
  const deferred = scheduled("trained-path", 0);
  deferred.when = { type: "flag", flag: "trained", value: true };
  const engine = createEngine(world({ events: [
    deferred,
    scheduled("training", 0, [{ type: "flag", flag: "trained", value: true }]),
  ] }));
  let state = engine.start("deferred-event");
  assert.equal(state.pendingEventId, "training");
  state = engine.choose(state, "continue");
  assert.equal(state.pendingEventId, "trained-path");
  assert.equal(state.age, 0);
  assert.equal(state.flags.trained, true);
});

test("events without an available choice cannot deadlock progression", () => {
  const blocked = scheduled("blocked", 0);
  blocked.choices[0].when = { type: "flag", flag: "trained", value: true };
  const engine = createEngine(world({ events: [blocked] }));
  const state = engine.start("no-eligible-choices");
  assert.equal(state.phase, "ready");
  const ended = finish(engine, state);
  assert.equal(ended.phase, "ended");
  assert.equal(ended.eventCounts.blocked ?? 0, 0);
});

test("nested conditions filter choices using stats, origin, age and flags", () => {
  const event = scheduled("options", 1);
  event.choices = [
    { ...decision([], "available"), when: { type: "all", conditions: [
      { type: "origin", origin: "ordinary" },
      { type: "age", op: "eq", value: 1 },
      { type: "any", conditions: [
        { type: "stat", stat: "wealth", op: "gte", value: 5 },
        { type: "flag", flag: "trained", value: true },
      ] },
      { type: "not", condition: { type: "flag", flag: "trained", value: true } },
    ] } },
    { ...decision([], "unavailable"), when: { type: "stat", stat: "wealth", op: "gt", value: 9 } },
  ];
  const engine = createEngine(world({ events: [event] }));
  const state = engine.advance(engine.start("conditions"));
  assert.deepEqual(engine.getChoices(state).map(choice => choice.id), ["available"]);
  assert.throws(() => engine.choose(state, "unavailable"));
});

test("repeatable random events respect cooldown and occurrence limits", () => {
  const engine = createEngine(world({ maxAge: 9, events: [{
    id: "repeat", title: "Repeat", text: "A recurring event.",
    trigger: { type: "random", weight: 1 },
    when: { type: "age", op: "gte", value: 1 },
    maxOccurrences: 3, cooldownYears: 2, choices: [decision()],
  }] }));
  const ended = finish(engine, engine.start("cooldowns"));
  assert.deepEqual(ended.journal.filter(entry => entry.type === "event").map(entry => entry.age), [1, 3, 5]);
  assert.equal(ended.eventCounts.repeat, 3);
});

test("weighted outcomes vary across seeds while preserving stat bounds", () => {
  const event = scheduled("gamble", 0);
  event.choices = [{ id: "try", text: "Try", outcomes: [
    { id: "gain", text: "Gain.", weight: 3, effects: [{ type: "stat", stat: "wealth", delta: 100 }] },
    { id: "loss", text: "Loss.", weight: 1, effects: [{ type: "stat", stat: "wealth", delta: -100 }] },
  ] }];
  const engine = createEngine(world({ events: [event] }));
  const counts = { gain: 0, loss: 0 };
  for (let i = 0; i < 400; i++) {
    const state = engine.choose(engine.start(`outcome-${i}`), "try");
    if (state.stats.wealth === 10) counts.gain++;
    else if (state.stats.wealth === 0) counts.loss++;
    else assert.fail("An outcome did not clamp the affected stat.");
  }
  assert.ok(counts.loss > 0);
  assert.ok(counts.gain > counts.loss * 1.5);
});

test("yearly effects and conditional endings resolve before due events", () => {
  const engine = createEngine(world({
    yearlyEffects: [{ type: "stat", stat: "health", delta: -5 }],
    events: [scheduled("too-late", 1)],
    endings: [
      { id: "illness", title: "Illness", text: "Health ran out.", when: { type: "stat", stat: "health", op: "lte", value: 0 } },
      { id: "complete", title: "Complete", text: "Life complete." },
    ],
  }));
  const state = engine.advance(engine.start("ending-order"));
  assert.equal(state.age, 1);
  assert.equal(state.stats.health, 0);
  assert.equal(state.endingId, "illness");
  assert.equal(state.phase, "ended");
  assert.equal(state.eventCounts["too-late"] ?? 0, 0);
});

test("an explicit ending effect terminates the choice and clears its decision", () => {
  const engine = createEngine(world({ events: [scheduled("departure", 0, [
    { type: "end", ending: "complete" },
    { type: "stat", stat: "wealth", delta: 5 },
  ])] }));
  const state = engine.choose(engine.start("explicit-ending"), "continue");
  assert.equal(state.phase, "ended");
  assert.equal(state.pendingEventId, null);
  assert.equal(state.endingId, "complete");
  assert.equal(state.stats.wealth, 5);
});

test("maximum age ends a quiet life and terminal states reject commands", () => {
  const engine = createEngine(world({ maxAge: 3 }));
  const state = finish(engine, engine.start("quiet-life"));
  assert.equal(state.age, 3);
  assert.equal(state.endingId, "complete");
  const snapshot = structuredClone(state);
  assert.throws(() => engine.advance(state));
  assert.throws(() => engine.choose(state, "continue"));
  assert.deepEqual(state, snapshot);
});

test("saving and loading mid-decision preserves the exact continuation", () => {
  const engine = createEngine(world({ events: [scheduled("first", 1), scheduled("second", 1)] }));
  const pending = engine.advance(engine.start("save-continuity"));
  assert.equal(pending.phase, "choice");
  const restored = engine.load(engine.save(pending));
  assert.deepEqual(restored, pending);
  assert.deepEqual(finish(engine, restored), finish(engine, pending));
});

test("save import rejects incompatible content, unsupported versions and invalid command histories", () => {
  const pack = world({ events: [scheduled("decision", 0)] });
  const engine = createEngine(pack);
  const saved = engine.save(engine.start("untrusted-save"));
  const changed = createEngine({ ...pack, title: "Changed content under the same version" });
  assert.throws(() => changed.load(saved));
  const wrongVersion = JSON.parse(saved);
  wrongVersion.schemaVersion = 2;
  assert.throws(() => engine.load(JSON.stringify(wrongVersion)));
  const wrongCommand = JSON.parse(saved);
  wrongCommand.commands.push({ type: "choose", choice: "does-not-exist" });
  assert.throws(() => engine.load(JSON.stringify(wrongCommand)));
  assert.throws(() => engine.load("not json"));
});

test("BCE progression skips year zero and delivers calendar-dated events", () => {
  const dated = scheduled("dated", 1);
  dated.trigger = { type: "year", at: -1 };
  const engine = createEngine(world({ startYear: -2, events: [dated] }));
  let state = engine.start("calendar");
  assert.equal(state.year, -2);
  state = engine.advance(state);
  assert.equal(state.year, -1);
  assert.equal(state.pendingEventId, "dated");
  state = engine.choose(state, "continue");
  state = engine.advance(state);
  assert.equal(state.year, 1);
  assert.equal(state.age, 2);
  state = engine.advance(state);
  assert.equal(state.year, 2);
});

test("many seeded lives finish without invalid numeric state or unresolved decisions", () => {
  const engine = createEngine(world({
    yearlyEffects: [{ type: "stat", stat: "health", delta: -0.25 }],
    events: [scheduled("learn", 1, [{ type: "flag", flag: "trained", value: true }]), {
      id: "work", title: "Work", text: "A recurring opportunity.", trigger: { type: "random", weight: 2 },
      maxOccurrences: 5, cooldownYears: 1, when: { type: "flag", flag: "trained", value: true },
      choices: [decision([{ type: "stat", stat: "wealth", delta: 1 }])],
    }],
  }));
  for (let i = 0; i < 100; i++) {
    const state = finish(engine, engine.start(`bounded-${i}`));
    assert.equal(state.phase, "ended");
    assert.equal(state.pendingEventId, null);
    assert.ok(state.age <= engine.world.maxAge);
    assert.ok(Object.values(state.stats).every(Number.isFinite));
    assert.ok(Object.values(state.stats).every(value => value >= 0 && value <= 10));
  }
});
