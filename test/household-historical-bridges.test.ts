import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import { historicalTitlePlans } from "../scripts/alexandria-historical-titles.mjs";
import { withoutMarketSignals } from "./fixture-features.ts";

type Plan = (typeof historicalTitlePlans)[number];
type Audience = "royal" | "aristocrat";
const originFor = (audience: Audience) => audience === "royal" ? "royal-household" : "estate-household";
const treasury = (life: LifeState, audience: Audience) => audience === "royal" ? life.royalty!.treasury : life.aristocracy!.treasury;
const awards = (choice: Choice, id: string) => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id));
const has = (life: LifeState, id: string) => life.accomplishments!.some(record => record.achievementId === id);

/** Real class identities and dated content, with unrelated incidents disabled. */
function fixture(audience: Audience, { plan, funds = 1_000, cash = 0, skills = 0 }: { plan?: Plan; funds?: number; cash?: number; skills?: number } = {}): WorldPack {
  const world = withoutMarketSignals(structuredClone(current) as WorldPack);
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = []; world.yearlyRules = []; delete world.knowledge;
  const required = [world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)];
  world.events = world.events.filter(event => required.includes(event.id) || plan && event.id.startsWith(`${audience}-historical-${plan.id}-`));
  for (const origin of world.origins) {
    origin.weight = origin.id === originFor(audience) ? 10_000 : 1;
    origin.effects = [];
    origin.statRanges = Object.fromEntries(Object.entries(world.stats).map(([id, definition]) => {
      const value = id === world.economy!.stat ? cash / world.economy!.unitsPerPoint : definition.max;
      return [id, { min: value, max: value }];
    }));
    delete origin.assetRanges;
  }
  for (const asset of world.economy!.assets) asset.initialRange = { min: 0, max: 0 };
  for (const definition of Object.values(world.character!.skills)) definition.initial = skills;
  for (const management of [world.royalty!, world.aristocracy!]) {
    management.yearlyEffects = [];
    management.metrics.treasury.initial = funds;
  }
  return world;
}

function birthFor(engine: LifeEngine, audience: Audience, prefix: string): LifeState {
  for (let index = 0; index < 256; index++) {
    const life = engine.start(`${prefix}-${index}`);
    if (life.originId === originFor(audience)) return life;
  }
  assert.fail(`The birth draw must reach ${originFor(audience)}.`);
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.phase === "ready" && life.age < target) life = engine.advance(life);
  assert.equal(life.age, target); assert.equal(life.phase, "ready");
  return life;
}

function activity(engine: LifeEngine, life: LifeState, id: string) {
  const item = engine.getActivities(life).find(item => item.id === id);
  assert.ok(item, id);
  return item;
}

test("household-funded lessons retain skill prerequisites and spend treasury while personal cash stays unchanged", () => {
  for (const audience of ["royal", "aristocrat"] as const) {
    const engine = createEngine(fixture(audience, { funds: 100 }));
    let life = ageTo(engine, birthFor(engine, audience, `funded-training-${audience}`), 14);
    assert.equal(life.economy!.cash, 0);
    const warfare = `${audience}-train-warfare`, craft = `${audience}-train-craft`;
    assert.equal(activity(engine, life, warfare).available, false);
    assert.ok(activity(engine, life, warfare).reason!.includes(`${engine.world.character!.skills.craft.label} 10`));
    assert.throws(() => engine.act(life, warfare), /requires.*10/i);
    assert.equal(engine.getActivities(life).some(item => item.id === "train-craft"), false);
    for (let lesson = 0; lesson < 2; lesson++) {
      const before = life;
      life = engine.act(life, craft);
      assert.equal(treasury(life, audience), treasury(before, audience) - 10);
      assert.deepEqual(life.economy, before.economy);
      assert.throws(() => engine.act(life, warfare), /year|activity/i);
      life = ageTo(engine, life, life.age + 1);
    }
    assert.equal(life.character!.skills.craft, 12, "The prerequisite is reached through two actual paid lessons.");
    assert.ok(activity(engine, life, warfare).available);
    const trained = engine.act(life, warfare);
    assert.equal(trained.character!.skills.warfare, 5);
    assert.equal(treasury(trained, audience), 70);
    assert.deepEqual(trained.economy, life.economy);
    assert.deepEqual(engine.replay(trained.seed, trained.commands), trained);
    assert.deepEqual(engine.load(engine.save(trained)), trained);

    const poorEngine = createEngine(fixture(audience, { funds: 0, cash: 1_000 }));
    const poor = ageTo(poorEngine, birthFor(poorEngine, audience, `unfunded-training-${audience}`), 14);
    assert.equal(poor.economy!.cash, 1_000);
    const seamanship = `${audience}-train-seamanship`;
    assert.equal(activity(poorEngine, poor, seamanship).available, false);
    assert.throws(() => poorEngine.act(poor, seamanship), /unavailable|treasury|fund/i);
  }
});

/** Convert the funding lane back only for comparing non-monetary story gates. */
function commonFunding(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(commonFunding);
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, commonFunding(entry)]));
  if ((result.type === "royal" || result.type === "aristocrat") && result.metric === "treasury") {
    result.type = "cash"; delete result.metric;
  }
  return result;
}

test("household historical funding preserves dates, accepted-work gates and historical outcomes", () => {
  const world = current as WorldPack;
  for (const audience of ["royal", "aristocrat"] as const) for (const plan of historicalTitlePlans) {
    const originals = world.events.filter(event => event.id.startsWith(`historical-${plan.id}-`));
    assert.equal(originals.length, plan.steps.length);
    for (const original of originals) {
      const copy = world.events.find(event => event.id === `${audience}-${original.id}`)!;
      assert.ok(copy, original.id); assert.equal(copy.audience, audience); assert.equal(original.audience, "common");
      assert.deepEqual(copy.trigger, original.trigger);
      assert.deepEqual(commonFunding(copy.when), original.when, "Skills, prior accomplishments and historical windows stay identical.");
      assert.equal(copy.maxOccurrences, original.maxOccurrences);
      assert.equal(copy.cooldownYears, original.cooldownYears);
      for (const choice of original.choices) {
        const funded = copy.choices.find(item => item.id === `${audience}-${choice.id}`)!;
        assert.ok(funded); assert.deepEqual(commonFunding(funded.when), choice.when);
        for (const outcome of choice.outcomes) {
          const accepted = funded.outcomes.find(item => item.id === `${audience}-${outcome.id}`)!;
          assert.ok(accepted); assert.equal(accepted.weight, outcome.weight);
          assert.deepEqual(commonFunding(accepted.effects), outcome.effects, "Funding cannot replace a completed task or alter its reward.");
        }
      }
    }
  }
});

function acceptedTitle(engine: LifeEngine, audience: Audience, plan: Plan) {
  for (let seed = 0; seed < 64; seed++) {
    let life = birthFor(engine, audience, `household-historical-${audience}-${plan.id}-${seed}`);
    const transitions: { before: LifeState; after: LifeState }[] = [];
    for (let guard = 0; guard < 250 && life.phase !== "ended" && life.year <= (plan.untilYear ?? engine.world.startYear + 90); guard++) {
      if (life.phase === "ready") { life = engine.advance(life); continue; }
      const choices = engine.getChoices(life);
      const recognition = choices.find(choice => awards(choice, plan.id));
      const task = recognition ?? choices.find(choice => choice.id.includes(`attempt-${plan.id}-`));
      assert.ok(task, `Expected a real ${audience} undertaking at ${life.pendingEventId}.`);
      const before = life;
      life = engine.choose(life, task.id);
      assert.deepEqual(life.economy, before.economy, "Historical household service leaves the personal ledger unchanged.");
      transitions.push({ before, after: life });
      if (recognition && has(life, plan.id)) return { before, after: life, transitions };
    }
  }
  assert.fail(`${audience}/${plan.id} must have an accepted dated route within the bounded seed sample.`);
}

test("royal and aristocratic lives can earn all eight historical titles through the original dated duties with no personal cash", () => {
  for (const audience of ["royal", "aristocrat"] as const) for (const plan of historicalTitlePlans) {
    const engine = createEngine(fixture(audience, { plan, skills: 100 }));
    const { before, after, transitions } = acceptedTitle(engine, audience, plan);
    assert.equal(after.economy!.cash, 0);
    assert.equal(has(before, plan.id), false);
    const title = after.accomplishments!.find(record => record.achievementId === plan.id)!;
    assert.equal(title.sourceId, before.pendingEventId);
    assert.ok(title.sourceId.startsWith(`${audience}-historical-${plan.id}-`));
    assert.deepEqual(title.figure, plan.figure);
    const records = after.accomplishments!.filter(record => record.figure?.id === plan.figure.id);
    assert.equal(records.length, plan.steps.length, "Every original accepted duty remains necessary before recognition.");
    for (let index = 1; index < records.length; index++) assert.ok(records[index].age - records[index - 1].age >= 1);
    assert.ok(records[0].year >= plan.fromYear);
    if (plan.untilYear !== undefined) assert.ok(title.year <= plan.untilYear);
    if (plan.steps.some(step => step.cost)) assert.ok(transitions.some(({ before, after }) => treasury(after, audience) < treasury(before, audience)),
      "A paid historical undertaking must debit the household treasury.");
    assert.deepEqual(engine.replay(after.seed, after.commands), after);
    assert.deepEqual(engine.load(engine.save(after)), after);
  }
});
