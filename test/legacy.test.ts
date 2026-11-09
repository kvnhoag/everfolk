import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, getAccomplishments, getLegacyRoutes, matchesCondition, validateWorld } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.24.0.json" with { type: "json" };
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";
import { contentFingerprint } from "../src/random.ts";

function controlled(prestige?: string): WorldPack {
  const world = structuredClone(current) as WorldPack;
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.yearlyEffects = []; world.yearlyRules = []; delete world.knowledge;
  const required = [world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)];
  world.events = world.events.filter(event => required.includes(event.id) || event.id.includes("-callback-") || event.id === prestige);
  if (prestige) world.eventPacing!.rareEvents = { annualChance: 1, cooldownYears: 12 };
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = { health: { min: 70, max: 70 }, knowledge: { min: 70, max: 70 }, bonds: { min: 80, max: 80 }, wealth: { min: 50, max: 50 } };
  }
  for (const skill of Object.values(world.character!.skills)) skill.initial = 70;
  return world;
}
function ageTo(engine: LifeEngine, life: LifeState, age: number): LifeState {
  while (life.phase === "ready" && life.age < age) life = engine.advance(life);
  return life;
}

test("only accepted work awards a named record, one per achievement, with exact provenance and replay", () => {
  const engine = createEngine(controlled());
  const before = ageTo(engine, engine.start("a-real-customer-order"), 16);
  const saved = engine.save(before);
  const rng = before.rngState;
  assert.equal(getAccomplishments(engine.world, before).length, 0);
  engine.getActivities(before); getLegacyRoutes(engine.world, before);
  assert.equal(engine.save(before), saved); assert.equal(before.rngState, rng);
  const after = engine.act(before, "small-figure-order");
  const record = after.accomplishments![0];
  assert.equal(record.achievementId, "sculpture-first-work");
  assert.equal(record.name, `${after.character!.name}'s Harbor Figure`);
  assert.deepEqual(record.people, ["Philista", "Menon"]);
  assert.equal(record.sourceId, "small-figure-order");
  assert.equal(record.outcomeId, "small-figure-order-result");
  assert.equal(record.age, 16); assert.equal(record.year, -50);
  assert.equal(before.accomplishments!.length, 0, "The previous public snapshot stays unchanged.");
  const again = engine.act(ageTo(engine, after, 18), "small-figure-order");
  assert.equal(again.accomplishments!.length, 1, "Repeat commissions do not duplicate earned credit.");
  assert.deepEqual(engine.load(engine.save(again)), again);
  assert.deepEqual(engine.replay(again.seed, again.commands), again);
});

test("callbacks wait for this life's actual work and refer to its saved name and introduced contacts", () => {
  const engine = createEngine(controlled());
  let life = ageTo(engine, engine.start("recognised-work"), 16);
  assert.equal(life.journal.some(entry => entry.id === "legacy-sculpture-callback-1"), false);
  life = engine.act(life, "small-figure-order");
  assert.equal(matchesCondition({ type: "accomplishment", achievement: "sculpture-first-work", minYears: 2 }, life), false);
  life = ageTo(engine, life, 18);
  const first = life.journal.find(entry => entry.id === "legacy-sculpture-callback-1")!;
  assert.ok(first.text.includes(life.accomplishments![0].name));
  assert.ok(first.text.includes("Philista") && first.text.includes("Menon"));
  assert.ok(!first.text.includes("{work:"));
  assert.equal(life.journal.some(entry => entry.id === "legacy-sculpture-callback-2"), false);
  life = ageTo(engine, life, 21);
  assert.equal(life.eventCounts["legacy-sculpture-callback-1"], 1);
  assert.equal(life.eventCounts["legacy-sculpture-callback-2"], 1);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("prestige refusal preserves the ordinary record and accepted prestige earns a separate record", () => {
  const engine = createEngine(controlled("legacy-sculpture-prestige"));
  let success: LifeState | undefined;
  for (let seed = 0; seed < 24 && !success; seed++) {
    let life = ageTo(engine, engine.start(`prestige-${seed}`), 16);
    life = engine.act(life, "small-figure-order");
    life = ageTo(engine, life, 24);
    assert.equal(life.pendingEventId, "legacy-sculpture-prestige");
    const declined = engine.choose(life, "decline-sculpture-prestige");
    assert.equal(declined.accomplishments!.length, 1);
    const attempted = engine.choose(life, "attempt-sculpture-prestige");
    if (attempted.accomplishments!.some(record => record.kind === "prestige")) success = attempted;
    else assert.equal(attempted.accomplishments!.length, 1);
  }
  assert.ok(success, "A reproducible accepted prestige outcome must exist.");
  assert.deepEqual(engine.load(engine.save(success)), success);
});

test("all seven routes award real ordinary work, both callbacks and a replayable accepted prestige outcome", () => {
  for (const route of (current as WorldPack).legacy!.routes) {
    const [first, prestige] = route.achievementIds;
    const activity = (current as WorldPack).character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === first)))!;
    let accepted: LifeState | undefined;
    const engine = createEngine(controlled(`legacy-${route.id}-prestige`));
    for (let seed = 0; seed < 32 && !accepted; seed++) {
      let life = ageTo(engine, engine.start(`all-route-${route.id}-${seed}`), route.id === "military" ? 18 : 16);
      if (route.id === "military") life = ageTo(engine, engine.act(life, "enlist-royal-army"), 19);
      assert.equal(engine.getActivities(life).find(item => item.id === activity.id)!.available, true, route.id);
      life = engine.act(life, activity.id);
      const work = life.accomplishments!.find(record => record.achievementId === first)!;
      assert.equal(work.routeId, route.id);
      life = ageTo(engine, life, Math.max(24, work.age + 5));
      for (const suffix of [1, 2]) {
        const callback = life.journal.find(entry => entry.id === `legacy-${route.id}-callback-${suffix}`);
        assert.ok(callback?.text.includes(work.name), `${route.id} callback ${suffix} must reference the accepted work.`);
      }
      assert.equal(life.pendingEventId, `legacy-${route.id}-prestige`);
      const attempted = engine.choose(life, `attempt-${prestige}`);
      if (attempted.accomplishments!.some(record => record.achievementId === prestige)) accepted = attempted;
    }
    assert.ok(accepted, `No accepted prestige outcome found for ${route.id}`);
    assert.deepEqual(engine.load(engine.save(accepted)), accepted, route.id);
  }
});

test("royal awards close at the transition while memories of accepted service remain valid", () => {
  const engine = createEngine(controlled());
  let life = ageTo(engine, engine.start("royal-service-transition"), 18);
  life = ageTo(engine, engine.act(life, "enlist-royal-army"), 35);
  life = engine.act(life, "complete-service-assignment");
  life = ageTo(engine, life, 36);
  assert.equal(life.year, -30);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "complete-service-assignment")!.available, false);
  assert.equal(life.accomplishments!.some(record => record.achievementId === "military-first-work"), true);
  life = ageTo(engine, life, 40);
  assert.equal(life.year, -26);
  assert.ok(life.journal.some(entry => entry.id === "legacy-military-callback-2"));
});

test("legacy validation rejects forged references, passive awards and contacts absent from the actual outcome", () => {
  const missing = controlled();
  missing.character!.activities[0].outcomes[0].effects.push({ type: "accomplishment", achievement: "invented" });
  assert.throws(() => validateWorld(missing), /unknown achievement/);
  const passive = controlled();
  passive.yearlyEffects.push({ type: "accomplishment", achievement: "sculpture-first-work" });
  assert.throws(() => validateWorld(passive), /accepted decision or activity/);
  const unseen = controlled();
  unseen.character!.activities.find(activity => activity.id === "small-figure-order")!.outcomes[0].text = "An unnamed person accepts it.";
  assert.throws(() => validateWorld(unseen), /introduce every recorded contact/);
  const duplicate = controlled();
  duplicate.legacy!.routes[0].achievementIds.push("sculpture-first-work");
  assert.throws(() => validateWorld(duplicate), /duplicate reference/);
});

test("new content has seven ordinary career paths, seven rare prestige paths, fourteen callbacks and unchanged mortality", () => {
  const world = current as WorldPack;
  assert.equal(world.version, "0.31.0");
  assert.equal(world.legacy!.routes.length, 7); assert.equal(world.legacy!.achievements.length, 14);
  assert.equal(world.events.filter(event => event.id.includes("-callback-")).length, 14);
  for (const route of world.legacy!.routes) {
    const [ordinary, prestige] = route.achievementIds;
    assert.ok(world.character!.activities.some(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === ordinary))), route.id);
    assert.ok(world.events.some(event => event.rarity === "rare" && event.choices.some(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === prestige)))), route.id);
  }
  assert.deepEqual(current.health, previous.health);
  assert.deepEqual(current.mortality, previous.mortality);
  assert.deepEqual(current.yearlyEffects, previous.yearlyEffects);
  assert.equal(Object.keys(current.character.skills).length, 13);
  assert.ok(current.character.jobs.some(job => job.id === "performer"));
});

test("musical practice is accessible as its own root skill without an accidental literacy prerequisite", () => {
  const world = controlled();
  for (const skill of Object.values(world.character!.skills)) skill.initial = 0;
  const engine = createEngine(world);
  const before = ageTo(engine, engine.start("music-before-letters"), 8);
  assert.equal(before.character!.skills.literacy, 0);
  assert.equal(engine.getActivities(before).find(activity => activity.id === "train-music")!.available, true);
  const after = engine.act(before, "train-music");
  assert.equal(after.character!.skills.music, 6);
  assert.equal(after.character!.skills.oratory, 0);
  assert.equal(after.economy!.cash, before.economy!.cash - 5);
  assert.deepEqual(engine.load(engine.save(after)), after);
});

test("0.24 lives retain their old record shape and stay available by fingerprint", () => {
  const engine = createEngine(previous);
  assert.equal(engine.fingerprint, "fnv1a64-2c2ede20a626f4bb");
  let life = engine.start("unchanged-0-24");
  for (let i = 0; i < 12 && life.phase !== "ended"; i++) life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.equal(Object.hasOwn(life, "accomplishments"), false);
  assert.deepEqual(getAccomplishments(engine.world, life), []);
  assert.deepEqual(engine.load(engine.save(life)), life);
  const archived = getArchivedBuiltinWorld(`pack-${contentFingerprint(previous)}`);
  assert.ok(archived);
  assert.deepEqual(archived.pack, previous);
  assert.equal(isLegacyFactoryDraft(getBuiltinCatalog(previous).worlds), true);
});
