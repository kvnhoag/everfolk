import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, hasSocialRole, matchesCondition, resolvePartner, validateWorld } from "../src/index.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import raw from "../worlds/alexandria-sample.json" with { type: "json" };
import socialRelease from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import archived from "../worlds/alexandria-0.29.0.json" with { type: "json" };

const world = raw as WorldPack, previous = archived as WorldPack;

// Narrative revisions may change the scene, while these tests retain the
// original introduction and acceptance rules at every named outcome.
function withoutProse<T>(value: T): T {
  return JSON.parse(JSON.stringify(value), (key, item) => ["title", "text", "description"].includes(key) ? undefined : item);
}

test("all sixteen encountered identities offer explicit friendship and bounded shared work", () => {
  validateWorld(world);
  assert.equal(world.version, "0.33.0");
  assert.equal(world.events.filter(event => event.id.startsWith("meet-person-")).length, 16);
  assert.equal(world.character!.activities.length, 256);
  assert.equal(world.character!.socialRelationships, true);
  const engine = createEngine(world), birth = engine.start("social-content-inventory");
  assert.deepEqual(birth.character!.people, {});
  assert.deepEqual(birth.character!.relationships!.partners, {});
  assert.deepEqual(birth.character!.datedPartnerIds, []);
  for (const template of world.character!.partners) {
    const id = template.id;
    const meeting = world.events.find(event => event.id === `meet-${id}`)!;
    assert.deepEqual(withoutProse(meeting), withoutProse(previous.events.find(event => event.id === meeting.id)), "meeting alone must not establish any social role");
    const followup = world.events.find(event => event.id === `date-${id}`)!;
    assert.deepEqual(followup.choices[0].outcomes[0].effects, []);
    const friend = followup.choices.find(choice => choice.id === `keep-friendly-${id}`)!;
    assert.deepEqual(friend.outcomes[0].effects, [{ type: "social-role", partner: id, role: "friend", active: true }, { type: "closeness", target: "partner", partner: id, delta: 3 }]);
    const invite = followup.choices.find(choice => choice.id === `invite-date-${id}`)!;
    const { opportunity, ...invitationRules } = invite;
    assert.deepEqual(withoutProse(invitationRules), withoutProse(previous.events.find(event => event.id === followup.id)!.choices.find(choice => choice.id === invite.id)), "romantic acceptance keeps its actual guards and weights");
    assert.deepEqual(opportunity, { label: "Begin dating", outcomeIds: [`date-${id}-accepted`] });
    const business = world.events.find(event => event.id === `business-proposal-${id}`)!;
    assert.equal(business.trigger.type, "random"); assert.equal(business.maxOccurrences, 1);
    assert.deepEqual(business.choices[0].outcomes[0].effects, []);
    const formation = business.choices.find(choice => choice.id === `form-business-${id}`)!;
    assert.deepEqual(formation.outcomes[0].effects, [{ type: "cash", delta: -20 }, { type: "social-role", partner: id, role: "business-partner", active: true }, { type: "closeness", target: "partner", partner: id, delta: 2 }]);
    assert.deepEqual(world.character!.activities.find(activity => activity.id === formation.id)!.outcomes, formation.outcomes);
    const joint = world.character!.activities.find(activity => activity.id === `joint-order-${id}`)!;
    assert.equal(joint.cooldownYears, 2); assert.notEqual(joint.usesYearlyActivity, false);
    assert.deepEqual(joint.outcomes.map(outcome => outcome.weight), [70, 30]);
    assert.deepEqual(joint.outcomes[0].effects.filter(effect => effect.type === "cash"), [{ type: "cash", delta: -10 }, { type: "cash", delta: 30 }]);
    assert.deepEqual(joint.outcomes[1].effects.filter(effect => effect.type === "cash"), [{ type: "cash", delta: -10 }]);
    for (const role of ["friendship", "business"]) {
      const end = world.character!.activities.find(activity => activity.id === `end-${role}-${id}`)!;
      assert.equal(end.usesYearlyActivity, false);
      assert.ok(end.outcomes[0].effects.every(effect => !["relationship", "divorce", "end-courtship", "cash", "debt", "loan"].includes(effect.type)));
    }
  }
});

test("social ties leave the economy, skills, household care and earlier story rules unchanged", () => {
  // Compare the original social release independently of the later era rewrite.
  const world = socialRelease as WorldPack;
  for (const key of ["stats", "health", "mortality", "economy", "knowledge", "origins", "flags", "legacy", "sources", "yearlyEffects", "yearlyRules", "eventPacing"] as const) assert.deepEqual(withoutProse(world[key]), withoutProse(previous[key]), key);
  for (const key of ["skills", "jobs", "identity", "partners", "childNames", "deathCauses", "encounterPacing"] as const) assert.deepEqual(world.character![key], previous.character![key], key);
  const { description: oldDescription, ...oldRelationships } = previous.relationships!;
  const { description: currentDescription, ...currentRelationships } = world.relationships!;
  assert.deepEqual(currentRelationships, oldRelationships);
  for (const event of previous.events.filter(event => !event.id.startsWith("date-person-"))) assert.deepEqual(withoutProse(world.events.find(current => current.id === event.id)), withoutProse(event), event.id);
  for (const activity of previous.character!.activities.filter(activity => !activity.id.startsWith("court-person-") && activity.id !== "end-courtship")) assert.deepEqual(withoutProse(world.character!.activities.find(current => current.id === activity.id)), withoutProse(activity), activity.id);
  const breakup = world.character!.activities.find(activity => activity.id === "end-courtship")!;
  const oldBreakup = previous.character!.activities.find(activity => activity.id === "end-courtship")!;
  assert.equal(breakup.text, "Stop dating");
  assert.deepEqual(breakup.when, oldBreakup.when);
  assert.deepEqual(breakup.outcomes.map(outcome => ({ weight: outcome.weight, effects: outcome.effects })), oldBreakup.outcomes.map(outcome => ({ weight: outcome.weight, effects: outcome.effects })));
});

function fixture(): WorldPack {
  const value = structuredClone(world);
  const retain = new Set([value.health!.careDecision, ...Object.values(value.economy!.moneylender!.events), "meet-person-harbor", "date-person-harbor", "business-proposal-person-harbor"]);
  value.events = value.events.filter(event => retain.has(event.id));
  for (const [id, at] of [["meet-person-harbor", 18], ["date-person-harbor", 19], ["business-proposal-person-harbor", 20]] as const) value.events.find(event => event.id === id)!.trigger = { type: "age", at };
  delete value.eventPacing; delete value.character!.encounterPacing;
  value.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  value.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  value.yearlyEffects = []; value.yearlyRules = [];
  value.character!.skills.reckoning.initial = 10;
  for (const origin of value.origins) { origin.effects = []; origin.statRanges = { wealth: { min: 20, max: 20 } }; }
  return value;
}
function toAge(engine: LifeEngine, state: LifeState, age: number): LifeState {
  let life = state;
  while (life.age < age && life.phase === "ready") life = engine.advance(life);
  assert.equal(life.age, age);
  return life;
}
function workingPair(engine: LifeEngine, seed: string): LifeState {
  let life = toAge(engine, engine.start(seed), 18);
  life = engine.choose(life, "introduce-person-harbor");
  life = toAge(engine, life, 19);
  life = engine.choose(life, "keep-friendly-person-harbor");
  life = toAge(engine, life, 20);
  return engine.choose(life, "form-business-person-harbor");
}

test("friendship and business can be formed without romance and real joint work can earn or lose cash", () => {
  const engine = createEngine(fixture());
  let success = false, failure = false;
  for (let seed = 0; seed < 32 && (!success || !failure); seed++) {
    const life = workingPair(engine, `social-order-${seed}`), before = structuredClone(life);
    assert.equal(hasSocialRole(life, "person-harbor", "friend"), true);
    assert.equal(hasSocialRole(life, "person-harbor", "business-partner"), true);
    assert.equal(life.character!.relationshipStatus, "single");
    assert.deepEqual(life.character!.datedPartnerIds, []);
    assert.equal(life.economy!.cash, 180);
    const next = engine.act(life, "joint-order-person-harbor"), difference = next.economy!.cash - life.economy!.cash;
    assert.ok(difference === 20 || difference === -10);
    success ||= difference === 20; failure ||= difference === -10;
    assert.equal(next.character!.lastActivityAge, next.age);
    assert.equal(engine.getActivities(next).find(activity => activity.id === "joint-order-person-harbor")!.available, false);
    assert.deepEqual(life, before);
    assert.deepEqual(engine.replay(next.seed, next.commands), next);
    assert.deepEqual(engine.load(engine.save(next)), next);
  }
  assert.equal(success, true); assert.equal(failure, true);
});

test("married people can accept a friendship while romance remains an independent shared role", () => {
  const engine = createEngine(fixture());
  let married = false;
  for (let seed = 0; seed < 32 && !married; seed++) {
    let life = workingPair(engine, `social-romance-${seed}`);
    life = engine.act(life, "court-person-harbor");
    if (life.character!.relationshipStatus !== "courting") continue;
    life = toAge(engine, life, 21);
    life = engine.act(life, "marry-person-harbor"); married = true;
    const person = resolvePartner(engine.world, life, "person-harbor")!;
    assert.equal(life.character!.partnerId, person.id);
    life = engine.act(life, "end-friendship-person-harbor");
    assert.equal(hasSocialRole(life, person.id, "friend"), false);
    assert.equal(hasSocialRole(life, person.id, "business-partner"), true);
    assert.equal(life.character!.relationshipStatus, "married");
    life = engine.act(life, "end-business-person-harbor");
    assert.equal(life.character!.relationshipStatus, "married");
    assert.equal(life.character!.partnerId, person.id);
    assert.deepEqual(life.character!.datedPartnerIds, [person.id]);
    assert.deepEqual(engine.load(engine.save(life)), life);
    // The content's friendship follow-up itself stays eligible for a known
    // married acquaintance, while its separate date choice retains singles.
    const followup = world.events.find(event => event.id === "date-person-harbor")!;
    assert.equal(matchesCondition(followup.when, life), true);
    assert.equal(matchesCondition(followup.choices.find(choice => choice.id === "invite-date-person-harbor")!.when, life), false);
  }
  assert.equal(married, true);
});

test("business startup requires an actual met adult, trust, accounting and affordable cash", () => {
  const engine = createEngine(fixture());
  let life = toAge(engine, engine.start("social-startup-guards"), 18);
  life = engine.choose(life, "introduce-person-harbor");
  const act = () => engine.getActivities(life).find(activity => activity.id === "form-business-person-harbor")!;
  assert.equal(act().available, true);
  for (const [label, mutate] of [
    ["cash", (state: LifeState) => { state.economy!.cash = 19; }],
    ["skill", (state: LifeState) => { state.character!.skills.reckoning = 9; }],
    ["trust", (state: LifeState) => { state.character!.relationships!.partners["person-harbor"].closeness = 44; }],
    ["adulthood", (state: LifeState) => { state.age = 17; }],
  ] as const) {
    const state = structuredClone(life); mutate(state);
    assert.equal(engine.getActivities(state).find(activity => activity.id === "form-business-person-harbor")!.available, false, label);
  }
});

test("0.29 saves retain their exact people, courtship and continuation without new social roles", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-b667908f17db6f4e");
  let life = engine.start("social-029-retained");
  while (life.phase !== "ended" && (life.age < 30 || life.phase === "choice")) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  const loaded = loadAnyLife(engine.save(life)), retained = engineForLife(loaded);
  assert.deepEqual(loaded, life); assert.equal(retained.world.version, "0.29.0");
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  if (life.phase !== "ended") assert.deepEqual(retained.advance(loaded), engine.advance(life));
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  assert.equal(isLegacyFactoryDraft(getBuiltinCatalog(previous).worlds), true);
  const edited = getBuiltinCatalog(previous); edited.worlds[0].pack.description = "Social test draft.";
  assert.equal(isLegacyFactoryDraft(edited.worlds), false);
});
