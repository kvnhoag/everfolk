import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { LifeState, WorldPack } from "../src/types.ts";
import { createEngine } from "../src/index.ts";
import { sectionAges, sectionFacts, visibleSections } from "../client/models/onboarding-sections.ts";
import { guidePointerDue, learnedTasks, openTasks, stillOngoing, yearGuideFacts, type GuideInput } from "../client/models/year-guide.ts";
import { yearTask } from "../client/models/year-reminder.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-11.json", import.meta.url), "utf8")) as WorldPack;

function lifeAt(age: number, seed = "year-guide"): LifeState {
  const engine = createEngine(world);
  let life = engine.start(seed);
  while ((life.age < age || life.phase === "choice") && life.phase !== "ended") {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

function input(life: LifeState, over: Partial<GuideInput> = {}): GuideInput {
  return { life, world, focusChosen: false, visitUsed: false, tipsOn: true, pointed: [], ...over };
}

test("learned steps come from the life itself: a chosen focus, a yearly action, a market visit, a field plan", () => {
  const life = lifeAt(7);
  assert.deepEqual(learnedTasks(life, false), []);
  assert.deepEqual(learnedTasks(life, true), ["focus"]);
  const acted = { ...life, journal: [...life.journal, { type: "activity" as const, age: 7, year: life.year, id: "train-literacy", text: "" }] };
  assert.deepEqual(learnedTasks(acted, false), ["action"]);
  const traded = { ...life, commands: [...life.commands, { type: "trade" as const, item: "grain" as const, side: "sell" as const, quantity: 1, counterparty: "merchant" as const }] };
  assert.deepEqual(learnedTasks(traded, false), ["market"]);
  const planned = { ...life, commands: [...life.commands, { type: "plan" as const, flaxPlots: 0 }] };
  assert.deepEqual(learnedTasks(planned, false), ["planting"]);
});

test("open steps follow the sections on screen and what is left this year", () => {
  const child = lifeAt(7);
  const sections = visibleSections(sectionFacts(world, child), sectionAges(world, child));
  assert.deepEqual(openTasks(child, sections, false), ["focus", "action"], "no market or fields at 7");
  const teen = lifeAt(16, "year-guide-teen");
  const teenSections = visibleSections(sectionFacts(world, teen), sectionAges(world, teen));
  assert.deepEqual(openTasks(teen, teenSections, false), ["focus", "action", "market", "planting"]);
  assert.deepEqual(openTasks(teen, teenSections, true), ["focus", "action", "planting"], "a used market visit is not open");
});

test("the pointer advances: focus, then the yearly action, then the market, then the fields, each once", () => {
  const pointed: string[] = [];
  const seen: string[] = [];
  for (const [age, seed] of [[7, "a"], [8, "b"], [13, "c"], [17, "d"], [18, "e"], [30, "f"]] as const) {
    const life = lifeAt(age, `year-guide-${seed}`);
    const pick = yearTask(yearGuideFacts(input(life, { focusChosen: age >= 8, pointed: pointed as never })));
    if (pick) { assert.equal(pick.reason, "learn"); pointed.push(pick.task); }
    seen.push(pick?.task ?? "-");
  }
  assert.deepEqual(seen, ["focus", "action", "market", "planting", "-", "-"], "focus is never named once it is set; nothing repeats");
});

test("a step is not pointed at in the year its tip introduces it, unless tips are off", () => {
  const six = lifeAt(6, "year-guide-six");
  assert.equal(yearTask(yearGuideFacts(input(six))), null, "at 6 the focus and action tips do the teaching");
  assert.equal(yearTask(yearGuideFacts(input(six, { tipsOn: false })))?.task, "focus", "tips off: the notice points at it");
});

test("Next decision stops for a pending first try, never for a step already learned or pointed at", () => {
  const seven = lifeAt(7, "year-guide-seven");
  assert.equal(guidePointerDue(input(seven)), true);
  assert.equal(guidePointerDue(input(seven, { focusChosen: true, pointed: ["action"] })), false);
  assert.equal(guidePointerDue(input(seven, { tipsOn: false })), false, "tips off: Next decision behaves as before");
});

test("a named problem stays quiet while it lasts and can be named again after it was solved", () => {
  assert.deepEqual(stillOngoing(["market", "planting"], { overfull: true, planProblem: false }), ["market"]);
  assert.deepEqual(stillOngoing(["market"], { overfull: false, planProblem: false }), []);
});
