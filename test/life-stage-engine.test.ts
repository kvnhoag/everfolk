import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { lifeStageAt, lifeStageView } from "../src/life-stages/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";

const FLOOD_YEAR = -300;

const lifeStages: NonNullable<WorldPack["lifeStages"]> = {
  stages: [
    { id: "infancy", title: "Infancy", minAge: 0 },
    { id: "childhood", title: "Childhood", minAge: 3 },
    { id: "adolescence", title: "Adolescence", minAge: 12 },
    { id: "youth", title: "Youth", minAge: 16 },
    { id: "adulthood", title: "Adulthood", minAge: 18 },
  ],
  scopes: { personal: "childhood", work: "adolescence", community: "youth", household: "adulthood" },
};

const flood: LifeEvent = {
  id: "flood", title: "The flood fails", text: "The river stays low.",
  trigger: { type: "year", at: FLOOD_YEAR }, scope: "household",
  choices: [{ id: "ration", text: "Cut every portion", outcomes: [
    { id: "ration-result", text: "Everyone eats less.", weight: 1, effects: [{ type: "stat", stat: "health", delta: -2 }] },
  ] }],
  dependent: {
    text: "The river stays low. The grown-ups decide what the household will do.",
    responses: [
      { id: "household-shares", text: "Your family has grain enough to share with neighbours.", when: { type: "stat", stat: "wealth", op: "gte", value: 50 },
        effects: [{ type: "stat", stat: "bonds", delta: 2 }] },
      { id: "household-rations", text: "Your mother cuts every portion. You go to sleep hungry.",
        effects: [{ type: "stat", stat: "health", delta: -3 }] },
    ],
  },
};

const play: LifeEvent = {
  id: "play", title: "A game in the lane", text: "Children are playing.", trigger: { type: "random", weight: 1 },
  stages: ["childhood"], maxOccurrences: 20, cooldownYears: 1,
  choices: [{ id: "join", text: "Join in", outcomes: [{ id: "join-result", text: "You play.", weight: 1, effects: [] }] }],
};

const contract: LifeEvent = {
  id: "contract", title: "A contract", text: "A dealer offers terms.", trigger: { type: "random", weight: 1 },
  stages: ["childhood", "adolescence", "youth", "adulthood"], scope: "household", maxOccurrences: 50, cooldownYears: 1,
  choices: [{ id: "sign", text: "Sign", outcomes: [{ id: "sign-result", text: "Signed.", weight: 1, effects: [] }] }],
};

function without<T extends object>(value: T, key: keyof T): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function world(startYear: number, extra: Partial<WorldPack> = {}): WorldPack {
  return {
    schemaVersion: 1, id: "stage-test", version: "1", title: "Stages", description: "Synthetic fixture.",
    startYear, maxAge: 40,
    stats: {
      health: { label: "Health", min: 0, max: 100, initial: 50 },
      wealth: { label: "Wealth", min: 0, max: 100, initial: 10 },
      bonds: { label: "Bonds", min: 0, max: 100, initial: 10 },
    },
    flags: {},
    origins: [{ id: "birth", title: "Birth", text: "A synthetic beginning.", weight: 1, effects: [] }],
    yearlyEffects: [], eventPacing: { minChoiceGapYears: 1, maxChoiceGapYears: 1 },
    lifeStages, events: [flood, play, contract],
    endings: [{ id: "complete", title: "Complete", text: "Done." }], defaultEnding: "complete",
    ...extra,
  };
}

/** Plays a life, choosing the first option, and records every offered decision with its age. */
function play_through(pack: WorldPack, seed: string, untilAge: number): { state: LifeState; offered: Array<[number, string]> } {
  const engine = createEngine(pack);
  let state = engine.start(seed);
  const offered: Array<[number, string]> = [];
  while (state.phase !== "ended" && state.age < untilAge) {
    if (state.phase === "choice") {
      offered.push([state.age, state.pendingEventId!]);
      state = engine.choose(state, engine.getChoices(state)[0].id);
    } else state = engine.advance(state);
  }
  return { state, offered };
}

test("life stages are looked up by age and expose what the player decides", () => {
  const pack = world(-301);
  assert.equal(lifeStageAt(pack, 0)?.id, "infancy");
  assert.equal(lifeStageAt(pack, 11)?.id, "childhood");
  assert.equal(lifeStageAt(pack, 17)?.id, "youth");
  assert.equal(lifeStageAt(pack, 70)?.id, "adulthood");
  assert.deepEqual(lifeStageView(pack, 13), { id: "adolescence", title: "Adolescence", decides: ["personal", "work"] });
  assert.deepEqual(lifeStageView(pack, 1), { id: "infancy", title: "Infancy", decides: [] });
  assert.equal(lifeStageView(without(pack, "lifeStages"), 1), undefined);
});

test("a household disaster reaching a one-year-old is decided by the household, with no choice", () => {
  const { state, offered } = play_through(world(-301), "flood-child", 3);
  assert.ok(!offered.some(([, id]) => id === "flood"), "the flood is never offered to a child");
  assert.equal(state.eventCounts.flood, 1);
  const at = state.journal.findIndex(entry => entry.type === "event" && entry.id === "flood");
  assert.ok(at >= 0);
  assert.equal(state.journal[at].age, 1);
  assert.match(state.journal[at].text, /grown-ups decide/);
  assert.equal(state.journal[at + 1].type, "outcome");
  assert.equal(state.journal[at + 1].id, "household-rations");
  assert.equal(state.stats.health, 47);
});

test("the household's response follows the written rule over real state", () => {
  const rich = world(-301, { stats: { ...world(-301).stats, wealth: { label: "Wealth", min: 0, max: 100, initial: 80 } } });
  const { state } = play_through(rich, "flood-rich-child", 3);
  assert.ok(state.journal.some(entry => entry.type === "outcome" && entry.id === "household-shares"));
  assert.equal(state.stats.bonds, 12);
  assert.equal(state.stats.health, 50);
});

test("the same flood reaching an adult is the adult's decision", () => {
  const { offered } = play_through(world(-330), "flood-adult", 32);
  assert.ok(offered.some(([age, id]) => id === "flood" && age === 30));
});

test("events appear only in their life stages, and decisions only from their scope", () => {
  for (const seed of ["a", "b", "c", "d"]) {
    const { offered } = play_through(world(-320), `stages-${seed}`, 40);
    assert.ok(offered.length > 0);
    for (const [age, id] of offered) {
      assert.ok(age >= 3, `no decision in infancy (got ${id} at ${age})`);
      if (id === "play") assert.ok(age >= 3 && age < 12, `play at ${age}`);
      if (id === "contract") assert.ok(age >= 18, `household contract at ${age}`);
    }
    assert.ok(offered.some(([, id]) => id === "contract"));
    assert.ok(offered.some(([, id]) => id === "play"));
  }
});

test("staged lives replay identically from their commands", () => {
  const pack = world(-301);
  const engine = createEngine(pack);
  const { state } = play_through(pack, "replay-stage", 25);
  assert.deepEqual(engine.replay("replay-stage", state.commands), state);
});

test("worlds without life stages keep their old behaviour", () => {
  const legacy = without(world(-301, { events: [without(without(flood, "scope"), "dependent")] }), "lifeStages");
  const { offered } = play_through(legacy, "legacy", 3);
  assert.deepEqual(offered, [[1, "flood"]]);
});

test("validation rejects staged worlds that break the rules", () => {
  validateWorld(world(-301));
  const broken = (patch: Partial<WorldPack>, message: RegExp) =>
    assert.throws(() => validateWorld({ ...world(-301), ...patch }), message);
  broken({ lifeStages: { ...lifeStages, stages: [{ id: "late", title: "Late", minAge: 5 }] } }, /start at age 0/);
  broken({ lifeStages: { ...lifeStages, scopes: { ...lifeStages.scopes, work: "nowhere" } } }, /unknown life stage/);
  broken({ events: [without(play, "stages")] }, /must declare stages/);
  broken({ events: [{ ...play, stages: ["teenage"] }] }, /unknown life stage/);
  broken({ events: [{ ...flood, dependent: { text: "x", responses: [{ id: "only", text: "x", when: { type: "stat", stat: "wealth", op: "gte", value: 1 }, effects: [] }] } }] }, /fallback/);
  broken({ events: [{ ...contract, stages: ["childhood"] }] }, /never be decided/);
  broken({ events: [{ ...without(play, "maxOccurrences"), trigger: { type: "age", at: 1 }, stages: ["childhood"] }] }, /trigger age/);
  assert.throws(() => validateWorld(without(world(-301, { events: [flood] }), "lifeStages")), /requires world.lifeStages/);
});
