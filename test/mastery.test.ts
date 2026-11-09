import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { applyStatDelta } from "../src/progression.ts";
import type { Effect, LifeState, WorldPack } from "../src/types.ts";
import { getChoiceImpact } from "../client/choice-impact.ts";
import { getSkillImpact } from "../client/skill-impact.ts";
import { getMasteryPreviews } from "../client/mastery.ts";
import alexandria from "../worlds/alexandria-sample.json" with { type: "json" };

const mastery: Effect[] = [{ type: "mastery", target: "stat", id: "knowledge" }, { type: "mastery", target: "skill", id: "pottery" }];
function fixture(effects = mastery): WorldPack {
  const definition = (label: string, initial: number) => ({ label, min: 0, max: 100, initial,
    gainCurve: [{ from: 0, multiplier: 1 }, { from: 50, multiplier: 0.2 }, { from: 80, multiplier: 0.05 }] });
  return { schemaVersion: 1, id: "mastery-test", version: "1", title: "Mastery", description: "Synthetic rare reward.", startYear: -50, maxAge: 80,
    stats: { knowledge: definition("Knowledge", 70) }, flags: {}, origins: [{ id: "home", title: "Home", text: "Home.", weight: 1, effects: [] }], yearlyEffects: [],
    eventPacing: { minChoiceGapYears: 3, maxChoiceGapYears: 3, rareEvents: { annualChance: 1, cooldownYears: 12 } },
    knowledge: { stat: "knowledge", minAge: 1, idleGraceYears: 2, idleLoss: 1, ageBands: [{ minAge: 0, maxAge: 79, loss: 0 }], description: "Synthetic retention." },
    character: { skills: { pottery: definition("Pottery", 60) }, jobs: [], partners: [], childNames: ["Child"], deathCauseDescription: "Synthetic.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [{ id: "rest", text: "Rest", category: "training", outcomes: [{ id: "rested", text: "You rest.", weight: 1, effects: [] }] }] },
    events: [{ id: "mastery", title: "Mastery", text: "Your practice pays off.", trigger: { type: "random", weight: 1 }, rarity: "rare", maxOccurrences: 1,
      when: { type: "age", op: "gte", value: 18 }, choices: [{ id: "finish", text: "Finish the work", outcomes: [{ id: "mastered", text: "You complete the work.", weight: 1, effects }] }] }],
    endings: [{ id: "complete", title: "Complete", text: "Complete.", kind: "chapter" }], defaultEnding: "complete" };
}
function opportunity(engine: ReturnType<typeof createEngine>, seed = "mastery"): LifeState {
  let life = engine.start(seed);
  while (life.age < 18) life = engine.advance(life);
  assert.equal(life.pendingEventId, "mastery");
  return life;
}

test("rare mastery reaches exact existing stat and skill caps without weakening ordinary growth", () => {
  const engine = createEngine(fixture()), life = opportunity(engine);
  assert.ok(applyStatDelta(engine.world.stats.knowledge, life.stats.knowledge, 30) < 100);
  assert.ok(applyStatDelta(engine.world.character!.skills.pottery, 60, 40) < 100);
  const capped = engine.choose(life, "finish");
  assert.equal(capped.stats.knowledge, 100);
  assert.equal(capped.character!.skills.pottery, 100);
  assert.equal(engine.world.stats.knowledge.max, 100);
  assert.equal(engine.world.character!.skills.pottery.max, 100);
  assert.equal(capped.knowledge!.lastPracticeAge, 18);
  assert.deepEqual(engine.load(engine.save(capped)), capped);
  assert.deepEqual(engine.replay(capped.seed, capped.commands), capped);
  const following = engine.advance(capped);
  assert.equal(following.stats.knowledge, 100, "mastery records accepted learning");
  assert.equal(engine.advance(engine.advance(following)).stats.knowledge, 99, "normal future inactivity still applies after two completed idle years");
});

test("mastery previews match ordered engine results, normalized odds and immutable life state", () => {
  const engine = createEngine(fixture([...mastery, { type: "stat", stat: "knowledge", delta: -3 }, { type: "skill", skill: "pottery", delta: -2 }]));
  const life = opportunity(engine), choice = engine.getChoices(life)[0], original = engine.save(life);
  const stats = getChoiceImpact(choice, life, engine.world), skills = getSkillImpact(choice, life, engine.world);
  const previews = getMasteryPreviews(choice, life, engine.world);
  assert.deepEqual(previews, [], "a penalty after mastery prevents a final-cap promise");
  const result = engine.choose(life, choice.id);
  assert.equal(result.stats.knowledge, 97);
  assert.equal(result.character!.skills.pottery, 98);
  assert.equal(stats.stats[0].max, result.stats.knowledge - life.stats.knowledge);
  assert.equal(skills[0].max, 38);
  assert.equal(engine.save(life), original);
  const weighted = structuredClone(choice);
  weighted.outcomes[0].weight = 1;
  weighted.outcomes[0].effects = mastery;
  weighted.outcomes.push({ id: "ordinary", text: "You finish without a breakthrough.", weight: 3, effects: [] });
  const capPreviews = getMasteryPreviews(weighted, life, engine.world);
  assert.equal(capPreviews.length, 2);
  assert.ok(capPreviews.every(item => item.cap === 100 && item.probability === 0.25));
});

test("effects after an ending do not grant or preview mastery", () => {
  const engine = createEngine(fixture([{ type: "end", ending: "complete" }, ...mastery]));
  const life = opportunity(engine), choice = engine.getChoices(life)[0];
  assert.deepEqual(getSkillImpact(choice, life, engine.world), []);
  assert.deepEqual(getMasteryPreviews(choice, life, engine.world), []);
  assert.equal(getChoiceImpact(choice, life, engine.world).stats[0].max, 0);
  const ended = engine.choose(life, "finish");
  assert.equal(ended.character!.skills.pottery, 60);
  assert.equal(ended.stats.knowledge, life.stats.knowledge);
});

test("mastery rejects malformed targets, unknown references and currency caps", () => {
  for (const effect of [
    { type: "mastery", target: "other", id: "knowledge" }, { type: "mastery", target: "stat", id: "missing" },
    { type: "mastery", target: "skill", id: "missing" }, { type: "mastery", target: "stat" },
    { type: "mastery", target: "stat", id: "knowledge", delta: 100 },
  ]) assert.throws(() => validateWorld(fixture([effect as Effect])), /mastery|expected|unknown|required/);
  const noCharacter = fixture([{ type: "mastery", target: "skill", id: "pottery" }]); delete noCharacter.character;
  assert.throws(() => validateWorld(noCharacter), /requires a character/);
  const money = structuredClone(alexandria) as WorldPack;
  money.events.find(event => event.rarity === "rare")!.choices[0].outcomes[0].effects = [{ type: "mastery", target: "stat", id: money.economy!.stat }];
  assert.throws(() => validateWorld(money), /cannot target the economy stat/);
});

test("only rare encounter choice outcomes may grant mastery", () => {
  const ordinary = fixture(); delete ordinary.events[0].rarity;
  assert.throws(() => validateWorld(ordinary), /only in rare encounter/);
  for (const context of ["origin", "year", "rule", "job", "automatic", "activity"]) {
    const world = fixture([]);
    if (context === "origin") world.origins[0].effects = mastery;
    if (context === "year") world.yearlyEffects = mastery;
    if (context === "rule") world.yearlyRules = [{ id: "annual", effects: mastery }];
    if (context === "job") world.character!.jobs.push({ id: "work", title: "Work", description: "Work.", minAge: 18, yearlyEffects: mastery });
    if (context === "automatic") world.events.push({ id: "automatic", title: "Automatic", text: "Automatic.", trigger: { type: "age", at: 2 }, mode: "automatic", choices: [], effects: mastery });
    if (context === "activity") world.character!.activities.push({ id: "train", text: "Train", category: "training", outcomes: [{ id: "trained", text: "Trained.", weight: 1, effects: mastery }] });
    assert.throws(() => validateWorld(world), /only in rare encounter/, context);
  }
});
