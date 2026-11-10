import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, resolvePartner, validateWorld } from "../src/index.ts";
import { engineForLife, loadAnyLife } from "../client/session.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
// Keep the 0.29 introduction-only release comparison exact; 0.30 social ties have independent tests.
import raw from "../worlds/alexandria-0.29.0.json" with { type: "json" };
import old from "../worlds/alexandria-0.28.0.json" with { type: "json" };

const world = raw as WorldPack, previous = old as WorldPack;

test("new lives draw identities from both sex-specific pools and do not contain a pre-existing candidate catalog", () => {
  validateWorld(world);
  assert.equal(world.version, "0.29.0");
  assert.equal(world.events.length, 455);
  assert.equal(world.character!.partners.length, 16);
  assert.equal(world.character!.identity!.avatarVariants, 3);
  assert.equal(world.character!.proceduralPartners, true);
  assert.deepEqual(world.character!.encounterPacing, { firstMeetingChance: .7, meetingChance: .3, dateChance: .75, cooldownYears: 2 });
  const engine = createEngine(world), sexes = new Set<string>();
  for (let seed = 0; seed < 64; seed++) {
    const life = engine.start(`people-birth-${seed}`), character = life.character!;
    sexes.add(character.sex!);
    assert.ok(world.character!.identity!.namePools[character.sex!].includes(character.name!));
    assert.deepEqual(character.people, {});
    assert.deepEqual(character.knownPartnerIds, []);
    assert.deepEqual(character.datedPartnerIds, []);
    assert.ok(engine.getActivities(life).every(activity => !activity.id.includes("person-")));
  }
  assert.deepEqual([...sexes].sort(), ["female", "male"]);
});

test("sixteen encounter situations are optional random stories, followed by a separate named dating decision", () => {
  const engine = createEngine(world), adult = structuredClone(engine.start("meet-context"));
  adult.age = 18; adult.year = -48;
  for (const template of world.character!.partners) {
    assert.equal(template.name, "An acquaintance");
    assert.ok(template.ageOffset >= 0 && template.ageOffset <= 4);
    const meet = world.events.find(event => event.id === `meet-${template.id}`)!;
    const date = world.events.find(event => event.id === `date-${template.id}`)!;
    assert.equal(meet.trigger.type, "random"); assert.equal(meet.maxOccurrences, 1);
    assert.equal(date.trigger.type, "random"); assert.equal(date.maxOccurrences, 1);
    assert.ok(!meet.mode && !date.mode);
    assert.deepEqual(meet.choices[0].outcomes[0].effects, []);
    const greeting = meet.choices.find(choice => choice.id === `introduce-${template.id}`)!;
    assert.deepEqual(greeting.outcomes[0].effects, [{ type: "introduce", partner: template.id }]);
    assert.equal(matchesCondition(date.when, adult), false, "Unknown people cannot offer a date");
    assert.deepEqual(date.choices[0].outcomes[0].effects, []);
    const invitation = date.choices.find(choice => choice.id === `invite-date-${template.id}`)!;
    assert.ok(invitation.text.includes(`{person:${template.id}}`));
    assert.equal(invitation.outcomes[0].weight, 65);
    assert.deepEqual(invitation.outcomes[0].effects[0], { type: "relationship", partner: template.id, status: "courting" });
    assert.equal(invitation.outcomes[1].weight, 35);
    assert.deepEqual(invitation.outcomes[1].effects, []);
  }
  for (const id of ["demetria", "thais", "berenike", "tyche"]) {
    assert.equal(world.events.some(event => event.id === `meet-${id}`), false);
    assert.equal(world.character!.activities.some(activity => activity.id === `court-${id}`), false);
  }
});

test("gender, encounters and avatars leave skills, loan terms, mortality and nonrelationship careers unchanged", () => {
  for (const key of ["stats", "health", "mortality", "economy", "knowledge", "origins", "flags", "legacy", "sources", "yearlyEffects", "yearlyRules", "eventPacing"] as const) assert.deepEqual(world[key], previous[key], key);
  for (const key of ["skills", "jobs", "childNames", "deathCauses"] as const) assert.deepEqual(world.character![key], previous.character![key], key);
  for (const activity of previous.character!.activities.filter(activity => activity.category !== "relationship" && activity.id !== "grow-household")) {
    assert.deepEqual(world.character!.activities.find(current => current.id === activity.id), activity, activity.id);
  }
  const family = world.character!.activities.find(activity => activity.id === "grow-household")!;
  const earlier = previous.character!.activities.find(activity => activity.id === "grow-household")!;
  assert.deepEqual(family.when, earlier.when);
  assert.deepEqual(family.outcomes.map(outcome => ({ weight: outcome.weight, effects: outcome.effects })), earlier.outcomes.map(outcome => ({ weight: outcome.weight, effects: outcome.effects })));
  assert.ok(family.text.includes("welcome a child"));
});

function lifecycleWorld(): WorldPack {
  const fixture = structuredClone(world);
  const retained = new Set([fixture.health!.careDecision, ...Object.values(fixture.economy!.moneylender!.events), "meet-person-harbor", "date-person-harbor"]);
  fixture.events = fixture.events.filter(event => retained.has(event.id));
  fixture.events.find(event => event.id === "meet-person-harbor")!.trigger = { type: "age", at: 18 };
  fixture.events.find(event => event.id === "date-person-harbor")!.trigger = { type: "age", at: 19 };
  delete fixture.eventPacing;
  delete fixture.character!.encounterPacing;
  fixture.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  fixture.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  fixture.yearlyEffects = []; fixture.yearlyRules = [];
  return fixture;
}
function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target && life.phase === "ready") life = engine.advance(life);
  assert.equal(life.age, target);
  return life;
}

test("ordinary commands meet a generated person, ask for a date and retain accepted or declined outcomes exactly", () => {
  const engine = createEngine(lifecycleWorld());
  let accepted = false, declined = false;
  for (let seed = 0; seed < 32 && (!accepted || !declined); seed++) {
    let life = ageTo(engine, engine.start(`people-lifecycle-${seed}`), 18);
    assert.equal(life.pendingEventId, "meet-person-harbor");
    assert.equal(resolvePartner(engine.world, life, "person-harbor"), undefined);
    assert.deepEqual(life.character!.people, {});
    const left = engine.choose(life, "leave-person-harbor");
    assert.deepEqual(left.character!.people, {});
    life = engine.choose(life, "introduce-person-harbor");
    const person = resolvePartner(engine.world, life, "person-harbor")!;
    assert.ok(person.name !== "An acquaintance");
    assert.ok(life.journal.some(entry => entry.text.includes(person.name)));
    assert.deepEqual(life.character!.datedPartnerIds, []);
    assert.equal(life.character!.relationshipStatus, "single");
    life = ageTo(engine, life, 19);
    assert.equal(life.pendingEventId, "date-person-harbor");
    const invitation = engine.getChoices(life).find(choice => choice.id === "invite-date-person-harbor")!;
    assert.ok(invitation.text.includes(person.name));
    assert.ok(!invitation.text.includes("{person:"));
    const friendly = engine.choose(life, "keep-friendly-person-harbor");
    assert.deepEqual(friendly.character!.datedPartnerIds, []);
    life = engine.choose(life, invitation.id);
    if (life.character!.relationshipStatus === "courting") {
      accepted = true;
      assert.equal(life.character!.partnerId, person.id);
      assert.deepEqual(life.character!.datedPartnerIds, [person.id]);
      const wedding = engine.getActivities(life).find(activity => activity.id === "marry-person-harbor")!;
      assert.ok(wedding.text.includes(person.name));
    } else {
      declined = true;
      assert.equal(life.character!.partnerId, null);
      assert.deepEqual(life.character!.datedPartnerIds, []);
    }
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    assert.deepEqual(engine.load(engine.save(life)), life);
    assert.equal(resolvePartner(engine.world, life, person.id)!.name, person.name);
  }
  assert.equal(accepted, true); assert.equal(declined, true);
});

test("0.28 lives keep their original named encounters and exact continuation while edited drafts remain intact", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-3ed4b078a583bc01");
  let life = engine.start("people-028-retained");
  while (life.phase !== "ended" && (life.age < 30 || life.phase === "choice")) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  const loaded = loadAnyLife(engine.save(life)), retained = engineForLife(loaded);
  assert.equal(retained.world.version, "0.28.0");
  assert.deepEqual(loaded, life);
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  if (life.phase !== "ended") assert.deepEqual(retained.advance(loaded), engine.advance(life));
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  assert.equal(isLegacyFactoryDraft(getBuiltinCatalog(previous).worlds), true);
  const edited = getBuiltinCatalog(previous); edited.worlds[0].pack.description = "Custom household playtest.";
  assert.equal(isLegacyFactoryDraft(edited.worlds), false);
});
