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
const { default: EventNotificationStack } = await import("../client/EventNotificationStack.tsx");
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

test("completed-event notices render newest first with dismiss controls and keep the record available during decisions", () => {
  const updated = { ...life, phase: "choice" as const, journal: [...life.journal, ...["one", "two", "three", "four"].map(id => ({
    type: "event" as const, id: `health-onset-${id}`, age: life.age, year: life.year, text: `Completed ${id}.`,
  }))] };
  const before = JSON.stringify(updated);
  const html = renderToStaticMarkup(createElement(LifeMoment, { life: updated, world, onAdvance: noop, onOpenChronicle: noop }));
  assert.match(html, /role="log" aria-label="Important life events"/);
  assert.equal((html.match(/class="event-notification"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Completed one\./);
  assert.ok(html.indexOf("Completed four.") < html.indexOf("Completed three."));
  assert.match(html, /aria-label="Dismiss event: Completed four\."/);
  assert.doesNotMatch(html, /Live another year/);
  assert.match(html, /Read your life record/);
  assert.equal(JSON.stringify(updated), before);
});

test("routine childhood moments stay out of the notification panel and remain in the life record", () => {
  const updated = { ...life, age: 3, year: life.year + 3, journal: [...life.journal, {
    type: "event" as const, id: "small-doorway", age: 3, year: life.year + 3, text: "An ordinary childhood moment.",
  }] };
  const html = renderToStaticMarkup(createElement(LifeMoment, { life: updated, world, onAdvance: noop, onOpenChronicle: noop }));
  assert.doesNotMatch(html, /class="event-notification"/);
  assert.match(html, /Important life events/);
  assert.match(html, /Read your life record/);
  assert.equal(updated.journal.at(-1)?.text, "An ordinary childhood moment.");
});


test("the floating stack ignores routine events while keeping an unanswered decision actionable", () => {
  const event = world.events.find(item => item.mode !== "automatic" && item.choices.length > 0)!;
  const updated = { ...life, age: 3, year: life.year + 3, phase: "choice" as const, pendingEventId: event.id,
    journal: [...life.journal, { type: "event" as const, id: "small-doorway", age: 3, year: life.year + 3, text: "An ordinary childhood moment." }] };
  const html = renderToStaticMarkup(createElement(EventNotificationStack, { life: updated, world, decisionEvent: event, onOpenDecision: noop, onOpenChronicle: noop }));
  assert.match(html, /event-toast is-decision/);
  assert.match(html, /Open decision/);
  assert.doesNotMatch(html, /event-toast is-event/);
  assert.doesNotMatch(html, /event-toast-dismiss/);
});

test("the floating stack shows only the latest important completed facts with dismiss controls", () => {
  const updated = { ...life, journal: [...life.journal, ...["one", "two", "three", "four"].map(id => ({
    type: "event" as const, id: `health-onset-${id}`, age: life.age, year: life.year, text: `Important ${id}.`,
  })), { type: "event" as const, id: "small-doorway", age: life.age, year: life.year, text: "An ordinary moment." }] };
  const html = renderToStaticMarkup(createElement(EventNotificationStack, { life: updated, world, onOpenDecision: noop, onOpenChronicle: noop }));
  assert.equal((html.match(/event-toast is-event/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Important one\.|An ordinary moment/);
  assert.ok(html.indexOf("Important four.") < html.indexOf("Important three."));
  assert.equal((html.match(/class="event-toast-dismiss"/g) ?? []).length, 3);
});
