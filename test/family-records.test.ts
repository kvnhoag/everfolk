import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { familyMemberAge, familyMemberIsAlive } from "../src/family.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import retained from "../worlds/alexandria-0.40.0.json" with { type: "json" };

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "family-records", version: "1", title: "Family", description: "Fictional family records.", startYear: -66, maxAge: 90,
    stats: { bonds: { label: "Bonds", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "harbor-household", title: "A quay-laborer household", text: "A fictional household.", weight: 1, effects: [] }],
    yearlyEffects: [],
    character: {
      familyBackgrounds: true,
      identity: { namePools: { male: ["Alexios", "Bion", "Dion", "Leon", "Damon", "Theon"], female: ["Alexia", "Berenike", "Dione", "Kleio", "Eirene", "Thais"] }, avatarVariants: 3 },
      proceduralPartners: true, requireIntroductions: true, exclusiveCourtship: true,
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [],
      partners: [{ id: "slot-a", name: "Someone at work", ageOffset: 0, occupation: "Maker", description: "Works near you." }],
      activities: [{ id: "practice", text: "Practice a craft", category: "training", outcomes: [{ id: "practiced", text: "You practice.", weight: 1, effects: [{ type: "skill", skill: "craft", delta: 1 }] }] }], childNames: ["Child A"],
      deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }],
    },
    events: [{ id: "meet-a", title: "A conversation", text: "A person joins a shared task.", trigger: { type: "age", at: 18 }, mode: "automatic", effects: [{ type: "introduce", partner: "slot-a" }], choices: [] }],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}

test("family rules without a rarity override retain both grandparent lines, coherent ages and work", () => {
  const engine = createEngine(fixture());
  const identities = new Set<string>();
  for (let index = 0; index < 32; index++) {
    const life = engine.start(`family-${index}`), family = life.character!.family!;
    assert.deepEqual(family.map(member => member.relation), ["mother", "father", "maternal-grandmother", "maternal-grandfather", "paternal-grandmother", "paternal-grandfather"]);
    assert.equal(new Set([life.character!.name, ...family.map(member => member.name)]).size, 7);
    assert.ok(Object.isFrozen(family));
    const mother = family.find(member => member.relation === "mother")!, father = family.find(member => member.relation === "father")!;
    for (const relative of family) {
      assert.ok(relative.ageOffset >= 18 && relative.ageOffset <= 76);
      assert.equal(relative.originId, life.originId);
      assert.match(relative.background, /quays/);
      assert.ok(["Quay porter", "Dock laborer"].includes(relative.occupation));
      assert.ok(relative.deathAge <= 85);
      assert.ok(Object.isFrozen(relative));
      const parentAge = relative.relation.startsWith("maternal-") ? mother.ageOffset : relative.relation.startsWith("paternal-") ? father.ageOffset : undefined;
      if (parentAge !== undefined) assert.ok(relative.ageOffset - parentAge >= 18);
    }
    assert.ok(familyMemberIsAlive(mother, 0));
    assert.ok(familyMemberIsAlive(father, 0));
    assert.ok(familyMemberIsAlive(family.find(member => member.relation === "maternal-grandmother")!, 0));
    identities.add(family.map(member => member.name).join("|"));
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
  }
  assert.ok(identities.size > 5);
});

test("family ages and deaths follow the player clock without altering or rerolling records", () => {
  const engine = createEngine(fixture()), birth = engine.start("family-lifetimes");
  const before = structuredClone(birth);
  let life = birth;
  while (life.age < 86) life = engine.advance(life);
  assert.deepEqual(life.character!.family, birth.character!.family);
  for (const member of life.character!.family!) {
    const deathAtPlayerAge = member.deathAge - member.ageOffset;
    assert.equal(familyMemberIsAlive(member, deathAtPlayerAge), false);
    assert.equal(familyMemberAge(member, deathAtPlayerAge), member.deathAge);
    if (deathAtPlayerAge > 0) assert.equal(familyMemberIsAlive(member, deathAtPlayerAge - 1), true);
    assert.equal(familyMemberIsAlive(member, life.age), false);
    assert.equal(familyMemberAge(member, life.age), member.deathAge);
  }
  assert.deepEqual(birth, before);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("natal details use an independent stream and leave retained gameplay draws unchanged", () => {
  const withFamily = fixture(), withoutFamily = fixture();
  delete withoutFamily.character!.familyBackgrounds;
  const currentEngine = createEngine(withFamily), originalEngine = createEngine(withoutFamily);
  for (const seed of ["family-stream-a", "family-stream-b", "family-stream-c"]) {
    const current = structuredClone(currentEngine.start(seed)), original = structuredClone(originalEngine.start(seed));
    assert.equal(current.rngState, original.rngState);
    assert.equal(original.character!.family, undefined);
    delete current.character!.family;
    // Fingerprints identify different rules; all gameplay state stays equal.
    current.worldFingerprint = original.worldFingerprint;
    assert.deepEqual(current, original);
  }
  const retainedEngine = createEngine(retained);
  assert.equal(retainedEngine.start("family-retained").character!.family, undefined);
});

test("later encounters reserve family names and preserve all natal identities through save/load", () => {
  const engine = createEngine(fixture());
  let life: LifeState = engine.start("family-encounter");
  const birthFamily = structuredClone(life.character!.family);
  while (life.age < 18) life = engine.advance(life);
  const familyNames = new Set(life.character!.family!.map(member => member.name));
  assert.ok(!familyNames.has(life.character!.people!["slot-a"].name));
  assert.deepEqual(life.character!.family, birthFamily);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("overlapping sex name pools retain enough identities for every relative and encounter", () => {
  const world = fixture();
  world.character!.identity!.namePools.female = ["Alexios", "Bion", "Dion", "Leon", "Eirene", "Thais"];
  const engine = createEngine(world);
  for (let index = 0; index < 24; index++) {
    let life = engine.start(`overlapping-family-${index}`);
    while (life.age < 18) life = engine.advance(life);
    assert.equal(new Set([life.character!.name, ...life.character!.family!.map(member => member.name), life.character!.people!["slot-a"].name]).size, 8);
  }
});

test("all Alexandria household backgrounds have occupational detail without borrowing the protagonist's narration", () => {
  for (const origin of retained.origins) {
    const selected = fixture();
    selected.origins = [{ id: origin.id, title: origin.title, text: origin.text, weight: 1, effects: [] }];
    const family = createEngine(selected).start(`family-origin-${origin.id}`).character!.family!;
    for (const member of family) {
      assert.equal(member.originId, origin.id);
      assert.ok(member.background.length > 20);
      assert.ok(member.occupation.length > 3);
      assert.doesNotMatch(member.background, /You are born|Your parents|Your family/);
    }
  }
});

test("family configuration rejects missing or insufficient identity pools", () => {
  const noIdentity = fixture();
  delete noIdentity.character!.identity;
  delete noIdentity.character!.proceduralPartners;
  assert.throws(() => validateWorld(noIdentity), /familyBackgrounds.*identity pools/);
  const tooFew = fixture();
  tooFew.character!.identity!.namePools.male = ["Bion", "Dion", "Leon"];
  assert.throws(() => validateWorld(tooFew), /four names per sex/);
});
