import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/index.ts";
import type { Choice, Effect, WorldPack } from "../src/types.ts";
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
const { default: CompactSkillPanel } = await import("../client/components/CompactSkillPanel.tsx");
const { default: ChoiceImpact } = await import("../client/components/ChoiceImpact.tsx");
const { default: DecisionDialog } = await import("../client/components/DecisionDialog.tsx");
const { CurrentLegacySummary } = await import("../client/components/LegacyGallery.tsx");
hooks.deregister();

function sample() {
  const world = structuredClone(pack) as WorldPack;
  const life = structuredClone(createEngine(world).start("choice-effects-render"));
  return { world, life };
}

function option(...branches: Effect[][]): Choice {
  return { id: "preview-choice", text: "Take the offered work", outcomes: branches.map((effects, i) => ({
    id: `result-${i}`, text: "The work is done.", weight: 1, effects,
  })) };
}

test("choice preview shows skills alongside bounded stat ranges, money and fatal risk while concealing growth modifiers", () => {
  const { world, life } = sample();
  // Explicit display fixture: normal play still owns all changes to saved lives.
  life.stats.knowledge = 95;
  life.stats.bonds = 99;
  life.economy!.cash = 100;
  const choice = option([
    { type: "stat", stat: "knowledge", delta: 20 },
    { type: "stat", stat: "bonds", delta: 100 },
    { type: "cash", delta: -12 },
    { type: "skill", skill: "craft", delta: 20 },
    { type: "flag", flag: "early-interest-sculpture", value: true },
  ], [
    { type: "stat", stat: "knowledge", delta: 4 },
    { type: "cash", delta: -2 },
    { type: "mastery", target: "skill", id: "craft" },
    { type: "end", ending: world.endings.find(ending => ending.kind === "death")!.id },
  ]);
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice, previewOnly: true }));
  assert.match(html, /aria-label="Choice preview"/);
  assert.match(html, /CHOICE PREVIEW/);
  assert.doesNotMatch(html, /Choice effects|<h3>/);
  assert.match(html, /Knowledge/);
  assert.match(html, /increase by 0\.2 to 1/);
  assert.match(html, /Bonds/);
  assert.match(html, /increase by 0 to 1/);
  assert.match(html, /Cash/);
  assert.match(html, /decrease by 2 to 12 dr/);
  assert.match(html, /Risk of death: 50%/);
  assert.match(html, /Tool handling/);
  assert.doesNotMatch(html, /Early interest|Future practice|Possible change|cap 100|compact-skill-node|<meter/);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);
});

test("direct skill changes in the preview do not reveal mastery metadata or early-interest growth bonuses", () => {
  const { world, life } = sample();
  const choice = option([
    { type: "skill", skill: "craft", delta: 4 },
    { type: "mastery", target: "skill", id: "sculpture" },
    { type: "flag", flag: "early-interest-sculpture", value: true },
  ]);
  assert.equal(renderToStaticMarkup(createElement(ChoiceImpact, { world, life, choice })), "", "gameplay summaries conceal skill and route effects by default");
  assert.equal(renderToStaticMarkup(createElement(ChoiceImpact, { world, life, choice, hideSkills: true })), "");
  const authored = renderToStaticMarkup(createElement(ChoiceImpact, { world, life, choice, hideSkills: false }));
  assert.match(authored, /Tool handling/);
  assert.match(authored, /Sculpture cap 100/);
  assert.match(authored, /Early interest/);
  const preview = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice, previewOnly: true }));
  assert.match(preview, /Tool handling/);
  assert.match(preview, /increase by 4/);
  assert.match(preview, /Sculpture/);
  assert.doesNotMatch(preview, /No immediate change|Early interest|Future practice|Possible change|cap 100/);
  const growthOnly = option([{ type: "flag", flag: "early-interest-sculpture", value: true }]);
  const hidden = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice: growthOnly, previewOnly: true }));
  assert.match(hidden, /No immediate change\./);
  assert.doesNotMatch(hidden, /Early interest|Future practice|Sculpture/);
});

test("the preview works without a skill system and gives a neutral empty state", () => {
  const { world, life } = sample();
  delete world.character;
  delete life.character;
  const choice = option([{ type: "stat", stat: "knowledge", delta: 1 }]);
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice, previewOnly: true }));
  assert.match(html, /Knowledge/);
  assert.doesNotMatch(html, /No immediate change|skill change|<meter/);
  const empty = option([]);
  const emptyHtml = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice: empty, previewOnly: true }));
  assert.match(emptyHtml, /No immediate change\./);
  assert.equal(renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, previewOnly: true })), "");
});

test("skill previews show bounded gain and loss ranges without exposing the growth curve", () => {
  const { world, life } = sample();
  world.character!.skills.craft.gainCurve = [{ from: 0, multiplier: 1 }, { from: 90, multiplier: .1 }];
  life.character!.skills.craft = 99;
  const choice = option([{ type: "skill", skill: "craft", delta: 20 }], [{ type: "skill", skill: "craft", delta: -6 }]);
  const before = structuredClone(life), beforeWorld = structuredClone(world);
  const html = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice, previewOnly: true }));
  assert.match(html, /Tool handling/);
  assert.match(html, /decrease by 6 to increase by 1/);
  assert.match(html, /impact-loss/);
  assert.match(html, /impact-gain/);
  assert.doesNotMatch(html, /No immediate change|Learning pace|Future practice|multiplier|10%/);
  assert.deepEqual(life, before);
  assert.deepEqual(world, beforeWorld);
});

test("the progress sidebar shows observed skills and does not reveal a hovered choice's branch", () => {
  const { world, life } = sample();
  life.character!.skills.craft = 12;
  life.flags["early-interest-sculpture"] = true;
  const choice = option([{ type: "skill", skill: "philosophy", delta: 40 }]);
  const render = (hovered?: Choice) => renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice: hovered }));
  const ordinary = render(), hovered = render(choice);
  assert.match(ordinary, /aria-label="Skill progress"/);
  assert.match(ordinary, /Tool handling/);
  assert.match(ordinary, /<meter/);
  assert.match(ordinary, /<strong>12<small>\/100/);
  assert.doesNotMatch(hovered, /CHOICE PREVIEW|Take the offered work|Possible change|Future practice|Early interests|is-highlighted|is-affected|is-muted/);
  // React's generated label IDs differ between separate SSR calls.
  assert.equal(ordinary.replace(/_R_[^"]*_/g, "ID"), hovered.replace(/_R_[^"]*_/g, "ID"));
});

test("the decision dialog starts with the first choice's visible effects and has no separate preview buttons", () => {
  const { world, life } = sample();
  const first = option([
    { type: "stat", stat: "knowledge", delta: 1 },
    { type: "skill", skill: "craft", delta: 4 },
    { type: "flag", flag: "early-interest-sculpture", value: true },
  ]);
  const second = { ...option([]), id: "leave", text: "Leave the work" };
  const event = { id: "preview-event", title: "Work is offered", text: "You have a choice.", trigger: { type: "age" as const, at: 0 }, choices: [first, second] };
  let chosen = 0;
  const html = renderToStaticMarkup(createElement(DecisionDialog, { world, life, event, choices: event.choices, open: true,
    onChoose() { chosen++; }, onSetAside() {}, onEnableAuto() {},
  }));
  assert.match(html, /life-choice-commit is-previewed/);
  assert.match(html, /CHOICE PREVIEW/);
  assert.doesNotMatch(html, /Choice effects/);
  assert.match(html, /compact-skill-preview-label">Take the offered work/);
  assert.match(html, /Knowledge/);
  assert.match(html, /Tool handling/);
  const firstOption = html.match(/<button class="life-choice-commit[^"]*"[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.match(firstOption, /Tool handling/, "every option shows its own skill changes without hovering");
  assert.doesNotMatch(html, /life-option-preview|aria-pressed=|Preview skills|>Preview[ <]|Early interest|Future practice|compact-skill-node/);
  assert.equal(chosen, 0);
});

test("opportunity odds include hidden influences without explaining the internal modifier", () => {
  const { world, life } = sample();
  life.flags["early-interest-sculpture"] = true;
  const choice = option([], []);
  choice.opportunity = { label: "Complete the work", outcomeIds: [choice.outcomes[0].id] };
  choice.outcomes[0].weightModifiers = [{
    when: { type: "flag", flag: "early-interest-sculpture", value: true }, multiplier: 1.2,
    reason: "A remembered early interest supports your preparation.",
  }];
  const visible = renderToStaticMarkup(createElement(ChoiceImpact, { world, life, choice }));
  assert.match(visible, /Complete the work: 54.5%/);
  assert.doesNotMatch(visible, /remembered early interest|choice-opportunity-factors/);
  const preview = renderToStaticMarkup(createElement(CompactSkillPanel, { world, life, choice, previewOnly: true }));
  assert.match(preview, /Complete the work: 54.5%/);
  assert.doesNotMatch(preview, /remembered early interest|choice-opportunity-factors|Future practice/);
  const admin = renderToStaticMarkup(createElement(ChoiceImpact, { world, life, choice, hideSkills: false }));
  assert.match(admin, /remembered early interest/);
  assert.match(admin, /Complete the work: 54.5%/);
});

test("unearned accomplishments never reveal routes in the current run", () => {
  const { world, life } = sample();
  const html = renderToStaticMarkup(createElement(CurrentLegacySummary, { world, life, onOpenGallery() {} }));
  assert.equal(html, "");
});
