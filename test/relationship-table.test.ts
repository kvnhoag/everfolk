import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import { familyRelationshipRows, socialRelationshipRows } from "../client/models/relationship-table.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { getArchivedBuiltinWorld } from "../server/content.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.41.0.json" with { type: "json" };

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
const engine = createEngine(pack);

function socialFixture() {
  const life = structuredClone(engine.start("relationship-table"));
  life.age = 24; life.phase = "ready"; life.pendingEventId = null;
  const templates = engine.world.character!.partners.slice(0, 5);
  for (const [index, template] of templates.entries()) {
    life.character!.people![template.id] = { ...template, name: `Recorded person ${index}`, sex: "female", metAge: 20, originId: "clerk-household", avatarVariant: 0 };
    life.character!.relationships!.partners[template.id] = { closeness: 60, lastContactAge: 23 };
  }
  life.character!.knownPartnerIds = templates.map(person => person.id);
  return { life, ids: templates.map(person => person.id) };
}

test("family rows record both parent lines and their work from birth without revealing future death ages", () => {
  const life = engine.start("family-table-birth");
  const before = structuredClone(life);
  const rows = familyRelationshipRows(engine.world, life);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(row => row.roles[0]), ["Mother", "Father", "Maternal grandmother", "Maternal grandfather", "Paternal grandmother", "Paternal grandfather"]);
  for (const row of rows) {
    assert.ok(row.background); assert.ok(row.backgroundDetail); assert.ok(row.occupation);
    const record = life.character!.family!.find(member => member.id === row.id)!;
    assert.equal(row.deceased, life.age + record.ageOffset >= record.deathAge);
    if (!row.deceased) assert.equal(row.age, `Age ${record.ageOffset}`);
    assert.equal(row.tie, undefined, "No unsupported family closeness is invented.");
  }
  assert.deepEqual(life, before);
});

test("family table follows marriage, separation and child ages without guessing adult children's jobs", () => {
  const { life, ids } = socialFixture();
  life.character!.partnerId = ids[0]; life.character!.datedPartnerIds = [ids[0]];
  life.character!.relationshipStatus = "courting";
  assert.equal(familyRelationshipRows(engine.world, life).some(row => row.id === ids[0]), false);
  life.character!.relationshipStatus = "married";
  life.character!.children = [{ id: "child-1", name: "Child One", birthAge: life.age, otherParentId: ids[0] }, { id: "child-2", name: "Child Two", birthAge: 5, otherParentId: ids[0] }];
  let rows = familyRelationshipRows(engine.world, life);
  assert.deepEqual(rows.find(row => row.id === ids[0])!.roles, ["Wife"]);
  assert.equal(rows.find(row => row.id === "child-1")!.age, "Newborn");
  assert.equal(rows.find(row => row.id === "child-1")!.occupation, "No occupation yet");
  assert.equal(rows.find(row => row.id === "child-2")!.occupation, "Not recorded");
  life.character!.partnerId = null; life.character!.relationshipStatus = "divorced";
  rows = familyRelationshipRows(engine.world, life);
  assert.equal(rows.some(row => row.id === ids[0]), false);
  assert.match(rows.find(row => row.id === "child-1")!.backgroundDetail!, /Recorded person 0/);
});

test("social rows distinguish every earned role, keep overlapping roles and omit plain or future acquaintances", () => {
  const { life, ids } = socialFixture();
  life.character!.relationships!.partners[ids[0]].roles = ["friend", "business-partner"];
  life.character!.relationships!.partners[ids[1]].roles = ["teacher"];
  life.character!.relationships!.partners[ids[2]].roles = ["disciple"];
  life.character!.relationships!.partners[ids[3]].roles = ["enemy"];
  const before = structuredClone(life);
  let rows = socialRelationshipRows(engine.world, life);
  assert.deepEqual(rows.map(row => row.roles), [["Friend", "Business partner"], ["Teacher"], ["Disciple"], ["Enemy"]]);
  assert.ok(rows.every(row => row.background === "A clerk's household"));
  assert.ok(rows.every(row => row.occupation && row.tie?.lastContactAge === 23));
  assert.deepEqual(life, before);
  life.character!.people![ids[1]].metAge = life.age + 1;
  rows = socialRelationshipRows(engine.world, life);
  assert.equal(rows.some(row => row.id === ids[1] || row.id === ids[4]), false);
});

test("rendered family and social panels expose native tables and an empty social view at birth", () => {
  const life = engine.start("family-table-render");
  const before = structuredClone(life);
  const html = renderToStaticMarkup(createElement(CharacterPanel, { world: engine.world, life, initialSection: "children", onActivity() { throw new Error("Rendering cannot accept actions."); } }));
  assert.match(html, /<caption>Current family<\/caption>/);
  for (const label of ["Person", "Relationship", "Background", "Occupation", "Bond"]) assert.ok(html.includes(`<th scope="col">${label}</th>`));
  for (const member of life.character!.family!) assert.ok(html.includes(member.name));
  assert.match(html, /No social relationships recorded yet/);
  assert.match(html, /role="tab"[^>]*>Relationships<\/button>/);
  const household = renderToStaticMarkup(createElement(HouseholdSummary, { world: engine.world, life, onOpenCharacter() {} }));
  for (const member of life.character!.family!.slice(0, 2)) assert.ok(household.includes(member.name) && household.includes(member.occupation.replaceAll("'", "&#x27;")));
  assert.deepEqual(life, before);
});

test("deceased relatives move into a remembered record with their final age", () => {
  const life = structuredClone(engine.start("remembered-family-table"));
  life.age = 90;
  const rows = familyRelationshipRows(engine.world, life);
  assert.ok(rows.every(row => row.deceased && row.age.startsWith("Deceased · age ")));
  const html = renderToStaticMarkup(createElement(CharacterPanel, { world: engine.world, life, initialSection: "children", onActivity() {} }));
  assert.match(html, /Remembered family · 6/);
  assert.match(html, /<caption>Remembered family<\/caption>/);
  assert.match(html, /No living family members recorded/);
});

test("the earlier 0.41 market-capacity life remains registered and replays without fabricated relatives", () => {
  const oldEngine = createEngine(retained);
  const life = oldEngine.start("retained-before-family-tables");
  assert.equal(life.character!.family, undefined);
  assert.deepEqual(familyRelationshipRows(oldEngine.world, life), []);
  assert.equal(engineForLife(life).fingerprint, oldEngine.fingerprint);
  assert.deepEqual(loadAnyLife(oldEngine.save(life)), life);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${oldEngine.fingerprint}`)!.pack, retained);
});
