import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import type { WorldPack } from "../src/types.ts";
import { lifeRoadmap, stageAges, worldUnlocks } from "../client/models/life-roadmap.ts";
import { nextTodo, yearChecklist, type YearFacts } from "../client/models/year-checklist.ts";
import { idleNudge, IDLE_NUDGE_MS, type IdleFacts } from "../client/models/idle-nudge.ts";
import { BAR_LEGEND, HOW_TO_WIN, howToPlayFacts, howToPlaySteps, YEAR_RHYTHM, YEAR_SCRIPT } from "../client/models/how-to-play.ts";
import { createEngine } from "../src/index.ts";
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
const { default: YearChecklist } = await import("../client/components/YearChecklist.tsx");
const { LockedSection, LockedArea } = await import("../client/components/Locked.tsx");
const { iconCells } = await import("../client/components/PixelIcon.tsx");
const { LifePage } = await import("../client/components/HowToPlayPages.tsx");
const { default: FarmGranary } = await import("../client/demo/FarmGranary.tsx");
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
  const locked = renderToStaticMarkup(createElement(LockedSection, { step: 3, id: "action", title: "Your yearly action", unlock: "Unlocks at age 6", note: "One action a year." }));
  assert.match(locked, /data-step="action"/);
  assert.match(locked, /class="locked-cross"/, "a locked section is crossed out");
  assert.match(locked, /class="locked-cover-unlock">Unlocks at age 6</);
});

test("a locked area greys out and disables its content under a cross and the unlock condition", () => {
  const open = renderToStaticMarkup(createElement(LockedArea, { locked: false, title: "Market & Trade", unlock: "Unlocks at age 10", children: createElement("button", null, "Sell") }));
  assert.equal(open, "<button>Sell</button>", "an open area renders as itself");
  const shut = renderToStaticMarkup(createElement(LockedArea, { locked: true, title: "Market & Trade", unlock: "Unlocks at age 10", children: createElement("button", null, "Sell") }));
  assert.match(shut, /class="locked-area-content" inert="" aria-hidden="true"><button>Sell<\/button>/);
  assert.match(shut, /Unlocks at age 10/);
  assert.match(shut, /class="locked-cross"/);
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
  assert.equal(steps.find(step => step.id === "town")!.opens, "Age 10");
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

test("the rule card states the goal, warns where people trip, and scripts the year in the engine's order", () => {
  assert.match(HOW_TO_WIN, /Reach 18/);
  const steps = howToPlaySteps({ focus: 6, action: 6, fields: 0, trade: 10 });
  assert.ok(steps.filter(step => step.warning).length >= 4, "the common mistakes carry a warning sign");
  assert.deepEqual(YEAR_SCRIPT.map(beat => beat.title), ["The year opens", "You act", "Turning points", "Harvest settled", "The town moves", "A year older"]);
  assert.deepEqual(YEAR_SCRIPT.filter(beat => beat.you).map(beat => beat.title), ["You act", "Turning points"]);
  const settled = YEAR_SCRIPT.find(beat => beat.title === "Harvest settled")!.detail;
  const order = ["Harvest", "rent", "wages", "eats", "spoils", "spun"].map(word => settled.indexOf(word));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "settlement reads in the engine's order (src/demo/settle.ts)");
});

test("How to Play shows real screens: every shot exists, captured sharp, and icons are real", () => {
  const steps = howToPlaySteps({ focus: 6, action: 6, fields: 4, trade: 10 });
  for (const shot of steps.map(step => step.shot)) {
    assert.ok(existsSync(new URL(`../public${shot.src}`, import.meta.url)), `${shot.src} is in public/`);
    assert.ok(shot.width > 0 && shot.height > 0 && shot.alt.length > 0, `${shot.src} has a size and alt text`);
    assert.equal(shot.width % 2, 0, `${shot.src} is captured at twice its shown size`);
  }
  for (const step of steps) assert.ok(step.result.length > 0 && step.example.length > 0, `${step.id} says what happens and gives an example`);
  assert.ok(BAR_LEGEND.length >= 10);
  for (const item of BAR_LEGEND) assert.ok(iconCells(item.icon), `${item.label} has a pixel icon`);
  for (const beat of YEAR_SCRIPT) assert.ok(iconCells(beat.icon), `${beat.title} has a pixel icon`);
});

test("How to Play examples use the player's own character and the world's real numbers", () => {
  const engine = createEngine(world);
  const life = engine.start("htp-facts");
  const facts = howToPlayFacts(world, life, "Lysimachos", 4);
  assert.equal(facts.secondsPerYear, 6);
  assert.ok(facts.household && facts.household.capacity > 0 && facts.household.mouths > 0);
  assert.equal(facts.study?.text, "Read and practise writing");
  assert.equal(facts.study?.gain, 6);
  const steps = howToPlaySteps({ focus: 6, action: 6, fields: 4, trade: 10 }, facts);
  const household = steps.find(step => step.id === "household")!.example;
  assert.match(household, new RegExp(`Lysimachos's household: ${facts.household!.mouths} people eat ${facts.household!.eating} grain`));
  assert.match(steps.find(step => step.id === "action")!.example, /Literacy \+6/);
  if (facts.sale) assert.match(steps.find(step => step.id === "town")!.example, new RegExp(`brings ${facts.sale.total} dr`));
});

test("Your life: every stage is a tab, and the chosen one opens its role, unlocks, actions and turning points", async () => {
  const { stageGuide } = await import("../client/models/stage-guide.ts");
  const stages = lifeRoadmap(world, 9);
  const guides = stages.map(stage => stageGuide(world, stage));
  const html = renderToStaticMarkup(createElement(LifePage, { stages, guides, portrait: { seed: "s", name: "Lysimachos" }, selected: "childhood", onSelect() {} }));
  assert.equal((html.match(/role="tab"/g) ?? []).length, stages.length, "each stage can be clicked");
  assert.match(html, /aria-selected="true"[^>]*class="htp-stage is-current is-selected"/);
  assert.match(html, /Your role\./);
  assert.match(html, /Opens in this stage/);
  assert.match(html, /Read and practise writing/);
  assert.match(html, /Turning points you may meet/);
});

test("Farm & Granary shows every number as an icon tile and locks planting until it opens", async () => {
  const { createEngine } = await import("../src/index.ts");
  const { demoScreen } = await import("../client/demo/screen.ts");
  const engine = createEngine(world);
  const life = engine.start("farm-tiles");
  const screen = demoScreen(world, life)!;
  const html = renderToStaticMarkup(createElement(FarmGranary, { screen, world, age: 0, cashText: "70 dr", holding: () => 0, onPlan: () => null, plantingLockedUntil: 4 }));
  for (const label of ["Store", "Mouths", "Next harvest", "Rent", "Eating", "Spoilage", "Cash", "Grain plots", "Flax plots", "Oxen", "Donkeys"]) {
    assert.match(html, new RegExp(`<li class="farm-tile[^"]*"[^>]*><svg[^>]*class="pixel-icon[\\s\\S]*?<span class="farm-tile-label">${label}</span>`), `${label} has an icon tile`);
  }
  assert.match(html, /Unlocks at age 4/);
  assert.doesNotMatch(html, />Set planting</, "no planting button before it opens");
});
