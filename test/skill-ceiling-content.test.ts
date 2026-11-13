import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { applyStatDelta, skillEffectDelta } from "../src/progression.ts";
import { getOpportunityPreview } from "../src/outcomes.ts";
import { getSkillImpact } from "../client/models/skill-impact.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";
import type { Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
// Keep this exact 0.27→0.28 release delta; current people content has its own tests.
import input from "../worlds/alexandria-0.28.0.json" with { type: "json" };
import archived from "../worlds/alexandria-0.27.0.json" with { type: "json" };

const world = input as WorldPack, previous = archived as WorldPack;
const skillEvents = ["rare-masterwork", "rare-scholarly-mastery", "rare-applied-mastery"];
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);

test("all thirteen skill curves keep early progression and sharply taper the final points", () => {
  validateWorld(world);
  assert.equal(world.version, "0.28.0"); assert.equal(world.events.length, 427);
  assert.equal(Object.keys(world.character!.skills).length, 13);
  for (const [id, definition] of Object.entries(world.character!.skills)) {
    const old = previous.character!.skills[id];
    assert.deepEqual(definition.gainCurve, [
      { from: 0, multiplier: 1 }, { from: 40, multiplier: .5 }, { from: 70, multiplier: .15 },
      { from: 85, multiplier: .05 }, { from: 95, multiplier: .015 }, { from: 99, multiplier: .003 },
    ]);
    for (const value of [0, 15, 39, 40, 55, 69]) for (const delta of [0, .5, 1]) {
      assert.equal(applyStatDelta(definition, value, delta), applyStatDelta(old, value, delta), `${id}: early gain changed`);
    }
    assert.equal(applyStatDelta(definition, 69, 2), 70);
    near(applyStatDelta(definition, 69, 6), 70.6);
    near(applyStatDelta(definition, 84, 10), 85 + 1 / 6);
    near(applyStatDelta(definition, 90, 6), 90.3);
    near(applyStatDelta(definition, 95, 6), 95.09);
    near(applyStatDelta(definition, 99, 6), 99.018);
    assert.equal(applyStatDelta(definition, 95, -5), 90, "Penalties stay unscaled");
    assert.equal(applyStatDelta(definition, 0, 400), 95);
    assert.ok(applyStatDelta(definition, 0, 999) < 100);
    near(applyStatDelta(definition, 0, 1000), 100);
    assert.equal(applyStatDelta(old, 0, 400), 100);
    let practiced = 0;
    for (let years = 0; years < 100; years++) practiced = applyStatDelta(definition, practiced, 7.2);
    assert.ok(practiced > 95 && practiced < 100, `${id}: 100 maximally boosted lessons should not routinely cap`);
  }
});

test("the remembered-interest bonus remains bounded before the new taper and previews stay exact", () => {
  const engine = createEngine(world);
  const life = structuredClone(engine.start("ceiling-preview"));
  life.age = 40; life.year = -26; life.phase = "ready"; life.pendingEventId = null;
  life.character!.skills.craft = 99;
  life.flags["early-interest-sculpture"] = true;
  const training = world.character!.activities.find(activity => activity.id === "train-craft")!;
  const effect = training.outcomes[0].effects.find(effect => effect.type === "skill" && effect.skill === "craft")!;
  assert.equal(effect.type, "skill");
  if (effect.type !== "skill") throw Error("Missing practice reward");
  near(skillEffectDelta(effect, life.flags), 7.2);
  const before = structuredClone(life);
  const impact = getSkillImpact(training, life, world).find(item => item.id === "craft")!;
  near(impact.min, .0216); near(impact.max, .0216);
  assert.deepEqual(life, before);
});

test("only skill growth and the two late skill mastery encounters change existing content", () => {
  for (const key of ["stats", "health", "mortality", "economy", "knowledge", "relationships", "origins", "flags", "legacy", "sources", "yearlyEffects", "yearlyRules", "eventPacing"] as const) assert.deepEqual(world[key], previous[key], key);
  const adjusted = structuredClone(world.character!);
  for (const [id, definition] of Object.entries(adjusted.skills)) definition.gainCurve = previous.character!.skills[id].gainCurve;
  assert.deepEqual(adjusted, previous.character);
  const revised = new Set(["rare-masterwork", "rare-scholarly-mastery"]);
  for (const event of previous.events.filter(event => !revised.has(event.id))) assert.deepEqual(world.events.find(now => now.id === event.id), event, event.id);
  assert.equal(world.events.filter(event => !previous.events.some(before => before.id === event.id)).length, 1);
  // These accomplishments remain meaningful mid-career milestones, without
  // turning every accepted 50-point prestige undertaking into instant mastery.
  for (const event of world.events.filter(event => event.id.startsWith("legacy-") && event.id.endsWith("-prestige"))) {
    assert.deepEqual(event, previous.events.find(before => before.id === event.id));
    assert.ok(!event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "mastery"))));
  }
});

function controlled(eventId: string): LifeEngine {
  const pack = structuredClone(world);
  delete pack.health!.mortalityCalibration;
  pack.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  pack.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  pack.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  pack.yearlyEffects = []; pack.yearlyRules = []; delete pack.knowledge;
  pack.events = pack.events.filter(event => [eventId, pack.health!.careDecision, ...Object.values(pack.economy!.moneylender!.events)].includes(event.id));
  pack.eventPacing!.rareEvents = { annualChance: 1, cooldownYears: 12 };
  for (const origin of pack.origins) {
    origin.effects = [];
    origin.statRanges = { health: { min: 80, max: 80 }, knowledge: { min: 70, max: 70 }, bonds: { min: 80, max: 80 }, wealth: { min: 50, max: 50 } };
  }
  for (const definition of Object.values(pack.character!.skills)) definition.initial = 75;
  return createEngine(pack);
}
function toAge(engine: LifeEngine, life: LifeState, age: number) {
  while (life.phase === "ready" && life.age < age) life = engine.advance(life);
  assert.equal(life.age, age);
  return life;
}
function earnedWork(engine: LifeEngine, seed: string, achievement: string): LifeState {
  const action = engine.world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievement)))!;
  let life = toAge(engine, engine.start(seed), achievement === "military-first-work" ? 18 : 16);
  if (achievement === "military-first-work") life = toAge(engine, engine.act(life, "enlist-royal-army"), 19);
  return engine.act(life, action.id);
}
function recordFor(choice: Choice): string | undefined {
  const visit = (condition: Choice["when"]): string[] => !condition ? [] : condition.type === "accomplishment" ? [condition.achievement]
    : condition.type === "all" || condition.type === "any" ? condition.conditions.flatMap(visit) : [];
  return visit(choice.when)[0];
}

test("all thirteen skills have a late rare one-off cap opportunity with no guaranteed success", () => {
  const covered = new Set<string>();
  for (const event of world.events.filter(event => skillEvents.includes(event.id))) {
    assert.equal(event.rarity, "rare"); assert.equal(event.maxOccurrences, 1);
    assert.deepEqual(event.trigger, { type: "random", weight: .6 });
    assert.ok(event.choices.some(choice => !choice.when && choice.outcomes.every(outcome => outcome.effects.length === 0)));
    const engine = controlled(event.id);
    for (const choice of event.choices) {
      const reward = choice.outcomes.flatMap(outcome => outcome.effects).find(effect => effect.type === "mastery" && effect.target === "skill");
      if (reward?.type !== "mastery") continue;
      covered.add(reward.id);
      const work = recordFor(choice);
      let successful: LifeState | undefined, unfinished: LifeState | undefined;
      for (let seed = 0; seed < 24 && (!successful || !unfinished); seed++) {
        let life = work ? earnedWork(engine, `ceiling-${reward.id}-${seed}`, work) : engine.start(`ceiling-${reward.id}-${seed}`);
        life = toAge(engine, life, 30);
        assert.equal(life.pendingEventId, event.id);
        const preview = getOpportunityPreview(engine.world, life, engine.getChoices(life).find(item => item.id === choice.id)!)!;
        assert.ok(preview.probability > 0 && preview.probability < 1);
        const after = engine.choose(life, choice.id);
        if (after.character!.skills[reward.id] === 100) successful ??= after;
        else unfinished ??= after;
      }
      assert.ok(successful, `${reward.id} has no successful cap outcome`);
      assert.ok(unfinished, `${reward.id} incorrectly guarantees mastery`);
      assert.deepEqual(engine.load(engine.save(successful)), successful);
      assert.deepEqual(engine.replay(successful.seed, successful.commands), successful);
      assert.equal(successful.eventCounts[event.id], 1);
    }
  }
  assert.deepEqual([...covered].sort(), Object.keys(world.character!.skills).sort());
});

test("skill mastery excludes youth, low proficiency and capped targets while applied mastery needs accepted work", () => {
  const engine = createEngine(world), life = structuredClone(engine.start("ceiling-eligibility"));
  life.age = 30; life.year = -36; life.stats.health = 80; life.stats.knowledge = 70; life.stats.bonds = 80;
  for (const definition of Object.keys(world.character!.skills)) life.character!.skills[definition] = 0;
  for (const event of world.events.filter(event => skillEvents.includes(event.id))) {
    for (const choice of event.choices) {
      const reward = choice.outcomes.flatMap(outcome => outcome.effects).find(effect => effect.type === "mastery" && effect.target === "skill");
      if (reward?.type !== "mastery") continue;
      const target = structuredClone(life);
      target.character!.skills[reward.id] = 74.999;
      assert.equal(matchesCondition(choice.when, target), false);
      target.character!.skills[reward.id] = 75;
      const work = recordFor(choice);
      if (work) {
        assert.equal(matchesCondition(choice.when, target), false, `${reward.id}: prior work required`);
        const definition = world.legacy!.achievements.find(item => item.id === work)!;
        target.accomplishments!.push({ id: `${work}:20`, achievementId: work, routeId: definition.routeId, title: definition.title, description: definition.description, kind: definition.kind, name: "A completed earlier work", age: 20, year: -46, sourceId: "test-work", outcomeId: "test-work-result", people: definition.people });
      }
      assert.equal(matchesCondition(choice.when, target), true, reward.id);
      assert.equal(matchesCondition(event.when, target), true, reward.id);
      target.age = 29; target.year = -37;
      assert.equal(matchesCondition(event.when, target), false, "Minimum age30");
      target.age = 50; target.year = -16; target.character!.jobId = null;
      assert.equal(matchesCondition(event.when, target), true, `${reward.id}: veterans may attempt without a current royal post`);
      target.character!.skills[reward.id] = 100;
      assert.equal(matchesCondition(choice.when, target), false);
      assert.equal(matchesCondition(event.when, target), false);
    }
  }
});

test("0.27 lives retain exact progression and mastery rules with archive replay and edited drafts preserved", () => {
  const old = createEngine(previous);
  assert.equal(old.fingerprint, "fnv1a64-8d800bd79b24e15e");
  let life = old.start("skill-ceiling-027-retained");
  while (life.phase !== "ended" && (life.age < 35 || life.phase === "choice")) life = life.phase === "choice"
    ? old.choose(life, selectAutomaticChoice(old.getChoices(life), old.world, life)!.id) : old.advance(life);
  const loaded = loadAnyLife(old.save(life)), retained = engineForLife(loaded);
  assert.equal(retained.world.version, "0.27.0"); assert.deepEqual(loaded, life);
  assert.deepEqual(retained.replay(life.seed, life.commands), life);
  if (life.phase !== "ended") assert.deepEqual(retained.advance(loaded), old.advance(life));
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`)!.pack, previous);
  assert.equal(isLegacyFactoryDraft(getBuiltinCatalog(previous).worlds), true);
  const edited = getBuiltinCatalog(previous); edited.worlds[0].pack.description = "Custom progression playtest.";
  assert.equal(isLegacyFactoryDraft(edited.worlds), false);
});
