import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import alexandria from "../worlds/alexandria-sample.json" with { type: "json" };

function decision(id: string, rare = false, weight = 1): LifeEvent {
  return { id, title: id, text: "An authored encounter.", trigger: { type: "random", weight },
    ...(rare ? { rarity: "rare" as const } : {}), maxOccurrences: 100,
    choices: [{ id: "continue", text: "Continue", outcomes: [{ id: `${id}-done`, text: "You continue.", weight: 1, effects: [] }] }] };
}
function fixture(chance = 1, cooldown = 12): WorldPack {
  return { schemaVersion: 1, id: "rare-fixture", version: "1", title: "Rare fixture", description: "Fictional test events.",
    startYear: -50, maxAge: 80, stats: { knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    eventPacing: { minChoiceGapYears: 3, maxChoiceGapYears: 3, rareEvents: { annualChance: chance, cooldownYears: cooldown } },
    events: [{ id: "background", title: "Background", text: "An ordinary year.", trigger: { type: "random", weight: 1 },
      mode: "automatic", effects: [], choices: [], maxOccurrences: 100 }, decision("ordinary"), decision("rare", true)],
    endings: [{ id: "record", title: "Record", text: "Record complete.", kind: "chapter" }], defaultEnding: "record" };
}
function advanceTo(engine: ReturnType<typeof createEngine>, initial: LifeState, age: number): LifeState {
  let state = initial;
  while (state.age < age || state.phase === "choice") {
    if (state.phase === "ended") break;
    state = state.phase === "choice" ? engine.choose(state, "continue") : engine.advance(state);
  }
  return state;
}
const rareRecords = (state: LifeState) => state.journal.filter(entry => entry.type === "event" && entry.id.startsWith("rare"));
const comparable = (state: LifeState) => {
  const { worldVersion: _version, worldFingerprint: _fingerprint, ...value } = state;
  return value;
};

test("rare interrupts keep the annual background, ordinary deadline and exact replay", () => {
  const engine = createEngine(fixture());
  let state = engine.start("rare-interrupt");
  assert.equal(state.phase, "ready", "birth does not roll a surprise");
  const nextOrdinary = state.nextChoiceAge;
  state = engine.advance(state);
  assert.equal(state.pendingEventId, "rare");
  assert.equal(state.nextChoiceAge, nextOrdinary, "a surprise does not postpone personal decisions");
  assert.deepEqual(state.journal.filter(entry => entry.type === "event").map(entry => entry.id), ["background", "rare"]);
  const frozen = structuredClone(state), random = state.rngState;
  engine.getChoices(state); engine.getChoices(state);
  assert.deepEqual(state, frozen);
  state = engine.choose(state, "continue");
  assert.equal(rareRecords(state).length, 1, "accepting a choice does not roll another surprise");
  assert.equal(state.rngState, random, "a single outcome and fixed pacing need no random draw");
  state = advanceTo(engine, state, 25);
  assert.deepEqual(rareRecords(state).map(entry => entry.age), [1, 13, 25]);
  assert.deepEqual(engine.load(engine.save(state)), state);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
});

test("a shared cooldown applies across different rare events and their own caps still apply", () => {
  const pack = fixture(1, 7);
  pack.events[2].maxOccurrences = 1;
  const other = decision("rare-other", true); other.maxOccurrences = 1;
  pack.events.push(other);
  const engine = createEngine(pack), state = advanceTo(engine, engine.start("shared-cooldown"), 25);
  const records = rareRecords(state);
  assert.equal(records.length, 2);
  assert.equal(new Set(records.map(entry => entry.id)).size, 2);
  assert.deepEqual(records.map(entry => entry.age), [1, 8]);
});

test("ineligible or disabled rare pools consume no randomness and never enter ordinary selection", () => {
  const packs = [fixture(), fixture(0), fixture()];
  delete packs[0].eventPacing!.rareEvents;
  packs[2].events[2].when = { type: "age", op: "gte", value: 79 };
  const engines = packs.map(createEngine), lives = engines.map(engine => advanceTo(engine, engine.start("no-surprise-draw"), 30));
  for (let i = 1; i < lives.length; i++) assert.deepEqual(comparable(lives[i]), comparable(lives[0]));
  lives.forEach(state => assert.equal(rareRecords(state).length, 0));
  const plain = fixture(); delete plain.eventPacing; // marked rare content is disabled without paced policy too
  const engine = createEngine(plain), state = advanceTo(engine, engine.start("unpaced-no-rare"), 30);
  assert.equal(rareRecords(state).length, 0);
});

test("rare selection uses raw authored weights even with extreme novelty penalties", () => {
  const pack = fixture(1, 1);
  pack.eventPacing!.variety = { recentWindow: 100, recentWeight: 0.001, repeatWeight: 0.001 };
  pack.events[2].trigger = { type: "random", weight: 1 };
  pack.events.push(decision("rare-heavy", true, 9));
  const engine = createEngine(pack);
  let light = 0, heavy = 0;
  for (let seed = 0; seed < 40; seed++) {
    const state = advanceTo(engine, engine.start(`raw-rare-${seed}`), 20);
    const records = rareRecords(state);
    assert.equal(records.length, 20);
    light += records.filter(entry => entry.id === "rare").length;
    heavy += records.filter(entry => entry.id === "rare-heavy").length;
  }
  assert.ok(heavy > light * 5, `raw 9:1 weighting must remain rare: ${light}/${heavy}`);
});

test("a 1.2% annual rare gate stays uncommon across a deterministic cohort", () => {
  const engine = createEngine(fixture(0.012, 1));
  let total = 0;
  for (let seed = 0; seed < 128; seed++) total += rareRecords(advanceTo(engine, engine.start(`rare-rate-${seed}`), 40)).length;
  assert.ok(total >= 30 && total <= 100, `Expected uncommon encounters in 5,120 eligible years, got ${total}`);
});

test("dated anchors and due automatic history keep priority over rare encounters", () => {
  const pack = fixture();
  const personal = { ...decision("personal"), maxOccurrences: 1, trigger: { type: "age" as const, at: 1 } };
  const anchor = { ...decision("anchor"), maxOccurrences: 1, trigger: { type: "year" as const, at: -49 } };
  pack.events.unshift(personal, anchor,
    { id: "history", title: "History", text: "Dated history.", trigger: { type: "year", at: -49 }, mode: "automatic", effects: [], choices: [] });
  const engine = createEngine(pack);
  let state = engine.advance(engine.start("anchor-priority"));
  assert.equal(state.pendingEventId, "anchor");
  assert.equal(rareRecords(state).length, 0);
  assert.deepEqual(state.journal.filter(entry => entry.type === "event").map(entry => entry.id), ["history", "background", "anchor"]);
  state = engine.choose(state, "continue");
  assert.equal(rareRecords(state).length, 0, "resolving the anchor does not retry the annual gate");
  state = engine.advance(state);
  assert.equal(state.pendingEventId, "rare");
});

test("recorded illness and moneylender collection keep priority over the rare annual lane", () => {
  const pack = structuredClone(alexandria) as WorldPack;
  delete pack.health!.mortalityCalibration;
  pack.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  pack.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  pack.yearlyEffects = []; pack.yearlyRules = [];
  for (const origin of pack.origins) origin.statRanges = { ...origin.statRanges, health: { min: 80, max: 80 }, wealth: { min: 50, max: 50 } };
  pack.eventPacing = { minChoiceGapYears: 3, maxChoiceGapYears: 3, rareEvents: { annualChance: 1, cooldownYears: 12 } };
  const keep = new Set([pack.health!.careDecision, ...Object.values(pack.economy!.moneylender!.events)]);
  const rare = decision("rare", true); rare.when = { type: "age", op: "gte", value: 21 };
  pack.events = [
    { id: "onset", title: "Onset", text: "An illness starts.", trigger: { type: "age", at: 21 }, mode: "automatic", choices: [], effects: [{ type: "condition", condition: "pneumonia" }] },
    { id: "history", title: "History", text: "News arrives.", trigger: { type: "age", at: 21 }, mode: "automatic", choices: [], effects: [] },
    ...pack.events.filter(event => keep.has(event.id)), rare,
  ];
  const engine = createEngine(pack);
  let state = advanceTo(engine, engine.start("priority-care-loan"), 18);
  state = engine.act(state, "borrow-moneylender");
  while (state.age < 21) state = engine.advance(state);
  assert.equal(state.pendingEventId, pack.health!.careDecision);
  assert.equal(rareRecords(state).length, 0);
  assert.equal(state.eventCounts[pack.economy!.moneylender!.events.due], undefined);
  state = engine.choose(state, engine.getChoices(state).find(choice => !choice.when)!.id);
  assert.equal(state.pendingEventId, pack.economy!.moneylender!.events.due);
  assert.equal(state.eventCounts.history, 1);
  assert.equal(rareRecords(state).length, 0);
  state = engine.choose(state, "pay-moneylender-balance");
  assert.equal(state.economy!.loan, undefined);
  assert.equal(rareRecords(state).length, 0, "settling the interrupt does not retry random selection");
  state = engine.advance(state);
  assert.equal(state.pendingEventId, "rare");
  assert.deepEqual(engine.replay(state.seed, state.commands), state);

  for (const id of [pack.health!.careDecision, ...Object.values(pack.economy!.moneylender!.events)]) {
    const invalid = structuredClone(pack);
    invalid.events.find(event => event.id === id)!.rarity = "rare";
    assert.throws(() => validateWorld(invalid), /medical and collection interrupts cannot be rare/);
  }
});

test("rare settings and event shapes validate strictly but empty catalogs remain valid", () => {
  for (const policy of [null, {}, { annualChance: 1 }, { annualChance: -1, cooldownYears: 12 },
    { annualChance: 1.1, cooldownYears: 12 }, { annualChance: Infinity, cooldownYears: 12 },
    { annualChance: 0.1, cooldownYears: 0 }, { annualChance: 0.1, cooldownYears: 81 },
    { annualChance: 0.1, cooldownYears: 1.5 }, { annualChance: 0.1, cooldownYears: 12, extra: true }]) {
    const pack = fixture(); pack.eventPacing!.rareEvents = policy as NonNullable<WorldPack["eventPacing"]>["rareEvents"];
    assert.throws(() => validateWorld(pack), /rareEvents/);
  }
  for (const patch of [{ rarity: "common" }, { mode: "automatic", choices: [] }, { trigger: { type: "age", at: 3 } }]) {
    const pack = fixture(); Object.assign(pack.events[2], patch);
    assert.throws(() => validateWorld(pack), /rarity/);
  }
  const pack = fixture(); pack.events = pack.events.filter(event => event.rarity !== "rare");
  validateWorld(pack);
});
