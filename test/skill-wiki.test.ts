import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { CharacterActivity, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SkillTree } = await import("../client/SkillTree.tsx");
hooks.deregister();

function fixture(): WorldPack {
  const training = (id: string, minAge: number): CharacterActivity => ({ id: `train-${id}`, text: `Practice ${id}`, category: "training", minAge,
    outcomes: [{ id: `learn-${id}`, text: "You practice.", weight: 1, effects: [{ type: "skill", skill: id, delta: 2 }] }] });
  return {
    schemaVersion: 1, id: "skill-wiki-fixture", version: "1", title: "Skill wiki fixture", description: "Synthetic display rules.", startYear: -50, maxAge: 100,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70 }, wealth: { label: "Resources", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "A beginning.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "Life complete", text: "A life.", kind: "death" }], defaultEnding: "end",
    character: {
      skills: {
        literacy: { label: "Literacy", min: 0, max: 100, initial: 0, trainingActivity: "train-literacy", branch: "Letters" },
        craft: { label: "Craft", min: 0, max: 100, initial: 0, prerequisites: { literacy: 10 }, trainingActivity: "train-craft", branch: "Crafts" },
        pottery: { label: "Pottery", min: 0, max: 100, initial: 0, prerequisites: { craft: 20 }, trainingActivity: "train-pottery", branch: "Crafts" },
        sculpture: { label: "Sculpture", min: 0, max: 100, initial: 0, prerequisites: { pottery: 20 }, trainingActivity: "train-sculpture", branch: "Crafts" },
      },
      jobs: [{ id: "artisan", title: "Artisan", description: "Make useful objects.", minAge: 16, requirements: { craft: 20 }, yearlyEffects: [] }], partners: [],
      activities: [training("literacy", 6), training("craft", 12), training("pottery", 12), training("sculpture", 18),
        { id: "craft-commission", text: "Complete a craft commission", category: "career", minAge: 12, when: { type: "skill", skill: "craft", op: "gte", value: 15 },
          outcomes: [{ id: "paid", text: "You complete the task.", weight: 1, effects: [{ type: "stat", stat: "wealth", delta: 2 }, { type: "skill", skill: "craft", delta: 1 }] }] },
        { id: "become-artisan", text: "Become an artisan", category: "career", minAge: 16,
          outcomes: [{ id: "appointed", text: "You start work.", weight: 1, effects: [{ type: "job", job: "artisan" }] }] },
        { id: "other-training", text: "Practice breathing", category: "training", minAge: 6,
          outcomes: [{ id: "rested", text: "You rest.", weight: 1, effects: [{ type: "stat", stat: "health", delta: 1 }] }] },
      ], childNames: ["Child"],
      deathCauses: [{ id: "old", title: "Old age", text: "Life ends.", weight: 1 }], deathCauseDescription: "Fictional fixture.",
    },
  };
}

test("the infant skill view offers the wiki without rendering locked nodes", () => {
  const world = pack as WorldPack, engine = createEngine(world), life = engine.start("skill-wiki-infant");
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  let actions = 0;
  const html = renderToStaticMarkup(createElement(SkillTree, { life, world, activities: engine.getActivities(life), onActivity: () => { actions++; } }));
  assert.match(html, /<h3>Your skills<\/h3>/);
  assert.match(html, /class="skill-wiki-link"[^>]*>Skill wiki /);
  assert.match(html, /Skills unlock as you grow and learn/);
  assert.doesNotMatch(html, /skill-tree-node|skill-tree-board|skill-practice-button/);
  assert.equal(actions, 0);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);
});

test("current skills display unlocked and earned paths while unlearned locked paths stay in the wiki", () => {
  const world = fixture(), engine = createEngine(world), life = structuredClone(engine.start("skill-wiki-current"));
  life.age = 12;
  life.year = world.startYear + life.age;
  life.character!.skills.literacy = 10;
  life.character!.skills.sculpture = 1;
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  let actions = 0;
  const html = renderToStaticMarkup(createElement(SkillTree, { life, world, activities: engine.getActivities(life), onActivity: () => { actions++; } }));
  assert.match(html, /aria-label="Literacy, 10 of 100, learning"/);
  assert.match(html, /aria-label="Craft, 0 of 100, ready, requires Literacy 10"/);
  assert.match(html, /aria-label="Sculpture, 1 of 100, locked, requires Pottery 20"/);
  assert.doesNotMatch(html, /aria-label="Pottery, 0 of 100/);
  assert.equal((html.match(/class="skill-tree-node /g) ?? []).length, 3);
  assert.equal(actions, 0);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);
});

test("the wiki includes every authored skill and its prerequisite notes", () => {
  const world = pack as WorldPack, engine = createEngine(world), life = engine.start("skill-wiki-full");
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  let actions = 0;
  const html = renderToStaticMarkup(createElement(SkillTree, { life, world, activities: engine.getActivities(life), initialView: "wiki", onActivity: () => { actions++; } }));
  assert.match(html, /<h3>All skill paths<\/h3>/);
  assert.equal((html.match(/class="skill-tree-node /g) ?? []).length, Object.keys(world.character!.skills).length);
  for (const definition of Object.values(world.character!.skills)) assert.ok(html.includes(`aria-label="${definition.label},`), definition.label);
  assert.match(html, /requires Tool handling 15/);
  assert.match(html, /requires Wood carving 20, Pottery 10/);
  assert.doesNotMatch(html, /skill-practice-button|>Train<|>Take paid work<|>Choose this occupation</);
  assert.equal(actions, 0);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);
});

test("wiki requirements, practice, paid work, occupations and other training are read-only", () => {
  const world = fixture(), engine = createEngine(world), life = engine.start("skill-wiki-readonly");
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  let actions = 0;
  const html = renderToStaticMarkup(createElement(SkillTree, { life, world, activities: engine.getActivities(life), initialView: "wiki", onActivity: () => { actions++; } }));
  assert.match(html, /aria-label="Craft details"/);
  assert.match(html, /Age 12 or older/);
  assert.match(html, />Literacy<\/button>/);
  assert.match(html, /0 <span>\/ 10<\/span>/);
  assert.match(html, /Practice craft/);
  assert.match(html, /Complete a craft commission/);
  assert.match(html, />Artisan<\/span>/);
  assert.match(html, /Become an artisan/);
  assert.match(html, /Other training activities/);
  assert.match(html, /Practice breathing/);
  assert.doesNotMatch(html, /skill-practice-button|aria-label="(?:Take paid work|Change occupation|Ask moneylender to fund)|>Train<|>Take paid work<|>Choose this occupation</);
  assert.equal(actions, 0);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);
});
