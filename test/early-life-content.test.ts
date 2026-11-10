import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import type { LifeEvent, WorldPack } from "../src/types.ts";
import { applyEarlyLife, EARLY_LIFE_GROUPS } from "../scripts/alexandria-early-life.mjs";
import original from "../worlds/alexandria-0.23.0.json" with { type: "json" };

type GroupEvent = LifeEvent & { exclusiveGroup?: string };
const world = applyEarlyLife(structuredClone(original)) as WorldPack;
const added = world.events.filter(event => event.id.startsWith("early-")) as GroupEvent[];
// Group selection is covered by engine tests. Strip only its presentation of
// mutually exclusive milestones here so this fixture isolates content guards.
const withoutGroups = structuredClone(world);
for (const event of withoutGroups.events as GroupEvent[]) delete event.exclusiveGroup;
const engine = createEngine(withoutGroups);
function context(age: number) {
  const life = structuredClone(engine.start("early-content-context"));
  life.age = age;
  life.year = world.startYear + age;
  return life;
}

test("opening content supplies three new alternatives per stage and twenty annual scenes", () => {
  assert.equal(added.length, 35);
  assert.equal(added.filter(event => event.mode === "automatic").length, 20);
  assert.equal(added.filter(event => event.mode !== "automatic").length, 15);
  assert.equal(new Set(added.map(event => event.title)).size, 35);
  assert.equal(new Set(added.map(event => event.text)).size, 35);
  for (const event of added) {
    assert.equal(event.evidence, "fictional");
    assert.deepEqual(event.sourceIds, []);
    assert.equal(event.maxOccurrences, 1);
    for (const effect of event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))) {
      assert.ok(!["condition", "end", "loan", "mastery"].includes(effect.type), `${event.id} adds a major unrelated hazard or reward`);
    }
    if (event.mode === "automatic") assert.deepEqual(event.effects, []);
  }
});

test("each opening group retains its original milestone and always has an eligible fallback", () => {
  for (const [group, definition] of Object.entries(EARLY_LIFE_GROUPS) as [string, { age: number; original: string }][]) {
    const events = (world.events as GroupEvent[]).filter(event => event.exclusiveGroup === group);
    assert.equal(events.length, 4, group);
    assert.ok(events.some(event => event.id === definition.original));
    for (const event of events) {
      assert.deepEqual(event.trigger, { type: "age", at: definition.age });
      if (event.id.startsWith("early-")) assert.ok(event.choices.some(choice => !choice.when), `${event.id} needs an unconditional way forward`);
      for (const jobId of [null, "porter", "apprentice"]) {
        const life = context(definition.age);
        life.character!.jobId = jobId;
        assert.ok(event.choices.some(choice => matchesCondition(choice.when, life)), `${event.id} needs a fallback for ${jobId ?? "no job"}`);
      }
      assert.notEqual(event.mode, "automatic");
    }
    assert.deepEqual(world.events.find(event => event.id === definition.original)!.choices,
      original.events.find(event => event.id === definition.original)!.choices,
      "The retained original keeps its existing authored outcomes.");
  }
});

test("new job offers enforce the real age and skill requirements instead of bypassing them", () => {
  let offers = 0;
  for (const event of added) for (const choice of event.choices) {
    const jobEffect = choice.outcomes.flatMap(outcome => outcome.effects).find(effect => effect.type === "job");
    if (jobEffect?.type !== "job") continue;
    offers++;
    const definition = world.character!.jobs.find(job => job.id === jobEffect.job)!;
    assert.ok(definition);
    const life = context(definition.minAge - 1);
    for (const [id, amount] of Object.entries(definition.requirements ?? {})) life.character!.skills[id] = amount;
    assert.equal(matchesCondition(choice.when, life), false, `${choice.id}: too young`);
    life.age = definition.minAge;
    assert.equal(matchesCondition(choice.when, life), true, `${choice.id}: qualified`);
    for (const [id, amount] of Object.entries(definition.requirements ?? {})) {
      life.character!.skills[id] = amount - 1;
      assert.equal(matchesCondition(choice.when, life), false, `${choice.id}: missing ${id}`);
      life.character!.skills[id] = amount;
    }
    life.character!.jobId = definition.id;
    assert.equal(matchesCondition(choice.when, life), false, `${choice.id}: already employed in this job`);
  }
  assert.ok(offers >= 12);
});

test("childhood annual scenes respect ages and household-specific scenes require the actual origin", () => {
  const annual = added.filter(event => event.mode === "automatic");
  for (const event of annual) {
    assert.equal(matchesCondition(event.when, context(0)), false, event.id);
    assert.equal(matchesCondition(event.when, context(11)), false, event.id);
  }
  const homeEvent = world.events.find(event => event.id === "early-year-fishing-float")!;
  const life = context(6);
  life.originId = "merchant-household";
  assert.equal(matchesCondition(homeEvent.when, life), false);
  life.originId = "fishing-household";
  assert.equal(matchesCondition(homeEvent.when, life), true);
  assert.deepEqual(world.health, original.health);
  assert.deepEqual(world.mortality, original.mortality);
  assert.deepEqual(world.economy, original.economy);
  assert.deepEqual(world.character, original.character);
  assert.deepEqual(world.origins, original.origins);
  assert.deepEqual(world.sources, original.sources);
});

test("every early learning alternative leaves a route into reading and no new choice spends unaffordable cash", () => {
  const learning = (world.events as GroupEvent[]).filter(event => event.exclusiveGroup === "early-learning" && event.id.startsWith("early-"));
  for (const event of learning) {
    assert.ok(event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "skill" && effect.skill === "literacy" && effect.delta > 0))), event.id);
  }
  for (const event of added) for (const choice of event.choices) for (const outcome of choice.outcomes) {
    assert.ok(!outcome.effects.some(effect => effect.type === "cash" && effect.delta < 0 || effect.type === "stat" && effect.stat === "wealth" && effect.delta < 0), choice.id);
  }
});
