import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, hasSocialRole, matchesCondition, validateWorld } from "../src/index.ts";
import { characterEffectReason } from "../src/character.ts";
import type { LifeEngine, LifeState, SocialRole, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.41.0.json" with { type: "json" };
import { relationshipLabels, visibleRelationshipPeople } from "../client/models/relationship-labels.ts";
import { socialRoleImpact } from "../client/models/social-role-impact.ts";
import { withoutMarketSignals, withoutMoneylender } from "./fixture-features.ts";

const personId = "person-harbor";
function fixture(kind: "teacher" | "disciple" | "enmity"): WorldPack {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  withoutMarketSignals(world);
  delete world.mortality; delete world.health!.mortalityCalibration;
  delete world.eventPacing; delete world.character!.encounterPacing;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = []; world.yearlyRules = [];
  world.character!.skills.seamanship.initial = kind === "disciple" ? 40 : 10;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = { health: { min: 100, max: 100 } }; }
  world.events = world.events.filter(event => [world.health!.careDecision, `meet-${personId}`, `${kind}-offer-${personId}`].includes(event.id));
  world.events.find(event => event.id === `meet-${personId}`)!.trigger = { type: "age", at: kind === "disciple" ? 25 : 18 };
  world.events.find(event => event.id === `${kind}-offer-${personId}`)!.trigger = { type: "age", at: kind === "disciple" ? 26 : 19 };
  return world;
}
function reach(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) { assert.equal(life.phase, "ready"); life = engine.advance(life); }
  return life;
}
function offered(kind: "teacher" | "disciple" | "enmity") {
  const engine = createEngine(fixture(kind)), startAge = kind === "disciple" ? 25 : 18;
  let life = reach(engine, engine.start(`extended-role-${kind}`), startAge);
  life = engine.choose(life, `introduce-${personId}`);
  assert.deepEqual(visibleRelationshipPeople(engine.world, life), [], "Meeting does not confer a role.");
  life = engine.advance(life);
  assert.equal(life.pendingEventId, `${kind}-offer-${personId}`);
  return { engine, life };
}

test("teachers, disciples and enemies appear only after the explicit arrangement or dispute is accepted", () => {
  for (const [kind, accept, expected] of [["teacher", "ask-teacher", "Teacher"], ["disciple", "take-disciple", "Disciple"], ["enmity", "become-enemies", "Enemy"]] as const) {
    const { engine, life } = offered(kind), before = structuredClone(life);
    const declined = engine.choose(life, `decline-${kind}-${personId}`);
    assert.deepEqual(relationshipLabels(engine.world, declined, personId), []);
    const accepted = engine.choose(life, `${accept}-${personId}`);
    assert.deepEqual(relationshipLabels(engine.world, accepted, personId), [expected]);
    assert.deepEqual(visibleRelationshipPeople(engine.world, accepted).map(person => person.id), [personId]);
    assert.equal(accepted.character!.relationshipStatus, "single");
    assert.deepEqual(accepted.character!.datedPartnerIds, []);
    assert.deepEqual(engine.load(engine.save(accepted)), accepted);
    assert.deepEqual(engine.replay(accepted.seed, accepted.commands), accepted);
    assert.deepEqual(life, before);
  }
});

test("learning requires a recorded teacher, uses the yearly action and applies the authored skill gain", () => {
  const { engine, life } = offered("teacher");
  const accepted = engine.choose(life, `ask-teacher-${personId}`);
  assert.equal(accepted.character!.skills.seamanship, 10, "Agreeing on lessons is not already practice.");
  const learned = engine.act(accepted, `learn-from-${personId}`);
  assert.equal(learned.character!.skills.seamanship, 12);
  assert.equal(learned.character!.lastActivityAge, learned.age);
  assert.throws(() => engine.act(learned, `learn-from-${personId}`), /major activity/);
  const ended = engine.act(learned, `leave-teacher-${personId}`);
  assert.equal(hasSocialRole(ended, personId, "teacher"), false);
  assert.equal(engine.getActivities(ended).find(activity => activity.id === `learn-from-${personId}`)!.available, false);
  assert.deepEqual(engine.replay(ended.seed, ended.commands), ended);
});

test("teaching a disciple requires experience, while ending the arrangement keeps a separate friendship", () => {
  const { engine, life } = offered("disciple");
  let accepted = engine.choose(life, `take-disciple-${personId}`);
  accepted = engine.act(accepted, `befriend-${personId}`);
  accepted = engine.advance(accepted);
  accepted = engine.act(accepted, `teach-disciple-${personId}`);
  assert.equal(accepted.character!.skills.seamanship, 40, "A lesson does not fabricate experience for the player or a simulated pupil skill.");
  const ended = engine.act(accepted, `release-disciple-${personId}`);
  assert.deepEqual(relationshipLabels(engine.world, ended, personId), ["Friend"]);
  const inexperienced = structuredClone(life); inexperienced.character!.skills.seamanship = 39;
  assert.equal(engine.getChoices(inexperienced).some(choice => choice.id === `take-disciple-${personId}`), false);
  assert.deepEqual(engine.replay(ended.seed, ended.commands), ended);
});

test("enemy and reciprocal teaching roles cannot silently coexist with incompatible arrangements", () => {
  const { engine, life } = offered("teacher"), accepted = engine.choose(life, `ask-teacher-${personId}`);
  const effect = (role: SocialRole) => ({ type: "social-role" as const, partner: personId, role, active: true });
  assert.match(characterEffectReason(engine.world, accepted, effect("disciple"))!, /reversing/);
  assert.match(characterEffectReason(engine.world, accepted, effect("enemy"))!, /cooperative/);
  const hostile = offered("enmity"), enemy = hostile.engine.choose(hostile.life, `become-enemies-${personId}`);
  for (const role of ["friend", "business-partner", "teacher", "disciple"] as const) assert.match(characterEffectReason(hostile.engine.world, enemy, effect(role))!, /hostility/);
  assert.match(characterEffectReason(hostile.engine.world, enemy, { type: "relationship", partner: personId, status: "courting" })!, /hostility/);
  const settled = hostile.engine.act(enemy, `settle-enmity-${personId}`);
  assert.deepEqual(relationshipLabels(hostile.engine.world, settled, personId), []);
  assert.equal(settled.character!.datedPartnerIds!.length, 0);
});

test("an earlier friendship or date follow-up cannot offer cooperation with a newly established enemy", () => {
  const world = fixture("enmity");
  const followup = structuredClone(pack.events.find(event => event.id === `date-${personId}`)!);
  followup.trigger = { type: "age", at: 20 };
  world.events.push(followup);
  const engine = createEngine(world);
  let life = reach(engine, engine.start("enemy-before-friendly-followup"), 18);
  life = engine.choose(life, `introduce-${personId}`);
  life = engine.choose(engine.advance(life), `become-enemies-${personId}`);
  assert.equal(hasSocialRole(life, personId, "enemy"), true);
  assert.equal(matchesCondition(followup.when, life), false);
  for (const choice of followup.choices.filter(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "relationship" || effect.type === "social-role" && effect.active)))) {
    assert.equal(matchesCondition(choice.when, life), false, choice.id);
  }
  const hostileNextYear = engine.advance(life);
  assert.equal(hostileNextYear.phase, "ready", "The old friendly follow-up must stay ineligible while these people are enemies.");
  const settled = engine.act(life, `settle-enmity-${personId}`);
  const offered = engine.advance(settled);
  assert.equal(offered.pendingEventId, followup.id);
  const friendly = engine.choose(offered, `keep-friendly-${personId}`);
  assert.deepEqual(relationshipLabels(engine.world, friendly, personId), ["Friend"]);
  assert.deepEqual(engine.replay(friendly.seed, friendly.commands), friendly);
});

test("new role previews describe teaching and hostility without inventing business or future identities", () => {
  const { engine, life } = offered("enmity"), choice = engine.getChoices(life).find(choice => choice.id === `become-enemies-${personId}`)!;
  const person = life.character!.people![personId];
  assert.deepEqual(socialRoleImpact(choice, life, engine.world), [{ text: `Hostility with ${person.name}`, gain: false }]);
  const future = structuredClone(life); future.character!.people![personId].metAge = life.age + 1;
  assert.deepEqual(relationshipLabels(engine.world, future, personId), []);
  assert.deepEqual(visibleRelationshipPeople(engine.world, future), []);
  assert.match(socialRoleImpact(choice, future, engine.world)[0].text, /someone you meet/);
  assert.equal(life.character!.relationships!.partners[personId].roles, undefined);
});

test("expanded role schemas require explicit opt-in and the previous release keeps its state contract", () => {
  const world = fixture("teacher");
  delete world.character!.extendedSocialRoles;
  assert.throws(() => validateWorld(world), /role/);
  const invalid = fixture("teacher");
  (invalid.character as unknown as Record<string, unknown>).extendedSocialRoles = "yes";
  assert.throws(() => validateWorld(invalid), /boolean/);
  const engine = createEngine(retained), life = engine.start("retained-family-role-boundary");
  assert.equal(engine.world.character!.extendedSocialRoles, undefined);
  assert.equal(engine.world.character!.familyBackgrounds, undefined);
  assert.equal(Object.hasOwn(life.character!, "family"), false);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
