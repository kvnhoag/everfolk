import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEngine, demoWorld, liveUntil, withDemo } from "./fixtures/demo/world.ts";
import { demoContext } from "../src/demo/state.ts";
import {
  applyWork, changeReputation, illnessReliefBps, isBuilt, learningDiscountBps, recoveryBonusBps, spoilageCutBps, workUseCost, worksView,
} from "../src/demo/works.ts";
import { BENEFACTOR_FIRST_WORK, BENEFACTOR_PRESTIGE, BENEFACTOR_ROUTE, DEDICATE_ACTIVITY, HONOUR_ACTIVITY, buildActivityId, WORKS_CONTENT } from "../src/demo/content/works.ts";
import { WORKS } from "../src/demo/types.ts";
import type { DemoState, WorkId } from "../src/demo/types.ts";
import type { Condition, Effect, LifeState } from "../src/types.ts";

const engine = demoEngine();
const world = engine.world;
const def = world.demo!;

let adultCache: LifeState | undefined;
function adult(): LifeState {
  return adultCache ??= liveUntil(engine, "works-seed", state => state.age >= 20 && state.phase === "ready");
}

function draft(patch: (demo: DemoState) => void = () => {}) {
  const life = withDemo(adult(), patch);
  const applied: Effect[] = [];
  const lines: { id: string; text: string }[] = [];
  const ctx = demoContext(world, life, effects => { applied.push(...effects); }, (id, text) => { lines.push({ id, text }); });
  return { life, ctx, applied, lines };
}

/** A real adult demo life that heads its plot and can afford the works. */
function headOfPlot(life: LifeState = adult(), cash = 3_000, grain = 1_200): LifeState {
  const copy = structuredClone(life) as LifeState & { demo: DemoState };
  copy.demo.household.headSinceAge = copy.age - 1;
  copy.demo.household.grain = grain;
  copy.economy!.cash = cash;
  return copy;
}

function nextYear(life: LifeState): LifeState {
  const age = life.age;
  let next = life;
  for (let step = 0; step < 50 && (next.age === age || next.phase === "choice") && next.phase !== "ended"; step++) {
    next = next.phase === "choice" ? engine.choose(next, engine.getChoices(next)[0].id) : engine.advance(next);
  }
  assert.notEqual(next.phase, "ended");
  return next;
}

function mentions(condition: Condition | undefined, kind: string): boolean {
  if (!condition) return false;
  if (condition.type === "demo") return condition.condition.kind === kind;
  if (condition.type === "all" || condition.type === "any") return condition.conditions.some(child => mentions(child, kind));
  if (condition.type === "not") return mentions(condition.condition, kind);
  return false;
}

test("a work needs `progress` yearly build activities, each paying its share of cash and grain", () => {
  const work: WorkId = "well";
  const needed = def.works.works[work].progress;
  const cost = workUseCost(def, work);
  assert.deepEqual(cost, { cash: Math.round(def.works.works[work].cash / needed), grain: Math.round(def.works.works[work].grain / needed) });
  let life = headOfPlot();
  const reputation = life.demo!.reputation;
  for (let use = 1; use <= needed; use++) {
    const cash = life.economy!.cash, grain = life.demo!.household.grain;
    life = engine.act(life, buildActivityId(work));
    assert.equal(cash - life.economy!.cash, cost.cash, "cash cost per use");
    assert.equal(grain - life.demo!.household.grain, cost.grain, "grain cost per use");
    assert.equal(life.demo!.works[work], use);
    assert.equal(isBuilt(life.demo!, work), use === needed);
    if (use < needed) {
      assert.equal(engine.getActivities(life).find(activity => activity.id === buildActivityId(work))?.available, false, "once a year");
      life = nextYear(life);
    }
  }
  assert.deepEqual(life.demo!.built, [work]);
  assert.equal(life.demo!.reputation, Math.min(def.works.reputation.max, reputation + def.works.works[work].reputation));
  assert.equal(life.journal.filter(entry => entry.id === `work-${work}-built`).length, 1, "completion is journalled once");
  assert.ok(life.journal.some(entry => entry.id === "reputation-change" && entry.text.includes(def.works.works[work].title.toLowerCase())));
  const build = engine.getActivities(life).find(activity => activity.id === buildActivityId(work));
  assert.equal(build?.available, false, "a finished work cannot be built again");

  // The benefactor accomplishment is awarded once, on dedicating the finished work (same year).
  const dedicate = engine.getActivities(life).find(activity => activity.id === DEDICATE_ACTIVITY);
  assert.equal(dedicate?.available, true, dedicate?.reason);
  life = engine.act(life, DEDICATE_ACTIVITY);
  const records = life.accomplishments!.filter(record => record.routeId === BENEFACTOR_ROUTE);
  assert.deepEqual(records.map(record => record.achievementId), [BENEFACTOR_FIRST_WORK]);
  assert.equal(records[0].sourceId, DEDICATE_ACTIVITY);
  assert.equal(engine.getActivities(life).find(activity => activity.id === DEDICATE_ACTIVITY)?.available, false);
});

test("a second finished work opens the prestige honour, awarded once", () => {
  let life = headOfPlot();
  for (let use = 0; use < def.works.works.well.progress; use++) {
    life = engine.act(life, buildActivityId("well"));
    if (!isBuilt(life.demo!, "well")) life = nextYear(life);
  }
  life = engine.act(life, DEDICATE_ACTIVITY);
  assert.equal(engine.getActivities(life).find(activity => activity.id === HONOUR_ACTIVITY)?.available, false, "one work is not enough");
  const patched = structuredClone(life) as LifeState & { demo: DemoState };
  patched.demo.built.push("granary");
  patched.demo.works.granary = def.works.works.granary.progress;
  const honour = engine.getActivities(patched).find(activity => activity.id === HONOUR_ACTIVITY);
  assert.equal(honour?.available, true, honour?.reason);
  const honoured = engine.act(patched, HONOUR_ACTIVITY);
  assert.deepEqual(honoured.accomplishments!.filter(record => record.routeId === BENEFACTOR_ROUTE).map(record => record.achievementId),
    [BENEFACTOR_FIRST_WORK, BENEFACTOR_PRESTIGE]);
  assert.equal(engine.getActivities(honoured).find(activity => activity.id === HONOUR_ACTIVITY)?.available, false);
});

test("build activities need the head of the plot, enough grain and an unfinished work", () => {
  const notHead = structuredClone(headOfPlot()) as LifeState & { demo: DemoState };
  notHead.demo.household.headSinceAge = null;
  assert.equal(engine.getActivities(notHead).find(activity => activity.id === buildActivityId("granary"))?.available, false);
  const noGrain = headOfPlot(adult(), 3_000, 0);
  assert.equal(engine.getActivities(noGrain).find(activity => activity.id === buildActivityId("granary"))?.available, false);
  const noCash = headOfPlot(adult(), 0, 1_200);
  assert.equal(engine.getActivities(noCash).find(activity => activity.id === buildActivityId("granary"))?.available, false);
  const able = headOfPlot();
  for (const work of WORKS) assert.equal(engine.getActivities(able).find(activity => activity.id === buildActivityId(work))?.available, true, work);
});

test("applyWork adds progress, completes once, raises reputation and gives the one-off completion effect", () => {
  const { ctx, life, applied, lines } = draft();
  const start = life.demo.reputation;
  const needed = def.works.works.granary.progress;
  for (let i = 1; i < needed; i++) applyWork(ctx, { kind: "work", work: "granary", progress: 1 });
  assert.equal(life.demo.works.granary, needed - 1);
  assert.deepEqual(life.demo.built, []);
  assert.equal(applied.length, 0);
  applyWork(ctx, { kind: "work", work: "granary", progress: 5 });
  assert.equal(life.demo.works.granary, needed, "progress is capped at the work's size");
  assert.deepEqual(life.demo.built, ["granary"]);
  assert.equal(life.demo.reputation, start + def.works.works.granary.reputation);
  assert.ok(lines.some(line => line.id === "work-granary-built" && line.text.includes(def.works.works.granary.title)));
  const bonus = def.works.completionStats?.granary ?? {};
  assert.ok(Object.keys(bonus).length > 0, "each work has a one-off completion effect");
  assert.deepEqual(applied, Object.entries(bonus).map(([stat, delta]) => ({ type: "stat", stat, delta })));
  const after = structuredClone(life.demo);
  applyWork(ctx, { kind: "work", work: "granary", progress: 1 });
  assert.deepEqual(life.demo, after, "a finished work is not finished twice");
  assert.equal(applied.length, Object.keys(bonus).length);
});

test("every work has a one-off health or bonds effect on completion", () => {
  for (const work of WORKS) {
    const stats = def.works.completionStats?.[work] ?? {};
    assert.ok(Object.keys(stats).length > 0, work);
    for (const stat of Object.keys(stats)) assert.ok(stat in world.stats, `${work}: ${stat}`);
  }
});

test("reputation stays within bounds and journals the reason only when it changes", () => {
  const { min, max } = def.works.reputation;
  const { ctx, life, lines } = draft(demo => { demo.reputation = max - 2; });
  changeReputation(ctx, 10, "shared grain in a famine");
  assert.equal(life.demo.reputation, max);
  assert.equal(lines.length, 1);
  assert.match(lines[0].text, /shared grain in a famine/);
  changeReputation(ctx, 5, "fair trading");
  assert.equal(life.demo.reputation, max);
  assert.equal(lines.length, 1, "no line when nothing changes");
  changeReputation(ctx, -1_000, "hoarded grain while neighbours starved");
  assert.equal(life.demo.reputation, min);
  assert.equal(lines.length, 2);
  assert.match(lines[1].text, /hoarded grain while neighbours starved/);
  changeReputation(ctx, 0, "nothing");
  assert.equal(lines.length, 2);
  assert.throws(() => changeReputation(ctx, 1.5, "half"), /whole number/);
  assert.equal(life.demo.reputation, min);
});

test("hoarding and sharing deltas name their reason in the life record", () => {
  const { ctx, life, lines } = draft(demo => { demo.reputation = 30; });
  changeReputation(ctx, 3, "shared grain with hungry neighbours");
  changeReputation(ctx, -4, "kept a full store while neighbours went hungry");
  assert.equal(life.demo.reputation, 29);
  assert.match(lines[0].text, /rises/);
  assert.match(lines[0].text, /shared grain with hungry neighbours/);
  assert.match(lines[1].text, /falls/);
  assert.match(lines[1].text, /kept a full store while neighbours went hungry/);
});

test("a built granary cuts spoilage, a school discounts learning, a well and healing house help health", () => {
  const none = draft().life.demo;
  assert.equal(spoilageCutBps(def, none), 0);
  assert.equal(learningDiscountBps(def, none), 0);
  assert.equal(illnessReliefBps(def, none), 0);
  assert.equal(recoveryBonusBps(def, none), 0);
  const all = draft(demo => { demo.built = [...WORKS]; }).life.demo;
  assert.equal(spoilageCutBps(def, all), def.works.granarySpoilageCutBps);
  assert.equal(learningDiscountBps(def, all), def.works.schoolDiscountBps);
  assert.equal(illnessReliefBps(def, all), def.works.wellIllnessReliefBps);
  assert.equal(recoveryBonusBps(def, all), def.works.healingRecoveryBonusBps);
  assert.ok(def.works.wellIllnessReliefBps! > 0 && def.works.healingRecoveryBonusBps! > 0);
  const granaryOnly = draft(demo => { demo.built = ["granary"]; }).life.demo;
  assert.equal(spoilageCutBps(def, granaryOnly), def.works.granarySpoilageCutBps);
  assert.equal(learningDiscountBps(def, granaryOnly), 0);
});

test("worksView reports progress and costs without changing the life", () => {
  const { life } = draft(demo => { demo.works.school = 1; demo.built = ["well"]; demo.works.well = 2; });
  const before = JSON.stringify(life);
  const view = worksView(def, life);
  assert.equal(JSON.stringify(life), before);
  assert.equal(view.reputation, life.demo.reputation);
  const school = view.works.find(work => work.id === "school")!;
  assert.equal(school.progress, 1);
  assert.equal(school.needed, def.works.works.school.progress);
  assert.equal(school.built, false);
  assert.deepEqual({ cash: school.useCash, grain: school.useGrain }, workUseCost(def, "school"));
  assert.equal(view.works.find(work => work.id === "well")!.built, true);
});

test("works content: a build activity per work, a benefactor route and reputation-gated opportunities", () => {
  for (const work of WORKS) {
    const activity = world.character!.activities.find(item => item.id === buildActivityId(work));
    assert.ok(activity, work);
    assert.ok(["career", "family"].includes(activity.category));
    assert.ok(mentions(activity.when, "head-of-plot") && mentions(activity.when, "work"));
    const effects = activity.outcomes.flatMap(outcome => outcome.effects);
    assert.ok(effects.some(effect => effect.type === "demo" && effect.effect.kind === "work" && effect.effect.work === work && effect.effect.progress === 1));
    assert.ok(effects.some(effect => effect.type === "demo" && effect.effect.kind === "grain" && effect.effect.delta === -workUseCost(def, work).grain));
    assert.ok(effects.some(effect => effect.type === "cash" && effect.delta === -workUseCost(def, work).cash));
  }
  const route = world.legacy!.routes.find(item => item.id === BENEFACTOR_ROUTE)!;
  assert.deepEqual(route.achievementIds, [BENEFACTOR_FIRST_WORK, BENEFACTOR_PRESTIGE]);
  const kinds = route.achievementIds.map(id => world.legacy!.achievements.find(item => item.id === id)!.kind);
  assert.deepEqual(kinds, ["ordinary", "prestige"]);
  assert.ok(!def.availability.unavailableAccomplishments.includes(BENEFACTOR_FIRST_WORK));
  const gated = (WORKS_CONTENT.events ?? []).filter(event => mentions(event.when, "reputation"));
  assert.ok(gated.length >= 2 && gated.length <= 3);
  for (const event of gated) assert.ok(world.events.some(item => item.id === event.id));
});
