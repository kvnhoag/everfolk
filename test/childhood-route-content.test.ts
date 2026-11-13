import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { getOutcomeProbabilities, outcomeWeight } from "../src/outcomes.ts";
import { skillEffectDelta } from "../src/progression.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import type { Choice, Effect, LifeState, WorldPack } from "../src/types.ts";
// Preserve the childhood release's complete before/after comparison as later skills evolve.
import input from "../worlds/alexandria-0.27.0.json" with { type: "json" };
import archived from "../worlds/alexandria-0.25.0.json" with { type: "json" };

const world = input as WorldPack, previous = archived as WorldPack;
const engine = createEngine(world);
const groups = { "early-care": [12, 3], "early-learning": [12, 6], "early-training": [8, 12], "early-wages": [8, 14], "early-work": [8, 16] } as const;
const remembered = (effect: Effect) => effect.type === "flag" && effect.flag.startsWith("early-interest-");
const newEvents = world.events.filter(event => !previous.events.some(before => before.id === event.id) && !event.id.startsWith("credit-opportunity-"));
const allChoices = [...world.character!.activities, ...world.events.flatMap(event => event.choices)];
const memoryModifier = (reason: string) => reason === "A remembered early interest supports your preparation for this opportunity.";

test("0.26 expands each childhood stage with distinct authored choices and retains every original stage", () => {
  validateWorld(world);
  assert.equal(world.version, "0.27.0");
  assert.equal(world.events.length, 426);
  assert.equal(newEvents.length, 47);
  assert.equal(newEvents.filter(event => event.id.startsWith("child-route-")).length, 28);
  assert.equal(newEvents.filter(event => event.id.startsWith("child-memory-ambient-")).length, 12);
  assert.equal(newEvents.filter(event => event.id.startsWith("early-interest-recalled-")).length, 7);
  for (const [name, [count, age]] of Object.entries(groups)) {
    const events = world.events.filter(event => event.exclusiveGroup === name);
    assert.equal(events.length, count, name);
    for (const event of events) assert.deepEqual(event.trigger, { type: "age", at: age });
    for (const old of previous.events.filter(event => event.exclusiveGroup === name)) assert.ok(events.some(event => event.id === old.id));
  }
  assert.equal(new Set(newEvents.map(event => event.title)).size, 47);
  assert.equal(new Set(newEvents.map(event => event.text)).size, 47);
  for (const event of newEvents) {
    assert.equal(event.evidence, "fictional"); assert.deepEqual(event.sourceIds, []);
    for (const effect of [...(event.effects ?? []), ...event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))]) {
      assert.ok(!["condition", "end", "loan", "mastery", "accomplishment"].includes(effect.type), `${event.id} invents a hazard or accepted career work`);
      assert.ok(!(effect.type === "cash" && effect.delta < 0 || effect.type === "stat" && ["health", "wealth"].includes(effect.stat) && effect.delta < 0), `${event.id} forces a cost or injury`);
    }
  }
});

test("all twelve learning alternatives offer free unconditional reading and a way forward from no skills", () => {
  for (const event of world.events.filter(event => event.exclusiveGroup === "early-learning")) {
    const reading = event.choices.find(choice => !choice.when && choice.outcomes.every(outcome =>
      outcome.effects.some(effect => effect.type === "skill" && effect.skill === "literacy" && effect.delta > 0)));
    assert.ok(reading, event.id);
    assert.ok(event.choices.some(choice => !choice.when));
    for (const outcome of reading.outcomes) assert.ok(!outcome.effects.some(effect => effect.type === "cash" && effect.delta < 0));
  }
});

test("every care scenario presents at least two choices with distinct remembered interests", () => {
  for (const event of world.events.filter(event => event.exclusiveGroup === "early-care")) {
    const choices = event.choices.map(choice => choice.outcomes.flatMap(outcome => outcome.effects.filter(remembered).map(effect => effect.type === "flag" ? effect.flag : ""))).filter(flags => flags.length);
    assert.ok(choices.length >= 2, `${event.id}: both active choices need a future interest`);
    assert.ok(new Set(choices.flat()).size >= 2, `${event.id}: the futures should differ`);
  }
  const visitors = world.events.find(event => event.id === "early-care-visitors")!;
  const flags = visitors.choices.map(choice => choice.outcomes.flatMap(outcome => outcome.effects.filter(remembered).map(effect => effect.type === "flag" ? effect.flag : "")));
  assert.deepEqual(flags, [["early-interest-philosophy"], ["early-interest-sculpture"]]);
});

test("new early job offers enforce actual occupation ages and every required proficiency", () => {
  let checked = 0;
  for (const event of newEvents) for (const choice of event.choices) {
    const job = choice.outcomes.flatMap(outcome => outcome.effects).find(effect => effect.type === "job");
    if (job?.type !== "job") continue;
    checked++;
    const definition = world.character!.jobs.find(item => item.id === job.job)!;
    const life = structuredClone(engine.start("childhood-job-guards"));
    life.age = definition.minAge - 1;
    for (const [id, amount] of Object.entries(definition.requirements ?? {})) life.character!.skills[id] = amount;
    assert.equal(matchesCondition(choice.when, life), false, `${choice.id}: under age`);
    life.age++;
    assert.equal(matchesCondition(choice.when, life), true, `${choice.id}: qualified`);
    for (const [id, amount] of Object.entries(definition.requirements ?? {})) {
      life.character!.skills[id] = amount - 1;
      assert.equal(matchesCondition(choice.when, life), false, `${choice.id}: missing ${id}`);
      life.character!.skills[id] = amount;
    }
    life.character!.jobId = job.job;
    assert.equal(matchesCondition(choice.when, life), false, `${choice.id}: duplicate occupation`);
  }
  assert.equal(checked, 9);
});

test("all seven interests can be learned through ordinary childhood play, accumulated and replayed", () => {
  const routes = world.legacy!.routes;
  assert.equal(routes.length, 7);
  for (const route of routes) {
    assert.equal(route.earlyInterestFlag, `early-interest-${route.id}`);
    assert.equal(world.flags[route.earlyInterestFlag!].initial, false);
    assert.ok(world.events.some(event => event.exclusiveGroup && event.choices.some(choice => choice.outcomes.some(outcome =>
      outcome.effects.some(effect => effect.type === "flag" && effect.flag === route.earlyInterestFlag && effect.value)))));
  }
  const observed = new Set<string>(); let accumulated: LifeState | undefined;
  for (let seed = 0; seed < 64 && (observed.size < 7 || !accumulated); seed++) {
    let life = engine.start(`childhood-memory-path-${seed}`);
    for (let command = 0; command < 100 && life.phase !== "ended" && (life.age < 18 || life.phase === "choice"); command++) {
      const before = routes.filter(route => life.flags[route.earlyInterestFlag!]);
      if (life.phase === "choice") {
        const choices = engine.getChoices(life);
        const newInterest = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.some(effect =>
          effect.type === "flag" && effect.flag.startsWith("early-interest-") && effect.value && !life.flags[effect.flag])));
        life = engine.choose(life, (newInterest ?? selectAutomaticChoice(choices, world, life)!).id);
      } else life = engine.advance(life);
      for (const route of before) assert.equal(life.flags[route.earlyInterestFlag!], true, "Later choices must not erase an earlier interest.");
      for (const route of routes) if (life.flags[route.earlyInterestFlag!]) observed.add(route.id);
    }
    if (routes.filter(route => life.flags[route.earlyInterestFlag!]).length >= 3) accumulated = life;
  }
  assert.equal(observed.size, 7);
  assert.ok(accumulated);
  assert.deepEqual(engine.replay(accumulated.seed, accumulated.commands), accumulated);
  assert.deepEqual(engine.load(engine.save(accumulated)), accumulated);
  for (const choice of allChoices) for (const outcome of choice.outcomes) for (const effect of outcome.effects.filter(remembered)) {
    assert.equal(effect.type === "flag" && effect.value, true);
    assert.ok(world.events.some(event => event.exclusiveGroup && event.choices.includes(choice)), `${choice.id}: memory added outside early decisions`);
  }
});

test("recognition scenes are delayed, memory-gated small reinforcements rather than occupations", () => {
  const life = structuredClone(engine.start("memory-recognition-guards"));
  const scenes = world.events.filter(event => event.id.startsWith("early-interest-recalled-"));
  assert.deepEqual(scenes.map(event => event.trigger.type === "age" && event.trigger.at), [18, 19, 20, 21, 22, 23, 24]);
  for (const scene of scenes) {
    assert.equal(matchesCondition(scene.when, life), false);
    const route = world.legacy!.routes.find(route => scene.id === `early-interest-recalled-${route.id}`)!;
    life.flags[route.earlyInterestFlag!] = true;
    assert.equal(matchesCondition(scene.when, life), true);
    assert.equal(scene.mode, "automatic"); assert.equal(scene.maxOccurrences, 1);
    assert.equal(scene.effects!.length, 1);
    assert.ok(scene.effects!.every(effect => effect.type === "skill" && effect.delta === 1 && !effect.gainModifiers));
  }
});

test("only the thirteen existing paid lessons gain a bounded remembered-interest practice modifier", () => {
  const lessons = world.character!.activities.filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "skill" && effect.gainModifiers)));
  assert.equal(lessons.length, 13);
  for (const lesson of lessons) {
    assert.equal(lesson.category, "training");
    for (const outcome of lesson.outcomes) for (const effect of outcome.effects) if (effect.type === "skill" && effect.gainModifiers) {
      assert.ok(outcome.effects.some(cost => cost.type === "cash" && cost.delta < 0 || cost.type === "stat" && cost.stat === world.economy!.stat && cost.delta < 0));
      assert.ok(effect.delta > 0);
      const none = skillEffectDelta(effect, {});
      const all = skillEffectDelta(effect, Object.fromEntries(effect.gainModifiers.map(modifier => [modifier.flag, true])));
      assert.ok(Math.abs(all - none * 1.2) < 1e-10);
      for (const modifier of effect.gainModifiers) {
        assert.equal(modifier.multiplier, 1.2);
        assert.ok(world.legacy!.routes.some(route => route.earlyInterestFlag === modifier.flag));
      }
    }
  }
  for (const event of world.events) for (const effect of [...(event.effects ?? []), ...event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))]) {
    assert.ok(!(effect.type === "skill" && effect.gainModifiers), `${event.id} is not a paid training activity`);
  }
});

test("career influence adds one OR-gated success-weight boost only to genuine uncertain opportunities", () => {
  let choices = 0, successes = 0;
  for (const choice of allChoices) {
    const boosted = choice.outcomes.filter(outcome => outcome.weightModifiers?.some(modifier => memoryModifier(modifier.reason)));
    if (!boosted.length) continue;
    choices++; successes += boosted.length;
    assert.ok(choice.opportunity && choice.outcomes.length > 1);
    const noMemory = structuredClone(engine.start(`weight-${choice.id}`));
    const withMemory = structuredClone(noMemory);
    for (const route of world.legacy!.routes) withMemory.flags[route.earlyInterestFlag!] = true;
    for (const outcome of boosted) {
      assert.ok(choice.opportunity!.outcomeIds.includes(outcome.id));
      const modifiers = outcome.weightModifiers!.filter(modifier => memoryModifier(modifier.reason));
      assert.equal(modifiers.length, 1); assert.equal(modifiers[0].multiplier, 1.2);
      assert.equal(modifiers[0].when.type, "any");
      assert.ok(Math.abs(outcomeWeight(world, withMemory, outcome) / outcomeWeight(world, noMemory, outcome) - 1.2) < 1e-10);
    }
    const ordinary = getOutcomeProbabilities(world, noMemory, choice).filter(branch => choice.opportunity!.outcomeIds.includes(branch.outcome.id)).reduce((sum, branch) => sum + branch.probability, 0);
    const supported = getOutcomeProbabilities(world, withMemory, choice).filter(branch => choice.opportunity!.outcomeIds.includes(branch.outcome.id)).reduce((sum, branch) => sum + branch.probability, 0);
    assert.ok(Math.abs(supported - 1.2 * ordinary / (1 - ordinary + 1.2 * ordinary)) < 1e-10, `${choice.id}: relative weighting, not added percentage points`);
  }
  assert.equal(choices, 19); assert.equal(successes, 19);
  for (const choice of allChoices.filter(choice => choice.outcomes.length === 1)) assert.ok(!choice.outcomes[0].weightModifiers?.some(modifier => memoryModifier(modifier.reason)), `${choice.id}: deterministic work gains no odds benefit`);
});

test("health, mortality, economy, qualifications and original outcomes remain exact apart from explicit interest data", () => {
  for (const field of ["stats", "health", "mortality", "economy", "origins", "sources", "yearlyEffects", "yearlyRules", "knowledge", "eventPacing"] as const) assert.deepEqual(world[field], previous[field], field);
  const strip = (choice: Choice) => {
    const copy = structuredClone(choice);
    for (const outcome of copy.outcomes) {
      outcome.effects = outcome.effects.filter(effect => !remembered(effect));
      for (const effect of outcome.effects) if (effect.type === "skill") delete effect.gainModifiers;
      if (outcome.weightModifiers) {
        outcome.weightModifiers = outcome.weightModifiers.filter(modifier => !memoryModifier(modifier.reason));
        if (!outcome.weightModifiers.length) delete outcome.weightModifiers;
      }
    }
    return copy;
  };
  const revisedCareCopy = new Set(["close-to-home", "play-with-neighbors", "early-care-go-market", "early-care-help-table", "early-care-stay-relative", "early-care-quiet-play"]);
  const compare = (choice: Choice, before: Choice) => {
    const stripped = strip(choice), expected = structuredClone(before);
    if (revisedCareCopy.has(choice.id)) {
      stripped.text = expected.text;
      for (let i = 0; i < stripped.outcomes.length; i++) stripped.outcomes[i].text = expected.outcomes[i].text;
    }
    assert.deepEqual(stripped, expected, choice.id);
  };
  for (const before of previous.character!.activities) compare(world.character!.activities.find(choice => choice.id === before.id)!, before);
  for (const event of previous.events) for (const before of event.choices) compare(world.events.find(current => current.id === event.id)!.choices.find(choice => choice.id === before.id)!, before);
  assert.deepEqual(world.character!.jobs, previous.character!.jobs);
  assert.deepEqual(world.character!.skills, previous.character!.skills);
  assert.deepEqual(world.legacy!.achievements, previous.legacy!.achievements);
});
