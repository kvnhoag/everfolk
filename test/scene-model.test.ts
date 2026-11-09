import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import legacyPack from "../worlds/alexandria-0.14.0.json" with { type: "json" };
import { ALEXANDRIA_EVENT_VISUALS, defaultEventVisual, resolveLifeScenes } from "../client/scene-model.ts";

function fixture(id: string, age = 20, change?: (event: LifeEvent) => void, prepare?: (engine: LifeEngine, life: LifeState) => LifeState) {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  delete world.mortality;
  delete world.health!.mortalityCalibration;
  delete world.eventPacing;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  // Visual tests isolate accepted commands from the cost of reaching the scene.
  world.stats.wealth.initial = 80;
  world.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of world.origins) origin.statRanges = { ...origin.statRanges, wealth: { min: 80, max: 80 } };
  const event = structuredClone(world.events.find(event => event.id === id)!);
  assert.ok(event, `Unknown fixture ${id}`);
  event.trigger = { type: "age", at: age };
  delete event.when;
  delete event.maxOccurrences;
  delete event.cooldownYears;
  change?.(event);
  // Keep the real introduction in this scene fixture so later family actions
  // still meet their character prerequisites through accepted events.
  world.events = [event, ...world.events.filter(item => ["meet-demetria", world.health!.careDecision].includes(item.id) && item.id !== id)];
  if (id === world.health!.careDecision) world.events.push({
    id: "fixture-health-onset", title: "An illness begins", text: "You develop pneumonia.", mode: "automatic",
    trigger: { type: "age", at: age }, effects: [{ type: "condition", condition: "pneumonia" }], choices: [],
  });
  const engine = createEngine(world);
  let life = engine.start(`scene-${id}`);
  while (life.age < age) {
    const prepared = prepare?.(engine, life) ?? life;
    life = engine.advance(prepared);
  }
  return { engine, life, world: engine.world };
}

test("every shipped event has an authored visual rather than a text-keyword guess", () => {
  assert.deepEqual(Object.keys(ALEXANDRIA_EVENT_VISUALS).sort(), pack.events.map(event => event.id).sort());
  const renamed = { ...pack.events.find(event => event.id === "an-unwell-week")!, title: "A changed heading", text: "Edited story text." } as LifeEvent;
  assert.equal(defaultEventVisual(renamed).scene, "rest");
  assert.equal(defaultEventVisual(pack.events.find(event => event.id === "a-place-on-the-manifest")! as LifeEvent).scene, "history-city");
  assert.equal(defaultEventVisual(pack.events.find(event => event.id === "news-of-actium")! as LifeEvent).scene, "history-city", "news must not invent local fighting");
  assert.equal(defaultEventVisual(pack.events.find(event => event.id === "child-useful-hands")! as LifeEvent).scene, "childhood", "a child's tasks must not show an adult craft worker");
});

test("illness shows the actual event and keeps a care scene after accepting help", () => {
  const { engine, life, world } = fixture("medical-care-needed");
  const before = structuredClone(life);
  const pending = resolveLifeScenes(life, world)[0];
  assert.equal(pending.kind, "pending");
  assert.equal(pending.title, "Care is needed");
  assert.equal(pending.scene, "rest");
  assert.equal(pending.motion, "rest");
  assert.equal(pending.caption, world.events[0].text);
  assert.deepEqual(life, before, "presentation cannot consume random draws or mutate a life");
  const next = engine.choose(life, "rest-and-care");
  const chosen = resolveLifeScenes(next, world)[0];
  assert.equal(chosen.kind, "outcome");
  assert.equal(chosen.scene, "rest");
  assert.equal(chosen.caption, next.journal.findLast(entry => entry.type === "outcome")!.text);
});

test("career images follow the accepted route instead of committing an unchosen branch", () => {
  for (const [choice, scene] of [["stay", "work"], ["sail", "sea"], ["study", "learning"]] as const) {
    const { engine, life, world } = fixture("a-place-on-the-manifest", 20, undefined, (engine, state) => {
      const trainingId = choice === "sail" && state.character!.skills.seamanship < 15 ? "train-seamanship"
        : choice === "study" && state.character!.skills.literacy < 30 ? "train-literacy" : undefined;
      const activity = engine.getActivities(state).find(activity => activity.id === trainingId && activity.available);
      return activity ? engine.act(state, activity.id) : state;
    });
    assert.equal(life.character!.jobId, null, "Training must not silently select a career.");
    assert.equal(resolveLifeScenes(life, world)[0].scene, "history-city");
    const next = engine.choose(life, choice);
    assert.equal(next.character!.jobId, choice === "stay" ? "porter" : choice === "sail" ? "sailor" : "copyist");
    const context = resolveLifeScenes(next, world)[0];
    assert.equal(context.scene, scene);
    assert.equal(context.kind, "outcome");
    assert.equal(context.caption, next.journal.findLast(entry => entry.type === "outcome")!.text);
  }
});

test("an adolescent worker's fallback scene reflects their job while children and later life keep their age context", () => {
  const engine = createEngine(pack);
  const life = structuredClone(engine.start("working-youth-visual"));
  life.age = 14;
  life.year = -52;
  life.journal = [];
  life.phase = "ready";
  life.pendingEventId = null;
  for (const [job, scene] of [["porter", "work"], ["sailor", "sea"], ["copyist", "learning"], [null, "learning"]] as const) {
    life.character!.jobId = job;
    const context = resolveLifeScenes(life, engine.world)[0];
    assert.equal(context.kind, "fallback");
    assert.equal(context.scene, scene);
  }
  life.character!.jobId = "porter";
  life.age = 9;
  assert.equal(resolveLifeScenes(life, engine.world)[0].scene, "childhood");
  life.age = 65;
  assert.equal(resolveLifeScenes(life, engine.world)[0].scene, "later-life");
});

test("the automatic marriage reminder does not depict a partner or child as an accepted fact", () => {
  const { engine, life, world } = fixture("a-shared-household", 25);
  assert.notEqual(resolveLifeScenes(life, world)[0].scene, "family");
  assert.equal(life.phase, "ready");
  assert.deepEqual(engine.getChoices(life), []);
  const context = resolveLifeScenes(life, world)[0];
  assert.equal(life.flags.partnered, false);
  assert.equal(life.flags.parent, false);
  assert.equal(context.scene, "history-city");
  assert.equal(context.motion, "reflect");
  assert.equal(context.caption, world.events.find(event => event.id === "a-shared-household")!.text);
});

test("only a real child activity depicts parenthood, while childhood care keeps its accepted context", () => {
  const { engine, life, world } = fixture("a-new-generation", 28, undefined, (engine, state) => {
    const activityId = state.character!.relationshipStatus === "single" ? "court-demetria"
      : state.character!.relationshipStatus === "courting" ? "marry-demetria" : undefined;
    const activity = engine.getActivities(state).find(activity => activity.id === activityId && activity.available);
    return activity ? engine.act(state, activity.id) : state;
  });
  assert.equal(life.character!.relationshipStatus, "married");
  let parent = life;
  assert.equal(parent.phase, "ready");
  assert.equal(parent.character!.children.length, 0, "Talking about care must not create a child.");
  assert.equal(parent.flags.parent, false);
  assert.equal(resolveLifeScenes(parent, world)[0].scene, "history-city");
  while (parent.character!.children.length === 0 && parent.age <= 43) {
    const activity = engine.getActivities(parent).find(activity => activity.id === "grow-household" && activity.available);
    parent = activity ? engine.act(parent, activity.id) : engine.advance(parent);
  }
  assert.equal(parent.character!.children.length, 1);
  assert.equal(parent.character!.children[0].otherParentId, "demetria");
  assert.equal(parent.flags.parent, true);
  const familyScene = resolveLifeScenes(parent, world)[0];
  assert.equal(familyScene.scene, "family");
  assert.equal(familyScene.caption, parent.journal.findLast(entry => entry.type === "outcome")!.text);
  assert.ok(parent.commands.some(command => command.type === "act" && command.activity === "grow-household"));
  const childhood = fixture("child-a-friend-needs-help", 8);
  const helping = childhood.engine.choose(childhood.life, "child-help-friend");
  const childScene = resolveLifeScenes(helping, childhood.world)[0];
  assert.equal(childScene.scene, "childhood");
  assert.equal(childScene.motion, "gather");
  assert.equal(childScene.title, "A friend needs help");
});

test("dated history and the annual event remain available beside a pending decision", () => {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  delete world.mortality;
  delete world.health!.mortalityCalibration;
  delete world.eventPacing;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  const history = structuredClone(world.events.find(event => event.id === "caesar-in-alexandria")!);
  const background = structuredClone(world.events.find(event => event.id === "adult-work-and-return")!);
  background.trigger = { type: "age", at: 18 };
  delete background.when;
  delete background.maxOccurrences;
  delete background.cooldownYears;
  const decision = structuredClone(world.events.find(event => event.id === "a-place-on-the-manifest")!);
  decision.trigger = { type: "age", at: 18 };
  world.events = [history, background, decision, world.events.find(event => event.id === world.health!.careDecision)!];
  const engine = createEngine(world);
  let life = engine.start("same-year-scenes");
  while (life.age < 18) life = engine.advance(life);
  const contexts = resolveLifeScenes(life, engine.world);
  assert.equal(contexts[0].kind, "pending");
  const war = contexts.find(context => context.eventId === history.id)!;
  assert.equal(war.kind, "history");
  assert.equal(war.scene, "history-war");
  assert.equal(war.motion, "unrest");
  assert.equal(war.caption, history.text);
  assert.ok(contexts.some(context => context.eventId === background.id && context.kind === "event"));
  life = engine.advance(engine.choose(life, "stay"));
  assert.ok(resolveLifeScenes(life, engine.world).every(context => !context.eventId), "last year's war cannot remain as this year's live event");
});

test("explicit event visuals override defaults and unknown events fall back from effects", () => {
  const { life, world } = fixture("an-unwell-week");
  const assigned = resolveLifeScenes(life, world, { "an-unwell-week": { scene: "history-city", motion: "still", caption: "An author's contextual caption." } })[0];
  assert.equal(assigned.scene, "history-city");
  assert.equal(assigned.motion, "still");
  assert.equal(assigned.caption, "An author's contextual caption.");
  const custom: LifeEvent = { id: "custom-fever", title: "A custom story", text: "An authored illness.", mode: "automatic", trigger: { type: "random", weight: 1 }, effects: [{ type: "stat", stat: "health", delta: -5 }], choices: [] };
  assert.equal(defaultEventVisual(custom).scene, "rest");
});

test("death before the first birthday shows the actual selected cause in the memorial", () => {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.health!.criticalHealth = 5;
  world.health!.supportRecoveryBonus = 0;
  const pneumonia = world.health!.conditions.find(condition => condition.id === "pneumonia")!;
  pneumonia.healthLoss = 100;
  pneumonia.recoveryChance = 0;
  pneumonia.careRecoveryBonus = 0;
  for (const origin of world.origins) {
    origin.statRanges = { ...origin.statRanges, health: { min: 6, max: 6 } };
    origin.effects.push({ type: "condition", condition: "pneumonia" });
  }
  const engine = createEngine(world);
  let life = engine.start("infant-scene");
  assert.equal(life.pendingEventId, "medical-care-needed");
  life = engine.choose(life, "rest-and-care");
  life = engine.advance(life);
  assert.equal(life.age, 0);
  assert.equal(life.phase, "ended");
  const contexts = resolveLifeScenes(life, engine.world);
  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].scene, "memorial");
  assert.equal(contexts[0].motion, "still");
  const cause = engine.world.character!.deathCauses.find(cause => cause.id === life.deathCauseId);
  assert.ok(cause, "A character world must retain the selected specific cause of death.");
  assert.equal(cause.id, "early-illness", "The memorial must name the actual active pneumonia episode.");
  assert.equal(contexts[0].title, cause.title);
  assert.equal(contexts[0].caption, cause.text);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("a legacy world without character mechanics retains its original ending caption", () => {
  const world = structuredClone(legacyPack) as WorldPack;
  delete world.character;
  world.events = [];
  world.mortality!.bands[0].annualProbability = 1;
  const engine = createEngine(world);
  const life = engine.advance(engine.start("legacy-infant-scene"));
  assert.equal(life.phase, "ended");
  assert.equal(life.character, undefined);
  assert.equal(life.deathCauseId, undefined);
  const context = resolveLifeScenes(life, engine.world)[0];
  const ending = engine.world.endings.find(ending => ending.id === life.endingId)!;
  assert.equal(context.scene, "memorial");
  assert.equal(context.title, ending.title);
  assert.equal(context.caption, ending.text);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
