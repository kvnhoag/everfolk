import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, yearAtAge } from "../src/index.ts";
import type { LifeState, Outcome, WorldPack } from "../src/types.ts";
import previous from "../worlds/alexandria-0.14.0.json" with { type: "json" };
import {
  addChildRelationship, advanceRelationships, applyCloseness, initialRelationships,
  introduceRelationship, marriageRelationshipReason, relationshipCloseness,
  relationshipOutcomeWeight, relationshipSupport,
} from "../src/relationships.ts";

const oldEngine = createEngine(previous);
function fixture(): { world: WorldPack; life: LifeState } {
  const world = structuredClone(oldEngine.world);
  world.relationships = {
    description: "Authored closeness, contact and household support.", initialCloseness: 40,
    childCloseness: 75, decayAfterYears: 2, yearlyDecay: 5, marriageMinimum: 55,
    supportThreshold: 65, maxHealthSupport: 0.8,
  };
  const life = structuredClone(oldEngine.start("individual-relationships"));
  life.age = 20;
  life.year = yearAtAge(world.startYear, life.age);
  life.character!.knownPartnerIds = [];
  life.character!.relationships = initialRelationships(world);
  return { world, life };
}
function introduce(world: WorldPack, life: LifeState, partner = "demetria"): void {
  life.character!.knownPartnerIds!.push(partner);
  introduceRelationship(world, life, partner);
}
function child(world: WorldPack, life: LifeState, id: string, age: number): void {
  life.character!.children.push({ id, name: id === "child-1" ? "Alexion" : "Dion", birthAge: life.age - age, otherParentId: "demetria" });
  addChildRelationship(world, life, id);
}
function atAge(world: WorldPack, life: LifeState, age: number): void {
  life.age = age;
  life.year = yearAtAge(world.startYear, age);
}

test("relationship state appears only for introduced people and actual born children", () => {
  const { world, life } = fixture();
  assert.deepEqual(life.character!.relationships, { partners: {}, children: {} });
  introduceRelationship(world, life, "demetria");
  addChildRelationship(world, life, "child-1");
  assert.deepEqual(life.character!.relationships, { partners: {}, children: {} });
  introduce(world, life);
  assert.deepEqual(life.character!.relationships!.partners.demetria, { closeness: 40, lastContactAge: 20 });
  applyCloseness(world, life, { type: "closeness", target: "partner", partner: "thais", delta: 20 });
  assert.equal(life.character!.relationships!.partners.thais, undefined);
  child(world, life, "child-1", 0);
  assert.deepEqual(life.character!.relationships!.children["child-1"], { closeness: 75, lastContactAge: 20 });
  life.character!.knownPartnerIds!.push("unknown");
  introduceRelationship(world, life, "unknown");
  assert.equal(life.character!.relationships!.partners.unknown, undefined);
});

test("contact adjusts separate ties, clamps scores, and preserves people after separation", () => {
  const { world, life } = fixture();
  introduce(world, life);
  introduce(world, life, "thais");
  life.character!.partnerId = "demetria";
  life.character!.relationshipStatus = "married";
  applyCloseness(world, life, { type: "closeness", target: "partner", delta: 90 });
  assert.equal(relationshipCloseness(world, life), 100);
  assert.equal(relationshipCloseness(world, life, "thais"), 40);
  atAge(world, life, 21);
  applyCloseness(world, life, { type: "closeness", target: "partner", delta: -200 });
  assert.deepEqual(life.character!.relationships!.partners.demetria, { closeness: 0, lastContactAge: 21 });
  life.character!.partnerId = null;
  life.character!.relationshipStatus = "divorced";
  applyCloseness(world, life, { type: "closeness", target: "partner", partner: "demetria", delta: 10 });
  assert.equal(relationshipCloseness(world, life, "demetria"), 10);
  assert.equal(relationshipCloseness(world, life), 0);
  introduceRelationship(world, life, "demetria");
  assert.equal(relationshipCloseness(world, life, "demetria"), 10, "Meeting again must not reset a tie.");
});

test("neglect follows the contact grace period and warns without silently ending a relationship", () => {
  const { world, life } = fixture();
  introduce(world, life);
  life.character!.partnerId = "demetria";
  life.character!.relationshipStatus = "married";
  applyCloseness(world, life, { type: "closeness", target: "partner", delta: 28 });
  const events: string[] = [];
  atAge(world, life, 22);
  advanceRelationships(world, life, (_id, text) => events.push(text));
  assert.equal(relationshipCloseness(world, life), 68);
  atAge(world, life, 23);
  advanceRelationships(world, life, (_id, text) => events.push(text));
  assert.equal(relationshipCloseness(world, life), 63);
  assert.equal(events.length, 1);
  assert.match(events[0], /Demetria/);
  assert.equal(life.character!.relationshipStatus, "married");
  assert.equal(life.character!.partnerId, "demetria");
  assert.equal(life.character!.relationships!.partners.demetria.lastContactAge, 20);
  applyCloseness(world, life, { type: "closeness", target: "partner", delta: 10 });
  atAge(world, life, 24);
  advanceRelationships(world, life, () => {});
  assert.equal(relationshipCloseness(world, life), 73, "Repairing contact starts a fresh grace period.");
});

test("children keep individual closeness, and only an old enough close household member provides support", () => {
  const { world, life } = fixture();
  child(world, life, "child-1", 11);
  assert.equal(relationshipSupport(world, life), 0, "A young child is not the player's caregiver.");
  atAge(world, life, 21);
  assert.equal(relationshipSupport(world, life), 0.8);
  life.character!.relationships!.children["child-1"].closeness = 20;
  assert.equal(relationshipSupport(world, life), 0);
  child(world, life, "child-2", 12);
  assert.equal(relationshipSupport(world, life), 0.8);
  applyCloseness(world, life, { type: "closeness", target: "children", delta: 10 });
  assert.equal(life.character!.relationships!.children["child-1"].closeness, 30);
  assert.equal(life.character!.relationships!.children["child-2"].closeness, 85);
  introduce(world, life);
  life.character!.partnerId = "demetria";
  life.character!.relationshipStatus = "married";
  applyCloseness(world, life, { type: "closeness", target: "partner", delta: 30 });
  assert.equal(relationshipSupport(world, life), 0.8, "Several relatives do not stack unlimited recovery support.");
});

test("courtship quality changes acceptance weight while refusal and unrelated risks retain authored weights", () => {
  const { world, life } = fixture();
  introduce(world, life);
  const accept: Outcome = { id: "accept", text: "They agree.", weight: 3, effects: [{ type: "relationship", partner: "demetria", status: "courting" }] };
  const decline: Outcome = { id: "decline", text: "They decline.", weight: 1, effects: [] };
  assert.equal(relationshipOutcomeWeight(world, life, accept), 3);
  applyCloseness(world, life, { type: "closeness", target: "partner", partner: "demetria", delta: -40 });
  const low = relationshipOutcomeWeight(world, life, accept);
  assert.ok(low > 0 && low < 3);
  applyCloseness(world, life, { type: "closeness", target: "partner", partner: "demetria", delta: 100 });
  assert.equal(relationshipOutcomeWeight(world, life, accept), 6);
  assert.equal(relationshipOutcomeWeight(world, life, decline), 1);
  assert.equal(relationshipOutcomeWeight(world, life, { ...accept, weight: 0 }), 0);
  assert.equal(relationshipOutcomeWeight(world, life, { ...accept, effects: [{ type: "job", job: "officer" }] }), 3);
  assert.equal(relationshipOutcomeWeight(world, life, { ...accept, effects: [...accept.effects, { type: "end", ending: "death-in-adulthood", deathCause: "cargo-crush" }] }), 3);
});

test("marriage requires its own partner closeness and support is lost on separation", () => {
  const { world, life } = fixture();
  introduce(world, life);
  introduce(world, life, "thais");
  applyCloseness(world, life, { type: "closeness", target: "partner", partner: "thais", delta: 60 });
  assert.match(marriageRelationshipReason(world, life, "demetria")!, /closeness 55.*Demetria/);
  assert.equal(marriageRelationshipReason(world, life, "thais"), undefined);
  life.character!.partnerId = "thais";
  life.character!.relationshipStatus = "married";
  assert.equal(relationshipSupport(world, life), 0.8);
  life.character!.partnerId = null;
  life.character!.relationshipStatus = "divorced";
  assert.equal(relationshipSupport(world, life), 0);
  assert.equal(relationshipCloseness(world, life, "thais"), 100);
});

test("disabled relationship rules are exact no-ops for legacy states and weights", () => {
  const life = structuredClone(oldEngine.start("legacy-relationship-noop"));
  const before = structuredClone(life);
  assert.equal(initialRelationships(oldEngine.world), undefined);
  introduceRelationship(oldEngine.world, life, "demetria");
  addChildRelationship(oldEngine.world, life, "child-1");
  applyCloseness(oldEngine.world, life, { type: "closeness", target: "partner", partner: "demetria", delta: 10 });
  advanceRelationships(oldEngine.world, life, () => assert.fail("Legacy worlds must not gain new journal entries."));
  assert.equal(relationshipSupport(oldEngine.world, life), 0);
  assert.equal(marriageRelationshipReason(oldEngine.world, life, "demetria"), undefined);
  const outcome: Outcome = { id: "old-courtship", text: "Accepted.", weight: 3, effects: [{ type: "relationship", partner: "demetria", status: "courting" }] };
  assert.equal(relationshipOutcomeWeight(oldEngine.world, life, outcome), 3);
  assert.deepEqual(life, before);
});
