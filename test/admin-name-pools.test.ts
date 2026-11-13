import { withoutMarketSignals } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { applyNamePoolEdits } from "../client/models/admin/name-pools.ts";
import raw from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.28.0.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return next(url, context);
} });
const { default: PlayerNamesEditor } = await import("../client/components/admin/PlayerNamesEditor.tsx");
hooks.deregister();

const world = raw as WorldPack;
const edits = () => ({ male: world.character!.identity!.namePools.male.map(name => `Male ${name}`).join("\n"), female: world.character!.identity!.namePools.female.map(name => `Female ${name}`).join("\n") });

test("the guided identity editor validates separate trimmed pools while retaining other draft fields", () => {
  const before = structuredClone(world), input = edits();
  const character = applyNamePoolEdits(world, { male: `\n  ${input.male.split("\n").join("  \r\n  ")}  \n`, female: ` ${input.female}\n\n` });
  assert.deepEqual(character.identity!.namePools.male, input.male.split("\n"));
  assert.deepEqual(character.identity!.namePools.female, input.female.split("\n"));
  const { identity, ...other } = character, { identity: oldIdentity, ...oldOther } = world.character!;
  assert.deepEqual(other, oldOther); assert.equal(identity!.avatarVariants, oldIdentity!.avatarVariants);
  assert.deepEqual(world, before);
});

test("the guided editor rejects case-insensitive duplicates, cross-pool overlap and incomplete whole worlds", () => {
  const input = edits(), before = structuredClone(world);
  assert.throws(() => applyNamePoolEdits(world, { ...input, male: `${input.male}\n  male damon ` }), /Male name pool contains a duplicate/);
  assert.throws(() => applyNamePoolEdits(world, { ...input, female: `${input.female}\nFEMALE DEMETRIA` }), /Female name pool contains a duplicate/);
  assert.throws(() => applyNamePoolEdits(world, { ...input, female: `${input.female}\n  MALE DAMON ` }), /pools overlap/);
  assert.throws(() => applyNamePoolEdits(world, { ...input, male: "\n " }), /male/);
  const invalid = structuredClone(world); invalid.events[0].sourceIds = ["missing-source-id"];
  assert.throws(() => applyNamePoolEdits(invalid, input), /unknown source/);
  assert.deepEqual(world, before);
});

function encounterFixture(pack: WorldPack): WorldPack {
  const copy = structuredClone(pack), keep = new Set([copy.health!.careDecision, ...Object.values(copy.economy!.moneylender!.events), "meet-person-harbor"]);
  // Name acceptance is independent of the sampled household's management route.
  if (copy.royalty) copy.royalty.originId = "fixture-unselected-royal-origin";
  if (copy.aristocracy) copy.aristocracy.originId = "fixture-unselected-estate-origin";
  withoutMarketSignals(copy);
  copy.events = copy.events.filter(event => keep.has(event.id));
  const meet = copy.events.find(event => event.id === "meet-person-harbor")!;
  meet.trigger = { type: "age", at: 18 }; delete meet.when;
  delete copy.eventPacing; delete copy.character!.encounterPacing; delete copy.health!.mortalityCalibration;
  copy.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  copy.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  copy.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  copy.yearlyEffects = []; copy.yearlyRules = [];
  return copy;
}
function meet(engine: LifeEngine, initial: LifeState) {
  let life = initial;
  while (life.age < 18) life = engine.advance(life);
  return engine.choose(life, "introduce-person-harbor");
}

test("applied draft pools feed new player and NPC identities while existing lives replay their original names", () => {
  const base = encounterFixture(world), originalEngine = createEngine(base), old = originalEngine.start("edited-name-0");
  const character = applyNamePoolEdits(base, edits()), revised = createEngine({ ...base, character });
  const sexes = new Set<string>(), npcSexes = new Set<string>();
  for (let seed = 0; seed < 32; seed++) {
    const birth = revised.start(`edited-name-${seed}`), player = birth.character!;
    sexes.add(player.sex!);
    assert.ok(character.identity!.namePools[player.sex!].includes(player.name!));
    assert.ok(player.name!.startsWith(player.sex === "male" ? "Male " : "Female "));
    const met = meet(revised, birth), person = met.character!.people!["person-harbor"];
    npcSexes.add(person.sex);
    assert.ok(character.identity!.namePools[person.sex].includes(person.name));
    assert.ok(person.name.startsWith(person.sex === "male" ? "Male " : "Female "));
    assert.deepEqual(revised.load(revised.save(met)), met);
  }
  assert.deepEqual([...sexes].sort(), ["female", "male"]); assert.deepEqual([...npcSexes].sort(), ["female", "male"]);
  assert.deepEqual(originalEngine.load(originalEngine.save(old)), old);
  assert.ok(!old.character!.name!.startsWith("Male ") && !old.character!.name!.startsWith("Female "));
});

test("identity worlds show two accessible pools while retained worlds keep the single-pool editor", () => {
  const current = renderToStaticMarkup(createElement(PlayerNamesEditor, { world, onChange() {} }));
  assert.match(current, /aria-label="Male name pool"/); assert.match(current, /aria-label="Female name pool"/);
  assert.equal((current.match(/<textarea/g) ?? []).length, 2);
  assert.match(current, /Apply name pools/); assert.doesNotMatch(current, /aria-label="Player name pool"/);
  const legacyWorld = structuredClone(retained) as WorldPack, before = structuredClone(legacyWorld);
  const legacy = renderToStaticMarkup(createElement(PlayerNamesEditor, { world: legacyWorld, onChange() {} }));
  assert.equal((legacy.match(/<textarea/g) ?? []).length, 1);
  assert.match(legacy, /aria-label="Player name pool"/); assert.doesNotMatch(legacy, /Male name pool|Female name pool/);
  const revised = applyNamePoolEdits(legacyWorld, { player: "  Damon\nLeon  \n\n" });
  assert.deepEqual(revised.playerNames, ["Damon", "Leon"]); assert.equal(revised.identity, undefined);
  assert.deepEqual(legacyWorld, before);
});
