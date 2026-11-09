import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState } from "../src/types.ts";
// Retain the original Roman-era chronology and evidence audit under its exact release.
import pack from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import namedCatalog from "../worlds/alexandria-0.28.0.json" with { type: "json" };
import comparisonPack from "../worlds/alexandria-0.14.0.json" with { type: "json" };
import registry from "../research/sources.json" with { type: "json" };
import mortalityModel from "../research/mortality-model.json" with { type: "json" };
import gameBalance from "../research/game-balance.json" with { type: "json" };

function complete(engine: LifeEngine, seed: string, career = "stay", manageFamily = false): LifeState {
  let state = engine.start(seed);
  for (let command = 0; command < 500 && state.phase !== "ended"; command++) {
    if (state.phase === "choice") {
      const choices = engine.getChoices(state);
      const choice = state.pendingEventId === "a-place-on-the-manifest"
        ? choices.find(choice => choice.id === (career === "stay" && state.character?.jobId === "porter" ? "keep-regular-job" : career))
        : choices.find(choice => choice.id === "learn-letters")
          ?? choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end")))
          ?? choices[0];
      assert.ok(choice, "Every offered decision needs an available choice.");
      state = engine.choose(state, choice.id);
    } else {
      const character = state.character!;
      let activityId: string | undefined;
      if (state.age < 18 && career === "study" && character.skills.literacy < 30) activityId = "train-literacy";
      else if (state.age < 18 && career === "sail" && character.skills.seamanship < 15) activityId = "train-seamanship";
      else if (manageFamily && state.age >= 25) {
        if (character.relationshipStatus === "single") activityId = "court-demetria";
        else if (character.relationshipStatus === "courting") activityId = "marry-demetria";
        else if (character.relationshipStatus === "married" && character.children.length === 0 &&
          state.journal.some(entry => entry.type === "event" && entry.id === "a-new-generation")) activityId = "grow-household";
      }
      const activity = engine.getActivities(state).find(candidate => candidate.id === activityId && candidate.available);
      state = activity ? engine.act(state, activity.id) : engine.advance(state);
    }
  }
  assert.equal(state.phase, "ended", "Every complete test life must terminate within its documented bounds.");
  return state;
}

function safeEngine(originalOpening = false, source = pack): LifeEngine {
  const copy = structuredClone(source);
  if (originalOpening) {
    // This controlled route check covers the retained career milestones. The
    // opening-variation engine/content tests exercise the other alternatives.
    const originals = new Set(["a-child-in-the-courtyard", "the-first-letters", "a-place-to-learn", "the-first-wages", "a-place-on-the-manifest"]);
    copy.events = copy.events.filter(event => !("exclusiveGroup" in event) || originals.has(event.id));
    for (const event of copy.events) if ("exclusiveGroup" in event) delete event.exclusiveGroup;
  }
  // This fixture isolates ordinary stage coverage and decision cadence.
  if (copy.eventPacing.rareEvents) copy.eventPacing.rareEvents.annualChance = 0;
  copy.mortality.bands.forEach(band => { band.annualProbability = 0; });
  copy.health.incidenceBands.forEach(band => { band.annualProbability = 0; });
  copy.health.declineBands.forEach(band => { band.healthLoss = 0; });
  // This fixture covers every authored stage, rather than health progression.
  // Keep the current health-enabled state and record ending while ensuring
  // incidental narrative stat losses cannot end the content-coverage run.
  copy.yearlyEffects.push({ type: "stat", stat: "health", delta: 100 });
  // These fixtures isolate stage coverage and career qualifications from cash
  // scarcity; the unmodified economy is exercised in its own integration runs.
  copy.stats.wealth.initial = 80;
  copy.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of copy.origins) origin.statRanges.wealth = { min: 80, max: 80 };
  return createEngine(copy);
}

test("the retained 0.31 world embeds its exact research registry and all evidence references resolve", () => {
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

test("the retained 0.31 world classifies only its four Roman-era anchors as documented history", () => {
  const documented = pack.events.filter(event => event.evidence === "documented-history");
  assert.deepEqual(documented.map(event => event.id).sort(), ["caesar-in-alexandria", "news-of-actium", "roman-rule", "water-and-war"].sort());
  assert.ok(documented.every(event => event.mode === "automatic" && event.choices.length === 0));
  assert.ok(pack.events.filter(event => event.choices.length > 0).every(event => event.evidence !== "documented-history"));
});

test("the retained 0.14 comparison conversion preserves the source and its reduced age-band probabilities", () => {
  assert.equal(comparisonPack.mortality.bands.length, mortalityModel.intervals.length + 2);
  for (const row of mortalityModel.intervals) {
    const sourceAnnual = 1 - (1 - row.deathProbability) ** (1 / (row.nextAge - row.minAge));
    const recoveredIntervalProbability = 1 - (1 - sourceAnnual) ** (row.nextAge - row.minAge);
    assert.ok(Math.abs(recoveredIntervalProbability - row.deathProbability) < 1e-12);
    for (let age = row.minAge; age < row.nextAge; age++) {
      const band = comparisonPack.mortality.bands.find(band => age >= band.minAge && age <= band.maxAge);
      assert.ok(band);
      const factor = gameBalance.mortality.ageMultipliers.find(range => age >= range.minAge && age <= range.maxAge)?.multiplier ?? gameBalance.mortality.defaultMultiplier;
      assert.ok(Math.abs(band.annualProbability - sourceAnnual * factor) < 1e-12);
      assert.ok(factor > 0 && factor < 1, `Age ${age} retains a reduced, nonzero background risk.`);
    }
  }
  const tail = comparisonPack.mortality.bands.at(-1)!;
  assert.equal(tail.minAge, mortalityModel.oldestAgeTail.minAge);
  assert.equal(tail.maxAge, mortalityModel.oldestAgeTail.maxAge);
  assert.ok(tail.annualProbability > 0 && tail.annualProbability < 1, "An open-ended source interval must not become a guaranteed annual death.");
  assert.ok(Math.abs(tail.annualProbability - -Math.expm1(-1 / mortalityModel.oldestAgeTail.sourceRemainingLifeExpectancy)) < 1e-12);
});

test("retained Roman-era anchors occur in their documented calendar years and the correct lived ages", () => {
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

test("controlled content coverage reaches all life stages and ends the record without inventing a death", () => {
  const engine = safeEngine(true, namedCatalog);
  for (const career of ["stay", "sail", "study"]) {
    const life = complete(engine, `full-stage-${career}`, career, true);
    assert.equal(life.age, 100);
    assert.equal(life.phase, "ended");
    assert.equal(life.endingId, pack.defaultEnding);
    assert.equal(engine.world.endings.find(ending => ending.id === life.endingId)?.kind, "chapter");
    assert.equal(life.deathCauseId, undefined);
    for (const id of ["the-first-household", "first-steps", "the-first-letters", "a-place-to-learn", "a-place-on-the-manifest", "a-new-generation", "care-between-generations", "stepping-back", "putting-things-in-order", "the-small-pleasures", "an-extraordinary-age", "a-quiet-room"]) {
      assert.ok(life.journal.some(entry => entry.type === "event" && entry.id === id), `Missing ${id} on ${career} path.`);
    }
    assert.equal(life.flags.partnered, true);
    assert.equal(life.flags.parent, true);
    assert.equal(life.character!.partnerId, "demetria");
    assert.equal(life.character!.relationshipStatus, "married");
    assert.equal(life.character!.children.length, 1);
    const child = life.character!.children[0];
    assert.ok(pack.character.childNames.includes(child.name));
    assert.equal(child.otherParentId, "demetria");
    assert.ok(child.birthAge >= 28 && child.birthAge <= 43);
    for (const activity of ["court-demetria", "marry-demetria", "grow-household"]) {
      assert.ok(life.commands.some(command => command.type === "act" && command.activity === activity), `Missing explicit ${activity} command.`);
    }
    assert.equal(life.flags.retired, true);
    if (career === "stay") {
      assert.ok(life.journal.some(entry => entry.type === "choice" && entry.id === "keep-regular-job"), "An existing porter can keep the job rather than being hired twice.");
    } else assert.equal(life.flags[career === "sail" ? "sailed" : "studied"], true);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("household milestone conversations never invent a partner or child", () => {
  const engine = safeEngine();
  const life = complete(engine, "independent-household");
  assert.ok(life.journal.some(entry => entry.type === "event" && entry.id === "a-shared-household"));
  assert.equal(life.journal.some(entry => entry.type === "choice" && ["share-life", "remain-independent", "share-parenting", "ask-kin"].includes(entry.id)), false);
  assert.equal(life.character!.relationshipStatus, "single");
  assert.equal(life.character!.partnerId, null);
  assert.deepEqual(life.character!.children, []);
  assert.equal(life.flags.partnered, false);
  assert.equal(life.flags.parent, false);
  assert.equal(life.commands.some(command => command.type === "act"), false);
  assert.equal(life.journal.some(entry => entry.type === "event" && entry.id === "a-new-generation"), false);
});

test("a zero-risk infancy interval advances exactly one birthday and records a yearly brief", () => {
  const engine = safeEngine();
  const born = engine.start("zero-risk-birth");
  const firstBirthday = engine.advance(born);
  assert.equal(firstBirthday.age, 1);
  assert.equal(firstBirthday.year, -65);
  assert.equal(firstBirthday.phase, "ready");
  assert.ok(firstBirthday.journal.some(entry => entry.age === 1 && entry.type === "event" &&
    engine.world.events.some(event => event.id === entry.id && event.mode === "automatic" && event.trigger.type === "random")));
  assert.ok(firstBirthday.journal.every(entry => entry.type !== "ending"));
});

test("retained 0.14 seeded lives preserve infant, child, adult and old-age death outcomes", () => {
  const engine = createEngine(comparisonPack);
  // Fixed seeds found with a bounded search, rather than assuming every run
  // survives to a chosen milestone or treating test frequencies as evidence.
  const cases = [
    { seed: "situation-death-110", minAge: 0, maxAge: 0, ending: "death-in-infancy" },
    { seed: "situation-death-17", minAge: 1, maxAge: 14, ending: "death-in-childhood" },
    { seed: "situation-death-0", minAge: 15, maxAge: 59, ending: "death-in-adulthood" },
    { seed: "situation-death-2", minAge: 60, maxAge: 100, ending: "death-in-later-life" },
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

test("the retained 0.31 personal decision pools sustain two-to-three-year gaps through a full life", () => {
  const engine = safeEngine();
  assert.equal(pack.eventPacing.minChoiceGapYears, 2);
  assert.equal(pack.eventPacing.maxChoiceGapYears, 3);
  for (let seed = 0; seed < 12; seed++) {
    const life = complete(engine, `cadence-${seed}`);
    const decisions = life.journal.filter(entry => entry.type === "choice");
    assert.equal(decisions[0].age, 3);
    for (let i = 1; i < decisions.length; i++) {
      const gap = decisions[i].age - decisions[i - 1].age;
      assert.ok(gap >= 2 && gap <= 3, `Decision gap at age ${decisions[i].age} was ${gap} years.`);
    }
    assert.ok(decisions.at(-1)!.age >= 97, "Later life must not run out of eligible decisions.");
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});
