import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { EncounteredPerson, WorldPack } from "../src/types.ts";
import registry from "../client/models/portrait-asset-registry.json" with { type: "json" };
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.43.0.json" with { type: "json" };
import { childPortraitState, familyPortraitState, personPortraitState, playerPortraitState, resolvePortraitState } from "../client/models/portrait-state.ts";
import type { PortraitInput } from "../client/models/portrait-state.ts";

const engine = createEngine(pack);

test("the state convention reaches every shipped combination through real age/job/role inputs", () => {
  const seen = new Set<string>();
  const ages = { infant: 1, child: 12, youth: 16, adult: 28, middle: 49, elder: 72 };
  for (const asset of registry.assets) {
    const age = ages[asset.stage as keyof typeof ages];
    const identity = registry.identities.find(i => i.id === asset.identityId)!;
    const input: PortraitInput = { age, sex: identity.sex as "male" | "female", avatarVariant: identity.avatarVariant, portraitSet: "ordinary-v3" };
    let state;
    if (asset.wardrobeId === registry.defaultWardrobes[asset.stage as keyof typeof ages]) state = resolvePortraitState(input);
    else if (asset.wardrobeId === "royalty" || asset.wardrobeId === "aristocrat") state = resolvePortraitState({ ...input, role: asset.wardrobeId });
    else {
      const job = registry.jobs.find(j => j.wardrobeId === asset.wardrobeId && j.minAge <= age)!;
      assert.ok(job, asset.id);
      state = resolvePortraitState({ ...input, jobId: job.id });
    }
    assert.equal(state.combinationKey, `${asset.identityId}:${asset.stage}:${asset.wardrobeId}`);
    assert.equal(state.assetId, asset.id);
    assert.equal(state.src, asset.src);
    assert.equal(state.width, 384); assert.equal(state.height, 480);
    assert.ok(Object.isFrozen(state));
    seen.add(state.assetId);
  }
  assert.equal(seen.size, 240);
});

test("age and minimum work ages select existing clothes without changing the face", () => {
  const person = { personKey: "persistent-person", sex: "female" as const, avatarVariant: 2 };
  const stages = [[0, "infant"], [2, "infant"], [3, "child"], [12, "child"], [13, "youth"], [17, "youth"], [18, "adult"], [39, "adult"], [40, "middle"], [59, "middle"], [60, "elder"]] as const;
  const first = resolvePortraitState(person);
  for (const [age, stage] of stages) {
    const state = resolvePortraitState({ ...person, age });
    assert.equal(state.stage, stage);
    assert.equal(state.identityKey, first.identityKey);
    assert.equal(state.identityId, "f03");
  }
  assert.equal(resolvePortraitState({ ...person, age: 11, jobId: "apprentice" }).wardrobeId, "child");
  assert.equal(resolvePortraitState({ ...person, age: 12, jobId: "apprentice" }).wardrobeId, "work");
  assert.equal(resolvePortraitState({ ...person, age: 17, jobId: "soldier" }).wardrobeId, "youth");
  assert.equal(resolvePortraitState({ ...person, age: 18, jobId: "soldier" }).wardrobeId, "military");
  assert.equal(resolvePortraitState({ ...person, age: 30, jobId: "unknown-custom-job", occupation: "Royal army soldier" }).wardrobeId, "everyday");
  for (const role of ["royalty", "aristocrat"] as const) {
    assert.equal(resolvePortraitState({ ...person, age: 15, role }).wardrobeId, "youth");
    assert.equal(resolvePortraitState({ ...person, age: 16, role }).wardrobeId, role);
  }
});

test("the player's role follows its own world opt-in and saved appearance, not wealth or an origin alias", () => {
  const life = engine.start("portrait-role-fixture");
  for (const [originId, role] of [["royal-household", "royalty"], ["estate-household", "aristocrat"]] as const) {
    const view = { ...life, age: 16, originId, character: { ...life.character!, sex: "male" as const, avatarVariant: 1, jobId: "potter" } };
    assert.equal(playerPortraitState(engine.world, view).wardrobeId, role);
    const noRoleWorld: WorldPack = { ...engine.world, royalty: undefined, aristocracy: undefined };
    assert.equal(playerPortraitState(noRoleWorld, view).wardrobeId, "work");
    const before = structuredClone(view);
    const preview = playerPortraitState(engine.world, view, { age: 28 });
    assert.equal(preview.avatarVariant, view.character.avatarVariant);
    assert.equal(preview.wardrobeId, role);
    assert.equal(preview.stage, "adult");
    assert.deepEqual(view, before);
  }
});

test("an NPC's upbringing and relationship labels never replace its recorded face or occupation", () => {
  const life = structuredClone(engine.start("portrait-npc"));
  life.age = 28;
  const person: EncounteredPerson = { ...engine.world.character!.partners[0], sex: "female", avatarVariant: 2, originId: "royal-household", metAge: 18 };
  const first = personPortraitState(engine.world, life, person);
  assert.equal(first.identityId, "f03");
  assert.equal(first.wardrobeId, "maritime");
  assert.equal(first.selectionReason, "occupation");
  life.character!.partnerId = person.id;
  life.character!.relationshipStatus = "married";
  life.character!.relationships!.partners[person.id] = { closeness: 90, lastContactAge: 28, roles: ["friend", "teacher"] };
  assert.deepEqual(personPortraitState(engine.world, life, person), first);
  const changedWork = personPortraitState(engine.world, life, { ...person, name: "Different display name", occupation: "Royal army soldier" });
  assert.equal(changedWork.identityKey, first.identityKey);
  assert.equal(changedWork.wardrobeId, "military");
});

test("remembered family stops aging at death; missing fields get stable cosmetic templates", () => {
  const life = engine.start("portrait-family");
  const member = { ...life.character!.family![0], deathAge: 35 };
  const early = familyPortraitState(engine.world, { ...life, age: 60 }, member);
  const later = familyPortraitState(engine.world, { ...life, age: 90 }, member);
  assert.deepEqual(early, later);
  assert.equal(early.age, 35); assert.equal(early.stage, "adult");
  const child = { id: "child-stable", name: "Unrecorded identity", birthAge: 0, otherParentId: "person-harbor" };
  const childFirst = childPortraitState(engine.world, life, child);
  const childOlder = childPortraitState(engine.world, { ...life, age: 16 }, { ...child, name: "Renamed child" });
  assert.equal(childFirst.identitySource, "presentation-fallback");
  assert.equal(childFirst.identityKey, childOlder.identityKey);
  assert.equal(childFirst.bodyTemplate, childOlder.bodyTemplate);
  assert.equal(childFirst.stage, "infant");
  assert.match(childFirst.src, /^\/assets\/portraits\/concept1-v4\/infant-c1\.png$/);
  assert.ok(registry.assets.some(a => a.src === childFirst.fallbackSrc));
  for (const variant of [-1, .5, 3, Infinity, NaN]) assert.equal(resolvePortraitState({ personKey: "invalid", avatarVariant: variant }).identityKey, resolvePortraitState({ personKey: "invalid" }).identityKey);
  assert.equal(resolvePortraitState({ age: -1 }).stage, "infant");
  assert.equal(resolvePortraitState({ age: NaN }).stage, "adult");
});

test("repeated projection does not alter RNG, state, commands or replay saves in current and retained worlds", () => {
  for (const pack of [engine.world, retained]) {
    const ownEngine = createEngine(pack);
    const life = ownEngine.start("portrait-replay");
    const before = ownEngine.save(life);
    for (let index = 0; index < 5; index++) {
      playerPortraitState(pack, life);
      playerPortraitState(pack, life, { age: 70 });
      for (const member of life.character?.family ?? []) familyPortraitState(pack, life, member);
    }
    assert.equal(ownEngine.save(life), before);
    assert.deepEqual(ownEngine.load(before), life);
    assert.equal(playerPortraitState(pack, ownEngine.load(before)).identityId, playerPortraitState(pack, life).identityId);
  }
});

test("birth assigns varied random portraits reproducibly without a presentation selection step", () => {
  const variants = new Set<number>();
  for (let index = 0; index < 24; index++) {
    const seed = `random-birth-portrait-${index}`;
    const born = engine.start(seed);
    const state = playerPortraitState(engine.world, born);
    variants.add(state.avatarVariant);
    assert.equal(state.avatarVariant, born.character!.avatarVariant);
    assert.equal(state.identitySource, "recorded");
    assert.equal(state.combinationKey, playerPortraitState(engine.world, engine.start(seed)).combinationKey);
    assert.equal(state.identityKey, playerPortraitState(engine.world, born, { age: 70 }).identityKey);
    assert.deepEqual(born.commands, []);
  }
  assert.equal(variants.size, 3);
});
