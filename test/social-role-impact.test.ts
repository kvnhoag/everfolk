import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, Effect, LifeState } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { socialRoleImpact } from "../client/models/social-role-impact.ts";

const engine = createEngine(pack), person = pack.character.partners[0];
const role = (active: boolean): Effect => ({ type: "social-role", partner: person.id, role: "friend", active });
const option = (effects: Effect[]): Choice => ({ id: "view-role", text: "View", outcomes: [{ id: "role-result", text: "Result", weight: 1, effects }] });
function met(): LifeState {
  const life = structuredClone(engine.start("social-preview"));
  life.age = 24;
  life.character!.knownPartnerIds = [person.id];
  life.character!.people![person.id] = { ...person, name: "Isidora", sex: "female", originId: life.originId, avatarVariant: 0, metAge: 20 };
  life.character!.relationships!.partners[person.id] = { closeness: 50, lastContactAge: 24 };
  return life;
}

test("social previews name met people, disclose uncertain roles and never change the life or RNG", () => {
  const life = met(), before = structuredClone(life);
  assert.deepEqual(socialRoleImpact(option([role(true)]), life, engine.world), [{ text: "Friendship with Isidora", gain: true }]);
  const possible = option([role(true)]);
  possible.outcomes.push({ id: "decline", text: "Declined", weight: 1, effects: [] });
  assert.deepEqual(socialRoleImpact(possible, life, engine.world), [{ text: "Possible friendship with Isidora", gain: true }]);
  assert.deepEqual(life, before);
});

test("role projections respect effect order, endings and actual existing membership", () => {
  const life = met();
  assert.deepEqual(socialRoleImpact(option([role(true), role(false)]), life, engine.world), []);
  assert.deepEqual(socialRoleImpact(option([{ type: "end", ending: engine.world.defaultEnding }, role(true)]), life, engine.world), []);
  life.character!.relationships!.partners[person.id].roles = ["friend", "business-partner"];
  assert.deepEqual(socialRoleImpact(option([role(false)]), life, engine.world), [{ text: "End friendship with Isidora", gain: false }]);
  assert.deepEqual(life.character!.relationships!.partners[person.id].roles, ["friend", "business-partner"]);
});

test("unknown future names stay unknown and retained worlds do not invent social effects", () => {
  const life = engine.start("future-social-preview"), before = structuredClone(life);
  assert.deepEqual(socialRoleImpact(option([role(true)]), life, engine.world), [{ text: "Friendship with someone you meet", gain: true }]);
  const old = structuredClone(engine.world); delete old.character!.socialRelationships;
  assert.deepEqual(socialRoleImpact(option([role(true)]), life, old), []);
  assert.deepEqual(life, before);
});
