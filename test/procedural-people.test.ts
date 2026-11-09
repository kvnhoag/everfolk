import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, personText, resolvePartner, validateWorld } from "../src/index.ts";
import { characterEffectReason } from "../src/character.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import type { Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";

const choice = (id: string, effects: Choice["outcomes"][number]["effects"] = []): Choice => ({
  id, text: `${id} with {person:slot-a}`, outcomes: [{ id: `${id}-done`, text: `You and {person:slot-a} ${id}.`, weight: 1, effects }],
});

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "generated-people", version: "1", title: "People", description: "Authored identity test.", startYear: -66, maxAge: 80,
    stats: { bonds: { label: "Bonds", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "harbor", title: "Harbor", text: "Near the harbor.", weight: 1, effects: [] }, { id: "workshop", title: "Workshop", text: "Near a workshop.", weight: 1, effects: [] }],
    yearlyEffects: [],
    relationships: { description: "Fictional ties.", initialCloseness: 45, childCloseness: 70, decayAfterYears: 2, yearlyDecay: 2, marriageMinimum: 40, supportThreshold: 60, maxHealthSupport: .1 },
    character: {
      identity: { namePools: { male: ["Alexios", "Bion", "Dion", "Leon"], female: ["Alexia", "Berenike", "Dione", "Kleio"] }, avatarVariants: 3 },
      proceduralPartners: true, requireIntroductions: true, exclusiveCourtship: true,
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [],
      partners: [
        { id: "slot-a", name: "Someone at work", ageOffset: 0, occupation: "Maker", description: "Works near you." },
        { id: "slot-b", name: "Someone near home", ageOffset: 2, occupation: "Reader", description: "Lives nearby." },
      ],
      activities: [
        { ...choice("visit", [{ type: "closeness", target: "partner", partner: "slot-a", delta: 5 }]), category: "relationship", minAge: 18, usesYearlyActivity: false, when: { type: "known-partner", partner: "slot-a" } },
        { ...choice("marry", [{ type: "relationship", partner: "slot-a", status: "married" }]), category: "relationship", minAge: 18 },
        { ...choice("break-up", [{ type: "end-courtship" }]), category: "relationship", usesYearlyActivity: false },
        { ...choice("new-child", [{ type: "child" }]), category: "family", minAge: 18 },
      ],
      childNames: ["Child A", "Child B"], deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }],
    },
    events: [
      { id: "meet-a", title: "A conversation", text: "A person joins a shared task.", trigger: { type: "age", at: 18 }, mode: "automatic", effects: [{ type: "introduce", partner: "slot-a" }], choices: [] },
      { id: "date-a", title: "Another conversation", text: "You meet {person:slot-a} again.", trigger: { type: "age", at: 18 }, choices: [choice("date", [{ type: "relationship", partner: "slot-a", status: "courting" }]), choice("decline")] },
      { id: "meet-b", title: "A neighbor", text: "Someone joins a conversation.", trigger: { type: "age", at: 19 }, mode: "automatic", effects: [{ type: "introduce", partner: "slot-b" }], choices: [] },
      { id: "meet-again", title: "A familiar person", text: "You meet {person:slot-a} again.", trigger: { type: "age", at: 20 }, mode: "automatic", effects: [{ type: "introduce", partner: "slot-a" }], choices: [] },
    ],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}

function ageTo(engine: LifeEngine, state: LifeState, age: number): LifeState {
  let life = state;
  while (life.age < age) { assert.equal(life.phase, "ready"); life = engine.advance(life); }
  return life;
}

test("births generate both sexes with matching pool names and no pre-existing people", () => {
  const engine = createEngine(fixture()), sexes = new Set<string>(), variants = new Set<number>();
  for (let index = 0; index < 64; index++) {
    const life = engine.start(`birth-${index}`), character = life.character!;
    sexes.add(character.sex!); variants.add(character.avatarVariant!);
    assert.ok(engine.world.character!.identity!.namePools[character.sex!].includes(character.name!));
    assert.deepEqual(character.people, {});
    assert.deepEqual(character.knownPartnerIds, []);
    assert.deepEqual(character.datedPartnerIds, []);
    assert.equal(resolvePartner(engine.world, life, "slot-a"), undefined);
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
  }
  assert.deepEqual(sexes, new Set(["male", "female"]));
  assert.deepEqual(variants, new Set([0, 1, 2]));
});

test("introductions generate stable distinct identities, then accepted dating records a relationship", () => {
  const engine = createEngine(fixture());
  const encounteredNames = new Set<string>(), encounteredSexes = new Set<string>();
  for (let index = 0; index < 24; index++) {
    const birth = engine.start(`encounter-${index}`), before = structuredClone(birth);
    const met = ageTo(engine, birth, 18), person = met.character!.people!["slot-a"];
    assert.deepEqual(birth, before, "the source snapshot is untouched");
    assert.ok(Object.isFrozen(person));
    assert.equal(person.metAge, 18); assert.equal(person.occupation, "Maker");
    assert.equal(person.ageOffset, 0);
    assert.ok(engine.world.origins.some(origin => origin.id === person.originId));
    assert.ok(engine.world.character!.identity!.namePools[person.sex].includes(person.name));
    assert.notEqual(person.name, birth.character!.name);
    assert.deepEqual(met.character!.knownPartnerIds, ["slot-a"]);
    assert.deepEqual(met.character!.datedPartnerIds, []);
    assert.ok(met.journal.some(entry => entry.text === `You meet ${person.name}.`));
    encounteredNames.add(person.name); encounteredSexes.add(person.sex);
    const dated = engine.choose(met, "date");
    assert.deepEqual(dated.character!.datedPartnerIds, ["slot-a"]);
    assert.equal(dated.character!.partnerId, "slot-a");
    assert.equal(dated.character!.relationshipStatus, "courting");
    const neighbor = ageTo(engine, dated, 19);
    assert.notEqual(neighbor.character!.people!["slot-b"].name, person.name);
    assert.notEqual(neighbor.character!.people!["slot-b"].name, birth.character!.name);
    const again = engine.advance(neighbor);
    assert.deepEqual(again.character!.people!["slot-a"], person);
    assert.equal(again.rngState, neighbor.rngState, "a repeated introduction draws no identity again");
    assert.equal(again.journal.filter(entry => entry.id === "met-slot-a").length, 1);
    assert.deepEqual(engine.load(engine.save(again)), again);
  }
  assert.ok(encounteredNames.size > 3, "the same three people do not recur in every life");
  assert.deepEqual(encounteredSexes, new Set(["male", "female"]));
});

test("unknown identities cannot date, while names and views do not draw future people", () => {
  const engine = createEngine(fixture()), birth = engine.start("view-purity"), before = structuredClone(birth);
  assert.match(characterEffectReason(engine.world, birth, { type: "relationship", partner: "slot-a", status: "courting" })!, /Meet/);
  assert.equal(personText("Ask {person:slot-a}; not {person:missing}.", engine.world, birth), "Ask someone; not someone.");
  assert.equal(matchesCondition({ type: "known-partner", partner: "slot-a" }, birth), false);
  assert.equal(engine.getActivities(birth).some(action => action.id === "visit"), false);
  assert.deepEqual(birth, before);
  const met = ageTo(engine, birth, 18), snapshot = structuredClone(met), person = resolvePartner(engine.world, met, "slot-a")!;
  const options = engine.getChoices(met);
  assert.ok(options.every(option => option.text.includes(person.name)));
  assert.ok(options.every(option => option.outcomes.every(outcome => outcome.text.includes(person.name))));
  assert.equal(personText("Hello {person:slot-a}.", engine.world, met), `Hello ${person.name}.`);
  assert.deepEqual(met, snapshot);
  const declined = engine.choose(met, "decline");
  assert.deepEqual(declined.character!.datedPartnerIds, []);
  const actions = engine.getActivities(declined);
  assert.ok(actions.find(action => action.id === "visit")!.text.includes(person.name));
  assert.deepEqual(engine.load(engine.save(declined)), declined);
});

test("generated partners retain normal adult, marriage, children and breakup rules", () => {
  const engine = createEngine(fixture()), met = ageTo(engine, engine.start("family"), 18);
  const person = resolvePartner(engine.world, met, "slot-a")!;
  assert.match(characterEffectReason(engine.world, met, { type: "relationship", status: "married", partner: "slot-a" })!, new RegExp(`Court ${person.name}`));
  const dated = engine.choose(met, "date");
  const separated = engine.act(dated, "break-up");
  assert.equal(separated.character!.partnerId, null);
  assert.deepEqual(separated.character!.datedPartnerIds, ["slot-a"], "past accepted dates remain recorded");
  const married = engine.act(dated, "marry");
  assert.equal(married.character!.relationshipStatus, "married");
  const next = engine.advance(married);
  const family = engine.act(next, "new-child");
  assert.equal(family.character!.children[0].otherParentId, "slot-a");
  assert.deepEqual(engine.load(engine.save(family)), family);
});

test("birth avatar changes are replayable cosmetic commands with no RNG or activity cost", () => {
  const engine = createEngine(fixture()), birth = engine.start("appearance"), before = structuredClone(birth);
  assert.equal(engine.chooseAvatar(birth, birth.character!.avatarVariant!), birth);
  const variant = (birth.character!.avatarVariant! + 1) % 3;
  const changed = engine.chooseAvatar(birth, variant);
  assert.equal(changed.character!.avatarVariant, variant);
  assert.equal(changed.rngState, birth.rngState);
  assert.equal(changed.age, 0); assert.equal(changed.character!.lastActivityAge, null);
  assert.equal(changed.character!.sex, birth.character!.sex);
  assert.equal(changed.character!.name, birth.character!.name);
  assert.deepEqual(changed.commands, [{ type: "avatar", variant }]);
  assert.deepEqual(birth, before);
  assert.deepEqual(engine.load(engine.save(changed)), changed);
  const unchangedEncounter = ageTo(engine, birth, 18), changedEncounter = ageTo(engine, changed, 18);
  assert.deepEqual(changedEncounter.character!.people, unchangedEncounter.character!.people, "appearance cannot reroll a later acquaintance");
  assert.equal(changedEncounter.rngState, unchangedEncounter.rngState);
  assert.deepEqual(changedEncounter.journal, unchangedEncounter.journal);
  for (const invalid of [-1, 3, .5, Infinity, NaN]) assert.throws(() => engine.chooseAvatar(birth, invalid), /variant/);
  assert.throws(() => engine.chooseAvatar(engine.advance(changed), 0), /before beginning/);
  assert.throws(() => engine.replay(birth.seed, [{ type: "avatar", variant: birth.character!.avatarVariant! }]), /redundant/);
  const forged = JSON.parse(engine.save(changed));
  forged.commands[0].extra = true;
  assert.throws(() => engine.load(JSON.stringify(forged)), /Invalid command/);
  forged.commands = [{ type: "advance" }, { type: "avatar", variant }];
  assert.throws(() => engine.load(JSON.stringify(forged)), /before beginning/);
});

test("old worlds retain birth RNG, named partners, state shape and normal replay", () => {
  const world = fixture();
  delete world.character!.identity; delete world.character!.proceduralPartners;
  world.character!.playerNames = ["Old A", "Old B", "Old C"];
  const engine = createEngine(world), seed = "retained-identity", life = engine.start(seed);
  const expectedRng = nextRandom(nextRandom(seedToUint32(seed)).state).state;
  assert.equal(life.rngState, expectedRng, "only the existing origin and name draws occur");
  for (const field of ["sex", "avatarVariant", "people", "datedPartnerIds"]) assert.equal(field in life.character!, false);
  assert.equal(resolvePartner(engine.world, life, "slot-a")!.name, "Someone at work");
  assert.equal(personText("Ask {person:slot-a}.", engine.world, life), "Ask {person:slot-a}.");
  assert.throws(() => engine.chooseAvatar(life, 0), /unavailable/);
  const met = ageTo(engine, life, 18), dated = engine.choose(met, "date");
  assert.equal("people" in dated.character!, false);
  assert.equal("datedPartnerIds" in dated.character!, false);
  assert.deepEqual(engine.load(engine.save(dated)), dated);
});

test("identity validation rejects incomplete pools, invalid variants and unsafe procedural configuration", () => {
  const mutations: ((world: WorldPack) => void)[] = [
    world => { world.character!.identity!.namePools.male = []; },
    world => { world.character!.identity!.namePools.female = [" Duplicate", "Duplicate"]; },
    world => { world.character!.identity!.namePools.male = ["A", "A"]; },
    world => { world.character!.identity!.avatarVariants = 0; },
    world => { world.character!.identity!.avatarVariants = 1.5; },
    world => { world.character!.requireIntroductions = false; },
    world => { delete world.character!.identity; },
    world => { world.character!.identity!.namePools = { male: ["A"], female: ["B"] }; },
  ];
  for (const mutate of mutations) { const world = fixture(); mutate(world); assert.throws(() => validateWorld(world), /identity|proceduralPartners/); }
});

function encounterLaneFixture(chance = 1, cooldownYears = 2): WorldPack {
  const world = fixture();
  world.eventPacing = { minChoiceGapYears: 1, maxChoiceGapYears: 1 };
  world.character!.encounterPacing = { firstMeetingChance: chance, meetingChance: chance, dateChance: chance, cooldownYears };
  const adult = { type: "age" as const, op: "gte" as const, value: 18 };
  world.events = [
    { id: "adult-plan", title: "Adult plans", text: "A later personal milestone.", trigger: { type: "age", at: 18 }, choices: [choice("plan")] },
    { id: "meet-lane", title: "A shared errand", text: "Someone joins an errand.", trigger: { type: "random", weight: 2 }, maxOccurrences: 1,
      when: { type: "all", conditions: [adult, { type: "not", condition: { type: "known-partner", partner: "slot-a" } }] },
      choices: [choice("introduce", [{ type: "introduce", partner: "slot-a" }])] },
    { id: "date-lane", title: "An invitation", text: "You meet {person:slot-a} again.", trigger: { type: "random", weight: 6 }, maxOccurrences: 1,
      when: { type: "all", conditions: [adult, { type: "known-partner", partner: "slot-a" }, { type: "relationship", status: "single" }] },
      choices: [choice("date", [{ type: "relationship", partner: "slot-a", status: "courting" }])] },
    { id: "ordinary", title: "Ordinary plans", text: "Ordinary work continues.", trigger: { type: "random", weight: 1 }, maxOccurrences: 100, when: adult, choices: [choice("ordinary")] },
  ];
  return world;
}

test("the adult encounter lane precedes adult milestones without generating a person before consent", () => {
  const engine = createEngine(encounterLaneFixture()), before = ageTo(engine, engine.start("lane"), 17);
  assert.deepEqual(before.character!.people, {});
  const meeting = engine.advance(before);
  assert.equal(meeting.pendingEventId, "meet-lane");
  assert.equal(meeting.age, 18);
  assert.deepEqual(meeting.character!.people, {}, "an offered story is not yet an accepted introduction");
  const met = engine.choose(meeting, "introduce");
  assert.equal(met.phase, "ready");
  assert.equal(Object.keys(met.character!.people!).length, 1);
  assert.deepEqual(met.character!.datedPartnerIds, []);
  const rng = met.rngState;
  const visited = engine.act(met, "visit");
  assert.equal(visited.rngState, rng, "activity resolution does not run another social gate");
  assert.equal(visited.phase, "ready");
  const nextYear = engine.advance(visited);
  assert.equal(nextYear.pendingEventId, "adult-plan", "the social cooldown cannot be bypassed through the ordinary random pool");
  const plans = engine.choose(nextYear, "plan");
  const invitation = engine.advance(plans);
  assert.equal(invitation.pendingEventId, "date-lane");
  const dated = engine.choose(invitation, "date");
  assert.deepEqual(dated.character!.datedPartnerIds, ["slot-a"]);
  assert.deepEqual(engine.load(engine.save(dated)), dated);
});

test("zero encounter chances remove social events from the fallback pool and due boundaries still apply", () => {
  const zero = encounterLaneFixture(0);
  zero.events = zero.events.filter(event => ["meet-lane", "date-lane"].includes(event.id));
  const engine = createEngine(zero);
  let life = ageTo(engine, engine.start("zero-chance"), 18);
  assert.equal(life.phase, "ready");
  const rng = life.rngState;
  life = ageTo(engine, life, 22);
  assert.equal(life.rngState, rng, "zero chance needs no probability draw");
  assert.deepEqual(life.character!.people, {});
  const spaced = encounterLaneFixture(1, 0);
  spaced.eventPacing = { minChoiceGapYears: 3, maxChoiceGapYears: 3 };
  const spacedEngine = createEngine(spaced);
  const meeting = ageTo(spacedEngine, spacedEngine.start("decision-boundary"), 18);
  const met = spacedEngine.choose(meeting, "introduce");
  assert.equal(met.nextChoiceAge, 21);
  const nineteen = spacedEngine.advance(met), twenty = spacedEngine.advance(nineteen);
  assert.equal(nineteen.phase, "ready"); assert.equal(twenty.phase, "ready");
  assert.equal(spacedEngine.advance(twenty).pendingEventId, "date-lane");
});

test("fixed-year history, rare events and queued childhood choices retain encounter priority", () => {
  const historical = encounterLaneFixture();
  historical.events.push({ id: "hard-anchor", title: "Dated news", text: "Historical news.", trigger: { type: "year", at: -48 }, choices: [choice("anchor")] });
  const historicalEngine = createEngine(historical);
  assert.equal(ageTo(historicalEngine, historicalEngine.start("hard-anchor"), 18).pendingEventId, "hard-anchor");
  const childhood = encounterLaneFixture();
  childhood.events.unshift({ id: "child-backlog", title: "A delayed childhood choice", text: "An earlier task is finished.", trigger: { type: "age", at: 16 },
    when: { type: "age", op: "gte", value: 18 }, choices: [choice("child")] });
  const childEngine = createEngine(childhood), waiting = ageTo(childEngine, childEngine.start("child-backlog"), 18);
  assert.equal(waiting.pendingEventId, "child-backlog");
  const resolved = childEngine.choose(waiting, "child");
  assert.equal(childEngine.advance(resolved).pendingEventId, "meet-lane");
  const laterYouth = encounterLaneFixture();
  laterYouth.events.unshift({ id: "soft-youth", title: "A later personal errand", text: "An errand can wait.", trigger: { type: "age", at: 17 },
    when: { type: "age", op: "gte", value: 18 }, choices: [choice("youth")] });
  const youthEngine = createEngine(laterYouth);
  assert.equal(ageTo(youthEngine, youthEngine.start("soft-youth"), 18).pendingEventId, "meet-lane", "age-seventeen personal errands can share the adult decision slots");
  const rare = encounterLaneFixture();
  rare.eventPacing!.rareEvents = { annualChance: 1, cooldownYears: 1 };
  rare.events.push({ id: "rare-check", title: "A rare encounter", text: "An exceptional offer.", rarity: "rare", trigger: { type: "random", weight: 1 },
    when: { type: "age", op: "gte", value: 18 }, maxOccurrences: 1, choices: [choice("rare")] });
  const rareEngine = createEngine(rare);
  assert.equal(ageTo(rareEngine, rareEngine.start("rare-first"), 18).pendingEventId, "rare-check");
});

test("medical care and a real loan deadline interrupt before adult encounter opportunities", () => {
  const medical = encounterLaneFixture();
  medical.endings.push({ id: "death", title: "Death", text: "The life ends.", kind: "death" });
  medical.stats.health = { label: "Health", min: 0, max: 100, initial: 80 };
  medical.health = { stat: "health", criticalHealth: 10, declineCondition: "frail", careDecision: "care", description: "Authored test health.", sourceIds: [], supportRecoveryBonus: .1,
    incidenceBands: [{ minAge: 0, maxAge: 79, annualProbability: 0 }], declineBands: [{ minAge: 0, maxAge: 79, healthLoss: 0 }],
    conditions: [{ id: "frail", title: "Frailty", deathCause: "illness", kind: "frailty", weight: 0, healthLoss: 0, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 0 }] };
  medical.events.unshift({ id: "onset", title: "An illness", text: "A condition appears.", mode: "automatic", trigger: { type: "age", at: 18 }, effects: [{ type: "condition", condition: "frail" }], choices: [] });
  medical.events.push({ id: "care", title: "Arrange care", text: "Care is needed.", trigger: { type: "random", weight: 1 }, maxOccurrences: 100, choices: [choice("care", [{ type: "care", amount: 1 }])] });
  const medicalEngine = createEngine(medical);
  assert.equal(ageTo(medicalEngine, medicalEngine.start("medical-first"), 18).pendingEventId, "care");

  const credit = encounterLaneFixture();
  credit.stats.wealth = { label: "Wealth", min: 0, max: 100, initial: 20 };
  credit.economy = { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, assets: [], description: "Authored test ledger.", autoDebtRepayment: false,
    moneylender: { title: "Lender", principal: 100, fee: 30, termYears: 1, threatAfterYears: 1, attackAfterYears: 3, extensionYears: 2, extensionFee: 20, maxExtensions: 1,
      events: { due: "loan-due", threat: "loan-threat", attack: "loan-attack" } } };
  credit.events.find(event => event.id === "meet-lane")!.when = { type: "all", conditions: [{ type: "age", op: "gte", value: 19 }, { type: "not", condition: { type: "known-partner", partner: "slot-a" } }] };
  for (const id of ["loan-due", "loan-threat", "loan-attack"]) credit.events.push({ id, title: id, text: "A payment demand.", trigger: { type: "random", weight: 1 }, maxOccurrences: 100, choices: [choice(`${id}-wait`)] });
  credit.character!.activities.push({ ...choice("borrow", [{ type: "loan", action: "borrow" }]), category: "finance", minAge: 18, usesYearlyActivity: false });
  const creditEngine = createEngine(credit), plan = ageTo(creditEngine, creditEngine.start("loan-first"), 18);
  const settledPlan = creditEngine.choose(plan, "plan"), borrowed = creditEngine.act(settledPlan, "borrow");
  assert.equal(creditEngine.advance(borrowed).pendingEventId, "loan-due");
});

test("encounter policy validation rejects malformed probabilities and nonprocedural worlds", () => {
  for (const change of [
    (world: WorldPack) => { world.character!.encounterPacing!.dateChance = 1.1; },
    (world: WorldPack) => { world.character!.encounterPacing!.meetingChance = -.1; },
    (world: WorldPack) => { world.character!.encounterPacing!.firstMeetingChance = NaN; },
    (world: WorldPack) => { world.character!.encounterPacing!.cooldownYears = 1.5; },
    (world: WorldPack) => { world.character!.proceduralPartners = false; },
    (world: WorldPack) => { delete world.eventPacing; },
  ]) { const world = encounterLaneFixture(); change(world); assert.throws(() => validateWorld(world), /encounterPacing/); }
});
