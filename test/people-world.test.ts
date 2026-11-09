import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import peopleRelease from "../worlds/alexandria-0.7.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.6.1.json" with { type: "json" };

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  life = settle(engine, life);
  while (life.phase !== "ended" && life.age < target) life = settle(engine, engine.advance(life));
  return life;
}

test("Alexandria draws varied player names while leaving newborn relationships unknown", () => {
  const engine = createEngine(pack);
  const names = new Set<string>();
  assert.equal(pack.character.requireIntroductions, true);
  for (let index = 0; index < 128; index++) {
    const life = engine.start(`alexandria-name-pool-${index}`);
    const name = life.character!.name!;
    assert.ok(pack.character.playerNames.includes(name));
    assert.deepEqual(life.character!.knownPartnerIds, []);
    assert.equal(life.character!.partnerId, null);
    assert.equal(life.character!.relationshipStatus, "single");
    assert.equal(engine.getActivities(life).some(activity => /^(court|marry|time-with)-/.test(activity.id)), false);
    assert.deepEqual(engine.load(engine.save(life)), life);
    names.add(name);
  }
  assert.ok(names.size >= 24, "Repeated births should draw broadly from the current authored name pool.");
});

test("recorded introductions reveal adults one at a time without creating a courtship", () => {
  const copy = structuredClone(pack) as WorldPack;
  copy.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  const engine = createEngine(copy);
  let life = ageTo(engine, engine.start("alexandria-recorded-introductions"), 17);
  assert.deepEqual(life.character!.knownPartnerIds, []);
  assert.throws(() => engine.act(life, "court-demetria"), /unavailable/);
  for (const [age, partner] of [[18, "demetria"], [21, "thais"], [24, "berenike"], [26, "tyche"]] as const) {
    life = ageTo(engine, life, age);
    assert.ok(life.character!.knownPartnerIds!.includes(partner));
    const person = pack.character.partners.find(candidate => candidate.id === partner)!;
    assert.ok(life.age + person.ageOffset >= 18);
    assert.equal(life.character!.partnerId, null);
    assert.equal(life.character!.relationshipStatus, "single");
    const entry = life.journal.find(entry => entry.type === "event" && entry.id === `meet-${partner}`);
    assert.ok(entry?.text.includes(person.name));
    assert.equal(life.eventCounts[`meet-${partner}`], 1);
  }
  assert.deepEqual(life.character!.knownPartnerIds, ["demetria", "thais", "berenike", "tyche"]);
  const later = ageTo(engine, life, 32);
  for (const person of pack.character.partners) assert.equal(later.eventCounts[`meet-${person.id}`], 1);
  assert.deepEqual(engine.load(engine.save(later)), later);
});

test("meeting scenes are fictional community encounters and retain the prior mortality curve", () => {
  const meetings = pack.events.filter(event => event.id.startsWith("meet-"));
  assert.equal(meetings.length, 4);
  assert.ok(meetings.every(event => event.mode === "automatic" && event.choices.length === 0 && event.evidence === "fictional" && event.sourceIds.length === 0));
  assert.deepEqual(pack.mortality.bands, previous.mortality.bands);
  assert.deepEqual({ ...pack.stats, wealth: { ...pack.stats.wealth, label: previous.stats.wealth.label } }, previous.stats);
  assert.deepEqual(peopleRelease.origins, previous.origins, "The original pooled-people release keeps its prior backgrounds.");
});
