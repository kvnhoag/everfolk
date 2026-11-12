import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { formatSkillValue, skillGrowthProfile } from "../client/models/skill-growth.ts";
import retained from "../worlds/alexandria-0.26.0.json" with { type: "json" };
import current from "../worlds/alexandria-sample.json" with { type: "json" };

function sample() {
  const world = structuredClone(retained) as WorldPack;
  const life = structuredClone(createEngine(world).start("skill-growth-view"));
  return { world, life };
}

test("skill numbers never round an unearned ceiling or requirement into success", () => {
  for (const value of [99.95, 99.995, 99.999, 99.9999, 99.99999999999999]) {
    assert.ok(formatSkillValue(value, 100) < 100, `${value} must remain below 100`);
  }
  assert.equal(formatSkillValue(100, 100), 100);
  assert.equal(formatSkillValue(99.951, 100), 99.951);
  assert.equal(formatSkillValue(85.124, 100), 85.12);
  assert.equal(formatSkillValue(25.124, 100), 25.1);
  assert.ok(formatSkillValue(39.999, 40) < 40);
  assert.ok(formatSkillValue(14.9999, 15) < 15);
  assert.equal(formatSkillValue(40, 40), 40);
  assert.equal(Object.is(formatSkillValue(-0.00001), -0), false);
});

test("growth profiles read the current retained curve at exact band boundaries", () => {
  const { world, life } = sample();
  for (const [value, percent] of [[0, 100], [39.99, 100], [40, 50], [69.99, 50], [70, 20], [90, 5], [99.99, 5]]) {
    life.character!.skills.craft = value;
    assert.equal(skillGrowthProfile(world, life, "craft")!.percent, percent);
  }
  life.character!.skills.craft = 100;
  assert.equal(skillGrowthProfile(world, life, "craft")!.atCap, true);
  assert.equal(skillGrowthProfile(world, life, "craft")!.multiplier, 0.05);
});

test("late progression percentages and ranges derive from a revised curve without changing state", () => {
  const { world, life } = sample();
  world.character!.skills.craft.gainCurve = [
    { from: 0, multiplier: 1 }, { from: 40, multiplier: 0.5 },
    { from: 70, multiplier: 0.15 }, { from: 85, multiplier: 0.05 },
    { from: 95, multiplier: 0.015 }, { from: 99, multiplier: 0.003 },
  ];
  life.character!.skills.craft = 99.95;
  const originalWorld = structuredClone(world), originalLife = structuredClone(life);
  const profile = skillGrowthProfile(world, life, "craft")!;
  assert.equal(profile.percent, 0.3);
  assert.equal(profile.multiplier, 0.003);
  assert.equal(profile.atCap, false);
  assert.deepEqual(profile.bands.map(band => [band.from, band.to, band.percent]), [
    [0, 40, 100], [40, 70, 50], [70, 85, 15], [85, 95, 5], [95, 99, 1.5], [99, 100, 0.3],
  ]);
  life.character!.skills.craft = 95;
  assert.equal(skillGrowthProfile(world, life, "craft")!.percent, 1.5);
  life.character!.skills.craft = originalLife.character!.skills.craft;
  assert.deepEqual(world, originalWorld);
  assert.deepEqual(life, originalLife);
});

test("mastery hints require a real rare skill reward before an ending", () => {
  const { world, life } = sample();
  assert.equal(skillGrowthProfile(world, life, "craft")!.hasRareMastery, true);
  assert.equal(skillGrowthProfile(world, life, "music")!.hasRareMastery, false);
  const rare = world.events.find(event => event.id === "rare-masterwork")!;
  const branch = rare.choices.flatMap(choice => choice.outcomes).find(outcome => outcome.effects.some(effect => effect.type === "mastery" && effect.id === "craft"))!;
  const reward = structuredClone(branch.effects);
  branch.effects = [{ type: "end", ending: world.defaultEnding }, ...reward];
  assert.equal(skillGrowthProfile(world, life, "craft")!.hasRareMastery, false);
  branch.effects = reward;
  delete rare.rarity;
  assert.equal(skillGrowthProfile(world, life, "craft")!.hasRareMastery, false);
});

test("unannotated, missing-character and partial draft skills do not invent growth rules", () => {
  const { world, life } = sample();
  assert.equal(skillGrowthProfile(world, life, "missing"), undefined);
  delete world.character!.skills.craft.gainCurve;
  assert.equal(skillGrowthProfile(world, life, "craft"), undefined);
  world.character!.skills.craft.gainCurve = [{ from: 0, multiplier: 0 }];
  assert.equal(skillGrowthProfile(world, life, "craft"), undefined);
  world.character!.skills.craft.gainCurve = [{ from: 40, multiplier: 0.5 }];
  assert.equal(skillGrowthProfile(world, life, "craft"), undefined);
  assert.equal(skillGrowthProfile(world, { ...life, character: undefined } as LifeState, "craft"), undefined);
  delete world.character;
  assert.equal(skillGrowthProfile(world, life, "craft"), undefined);
});

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: SkillGrowth } = await import("../client/components/SkillGrowth.tsx");
const { default: CompactSkillPanel } = await import("../client/components/CompactSkillPanel.tsx");
hooks.deregister();

test("the learning panel renders the retained and revised real rates and actual mastery coverage", () => {
  const old = sample();
  old.life.character!.skills.craft = 95;
  const oldHtml = renderToStaticMarkup(createElement(SkillGrowth, { ...old, skillId: "craft" }));
  assert.match(oldHtml, /aria-label="Tool handling learning pace"/);
  assert.match(oldHtml, /<strong>5%<\/strong>/);
  assert.match(oldHtml, /A rare mastery encounter can bring this skill to 100/);

  const world = structuredClone(current) as WorldPack;
  const life = structuredClone(createEngine(world).start("skill-growth-render"));
  life.character!.skills.craft = 95;
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  const revisedHtml = renderToStaticMarkup(createElement(SkillGrowth, { world, life, skillId: "craft" }));
  assert.match(revisedHtml, /<strong>1\.5%<\/strong>/);
  assert.match(revisedHtml, /From 99<\/dt><dd>0\.3% of the usual gain/);
  assert.match(revisedHtml, /practice, work and ordinary events/);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);

  old.life.character!.skills.music = 95;
  const noMastery = renderToStaticMarkup(createElement(SkillGrowth, { ...old, skillId: "music" }));
  assert.doesNotMatch(noMastery, /rare mastery/i);
  life.character!.skills.music = 95;
  const musicHtml = renderToStaticMarkup(createElement(SkillGrowth, { world, life, skillId: "music" }));
  assert.match(musicHtml, /A rare mastery encounter can bring this skill to 100/);
});

test("the learning panel marks only the accepted cap as reached", () => {
  const { world, life } = sample();
  life.character!.skills.craft = 99.9999;
  let html = renderToStaticMarkup(createElement(SkillGrowth, { world, life, skillId: "craft" }));
  assert.doesNotMatch(html, /Ceiling reached/);
  assert.match(html, /Learning pace/);
  life.character!.skills.craft = 100;
  html = renderToStaticMarkup(createElement(SkillGrowth, { world, life, skillId: "craft" }));
  assert.match(html, /Ceiling reached/);
  assert.match(html, /<strong>100\/100<\/strong>/);
  assert.doesNotMatch(html, /Ordinary gains slow as proficiency rises/);
  assert.equal(renderToStaticMarkup(createElement(SkillGrowth, { world, life, skillId: "missing" })), "");
});

test("the compact panel shows near-ceiling precision without claiming mastery", () => {
  const world = structuredClone(current) as WorldPack;
  const life = structuredClone(createEngine(world).start("compact-skill-ceiling-render"));
  // Explicit display fixture: changing this snapshot is not a simulation command.
  life.age = 30;
  life.character!.skills.craft = 99.9999;
  const before = structuredClone(life);
  const renderNode = () => {
    const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life }));
    const node = html.match(/<div class="compact-skill-node[^\"]*" title="Tool handling:[\s\S]*?<\/div>/)?.[0];
    assert.ok(node, "Tool handling's progressed branch should be visible");
    return node;
  };
  const near = renderNode();
  assert.match(near, /is-learning/);
  assert.doesNotMatch(near, /is-mastered/);
  assert.match(near, /Tool handling: 99\.999\/100\. learning/);
  assert.match(near, /<strong>99\.999<small>\/100<\/small><\/strong>/);
  assert.match(near, /Learning pace 0\.3%/);
  assert.deepEqual(life, before);
  life.character!.skills.craft = 100;
  const mastered = renderNode();
  assert.match(mastered, /is-mastered/);
  assert.match(mastered, /Tool handling: 100\/100\. mastered/);
  assert.match(mastered, /<strong>100<small>\/100<\/small><\/strong>/);
  assert.doesNotMatch(mastered, /Learning pace/);
});
