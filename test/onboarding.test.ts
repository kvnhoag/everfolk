import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { WorldPack } from "../src/types.ts";
import { lifeRoadmap, stageAges, worldUnlocks } from "../client/models/life-roadmap.ts";
import { nextTodo, yearChecklist, type YearFacts } from "../client/models/year-checklist.ts";
import { idleNudge, IDLE_NUDGE_MS, type IdleFacts } from "../client/models/idle-nudge.ts";
import { howToPlaySteps, YEAR_RHYTHM } from "../client/models/how-to-play.ts";
import { SECTION_STEPS, sectionStep } from "../client/models/section-steps.ts";
import { HOW_TO_PLAY_STORAGE_KEY, readHowToPlayAtStart, writeHowToPlayAtStart } from "../client/storage/how-to-play-storage.ts";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: YearChecklist, LockedSection } = await import("../client/components/YearChecklist.tsx");
hooks.deregister();

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;

test("the roadmap follows the world's own life stages, with what opens in each", () => {
  const stages = lifeRoadmap(world, 9);
  assert.deepEqual(stages.map(stage => stage.id), world.lifeStages!.stages.map(stage => stage.id));
  assert.ok(stages.length >= 5 && stages.length <= 10);
  assert.deepEqual(stages.map(stage => stage.state), ["past", "past", "current", "future", "future", "future", "future"]);
  const childhood = stages.find(stage => stage.id === "childhood")!;
  assert.equal(stageAges(childhood), "Ages 6–11");
  assert.ok(childhood.unlocks.some(unlock => unlock.age === 6 && /yearly action/i.test(unlock.text)));
  assert.ok(childhood.unlocks.some(unlock => unlock.age === world.demo!.market.minTradeAge && /Trade/.test(unlock.text)));
  assert.equal(stageAges(stages.at(-1)!), "Age 60+");
  for (const stage of stages) {
    assert.ok(stage.todo.length > 0, `${stage.id} says what to do`);
    assert.ok(stage.unlocks.filter(unlock => unlock.text.startsWith("Work: ")).length <= 1, `${stage.id} lists its jobs on one line`);
    assert.ok(stage.unlocks.every(unlock => unlock.age >= stage.fromAge && (stage.toAge === null || unlock.age <= stage.toAge)));
  }
  assert.ok(lifeRoadmap(world, null).every(stage => stage.state === "future"), "before a life begins nothing is marked");
});

test("unlock ages come from the world: focus, jobs, trading, courtship, family and the card pack", () => {
  const unlocks = worldUnlocks(world);
  const literacy = world.character!.activities.find(activity => activity.id === "train-literacy")!;
  assert.ok(unlocks.some(unlock => unlock.age === (literacy.minAge ?? 0) && unlock.text.includes("Study")));
  const firstJob = Math.min(...world.character!.jobs.map(job => job.minAge ?? 0));
  assert.ok(unlocks.some(unlock => unlock.age === firstJob && unlock.text.startsWith("Work: ")));
  assert.ok(unlocks.some(unlock => /card pack/.test(unlock.text) && unlock.age === 18));
  assert.deepEqual(unlocks.map(unlock => unlock.age), [...unlocks.map(unlock => unlock.age)].sort((a, b) => a - b));
});

const facts = (over: Partial<YearFacts> = {}): YearFacts => ({ age: 9, phase: "ready", playing: true, focusLabel: "Study", focusAge: 6, actionAge: 6, actionUsed: false,
  hasFields: true, fieldsAge: 4, grainPlots: 2, flaxPlots: 0, tradeAge: 10, marketVisited: false, recordYears: 10, ...over });

test("This year lists the sections in screen order with what each needs now", () => {
  const items = yearChecklist(facts());
  assert.deepEqual(items.map(entry => entry.step), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(items.map(entry => entry.state), ["done", "done", "todo", "info", "locked", "info"]);
  assert.equal(items.find(entry => entry.id === "town")!.status, "Trade at age 10");
  assert.equal(nextTodo(items)?.id, "action");
  assert.equal(yearChecklist(facts({ playing: false }))[0].status, "Paused: press Resume");
  assert.equal(yearChecklist(facts({ phase: "choice" }))[0].status, "Open the decision");
  assert.equal(yearChecklist(facts({ age: 3, focusAge: 6 }))[1].status, "Opens at age 6");
  assert.equal(yearChecklist(facts({ focusLabel: null }))[1].state, "todo");
  assert.equal(yearChecklist(facts({ age: 12, marketVisited: true })).find(entry => entry.id === "town")!.state, "done");
  assert.deepEqual(yearChecklist(facts({ hasFields: false })).map(entry => entry.id), ["time", "focus", "action", "record"]);
});

test("the checklist renders numbered buttons; locked lines say when they open", () => {
  const html = renderToStaticMarkup(createElement(YearChecklist, { items: yearChecklist(facts({ age: 3, focusAge: 6 })) }));
  assert.match(html, /aria-label="This year, in order"/);
  assert.match(html, /aria-label="2\. Focus: Opens at age 6"/);
  assert.match(html, /class="year-check is-locked"/);
  const locked = renderToStaticMarkup(createElement(LockedSection, { step: 3, id: "action", title: "Your yearly action", opensAt: "Opens at age 6", children: "One action a year." }));
  assert.match(locked, /data-step="action"/);
  assert.match(locked, /Opens at age 6/);
});

const idle = (over: Partial<IdleFacts> = {}): IdleFacts => ({ onGame: true, phase: "ready", playing: false, decisionOpen: false, tipOpen: false, ...over });

test("the idle hint points at what the game is waiting for, and never while it runs or over a tip", () => {
  assert.equal(IDLE_NUDGE_MS, 5000);
  assert.equal(idleNudge(idle())?.key, "resume");
  assert.deepEqual(idleNudge(idle())?.target, [".session-play"]);
  assert.equal(idleNudge(idle({ phase: "choice" }))?.key, "open-decision");
  assert.equal(idleNudge(idle({ decisionOpen: true }))?.key, "decision-options");
  assert.equal(idleNudge(idle({ playing: true })), null, "a running year needs nothing");
  assert.equal(idleNudge(idle({ tipOpen: true })), null, "never stacked on a tip");
  assert.equal(idleNudge(idle({ phase: "ended" })), null);
  assert.equal(idleNudge(idle({ onGame: false })), null);
});

test("How to Play steps use the same numbers as the screen and state when each opens", () => {
  const steps = howToPlaySteps({ focus: 6, action: 6, fields: 4, trade: 10 });
  assert.deepEqual(steps.map(step => step.id), [...SECTION_STEPS]);
  assert.deepEqual(steps.map(step => step.step), SECTION_STEPS.map(sectionStep));
  assert.equal(steps.find(step => step.id === "town")!.opens, "Trade at 10");
  assert.equal(steps.find(step => step.id === "time")!.opens, undefined, "time runs from birth");
  assert.equal(howToPlaySteps({ focus: Infinity, action: 6, fields: 4, trade: null }).find(step => step.id === "focus")!.opens, undefined);
  for (const step of steps) assert.ok(step.body.split(/(?<=[.!?])\s+/).length <= 3, `${step.id} stays short`);
  assert.match(YEAR_RHYTHM, /^Every year:/);
});

test("How to Play opens at every start unless the player switches it off", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  assert.equal(readHowToPlayAtStart(storage), true);
  writeHowToPlayAtStart(false, storage);
  assert.equal(data.get(HOW_TO_PLAY_STORAGE_KEY), "off");
  assert.equal(readHowToPlayAtStart(storage), false);
  writeHowToPlayAtStart(true, storage);
  assert.equal(readHowToPlayAtStart(storage), true);
  assert.equal(readHowToPlayAtStart({ getItem() { throw new Error("blocked"); }, setItem() {} }), true);
});
