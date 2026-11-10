import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld, applySocialRole, hasSocialRole } from "../src/index.ts";
import { activityPartnerIds, characterEffectReason } from "../src/character.ts";
import { relationshipSupport } from "../src/relationships.ts";
import type { Choice, Condition, Effect, LifeEngine, LifeState, SocialRole, WorldPack } from "../src/types.ts";
import retained from "../worlds/alexandria-0.29.0.json" with { type: "json" };
import { selectAutomaticChoice } from "../client/yearly-focus.ts";

const role = (value: SocialRole, active = true, partner = "person-a"): Extract<Effect, { type: "social-role" }> => ({ type: "social-role", partner, role: value, active });
const option = (id: string, effects: Effect[] = []): Choice => ({ id, text: `${id} with {person:person-a}`, outcomes: [{ id: `${id}-done`, text: `You and {person:person-a} ${id}.`, weight: 1, effects }] });
function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "social-roles", version: "1", title: "Roles", description: "Fictional explicit social ties.", startYear: -66, maxAge: 70,
    stats: { bonds: { label: "Bonds", min: 0, max: 100, initial: 70 }, wealth: { label: "Wealth", min: 0, max: 200, initial: 100 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "A household.", weight: 1, effects: [] }], yearlyEffects: [],
    economy: { stat: "wealth", currency: { singular: "coin", plural: "coins", short: "c" }, unitsPerPoint: 1, description: "Authored money.", assets: [], autoDebtRepayment: false },
    relationships: { description: "Authored ties.", initialCloseness: 65, childCloseness: 65, decayAfterYears: 100, yearlyDecay: 0, marriageMinimum: 40, supportThreshold: 60, maxHealthSupport: .1 },
    character: {
      identity: { namePools: { male: ["Bion", "Dion", "Leon", "Theon"], female: ["Bia", "Dione", "Leone", "Thea"] }, avatarVariants: 3 },
      proceduralPartners: true, requireIntroductions: true, exclusiveCourtship: true, socialRelationships: true,
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [],
      partners: [
        { id: "person-a", name: "An acquaintance", ageOffset: 0, occupation: "Maker", description: "Makes useful things." },
        { id: "person-b", name: "A second acquaintance", ageOffset: -1, occupation: "Reader", description: "Checks copies." },
      ],
      activities: [
        ...[["friend", role("friend")], ["business", role("business-partner")], ["unfriend", role("friend", false)], ["end-business", role("business-partner", false)]]
          .map(([id, effect]) => ({ ...option(id as string, [effect as Effect]), category: "relationship" as const, minAge: 18, usesYearlyActivity: false })),
        { ...option("friend-b", [role("friend", true, "person-b")]), category: "relationship", usesYearlyActivity: false },
        { ...option("marry", [{ type: "relationship", partner: "person-a", status: "married" }]), category: "relationship", usesYearlyActivity: false },
        { ...option("break-up", [{ type: "end-courtship" }]), category: "relationship", usesYearlyActivity: false },
        { ...option("divorce", [{ type: "divorce" }]), category: "relationship", usesYearlyActivity: false },
      ],
      childNames: ["Child"], deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }],
    },
    events: [
      { id: "meet-a", title: "A task", text: "Someone joins a task.", trigger: { type: "age", at: 18 }, mode: "automatic", effects: [{ type: "introduce", partner: "person-a" }], choices: [] },
      { id: "date-a", title: "A meeting", text: "You meet {person:person-a}.", trigger: { type: "age", at: 18 }, choices: [option("date", [{ type: "relationship", status: "courting", partner: "person-a" }]), option("decline")] },
      { id: "meet-b", title: "A reader", text: "A reader shares a task.", trigger: { type: "age", at: 19 }, mode: "automatic", effects: [{ type: "introduce", partner: "person-b" }], choices: [] },
    ],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}
function ageTo(engine: LifeEngine, state: LifeState, age: number): LifeState {
  while (state.age < age) { assert.equal(state.phase, "ready"); state = engine.advance(state); }
  return state;
}
function adult() {
  const engine = createEngine(fixture());
  const met = ageTo(engine, engine.start("social-role-life"), 18);
  return { engine, met, life: engine.choose(met, "decline") };
}

test("explicit social roles coexist and removing one preserves the other, identity and immutable prior snapshots", () => {
  const { engine, life } = adult(), before = structuredClone(life);
  assert.equal(life.character!.relationships!.partners["person-a"].roles, undefined);
  const friend = engine.act(life, "friend"), friendBefore = structuredClone(friend);
  const both = engine.act(friend, "business");
  assert.deepEqual(both.character!.relationships!.partners["person-a"].roles, ["friend", "business-partner"]);
  assert.ok(Object.isFrozen(both.character!.relationships!.partners["person-a"].roles));
  assert.notEqual(both.character!.relationships!.partners["person-a"].roles, friend.character!.relationships!.partners["person-a"].roles);
  const businessOnly = engine.act(both, "unfriend");
  assert.deepEqual(businessOnly.character!.relationships!.partners["person-a"].roles, ["business-partner"]);
  const none = engine.act(businessOnly, "end-business");
  assert.equal(none.character!.relationships!.partners["person-a"].roles, undefined);
  assert.deepEqual(none.character!.people, life.character!.people);
  assert.deepEqual(none.character!.knownPartnerIds, life.character!.knownPartnerIds);
  assert.equal(none.character!.relationshipStatus, "single");
  assert.equal(none.rngState, life.rngState);
  assert.deepEqual(none.economy, life.economy, "assigning roles creates no income");
  assert.equal(relationshipSupport(engine.world, both), 0, "friends and business partners add no unconfigured health support");
  assert.deepEqual(life, before); assert.deepEqual(friend, friendBefore);
  assert.deepEqual(engine.load(engine.save(none)), none);
  assert.deepEqual(engine.replay(none.seed, none.commands), none);
});

test("friendship and business remain separate from courtship, marriage, separation and romantic history", () => {
  const { engine, met } = adult();
  let life = engine.choose(met, "date");
  life = engine.act(engine.act(life, "friend"), "business");
  life = engine.act(life, "marry");
  const married = life;
  life = engine.act(life, "end-business");
  assert.equal(life.character!.relationshipStatus, "married");
  assert.equal(life.character!.partnerId, "person-a");
  assert.deepEqual(life.character!.datedPartnerIds, ["person-a"]);
  assert.equal(hasSocialRole(life, "person-a", "friend"), true);
  life = engine.act(life, "divorce");
  assert.equal(life.character!.relationshipStatus, "divorced");
  assert.equal(hasSocialRole(life, "person-a", "friend"), true);
  assert.deepEqual(life.character!.datedPartnerIds, ["person-a"]);
  assert.deepEqual(married.character!.relationships!.partners["person-a"].roles, ["friend", "business-partner"]);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("role activities require an actually met adult and reject duplicate additions or absent removals", () => {
  const { engine, life } = adult();
  assert.equal(engine.getActivities(life).some(activity => activity.id === "friend-b"), false, "unknown person controls stay undiscovered");
  assert.match(characterEffectReason(engine.world, life, role("friend", true, "person-b"))!, /Meet/);
  assert.throws(() => engine.act(life, "unfriend"), /not established/);
  const friend = engine.act(life, "friend");
  assert.throws(() => engine.act(engine.advance(friend), "friend"), /already friends/);
  const snapshot = structuredClone(friend), before = structuredClone(snapshot);
  applySocialRole(engine.world, snapshot, role("friend"));
  assert.deepEqual(snapshot, before, "accepted duplicate application is idempotent");
  const underageWorld = fixture();
  underageWorld.events[0].trigger = { type: "age", at: 17 };
  const underageEngine = createEngine(underageWorld), underage = ageTo(underageEngine, underageEngine.start("underage-role"), 17);
  assert.match(characterEffectReason(underageEngine.world, underage, role("friend"))!, /at least 18/);
  const youngerWorld = fixture(); youngerWorld.events[2].trigger = { type: "age", at: 18 };
  const youngerEngine = createEngine(youngerWorld), younger = ageTo(youngerEngine, youngerEngine.start("younger-person"), 18);
  const ready = youngerEngine.choose(younger, "decline");
  assert.match(characterEffectReason(youngerEngine.world, ready, role("friend", true, "person-b"))!, /at least 18/);
  const noFeature = structuredClone(engine.world); delete noFeature.character!.socialRelationships;
  assert.throws(() => applySocialRole(noFeature, structuredClone(life), role("friend")), /no social relationship/);
});

test("social-role conditions and partner-reference discovery read only the declared person", () => {
  const { engine, life } = adult(), before = structuredClone(life);
  assert.equal(matchesCondition(role("friend"), life), false);
  assert.equal(matchesCondition(role("friend", false), life), true);
  const friend = engine.act(life, "friend");
  assert.equal(matchesCondition(role("friend"), friend), true);
  assert.equal(matchesCondition(role("business-partner"), friend), false);
  assert.equal(matchesCondition(role("friend", true, "person-b"), friend), false);
  assert.deepEqual(activityPartnerIds({ ...option("conditional"), category: "career", when: role("business-partner", true, "person-b") }), ["person-b"]);
  assert.deepEqual(activityPartnerIds({ ...option("explicit", [role("friend")]), category: "relationship" }), ["person-a"]);
  assert.deepEqual(life, before);
});

test("a married player can receive a friendship follow-up in the dedicated people lane", () => {
  const world = fixture();
  world.eventPacing = { minChoiceGapYears: 1, maxChoiceGapYears: 1 };
  world.character!.encounterPacing = { firstMeetingChance: 0, meetingChance: 0, dateChance: 1, cooldownYears: 1 };
  world.events.push({ id: "friendship-follow-up", title: "A friendship grows", text: "You meet {person:person-b} again.", trigger: { type: "random", weight: 1 }, maxOccurrences: 1,
    when: { type: "all", conditions: [{ type: "known-partner", partner: "person-b" }, role("friend", false, "person-b")] },
    choices: [option("stay-acquaintances"), option("become-friends", [role("friend", true, "person-b")])] });
  const engine = createEngine(world), met = ageTo(engine, engine.start("married-follow-up"), 18);
  const married = engine.act(engine.choose(met, "date"), "marry");
  const offered = engine.advance(married);
  assert.equal(offered.pendingEventId, "friendship-follow-up");
  const accepted = engine.choose(offered, "become-friends");
  assert.equal(hasSocialRole(accepted, "person-b", "friend"), true);
  assert.equal(accepted.character!.relationshipStatus, "married");
  assert.equal(accepted.character!.partnerId, "person-a");
  assert.deepEqual(engine.replay(accepted.seed, accepted.commands), accepted);
});

test("validation rejects undeclared people, invalid roles and non-opted-in role definitions", () => {
  for (const [label, change] of [
    ["flag", (world: WorldPack) => { delete world.character!.socialRelationships; }],
    ["invalid flag", (world: WorldPack) => { (world.character as unknown as Record<string, unknown>).socialRelationships = "yes"; }],
    ["procedural", (world: WorldPack) => { delete world.character!.proceduralPartners; }],
    ["relationships", (world: WorldPack) => { delete world.relationships; }],
    ["role", (world: WorldPack) => { (world.character!.activities[0].outcomes[0].effects[0] as unknown as Record<string, unknown>).role = "lover"; }],
    ["active", (world: WorldPack) => { (world.character!.activities[0].outcomes[0].effects[0] as unknown as Record<string, unknown>).active = 1; }],
    ["person", (world: WorldPack) => { (world.character!.activities[0].outcomes[0].effects[0] as unknown as Record<string, unknown>).partner = "unknown"; }],
    ["condition", (world: WorldPack) => { world.character!.activities[0].when = { ...role("friend"), role: "stranger" } as unknown as Condition; }],
  ] as const) {
    const world = fixture(); change(world);
    assert.throws(() => validateWorld(world), undefined, label);
  }
});

test("retained 0.29 lives keep exact states, draws and replay without social role fields", () => {
  const engine = createEngine(retained);
  let life = engine.start("social-legacy-0.29");
  while (life.phase !== "ended" && life.age < 32) {
    if (life.phase === "choice") {
      const choices = engine.getChoices(life);
      const meet = choices.find(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "introduce")));
      life = engine.choose(life, (meet ?? selectAutomaticChoice(choices, engine.world, life)!).id);
    } else life = engine.advance(life);
    for (const tie of Object.values(life.character!.relationships!.partners)) assert.equal(Object.hasOwn(tie, "roles"), false);
  }
  assert.equal(engine.fingerprint, "fnv1a64-b667908f17db6f4e");
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
