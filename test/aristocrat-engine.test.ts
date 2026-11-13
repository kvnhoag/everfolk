import assert from "node:assert/strict";
import test from "node:test";
import { ARISTOCRAT_METRICS, createEngine, isAristocratLife, isPrivilegedLife, matchesCondition, validateWorld } from "../src/index.ts";
import type { AristocratMetric, LifeAudience, StatDefinition, WorldPack } from "../src/types.ts";

function fixture(origin = "estate-household"): WorldPack {
  return {
    schemaVersion: 1, id: "aristocrat-test", version: "1", title: "Estate test", description: "Fictional estate rules.",
    startYear: -350, maxAge: 10,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 }, wealth: { label: "Wealth", min: 0, max: 100, initial: 100 } }, flags: {},
    origins: [{ id: origin, title: "A household", text: "A fictional birth.", weight: 1, effects: [], assetRanges: { "estate-share": { min: 1, max: 1 } } }],
    aristocracy: { originId: "estate-household", minAge: 2,
      metrics: Object.fromEntries(ARISTOCRAT_METRICS.map(metric => [metric, { label: metric, min: 0, max: metric === "treasury" ? 1000 : 100, initial: metric === "treasury" ? 100 : 50 }])) as Record<AristocratMetric, StatDefinition>,
      yearlyEffects: [{ metric: "treasury", delta: 25 }, { metric: "loyalty", delta: -1 }],
    },
    royalty: { originId: "royal-household", minAge: 2,
      metrics: { treasury: { label: "Treasury", min: 0, max: 1000, initial: 500 }, influence: { label: "Influence", min: 0, max: 100, initial: 60 }, stability: { label: "Stability", min: 0, max: 100, initial: 60 }, security: { label: "Security", min: 0, max: 100, initial: 60 }, succession: { label: "Succession", min: 0, max: 100, initial: 20 } },
      yearlyEffects: [{ metric: "treasury", delta: 10 }],
    },
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored household ledger.",
      assets: [{ id: "estate-share", title: "Estate share", description: "An authored holding.", value: 20, maxOwned: 1, yearlyIncome: 20 }] },
    yearlyEffects: [], yearlyRules: [{ id: "ordinary-cost", audience: "common", effects: [{ type: "cash", delta: -10 }] }],
    events: (["common", "royal", "aristocrat"] as LifeAudience[]).map(audience => ({
      id: `${audience}-story`, title: "A household story", text: "A fictional household story.", audience, trigger: { type: "age", at: 1 }, mode: "automatic", choices: [], effects: [],
    })),
    endings: [{ id: "complete", title: "Complete", text: "The test ends." }], defaultEnding: "complete",
    character: { skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } },
      jobs: [{ id: "clerk", title: "Clerk", description: "Ordinary employment.", minAge: 0, yearlyEffects: [{ type: "cash", delta: 30 }] }], partners: [],
      activities: [
        { id: "ordinary-work", text: "Take ordinary work", audience: "common", category: "career", outcomes: [{ id: "ordinary-work-done", text: "You accept ordinary work.", weight: 1, effects: [{ type: "job", job: "clerk" }] }] },
        { id: "royal-action", text: "Attend the royal council", audience: "royal", category: "career", outcomes: [{ id: "royal-action-done", text: "The council meets.", weight: 1, effects: [{ type: "royal", metric: "influence", delta: 5 }] }] },
        { id: "estate-investment", text: "Improve the estate", audience: "aristocrat", category: "career", minAge: 2,
          when: { type: "aristocrat", metric: "treasury", op: "gte", value: 40 }, outcomes: [{ id: "estate-improved", text: "The estate's improvements are complete.", weight: 1, effects: [{ type: "aristocrat", metric: "treasury", delta: -40 }, { type: "aristocrat", metric: "prosperity", delta: 12 }] }] },
        { id: "shared-rest", text: "Rest with the family", category: "family", outcomes: [{ id: "shared-rest-done", text: "You rest.", weight: 1, effects: [] }] },
      ], childNames: ["A"], deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "Fictional.", weight: 1 }],
    },
  };
}

test("birth routes initialize distinct royal and aristocratic records and filter each other's events and actions", () => {
  for (const [origin, audience] of [["estate-household", "aristocrat"], ["royal-household", "royal"], ["ordinary", "common"]] as const) {
    const engine = createEngine(fixture(origin)), birth = engine.start("birth-route");
    assert.equal(isAristocratLife(engine.world, birth), audience === "aristocrat");
    assert.equal(isPrivilegedLife(engine.world, birth), audience !== "common");
    assert.equal(Boolean(birth.aristocracy), audience === "aristocrat");
    assert.equal(Boolean(birth.royalty), audience === "royal");
    assert.ok(engine.getActivities(birth).every(activity => !activity.audience || activity.audience === audience));
    const year = engine.advance(birth);
    assert.deepEqual(Object.keys(year.eventCounts), [`${audience}-story`]);
    assert.throws(() => engine.act(birth, audience === "aristocrat" ? "royal-action" : "estate-investment"), /unavailable/);
  }
});

test("estate finances replace ordinary upkeep and passive income without changing older worlds", () => {
  const engine = createEngine(fixture()), birth = engine.start("estate-income");
  const child = engine.advance(birth), adult = engine.advance(child);
  assert.equal(child.aristocracy!.treasury, 100);
  assert.equal(adult.aristocracy!.treasury, 125);
  assert.equal(adult.aristocracy!.loyalty, 49);
  assert.equal(adult.economy!.cash, birth.economy!.cash);
  assert.throws(() => engine.orderMarket(adult, { side: "buy", asset: "estate-share", quantity: 1 }), /Aristocratic households delegate trade/);
  const oldWorld = fixture(); delete oldWorld.aristocracy;
  oldWorld.character!.activities = oldWorld.character!.activities.filter(activity => activity.audience !== "aristocrat");
  const oldEngine = createEngine(oldWorld), oldBirth = oldEngine.start("estate-income");
  assert.equal(oldBirth.rngState, birth.rngState, "Aristocrat initialization consumes no RNG.");
  assert.equal(oldBirth.aristocracy, undefined);
  const hired = oldEngine.act(oldBirth, "ordinary-work"), paid = oldEngine.advance(hired);
  assert.equal(paid.economy!.cash, oldBirth.economy!.cash + 30 + 20 - 10);
});

test("estate decisions enforce age and funds, clone their ledger, and replay exactly", () => {
  const engine = createEngine(fixture()), birth = engine.start("estate-decision");
  assert.throws(() => engine.act(birth, "estate-investment"), /age 2/);
  const adult = engine.advance(engine.advance(birth)), before = structuredClone(adult);
  const improved = engine.act(adult, "estate-investment");
  assert.equal(improved.aristocracy!.treasury, 85);
  assert.equal(improved.aristocracy!.prosperity, 62);
  assert.deepEqual(adult, before);
  assert.ok(matchesCondition({ type: "aristocrat", metric: "prosperity", op: "gte", value: 60 }, improved));
  assert.throws(() => engine.act(improved, "estate-investment"), /activity.*year/);
  assert.deepEqual(engine.replay(improved.seed, improved.commands), improved);
  assert.deepEqual(engine.load(engine.save(improved)), improved);
  const poor = fixture(); poor.aristocracy!.metrics.treasury.initial = 0; poor.aristocracy!.yearlyEffects = [];
  const poorEngine = createEngine(poor), penniless = poorEngine.advance(poorEngine.advance(poorEngine.start("poor")));
  assert.throws(() => poorEngine.act(penniless, "estate-investment"), /unavailable/);
});

test("aristocratic configuration and effects reject malformed metrics, values and overlapping birth routes", () => {
  assert.doesNotThrow(() => validateWorld(fixture("ordinary")));
  const missing = fixture(); delete (missing.aristocracy!.metrics as Partial<Record<AristocratMetric, StatDefinition>>).loyalty;
  assert.throws(() => validateWorld(missing), /loyalty.*required/);
  const malformed = fixture(); malformed.aristocracy!.yearlyEffects[0].delta = NaN;
  assert.throws(() => validateWorld(malformed), /finite number/);
  const overlap = fixture(); overlap.aristocracy!.originId = overlap.royalty!.originId;
  assert.throws(() => validateWorld(overlap), /must differ/);
  const wrong = fixture(); (wrong.character!.activities[2].outcomes[0].effects[0] as { metric: string }).metric = "influence";
  assert.throws(() => validateWorld(wrong), /unknown aristocrat metric/);
});
