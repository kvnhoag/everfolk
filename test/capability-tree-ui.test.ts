import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine } from "../src/engine.ts";
import type { ActivityAvailability, WorldPack } from "../src/types.ts";
import type { CapabilityNodeView } from "../src/capabilities/types.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import { CAPABILITY_NODES } from "../client/models/capability-layout.ts";

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText, shortCircuit: true };
  return next(url, context);
} });
const { default: CapabilityTree, CapabilityInspector } = await import("../client/components/CapabilityTree.tsx");
const { default: CapabilityIcon } = await import("../client/components/CapabilityIcon.tsx");
hooks.deregister();
const world = base as unknown as WorldPack;
const engine = createEngine(world);
const life = engine.start("capability-ui-reference");

function buttonWithClass(value: unknown, className: string): ReactElement<{ className?: string; disabled?: boolean; onClick(): void }> | null {
  if (Array.isArray(value)) return value.map(child => buttonWithClass(child, className)).find(Boolean) ?? null;
  if (!isValidElement<{ className?: string; children?: unknown }>(value)) return null;
  if (value.type === "button" && value.props.className === className) return value as never;
  return buttonWithClass(value.props.children, className);
}

test("old lives show all 74 inspectable nodes with their original rules retained", () => {
  const before = structuredClone(life);
  const html = renderToStaticMarkup(createElement(CapabilityTree, { world, life, activities: engine.getActivities(life), onActivity() { assert.fail("Viewing a tree must not act"); } }));
  assert.equal((html.match(/data-capability-id=/g) ?? []).length, 74);
  for (const node of CAPABILITY_NODES) assert.ok(html.includes(`data-capability-id="${node.id}"`), node.id);
  assert.match(html, /This life keeps its earlier skill rules/);
  assert.match(html, /Connected skill tree/);
  assert.doesNotMatch(html, /Fit whole tree|Find a skill|Zoom in skill map|Zoom out skill map/, "The map zooms by scroll or pinch only.");
  assert.doesNotMatch(html, /Inspect a skill|capability-node-picker/);
  assert.match(html, /Tree legend/);
  assert.match(html, /Crossover/);
  assert.match(html, /Title \/ key skill/);
  assert.match(html, /Selected path/);
  assert.match(html, /Strength, endurance and physical work/);
  assert.match(html, /Clothing, ceramics and sculpture/);
  assert.match(html, /Reading, inquiry and public reasoning/);
  assert.equal((html.match(/data-from=/g) ?? []).length, CAPABILITY_NODES.reduce((sum, node) => sum + node.prerequisites.all.length, 0));
  assert.deepEqual(life, before);
});

test("work details disclose proof, proficiency and reward without turning a score into an unlock", () => {
  const node = CAPABILITY_NODES.find(node => node.id === "PS10")!;
  const view: CapabilityNodeView = { id: node.id, state: "locked", reasons: ["Independent checking must be completed first."], progress: { done: 1, required: 2 }, actionId: null, actionLabel: "Continue inquiry", requirementText: ["Materials are reserved before work starts."] };
  const html = renderToStaticMarkup(createElement(CapabilityInspector, { node, view, world, life, activities: [], readOnly: false, onActivity() {}, onSelect() {}, detailId: "detail" }));
  assert.match(html, /Original inquiry/);
  assert.match(html, /Depth 10 of 10/);
  assert.match(html, /predeclared question/);
  assert.match(html, /Scientist career offers/);
  assert.match(html, /1 \/ 2 work steps/);
  assert.match(html, /Independent checking must be completed first/);
  assert.match(html, /0 \/ 72/);
  assert.doesNotMatch(html, /class="capability-work-button"/);
});

test("the work control sends exactly its offered engine activity and refuses unavailable work", () => {
  const node = CAPABILITY_NODES[0];
  const calls: string[] = [];
  const view: CapabilityNodeView = { id: node.id, state: "available", reasons: [], progress: { done: 0, required: 1 }, actionId: "cap-work-f1", actionLabel: "Work the field", requirementText: [] };
  const actor = { ...life, age: 18, phase: "ready" as const };
  const activity = { id: "cap-work-f1", text: "Work the field", available: true, outcomes: [] } as unknown as ActivityAvailability;
  const props = { node, view, world, life: actor, activities: [activity], readOnly: false, onActivity: (id: string) => calls.push(id), onSelect() {}, detailId: "detail" };
  const allowed = buttonWithClass(CapabilityInspector(props), "capability-work-button")!;
  assert.equal(allowed.props.disabled, false);
  allowed.props.onClick();
  assert.deepEqual(calls, ["cap-work-f1"]);
  const refused = buttonWithClass(CapabilityInspector({ ...props, activities: [{ ...activity, available: false }] }), "capability-work-button")!;
  assert.equal(refused.props.disabled, true);
  refused.props.onClick();
  assert.deepEqual(calls, ["cap-work-f1"]);
  const readOnly = renderToStaticMarkup(createElement(CapabilityInspector, { ...props, readOnly: true }));
  assert.doesNotMatch(readOnly, /class="capability-work-button"/);
  assert.match(readOnly, /Preview/);
});

test("original single-ink icons distinguish workshop, farm, research, civic and trade paths", () => {
  const ids = ["FC5", "FR5", "A1", "AT5", "AC5", "AS5", "P1", "PS5", "PP5", "T1"];
  const marks = ids.map(id => renderToStaticMarkup(createElement(CapabilityIcon, CAPABILITY_NODES.find(node => node.id === id)!)));
  assert.equal(new Set(marks.map(mark => mark.match(/data-mark="([^"]+)/)?.[1])).size, ids.length);
  for (const mark of marks) {
    assert.match(mark, /viewBox="0 0 32 32"/);
    assert.match(mark, /aria-hidden="true"/);
    assert.doesNotMatch(mark, /<image|https?:|base64/);
  }
});

test("skill details keep full rules collapsed and show requirements only once", () => {
  const node=CAPABILITY_NODES.find(node=>node.id==='M10')!;
  const view:CapabilityNodeView={id:node.id,state:'locked',reasons:['Serve as an Officer first.'],progress:{done:0,required:2},actionId:null,actionLabel:'Work',requirementText:['Warfare 72']};
  const html=renderToStaticMarkup(createElement(CapabilityInspector,{node,view,world,life,activities:[],readOnly:true,onActivity(){},onSelect(){},detailId:'compact'}));
  assert.match(html,/<details class="capability-full-rules"><summary>/);
  assert.doesNotMatch(html,/<details[^>]*open/);
  assert.doesNotMatch(html,/Before taking the work|Your demonstrated work is kept|Current condition requirements/);
  assert.equal((html.match(/Serve as an Officer first\./g)??[]).length,1);
  assert.match(html,/Full rules &amp; career opportunities/);
});

test("Issue #6: inspector renders commission terms, accepted deadlines, missing stock and multi-job assessments", () => {
  const node = CAPABILITY_NODES.find(n => n.id === "AT10")!;
  const view: CapabilityNodeView = {
    id: node.id,
    state: "available",
    reasons: [],
    progress: { done: 0, required: 2 },
    actionId: "cap-work-at10",
    actionLabel: "Work on this capability · 180 dr payment",
    requirementText: [],
    terms: {
      materialsOwner: "worker",
      quantity: 1,
      minimumQuality: 4,
      totalPayment: 180,
      payer: "workshop",
      workYearDeadline: 2,
      calendarDeadlineYears: 4,
    },
    eligibleJobs: [
      { jobId: "at3-14-5-1", nodeId: "AT3", age: 14, year: 5, kind: "craft", title: "Fine yarn", payment: 18, quantity: 1 },
      { jobId: "at4-15-6-1", nodeId: "AT4", age: 15, year: 6, kind: "craft", title: "Woven cloth", payment: 24, quantity: 1 },
    ],
  };
  const actor = { ...life, age: 20, phase: "ready" as const };
  const activity = { id: "cap-work-at10", text: "Work AT10", available: true, outcomes: [] } as unknown as ActivityAvailability;
  const html = renderToStaticMarkup(createElement(CapabilityInspector, {
    node, view, world, life: actor, activities: [activity], readOnly: false, onActivity() {}, onSelect() {}, detailId: "terms",
    onAssess() {},
  }));
  assert.match(html, /Commission terms/);
  assert.match(html, /Worker-provided/);
  assert.match(html, /Minimum quality: Grade 4/);
  assert.match(html, /Total payment: 180 dr · Payer: workshop/);
  assert.match(html, /Work-year deadline: 2 active work years/);
  assert.match(html, /Optional calendar deadline: 4 calendar years from start/);
  assert.match(html, /Commit to 4-year calendar deadline/);
  assert.match(html, /Qualify via completed jobs/);
  assert.match(html, /at3-14-5-1/);
  assert.match(html, /at4-15-6-1/);

  const calls: Array<[string, unknown]> = [];
  const assessments: Array<[string, readonly string[]]> = [];
  const withDeadlineBtn = buttonWithClass(CapabilityInspector({
    node, view, world, life: actor, activities: [activity], readOnly: false,
    calendarDeadline: true,
    selectedJobIds: ["at3-14-5-1", "at4-15-6-1"],
    onActivity: (id, opts) => calls.push([id, opts]),
    onAssess: (nid, ids) => assessments.push([nid, ids]),
    onSelect() {}, detailId: "terms",
  }), "capability-work-button")!;
  withDeadlineBtn.props.onClick();
  assert.deepEqual(calls, [["cap-work-at10", { calendarDeadline: true }]]);

  const assessBtn = buttonWithClass(CapabilityInspector({
    node, view, world, life: actor, activities: [activity], readOnly: false,
    selectedJobIds: ["at3-14-5-1", "at4-15-6-1"],
    onActivity() {},
    onAssess: (nid, ids) => assessments.push([nid, ids]),
    onSelect() {}, detailId: "terms",
  }), "capability-assess-button")!;
  assert.equal(assessBtn.props.disabled, false);
  assessBtn.props.onClick();
  assert.deepEqual(assessments, [["AT10", ["at3-14-5-1", "at4-15-6-1"]]]);

  const activeHtml = renderToStaticMarkup(createElement(CapabilityInspector, {
    node,
    view: {
      ...view,
      terms: { ...view.terms!, calendarDeadlineYear: 25, completedWorkYears: 1, reservedMissing: { silk: 1 } },
    },
    world, life: actor, activities: [activity], readOnly: false, onActivity() {}, onSelect() {}, detailId: "active-terms",
  }));
  assert.match(activeHtml, /Calendar deadline: year 25/);
  assert.match(activeHtml, /Missing reserved stock: 1 silk/);
});
