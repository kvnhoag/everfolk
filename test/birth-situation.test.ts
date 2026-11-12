import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import birthRelease from "../worlds/alexandria-0.11.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.10.0.json" with { type: "json" };
import { resolveLifeScenes, sceneContextLabel } from "../client/models/scene-model.ts";

test("the birth-situation release changes only the birth event and content version", () => {
  assert.equal(birthRelease.version, "0.11.0");
  const birth = birthRelease.events.find(event => event.id === "the-first-household")!;
  assert.equal(birth.mode, "automatic");
  assert.deepEqual(birth.trigger, { type: "age", at: 0 });
  assert.deepEqual(birth.choices, []);
  assert.deepEqual(birth.effects, []);
  const restored = structuredClone(birthRelease) as WorldPack;
  restored.version = previous.version;
  restored.events = restored.events.map(event => event.id === birth.id ? previous.events.find(old => old.id === birth.id)! : event);
  assert.deepEqual(restored, previous);
});

test("birth is recorded without asking the player to choose being born or household care", () => {
  const engine = createEngine(pack);
  for (let index = 0; index < 128; index++) {
    const life = engine.start(`automatic-birth-${index}`);
    assert.equal(life.age, 0);
    assert.equal(life.year, pack.startYear);
    assert.equal(life.phase, "ready");
    assert.equal(life.pendingEventId, null);
    assert.deepEqual(engine.getChoices(life), []);
    assert.deepEqual(life.commands, []);
    assert.equal(life.eventCounts["the-first-household"], 1);
    assert.equal(life.journal.filter(entry => entry.type === "event" && entry.id === "the-first-household").length, 1);
    assert.equal(life.journal.some(entry => entry.type === "choice" || entry.type === "outcome"), false);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("removing the birth decision retains the same drawn identity, stats and initial money", () => {
  const current = createEngine(birthRelease), old = createEngine(previous);
  for (let index = 0; index < 128; index++) {
    const seed = `same-born-person-${index}`;
    const born = current.start(seed), earlier = old.start(seed);
    for (const field of ["originId", "stats", "flags", "character", "economy"] as const) assert.deepEqual(born[field], earlier[field], `${seed}: ${field}`);
    // A former decision-spacing draw is intentionally absent, so cross-version
    // RNG states are not interchangeable. Each pack still replays itself exactly.
    assert.notEqual(born.worldFingerprint, earlier.worldFingerprint);
    assert.deepEqual(current.replay(seed, born.commands), born);
    assert.deepEqual(old.replay(seed, earlier.commands), earlier);
  }
});

test("old birth choices cannot be submitted against a new automatic birth", () => {
  const engine = createEngine(pack), born = engine.start("no-birth-choice");
  const saved = engine.save(born);
  for (const choice of ["family-care", "seek-help"]) assert.throws(() => engine.choose(born, choice), /choice|decision|waiting/i);
  assert.equal(engine.save(born), saved);
});

test("birth scenes describe the current situation separately from the household background", () => {
  for (const world of [pack, previous]) {
    const engine = createEngine(world), life = engine.start("birth-scene-situation");
    const before = engine.save(life);
    const contexts = resolveLifeScenes(life, engine.world);
    const birth = contexts.find(context => context.eventId === "the-first-household")!;
    const background = contexts.find(context => context.kind === "birth")!;
    assert.ok(birth && background);
    assert.equal(sceneContextLabel(birth), "Birth");
    assert.equal(sceneContextLabel(background), "Background");
    assert.equal(background.title, engine.world.origins.find(origin => origin.id === life.originId)!.title);
    assert.equal(engine.save(life), before);
  }
});

test("time advances from birth and the first actual decision occurs later in childhood", () => {
  const safe = structuredClone(pack) as WorldPack;
  safe.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  safe.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  safe.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  const engine = createEngine(safe);
  const openings = new Set<string>();
  for (let index = 0; index < 24; index++) {
    let life = engine.start(`later-childhood-choice-${index}`);
    const firstYear = engine.advance(life);
    assert.equal(firstYear.age, 1);
    assert.equal(firstYear.phase, "ready");
    assert.equal(firstYear.commands[0].type, "advance");
    life = firstYear;
    while (life.phase === "ready" && life.age < 8) life = engine.advance(life);
    assert.equal(life.phase, "choice");
    assert.equal(life.age, 3);
    const event = engine.world.events.find(event => event.id === life.pendingEventId)!;
    assert.equal(event.exclusiveGroup, "early-care");
    openings.add(event.id);
    assert.equal(life.commands.some(command => command.type === "choose"), false);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.ok(openings.size >= 3, "The first decision should have several reachable scenarios rather than the same courtyard every run.");
});

test("complete lives after an automatic birth retain exact saves and no hidden birth command", () => {
  const engine = createEngine(pack);
  for (let index = 0; index < 24; index++) {
    let life = engine.start(`birth-situation-full-${index}`);
    for (let step = 0; step < 600 && life.phase !== "ended"; step++) {
      if (life.phase === "choice") {
        const choices = engine.getChoices(life);
        const safe = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0];
        life = engine.choose(life, safe.id);
      } else life = engine.advance(life);
    }
    assert.equal(life.phase, "ended");
    assert.equal(life.commands[0].type, "advance");
    assert.equal(life.commands.some(command => command.type === "choose" && ["family-care", "seek-help"].includes(command.choice)), false);
    assert.equal(life.journal.filter(entry => entry.type === "event" && entry.id === "the-first-household").length, 1);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});
