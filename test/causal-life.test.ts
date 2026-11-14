import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { CharacterActivity, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.14.0.json" with { type: "json" };

const outcome = (id: string, effects: Effect[]) => ({ id: `${id}-result`, text: `${id} happens.`, weight: 1, effects });
const activity = (id: string, effects: Effect[], extra: Partial<CharacterActivity> = {}): CharacterActivity => ({
  id, text: id, category: "relationship", minAge: 18, outcomes: [outcome(id, effects)], ...extra,
});

/** Small authored fixture: no chance of onset or recovery obscures the causal assertions. */
function fixture(exposure = true): WorldPack {
  return {
    schemaVersion: 1, id: "causal-life", version: "1", title: "Causal life", description: "Authored engine integration fixture.", startYear: -40, maxAge: 30,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 30 }, bonds: { label: "Bonds", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }], yearlyEffects: [],
    yearlyRules: [
      { id: "introductions", when: { type: "age", op: "eq", value: 18 }, effects: [{ type: "introduce", partner: "aina" }] },
      ...(exposure ? [{ id: "exposure", when: { type: "age", op: "eq", value: 20 } as const, effects: [{ type: "condition", condition: "pneumonia" }, { type: "stat", stat: "health", delta: -10 }] as Effect[] }] : []),
    ],
    events: [
      { id: "care-needed", title: "Care is needed", text: "Arrange care.", trigger: { type: "random", weight: 1 }, when: { type: "has-condition" }, maxOccurrences: 100,
        choices: [
          { id: "rest", text: "Rest and ask for help", outcomes: [outcome("rest", [{ type: "care", amount: 0.9 }, { type: "stat", stat: "health", delta: 10 }])] },
          { id: "ignore", text: "Keep working", outcomes: [outcome("ignore", [])] },
        ] },
      { id: "ordinary-decision", title: "Other plans", text: "Make plans.", trigger: { type: "age", at: 20 }, choices: [{ id: "wait", text: "Wait", outcomes: [outcome("wait", [])] }] },
    ],
    endings: [{ id: "death", title: "Died", text: "Your life ends.", kind: "death" }, { id: "record", title: "Record complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "record",
    eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3 },
    health: { description: "Authored gameplay, not clinical probabilities.", sourceIds: [], stat: "health", criticalHealth: 10, declineCondition: "decline", careDecision: "care-needed", supportRecoveryBonus: 0,
      incidenceBands: [{ minAge: 0, maxAge: 29, annualProbability: 0 }], declineBands: [{ minAge: 0, maxAge: 29, healthLoss: 0 }],
      conditions: [
        { id: "pneumonia", title: "Pneumonia", deathCause: "pneumonia-death", kind: "illness", weight: 1, healthLoss: 15, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 10 },
        { id: "decline", title: "Prolonged decline", deathCause: "decline-death", kind: "frailty", weight: 0, healthLoss: 5, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 0 },
      ] },
    relationships: { description: "Authored individual relationships.", initialCloseness: 40, childCloseness: 70, decayAfterYears: 2, yearlyDecay: 5, marriageMinimum: 60, supportThreshold: 65, maxHealthSupport: 1 },
    character: { requireIntroductions: true, exclusiveCourtship: true, skills: { pottery: { label: "Pottery", min: 0, max: 100, initial: 0 } }, jobs: [],
      partners: [{ id: "aina", name: "Aina", ageOffset: 0, occupation: "Potter", description: "A neighbor." }], childNames: ["Niko"],
      activities: [
        activity("court", [{ type: "relationship", partner: "aina", status: "courting" }, { type: "closeness", target: "partner", partner: "aina", delta: 10 }]),
        activity("talk", [{ type: "closeness", target: "partner", partner: "aina", delta: 20 }]),
        activity("marry", [{ type: "relationship", partner: "aina", status: "married" }]),
        activity("child", [{ type: "child" }], { category: "family" }),
        activity("rest-again", [{ type: "care", amount: 0.5 }, { type: "stat", stat: "health", delta: 10 }], { category: "family", usesYearlyActivity: false, minAge: 0, when: { type: "has-condition" } }),
        activity("danger", [{ type: "end", ending: "death", deathCause: "crush-injury" }], { category: "career" }),
      ],
      deathCauseDescription: "Authored causes.", deathCauses: [
        { id: "pneumonia-death", title: "Pneumonia", text: "Pneumonia becomes fatal.", weight: 1 },
        { id: "decline-death", title: "Prolonged decline", text: "Health deteriorates.", weight: 1 },
        { id: "crush-injury", title: "Crush injury", text: "A falling load causes a fatal crush injury.", weight: 1, choiceOnly: true },
      ] },
  };
}
function ageTo(engine: LifeEngine, state: LifeState, age: number): LifeState {
  while (state.age < age && state.phase !== "ended") {
    state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
  }
  return state;
}
function settlePlans(engine: LifeEngine, state: LifeState): LifeState {
  return state.pendingEventId === "ordinary-decision" ? engine.choose(state, "wait") : state;
}

test("a named illness interrupts ordinary plans, warns before death, and extra care changes the result", () => {
  const engine = createEngine(fixture());
  const exposed = ageTo(engine, engine.start("care-or-ignore"), 20);
  assert.equal(exposed.pendingEventId, "care-needed");
  assert.equal(exposed.stats.health, 20);
  assert.equal(exposed.health!.conditions[0].id, "pneumonia");
  assert.equal(exposed.deathCauseId, undefined);
  assert.throws(() => engine.advance(exposed), /pending choice/);
  assert.ok(exposed.journal.some(entry => /Pneumonia.*need care/i.test(entry.text)));
  const ignored = settlePlans(engine, engine.choose(exposed, "ignore"));
  const cared = settlePlans(engine, engine.choose(exposed, "rest"));
  assert.equal(cared.health!.lastCareAge, 20);
  assert.match(engine.getActivities(cared).find(item => item.id === "rest-again")!.reason!, /already been arranged/);
  const died = engine.advance(ignored);
  assert.equal(died.phase, "ended");
  assert.equal(died.age, 20);
  assert.equal(died.deathCauseId, "pneumonia-death");
  assert.equal(died.deathCauseKind, "condition");
  assert.match(died.deathCauseContext!, /Pneumonia/);
  assert.ok(died.journal.some(entry => /Health history:/.test(entry.text)));
  assert.equal(died.journal.some(entry => /Decision that led/.test(entry.text)), false);
  const survived = engine.advance(cared);
  assert.equal(survived.age, 21);
  assert.equal(survived.phase, "choice");
  assert.equal(survived.pendingEventId, "care-needed");
  assert.equal(survived.stats.health, 21.75);
  assert.deepEqual(engine.replay(died.seed, died.commands), died);
  assert.deepEqual(engine.load(engine.save(survived)), survived);
  assert.deepEqual(engine.replay(survived.seed, survived.commands), survived);
});

test("an explicit dangerous activity records the authored injury and the actual decision", () => {
  const engine = createEngine(fixture(false));
  const state = engine.act(ageTo(engine, engine.start("danger"), 18), "danger");
  assert.equal(state.phase, "ended");
  assert.equal(state.deathCauseId, "crush-injury");
  assert.equal(state.deathCauseKind, "choice");
  assert.match(state.deathCauseContext!, /danger/);
  assert.deepEqual(state.health!.conditions, []);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
});

test("an automatic condition onset interrupts before a queued ordinary decision", () => {
  const world = fixture(false);
  world.events.unshift({ id: "automatic-exposure", title: "An illness develops", text: "You become ill.", trigger: { type: "age", at: 20 },
    mode: "automatic", effects: [{ type: "condition", condition: "pneumonia" }], choices: [] });
  const engine = createEngine(world);
  const state = ageTo(engine, engine.start("automatic-health-warning"), 20);
  assert.equal(state.pendingEventId, "care-needed");
  assert.equal(state.health!.conditions[0].id, "pneumonia");
  assert.equal(state.journal.some(entry => entry.type === "event" && entry.id === "ordinary-decision"), false);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  // The same interrupt contract applies to worlds without personal-decision pacing.
  delete world.eventPacing;
  const unpaced = createEngine(world);
  assert.equal(ageTo(unpaced, unpaced.start("automatic-unpaced-warning"), 20).pendingEventId, "care-needed");
});

test("critical Health from an accepted choice or birth immediately names decline and offers care", () => {
  const world = fixture(false);
  world.character!.activities.push(activity("overwork", [{ type: "stat", stat: "health", delta: -30 }], { category: "career" }));
  const engine = createEngine(world);
  const state = engine.act(ageTo(engine, engine.start("critical-choice"), 18), "overwork");
  assert.equal(state.stats.health, 0);
  assert.equal(state.pendingEventId, "care-needed");
  assert.equal(state.health!.conditions[0].id, "decline");
  assert.equal(state.deathCauseId, undefined);
  assert.equal(state.health!.conditions[0].sinceAge, 18);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  world.origins[0].effects.push({ type: "stat", stat: "health", delta: -30 });
  const birthEngine = createEngine(world), born = birthEngine.start("critical-birth");
  assert.equal(born.age, 0);
  assert.equal(born.pendingEventId, "care-needed");
  assert.equal(born.health!.conditions[0].id, "decline");
  assert.equal(born.journal.filter(entry => entry.id === "health-onset-decline").length, 1);
  assert.equal(born.deathCauseId, undefined);
  const helped = birthEngine.choose(born, "rest");
  assert.equal(helped.stats.health, 10);
  assert.notEqual(birthEngine.advance(helped).phase, "ended");
  assert.deepEqual(birthEngine.load(birthEngine.save(born)), born);
});

test("accepted contact and courtship build an individual tie before marriage and a child", () => {
  const engine = createEngine(fixture(false));
  const born = engine.start("individual-contact");
  assert.deepEqual(born.character!.relationships, { partners: {}, children: {} });
  assert.equal(engine.getActivities(born).some(item => item.id === "court"), false);
  let state = ageTo(engine, born, 18);
  assert.deepEqual(state.character!.relationships!.partners.aina, { closeness: 40, lastContactAge: 18 });
  state = engine.act(state, "court");
  assert.equal(state.character!.relationshipStatus, "courting");
  assert.equal(state.character!.relationships!.partners.aina.closeness, 50);
  state = engine.advance(state);
  assert.match(engine.getActivities(state).find(item => item.id === "marry")!.reason!, /closeness.*60/i);
  assert.throws(() => engine.act(state, "marry"), /closeness/i);
  state = engine.act(state, "talk");
  assert.deepEqual(state.character!.relationships!.partners.aina, { closeness: 70, lastContactAge: 19 });
  state = settlePlans(engine, engine.advance(state));
  state = engine.act(state, "marry");
  assert.equal(state.character!.relationshipStatus, "married");
  state = engine.act(engine.advance(state), "child");
  assert.equal(state.character!.children[0].name, "Niko");
  assert.equal(state.character!.relationships!.children["child-1"].closeness, 70);
  assert.deepEqual(engine.load(engine.save(state)), state);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
});

test("the simulation record limit does not invent a cause of death", () => {
  const engine = createEngine(fixture(false));
  let state = ageTo(engine, engine.start("record-limit"), 30);
  assert.equal(state.phase, "ended");
  assert.equal(state.endingId, "record");
  assert.equal(state.deathCauseId, undefined);
  assert.equal(state.deathCauseKind, undefined);
  assert.deepEqual(state.health!.conditions, []);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
});

test("a married household can spend time together before having children", () => {
  const engine = createEngine(current);
  const life = structuredClone(engine.start("childless-household-time"));
  life.age = 30;
  life.year = -36;
  life.character!.knownPartnerIds = ["demetria"];
  life.character!.partnerId = "demetria";
  life.character!.relationshipStatus = "married";
  life.character!.relationships!.partners.demetria = { closeness: 65, lastContactAge: life.age };
  const available = engine.getActivities(life).find(item => item.id === "family-time")!;
  assert.equal(available.available, true, available.reason);
  const after = engine.act(life, "family-time");
  assert.deepEqual(after.character!.children, []);
  assert.deepEqual(after.character!.relationships!.children, {});
  assert.equal(after.character!.relationshipStatus, "married");
});

test("current lives opt in to causal health and individual ties while retained 0.14 replay stays unchanged", () => {
  assert.ok(current.health);
  assert.ok(current.relationships);
  const engine = createEngine(current), oldEngine = createEngine(legacy);
  const state = engine.start("causal-current");
  assert.deepEqual(state.health, { conditions: [], needsCareDecision: false });
  assert.deepEqual(state.character!.relationships, { partners: {}, children: {} });
  assert.deepEqual(engine.load(engine.save(state)), state);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  const old = oldEngine.start("situation-death-110");
  assert.equal(old.health, undefined);
  assert.equal(old.character!.relationships, undefined);
  const died = oldEngine.advance(old);
  assert.equal(died.phase, "ended");
  assert.equal(died.age, 0);
  assert.deepEqual(oldEngine.replay(died.seed, died.commands), died);
});
