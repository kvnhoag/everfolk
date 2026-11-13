import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { isAristocratLife, isPrivilegedLife } from "../src/aristocracy.ts";
import { isRoyalLife } from "../src/royalty.ts";
import { getAristocratImpact } from "../client/models/choice-impact.ts";
import { availableYearlyFocuses, normalizeYearlyFocus, advanceYearWithFocus } from "../client/models/yearly-focus.ts";
import { getBirthRollStats, getVisibleBirthRollResources } from "../client/models/birth-stat-roll.ts";
import { contentFingerprint } from "../src/random.ts";
import type { AristocratMetric, LifeAudience, LifeEngine, LifeState, RoyalMetric, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.44.0.json" with { type: "json" };

const estateMetrics: AristocratMetric[] = ["treasury", "standing", "prosperity", "loyalty", "inheritance"];
const royalMetrics: RoyalMetric[] = ["treasury", "influence", "stability", "security", "succession"];

function fixture(origin = "estate-household"): WorldPack {
  return {
    schemaVersion: 1, id: "aristocrat-management", version: "1", title: "An estate household", description: "Fictional class-specific management.", startYear: -350, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 20 } }, flags: {},
    origins: [{ id: origin, title: "A household", text: "A fictional household.", weight: 1, effects: [] }], yearlyEffects: [],
    royalty: { originId: "royal-household", minAge: 2,
      metrics: Object.fromEntries(royalMetrics.map(metric => [metric, { label: metric, min: 0, max: metric === "treasury" ? 1_000 : 100, initial: 50 }])) as NonNullable<WorldPack["royalty"]>["metrics"],
      yearlyEffects: [{ metric: "treasury", delta: 20 }],
    },
    aristocracy: { originId: "estate-household", minAge: 2,
      metrics: Object.fromEntries(estateMetrics.map(metric => [metric, { label: metric, min: 0, max: metric === "treasury" ? 1_000 : 100, initial: metric === "treasury" ? 100 : 50 }])) as NonNullable<WorldPack["aristocracy"]>["metrics"],
      yearlyEffects: [{ metric: "treasury", delta: 25 }, { metric: "prosperity", delta: -1 }, { metric: "loyalty", delta: -1 }],
    },
    economy: { stat: "wealth", unitsPerPoint: 10, description: "Authored household prices.", currency: { singular: "drachma", plural: "drachmas", short: "dr" },
      assets: [{ id: "grain", title: "Grain", description: "Stored grain.", value: 2, initialRange: { min: 2, max: 2 }, yearlyIncome: 10 }],
      market: { minAge: 0, feePercent: 0, maxQuantity: 50, maxOrders: 8, goods: ["grain"], traderJob: "trader", traderYears: 3, traderFocusActivity: "focus-market-trading", shocks: [] },
    },
    yearlyRules: [
      { id: "common-upkeep", audience: "common", effects: [{ type: "cash", delta: -5 }] },
      { id: "productive-estates", audience: "aristocrat", when: { type: "all", conditions: [{ type: "age", op: "gte", value: 2 }, { type: "aristocrat", metric: "prosperity", op: "gte", value: 70 }] }, effects: [{ type: "aristocrat", metric: "treasury", delta: 10 }] },
      { id: "unsettled-tenants", audience: "aristocrat", when: { type: "all", conditions: [{ type: "age", op: "gte", value: 2 }, { type: "aristocrat", metric: "loyalty", op: "lt", value: 25 }] }, effects: [{ type: "aristocrat", metric: "treasury", delta: -15 }, { type: "aristocrat", metric: "standing", delta: -2 }] },
    ],
    character: {
      skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, partners: [], childNames: ["Child"],
      jobs: [{ id: "trader", title: "Trader", description: "Trade goods.", minAge: 0, yearlyEffects: [{ type: "cash", delta: 30 }] }],
      activities: [
        { id: "common-work", text: "Take paid work", audience: "common", category: "career", outcomes: [{ id: "hired", text: "You take paid work.", weight: 1, effects: [{ type: "job", job: "trader" }] }] },
        { id: "focus-market-trading", text: "Trade goods", audience: "common", category: "career", outcomes: [{ id: "trading", text: "You arrange trade.", weight: 1, effects: [] }] },
        { id: "royal-hold-council", text: "Hold a royal council", audience: "royal", category: "career", minAge: 2, outcomes: [{ id: "royal-council", text: "The royal council meets.", weight: 1, effects: [{ type: "royal", metric: "influence", delta: 3 }] }] },
        { id: "aristocrat-meet-stewards", text: "Meet your stewards", audience: "aristocrat", category: "career", minAge: 2, outcomes: [{ id: "stewards-met", text: "The estate officers explain their work.", weight: 1, effects: [{ type: "aristocrat", metric: "prosperity", delta: 3 }, { type: "aristocrat", metric: "loyalty", delta: 3 }] }] },
        { id: "aristocrat-improve-irrigation", text: "Improve estate irrigation", audience: "aristocrat", category: "career", minAge: 2, when: { type: "aristocrat", metric: "treasury", op: "gte", value: 60 },
          outcomes: [{ id: "irrigation-improved", text: "The estate's channels are improved.", weight: 1, effects: [{ type: "aristocrat", metric: "treasury", delta: -60 }, { type: "aristocrat", metric: "prosperity", delta: 12 }] }] },
        { id: "rest", text: "Rest with your family", category: "family", outcomes: [{ id: "rested", text: "You rest.", weight: 1, effects: [] }] },
      ], deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
    },
    events: [{ id: "birth", title: "Birth", text: "You are born.", trigger: { type: "age", at: 0 }, mode: "automatic", choices: [], effects: [] },
      ...(["common", "royal", "aristocrat"] as LifeAudience[]).map(audience => ({ id: `story-${audience}`, title: "A household story", text: "An event for this household.", audience,
        trigger: { type: "age" as const, at: 1 }, mode: "automatic" as const, choices: [], effects: [] })),
    ],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}

function birthFor(engine: LifeEngine, origin: string, prefix: string): LifeState {
  for (let index = 0; index < 2_048; index++) {
    const life = engine.start(`${prefix}-${index}`);
    if (life.originId === origin) return life;
  }
  assert.fail(`The birth draw must reach ${origin}.`);
}

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") {
    const choices = engine.getChoices(life);
    const choice = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0];
    life = engine.choose(life, choice.id);
  }
  return life;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  life = settle(engine, life);
  while (life.phase !== "ended" && life.age < target) life = settle(engine, engine.advance(life));
  assert.equal(life.age, target); assert.equal(life.phase, "ready");
  return life;
}

function healthyWorld(): WorldPack {
  const world: unknown = structuredClone(current);
  validateWorld(world);
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  return world;
}

test("new births give aristocratic and royal households their increased authored shares", () => {
  const engine = createEngine(current), world = engine.world;
  const total = world.origins.reduce((sum, origin) => sum + origin.weight, 0);
  assert.ok(Math.abs(world.origins.find(origin => origin.id === "estate-household")!.weight / total - .06) < 1e-12);
  assert.ok(Math.abs(world.origins.find(origin => origin.id === "royal-household")!.weight / total - .02) < 1e-12);
  const oldTotal = retained.origins.reduce((sum, origin) => sum + origin.weight, 0);
  assert.equal(retained.origins.find(origin => origin.id === "estate-household")!.weight / oldTotal, .03);
  assert.equal(retained.origins.find(origin => origin.id === "royal-household")!.weight / oldTotal, .01);
  const ordinary = world.origins.filter(origin => !["estate-household", "royal-household"].includes(origin.id));
  for (const origin of ordinary) {
    const old = retained.origins.find(item => item.id === origin.id)!;
    assert.ok(Math.abs(origin.weight / ordinary[0].weight - old.weight / retained.origins.find(item => item.id === ordinary[0].id)!.weight) < 1e-12, origin.id);
  }
});

test("aristocrats, royalty and ordinary households receive their own events and activities", () => {
  for (const [origin, own] of [["estate-household", "aristocrat"], ["royal-household", "royal"], ["home", "common"]] as const) {
    const engine = createEngine(fixture(origin)), birth = engine.start(`class-routing-${origin}`);
    assert.equal(isAristocratLife(engine.world, birth), own === "aristocrat");
    assert.equal(isRoyalLife(engine.world, birth), own === "royal");
    assert.equal(isPrivilegedLife(engine.world, birth), own !== "common");
    assert.equal(Boolean(birth.aristocracy), own === "aristocrat"); assert.equal(Boolean(birth.royalty), own === "royal");
    assert.ok(engine.getActivities(birth).every(activity => !activity.audience || activity.audience === own));
    const next = engine.advance(birth);
    for (const audience of ["common", "royal", "aristocrat"]) assert.equal(next.eventCounts[`story-${audience}`], audience === own ? 1 : undefined);
    if (own === "aristocrat") {
      assert.throws(() => engine.act(birth, "common-work"), /unavailable|household|estate|aristocrat/i);
      assert.throws(() => engine.act(birth, "royal-hold-council"), /unavailable|household|royal/i);
      assert.throws(() => engine.orderMarket(birth, { side: "buy", asset: "grain", quantity: 1 }), /estate|aristocrat|steward|household/i);
    }
    if (own === "common") assert.equal(engine.orderMarket(birth, { side: "buy", asset: "grain", quantity: 1 }).economy!.market!.orders.length, 1);
  }
});

test("estate receipts and tenant pressures replace ordinary wages and household upkeep", () => {
  const world = fixture(); world.aristocracy!.metrics.prosperity.initial = 75; world.aristocracy!.metrics.loyalty.initial = 20;
  const engine = createEngine(world), birth = engine.start("estate-finances"), child = engine.advance(birth), adult = engine.advance(child);
  assert.equal(child.aristocracy!.treasury, 100, "Relatives manage the estate before the route's minimum age.");
  assert.equal(adult.aristocracy!.treasury, 100 + 25 + 10 - 15);
  assert.equal(adult.aristocracy!.standing, 48);
  assert.equal(adult.economy!.cash, birth.economy!.cash, "Ordinary costs and passive asset income do not touch aristocratic personal cash.");
  const staleJob = structuredClone(adult); staleJob.character!.jobId = "trader";
  assert.equal(engine.advance(staleJob).economy!.cash, adult.economy!.cash, "An old ordinary job cannot create duplicate income.");
  const saved = engine.save(adult); assert.deepEqual(engine.load(saved), adult);
});

test("estate investment uses the treasury, improves prosperity and respects age and yearly limits", () => {
  const engine = createEngine(fixture()), birth = engine.start("estate-investment");
  assert.throws(() => engine.act(birth, "aristocrat-improve-irrigation"), /age 2/);
  const adult = ageTo(engine, birth, 2), before = structuredClone(adult), after = engine.act(adult, "aristocrat-improve-irrigation");
  assert.equal(after.aristocracy!.treasury, adult.aristocracy!.treasury - 60);
  assert.equal(after.aristocracy!.prosperity, adult.aristocracy!.prosperity + 12);
  assert.deepEqual(adult, before);
  assert.throws(() => engine.act(after, "aristocrat-meet-stewards"), /year|activity/i);
  const poorWorld = fixture(); poorWorld.aristocracy!.metrics.treasury.initial = 0; poorWorld.aristocracy!.yearlyEffects = [];
  const poorEngine = createEngine(poorWorld), poor = ageTo(poorEngine, poorEngine.start("poor-estate"), 2);
  assert.equal(poorEngine.getActivities(poor).find(activity => activity.id === "aristocrat-improve-irrigation")!.available, false);
  assert.throws(() => poorEngine.act(poor, "aristocrat-improve-irrigation"), /unavailable/);
  assert.equal(matchesCondition({ type: "aristocrat", metric: "treasury", op: "gte", value: 60 }, poor), false);
});

test("aristocratic focuses and bounded effect previews use estate actions rather than royal or trade actions", () => {
  const world = fixture(); world.aristocracy!.metrics.prosperity.initial = 95;
  const engine = createEngine(world), life = ageTo(engine, engine.start("estate-focus"), 2);
  const focuses = availableYearlyFocuses(engine.world, life).map(focus => focus.id);
  assert.ok(focuses.includes("estate")); assert.ok(focuses.includes("improvements"));
  assert.equal(focuses.includes("council"), false); assert.equal(focuses.includes("trade"), false);
  assert.equal(normalizeYearlyFocus("trade", engine.world, life), "everyday");
  assert.equal(normalizeYearlyFocus("council", engine.world, life), "everyday");
  assert.deepEqual(advanceYearWithFocus(engine, life, "estate"), engine.advance(engine.act(life, "aristocrat-meet-stewards")));
  const action = engine.getActivities(life).find(activity => activity.id === "aristocrat-improve-irrigation")!;
  const preview = getAristocratImpact(action, life, engine.world), after = engine.act(life, action.id);
  assert.equal(after.aristocracy!.prosperity, 100);
  assert.equal(preview.find(item => item.id === "prosperity")!.max, 6, "Previews show the remaining room at the cap, not the authored gain of twelve.");
  for (const metric of estateMetrics) {
    const delta = after.aristocracy![metric] - life.aristocracy![metric], effect = preview.find(item => item.id === metric);
    if (!delta) assert.equal(effect, undefined); else { assert.equal(effect!.min, delta); assert.equal(effect!.max, delta); }
  }
  assert.deepEqual(engine.load(engine.save(after)), after);
});

test("the shipped aristocrat path has its own estate systems, decisions and birth presentation", () => {
  const engine = createEngine(current), birth = birthFor(engine, "estate-household", "estate-shipped");
  assert.ok(birth.aristocracy); assert.equal(birth.royalty, undefined); assert.equal(birth.character!.jobId, null);
  assert.notDeepEqual(engine.world.aristocracy!.yearlyEffects, engine.world.royalty!.yearlyEffects);
  assert.deepEqual(Object.keys(engine.world.aristocracy!.metrics), estateMetrics);
  const actions = engine.getActivities(birth);
  for (const id of ["aristocrat-meet-stewards", "aristocrat-improve-irrigation", "aristocrat-settle-tenancy", "aristocrat-host-patrons", "aristocrat-collect-rents", "aristocrat-plan-inheritance", "aristocrat-study-estates", "aristocrat-sponsor-festival"]) assert.ok(actions.some(action => action.id === id), id);
  assert.ok(actions.every(action => action.audience !== "common" && action.audience !== "royal"));
  const moneyCard = getBirthRollStats(engine.world, birth).find(stat => stat.id === engine.world.economy!.stat)!;
  assert.equal(moneyCard.label, "Estate treasury"); assert.equal(moneyCard.value, birth.aristocracy!.treasury);
  assert.deepEqual(getVisibleBirthRollResources(engine.world, birth), []);
  assert.deepEqual(engine.load(engine.save(birth)), birth);
});

test("aristocratic rent collection and estate investment have different consequences", () => {
  const world = healthyWorld();
  for (const event of world.events) event.when = { type: "age", op: "lt", value: 0 };
  const engine = createEngine(world), life = ageTo(engine, birthFor(engine, "estate-household", "estate-actions"), 25);
  const collected = engine.act(life, "aristocrat-collect-rents"), invested = engine.act(life, "aristocrat-improve-irrigation");
  assert.ok(collected.aristocracy!.treasury > life.aristocracy!.treasury);
  assert.ok(collected.aristocracy!.loyalty < life.aristocracy!.loyalty);
  assert.ok(invested.aristocracy!.treasury < life.aristocracy!.treasury);
  assert.ok(invested.aristocracy!.prosperity > life.aristocracy!.prosperity);
  assert.equal(collected.economy!.cash, life.economy!.cash); assert.equal(invested.economy!.cash, life.economy!.cash);
  for (const branch of [collected, invested]) assert.deepEqual(engine.load(engine.save(branch)), branch);
});

test("an aristocratic life reaches later years without ordinary jobs, trade or royal-family stories", () => {
  const engine = createEngine(healthyWorld());
  let life = birthFor(engine, "estate-household", "estate-lifetime-audit");
  while (life.age < 60 && life.phase !== "ended") {
    if (life.phase === "choice") life = settle(engine, life);
    else {
      const actions = engine.getActivities(life);
      assert.ok(actions.every(action => action.audience !== "common" && action.audience !== "royal"));
      if (actions.some(action => action.id === "aristocrat-meet-stewards" && action.available)) life = engine.act(life, "aristocrat-meet-stewards");
      if (life.phase === "ready") life = engine.advance(life);
    }
  }
  assert.equal(life.age, 60); assert.equal(life.character!.jobId, null); assert.equal(life.economy!.market!.orders.length, 0);
  const events = new Map(engine.world.events.map(event => [event.id, event]));
  const recorded = life.journal.filter(entry => entry.type === "event" && events.has(entry.id));
  assert.ok(recorded.every(entry => events.get(entry.id)!.audience !== "common" && events.get(entry.id)!.audience !== "royal"));
  assert.ok(recorded.some(entry => events.get(entry.id)!.audience === "aristocrat"));
  assert.ok(recorded.some(entry => entry.id.startsWith("classical-")));
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("retained v0.44 estate and royal lives keep their original rules and registered saves", async () => {
  const { engineForLife, loadAnyLife } = await import("../client/lib/world-session.ts");
  const { getArchivedBuiltinWorld } = await import("../server/content.ts");
  const engine = createEngine(retained);
  assert.equal(engine.world.aristocracy, undefined);
  for (const origin of ["estate-household", "royal-household"]) {
    const birth = birthFor(engine, origin, "retained-estate-boundary");
    assert.equal(birth.aristocracy, undefined);
    assert.equal(Boolean(birth.royalty), origin === "royal-household");
    assert.equal(engine.getActivities(birth).some(activity => activity.id === "focus-market-trading"), origin === "estate-household");
    assert.deepEqual(engine.load(engine.save(birth)), birth);
    assert.equal(engineForLife(birth).world.version, "0.44.0");
    assert.deepEqual(loadAnyLife(engine.save(birth)), birth);
  }
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(retained)}`)!.pack, retained);
});
