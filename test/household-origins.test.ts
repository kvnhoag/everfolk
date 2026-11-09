import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { matchesCondition } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.32.0.json" with { type: "json" };
import { withoutMoneylender } from "./fixture-features.ts";

const world = current as WorldPack;
const oldWorld = retained as WorldPack;
const addedIds = ["royal-household", "estate-household", "temple-household", "soldier-household", "tenant-farming-household", "domestic-service-household", "boatbuilder-household", "musician-household"];

test("sixteen origins include a reachable rare royal birth and varied household resources", () => {
  validateWorld(world);
  assert.equal(world.version, "0.33.0");
  assert.equal(world.origins.length, 16);
  assert.deepEqual(world.origins.slice(8).map(origin => origin.id), addedIds);
  const total = world.origins.reduce((sum, origin) => sum + origin.weight, 0);
  assert.equal(total, 100);
  const royal = world.origins.find(origin => origin.id === "royal-household")!;
  assert.equal(royal.weight / total, 0.01);
  assert.equal(royal.evidence, "fictional");
  assert.match(royal.text, /royal/i);
  assert.doesNotMatch(royal.text, /Ptolem|Cleopatra|Caesar|heir to the throne/i);
  const engine = createEngine(world), births = new Map<string, LifeState>();
  for (let index = 0; index < 2048 && births.size < world.origins.length; index++) {
    const life = engine.start(`expanded-household-birth-${index}`);
    if (!births.has(life.originId)) births.set(life.originId, life);
  }
  assert.equal(births.size, world.origins.length, "Every background must be reachable through ordinary birth draws.");
  for (const [id, life] of births) {
    const origin = world.origins.find(origin => origin.id === id)!;
    assert.equal(life.economy!.cash, life.stats.wealth * world.economy!.unitsPerPoint);
    assert.equal(life.economy!.debt, 0);
    assert.equal(life.character!.jobId, null);
    assert.ok(Object.values(life.character!.skills).every(value => value === 0));
    for (const [stat, range] of Object.entries(origin.statRanges!)) assert.ok(life.stats[stat] >= range.min && life.stats[stat] <= range.max, `${id}: ${stat}`);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.ok(births.get("royal-household")!.economy!.cash >= 700);
  assert.ok(world.origins.find(origin => origin.id === "domestic-service-household")!.statRanges!.wealth.max < royal.statRanges!.wealth.min);
});

test("new family scenes are origin-specific, age-appropriate and have distinct accepted consequences", () => {
  const engine = createEngine(world), base = engine.start("household-scene-conditions");
  for (const id of addedIds) {
    const events = world.events.filter(event => event.id.startsWith(`background-${id}-`));
    assert.equal(events.length, 3, id);
    assert.deepEqual(events.map(event => event.trigger.type === "age" ? event.trigger.at : undefined).sort((a, b) => a! - b!), [4, 9, 14]);
    for (const event of events) {
      assert.equal(event.evidence, "fictional");
      assert.ok(matchesCondition(event.when, { ...base, originId: id }));
      assert.equal(matchesCondition(event.when, { ...base, originId: "merchant-household" }), false);
      assert.ok(event.sourceIds?.length);
    }
    const offer = events.find(event => event.mode !== "automatic")!;
    assert.equal(offer.choices.length, 3);
    assert.equal(new Set(offer.choices.map(choice => JSON.stringify(choice.outcomes.map(outcome => outcome.effects)))).size, 3);
    assert.ok(offer.choices.every(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => !["job", "mastery", "end"].includes(effect.type)))));
  }
});

test("the royal family's loss of patronage follows the reconquest and replays without assigning office", () => {
  const draft = withoutMoneylender(structuredClone(world));
  const special = draft.events.filter(event => event.trigger.type === "year" && event.trigger.at === -343 && event.when?.type === "origin" && event.when.origin === "royal-household");
  assert.equal(special.length, 1);
  const shock = special[0];
  assert.equal(shock.mode, "automatic");
  assert.equal(shock.evidence, "fictional");
  assert.ok(shock.effects?.some(effect => effect.type === "cash" && effect.delta < 0));
  draft.events = draft.events.filter(event => event.id === "the-first-household" || event.id === shock.id || event.id === draft.health!.careDecision);
  draft.yearlyEffects = []; draft.yearlyRules = [];
  draft.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  delete draft.health!.mortalityCalibration;
  draft.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  draft.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  const engine = createEngine(draft);
  let life: LifeState | undefined;
  for (let seed = 0; seed < 2048 && !life; seed++) {
    const born = engine.start(`royal-reconquest-${seed}`);
    if (born.originId === "royal-household") life = born;
  }
  assert.ok(life);
  const initialCash = life.economy!.cash;
  while (life.age < 7) life = engine.advance(life);
  assert.equal(life.year, -343);
  assert.equal(life.eventCounts[shock.id], 1);
  assert.ok(life.economy!.cash < initialCash);
  assert.equal(life.character!.jobId, null);
  assert.equal(life.flags["royal-adviser"], undefined);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("expanded origins preserve existing rules, original households and the archived 0.32 world", () => {
  assert.equal(oldWorld.version, "0.32.0");
  assert.equal(oldWorld.origins.length, 8);
  for (const field of ["stats", "flags", "character", "economy", "health", "mortality", "knowledge", "yearlyEffects", "yearlyRules", "eventPacing", "legacy", "endings"] as const) assert.deepEqual(world[field], oldWorld[field], field);
  for (const origin of oldWorld.origins) assert.deepEqual(world.origins.find(item => item.id === origin.id), { ...origin, weight: origin.weight * 4 });
  for (const event of oldWorld.events) assert.deepEqual(world.events.find(item => item.id === event.id), event, event.id);
  for (const source of oldWorld.sources!) assert.deepEqual(world.sources!.find(item => item.id === source.id), source);
  const engine = createEngine(oldWorld);
  let life = engine.start("retained-royal-origin-boundary");
  while (life.age < 5 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.ok(!addedIds.includes(life.originId));
});
