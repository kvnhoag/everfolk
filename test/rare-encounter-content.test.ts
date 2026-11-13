import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { getChoiceImpact } from "../client/models/choice-impact.ts";
import { getOpportunityPreview } from "../src/outcomes.ts";
import current from "../worlds/alexandria-0.23.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.22.0.json" with { type: "json" };

const world = current as WorldPack;
const rare = world.events.filter(event => event.rarity === "rare");
const event = (id: string) => {
  const value = rare.find(event => event.id === id);
  assert.ok(value, `Missing encounter ${id}`);
  return value;
};

/** Exact commands under isolated onset rules; consequences remain authored. */
function fixture(id = "rare-abduction", startingCash = 100): LifeEngine {
  const pack = structuredClone(world);
  delete pack.health!.mortalityCalibration;
  pack.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  pack.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  pack.yearlyEffects = []; pack.yearlyRules = [];
  pack.events = pack.events.filter(event => [id, pack.health!.careDecision, ...Object.values(pack.economy!.moneylender!.events)].includes(event.id));
  pack.eventPacing!.rareEvents = { annualChance: 1, cooldownYears: 12 };
  for (const origin of pack.origins) {
    origin.effects = [];
    origin.statRanges = { health: { min: 40, max: 40 }, wealth: { min: startingCash / 10, max: startingCash / 10 }, bonds: { min: 40, max: 40 } };
  }
  return createEngine(pack);
}
function arrive(engine: LifeEngine, seed: string): LifeState {
  let life = engine.start(seed);
  while (life.age < 18 && life.phase !== "ended") {
    assert.equal(life.phase, "ready");
    life = engine.advance(life);
  }
  assert.equal(life.pendingEventId, "rare-abduction");
  return life;
}

test("six one-off fictional encounters preserve existing health, mortality, economy and ordinary content", () => {
  assert.equal(rare.length, 6);
  for (const item of rare) {
    assert.equal(item.trigger.type, "random");
    assert.equal(item.mode, undefined);
    assert.equal(item.maxOccurrences, 1);
    assert.equal(item.evidence, "fictional");
    assert.deepEqual(item.sourceIds, []);
    assert.equal(item.effects, undefined, "appearance cannot secretly harm or kill the player");
  }
  assert.deepEqual(current.health, previous.health);
  assert.deepEqual(current.mortality, previous.mortality);
  assert.deepEqual(current.economy, previous.economy);
  assert.deepEqual(current.origins, previous.origins);
  assert.deepEqual(current.sources, previous.sources);
  assert.deepEqual(world.events.filter(item => item.rarity !== "rare"), previous.events);
  for (const cause of current.character.deathCauses.slice(previous.character.deathCauses.length)) assert.equal(cause.choiceOnly, true);
});

test("encounters respect adulthood, actual ship work and demonstrated skills", () => {
  const engine = createEngine(world);
  const life = structuredClone(engine.start("rare-context"));
  for (const item of rare) {
    life.age = 17;
    assert.equal(matchesCondition(item.when, life), false, item.id);
  }
  life.age = 30;
  const sea = event("rare-sailor-rescue");
  life.character!.jobId = null;
  assert.equal(matchesCondition(sea.when, life), false);
  life.character!.jobId = "sailor";
  assert.equal(matchesCondition(sea.when, life), true);
  const patron = event("rare-patron-test");
  life.character!.skills.literacy = life.character!.skills.craft = life.character!.skills.pottery = 0;
  assert.equal(matchesCondition(patron.when, life), false);
  life.character!.skills.pottery = 20;
  assert.equal(matchesCondition(patron.when, life), true);
  assert.equal(matchesCondition(patron.choices.find(choice => choice.id === "rare-patron-pot")!.when, life), true);
  assert.equal(matchesCondition(patron.choices.find(choice => choice.id === "rare-patron-copy")!.when, life), false);
});

test("paying the stated ransom ends the encounter, spends only the stated cash and replays exactly", () => {
  const engine = fixture();
  let life = arrive(engine, "ransom-paid");
  const beforeCash = life.economy!.cash, beforeHealth = life.stats.health;
  life = engine.choose(life, "rare-abduction-pay");
  assert.equal(life.phase, "ready");
  assert.equal(life.economy!.cash, beforeCash - 30);
  assert.equal(life.stats.health, beforeHealth);
  assert.deepEqual(life.health!.conditions, []);
  assert.equal(life.economy!.loan, undefined);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
  for (let age = 19; age <= 35; age++) life = engine.advance(life);
  assert.equal(life.eventCounts["rare-abduction"], 1);
});

test("no cash still leaves nonfatal options and disclosed risk reflects the player's situation", () => {
  const engine = fixture("rare-abduction", 0);
  const life = arrive(engine, "ransom-no-money");
  const choices = engine.getChoices(life);
  assert.equal(choices.some(choice => choice.id === "rare-abduction-pay"), false);
  const shout = choices.find(choice => choice.id === "rare-abduction-shout")!;
  assert.equal(getChoiceImpact(shout, life, engine.world).deathRisk, 0);
  const flee = choices.find(choice => choice.id === "rare-abduction-flee")!;
  assert.ok(Math.abs(getChoiceImpact(flee, life, engine.world).deathRisk - 0.02) < 1e-12);
  const negotiation = choices.find(choice => choice.id === "rare-abduction-negotiate")!;
  const before = engine.save(life);
  const untrained = getOpportunityPreview(engine.world, life, negotiation)!;
  const capable = structuredClone(life);
  capable.character!.skills.oratory = 25; capable.stats.bonds = 65;
  assert.ok(getOpportunityPreview(engine.world, capable, negotiation)!.probability > untrained.probability);
  capable.stats.health = 70;
  assert.ok(getChoiceImpact(flee, capable, engine.world).deathRisk < 0.02);
  assert.equal(engine.save(life), before, "viewing odds does not reroll or mutate the encounter");
});

test("escape injuries interrupt for care, while fatal escapes record an exact choice-caused wound", () => {
  const engine = fixture();
  let injured: LifeState | undefined, dead: LifeState | undefined;
  for (let seed = 0; seed < 512 && (!injured || !dead); seed++) {
    const offered = arrive(engine, `rare-abduction-outcome-${seed}`);
    const result = engine.choose(offered, "rare-abduction-flee");
    if (result.health!.conditions.some(condition => condition.id === "open-leg-fracture")) injured ??= result;
    if (result.phase === "ended") dead ??= result;
  }
  assert.ok(injured, "a seeded accepted escape can produce the disclosed injury");
  assert.equal(injured.pendingEventId, world.health!.careDecision);
  assert.ok(injured.health!.conditions.some(condition => condition.source?.includes("Force past them and run")));
  assert.deepEqual(engine.replay(injured.seed, injured.commands), injured);
  assert.ok(dead, "a seeded accepted escape can produce the disclosed fatal outcome");
  assert.equal(dead.deathCauseId, "abduction-stabbing");
  assert.equal(dead.deathCauseKind, "choice");
  assert.match(dead.deathCauseContext!, /Force past them and run/);
  assert.equal(engine.world.character!.deathCauses.find(cause => cause.id === dead!.deathCauseId)!.title, "Stab wound to the chest");
  assert.deepEqual(engine.replay(dead.seed, dead.commands), dead);
});
