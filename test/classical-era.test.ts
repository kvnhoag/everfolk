import { withoutMarketSignals } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { matchesCondition } from "../src/engine.ts";
import { contentFingerprint } from "../src/random.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { classicalFoundationYear, worldBeginning, worldPlace } from "../client/models/world-era.ts";
import { ALEXANDRIA_EVENT_VISUALS, defaultEventVisual } from "../client/models/scene-model.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import sources from "../research/classical-era-sources.json" with { type: "json" };

const world = current as WorldPack;
const anchors = [
  ["classical-persian-reconquest", -343, 7], ["classical-alexander-accession", -336, 14],
  ["classical-alexander-crossing", -334, 16], ["classical-alexander-egypt", -332, 18],
  ["classical-alexandria-founded", -331, 19], ["classical-alexander-death", -323, 27],
  ["classical-aristotle-death", -322, 28], ["classical-ptolemy-kingship", -305, 45],
  ["classical-euclid-teaching", -300, 50], ["classical-scholarly-households", -295, 55],
  ["classical-pharos-completed", -280, 70],
] as const;

/** Qualified calendar fixture: isolate chronology/access from mortality and money. */
function calendarWorld(): WorldPack {
  const copy = structuredClone(world);
  withoutMarketSignals(copy);
  const required = new Set([copy.health!.careDecision, ...Object.values(copy.economy!.moneylender!.events)]);
  copy.events = copy.events.filter(event => event.id.startsWith("classical-") || required.has(event.id));
  copy.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  delete copy.health!.mortalityCalibration;
  copy.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  copy.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  copy.eventPacing!.rareEvents!.annualChance = 0;
  copy.yearlyEffects = []; copy.yearlyRules = [];
  // Calendar fixtures deliberately exclude starting possessions and their income.
  for (const asset of copy.economy!.assets) asset.initialRange = { min: 0, max: 0 };
  for (const origin of copy.origins) delete origin.assetRanges;
  copy.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of copy.origins) origin.statRanges = { ...origin.statRanges, wealth: { min: 80, max: 80 } };
  for (const definition of Object.values(copy.character!.skills)) definition.initial = 30;
  return copy;
}

function reach(engine: LifeEngine, life: LifeState, eventId: string, maxAge: number): LifeState {
  for (let commands = 0; commands < 300 && life.age <= maxAge && life.phase !== "ended"; commands++) {
    if (life.pendingEventId === eventId) return life;
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  throw new Error(`Did not reach ${eventId} by age ${maxAge}`);
}

test("350 BCE births precede the foundation; retained 66 BCE lives keep their original pack", () => {
  validateWorld(world);
  assert.equal(world.version, "0.42.0"); assert.equal(world.startYear, -350);
  const engine = createEngine(world), life = engine.start("classical-birth");
  assert.equal(life.age, 0); assert.equal(life.year, -350);
  assert.equal(worldPlace(world, -350), "Rhakotis coast");
  assert.equal(worldPlace(world, -332), "Rhakotis coast");
  assert.equal(worldPlace(world, -331), "Alexandria");
  assert.equal(classicalFoundationYear(world), -331);
  assert.match(worldBeginning(world), /350 BCE.*331 BCE/);
  assert.equal(previous.startYear, -66);
  assert.equal(contentFingerprint(previous), "fnv1a64-083e29e83c70fe61");
  assert.equal(worldPlace(previous as WorldPack, -66), "Alexandria");
  assert.match(worldBeginning(previous as WorldPack), /66 BCE/);
});

test("new calendar anchors occur once at the correct years and lived ages", () => {
  const engine = createEngine(calendarWorld());
  let life = engine.start("classical-calendar");
  for (let count = 0; count < 500 && life.age < 72; count++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  assert.equal(life.age, 72);
  for (const [id, year, age] of anchors) {
    const entries = life.journal.filter(entry => entry.type === "event" && entry.id === id);
    assert.equal(entries.length, 1, id);
    assert.equal(entries[0].year, year, id); assert.equal(entries[0].age, age, id);
    assert.ok(ALEXANDRIA_EVENT_VISUALS[id]);
  }
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

for (const [eventId, choiceId, successFlag, minYear, maxYear, cost] of [
  ["classical-aristotle-journey", "classical-aristotle-travel", "heard-aristotle", -332, -324, 30],
  ["classical-alexander-shore-work", "classical-alexander-approach", "met-alexander", -332, -331, -15],
  ["classical-euclid-demonstration", "classical-euclid-work-proof", "studied-euclidean-proof", -305, -290, 10],
] as const) test(`${eventId} requires an accepted, dated choice and retains exact outcomes`, () => {
  const engine = createEngine(calendarWorld());
  let successful = false;
  for (let seed = 0; seed < 24 && !successful; seed++) {
    const life = reach(engine, engine.start(`${eventId}-${seed}`), eventId, 65);
    assert.ok(life.year >= minYear && life.year <= maxYear);
    assert.equal(life.flags[successFlag], false);
    const before = structuredClone(life), choices = engine.getChoices(life);
    assert.ok(choices.some(choice => choice.id === choiceId));
    assert.deepEqual(life, before, "viewing the encounter cannot grant a meeting");
    const after = engine.choose(life, choiceId);
    assert.equal(after.economy!.cash, life.economy!.cash - cost);
    assert.equal(after.age, life.age, "round-trip narration does not silently teleport the home settlement");
    assert.deepEqual(engine.load(engine.save(after)), after);
    successful = after.flags[successFlag];
  }
  assert.ok(successful, "the authored successful encounter must be reachable");
  const event = world.events.find(event => event.id === eventId)!;
  const late = structuredClone(engine.start("expired-encounter"));
  late.age = maxYear + 1 - world.startYear; late.year = maxYear + 1;
  assert.equal(matchesCondition(event.when, late), false, "a historical window cannot remain open indefinitely");
  assert.equal(event.evidence, "fictional");
});

test("dated fiction distinguishes uncertain chronology and keeps the old era out of active encounters", () => {
  assert.equal(sources.length, 9);
  const byId = new Map(world.sources!.map(source => [source.id, source]));
  for (const source of sources) assert.deepEqual(byId.get(source.id), source);
  for (const id of ["classical-euclid-teaching", "classical-scholarly-households", "classical-pharos-completed"]) {
    assert.equal(world.events.find(event => event.id === id)!.evidence, "historically-inspired");
  }
  const active = JSON.stringify(world.events);
  assert.doesNotMatch(active, /Caesar|Octavian|Actium|Cleopatra|Dendera/);
  assert.doesNotMatch(active, /"flag":"roman-rule"|"value":-(?:29|30)(?=[,}])/);
  assert.deepEqual(Object.keys(ALEXANDRIA_EVENT_VISUALS).sort(), world.events.map(event => event.id).sort());
  assert.equal(defaultEventVisual(previous.events.find(event => event.id === "caesar-in-alexandria")!).scene, "history-war");
  assert.match(world.events.find(event => event.id === "classical-aristotle-journey")!.text, /Athens.*Lyceum/);
});

test("the era revision keeps the seven routes, avatar identities, growth curves and mortality values", () => {
  assert.equal(world.legacy!.routes.length, 7); assert.equal(world.legacy!.achievements.length, 43);
  assert.deepEqual(world.origins.slice(0, previous.origins.length).map(origin => origin.id), previous.origins.map(origin => origin.id));
  assert.equal(world.origins.length, 16);
  assert.deepEqual(world.character!.identity, previous.character.identity);
  for (const [id, definition] of Object.entries(world.character!.skills)) {
    assert.deepEqual(definition.gainCurve, previous.character.skills[id as keyof typeof previous.character.skills].gainCurve);
  }
  assert.deepEqual(world.mortality!.bands, previous.mortality.bands);
  assert.deepEqual(world.health!.mortalityCalibration, previous.health.mortalityCalibration);
});
