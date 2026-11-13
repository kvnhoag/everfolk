import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine, yearAtAge } from "../src/index.ts";
import type { LifeState } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { getBirthRollStats } from "../client/models/birth-stat-roll.ts";
import { hasBirthStatsBeenRevealed, hasLifeBegun } from "../client/queries/lives.ts";
import { persistBirthPresentation, persistBirthStatsReveal } from "../client/mutations/lives.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: CharacterPanel } = await import("../client/components/CharacterPanel.tsx");
const { default: HouseholdSummary } = await import("../client/components/HouseholdSummary.tsx");
const { default: BirthPortraitPreview } = await import("../client/components/BirthPortraitPreview.tsx");
hooks.deregister();
const engine = createEngine(pack);

// Rendering fixtures isolate views from the engine lifecycle, which has its own
// normal-command introduction, dating, marriage, child and replay regressions.
function metLife(): LifeState {
  const life = structuredClone(engine.start("people-ui"));
  life.age = 24; life.year = yearAtAge(pack.startYear, 24); life.phase = "ready"; life.pendingEventId = null;
  const slot = pack.character.partners[0];
  life.character!.people![slot.id] = { ...slot, name: "Kleopatra", sex: "female", metAge: 20, originId: "merchant-household", avatarVariant: 2 };
  life.character!.knownPartnerIds = [slot.id];
  life.character!.relationships!.partners[slot.id] = { closeness: 50, lastContactAge: 24 };
  return life;
}

test("neither a future catalog nor a met acquaintance appears in Relationships before dating", () => {
  for (const life of [engine.start("people-ui-birth"), metLife()]) {
    const before = structuredClone(life);
    const html = renderToStaticMarkup(createElement(CharacterPanel, { life, world: engine.world, initialSection: "relationships", onActivity() {} }));
    assert.match(html, /role="tab"[^>]*>Relationships</);
    assert.match(html, /No social relationships recorded yet/);
    const socialPanel = html.split(/id="[^"]+-panel-relationships"/)[1]?.split(/id="[^"]+-panel-children"/)[0];
    assert.ok(socialPanel);
    assert.doesNotMatch(socialPanel, /Kleopatra|class="relationship-tags"|aria-label="Relationship with /);
    assert.deepEqual(life, before);
  }
});

test("dating reveals the generated person with a matching portrait and household name", () => {
  const life = metLife(), id = pack.character.partners[0].id;
  life.character!.datedPartnerIds = [id];
  life.character!.partnerId = id; life.character!.relationshipStatus = "courting";
  const html = renderToStaticMarkup(createElement(CharacterPanel, { life, world: engine.world, initialSection: "relationships", onActivity() {} }));
  assert.match(html, />Relationships<\/button>/);
  assert.match(html, /Love interest: Kleopatra/);
  assert.match(html, /portraits\/ordinary-v3\/ef-p-f03-adult-maritime-v3.png/);
  assert.doesNotMatch(html, /\{person:|<h4>A harbor acquaintance<\/h4>/);
  const household = renderToStaticMarkup(createElement(HouseholdSummary, { life, world: engine.world, onOpenCharacter() {} }));
  assert.match(household, /Kleopatra/);
});

test("former dated people remain in history without exposing undated acquaintances", () => {
  const life = metLife(), id = pack.character.partners[0].id;
  life.character!.datedPartnerIds = [id];
  const html = renderToStaticMarkup(createElement(CharacterPanel, { life, world: engine.world, initialSection: "relationships", onActivity() {} }));
  assert.match(html, /<h4>Kleopatra<\/h4>/);
  assert.match(html, /Former partner/);
  assert.equal((html.match(/character-person-avatar/g) ?? []).length, 1);
});

test("birth shows the randomly assigned face through all six stages with no portrait controls", () => {
  for (const sex of ["male", "female"] as const) {
    const life = structuredClone(engine.start(`avatar-ui-${sex}`));
    life.character!.sex = sex; life.character!.avatarVariant = 1;
    const before = structuredClone(life);
    const html = renderToStaticMarkup(createElement(BirthPortraitPreview, { life, world: engine.world }));
    assert.doesNotMatch(html, /<button|aria-pressed=|Portrait choices|Choose your portrait/);
    assert.equal((html.match(/<img\b/g) ?? []).length, 7);
    for (const stage of ["infant", "child", "youth", "adult", "middle", "elder"]) assert.ok(html.includes(`ef-p-${sex === "female" ? "f" : "m"}02-${stage}-`));
    assert.match(html, new RegExp(sex === "female" ? "Born a girl" : "Born a boy"));
    assert.deepEqual(life, before);
  }
});

test("an avatar command preserves the unrevealed birth and its exact starting ranges", () => {
  const birth = engine.start("avatar-presentation");
  const selected = engine.chooseAvatar(birth, (birth.character!.avatarVariant! + 1) % 3);
  const rows = new Map<string, string>();
  const storage = { getItem(key: string) { return rows.get(key) ?? null; }, setItem(key: string, value: string) { rows.set(key, value); }, removeItem(key: string) { rows.delete(key); } };
  assert.equal(selected.commands.length, 1);
  assert.equal(hasLifeBegun(storage, selected), false);
  assert.equal(hasBirthStatsBeenRevealed(storage, selected), false);
  assert.deepEqual(getBirthRollStats(engine.world, selected), getBirthRollStats(engine.world, birth));
  assert.equal(selected.rngState, birth.rngState);
  persistBirthStatsReveal(storage, selected, true);
  assert.equal(hasBirthStatsBeenRevealed(storage, selected), true);
  assert.equal(hasLifeBegun(storage, selected), false);
  persistBirthPresentation(storage, selected, true);
  assert.equal(hasLifeBegun(storage, selected), true);
  assert.deepEqual(engine.load(engine.save(selected)), selected);
});
