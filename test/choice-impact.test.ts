import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, Effect, WorldPack } from "../src/types.ts";
import { formatImpactDelta, getChoiceImpact } from "../client/choice-impact.ts";

function option(branches: Effect[][], weights = branches.map(() => 1)): Choice {
  return { id: "decide", text: "Make a choice", outcomes: branches.map((effects, index) => ({
    id: `branch-${index}`, text: `Outcome ${index + 1}`, weight: weights[index], effects,
  })) };
}

function world(choice: Choice): WorldPack {
  return {
    schemaVersion: 1, id: "impact-test", version: "1", title: "Impact fixture", description: "Synthetic preview fixture.",
    startYear: -50, maxAge: 100,
    stats: {
      health: { label: "Health", min: 0, max: 100, initial: 98 },
      knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0 },
      wealth: { label: "Resources", min: 0, max: 100, initial: 2 },
      bonds: { label: "Bonds", min: 0, max: 100, initial: 60 },
    },
    flags: { opened: { label: "Opened", initial: false } },
    origins: [{ id: "household", title: "Household", text: "A fictional beginning.", weight: 1, effects: [] }],
    yearlyEffects: [{ type: "stat", stat: "health", delta: -9 }],
    events: [{ id: "opening", title: "Opening", text: "A decision.", trigger: { type: "age", at: 0 }, choices: [choice] }],
    endings: [{ id: "complete", title: "Complete", text: "The life ends." }], defaultEnding: "complete",
  };
}

test("choice previews show all four stats and truthful bounded ranges for weighted outcomes", () => {
  const choice = option([
    [{ type: "stat", stat: "health", delta: 5 }, { type: "stat", stat: "wealth", delta: -5 }],
    [{ type: "stat", stat: "health", delta: -4 }, { type: "stat", stat: "wealth", delta: 4 }],
  ], [3, 1]);
  const pack = world(choice);
  const life = createEngine(pack).start("weighted-preview");
  const impact = getChoiceImpact(choice, life, pack);
  assert.deepEqual(impact.stats, [
    { id: "health", label: "Health", min: -4, max: 2, variable: true },
    { id: "knowledge", label: "Knowledge", min: 0, max: 0, variable: false },
    { id: "wealth", label: "Resources", min: -2, max: 4, variable: true },
    { id: "bonds", label: "Bonds", min: 0, max: 0, variable: false },
  ]);
  assert.equal(impact.hasVariableOutcomes, true);
  assert.equal(impact.canEndLife, false);
});

test("sequential bounded effects match actual direct engine results instead of summing deltas", () => {
  const choice = option([[
    { type: "stat", stat: "health", delta: 10 },
    { type: "stat", stat: "health", delta: -10 },
    { type: "stat", stat: "wealth", delta: -10 },
    { type: "stat", stat: "wealth", delta: 10 },
  ]]);
  const pack = world(choice);
  const engine = createEngine(pack);
  const life = engine.start("bounded-preview");
  const impact = getChoiceImpact(choice, life, pack);
  const next = engine.choose(life, choice.id);
  for (const stat of impact.stats) {
    assert.equal(stat.min, next.stats[stat.id] - life.stats[stat.id]);
    assert.equal(stat.min, stat.max);
  }
  assert.equal(impact.stats[0].min, -8);
  assert.equal(impact.stats[2].min, 8);
});

test("an explicit ending stops later stat effects and is flagged even in a rare branch", () => {
  const choice = option([
    [{ type: "stat", stat: "bonds", delta: 3 }],
    [{ type: "stat", stat: "bonds", delta: -2 }, { type: "end", ending: "complete" }, { type: "stat", stat: "bonds", delta: 40 }],
  ], [1, Number.MIN_VALUE]);
  const pack = world(choice);
  const life = createEngine(pack).start("terminal-preview");
  const impact = getChoiceImpact(choice, life, pack);
  assert.equal(impact.canEndLife, true);
  assert.deepEqual(impact.stats.at(-1), { id: "bonds", label: "Bonds", min: -2, max: 3, variable: true });
  const terminal = { ...choice, outcomes: [choice.outcomes[1]] };
  const terminalPack = world(terminal);
  const engine = createEngine(terminalPack);
  const born = engine.start("terminal-result");
  const next = engine.choose(born, choice.id);
  assert.equal(next.phase, "ended");
  assert.equal(getChoiceImpact(terminal, born, terminalPack).stats.at(-1)!.min, next.stats.bonds - born.stats.bonds);
});

test("previews preserve snapshots and randomness and exclude yearly or unlocked event effects", () => {
  const choice = option([[{ type: "flag", flag: "opened", value: true }]]);
  const pack = world(choice);
  pack.events.push({ id: "follow-up", title: "Follow-up", text: "A separate event.", trigger: { type: "age", at: 0 },
    when: { type: "flag", flag: "opened", value: true }, mode: "automatic", choices: [],
    effects: [{ type: "stat", stat: "health", delta: -7 }],
  });
  const engine = createEngine(pack);
  const life = engine.start("pure-preview");
  const beforeLife = structuredClone(life);
  const beforePack = structuredClone(pack);
  const impact = getChoiceImpact(choice, life, pack);
  assert.ok(impact.stats.every(stat => stat.min === 0 && stat.max === 0));
  assert.deepEqual(life, beforeLife);
  assert.deepEqual(pack, beforePack);
  const actual = engine.choose(life, choice.id);
  assert.equal(actual.stats.health - life.stats.health, -7, "queued events remain separate from the labeled direct preview");
  assert.equal(life.rngState, beforeLife.rngState);
  impact.stats[0].min = 123;
  assert.deepEqual(life, beforeLife, "the returned display data is detached from the life snapshot");
});

test("positive subnormal weights remain possible branches and tiny real deltas are not lost", () => {
  const choice = option([
    [{ type: "stat", stat: "knowledge", delta: 1e-12 }],
    [{ type: "stat", stat: "knowledge", delta: 2e-12 }],
  ], [Number.MIN_VALUE, Number.MIN_VALUE]);
  const pack = world(choice);
  const life = createEngine(pack).start("tiny-preview");
  const stat = getChoiceImpact(choice, life, pack).stats[1];
  assert.equal(stat.min, 1e-12);
  assert.equal(stat.max, 2e-12);
  assert.equal(formatImpactDelta(stat.min, stat.max), "+1e-12…+2e-12");
});

test("narrative or flag-only outcomes retain four zero deltas and readable formatting", () => {
  const choice = option([[], [{ type: "flag", flag: "opened", value: true }]]);
  const pack = world(choice);
  const life = createEngine(pack).start("zero-preview");
  assert.ok(getChoiceImpact(choice, life, pack).stats.every(stat => !stat.variable && stat.min === 0 && stat.max === 0));
  assert.equal(formatImpactDelta(3), "+3");
  assert.equal(formatImpactDelta(-2, 4), "-2…+4");
  assert.equal(formatImpactDelta(0, 5), "0…+5");
  assert.equal(formatImpactDelta(-0), "0");
  assert.equal(formatImpactDelta(5.2 - 5), "+0.2");
});

test("fatal choice previews disclose the authored branch probability without changing annual mortality", () => {
  const choice = option([[], [{ type: "end", ending: "complete" }]], [98, 2]);
  const pack = world(choice);
  pack.endings[0].kind = "death";
  const life = createEngine(pack).start("fatal-risk-preview");
  const before = structuredClone(life);
  assert.ok(Math.abs(getChoiceImpact(choice, life, pack).deathRisk - .02) < 1e-14);
  assert.deepEqual(life, before);
});
