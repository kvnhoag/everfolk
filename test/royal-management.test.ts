import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { matchesCondition } from "../src/engine.ts";
import { isRoyalLife } from "../src/royalty.ts";
import { advanceYearWithFocus, availableYearlyFocuses, normalizeYearlyFocus } from "../client/models/yearly-focus.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { getArchivedBuiltinWorld } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";
import { getRoyalImpact } from "../client/models/choice-impact.ts";
import { getBirthRollStats, getVisibleBirthRollResources } from "../client/models/birth-stat-roll.ts";
import type { Choice, LifeEngine, LifeState, RoyalMetric, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.43.0.json" with { type: "json" };
import { withoutMoneylender } from "./fixture-features.ts";

const metrics: RoyalMetric[] = ["treasury", "influence", "stability", "security", "succession"];

/** A deterministic fixture isolates royal bookkeeping from health and random stories. */
function fixture(origin = "royal-household"): WorldPack {
  return {
    schemaVersion: 1, id: "royal-management", version: "1", title: "Royal household", description: "Fictional management rules.", startYear: -350, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 20 } }, flags: {},
    origins: [{ id: origin, title: "A household", text: "A fictional household.", weight: 1, effects: [] }], yearlyEffects: [],
    royalty: { originId: "royal-household", minAge: 2,
      metrics: Object.fromEntries(metrics.map(metric => [metric, { label: metric, min: 0, max: metric === "treasury" ? 1_000 : 100, initial: metric === "treasury" ? 100 : 50 }])) as NonNullable<WorldPack["royalty"]>["metrics"],
      yearlyEffects: [{ metric: "treasury", delta: 20 }, { metric: "stability", delta: -2 }, { metric: "security", delta: -1 }],
    },
    economy: { stat: "wealth", unitsPerPoint: 10, description: "Authored prices.", currency: { singular: "drachma", plural: "drachmas", short: "dr" },
      assets: [{ id: "grain", title: "Grain", description: "A stock of grain.", value: 2, initialRange: { min: 2, max: 2 }, yearlyIncome: 10 }],
      market: { minAge: 0, feePercent: 0, maxQuantity: 50, maxOrders: 8, goods: ["grain"], traderJob: "trader", traderYears: 3, traderFocusActivity: "focus-market-trading", shocks: [] },
    },
    yearlyRules: [{ id: "common-upkeep", audience: "common", effects: [{ type: "cash", delta: -5 }] }],
    character: {
      skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, partners: [], childNames: ["Child"],
      jobs: [{ id: "trader", title: "Trader", description: "Trade goods.", minAge: 0, yearlyEffects: [{ type: "cash", delta: 30 }] }],
      activities: [
        { id: "common-work", text: "Accept paid work", audience: "common", category: "career", outcomes: [{ id: "hired", text: "You take paid work.", weight: 1, effects: [{ type: "job", job: "trader" }] }] },
        { id: "focus-market-trading", text: "Spend the year trading", audience: "common", category: "career", outcomes: [{ id: "traded", text: "You make arrangements.", weight: 1, effects: [] }] },
        { id: "royal-spend", text: "Pay the household guard", audience: "royal", category: "career", minAge: 2, when: { type: "royal", metric: "treasury", op: "gte", value: 40 },
          outcomes: [{ id: "guard-paid", text: "The household guard receives its pay.", weight: 1, effects: [{ type: "royal", metric: "treasury", delta: -40 }, { type: "royal", metric: "security", delta: 10 }] }] },
        { id: "royal-gift", text: "Receive a family contribution", audience: "royal", category: "career", minAge: 2,
          outcomes: [{ id: "contribution", text: "A relative contributes to the treasury.", weight: 1, effects: [{ type: "royal", metric: "treasury", delta: 1_000 }, { type: "royal", metric: "influence", delta: 100 }] }] },
        { id: "rest", text: "Rest with the family", category: "family", outcomes: [{ id: "rested", text: "You rest.", weight: 1, effects: [] }] },
      ], deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
    },
    events: [
      { id: "birth", title: "Birth", text: "You are born.", trigger: { type: "age", at: 0 }, mode: "automatic", choices: [], effects: [] },
      { id: "ordinary-errand", audience: "common", title: "An ordinary errand", text: "An ordinary errand is offered.", trigger: { type: "age", at: 1 }, mode: "automatic", choices: [], effects: [{ type: "cash", delta: 7 }] },
      { id: "family-council", audience: "royal", title: "A family council", text: "The household council meets.", trigger: { type: "age", at: 1 }, mode: "automatic", choices: [], effects: [{ type: "royal", metric: "influence", delta: 2 }] },
    ],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  life = settle(engine, life);
  while (life.phase !== "ended" && life.age < target) life = settle(engine, engine.advance(life));
  assert.equal(life.age, target);
  assert.equal(life.phase, "ready");
  return life;
}

function royalBirth(engine: LifeEngine, prefix: string): LifeState {
  for (let index = 0; index < 4_096; index++) {
    const life = engine.start(`${prefix}-${index}`);
    if (life.originId === "royal-household") return life;
  }
  assert.fail("The ordinary birth draw must reach the rare royal origin.");
}

test("royal bookkeeping is opt-in, deterministic, and separate from personal wealth", () => {
  const world = fixture(), engine = createEngine(world), life = engine.start("royal-initial");
  assert.equal(isRoyalLife(engine.world, life), true);
  assert.deepEqual(life.royalty, Object.fromEntries(metrics.map(metric => [metric, world.royalty!.metrics[metric].initial])));
  assert.equal(life.economy!.cash, 200);
  assert.ok(Object.isFrozen(life.royalty));
  assert.equal(matchesCondition({ type: "royal", metric: "treasury", op: "gte", value: 100 }, life), true);
  const common = createEngine(fixture("home")).start("common-initial");
  assert.equal(common.royalty, undefined);
  assert.equal(matchesCondition({ type: "royal", metric: "treasury", op: "gte", value: 0 }, common), false);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("audience routing excludes ordinary work and events and cannot be bypassed by direct commands", () => {
  const royalEngine = createEngine(fixture()), royal = royalEngine.start("royal-routing");
  assert.equal(royalEngine.getActivities(royal).some(activity => activity.id === "common-work"), false);
  assert.equal(royalEngine.getActivities(royal).some(activity => activity.id === "rest"), true);
  assert.throws(() => royalEngine.act(royal, "common-work"), /unavailable|royal/i);
  assert.throws(() => royalEngine.orderMarket(royal, { side: "buy", asset: "grain", quantity: 1 }), /royal|household staff|council/i);
  const royalYear = royalEngine.advance(royal);
  assert.equal(royalYear.eventCounts["ordinary-errand"], undefined);
  assert.equal(royalYear.eventCounts["family-council"], 1);
  const commonEngine = createEngine(fixture("home")), common = commonEngine.start("common-routing");
  assert.equal(commonEngine.getActivities(common).some(activity => activity.id === "royal-spend"), false);
  assert.throws(() => commonEngine.act(common, "royal-spend"), /unavailable|royal/i);
  const commonYear = commonEngine.advance(common);
  assert.equal(commonYear.eventCounts["ordinary-errand"], 1);
  assert.equal(commonYear.eventCounts["family-council"], undefined);
  assert.equal(commonEngine.orderMarket(common, { side: "buy", asset: "grain", quantity: 1 }).economy!.market!.orders.length, 1);
});

test("royal and common random story lanes exclude the other audience before selection", () => {
  for (const origin of ["royal-household", "home"]) {
    const world = fixture(origin);
    world.events = world.events.filter(event => event.id === "birth");
    for (const audience of ["royal", "common"] as const) world.events.push({
      id: `random-${audience}`, audience, title: "A household story", text: "A story for this household.", trigger: { type: "random", weight: 1 }, mode: "automatic", choices: [], effects: [],
    });
    const engine = createEngine(world), next = engine.advance(engine.start(`random-lane-${origin}`));
    const own = origin === "royal-household" ? "royal" : "common", other = own === "royal" ? "common" : "royal";
    assert.equal(next.eventCounts[`random-${own}`], 1);
    assert.equal(next.eventCounts[`random-${other}`], undefined);
  }
});

test("royal annual accounts replace job pay, passive assets, and common household upkeep", () => {
  const engine = createEngine(fixture()), birth = engine.start("royal-year");
  const child = engine.advance(birth);
  assert.equal(child.royalty!.treasury, birth.royalty!.treasury, "Guardians handle accounts before the management age.");
  const adult = engine.advance(child);
  assert.equal(adult.royalty!.treasury, child.royalty!.treasury + 20);
  assert.equal(adult.royalty!.stability, child.royalty!.stability - 2);
  assert.equal(adult.royalty!.security, child.royalty!.security - 1);
  assert.equal(adult.economy!.cash, birth.economy!.cash, "Ordinary upkeep and asset income do not change royal personal cash.");
  const withJob = structuredClone(adult); withJob.character!.jobId = "trader";
  assert.equal(engine.advance(withJob).economy!.cash, adult.economy!.cash, "A stale job cannot create ordinary income on the royal route.");
  const commonEngine = createEngine(fixture("home")), hired = commonEngine.act(commonEngine.start("common-year"), "common-work");
  assert.equal(commonEngine.advance(hired).economy!.cash, hired.economy!.cash + 30 + 20 - 5 + 7);
});

test("council actions enforce age, treasury affordability, and the annual action budget", () => {
  const engine = createEngine(fixture()), birth = engine.start("royal-action");
  assert.throws(() => engine.act(birth, "royal-spend"), /age 2/);
  const adult = ageTo(engine, birth, 2), before = structuredClone(adult);
  const paid = engine.act(adult, "royal-spend");
  assert.equal(paid.royalty!.treasury, adult.royalty!.treasury - 40);
  assert.equal(paid.royalty!.security, adult.royalty!.security + 10);
  assert.deepEqual(adult, before, "Council actions must not mutate the previous snapshot.");
  assert.throws(() => engine.act(paid, "royal-gift"), /activity|year/i);
  const poorWorld = fixture(); poorWorld.royalty!.metrics.treasury.initial = 0; poorWorld.royalty!.yearlyEffects = [];
  const poorEngine = createEngine(poorWorld), poor = ageTo(poorEngine, poorEngine.start("poor-house"), 2);
  assert.equal(poorEngine.getActivities(poor).find(activity => activity.id === "royal-spend")!.available, false);
  assert.throws(() => poorEngine.act(poor, "royal-spend"), /unavailable/);
  assert.equal(poor.royalty!.treasury, 0);
});

test("royal gains respect metric bounds and accepted decisions replay through save/load", () => {
  const engine = createEngine(fixture()), adult = ageTo(engine, engine.start("royal-replay"), 2);
  let life = engine.act(adult, "royal-gift");
  assert.equal(life.royalty!.treasury, 1_000);
  assert.equal(life.royalty!.influence, 100);
  life = engine.act(engine.advance(life), "royal-spend");
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("yearly focuses reject a stale trading preference and accept a royal council action", () => {
  const world = fixture(), council = structuredClone(world.character!.activities[2]);
  council.id = "royal-hold-council"; world.character!.activities.push(council);
  const engine = createEngine(world), life = ageTo(engine, engine.start("royal-focus"), 2);
  assert.equal(normalizeYearlyFocus("trade", engine.world, life), "everyday");
  assert.equal(normalizeYearlyFocus("council", engine.world, life), "council");
  const focuses = availableYearlyFocuses(engine.world, life).map(focus => focus.id);
  assert.ok(focuses.includes("council")); assert.equal(focuses.includes("trade"), false);
  assert.deepEqual(advanceYearWithFocus(engine, life, "trade"), engine.advance(life));
  assert.deepEqual(advanceYearWithFocus(engine, life, "council"), engine.advance(engine.act(life, council.id)));
  const commonEngine = createEngine(fixture("home")), common = commonEngine.start("common-focus");
  assert.equal(normalizeYearlyFocus("trade", commonEngine.world, common), "trade");
  assert.equal(normalizeYearlyFocus("council", commonEngine.world, common), "everyday");
});

test("royal choice previews match bounded sequential engine effects without mutating a life", () => {
  const world = fixture(), engine = createEngine(world), life = ageTo(engine, engine.start("royal-preview"), 2);
  const choice: Choice = { id: "royal-preview", text: "Settle a household dispute", outcomes: [
    { id: "resources-returned", text: "Resources are returned.", weight: 1, effects: [{ type: "royal", metric: "treasury", delta: 1_000 }, { type: "royal", metric: "treasury", delta: -10 }, { type: "royal", metric: "security", delta: 100 }, { type: "royal", metric: "security", delta: -10 }] },
    { id: "record-closed", text: "The household record closes.", weight: 1, effects: [{ type: "royal", metric: "treasury", delta: -1_000 }, { type: "royal", metric: "treasury", delta: 10 }, { type: "end", ending: "complete" }, { type: "royal", metric: "influence", delta: 100 }] },
  ] };
  const saved = engine.save(life), originalChoice = structuredClone(choice), preview = getRoyalImpact(choice, life, world);
  assert.deepEqual(preview.map(impact => impact.id), ["treasury", "security"]);
  assert.deepEqual(preview.find(impact => impact.id === "treasury"), { id: "treasury", label: "treasury", min: 10 - life.royalty!.treasury, max: 990 - life.royalty!.treasury, variable: true });
  for (const outcome of choice.outcomes) {
    const branchWorld = fixture(); branchWorld.character!.activities.push({ ...choice, outcomes: [outcome], audience: "royal", category: "career", minAge: 2 });
    const branchEngine = createEngine(branchWorld), before = ageTo(branchEngine, branchEngine.start(life.seed), 2), after = branchEngine.act(before, choice.id);
    const direct = getRoyalImpact({ ...choice, outcomes: [outcome] }, before, branchWorld);
    for (const metric of metrics) {
      const impact = direct.find(candidate => candidate.id === metric), delta = after.royalty![metric] - before.royalty![metric];
      if (delta === 0) assert.equal(impact, undefined);
      else { assert.equal(impact!.min, delta); assert.equal(impact!.max, delta); }
    }
  }
  assert.equal(engine.save(life), saved);
  assert.deepEqual(choice, originalChoice);
});

test("royal validation rejects unknown metrics, incomplete balances, and malformed audiences", () => {
  assert.doesNotThrow(() => validateWorld(fixture()));
  const invalidEffect = fixture(); (invalidEffect.character!.activities[2].outcomes[0].effects[0] as any).metric = "renown";
  assert.throws(() => validateWorld(invalidEffect), /metric/);
  const invalidCondition = fixture(); (invalidCondition.character!.activities[2].when as any).metric = "renown";
  assert.throws(() => validateWorld(invalidCondition), /metric/);
  const missingBalance = fixture(); delete (missingBalance.royalty!.metrics as any).security;
  assert.throws(() => validateWorld(missingBalance), /security|metric/);
  for (const subject of ["activity", "event", "yearlyRule"]) {
    const world = fixture(), value = subject === "activity" ? world.character!.activities[0] : subject === "event" ? world.events[0] : world.yearlyRules![0];
    (value as any).audience = "everyone";
    assert.throws(() => validateWorld(world), /audience/);
  }
});

test("the shipped royal route has distinct council choices and filters ordinary life content", () => {
  const engine = createEngine(current), birth = royalBirth(engine, "royal-shipped");
  assert.ok(birth.royalty);
  assert.equal(birth.character!.jobId, null);
  assert.ok(engine.world.royalty);
  const actions = engine.getActivities(birth);
  for (const id of ["royal-hold-council", "royal-send-envoys", "royal-inspect-guard", "royal-hear-petitions", "royal-plan-succession", "royal-study-statecraft"]) {
    assert.ok(actions.some(activity => activity.id === id), id);
  }
  assert.ok(actions.every(activity => activity.audience !== "common"));
  assert.equal(actions.some(activity => activity.id === "focus-market-trading"), false);
  const moneyCard = getBirthRollStats(engine.world, birth).find(stat => stat.id === engine.world.economy!.stat)!;
  assert.equal(moneyCard.label, "Royal treasury"); assert.equal(moneyCard.value, birth.royalty!.treasury);
  assert.deepEqual(getVisibleBirthRollResources(engine.world, birth), []);
  assert.throws(() => engine.orderMarket(birth, { side: "buy", asset: engine.world.economy!.market!.goods[0], quantity: 1 }), /royal|household staff|council/i);
  assert.equal(engine.world.events.find(event => event.id === "household-royal-patronage-changes")!.audience, "royal");
  assert.deepEqual(engine.load(engine.save(birth)), birth);
});

test("a royal life keeps its council route through adulthood and old age without ordinary stories or jobs", () => {
  const world = withoutMoneylender(structuredClone(current) as WorldPack);
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  const engine = createEngine(world);
  let life = royalBirth(engine, "royal-lifetime-audit");
  while (life.age < 60 && life.phase !== "ended") {
    if (life.phase === "choice") {
      const choices = engine.getChoices(life), safe = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0];
      life = engine.choose(life, safe.id);
    } else {
      const activities = engine.getActivities(life);
      assert.ok(activities.every(activity => activity.audience !== "common"));
      if (activities.some(activity => activity.id === "royal-hold-council" && activity.available)) life = engine.act(life, "royal-hold-council");
      if (life.phase === "ready") life = engine.advance(life);
    }
  }
  assert.equal(life.age, 60);
  assert.equal(life.character!.jobId, null);
  assert.equal(life.economy!.market!.orders.length, 0);
  const events = new Map(world.events.map(event => [event.id, event]));
  const seenEvents = life.journal.filter(entry => entry.type === "event" && events.has(entry.id));
  assert.ok(seenEvents.every(entry => events.get(entry.id)!.audience !== "common"));
  assert.ok(seenEvents.some(entry => entry.id === "household-royal-patronage-changes"));
  assert.ok(seenEvents.some(entry => entry.id.startsWith("classical-")));
  assert.ok(seenEvents.some(entry => entry.id.startsWith("royal-meet-person-")));
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("retained royal-born lives keep their original trade route and exact replay", () => {
  const engine = createEngine(retained), birth = royalBirth(engine, "royal-retained");
  assert.equal(engine.world.version, "0.43.0");
  assert.equal(engine.world.royalty, undefined);
  assert.equal(birth.royalty, undefined);
  assert.equal(isRoyalLife(engine.world, birth), false);
  assert.ok(engine.getActivities(birth).some(activity => activity.id === "focus-market-trading"));
  assert.equal(getBirthRollStats(engine.world, birth).find(stat => stat.id === engine.world.economy!.stat)!.label, "Total wealth");
  assert.ok(getVisibleBirthRollResources(engine.world, birth).length > 0);
  assert.deepEqual(engine.load(engine.save(birth)), birth);
  assert.deepEqual(engine.replay(birth.seed, birth.commands), birth);
  assert.equal(engineForLife(birth).world.version, "0.43.0");
  assert.deepEqual(loadAnyLife(engine.save(birth)), birth);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(retained)}`)!.pack, retained);
});
