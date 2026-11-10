import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { getNetWorth } from "../src/economy.ts";
import { getChoiceImpact } from "../client/choice-impact.ts";
import { getOpportunityPreview } from "../src/outcomes.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.20.0.json" with { type: "json" };

/** Isolate lending from unrelated mortality, income and personal decisions. */
function fixture(startingWealth = 0): WorldPack {
  const world = structuredClone(current) as WorldPack;
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = []; world.yearlyRules = [];
  const events = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => events.has(event.id));
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = { health: { min: 80, max: 80 }, wealth: { min: startingWealth, max: startingWealth }, bonds: { min: 40, max: 40 } };
  }
  world.character!.activities.push({ id: "spend-loan-cash", text: "Spend the borrowed cash", category: "finance", usesYearlyActivity: false,
    outcomes: [{ id: "spent-loan-cash", text: "The cash is spent.", weight: 1, effects: [{ type: "cash", delta: -100 }] }] });
  return world;
}
function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) {
    assert.equal(life.phase, "ready", `Unexpected pending event ${life.pendingEventId} at age ${life.age}.`);
    life = engine.advance(life);
  }
  return life;
}
function defaultsToConfrontation(engine: LifeEngine, seed: string): LifeState {
  let life = ageTo(engine, engine.start(seed), 18);
  life = engine.act(life, "borrow-moneylender");
  life = engine.act(life, "spend-loan-cash");
  life = ageTo(engine, life, 21);
  assert.equal(life.pendingEventId, "lender-payment-due");
  life = engine.choose(life, "delay-moneylender-payment");
  life = ageTo(engine, life, 22);
  assert.equal(life.pendingEventId, "lender-threat");
  life = engine.choose(life, "ignore-lender-threat");
  life = ageTo(engine, life, 23);
  assert.equal(life.pendingEventId, "lender-threat");
  life = engine.choose(life, "ignore-lender-threat");
  life = ageTo(engine, life, 24);
  assert.equal(life.pendingEventId, "lender-confrontation");
  return life;
}

test("the new loan route preserves adult mortality, childhood and old credit-free packs", () => {
  // Original lending-release invariants predate the historical setting rewrite.
  const current = retained;
  assert.equal(current.version, "0.31.0");
  assert.deepEqual(current.health, previous.health);
  assert.deepEqual(current.mortality, previous.mortality);
  assert.deepEqual(current.origins, previous.origins);
  assert.equal("moneylender" in previous.economy, false);
  assert.deepEqual(current.economy.moneylender, {
    title: "Harbor moneylender", principal: 100, fee: 30, termYears: 3,
    threatAfterYears: 1, attackAfterYears: 3, extensionYears: 2, extensionFee: 20, maxExtensions: 1,
    events: { due: "lender-payment-due", threat: "lender-threat", attack: "lender-confrontation" },
  });
  const source = current.sources.find(source => source.id === "alexandrian-loan-contract")!;
  assert.equal(source.kind, "primary");
  assert.match(source.limitations, /do not.*support violent collectors, murder/);
  for (const event of current.events.filter(event => event.id.startsWith("lender-"))) assert.equal(event.evidence, "fictional");
  assert.equal(current.events.find(event => event.id === "lender-offer")!.choices[0].id, "decline-moneylender-offer", "Auto must not accept a new dangerous loan by default.");
});

test("only an explicit adult loan creates the liability and early settlement prevents collectors", () => {
  const engine = createEngine(fixture(50));
  let life = ageTo(engine, engine.start("settled-lender"), 17);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "borrow-moneylender")!.available, false);
  life = ageTo(engine, life, 18);
  const before = getNetWorth(engine.world, life);
  life = engine.act(life, "borrow-moneylender");
  assert.equal(life.economy!.loan!.balance, 130);
  assert.equal(life.economy!.loan!.dueAge, 21);
  assert.equal(getNetWorth(engine.world, life), before - 30);
  assert.equal(life.character!.lastActivityAge, null, "Accepting the contract does not spend the major activity.");
  life = engine.act(life, "repay-moneylender");
  assert.equal(life.economy!.loan, undefined);
  assert.equal(life.economy!.debt, 0);
  life = ageTo(engine, life, 28);
  assert.equal(life.journal.some(entry => Object.values(engine.world.economy!.moneylender!.events).includes(entry.id)), false);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("unpaid borrowing progresses through demands and threats before disclosed fatal confrontation", () => {
  const engine = createEngine(fixture());
  let fatal: LifeState | undefined;
  for (let seed = 0; seed < 128 && !fatal; seed++) {
    const life = defaultsToConfrontation(engine, `collector-default-${seed}`);
    const choices = engine.getChoices(life);
    assert.equal(choices.some(choice => choice.id === "settle-lender-confrontation"), false, "Cash-free borrowers cannot mint a settlement.");
    assert.equal(choices.some(choice => choice.id === "part-pay-lender-confrontation"), false);
    const refuse = choices.find(choice => choice.id === "refuse-collectors")!;
    const run = choices.find(choice => choice.id === "run-from-collectors")!;
    assert.ok(Math.abs(getChoiceImpact(refuse, life, engine.world).deathRisk - .05) < 1e-12);
    assert.ok(Math.abs(getChoiceImpact(run, life, engine.world).deathRisk - .03) < 1e-12);
    const next = engine.choose(life, refuse.id);
    if (next.phase !== "ended") continue;
    assert.equal(next.deathCauseId, "moneylender-stabbing");
    assert.equal(next.endingId, "death-by-collector", "The ending does not misclassify an older borrower as an adult-age natural death.");
    assert.equal(next.deathCauseKind, "choice");
    assert.match(next.deathCauseContext!, /Refuse to pay.*stabs you in the chest/);
    assert.deepEqual(engine.replay(next.seed, next.commands), next);
    fatal = next;
  }
  assert.ok(fatal, "A disclosed refusal branch can cause its exact named death.");
  const cause = current.character.deathCauses.find(cause => cause.id === "moneylender-stabbing")!;
  assert.equal(cause.title, "Stab wound to the chest");
  assert.equal(cause.choiceOnly, true);
});

test("intercession improves with local support and preserves a nonfatal-immediate fallback", () => {
  const engine = createEngine(fixture());
  const life = structuredClone(defaultsToConfrontation(engine, "collector-intercession"));
  const plead = engine.getChoices(life).find(choice => choice.id === "ask-neighbors-to-intercede")!;
  const baseline = getOpportunityPreview(engine.world, life, plead)!.probability;
  life.stats.bonds = 70; life.character!.skills.oratory = 30;
  const improved = getOpportunityPreview(engine.world, life, plead)!.probability;
  assert.ok(improved > baseline && improved < 1);
  assert.equal(getChoiceImpact(plead, life, engine.world).deathRisk, 0);
  assert.ok(plead.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "condition" && effect.condition === "open-leg-fracture")));
});

test("a single extension adds its stated charge and moves the real deadline", () => {
  const engine = createEngine(fixture());
  let life = ageTo(engine, engine.start("collector-extension"), 18);
  life = engine.act(life, "borrow-moneylender");
  life = engine.act(life, "spend-loan-cash");
  life = ageTo(engine, life, 21);
  life = engine.choose(life, "extend-moneylender-deadline");
  assert.equal(life.economy!.loan!.balance, 150);
  assert.equal(life.economy!.loan!.dueAge, 23);
  assert.equal(life.economy!.loan!.extensions, 1);
  life = ageTo(engine, life, 23);
  assert.equal(life.pendingEventId, "lender-payment-due");
  assert.equal(engine.getChoices(life).some(choice => choice.id === "extend-moneylender-deadline"), false);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
