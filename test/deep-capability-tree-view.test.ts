import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { CAPABILITY_RULES } from "../src/deep-capabilities/rules.ts";
import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: CapabilityTree } = await import("../client/components/DeepCapabilityTree.tsx");
hooks.deregister();
const skills = Object.fromEntries([...new Set(CAPABILITY_RULES.flatMap(rule => Object.keys(rule.minimumProficiency)))].map(id => [id, { label: id, min: 0, max: 100, initial: 0 }]));
const world = { deepCapabilities: { version: "deep-1", rules: CAPABILITY_RULES }, character: { skills } } as unknown as WorldPack;
function life(learned = false): LifeState {
  return { year: -330, age: 20, stats: { health: 70, knowledge: 70, bonds: 70 }, character: { skills: Object.fromEntries(Object.keys(skills).map(id => [id, 100])) }, deepCapabilities: {
    learned: learned ? { F1: { year: -331, evidenceIds: ["fieldwork-1"] } } : {},
    evidence: learned ? [{ id: "fieldwork-1", year: -331, kind: "work", action: "fieldwork", successful: true, facts: { paidInputs: true } }] : [],
  } } as unknown as LifeState;
}
const activity: ActivityAvailability = { id: "practice-fieldwork", text: "Practice fieldwork for one year", available: true, category: "training", outcomes: [{ id: "practice-done", text: "Practice complete", weight: 1, effects: [{ type: "skill", skill: "farming", delta: 5 }] }] };
const render = (state = life(), readOnly = false, activities: ActivityAvailability[] = []) => renderToStaticMarkup(createElement(CapabilityTree, { world, life: state, activities, onActivity: () => {}, readOnly }));

test("the full 65-node graph retains ten depths, eight specializations and every prerequisite link", () => {
  const html = render();
  assert.equal((html.match(/data-deep-capability-id=/g) ?? []).length, 65);
  assert.equal((html.match(/class="deep-capability-depth"/g) ?? []).length, 10);
  assert.equal((html.match(/class="deep-capability-lane"/g) ?? []).length, 8);
  assert.equal((html.match(/<path /g) ?? []).length, CAPABILITY_RULES.reduce((sum, rule) => sum + rule.prerequisites.all.length, 0));
  assert.match(html, /Highlight a skill family/);
  assert.match(html, /The complete tree stays visible/);
  for (const family of ["Farming", "Artisan", "Philosophy", "Trade"]) assert.ok(html.includes(family));
});

test("high proficiencies alone never masquerade as learned capability evidence", () => {
  const html = render();
  assert.match(html, /0 \/ 65/);
  assert.equal((html.match(/class="deep-capability-node is-learned/g) ?? []).length, 0);
  assert.match(html, /Demonstrated work/);
  assert.match(html, /What this unlocks/);
  assert.match(html, /100 \/ 0/);
});

test("recorded learned nodes are shown without automatically promoting an unrecorded preview", () => {
  const html = render(life(true));
  assert.match(html, /1 \/ 65/);
  assert.equal((html.match(/class="deep-capability-node is-learned/g) ?? []).length, 1);
  assert.match(html, /Learned through recorded work/);
  assert.match(html, /1 linked evidence records/);
});

test("supported locked nodes remain inspectable while future branches are labelled unavailable", () => {
  const html = render();
  for (const path of ["Military", "Seafaring", "Music and performance", "Court and rulership"]) assert.ok(html.includes(path));
  assert.equal((html.match(/<span>Unavailable<\/span>/g) ?? []).length, 4);
  assert.match(html, /data-deep-capability-id="F1"/);
  assert.match(html, /aria-controls=/);
  assert.match(html, /role="region"/);
  assert.match(html, /tabindex="0"/);
});

test("the selected node offers relevant available work and read-only views disable game actions", () => {
  const active = render(life(), false, [activity, { ...activity, id: "locked-work", text: "Locked work should not be offered", available: false }]);
  assert.match(active, /Practice fieldwork for one year/);
  assert.match(active, /Choose this work/);
  assert.doesNotMatch(active, /Locked work should not be offered/);
  const reference = render(life(), true, [activity]);
  assert.match(reference, /disabled=""[^>]*>Reference only/);
  assert.doesNotMatch(reference, /Choose this work/);
});


test("capability operations expose their real annual work in the selected node", () => {
  const fieldwork: ActivityAvailability = { id: "v-cap-fieldwork", text: "Work a supervised year on the household fields", available: true, category: "career", outcomes: [{ id: "fieldwork-done", text: "Work complete", weight: 1, effects: [{ type: "vocation", action: "cap-fieldwork" }] }] };
  const supportedWorld = { ...world, vocations: { actions: { "cap-fieldwork": { kind: "capability", operation: "fieldwork" } } } } as unknown as WorldPack;
  const html = renderToStaticMarkup(createElement(CapabilityTree, { world: supportedWorld, life: life(), activities: [fieldwork], onActivity: () => {} }));
  assert.match(html, /Work a supervised year on the household fields/);
  assert.match(html, /Choose this work/);
});
