import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine, yearAtAge } from "../src/index.ts";
import type { LifeState } from "../src/types.ts";
import { familyRelationshipRows, socialRelationshipRows } from "../client/models/relationship-table.ts";
import { playerPortraitState, resolvePortraitState } from "../client/models/portrait-state.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.43.0.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: PixelPortrait } = await import("../client/components/PixelPortrait.tsx");
const { default: CharacterPanel } = await import("../client/components/CharacterPanel.tsx");
const { default: HouseholdSummary } = await import("../client/components/HouseholdSummary.tsx");
const { default: RelationshipTable } = await import("../client/components/RelationshipTable.tsx");
hooks.deregister();
const engine = createEngine(pack);

function images(html: string, name: string): string[] {
  return (html.match(/<img\b[^>]*>/g) ?? []).filter(tag => tag.includes(`alt="Pixel portrait of ${name}, `));
}

function attribute(tag: string, name: string): string {
  const value = new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1];
  assert.ok(value, `Missing ${name}: ${tag}`);
  return value;
}

// These read-only view fixtures deliberately do not write or save edited ages.
function householdFixture(): LifeState {
  const life = structuredClone(engine.start("portrait-ui-household"));
  life.originId = "merchant-household";
  life.age = 25; life.year = yearAtAge(pack.startYear, life.age); life.phase = "ready"; life.pendingEventId = null;
  const template = pack.character.partners[0];
  life.character!.people![template.id] = {
    ...template, name: "Recorded spouse", sex: "female", avatarVariant: 2,
    originId: "royal-household", metAge: 20,
  };
  life.character!.knownPartnerIds = [template.id];
  life.character!.datedPartnerIds = [template.id];
  life.character!.partnerId = template.id;
  life.character!.relationshipStatus = "married";
  life.character!.relationships!.partners[template.id] = { closeness: 70, lastContactAge: 24, roles: ["friend", "business-partner"] };
  life.character!.children = [{ id: "child-portrait-ui", name: "Recorded child", birthAge: 24, otherParentId: template.id }];
  return life;
}

test("the actual image component uses an explicit complete descriptor over loose scalar props", () => {
  const portrait = resolvePortraitState({ age: 16, sex: "female", avatarVariant: 1, role: "royalty", personKey: "recorded-subject" });
  const html = renderToStaticMarkup(createElement(PixelPortrait, { portrait, age: 70, sex: "male", avatarVariant: 0, name: "Chosen portrait" }));
  assert.match(html, /src="\/assets\/portraits\/concept1-v4\/youth-girl-f02\.png"/);
  assert.match(html, /data-portrait-set="concept1"/);
  assert.match(html, /width="384" height="480"/);
  assert.match(html, /data-portrait-key="f02:youth:royalty"/);
  assert.match(html, /data-portrait-identity="f02"/);
  assert.match(html, /Pixel portrait of Chosen portrait, a young person/);
  const v3Html = renderToStaticMarkup(createElement(PixelPortrait, { age: 16, sex: "female", avatarVariant: 1, role: "royalty", personKey: "recorded-subject", portraitSet: "ordinary-v3", name: "Chosen v3 portrait" }));
  assert.match(v3Html, /src="\/assets\/portraits\/ordinary-v3\/ef-p-f02-youth-royalty-v3\.png"/);
  assert.match(v3Html, /data-portrait-set="ordinary-v3"/);
});

test("assigned portraits keep their face through all six ages with role clothing from youth", () => {
  const expectedFiles = {
    male: {
      infant: "infant-c1.png",
      child: "child-boy-m01.png",
      youth: "elite-citizen-m02.png",
      adult: "elite-citizen-m02.png",
      middle: "elite-citizen-m02.png",
      elder: "elite-citizen-m02.png",
    },
    female: {
      infant: "infant-c1.png",
      child: "child-girl-f01.png",
      youth: "youth-girl-f02.png",
      adult: "merchant-woman-f03.png",
      middle: "merchant-woman-f03.png",
      elder: "elder-woman-f01.png",
    },
  } as const;
  for (const sex of ["male", "female"] as const) {
    const life = structuredClone(engine.start(`portrait-ui-role-picker-${sex}`));
    life.originId = pack.royalty.originId;
    life.character!.sex = sex; life.character!.avatarVariant = 1;
    const before = structuredClone(life);
    const html = [0, 7, 16, 28, 48, 70].map(age => renderToStaticMarkup(createElement(PixelPortrait, { portrait: playerPortraitState(engine.world, life, { age }), name: life.character!.name }))).join("");
    const identity = sex === "female" ? "f02" : "m02";
    assert.doesNotMatch(html, /<button|aria-pressed=|Portrait choices|Choose your portrait/);
    assert.equal((html.match(/<img\b/g) ?? []).length, 6);
    assert.ok((html.match(/<img\b[^>]*>/g) ?? []).every(tag => attribute(tag, "data-portrait-identity") === identity));
    for (const [stage, wardrobe] of [["infant", "infant"], ["child", "child"], ["youth", "royalty"], ["adult", "royalty"], ["middle", "royalty"], ["elder", "royalty"]] as const) {
      assert.ok(html.includes(`data-portrait-key="${identity}:${stage}:${wardrobe}"`), `${sex} ${stage} key`);
      assert.ok(html.includes(`/assets/portraits/concept1-v4/${expectedFiles[sex][stage]}`), `${sex} ${stage} concept1 file`);
    }
    assert.match(html, /an infant in a swaddle/);
    assert.deepEqual(life, before);
  }
});

test("portrait rendering preserves the seeded assignment without changing the life or save replay", () => {
  const assigned = new Set<string>();
  for (let index = 0; index < 12; index++) {
    const life = engine.start(`assigned-portrait-${index}`);
    const before = structuredClone(life), saved = engine.save(life);
    const identity = `${life.character!.sex === "female" ? "f" : "m"}${String(life.character!.avatarVariant! + 1).padStart(2, "0")}`;
    assigned.add(identity);
    const render = () => renderToStaticMarkup(createElement(PixelPortrait, { portrait: playerPortraitState(engine.world, life), name: life.character!.name }));
    const html = render();
    assert.equal(render(), html, "Rendering again cannot reroll the face.");
    const portraits = html.match(/<img\b[^>]*>/g) ?? [];
    assert.equal(portraits.length, 1);
    assert.ok(portraits.every(tag => attribute(tag, "data-portrait-identity") === identity));
    assert.doesNotMatch(html, /<button|aria-pressed=|Portrait choices/);
    assert.deepEqual(life, before);
    assert.equal(engine.save(life), saved);
    assert.deepEqual(engine.load(saved), life);
  }
  assert.ok(assigned.size > 1, "Different births use the engine's existing randomized assignments.");
});

test("spouse, friend and activity card portraits share the recorded NPC face and occupation", () => {
  const life = householdFixture();
  const before = structuredClone(life);
  const family = familyRelationshipRows(engine.world, life);
  const social = socialRelationshipRows(engine.world, life);
  const spouseFamily = family.find(row => row.name === "Recorded spouse")!;
  const spouseSocial = social.find(row => row.name === "Recorded spouse")!;
  assert.deepEqual(spouseFamily.portrait, spouseSocial.portrait);
  assert.equal(spouseSocial.portrait.wardrobeId, "maritime", "Random upbringing must not put a harbor worker in a royal robe.");
  const table = renderToStaticMarkup(createElement(RelationshipTable, { rows: social, world: engine.world, caption: "Known people", emptyText: "Nobody" }));
  const panel = renderToStaticMarkup(createElement(CharacterPanel, { life, world: engine.world, initialSection: "relationships", onActivity() { throw new Error("Rendering must not perform an activity."); } }));
  const household = renderToStaticMarkup(createElement(HouseholdSummary, { life, world: engine.world, onOpenCharacter() { throw new Error("Rendering must not open a panel."); } }));
  for (const html of [table, panel, household]) {
    const portraits = images(html, "Recorded spouse");
    assert.ok(portraits.length > 0);
    assert.ok(portraits.every(tag => attribute(tag, "src") === "/assets/portraits/concept1-v4/citizen-mother-f01.png"));
    assert.ok(portraits.every(tag => attribute(tag, "data-portrait-key") === "f03:adult:maritime"));
    assert.ok(portraits.every(tag => attribute(tag, "data-portrait-identity") === "f03"));
  }
  life.character!.relationships!.partners[pack.character.partners[0].id].roles = ["enemy"];
  assert.equal(socialRelationshipRows(engine.world, life).find(row => row.name === "Recorded spouse")!.portrait.identityKey, spouseSocial.portrait.identityKey);
  life.character!.relationships!.partners[pack.character.partners[0].id].roles = ["friend", "business-partner"];
  assert.deepEqual(life, before);
});

test("remembered relatives keep their terminal-age portrait in family tables and household thumbnails", () => {
  const life = householdFixture();
  life.age = 90;
  const mother = life.character!.family!.find(member => member.relation === "mother")!;
  mother.name = "Remembered mother"; mother.deathAge = 45;
  const before = structuredClone(life);
  const rows = familyRelationshipRows(engine.world, life);
  const row = rows.find(row => row.id === mother.id)!;
  assert.equal(row.age, "Deceased · age 45");
  assert.equal(row.portrait.age, 45);
  assert.equal(row.portrait.stage, "middle");
  const table = renderToStaticMarkup(createElement(RelationshipTable, { rows, world: engine.world, caption: "Family", emptyText: "Nobody" }));
  const household = renderToStaticMarkup(createElement(HouseholdSummary, { life, world: engine.world, onOpenCharacter() {} }));
  for (const html of [table, household]) {
    const tags = images(html, mother.name);
    assert.equal(tags.length, 1);
    assert.equal(attribute(tags[0], "src"), row.portrait.src);
    assert.match(tags[0], /in middle age/);
  }
  assert.deepEqual(life, before);
});

test("children without recorded appearance get the same cosmetic body across views without new saved fields", () => {
  const life = householdFixture();
  const child = life.character!.children[0];
  const before = structuredClone(life);
  const row = familyRelationshipRows(engine.world, life).find(row => row.id === child.id)!;
  assert.equal(row.portrait.identitySource, "presentation-fallback");
  const table = renderToStaticMarkup(createElement(RelationshipTable, { rows: [row], world: engine.world, caption: "Child", emptyText: "Nobody" }));
  const household = renderToStaticMarkup(createElement(HouseholdSummary, { life, world: engine.world, onOpenCharacter() {} }));
  for (const html of [table, household]) {
    const tags = images(html, child.name);
    assert.equal(tags.length, 1);
    assert.equal(attribute(tags[0], "src"), row.portrait.src);
    assert.match(tags[0], /an infant in a swaddle/);
  }
  const renamed = structuredClone(life);
  renamed.character!.children[0].name = "A different name";
  assert.equal(familyRelationshipRows(engine.world, renamed).find(row => row.id === child.id)!.portrait.identityKey, row.portrait.identityKey);
  assert.deepEqual(life, before);
  assert.equal("sex" in child, false);
  assert.equal("avatarVariant" in child, false);
});

test("retained saves render new body portraits without acquiring a newer world's royal status or changing replay", () => {
  const oldEngine = createEngine(retained);
  let life = oldEngine.start("portrait-ui-retained");
  for (let attempt = 1; life.originId !== "royal-household" && attempt < 10000; attempt++) life = oldEngine.start(`portrait-ui-retained-${attempt}`);
  assert.equal(life.originId, "royal-household");
  const before = structuredClone(life);
  const portrait = playerPortraitState(oldEngine.world, life, { age: 28 });
  assert.equal(portrait.wardrobeId, "everyday");
  const html = renderToStaticMarkup(createElement(PixelPortrait, { portrait, name: "Retained character" }));
  assert.match(html, /\/assets\/portraits\/concept1-v4\/citizen-(mother-f01|adult-m02)\.png/);
  assert.doesNotMatch(html, /elite-citizen-m02\.png|-royalty-v3\.png/);
  const legacyV3 = playerPortraitState(oldEngine.world, life, { age: 28, portraitSet: "ordinary-v3" });
  const legacyHtml = renderToStaticMarkup(createElement(PixelPortrait, { portrait: legacyV3, name: "Retained character" }));
  assert.match(legacyHtml, /\/assets\/portraits\/ordinary-v3\//);
  assert.doesNotMatch(legacyHtml, /-royalty-v3\.png/);
  assert.deepEqual(life, before);
  assert.deepEqual(oldEngine.load(oldEngine.save(life)), life);
});
