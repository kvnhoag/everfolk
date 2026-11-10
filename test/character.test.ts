import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { CharacterActivity, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { nextRandom } from "../src/random.ts";

function activity(id: string, effects: Effect[], category: CharacterActivity["category"] = "family"): CharacterActivity {
  return { id, text: id, category, outcomes: [{ id: `${id}-done`, text: `${id} happens.`, weight: 1, effects }] };
}

function pack(): WorldPack {
  return {
    schemaVersion: 1, id: "character-test", version: "1.0.0", title: "Character test",
    description: "Fictional gameplay fixture.", startYear: -20, maxAge: 90,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70 }, wealth: { label: "Wealth", min: 0, max: 100, initial: 30 } },
    flags: { partnered: { label: "Married", initial: false }, parent: { label: "Parent", initial: false } },
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    endings: [{ id: "death", title: "Life complete", text: "Your story is remembered.", kind: "death" }], defaultEnding: "death",
    character: {
      skills: { letters: { label: "Letters", min: 0, max: 100, initial: 0 } },
      jobs: [
        { id: "scribe", title: "Scribe", description: "Written work.", minAge: 16, requirements: { letters: 50 }, yearlyEffects: [{ type: "stat", stat: "wealth", delta: 2 }, { type: "skill", skill: "letters", delta: 1 }] },
        { id: "laborer", title: "Laborer", description: "Manual work.", minAge: 16, yearlyEffects: [{ type: "stat", stat: "wealth", delta: 1 }] },
      ],
      partners: [
        { id: "aina", name: "Aina", ageOffset: -2, occupation: "Weaver", description: "A thoughtful neighbor." },
        { id: "bago", name: "Bago", ageOffset: 1, occupation: "Potter", description: "A patient craftsperson." },
      ],
      activities: [
        { ...activity("learn", [{ type: "skill", skill: "letters", delta: 25 }, { type: "stat", stat: "wealth", delta: -1 }], "training"), minAge: 6, cooldownYears: 2 },
        activity("scribe", [{ type: "job", job: "scribe" }], "career"),
        activity("laborer", [{ type: "job", job: "laborer" }], "career"),
        activity("leave-work", [{ type: "job", job: null }], "career"),
        activity("court-aina", [{ type: "relationship", partner: "aina", status: "courting" }], "relationship"),
        activity("marry-aina", [{ type: "relationship", partner: "aina", status: "married" }], "relationship"),
        activity("court-bago", [{ type: "relationship", partner: "bago", status: "courting" }], "relationship"),
        activity("marry-bago", [{ type: "relationship", partner: "bago", status: "married" }], "relationship"),
        activity("divorce", [{ type: "divorce" }], "relationship"),
        activity("child", [{ type: "child" }]),
        { ...activity("care", [{ type: "stat", stat: "health", delta: 2 }]), when: { type: "children", op: "gte", value: 1 } },
      ],
      childNames: ["Niko", "Mira", "Dion", "Tia", "Ira", "Ria", "Ben", "Ana"],
      deathCauseDescription: "Fictional conditional cause weights; these are not measured historical rates or diagnoses.",
      deathCauses: [
        { id: "fever", title: "A severe fever", text: "An illness becomes fatal.", weight: 1 },
        { id: "infant-illness", title: "An illness in infancy", text: "You never reach your first birthday.", weight: 1, when: { type: "age", op: "lt", value: 1 } },
        { id: "frailty", title: "Frailty in old age", text: "Your strength fades in old age.", weight: 3, when: { type: "age", op: "gte", value: 70 } },
      ],
    },
  };
}

function ageTo(engine: LifeEngine, state: LifeState, age: number): LifeState {
  while (state.age < age && state.phase !== "ended") state = state.phase === "choice"
    ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
  return state;
}

function reason(engine: LifeEngine, state: LifeState, id: string): string | undefined {
  return engine.getActivities(state).find(activity => activity.id === id)?.reason;
}

test("activities expose locked choices, enforce a shared annual budget, and preserve rejected snapshots", () => {
  const engine = createEngine(pack());
  const start = engine.start("budget");
  assert.equal(engine.getActivities(start).length, 11);
  assert.match(reason(engine, start, "learn")!, /age 6/);
  let state = ageTo(engine, start, 6);
  const before = state;
  state = engine.act(state, "learn");
  assert.equal(state.character!.skills.letters, 25);
  assert.equal(before.character!.skills.letters, 0);
  assert.match(reason(engine, state, "learn")!, /major activity/);
  assert.throws(() => engine.act(state, "laborer"), /major activity/);
  assert.deepEqual(state.commands.at(-1), { type: "act", activity: "learn" });
  state = engine.advance(state);
  assert.match(reason(engine, state, "learn")!, /age 8/);
  assert.throws(() => engine.act(state, "learn"), /age 8/);
  assert.ok(Object.isFrozen(state.character!.skills));
  assert.ok(Object.isFrozen(engine.getActivities(state)[0]));
});

test("pending decisions block voluntary actions without spending the activity budget", () => {
  const world = pack();
  world.events.push({ id: "decision", title: "Decision", text: "A decision.", trigger: { type: "age", at: 6 }, choices: [{ id: "accept", text: "Accept", outcomes: [{ id: "accepted", text: "Accepted.", weight: 1, effects: [] }] }] });
  const engine = createEngine(world);
  let state = ageTo(engine, engine.start("pending"), 6);
  assert.equal(state.phase, "choice");
  assert.match(reason(engine, state, "learn")!, /current decision/);
  assert.throws(() => engine.act(state, "learn"), /current decision/);
  state = engine.choose(state, "accept");
  assert.equal(state.character!.lastActivityAge, null);
  assert.equal(engine.act(state, "learn").character!.skills.letters, 25);
});

test("graded skills unlock named jobs and employment applies annual income and skill growth only after survival", () => {
  const engine = createEngine(pack());
  let state = ageTo(engine, engine.start("jobs"), 16);
  assert.match(reason(engine, state, "scribe")!, /Letters 50 \(currently 0\)/);
  assert.throws(() => engine.act(state, "scribe"), /Letters/);
  state = engine.act(state, "learn");
  state = ageTo(engine, state, 18);
  state = engine.act(state, "learn");
  state = engine.advance(state);
  state = engine.act(state, "scribe");
  assert.equal(state.character!.jobId, "scribe");
  const wealth = state.stats.wealth;
  state = engine.advance(state);
  assert.equal(state.stats.wealth, wealth + 2);
  assert.equal(state.character!.skills.letters, 51);
  assert.match(reason(engine, state, "scribe")!, /already hold/);
  state = engine.act(state, "laborer");
  state = engine.advance(state);
  assert.equal(state.character!.jobId, "laborer");
  assert.equal(state.stats.wealth, wealth + 3);
  state = engine.act(state, "leave-work");
  state = engine.advance(state);
  assert.equal(state.stats.wealth, wealth + 3);
  assert.equal(state.character!.jobId, null);
});

test("skill effects clamp at their authored bounds", () => {
  const world = pack();
  world.character!.activities[0].outcomes[0].effects = [{ type: "skill", skill: "letters", delta: 500 }];
  const engine = createEngine(world);
  let state = engine.act(ageTo(engine, engine.start("skill-bound"), 6), "learn");
  assert.equal(state.character!.skills.letters, 100);
  state = ageTo(engine, state, 8);
  state = engine.act(state, "learn");
  assert.equal(state.character!.skills.letters, 100);
});

test("a fatal mortality interval pays no further income or skill growth", () => {
  const world = pack();
  world.mortality = { description: "Test mortality.", sourceIds: [], bands: [
    { minAge: 0, maxAge: 19, annualProbability: 0, ending: "death" },
    { minAge: 20, maxAge: 89, annualProbability: 1, ending: "death" },
  ] };
  const engine = createEngine(world);
  let state = ageTo(engine, engine.start("final-wages"), 16);
  state = engine.act(state, "learn");
  state = engine.act(ageTo(engine, state, 18), "learn");
  state = engine.act(engine.advance(state), "scribe");
  state = engine.advance(state);
  const before = state;
  state = engine.advance(state);
  assert.equal(state.phase, "ended");
  assert.equal(state.age, 20);
  assert.deepEqual(state.stats, before.stats);
  assert.deepEqual(state.character!.skills, before.character!.skills);
});

test("skill and job conditions unlock due narrative decisions after an accepted activity", () => {
  const world = pack();
  world.events.push({
    id: "skilled-work", title: "Skilled work", text: "A client asks for help.", trigger: { type: "age", at: 16 },
    when: { type: "all", conditions: [{ type: "job", job: "scribe" }, { type: "skill", skill: "letters", op: "gte", value: 50 }] },
    choices: [{ id: "help", text: "Help", when: { type: "relationship", status: "single" }, outcomes: [{ id: "helped", text: "You help.", weight: 1, effects: [] }] }],
  });
  const engine = createEngine(world);
  let state = ageTo(engine, engine.start("skills-unlock-story"), 16);
  state = engine.act(state, "learn");
  state = engine.act(ageTo(engine, state, 18), "learn");
  state = engine.act(engine.advance(state), "scribe");
  assert.equal(state.phase, "choice");
  assert.equal(state.pendingEventId, "skilled-work");
  state = engine.choose(state, "help");
  assert.equal(state.phase, "ready");
  assert.match(reason(engine, state, "laborer")!, /major activity/);
});

test("narrative choices may reaffirm an existing job while voluntary duplicate employment stays locked", () => {
  const world = pack();
  world.events.push({ id: "continue-work", title: "Continue work", text: "Stay with familiar work.", trigger: { type: "age", at: 17 }, choices: [{ id: "continue", text: "Continue", outcomes: [{ id: "continued", text: "Work continues.", weight: 1, effects: [{ type: "job", job: "laborer" }] }] }] });
  const engine = createEngine(world);
  let state = engine.act(ageTo(engine, engine.start("same-job"), 16), "laborer");
  state = engine.advance(state);
  state = engine.choose(state, "continue");
  assert.equal(state.character!.jobId, "laborer");
  assert.match(reason(engine, state, "laborer")!, /already hold/);
});

test("courtship and marriage require two adults and the selected partner, and divorce preserves named children", () => {
  const engine = createEngine(pack());
  let state = ageTo(engine, engine.start("family"), 18);
  assert.match(reason(engine, state, "court-aina")!, /Aina.*18/);
  assert.match(reason(engine, state, "marry-bago")!, /Court Bago/);
  state = engine.act(state, "court-bago");
  assert.equal(state.character!.relationshipStatus, "courting");
  assert.equal(state.character!.partnerId, "bago");
  state = engine.advance(state);
  state = engine.act(state, "marry-bago");
  assert.equal(state.flags.partnered, true);
  state = engine.advance(state);
  assert.match(reason(engine, state, "court-aina")!, /End your current marriage/);
  state = engine.act(state, "child");
  const first = state.character!.children[0];
  assert.ok(pack().character!.childNames.includes(first.name));
  assert.equal(first.birthAge, 20);
  assert.equal(first.otherParentId, "bago");
  assert.equal(state.flags.parent, true);
  state = engine.advance(state);
  assert.match(reason(engine, state, "child")!, /two years/);
  state = engine.act(state, "divorce");
  assert.equal(state.character!.relationshipStatus, "divorced");
  assert.equal(state.character!.partnerId, null);
  assert.equal(state.flags.partnered, false);
  assert.equal(state.flags.parent, true);
  assert.deepEqual(state.character!.children, [first]);
  state = engine.advance(state);
  assert.match(reason(engine, state, "divorce")!, /must be married/);
  assert.match(reason(engine, state, "child")!, /married adult/);
  assert.equal(state.age - first.birthAge, 2);
  state = engine.act(state, "court-aina");
  state = engine.advance(state);
  state = engine.act(state, "marry-aina");
  assert.equal(state.character!.partnerId, "aina");
  state = engine.advance(state);
  state = engine.act(state, "child");
  assert.equal(state.character!.children.length, 2);
  assert.equal(state.character!.children[1].otherParentId, "aina");
  assert.notEqual(state.character!.children[1].name, first.name);
  assert.equal(state.age + pack().character!.partners[0].ageOffset, 22);
  assert.ok(state.journal.some(entry => entry.text.includes(first.name)));
});

test("family care conditions reflect children and the household limit prevents unlimited additions", () => {
  const engine = createEngine(pack());
  let state = ageTo(engine, engine.start("child-limit"), 18);
  assert.match(reason(engine, state, "care")!, /requirements/);
  state = engine.act(state, "court-bago");
  state = engine.act(engine.advance(state), "marry-bago");
  for (let i = 0; i < 8; i++) {
    state = ageTo(engine, state, 20 + i * 2);
    state = engine.act(state, "child");
  }
  state = engine.advance(state);
  assert.match(reason(engine, state, "child")!, /eight children/);
  assert.throws(() => engine.act(state, "child"), /eight children/);
  assert.equal(engine.getActivities(state).find(activity => activity.id === "care")!.available, true);
  assert.equal(new Set(state.character!.children.map(child => child.name)).size, 8);
});

test("accepted character actions, names and causes replay exactly, while forged save commands are rejected", () => {
  const engine = createEngine(pack());
  let state = ageTo(engine, engine.start("save-family"), 18);
  state = engine.act(state, "court-bago");
  state = engine.act(engine.advance(state), "marry-bago");
  state = engine.act(engine.advance(state), "child");
  assert.deepEqual(engine.load(engine.save(state)), state);
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  const forged = JSON.parse(engine.save(state));
  forged.commands.push({ type: "act", activity: "child" });
  assert.throws(() => engine.load(JSON.stringify(forged)), /major activity/);
  forged.commands = [{ type: "act", activity: "learn", extra: true }];
  assert.throws(() => engine.load(JSON.stringify(forged)), /Invalid command/);
  const tampered = structuredClone(state);
  tampered.character!.children[0].name = "Forged";
  assert.throws(() => engine.save(tampered), /command history/);
  state = ageTo(engine, state, 90);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("death causes are sampled only on death and cannot assign an old-age cause to infancy", () => {
  const world = pack();
  world.mortality = { description: "Certain test mortality.", sourceIds: [], bands: [{ minAge: 0, maxAge: 89, annualProbability: 1, ending: "death" }] };
  const engine = createEngine(world);
  for (let i = 0; i < 20; i++) {
    const start = engine.start(`infant-${i}`);
    assert.equal(start.deathCauseId, undefined);
    const end = engine.advance(start);
    assert.equal(end.age, 0);
    assert.ok(["fever", "infant-illness"].includes(end.deathCauseId!));
    assert.match(end.journal.at(-1)!.text, /Cause of death:/);
    assert.deepEqual(engine.replay(end.seed, end.commands), end);
    assert.throws(() => engine.act(end, "learn"), /ended/);
  }
});

test("adding cause metadata does not change all-cause mortality or consume random draws while alive", () => {
  const modern = pack();
  modern.maxAge = 30;
  modern.mortality = { description: "Test mortality.", sourceIds: [], bands: [{ minAge: 0, maxAge: 29, annualProbability: 0.12, ending: "death" }] };
  const legacy = structuredClone(modern);
  delete legacy.character;
  const oldEngine = createEngine(legacy);
  const newEngine = createEngine(modern);
  for (let i = 0; i < 60; i++) {
    let old = oldEngine.start(`hazard-${i}`);
    let fresh = newEngine.start(`hazard-${i}`);
    assert.equal(old.rngState, fresh.rngState);
    while (old.phase !== "ended") {
      old = oldEngine.advance(old);
      fresh = newEngine.advance(fresh);
      assert.equal(fresh.age, old.age);
      assert.equal(fresh.phase, old.phase);
      if (old.phase !== "ended") assert.equal(fresh.rngState, old.rngState);
    }
    assert.equal(old.character, undefined);
    assert.equal(old.deathCauseId, undefined);
    assert.deepEqual(oldEngine.getActivities(old), []);
  }
});

test("chapter endings have no death cause, while explicit and maximum-age deaths do", () => {
  const world = pack();
  world.endings.push({ id: "chapter", title: "Chapter", text: "A chapter closes.", kind: "chapter" });
  world.character!.activities.push(activity("chapter", [{ type: "end", ending: "chapter" }]));
  world.character!.activities.push(activity("die", [{ type: "end", ending: "death" }]));
  const engine = createEngine(world);
  assert.equal(engine.act(engine.start("chapter"), "chapter").deathCauseId, undefined);
  const unspecified = engine.act(engine.start("explicit-death"), "die");
  assert.ok(unspecified.deathCauseId);
  assert.equal(unspecified.deathCauseContext, undefined);
  const ended = ageTo(engine, engine.start("maximum-age"), 90);
  assert.ok(["fever", "frailty"].includes(ended.deathCauseId!));
});

test("a risky activity's fatal branch records its specific authored cause and accepted decision without an extra cause draw", () => {
  const world = pack();
  world.character!.deathCauses.push({ id: "crossing-accident", title: "An accident during the crossing", text: "The boat overturns in rough water.", weight: 1, choiceOnly: true, when: { type: "job", job: "laborer" } });
  world.character!.activities.push({
    id: "rough-crossing", text: "Take the boat through rough water", category: "career", minAge: 18,
    outcomes: [
      { id: "crossing-safe", text: "You cross safely and are paid.", weight: 3, effects: [{ type: "stat", stat: "wealth", delta: 5 }] },
      { id: "crossing-fatal", text: "The boat overturns and you cannot reach shore.", weight: 1, effects: [{ type: "end", ending: "death", deathCause: "crossing-accident" }, { type: "stat", stat: "wealth", delta: 50 }] },
    ],
  });
  const engine = createEngine(world);
  const observed = new Set<string>();
  for (let seed = 0; seed < 30; seed++) {
    const before = ageTo(engine, engine.start(`crossing-${seed}`), 20);
    const after = engine.act(before, "rough-crossing");
    assert.equal(after.rngState, nextRandom(before.rngState).state, "Only the weighted outcome consumes a random draw.");
    if (after.phase === "ended") {
      observed.add("fatal");
      assert.equal(after.deathCauseId, "crossing-accident");
      assert.equal(after.deathCauseContext, "Take the boat through rough water — The boat overturns and you cannot reach shore.");
      assert.equal(after.stats.wealth, before.stats.wealth, "Effects following the fatal ending never run.");
      assert.ok(after.journal.at(-1)!.text.includes("Decision leading to death: Take the boat through rough water"));
      assert.deepEqual(engine.load(engine.save(after)), after);
    } else {
      observed.add("safe");
      assert.equal(after.deathCauseId, undefined);
      assert.equal(after.deathCauseContext, undefined);
      assert.equal(after.stats.wealth, before.stats.wealth + 5);
    }
    assert.deepEqual(engine.replay(after.seed, after.commands), after);
  }
  assert.deepEqual(observed, new Set(["safe", "fatal"]));
});

test("an explicitly fatal narrative choice records the triggering decision, while later natural death does not blame an earlier action", () => {
  const world = pack();
  world.character!.deathCauses.push({ id: "crossing-injury", title: "An injury during the crossing", text: "An injury in the water ends your life.", weight: 1, choiceOnly: true });
  world.events.push({ id: "fatal-event", title: "A dangerous passage", text: "Wait or cross.", trigger: { type: "age", at: 20 }, choices: [
    { id: "cross", text: "Attempt the crossing", outcomes: [{ id: "fatal-crossing", text: "The crossing ends in a fatal injury.", weight: 1, effects: [{ type: "end", ending: "death", deathCause: "crossing-injury" }] }] },
    { id: "wait", text: "Wait safely", outcomes: [{ id: "waited", text: "You remain on shore.", weight: 1, effects: [] }] },
  ] });
  const engine = createEngine(world);
  let state = ageTo(engine, engine.start("choice-fatal"), 20);
  state = engine.choose(state, "cross");
  assert.equal(state.deathCauseContext, "Attempt the crossing — The crossing ends in a fatal injury.");
  assert.equal(state.deathCauseId, "crossing-injury");
  assert.deepEqual(engine.load(engine.save(state)), state);

  const naturalWorld = pack();
  naturalWorld.mortality = { description: "Certain at twenty.", sourceIds: [], bands: [
    { minAge: 0, maxAge: 19, annualProbability: 0, ending: "death" },
    { minAge: 20, maxAge: 89, annualProbability: 1, ending: "death" },
  ] };
  const natural = createEngine(naturalWorld);
  let alive = ageTo(natural, natural.start("natural-after-learning"), 20);
  alive = natural.act(alive, "learn");
  const dead = natural.advance(alive);
  assert.ok(dead.deathCauseId);
  assert.equal(dead.deathCauseContext, undefined);
  assert.ok(!dead.journal.at(-1)!.text.includes("Decision leading to death"));
});

test("explicit death-cause references require an existing cause and a death ending in a character world", () => {
  const unknown = pack();
  unknown.character!.activities.push(activity("fatal", [{ type: "end", ending: "death", deathCause: "missing" }]));
  assert.throws(() => validateWorld(unknown), /unknown death cause/);
  const chapter = pack();
  chapter.endings.push({ id: "chapter", title: "A chapter", text: "Chapter complete.", kind: "chapter" });
  chapter.character!.activities.push(activity("fatal", [{ type: "end", ending: "chapter", deathCause: "fever" }]));
  assert.throws(() => validateWorld(chapter), /requires a death ending/);
  const legacy = pack();
  delete legacy.character;
  legacy.origins[0].effects.push({ type: "end", ending: "death", deathCause: "fever" });
  assert.throws(() => validateWorld(legacy), /requires a character definition/);
});

test("choice-only hazards cannot be assigned by natural mortality or replace its fallback", () => {
  const world = pack();
  world.mortality = { description: "Certain test mortality.", sourceIds: [], bands: [{ minAge: 0, maxAge: 89, annualProbability: 1, ending: "death" }] };
  world.character!.deathCauses.push({ id: "fire", title: "A warehouse fire", text: "A fire ends your life.", weight: 100_000, choiceOnly: true });
  const engine = createEngine(world);
  for (let seed = 0; seed < 30; seed++) {
    const died = engine.advance(engine.start(`no-spontaneous-fire-${seed}`));
    assert.notEqual(died.deathCauseId, "fire");
    assert.equal(died.deathCauseContext, undefined);
  }
  const invalid = pack();
  invalid.character!.deathCauses[0].choiceOnly = true;
  assert.throws(() => validateWorld(invalid), /fallback cause available for natural sampling/);
});

test("character validation rejects invalid references, bypassing annual job effects, and missing fallback causes", () => {
  const mutations: [string, (world: WorldPack) => void][] = [
    ["skill", world => { world.character!.jobs[0].requirements = { missing: 20 }; }],
    ["job", world => { world.character!.activities[1].outcomes[0].effects = [{ type: "job", job: "missing" }]; }],
    ["partner", world => { world.character!.activities[4].outcomes[0].effects = [{ type: "relationship", partner: "missing", status: "courting" }]; }],
    ["only stats", world => { world.character!.jobs[0].yearlyEffects = [{ type: "child" }]; }],
    ["fallback", world => { world.character!.deathCauses.shift(); }],
    ["positive weight", world => { world.character!.deathCauses[0].weight = 0; }],
    ["duplicate ID", world => { world.character!.activities.push(structuredClone(world.character!.activities[0])); }],
    ["outside its bounds", world => { world.character!.jobs[0].requirements!.letters = 101; }],
    ["unknown field", world => { Object.assign(world.character!.partners[0], { executable: true }); }],
  ];
  for (const [message, mutate] of mutations) {
    const world = pack();
    mutate(world);
    assert.throws(() => validateWorld(world), new RegExp(message));
  }
});
