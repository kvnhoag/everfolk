import { withoutMarketSignals } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, personText, resolvePartner } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { applyPeople } from "../scripts/alexandria-people.mjs";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import prior from "../worlds/alexandria-0.28.0.json" with { type: "json" };

const world = current as WorldPack;

test("authored male and female pools are explicit, disjoint and independent of the legacy name list", () => {
  const pools = world.character!.identity!.namePools;
  for (const sex of ["male", "female"] as const) {
    assert.equal(pools[sex].length, 32);
    assert.equal(new Set(pools[sex].map(name => name.toLocaleLowerCase())).size, 32);
  }
  assert.equal(new Set([...pools.male, ...pools.female].map(name => name.toLocaleLowerCase())).size, 64);
  const draft = structuredClone(prior) as WorldPack;
  draft.character!.playerNames = ["A legacy name used by an older editor"];
  applyPeople(draft);
  assert.deepEqual(draft.character!.identity!.namePools, pools);
  draft.character!.identity!.namePools.male[0] = "A draft-only edit";
  const other = structuredClone(prior) as WorldPack;
  applyPeople(other);
  assert.deepEqual(other.character!.identity!.namePools, pools, "editing a draft never mutates shared authored pools");
});

test("current births always choose a name from the recorded sex pool and retain it through avatar changes and replay", () => {
  const engine = createEngine(world), pools = world.character!.identity!.namePools;
  const names = { male: new Set<string>(), female: new Set<string>() };
  for (let seed = 0; seed < 256; seed++) {
    const birth = engine.start(`split-name-birth-${seed}`), character = birth.character!, sex = character.sex!;
    assert.ok(pools[sex].includes(character.name!));
    assert.equal(pools[sex === "male" ? "female" : "male"].includes(character.name!), false);
    names[sex].add(character.name!);
    const next = engine.chooseAvatar(birth, (character.avatarVariant! + 1) % 3);
    assert.equal(next.character!.name, character.name);
    assert.equal(next.character!.sex, sex);
    assert.equal(next.rngState, birth.rngState);
    assert.deepEqual(engine.load(engine.save(next)), next);
  }
  assert.ok(names.male.size >= 24); assert.ok(names.female.size >= 24);
});

function encounterWorld(): WorldPack {
  const copy = structuredClone(world);
  // This naming fixture exercises ordinary encounters for every sampled natal origin.
  if (copy.royalty) copy.royalty.originId = "fixture-unselected-royal-origin";
  if (copy.aristocracy) copy.aristocracy.originId = "fixture-unselected-estate-origin";
  withoutMarketSignals(copy);
  const required = new Set([copy.health!.careDecision, ...Object.values(copy.economy!.moneylender!.events), "meet-person-harbor", "meet-person-market"]);
  copy.events = copy.events.filter(event => required.has(event.id));
  for (const [id, at] of [["meet-person-harbor", 18], ["meet-person-market", 19]] as const) {
    const event = copy.events.find(item => item.id === id)!;
    event.trigger = { type: "age", at }; delete event.when;
  }
  delete copy.eventPacing; delete copy.character!.encounterPacing; delete copy.health!.mortalityCalibration;
  copy.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  copy.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  copy.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  copy.yearlyEffects = []; copy.yearlyRules = [];
  copy.character!.activities.push({ id: "repeat-introduction", text: "Greet the same person again", category: "relationship", minAge: 18, usesYearlyActivity: false,
    outcomes: [{ id: "repeat-introduction-done", text: "You exchange greetings.", weight: 1, effects: [{ type: "introduce", partner: "person-harbor" }] }],
  });
  return copy;
}

function advanceTo(engine: LifeEngine, initial: LifeState, age: number) {
  let life = initial;
  while (life.age < age) { assert.equal(life.phase, "ready"); life = engine.advance(life); }
  return life;
}

test("accepted encounters use the person's recorded sex pool without reusing the player's or another person's name", () => {
  const engine = createEngine(encounterWorld()), pools = engine.world.character!.identity!.namePools;
  const sexes = new Set<string>();
  for (let seed = 0; seed < 32; seed++) {
    let life = advanceTo(engine, engine.start(`split-name-meeting-${seed}`), 18);
    assert.deepEqual(life.character!.people, {});
    life = engine.choose(life, "introduce-person-harbor");
    const first = resolvePartner(engine.world, life, "person-harbor")!;
    assert.ok("sex" in first);
    assert.ok(pools[first.sex].includes(first.name));
    sexes.add(first.sex);
    assert.notEqual(first.name, life.character!.name);
    const before = structuredClone(life);
    engine.getActivities(life); engine.getChoices(life); personText("Meet {person:person-harbor}.", engine.world, life);
    assert.deepEqual(life, before, "views do not generate or reroll names");
    const greeted = engine.act(life, "repeat-introduction");
    assert.equal(greeted.rngState, life.rngState);
    assert.deepEqual(greeted.character!.people![first.id], first);
    life = advanceTo(engine, greeted, 19);
    life = engine.choose(life, "introduce-person-market");
    const second = life.character!.people!["person-market"];
    assert.ok(pools[second.sex].includes(second.name));
    assert.notEqual(second.name, first.name); assert.notEqual(second.name, life.character!.name);
    assert.deepEqual(engine.load(engine.save(life)), life);
    assert.deepEqual(life.character!.people![first.id], first);
  }
  assert.deepEqual([...sexes].sort(), ["female", "male"]);
});

test("the explicit-name-pool release retains its exact content identity and current saved names remain stable", () => {
  assert.equal(contentFingerprint(retained), "fnv1a64-083e29e83c70fe61");
  const previous = createEngine(retained), oldBirth = previous.start("gender-name-retained-0-31");
  assert.deepEqual(previous.load(previous.save(oldBirth)), oldBirth);
  const engine = createEngine(world), born = engine.start("gender-name-retained");
  assert.deepEqual(engine.load(engine.save(born)), born);
});
