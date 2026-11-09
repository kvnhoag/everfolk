import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import registry from "../research/sources.json" with { type: "json" };
import mortalityModel from "../research/mortality-model.json" with { type: "json" };

function complete(engine: LifeEngine, seed: string, career = "stay"): LifeState {
  let state = engine.start(seed);
  for (let command = 0; command < 500 && state.phase !== "ended"; command++) {
    if (state.phase === "choice") {
      const choices = engine.getChoices(state);
      const choice = state.pendingEventId === "a-place-on-the-manifest"
        ? choices.find(choice => choice.id === career)
        : choices.find(choice => choice.id === "learn-letters") ?? choices[0];
      assert.ok(choice, "Every offered decision needs an available choice.");
      state = engine.choose(state, choice.id);
    } else state = engine.advance(state);
  }
  assert.equal(state.phase, "ended", "Every complete test life must terminate within its documented bounds.");
  return state;
}

function safeEngine(): LifeEngine {
  const copy = structuredClone(pack);
  copy.mortality.bands.forEach(band => { band.annualProbability = 0; });
  return createEngine(copy);
}

test("the shipped world embeds the exact research registry and all evidence references resolve", () => {
  assert.deepEqual(pack.sources, registry);
  const ids = new Set(registry.map(source => source.id));
  assert.equal(ids.size, registry.length);
  for (const item of [...pack.origins, ...pack.events, ...pack.endings]) {
    assert.ok(item.evidence, `${item.id} must classify its historical support.`);
    for (const sourceId of item.sourceIds) assert.ok(ids.has(sourceId), `${item.id} has unknown source ${sourceId}.`);
    if (item.evidence !== "fictional") assert.ok(item.sourceIds.length > 0, `${item.id} requires supporting references.`);
  }
  assert.deepEqual(pack.mortality.sourceIds, mortalityModel.sourceIds);
  for (const sourceId of pack.mortality.sourceIds) assert.ok(ids.has(sourceId));
  assert.ok(registry.every(source => source.limitations.length > 0 && source.period.length > 0 && source.geography.length > 0));
});

test("only the four dated political anchors are classified as documented personal-world history", () => {
  const documented = pack.events.filter(event => event.evidence === "documented-history");
  assert.deepEqual(documented.map(event => event.id).sort(), ["caesar-in-alexandria", "news-of-actium", "roman-rule", "water-and-war"].sort());
  assert.ok(documented.every(event => event.mode === "automatic" && event.choices.length === 0));
  assert.ok(pack.events.filter(event => event.choices.length > 0).every(event => event.evidence !== "documented-history"));
});

test("annual hazards recover each closed source interval's conditional death probability", () => {
  assert.equal(pack.mortality.bands.length, mortalityModel.intervals.length + 1);
  for (const row of mortalityModel.intervals) {
    const band = pack.mortality.bands.find(band => band.minAge === row.minAge);
    assert.ok(band);
    assert.equal(band.maxAge, row.nextAge - 1);
    assert.ok(band.annualProbability > 0 && band.annualProbability < 1);
    const recoveredIntervalProbability = 1 - (1 - band.annualProbability) ** (row.nextAge - row.minAge);
    assert.ok(Math.abs(recoveredIntervalProbability - row.deathProbability) < 1e-12);
  }
  const tail = pack.mortality.bands.at(-1)!;
  assert.equal(tail.minAge, mortalityModel.oldestAgeTail.minAge);
  assert.equal(tail.maxAge, mortalityModel.oldestAgeTail.maxAge);
  assert.ok(tail.annualProbability > 0 && tail.annualProbability < 1, "An open-ended source interval must not become a guaranteed annual death.");
  assert.ok(Math.abs(tail.annualProbability - -Math.expm1(-1 / mortalityModel.oldestAgeTail.sourceRemainingLifeExpectancy)) < 1e-12);
});

test("historical anchors occur in their documented calendar years and the correct lived ages", () => {
  const engine = safeEngine();
  const life = complete(engine, "calendar-full-life");
  for (const [id, year, age] of [
    ["caesar-in-alexandria", -48, 18],
    ["water-and-war", -47, 19],
    ["news-of-actium", -31, 35],
    ["roman-rule", -30, 36],
  ] as const) {
    const entries = life.journal.filter(entry => entry.type === "event" && entry.id === id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].year, year);
    assert.equal(entries[0].age, age);
  }
  const conquestIndex = life.journal.findIndex(entry => entry.type === "event" && entry.id === "roman-rule");
  const adaptationIndex = life.journal.findIndex(entry => entry.type === "event" && entry.id === "after-the-transition");
  assert.ok(conquestIndex >= 0 && adaptationIndex > conquestIndex);
  assert.ok(life.journal.every(entry => entry.year !== 0));
});

test("zero-risk coverage runs reach all life stages and a death ending at the computational cap", () => {
  const engine = safeEngine();
  for (const career of ["stay", "sail", "study"]) {
    const life = complete(engine, `full-stage-${career}`, career);
    assert.equal(life.age, 100);
    assert.equal(life.phase, "ended");
    assert.equal(life.endingId, pack.defaultEnding);
    assert.equal(engine.world.endings.find(ending => ending.id === life.endingId)?.kind, "death");
    for (const id of ["the-first-household", "first-steps", "the-first-letters", "a-place-to-learn", "a-place-on-the-manifest", "care-between-generations", "stepping-back", "putting-things-in-order", "the-small-pleasures", "an-extraordinary-age", "a-quiet-room"]) {
      assert.ok(life.journal.some(entry => entry.type === "event" && entry.id === id), `Missing ${id} on ${career} path.`);
    }
    assert.equal(life.flags.partnered, true);
    assert.equal(life.flags.parent, true);
    assert.equal(life.flags.retired, true);
    assert.equal(life.flags[career === "stay" ? "stayed" : career === "sail" ? "sailed" : "studied"], true);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("a zero-risk infancy interval advances exactly one birthday and records a yearly brief", () => {
  const engine = safeEngine();
  const born = engine.start("zero-risk-birth");
  const caredFor = engine.choose(born, "family-care");
  const firstBirthday = engine.advance(caredFor);
  assert.equal(firstBirthday.age, 1);
  assert.equal(firstBirthday.year, -65);
  assert.equal(firstBirthday.phase, "ready");
  assert.ok(firstBirthday.journal.some(entry => entry.age === 1 && entry.type === "event" &&
    engine.world.events.some(event => event.id === entry.id && event.mode === "automatic" && event.trigger.type === "random")));
  assert.ok(firstBirthday.journal.every(entry => entry.type !== "ending"));
});

test("seeded complete lives include infant, child, adult and old-age deaths without forced age-23 endings", () => {
  const engine = createEngine(pack);
  // Fixed seeds found with a bounded search, rather than assuming every run
  // survives to a chosen milestone or treating test frequencies as evidence.
  const cases = [
    { seed: "coverage-3", minAge: 0, maxAge: 0, ending: "death-in-infancy" },
    { seed: "coverage-4", minAge: 1, maxAge: 14, ending: "death-in-childhood" },
    { seed: "coverage-0", minAge: 15, maxAge: 59, ending: "death-in-adulthood" },
    { seed: "coverage-1", minAge: 60, maxAge: 100, ending: "death-in-later-life" },
  ];
  for (const item of cases) {
    const life = complete(engine, item.seed);
    assert.ok(life.age >= item.minAge && life.age <= item.maxAge);
    assert.equal(life.endingId, item.ending);
    assert.equal(engine.world.endings.find(ending => ending.id === life.endingId)?.kind, "death");
    assert.equal(life.pendingEventId, null);
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("every completed living year has its own background brief alongside historical anchors", () => {
  const engine = safeEngine();
  const life = complete(engine, "yearly-brief-coverage");
  const ambientIds = new Set(engine.world.events
    .filter(event => event.mode === "automatic" && event.trigger.type === "random")
    .map(event => event.id));
  const briefs = life.journal.filter(entry => entry.type === "event" && ambientIds.has(entry.id));
  for (let age = 1; age < pack.maxAge; age++) {
    assert.equal(briefs.filter(entry => entry.age === age).length, 1, `Age ${age} needs exactly one yearly background brief.`);
  }
  assert.ok(new Set(briefs.map(entry => entry.id)).size >= 25, "Annual briefs should use the age-specific content pools.");
  for (const age of [18, 19, 35, 36]) {
    assert.ok(life.journal.some(entry => entry.type === "event" && entry.age === age &&
      engine.world.events.some(event => event.id === entry.id && event.trigger.type === "year")));
    assert.equal(briefs.filter(entry => entry.age === age).length, 1, "Historical dates must not replace the personal yearly brief.");
  }
  assert.ok(life.journal.filter(entry => entry.type === "choice").some(choice => briefs.some(brief => brief.age === choice.age)),
    "A decision year should still retain its background brief.");
});

test("the shipped personal decision pools sustain two-to-three-year gaps through a full life", () => {
  const engine = safeEngine();
  assert.deepEqual(pack.eventPacing, { minChoiceGapYears: 2, maxChoiceGapYears: 3 });
  for (let seed = 0; seed < 12; seed++) {
    const life = complete(engine, `cadence-${seed}`);
    const decisions = life.journal.filter(entry => entry.type === "choice");
    assert.equal(decisions[0].age, 0);
    for (let i = 1; i < decisions.length; i++) {
      const gap = decisions[i].age - decisions[i - 1].age;
      assert.ok(gap >= 2 && gap <= 3, `Decision gap at age ${decisions[i].age} was ${gap} years.`);
    }
    assert.ok(decisions.at(-1)!.age >= 97, "Later life must not run out of eligible decisions.");
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});
