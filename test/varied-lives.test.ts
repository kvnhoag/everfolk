import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { matchesCondition } from "../src/engine.ts";
import type { Condition, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { builtinEngine, createDifferentSampleLife, createSampleLife, selectWorldPack } from "../client/session.ts";
import { portraitVariant } from "../client/life-background.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.9.0.json" with { type: "json" };
import variedRelease from "../worlds/alexandria-0.10.0.json" with { type: "json" };

const originalEventIds = new Set(previous.events.map(event => event.id));
const backgroundEventIds = new Set(variedRelease.events.filter(event => !originalEventIds.has(event.id)).map(event => event.id));
const backgroundEvents = pack.events.filter(event => backgroundEventIds.has(event.id));

/** Fixed-name restart fixtures intentionally exercise the older identity model. */
function omitProceduralSocialRoles(world: WorldPack): void {
  const referencesRole = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(referencesRole);
    const entry = value as Record<string, unknown>;
    return entry.type === "social-role" || Object.values(entry).some(referencesRole);
  };
  world.events = world.events.filter(event => !referencesRole(event));
  world.character!.activities = world.character!.activities.filter(activity => !referencesRole(activity));
  delete world.character!.socialRelationships;
}

function isolateBackground(world: WorldPack): void {
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
}

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") {
    const choices = engine.getChoices(life);
    const choice = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0];
    assert.ok(choice);
    life = engine.choose(life, choice.id);
  }
  return life;
}

function sampleBirths(engine: LifeEngine) {
  const origins = new Map<string, LifeState>();
  const names = new Set<string>();
  for (let index = 0; index < 512; index++) {
    const life = engine.start(`varied-birth-${index}`);
    origins.set(life.originId, origins.get(life.originId) ?? life);
    names.add(life.character!.name!);
  }
  return { origins, names };
}

/** Synthetic one-origin fixtures must also prune conditional odds for removed households. */
function pruneRemovedOriginModifiers(world: WorldPack): void {
  const retained = new Set(world.origins.map(origin => origin.id));
  const hasRemovedOrigin = (condition: Condition): boolean => {
    if (condition.type === "origin") return !retained.has(condition.origin);
    if (condition.type === "all" || condition.type === "any") return condition.conditions.some(hasRemovedOrigin);
    return condition.type === "not" && hasRemovedOrigin(condition.condition);
  };
  for (const choice of [...world.events.flatMap(event => event.choices), ...(world.character?.activities ?? [])]) {
    for (const outcome of choice.outcomes) {
      if (!outcome.weightModifiers) continue;
      outcome.weightModifiers = outcome.weightModifiers.filter(modifier => !hasRemovedOrigin(modifier.when));
      if (!outcome.weightModifiers.length) delete outcome.weightModifiers;
    }
  }
}

test("new lives draw broadly from both name pools and eight distinct household backgrounds", () => {
  const engine = createEngine(pack);
  assert.equal(pack.version, "0.31.0");
  assert.equal(pack.character.playerNames.length, 32);
  assert.equal(new Set(pack.character.playerNames).size, 32);
  assert.equal(pack.origins.length, 8);
  assert.equal(new Set(pack.origins.map(origin => origin.title)).size, 8);
  assert.equal(new Set(pack.origins.map(origin => origin.text)).size, 8);
  const { origins, names } = sampleBirths(engine);
  assert.equal(origins.size, 8, "All authored households must be reachable through ordinary seeded births.");
  assert.ok(names.size >= 28, `Only ${names.size} names appeared in 512 new lives.`);
  assert.ok(names.has("Damon"), "Damon remains one possible name, rather than a fixed identity.");
  for (const life of origins.values()) {
    const origin = engine.world.origins.find(origin => origin.id === life.originId)!;
    for (const [id, stat] of Object.entries(engine.world.stats)) {
      const range = origin.statRanges?.[id] ?? stat.initialRange!;
      assert.ok(life.stats[id] >= range.min && life.stats[id] <= range.max, `${origin.id}: ${id}`);
    }
    assert.equal(life.economy!.cash, life.stats.wealth * 10);
    assert.equal(life.economy!.debt, 0);
    assert.ok(Object.values(life.economy!.assets).every(quantity => quantity === 0));
    assert.ok(Object.values(life.character!.skills).every(value => value === 0), "A newborn has not already learned the household's trade.");
    assert.deepEqual(life.character!.knownPartnerIds, []);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("the varied release preserves the existing economy, skill tree, risks and earlier events", () => {
  for (const field of ["stats", "flags", "yearlyEffects", "yearlyRules", "endings", "defaultEnding", "mortality", "economy", "eventPacing"] as const) {
    assert.deepEqual(variedRelease[field], previous[field], field);
  }
  const currentCharacter = structuredClone(variedRelease.character), previousCharacter = structuredClone(previous.character);
  delete (currentCharacter as Partial<typeof currentCharacter>).playerNames;
  delete (previousCharacter as Partial<typeof previousCharacter>).playerNames;
  assert.deepEqual(currentCharacter, previousCharacter);
  assert.equal(backgroundEvents.length, 24);
  assert.equal(variedRelease.events.length, 166);
  for (const event of previous.events) assert.deepEqual(variedRelease.events.find(candidate => candidate.id === event.id), event, event.id);
});

test("each background has exclusive childhood milestones and its own adolescent opportunity", () => {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  isolateBackground(world);
  world.yearlyEffects = [];
  world.yearlyRules = [];
  world.events = world.events.filter(event => event.id === "the-first-household" || event.id === world.health!.careDecision || backgroundEventIds.has(event.id));
  const engine = createEngine(world);
  const { origins } = sampleBirths(engine);
  for (const born of origins.values()) {
    const expected = backgroundEvents.filter(event => matchesCondition(event.when, born));
    assert.equal(expected.length, 3, born.originId);
    assert.equal(expected.filter(event => event.mode === "automatic").length, 2);
    assert.equal(expected.filter(event => event.mode !== "automatic").length, 1);
    let life = settle(engine, born);
    while (life.age < 14) life = engine.advance(settle(engine, life));
    assert.equal(life.phase, "choice", `${born.originId} should receive its adolescent family opportunity.`);
    const offered = expected.find(event => event.mode !== "automatic")!;
    assert.equal(life.pendingEventId, offered.id);
    const recorded = life.journal.filter(entry => entry.type === "event" && backgroundEventIds.has(entry.id));
    assert.deepEqual(new Set(recorded.map(entry => entry.id)), new Set(expected.map(event => event.id)));
    for (const event of expected.filter(event => event.mode === "automatic")) {
      assert.equal(event.trigger.type, "age");
      assert.equal(recorded.find(entry => entry.id === event.id)!.age, (event.trigger as { at: number }).at);
      assert.equal(life.eventCounts[event.id], 1);
    }
    const choices = engine.getChoices(life);
    assert.ok(choices.length >= 2);
    const left = engine.choose(life, choices[0].id), right = engine.choose(life, choices[1].id);
    assert.notDeepEqual({ stats: left.stats, skills: left.character!.skills, economy: left.economy }, { stats: right.stats, skills: right.character!.skills, economy: right.economy }, `${offered.id} choices need distinct consequences.`);
    assert.deepEqual(engine.load(engine.save(left)), left);
    assert.deepEqual(engine.load(engine.save(right)), right);
    assert.equal(life.commands.at(-1)?.type, "advance", "Inspecting alternatives must not accept either choice.");
  }
});

test("complete varied lives retain their drawn name, coherent background and exact replay", () => {
  const engine = createEngine(pack);
  for (let index = 0; index < 24; index++) {
    const born = engine.start(`varied-full-life-${index}`);
    let life = born;
    for (let commands = 0; commands < 600 && life.phase !== "ended"; commands++) {
      life = life.phase === "choice" ? settle(engine, life) : engine.advance(life);
    }
    assert.equal(life.phase, "ended");
    assert.equal(life.character!.name, born.character!.name);
    assert.equal(life.originId, born.originId);
    const ending = engine.world.endings.find(ending => ending.id === life.endingId)!;
    if (ending.kind === "death") assert.ok(life.deathCauseId);
    else {
      assert.equal(life.endingId, "end-of-record");
      assert.equal(life.age, 100);
      assert.equal(life.deathCauseId, undefined);
    }
    assert.ok(life.commands.length < 600);
    for (const entry of life.journal.filter(entry => entry.type === "event" && backgroundEventIds.has(entry.id))) {
      const event = backgroundEvents.find(event => event.id === entry.id)!;
      assert.ok(matchesCondition(event.when, born), `${entry.id} came from a different household.`);
    }
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("every household opportunity follows the core trade decisions without a long milestone backlog", () => {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  isolateBackground(world);
  const engine = createEngine(world);
  const { origins } = sampleBirths(engine);
  const tradeOffers = new Set(engine.world.events.filter(event => event.exclusiveGroup === "early-work").map(event => event.id));
  assert.equal(tradeOffers.size, 8);
  for (const born of origins.values()) {
    const opportunity = backgroundEvents.find(event => event.mode !== "automatic" && matchesCondition(event.when, born))!;
    assert.ok(opportunity);
    let life = settle(engine, born);
    for (let commands = 0; commands < 80 && !tradeOffers.has(life.pendingEventId ?? ""); commands++) {
      life = life.phase === "choice" ? settle(engine, life) : engine.advance(life);
    }
    assert.ok(tradeOffers.has(life.pendingEventId ?? ""), `${born.originId} should reach one of the equivalent work-offer scenarios.`);
    assert.ok(life.age >= 16, "Work offers must not move ahead of their real minimum-age stage.");
    life = settle(engine, life);
    const dueAge = Math.max(14, life.nextChoiceAge ?? 14);
    assert.ok(dueAge >= life.age + 2 && dueAge <= life.age + 3);
    assert.ok(dueAge <= 23, "The earlier training and work queue must still reach the household offer without a long delay.");
    for (let commands = 0; commands < 30 && life.age <= 23 && life.pendingEventId !== opportunity.id; commands++) {
      life = life.phase === "choice" ? settle(engine, life) : engine.advance(life);
    }
    assert.equal(life.pendingEventId, opportunity.id, `${born.originId} must not wait behind decades of generic milestones.`);
    assert.equal(life.age, dueAge, opportunity.id);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("an explicit fresh-life request avoids the preceding name and background when candidates allow it", () => {
  try {
    selectWorldPack(builtinEngine.world);
    const previousLife = createSampleLife("restart-previous-profile");
    const saved = builtinEngine.save(previousLife);
    let sameOrigin: LifeState | undefined, different: LifeState | undefined;
    for (let index = 0; index < 256 && (!sameOrigin || !different); index++) {
      const candidate = createSampleLife(`restart-candidate-${index}`);
      if (candidate.character!.name === previousLife.character!.name) continue;
      if (candidate.originId === previousLife.originId) sameOrigin ??= candidate;
      else different ??= candidate;
    }
    assert.ok(sameOrigin && different);
    const seeds = [previousLife.seed, sameOrigin.seed, different.seed];
    let calls = 0;
    const fresh = createDifferentSampleLife(previousLife, () => seeds[calls++]);
    assert.equal(calls, 3);
    assert.deepEqual(fresh, different);
    assert.notEqual(fresh.character!.name, previousLife.character!.name);
    assert.notEqual(fresh.originId, previousLife.originId);
    assert.equal(fresh.age, 0);
    assert.equal(fresh.commands.length, 0);
    assert.equal(builtinEngine.save(previousLife), saved);
    assert.deepEqual(builtinEngine.load(builtinEngine.save(fresh)), fresh);
    assert.deepEqual(createSampleLife(previousLife.seed), previousLife, "Explicit seeds and restoration retain their exact original identity.");
  } finally { selectWorldPack(builtinEngine.world); }
});

test("limited authored worlds use a bounded fresh-life fallback rather than looping forever", () => {
  const limited = withoutMoneylender(structuredClone(builtinEngine.world) as WorldPack);
  limited.version = "one-profile-restart-fixture";
  limited.origins = [limited.origins[0]];
  limited.events = limited.events.filter(event => event.id === "the-first-household" || event.id === limited.health!.careDecision);
  limited.character!.playerNames = ["Damon"];
  delete limited.character!.identity;
  delete limited.character!.proceduralPartners;
  delete limited.character!.encounterPacing;
  omitProceduralSocialRoles(limited);
  pruneRemovedOriginModifiers(limited);
  try {
    selectWorldPack(limited);
    const previousLife = createSampleLife("limited-before");
    let calls = 0;
    const fresh = createDifferentSampleLife(previousLife, () => `limited-after-${++calls}`);
    assert.equal(calls, 16);
    assert.equal(fresh.seed, "limited-after-1", "Tied candidates keep the first valid fresh seed.");
    assert.equal(fresh.character!.name, "Damon");
    assert.equal(fresh.originId, previousLife.originId);
    const engine = createEngine(limited);
    assert.deepEqual(engine.load(engine.save(fresh)), fresh);
  } finally { selectWorldPack(builtinEngine.world); }
});

test("a limited name pool still chooses the best available different background", () => {
  const limited = structuredClone(builtinEngine.world) as WorldPack;
  limited.version = "one-name-restart-fixture";
  limited.character!.playerNames = ["Damon"];
  delete limited.character!.identity;
  delete limited.character!.proceduralPartners;
  delete limited.character!.encounterPacing;
  omitProceduralSocialRoles(limited);
  try {
    selectWorldPack(limited);
    const previousLife = createSampleLife("one-name-before");
    let candidate: LifeState | undefined;
    for (let index = 0; index < 256 && !candidate; index++) {
      const next = createSampleLife(`one-name-after-${index}`);
      if (next.originId !== previousLife.originId) candidate = next;
    }
    assert.ok(candidate);
    let calls = 0;
    const fresh = createDifferentSampleLife(previousLife, () => ++calls === 1 ? previousLife.seed : candidate!.seed);
    assert.equal(calls, 16);
    assert.deepEqual(fresh, candidate);
    assert.notEqual(fresh.originId, previousLife.originId);
    assert.equal(fresh.character!.name, previousLife.character!.name);
  } finally { selectWorldPack(builtinEngine.world); }
});

test("portrait variation is stable per seed and consumes no gameplay randomness", () => {
  const engine = createEngine(pack);
  const born = engine.start("portrait-does-not-reroll-life");
  const saved = engine.save(born), rng = born.rngState;
  const observed = new Set<number>();
  for (let index = 0; index < 128; index++) {
    const seed = `portrait-life-${index}`;
    const variant = portraitVariant(seed);
    assert.equal(portraitVariant(seed), variant);
    assert.ok(Number.isInteger(variant) && variant >= 0 && variant < 3);
    observed.add(variant);
  }
  assert.equal(observed.size, 3);
  for (let count = 0; count < 50; count++) portraitVariant(born.seed);
  assert.equal(born.rngState, rng);
  assert.equal(engine.save(born), saved);
});
