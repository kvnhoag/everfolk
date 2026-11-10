import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { builtinEngine } from "../client/session.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: LifeOverview } = await import("../client/LifeOverview.tsx");
const { default: LifeMoment } = await import("../client/LifeMoment.tsx");
const { default: DecisionDialog } = await import("../client/DecisionDialog.tsx");
hooks.deregister();

const world = builtinEngine.world;
const life = builtinEngine.start("everfolk-dashboard");
const noop = () => {};

test("overview leads with wealth and society percentile, with cash as a subordinate note", () => {
  const html = renderToStaticMarkup(createElement(LifeOverview, { life, world, onOpenWealth: noop }));
  assert.match(html, /350 BCE/);
  assert.doesNotMatch(html, /<dt>Cash<\/dt>/);
  assert.match(html, /overview-wealth-label">Total wealth<\/span><strong/);
  assert.match(html, /overview-wealth-label">Society percentile<\/span><strong/);
  assert.match(html, /<small class="overview-cash-note"[^>]*>Cash available:/);
  for (const [id, definition] of Object.entries(world.stats)) {
    if (id === world.economy?.stat) continue;
    assert.ok(html.includes(`aria-label="${definition.label}"`));
    assert.ok(html.includes(`aria-valuenow="${life.stats[id]}"`));
  }
  assert.doesNotMatch(html, /role="meter" aria-label="Wealth"/);
  assert.match(html, /Open total wealth and society comparison/);
});

test("decisions use a native popup and retain all real choices and impact previews", () => {
  let pending = life;
  for (let age = 0; age < 20 && pending.phase !== "choice" && pending.phase !== "ended"; age++) pending = builtinEngine.advance(pending);
  assert.equal(pending.phase, "choice");
  const event = world.events.find(event => event.id === pending.pendingEventId)!;
  const choices = builtinEngine.getChoices(pending);
  const html = renderToStaticMarkup(createElement(DecisionDialog, { open: true, event, life: pending, world, choices, onChoose: noop, onSetAside: noop, onEnableAuto: noop }));
  assert.match(html, /<dialog class="life-decision-dialog choice-popup/);
  assert.doesNotMatch(html, /inline-decision/);
  for (const choice of choices) assert.ok(html.includes(choice.text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;")));
  assert.match(html, /aria-label="Choice preview"/);
  assert.match(html, /Enable Auto mode/);
});

test("the quiet-year card shows completed facts without advancing or changing the save", () => {
  const before = JSON.stringify(life);
  const html = renderToStaticMarkup(createElement(LifeMoment, { life, world, onAdvance: noop, onOpenChronicle: noop }));
  assert.match(html, /Live another year/);
  assert.match(html, /Read your life record/);
  assert.equal(JSON.stringify(life), before);
});
