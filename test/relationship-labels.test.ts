import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine, yearAtAge } from "../src/index.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.28.0.json" with { type: "json" };
import { relationshipLabels, romanticPartnerLabel, visibleRelationshipPeople } from "../client/models/relationship-labels.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: CharacterPanel } = await import("../client/components/CharacterPanel.tsx");
const { default: HouseholdSummary } = await import("../client/components/HouseholdSummary.tsx");
hooks.deregister();

function socialFixture() {
  const engine = createEngine(pack);
  const world = structuredClone(engine.world);
  const life = structuredClone(engine.start("social-view"));
  world.character!.socialRelationships = true;
  life.age = 24; life.year = yearAtAge(world.startYear, life.age); life.phase = "ready"; life.pendingEventId = null;
  const ids = world.character!.partners.slice(0, 3).map(person => person.id);
  for (const [index, id] of ids.entries()) {
    const template = world.character!.partners.find(person => person.id === id)!;
    life.character!.people![id] = { ...template, name: ["Kleopatra", "Petosiris", "Eirene"][index], sex: index === 1 ? "male" : "female", avatarVariant: index, originId: life.originId, metAge: 20 };
    life.character!.relationships!.partners[id] = { closeness: 50, lastContactAge: 24 };
  }
  life.character!.knownPartnerIds = [...ids];
  return { world, life, ids };
}

test("only established friends, business partners and dated people become visible", () => {
  const { world, life, ids } = socialFixture();
  assert.deepEqual(visibleRelationshipPeople(world, life), []);
  life.character!.relationships!.partners[ids[0]].roles = ["friend"];
  life.character!.relationships!.partners[ids[1]].roles = ["business-partner"];
  assert.deepEqual(visibleRelationshipPeople(world, life).map(person => person.id), ids.slice(0, 2));
  assert.deepEqual(relationshipLabels(world, life, ids[0]), ["Friend"]);
  assert.deepEqual(relationshipLabels(world, life, ids[1]), ["Business partner"]);
  assert.deepEqual(relationshipLabels(world, life, ids[2]), []);
  life.character!.datedPartnerIds = [ids[2]];
  assert.deepEqual(visibleRelationshipPeople(world, life).map(person => person.id), ids);
});

test("love interest becomes wife or husband from the actual partner's sex", () => {
  const { world, life, ids } = socialFixture();
  for (const [id, expected] of [[ids[0], "Wife"], [ids[1], "Husband"]]) {
    life.character!.partnerId = id; life.character!.relationshipStatus = "courting";
    assert.equal(romanticPartnerLabel(world, life), "Love interest");
    assert.deepEqual(relationshipLabels(world, life, id), ["Love interest"]);
    life.character!.relationshipStatus = "married";
    assert.equal(romanticPartnerLabel(world, life), expected);
    assert.deepEqual(relationshipLabels(world, life, id), [expected]);
  }
  assert.equal(romanticPartnerLabel(world, life, ids[0]), undefined, "A different dated person must not inherit the current spouse status.");
});

test("independent social roles coexist with romance and ending one keeps the others", () => {
  const { world, life, ids } = socialFixture(), id = ids[0];
  life.character!.datedPartnerIds = [id];
  life.character!.partnerId = id; life.character!.relationshipStatus = "courting";
  const tie = life.character!.relationships!.partners[id];
  tie.roles = ["business-partner", "friend"];
  assert.deepEqual(relationshipLabels(world, life, id), ["Love interest", "Friend", "Business partner"]);
  tie.roles = ["friend"];
  assert.deepEqual(relationshipLabels(world, life, id), ["Love interest", "Friend"]);
  life.character!.partnerId = null; life.character!.relationshipStatus = "single";
  assert.deepEqual(relationshipLabels(world, life, id), ["Former partner", "Friend"]);
  assert.deepEqual(visibleRelationshipPeople(world, life).map(person => person.id), [id]);
  tie.roles = [];
  assert.deepEqual(relationshipLabels(world, life, id), ["Former partner"]);
});

test("unmet or future-dated identities cannot leak roles, names or a spouse label", () => {
  const { world, life, ids } = socialFixture(), id = ids[0];
  life.character!.datedPartnerIds = [id];
  life.character!.relationships!.partners[id].roles = ["friend", "business-partner"];
  life.character!.partnerId = id; life.character!.relationshipStatus = "married";
  life.character!.knownPartnerIds = [];
  assert.deepEqual(visibleRelationshipPeople(world, life), []);
  assert.deepEqual(relationshipLabels(world, life, id), []);
  assert.equal(romanticPartnerLabel(world, life), undefined);
  life.character!.knownPartnerIds = [...ids];
  life.character!.people![id].metAge = life.age + 1;
  assert.deepEqual(visibleRelationshipPeople(world, life), []);
  assert.deepEqual(relationshipLabels(world, life, id), []);
});

test("retained procedural releases ignore later social roles while keeping dated history", () => {
  const { world, life, ids } = socialFixture();
  delete world.character!.socialRelationships;
  life.character!.relationships!.partners[ids[0]].roles = ["friend"];
  life.character!.datedPartnerIds = [ids[1]];
  assert.deepEqual(visibleRelationshipPeople(world, life).map(person => person.id), [ids[1]]);
  assert.deepEqual(relationshipLabels(world, life, ids[0]), []);
  assert.deepEqual(relationshipLabels(world, life, ids[1]), ["Former partner"]);
});

test("old named worlds keep introduction rules and use spouse when sex was never recorded", () => {
  const engine = createEngine(retained), world = structuredClone(engine.world), life = structuredClone(engine.start("old-labels"));
  const id = world.character!.partners[0].id;
  life.character!.knownPartnerIds = [id];
  life.character!.partnerId = id; life.character!.relationshipStatus = "married";
  assert.deepEqual(visibleRelationshipPeople(world, life).map(person => person.id), [id]);
  assert.equal(romanticPartnerLabel(world, life), "Spouse");
  world.character!.requireIntroductions = false;
  assert.equal(visibleRelationshipPeople(world, life).length, world.character!.partners.length);
});

test("relationship projections preserve all state, world data and RNG", () => {
  const { world, life, ids } = socialFixture();
  life.character!.relationships!.partners[ids[0]].roles = ["friend", "business-partner"];
  const before = structuredClone({ world, life });
  for (let i = 0; i < 3; i++) {
    visibleRelationshipPeople(world, life);
    for (const id of ids) { relationshipLabels(world, life, id); romanticPartnerLabel(world, life, id); }
  }
  assert.deepEqual({ world, life }, before);
});

test("the actual relationship panel reveals a friend or business partner without inventing romantic history", () => {
  for (const [role, label, index] of [["friend", "Friend", 0], ["business-partner", "Business partner", 1]] as const) {
    const { world, life, ids } = socialFixture(), id = ids[index];
    life.character!.relationships!.partners[id].roles = [role];
    const before = structuredClone({ world, life });
    let acted = 0;
    const html = renderToStaticMarkup(createElement(CharacterPanel, { world, life, initialSection: "relationships", onActivity() { acted++; } }));
    assert.match(html, />Relationships<\/button>/);
    assert.match(html, /aria-label="Relationship groups"/);
    assert.ok(html.includes(`aria-label="Relationship with ${life.character!.people![id].name}"`));
    assert.ok(html.includes(`<span class="character-status-tag">${label}</span>`));
    assert.doesNotMatch(html, /Former partner|Love interest:|Wife:|Husband:/);
    assert.doesNotMatch(html, /Stop dating/);
    if (role === "friend") assert.doesNotMatch(html, /Complete a shared order with/);
    else assert.doesNotMatch(html, /Spend an afternoon with/);
    assert.equal((html.match(/class="relationship-tags"/g) ?? []).length, 1);
    assert.equal(acted, 0);
    assert.deepEqual({ world, life }, before);
  }
});

test("the actual relationship and household panels show wife or husband alongside independent social tags", () => {
  for (const [index, label, name] of [[0, "Wife", "Kleopatra"], [1, "Husband", "Petosiris"]] as const) {
    const { world, life, ids } = socialFixture(), id = ids[index];
    life.character!.partnerId = id; life.character!.relationshipStatus = "married";
    life.character!.datedPartnerIds = [id];
    life.character!.relationships!.partners[id].roles = ["friend", "business-partner"];
    const html = renderToStaticMarkup(createElement(CharacterPanel, { world, life, initialSection: "relationships", onActivity() {} }));
    assert.ok(html.includes(`<h3>${label}: ${name}</h3>`));
    for (const tag of [label, "Friend", "Business partner"]) assert.ok(html.includes(`<span class="character-status-tag">${tag}</span>`));
    assert.doesNotMatch(html, /Former partner/);
    const household = renderToStaticMarkup(createElement(HouseholdSummary, { world, life, onOpenCharacter() {} }));
    assert.ok(household.includes(`<span class="household-field-label">${label}</span><strong>${name}</strong>`));
    assert.doesNotMatch(household, /Courting|Spouse/);
  }
});

test("the actual panel keeps a plain acquaintance hidden and uses love interest for accepted dating", () => {
  const { world, life, ids } = socialFixture(), id = ids[0];
  const met = renderToStaticMarkup(createElement(CharacterPanel, { world, life, initialSection: "relationships", onActivity() {} }));
  assert.match(met, />Relationships<\/button>/);
  assert.match(met, /No social relationships recorded yet/);
  // A relative can share a fixture name; scope identity privacy to the social panel.
  const socialPanel = met.split(/id="[^"]+-panel-relationships"/)[1]?.split(/id="[^"]+-panel-children"/)[0];
  assert.ok(socialPanel);
  assert.doesNotMatch(socialPanel, /Kleopatra|Petosiris|Eirene|class="relationship-tags"|aria-label="Relationship with /);
  life.character!.partnerId = id; life.character!.relationshipStatus = "courting";
  life.character!.datedPartnerIds = [id];
  const dating = renderToStaticMarkup(createElement(CharacterPanel, { world, life, initialSection: "relationships", onActivity() {} }));
  assert.match(dating, /Love interest: Kleopatra/);
  assert.match(dating, /<span class="character-status-tag">Love interest<\/span>/);
  const household = renderToStaticMarkup(createElement(HouseholdSummary, { world, life, onOpenCharacter() {} }));
  assert.match(household, /<span class="household-field-label">Love interest<\/span><strong>Kleopatra<\/strong>/);
});
