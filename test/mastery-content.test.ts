import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import { getOpportunityPreview } from "../src/outcomes.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import previous from "../worlds/alexandria-0.23.0.json" with { type: "json" };
import { applyMastery } from "../scripts/alexandria-mastery.mjs";

const world = applyMastery(structuredClone(previous)) as WorldPack;
const events = world.events.filter(event => event.id.startsWith("rare-masterwork") || event.id.startsWith("rare-scholarly-mastery") ||
  event.id.startsWith("rare-knowledge-breakthrough") || event.id.startsWith("rare-community-recognition"));
const find = (id: string) => {
  const event = events.find(event => event.id === id);
  assert.ok(event, `Missing mastery event ${id}`);
  return event;
};
function context(): LifeState {
  const life = structuredClone(createEngine(world).start("mastery-context"));
  life.age = 35;
  life.stats.health = 70; life.stats.knowledge = 45; life.stats.bonds = 60;
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 0;
  return life;
}
function fixture(id: string): LifeEngine {
  const pack = structuredClone(world);
  delete pack.health!.mortalityCalibration;
  pack.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  pack.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  pack.yearlyEffects = []; pack.yearlyRules = [];
  delete pack.knowledge;
  pack.events = pack.events.filter(event => [id, pack.health!.careDecision, ...Object.values(pack.economy!.moneylender!.events)].includes(event.id));
  pack.eventPacing!.rareEvents = { annualChance: 1, cooldownYears: 12 };
  for (const origin of pack.origins) {
    origin.effects = [];
    origin.statRanges = { health: { min: 70, max: 70 }, knowledge: { min: 65, max: 65 }, bonds: { min: 80, max: 80 }, wealth: { min: 50, max: 50 } };
  }
  pack.character!.skills.pottery.initial = 65;
  pack.character!.skills.literacy.initial = 60;
  pack.character!.skills.reckoning.initial = 55;
  pack.character!.skills.oratory.initial = 45;
  return createEngine(pack);
}
function arrive(engine: LifeEngine, seed: string, id: string): LifeState {
  let life = engine.start(seed);
  while (life.phase === "ready" && life.age < 40) life = engine.advance(life);
  assert.equal(life.pendingEventId, id);
  return life;
}

test("four one-off mastery encounters add exceptional rewards without changing ordinary progression or hazards", () => {
  assert.equal(events.length, 4);
  assert.deepEqual(world.stats, previous.stats);
  assert.deepEqual(world.character, previous.character);
  assert.deepEqual(world.health, previous.health);
  assert.deepEqual(world.mortality, previous.mortality);
  assert.deepEqual(world.economy, previous.economy);
  assert.deepEqual(world.sources, previous.sources);
  const targets = new Set<string>();
  for (const event of events) {
    assert.equal(event.rarity, "rare");
    assert.equal(event.maxOccurrences, 1);
    assert.equal(event.mode, undefined);
    assert.equal(event.evidence, "fictional");
    assert.deepEqual(event.sourceIds, []);
    assert.ok(event.choices.some(choice => choice.outcomes.every(outcome => outcome.effects.length === 0)));
    for (const choice of event.choices) for (const outcome of choice.outcomes) {
      const rewards = outcome.effects.filter(effect => effect.type === "mastery");
      assert.ok(rewards.length <= 1, "One breakthrough cannot fill several stats at once.");
      assert.ok(outcome.effects.every(effect => !["end", "condition", "loan", "job"].includes(effect.type)));
      for (const reward of rewards) {
        assert.ok(reward.id !== "health" && reward.id !== world.economy!.stat);
        targets.add(`${reward.target}:${reward.id}`);
      }
    }
  }
  assert.equal(targets.size, 10);
});

test("good-run thresholds exclude beginners and already capped targets", () => {
  const life = context();
  for (const event of events) assert.equal(matchesCondition(event.when, life), false, event.id);
  life.character!.skills.pottery = 60;
  const crafts = find("rare-masterwork");
  assert.equal(matchesCondition(crafts.when, life), true);
  life.character!.skills.pottery = 100;
  assert.equal(matchesCondition(crafts.when, life), false);
  life.character!.skills.literacy = 55;
  const scholarly = find("rare-scholarly-mastery");
  assert.equal(matchesCondition(scholarly.when, life), true);
  life.character!.skills.literacy = 100;
  assert.equal(matchesCondition(scholarly.when, life), false);
  life.stats.bonds = 75; life.character!.skills.oratory = 40;
  const standing = find("rare-community-recognition");
  assert.equal(matchesCondition(standing.when, life), true);
  life.stats.bonds = 100;
  assert.equal(matchesCondition(standing.when, life), false);
  life.age = 17;
  for (const event of events) assert.equal(matchesCondition(event.when, life), false, event.id);
});

test("a stronger developed life improves the disclosed mastery odds without changing the snapshot", () => {
  const engine = fixture("rare-masterwork");
  const life = arrive(engine, "mastery-preview", "rare-masterwork");
  const choice = engine.getChoices(life).find(choice => choice.id === "masterwork-pottery")!;
  const before = engine.save(life);
  const base = getOpportunityPreview(engine.world, life, choice)!;
  assert.ok(base.probability > 0 && base.probability < 1);
  const advanced = structuredClone(life);
  advanced.character!.skills.pottery = 78;
  advanced.character!.jobId = "pottery-workshop-lead";
  assert.ok(getOpportunityPreview(engine.world, advanced, choice)!.probability > base.probability);
  assert.equal(engine.save(life), before);
});

test("accepted mastery outcomes reach the actual cap despite strict curves and replay exactly", () => {
  for (const [id, choice, target, key] of [
    ["rare-masterwork", "masterwork-pottery", "skill", "pottery"],
    ["rare-knowledge-breakthrough", "knowledge-breakthrough-study", "stat", "knowledge"],
    ["rare-community-recognition", "community-recognition-agreement", "stat", "bonds"],
  ] as const) {
    const engine = fixture(id);
    let mastered: LifeState | undefined, practised: LifeState | undefined;
    for (let seed = 0; seed < 32 && (!mastered || !practised); seed++) {
      const life = arrive(engine, `${id}-draw-${seed}`, id);
      const result = engine.choose(life, choice);
      if (result.journal.some(entry => entry.type === "outcome" && entry.id === `${choice}-mastered`)) mastered ??= result;
      else practised ??= result;
    }
    assert.ok(mastered, `${id}: a real weighted outcome must be able to reach mastery`);
    assert.ok(practised, `${id}: mastery is not guaranteed`);
    const values = target === "skill" ? mastered.character!.skills : mastered.stats;
    const definitions = target === "skill" ? engine.world.character!.skills : engine.world.stats;
    assert.equal(values[key], definitions[key].max);
    assert.ok((target === "skill" ? practised.character!.skills[key] : practised.stats[key]) < definitions[key].max);
    assert.deepEqual(engine.load(engine.save(mastered)), mastered);
    assert.deepEqual(engine.replay(mastered.seed, mastered.commands), mastered);
    const after = engine.advance(mastered);
    assert.equal(after.eventCounts[id], 1);
  }
});
