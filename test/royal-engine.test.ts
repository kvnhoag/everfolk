import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, isRoyalLife, matchesCondition, ROYAL_METRICS, validateWorld } from "../src/index.ts";
import type { CharacterActivity, LifeAudience, RoyalMetric, StatDefinition, WorldPack } from "../src/types.ts";

function fixture(origin = "royal-household"): WorldPack {
  const action = (id: string, audience?: LifeAudience): CharacterActivity => ({
    id, text: id, category: "family", ...(audience ? { audience } : {}),
    outcomes: [{ id: `${id}-done`, text: "The action is complete.", weight: 1, effects: audience === "royal" ? [{ type: "royal", metric: "influence", delta: 20 }] : [] }],
  });
  return {
    schemaVersion: 1, id: "royal-test", version: "1", title: "Royal test", description: "Fictional route fixture.",
    startYear: -350, maxAge: 10, stats: { health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: origin, title: "A household", text: "A fictional birth.", weight: 1, effects: [] }],
    royalty: { originId: "royal-household", minAge: 2,
      metrics: Object.fromEntries(ROYAL_METRICS.map(metric => [metric, { label: metric, min: 0, max: 100, initial: 50 }])) as Record<RoyalMetric, StatDefinition>,
      yearlyEffects: [{ metric: "treasury", delta: -10 }],
    },
    yearlyEffects: [],
    yearlyRules: [{ id: "ordinary-upkeep", audience: "common", effects: [{ type: "stat", stat: "health", delta: -10 }] }],
    events: ["common", "royal"].map(audience => ({ id: `${audience}-event`, title: audience, text: "A route event.", audience: audience as LifeAudience,
      trigger: { type: "age", at: 1 }, mode: "automatic", choices: [], effects: [] })),
    endings: [{ id: "complete", title: "Complete", text: "The fixture ends." }], defaultEnding: "complete",
    character: {
      skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [],
      activities: [action("common-action", "common"), action("royal-action", "royal"), action("shared-action")],
      childNames: ["A"], deathCauseDescription: "Fictional.", deathCauses: [{ id: "illness", title: "Illness", text: "Fictional.", weight: 1 }],
    },
  };
}

test("royal opt-in initializes without consuming RNG and leaves retained origins unchanged", () => {
  const enabled = fixture(), legacy = fixture();
  delete legacy.royalty;
  legacy.character!.activities = legacy.character!.activities.filter(action => action.audience !== "royal");
  const life = createEngine(enabled).start("same-seed"), old = createEngine(legacy).start("same-seed");
  assert.equal(life.rngState, old.rngState);
  assert.deepEqual(life.royalty, Object.fromEntries(ROYAL_METRICS.map(metric => [metric, 50])));
  assert.equal(old.royalty, undefined);
  assert.equal(isRoyalLife(legacy, old), false);
});

test("route audiences gate events, listed activities and direct actions", () => {
  for (const royal of [true, false]) {
    const engine = createEngine(fixture(royal ? "royal-household" : "ordinary"));
    let life = engine.start("audience");
    assert.deepEqual(engine.getActivities(life).map(action => action.id), [royal ? "royal-action" : "common-action", "shared-action"]);
    assert.throws(() => engine.act(life, royal ? "common-action" : "royal-action"), /Activity is unavailable/);
    life = engine.advance(life);
    assert.ok(life.journal.some(entry => entry.id === `${royal ? "royal" : "common"}-event`));
    assert.ok(!life.journal.some(entry => entry.id === `${royal ? "common" : "royal"}-event`));
    assert.equal(life.stats.health, royal ? 80 : 70);
    assert.equal(life.royalty === undefined, !royal);
  }
});

test("royal effects clamp detached snapshots, annual upkeep starts at its minimum age, and saves replay", () => {
  const engine = createEngine(fixture());
  const initial = engine.start("royal-ledger");
  let life = engine.act(initial, "royal-action");
  assert.equal(initial.royalty!.influence, 50);
  assert.equal(life.royalty!.influence, 70);
  life = engine.advance(life);
  assert.equal(life.royalty!.treasury, 50);
  life = engine.act(life, "royal-action");
  life = engine.advance(life);
  assert.equal(life.royalty!.treasury, 40);
  life = engine.act(life, "royal-action");
  assert.equal(life.royalty!.influence, 100);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.ok(matchesCondition({ type: "royal", metric: "influence", op: "gte", value: 95 }, life));
  assert.equal(matchesCondition({ type: "royal", metric: "treasury", op: "eq", value: 0 }, createEngine(fixture("ordinary")).start("common")), false);
});

test("royal lives reject market orders through the engine without changing a snapshot", () => {
  const engine = createEngine(fixture()), life = engine.start("no-personal-trade");
  const before = JSON.stringify(life);
  assert.throws(() => engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 1 }), /Royal households delegate trade/);
  assert.equal(JSON.stringify(life), before);
});

test("royal config can remain dormant in reduced scenarios and validates exact metric names", () => {
  validateWorld(fixture("ordinary"));
  const missing = fixture();
  delete (missing.royalty!.metrics as Partial<Record<RoyalMetric, StatDefinition>>).security;
  assert.throws(() => validateWorld(missing), /security.*required/);
  const extra = fixture();
  (extra.royalty!.metrics as Record<string, StatDefinition>).unknown = extra.royalty!.metrics.security;
  assert.throws(() => validateWorld(extra), /unknown.*unknown field/);
  const nonfinite = fixture();
  nonfinite.royalty!.yearlyEffects[0].delta = Infinity;
  assert.throws(() => validateWorld(nonfinite), /finite number/);
  const audience = fixture();
  (audience.events[0] as { audience: string }).audience = "other";
  assert.throws(() => validateWorld(audience), /expected common or royal/);
});
