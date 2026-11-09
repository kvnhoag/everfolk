import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, yearAtAge } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.12.0.json" with { type: "json" };

/** Isolate occupational boundaries from unrelated narrative and mortality draws. */
function controlledWorld(): WorldPack {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  world.events = world.events.filter(event => ["the-first-household", world.health!.careDecision].includes(event.id));
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  world.stats.wealth.initial = 80;
  world.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of world.origins) origin.statRanges!.wealth = { min: 80, max: 80 };
  return world;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) life = engine.advance(life);
  assert.equal(life.phase, "ready");
  return life;
}

function activity(engine: LifeEngine, life: LifeState, id: string) {
  const found = engine.getActivities(life).find(activity => activity.id === id);
  assert.ok(found, `Missing ${id}`);
  return found;
}

function qualifiedLife(engine: LifeEngine, age: number): LifeState {
  const life = structuredClone(ageTo(engine, engine.start(`work-boundary-${age}`), age));
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 100;
  return life;
}

test("work opens in stages: chores at six, paid errands and apprenticeships at twelve, tool repairs at fourteen", () => {
  const engine = createEngine(controlledWorld());
  for (const [id, minimum] of [["help-household-work", 6], ["take-market-errands", 12], ["work-apprentice", 12], ["take-small-repair-jobs", 14]] as const) {
    const before = qualifiedLife(engine, minimum - 1);
    const at = qualifiedLife(engine, minimum);
    if (id === "take-small-repair-jobs") {
      before.economy!.assets["tool-chest"] = 1;
      at.economy!.assets["tool-chest"] = 1;
    }
    assert.equal(activity(engine, before, id).available, false, `${id}: unavailable before its age boundary`);
    assert.equal(activity(engine, at, id).available, true, activity(engine, at, id).reason);
  }
  const atFourteen = qualifiedLife(engine, 14);
  assert.equal(activity(engine, atFourteen, "take-small-repair-jobs").available, false, "Repair work still requires owned tools.");
  assert.equal(activity(engine, atFourteen, "buy-tool-chest").available, true);
});

test("ordinary and specialist job ages move earlier without bypassing their existing skill requirements", () => {
  const engine = createEngine(controlledWorld());
  const minimums = {
    porter: 14, potter: 14, clerk: 14, copyist: 14, sailor: 16, shopkeeper: 18,
    "ceramic-decorator": 14, "wood-carver": 14, sculptor: 16,
    "philosophy-tutor": 18, "sky-table-calculator": 18,
  };
  for (const [id, minimum] of Object.entries(minimums)) {
    const job = engine.world.character!.jobs.find(job => job.id === id)!;
    assert.equal(job.minAge, minimum);
    assert.deepEqual(job.requirements, previous.character.jobs.find(job => job.id === id)!.requirements);
    const before = qualifiedLife(engine, minimum - 1);
    assert.equal(activity(engine, before, `work-${id}`).available, false, `${id}: too young`);
    const at = qualifiedLife(engine, minimum);
    assert.equal(activity(engine, at, `work-${id}`).available, true, activity(engine, at, `work-${id}`).reason);
    if (Object.keys(job.requirements ?? {}).length) {
      for (const skill of Object.keys(job.requirements!)) at.character!.skills[skill] = 0;
      assert.equal(activity(engine, at, `work-${id}`).available, false, `${id}: age alone cannot qualify a worker`);
    }
  }
  const astrologer = engine.world.character!.jobs.find(job => job.id === "astrologer")!;
  assert.equal(astrologer.minAge, 18);
  assert.deepEqual(astrologer.requirements, previous.character.jobs.find(job => job.id === "astrologer")!.requirements);
  assert.equal(activity(engine, qualifiedLife(engine, 18), "work-astrologer").available, false, "The separately authored 29 BCE evidence gate remains in force.");
  assert.equal(activity(engine, qualifiedLife(engine, 37), "work-astrologer").available, true);
});

test("an apprenticeship earns a small return and skill through work, then permits a qualified regular job", () => {
  const engine = createEngine(controlledWorld());
  let life = ageTo(engine, engine.start("apprenticeship-to-potter"), 12);
  life = engine.act(life, "work-apprentice");
  assert.equal(life.character!.jobId, "apprentice");
  const cash = life.economy!.cash;
  const craft = life.character!.skills.craft;
  life = engine.advance(life);
  assert.equal(life.economy!.cash, cash + 10);
  assert.equal(life.character!.skills.craft, craft + 2);
  assert.equal(activity(engine, life, "work-potter").available, false);
  life = engine.act(life, "train-craft");
  life = engine.advance(life);
  assert.equal(life.age, 14);
  assert.equal(activity(engine, life, "work-potter").available, false, "The minimum working age does not bypass training.");
  life = engine.act(life, "train-craft");
  life = engine.advance(life);
  assert.equal(life.age, 15);
  assert.equal(activity(engine, life, "work-potter").available, true);
  life = engine.act(life, "work-potter");
  assert.equal(life.character!.jobId, "potter");
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("a regular job leaves later literacy lessons available alongside earning", () => {
  const engine = createEngine(controlledWorld());
  let life = ageTo(engine, engine.start("work-and-lessons"), 14);
  life = engine.act(life, "work-porter");
  life = engine.advance(life);
  const literacy = life.character!.skills.literacy;
  assert.equal(activity(engine, life, "train-literacy").available, true);
  life = engine.act(life, "train-literacy");
  assert.equal(life.character!.jobId, "porter");
  assert.equal(life.character!.skills.literacy, literacy + 6);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("earlier work references primary evidence while disclosing that exact start ages are authored", () => {
  for (const id of ["diodorus-childhood-work", "alexandrian-minor-apprentice"]) {
    const source = pack.sources.find(source => source.id === id)!;
    assert.ok(source);
    assert.equal(source.kind, "primary");
    assert.match(source.url, /^https:\/\//);
    assert.match(source.limitations, /numerical.*age|exact age|age 12/);
    for (const eventId of ["a-place-to-learn", "the-first-wages", "a-place-on-the-manifest"]) {
      assert.ok(pack.events.find(event => event.id === eventId)!.sourceIds!.includes(id));
    }
  }
});

test("earlier occupational ages do not lower the engine's adult relationship boundary", () => {
  const world = controlledWorld();
  // Remove only the content's later age gate to exercise the engine invariant.
  world.character!.activities.find(activity => activity.id === "court-demetria")!.minAge = 0;
  const engine = createEngine(world);
  const before = structuredClone(ageTo(engine, engine.start("adult-boundary"), 17));
  before.character!.knownPartnerIds = ["demetria"];
  before.character!.relationships!.partners.demetria = { closeness: world.relationships!.initialCloseness, lastContactAge: before.age };
  assert.equal(activity(engine, before, "court-demetria").available, false);
  assert.throws(() => engine.act(before, "court-demetria"), /Relationships unlock at age 18/);
  const at = engine.advance(before);
  assert.equal(at.year, yearAtAge(world.startYear, 18));
  assert.equal(activity(engine, at, "court-demetria").available, true, activity(engine, at, "court-demetria").reason);
  assert.equal(engine.world.character!.jobs.find(job => job.id === "soldier")!.minAge, 18);
});
