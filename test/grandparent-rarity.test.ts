import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { familyMemberIsAlive } from "../src/family.ts";
import { contentFingerprint } from "../src/random.ts";
import type { FamilyMember, WorldPack } from "../src/types.ts";
import { familyRelationshipRows } from "../client/models/relationship-table.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { getArchivedBuiltinWorld } from "../server/content.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.42.0.json" with { type: "json" };

function fixture(chance = 0.1): WorldPack {
  return {
    schemaVersion: 1, id: "grandparent-rarity", version: "1", title: "Family", description: "Authored grandparent rarity.", startYear: -350, maxAge: 90,
    stats: { bonds: { label: "Bonds", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "fishing-household", title: "A fishing household", text: "A relative cares for you.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    character: {
      familyBackgrounds: true, familyLivingGrandparentChance: chance,
      identity: { namePools: { male: ["Alexios", "Bion", "Dion", "Leon", "Damon", "Theon"], female: ["Alexia", "Berenike", "Dione", "Kleio", "Eirene", "Thais"] }, avatarVariants: 3 },
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [],
      activities: [{ id: "practice", text: "Practise", category: "training", outcomes: [{ id: "practised", text: "You practise.", weight: 1, effects: [] }] }], childNames: ["Child"],
      deathCauseDescription: "Authored fiction.", deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }],
    },
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}

function grandparents(family: readonly FamilyMember[]): FamilyMember[] {
  return family.filter(member => member.relation.includes("grand"));
}

test("living grandparents occur in a small minority of births, with at most one per household", () => {
  const engine = createEngine(fixture());
  const births = 512;
  let householdsWithGrandparent = 0;
  for (let index = 0; index < births; index++) {
    const birth = engine.start(`rare-grandparents-${index}`), family = birth.character!.family!;
    const ancestors = grandparents(family);
    assert.equal(ancestors.length, 4, "Deceased ancestors remain in the family history.");
    const living = ancestors.filter(member => familyMemberIsAlive(member, 0));
    assert.ok(living.length <= 1);
    if (living.length) householdsWithGrandparent++;
    for (const member of ancestors) {
      const parent = family.find(person => person.relation === (member.relation.startsWith("maternal-") ? "mother" : "father"))!;
      assert.ok(member.deathAge > member.ageOffset - parent.ageOffset, "A grandparent must live long enough for their own child to be born.");
      assert.ok(member.deathAge <= 85);
    }
    const rows = familyRelationshipRows(engine.world, birth).filter(row => row.roles[0].includes("grand"));
    assert.equal(rows.filter(row => !row.deceased).length, living.length);
    assert.equal(rows.filter(row => row.deceased).length, 4 - living.length);
  }
  const proportion = householdsWithGrandparent / births;
  assert.ok(proportion > 0.06 && proportion < 0.14, `Expected about 10% of households; observed ${householdsWithGrandparent}/${births}.`);
});

test("zero and guaranteed household chances obey the same single-grandparent limit", () => {
  for (const chance of [0, 1]) {
    const engine = createEngine(fixture(chance));
    for (let index = 0; index < 32; index++) {
      const family = engine.start(`grandparent-boundary-${index}`).character!.family!;
      assert.equal(grandparents(family).filter(member => familyMemberIsAlive(member, 0)).length, chance);
      assert.ok(family.filter(member => !member.relation.includes("grand")).every(member => familyMemberIsAlive(member, 0)));
    }
  }
});

test("the rarity roll leaves gameplay draws and family identities unchanged", () => {
  const rare = fixture(), original = fixture();
  delete original.character!.familyLivingGrandparentChance;
  const rareEngine = createEngine(rare), originalEngine = createEngine(original);
  for (let index = 0; index < 16; index++) {
    const newer = structuredClone(rareEngine.start(`rare-family-stream-${index}`)), older = structuredClone(originalEngine.start(`rare-family-stream-${index}`));
    assert.equal(newer.rngState, older.rngState);
    for (const parent of newer.character!.family!.filter(member => !member.relation.includes("grand"))) {
      assert.deepEqual(parent, older.character!.family!.find(member => member.id === parent.id));
    }
    assert.deepEqual(newer.character!.family!.map(({ deathAge: _deathAge, ...member }) => member), older.character!.family!.map(({ deathAge: _deathAge, ...member }) => member));
    delete newer.character!.family; delete older.character!.family;
    newer.worldFingerprint = older.worldFingerprint;
    assert.deepEqual(newer, older);
  }
});

test("grandparent survival stays fixed through age progression, replay and save/load", () => {
  const engine = createEngine(fixture(1));
  let life = engine.start("rare-grandparent-lifetime");
  const family = structuredClone(life.character!.family);
  while (life.age < 86) life = engine.advance(life);
  assert.deepEqual(life.character!.family, family);
  assert.ok(grandparents(life.character!.family!).every(member => !familyMemberIsAlive(member, life.age)));
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("new Alexandria births use the rare-grandparent rule without guaranteed-grandparent stories", () => {
  assert.equal(current.character.familyLivingGrandparentChance, 0.1);
  for (const id of ["fishing-household", "temple-household"]) {
    const origin = current.origins.find(origin => origin.id === id)!;
    const childhood = current.events.find(event => event.id === `background-${id}-childhood`)!;
    assert.doesNotMatch(origin.text, /grandparent/i);
    assert.doesNotMatch(childhood.text, /grandparent/i);
  }
});

test("the earlier 0.42 family release keeps its original identities and replay", () => {
  assert.equal(contentFingerprint(retained), "fnv1a64-6c0c56e5f6310175");
  const engine = createEngine(retained), life = engine.start("retained-before-grandparent-rarity");
  assert.equal(engine.world.character!.familyLivingGrandparentChance, undefined);
  assert.ok(familyMemberIsAlive(life.character!.family!.find(member => member.relation === "maternal-grandmother")!, 0));
  assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
  assert.deepEqual(loadAnyLife(engine.save(life)), life);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, retained);
});

test("grandparent probability validates its bounds and requires recorded family", () => {
  for (const value of [-0.1, 1.1, NaN, Infinity, "0.1", null]) {
    const world = fixture();
    (world.character as unknown as Record<string, unknown>).familyLivingGrandparentChance = value;
    assert.throws(() => validateWorld(world), /familyLivingGrandparentChance/);
  }
  const noFamily = fixture();
  delete noFamily.character!.familyBackgrounds;
  assert.throws(() => validateWorld(noFamily), /familyLivingGrandparentChance.*familyBackgrounds/);
});
