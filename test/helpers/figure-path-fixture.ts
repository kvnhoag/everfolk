import assert from "node:assert/strict";
import { createEngine } from "../../src/engine.ts";
import { buildFigurePathWorld } from "../../src/figures/world.ts";
import { getFigurePathProgress } from "../../src/figures/progress.ts";
import { capabilityRewards, quoteCapabilityProduction } from "../../src/deep-capabilities/rewards.ts";
import { deepInventory } from "../../src/deep-capabilities/actions.ts";
import type { FigurePathDefinition } from "../../src/figures/types.ts";
import type { DemoCommand } from "../../src/demo/types.ts";
import type { Condition, WorldPack } from "../../src/types.ts";
import base from "../../worlds/demo/alexandria-deep-1.json" with { type: "json" };

// Mechanics fixtures author health, capital, food and high numerical proficiency.
// Every learned node, work receipt, contact and title must still arise from commands.
export function figureFixture(seed: string, startAge = 12, configure?: (world: WorldPack) => void) {
  const world = buildFigurePathWorld(base as unknown as WorldPack);
  delete world.knowledge; delete world.demo!.startingResources; delete world.health!.mortalityCalibration;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => interrupts.has(event.id) || event.id.startsWith("figure-"));
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  world.stats.health.initial = 100; world.stats.knowledge.initial = 100; world.stats.bonds.initial = 100;
  world.stats.wealth.initial = 100; world.economy!.unitsPerPoint = 1000;
  world.demo!.household.startingGrain = 1000000; world.demo!.household.storeCapacity = 1000000; world.demo!.household.spoilageBps = 0;
  world.origins = [{ id: "figure-project-fixture", title: "An established household", text: "Explicitly authored means isolate proof, time and project mechanics.", weight: 1, effects: [] }];
  configure?.(world);
  const engine = createEngine(world);
  let life = engine.start(seed);
  const ready = () => {
    while (life.phase === "choice") {
      const choices = engine.getChoices(life);
      assert.ok(choices.length > 0, "A pending decision must offer a choice.");
      life = engine.choose(life, choices[0].id);
    }
    assert.notEqual(life.phase, "ended", "The healthy mechanics fixture must still be alive.");
  };
  const next = () => { life = engine.advance(life); ready(); };
  const advanceTo = (age: number) => { while (life.age < age) next(); };
  const act = (id: string) => { ready(); life = engine.act(life, id); };
  const demo = (command: DemoCommand) => { ready(); life = engine.demo(life, command); };
  const yearly = (id: string) => {
    if (life.character!.lastActivityAge === life.age || life.vocations!.workedAge === life.age) next();
    act(id);
  };
  const cap = (id: string) => yearly(`v-cap-${id.toLowerCase()}`);
  const ensure = (item: string, quantity: number) => {
    if ((deepInventory(life)[item] ?? 0) >= quantity) return;
    if (item === "grain") {
      while (life.demo!.household.grain < quantity) {
        const amount = Math.min(quantity - life.demo!.household.grain, world.demo!.market.maxOrderQuantity);
        try { demo({ type: "trade", side: "buy", item: "grain", quantity: amount, counterparty: "merchant" }); }
        catch (error) { assert.match(String(error), /visit|year/i); next(); demo({ type: "trade", side: "buy", item: "grain", quantity: amount, counterparty: "merchant" }); }
      }
      return;
    }
    const entry = Object.entries(world.vocations!.actions).find(([, action]) => action.kind === "buy" && action.item === item);
    assert.ok(entry, `There must be a real supplier for ${item}.`);
    while ((deepInventory(life)[item] ?? 0) < quantity) {
      let availability = engine.getActivities(life).find(activity => activity.id === `v-${entry[0]}`);
      assert.ok(availability, `There must be a purchasing activity for ${item}.`);
      while (!availability.available) {
        assert.match(availability.reason ?? "", /age|again|year/i);
        next();
        availability = engine.getActivities(life).find(activity => activity.id === `v-${entry[0]}`)!;
      }
      act(availability.id);
    }
  };
  const make = (recipe: string, quantity?: number, inspected = false) => {
    if (life.character!.lastActivityAge === life.age || life.vocations!.workedAge === life.age) next();
    const quote = quoteCapabilityProduction(capabilityRewards(Object.keys(life.deepCapabilities!.learned)), world.vocations!.recipes[recipe], { recipeId: recipe, quantity, inspected });
    assert.ok(quote.allowed, quote.reason);
    for (const [item, units] of Object.entries(quote.inputs)) ensure(item, units);
    const id = `v-make-${recipe}${quantity ? `-${quantity}` : ""}${inspected ? "-inspected" : ""}`;
    for (let year = 0; year < quote.workYears; year++) { yearly(id); }
  };
  const researchFoundation = () => {
    for (const id of ["guided-reading", "argument-exercise", "evidence-comparison", "evidence-comparison", "reviewed-inquiry", "public-dilemma"]) cap(id);
    assert.ok(life.deepCapabilities!.learned.P4);
  };
  const researchMastery = () => {
    if (!life.deepCapabilities!.learned.P4) researchFoundation();
    for (const id of ["observation-project", "observation-project", "measurement-calculation", "measurement-calculation", "test-explanation", "independent-check", "independent-check", "research-synthesis"]) cap(id);
    act("v-cap-register-ps10");
    cap("original-inquiry"); cap("original-inquiry"); act("v-cap-submit-ps10");
    assert.ok(life.deepCapabilities!.learned.PS10);
  };
  const sculptureFoundation = () => {
    cap("tool-practice"); cap("measurement-exercise");
    for (let year = 0; year < 2; year++) { ensure("clay", 1); cap("prepare-clay"); }
    for (let year = 0; year < 2; year++) make("clay-model");
    assert.ok(life.deepCapabilities!.learned.A4);
  };
  const sculptureMastery = () => {
    if (!life.deepCapabilities!.learned.A4) sculptureFoundation();
    make("clay-model"); ensure("timber", 1); cap("wood-relief-practice");
    assert.ok(life.deepCapabilities!.learned.AS5);
    for (let year = 0; year < 2; year++) make("small-relief", undefined, true);
    for (let year = 0; year < 2; year++) make("stone-figure", undefined, true);
    make("bust", undefined, true); cap("project-budget");
    if (life.character!.lastActivityAge === life.age) next();
    act("v-cap-commission-large-relief"); make("large-relief", undefined, true); act("v-cap-deliver-commission");
    act("v-cap-register-as10"); make("monument", undefined, true); act("v-cap-submit-as10");
    assert.ok(life.deepCapabilities!.learned.AS10);
  };
  const workActivity = (workActionId: string) => {
    const activity = world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === workActionId)));
    assert.ok(activity, `There must be an authored work activity for ${workActionId}.`);
    return activity;
  };
  const fundWork = (workActionId: string) => {
    const action = world.vocations!.actions[workActionId] as { inputs?: Record<string, number> };
    for (const [item, quantity] of Object.entries(action.inputs ?? {})) ensure(item, quantity);
  };
  const completeWork = (actionId: string, years: number) => {
    while ((life.vocations!.completed[actionId] ?? 0) < years) {
      fundWork(actionId); yearly(workActivity(actionId).id);
    }
  };
  const contribute = (path: FigurePathDefinition) => {
    for (const stage of path.stages) {
      if (life.accomplishments!.some(record => record.achievementId === stage.achievementId)) continue;
      completeWork(stage.workActionId, stage.workYears);
      act(stage.activityId);
      assert.ok(life.accomplishments!.some(record => record.achievementId === stage.achievementId), stage.achievementId);
    }
  };
  const requiredWork = (condition: Condition): { action: string; count: number }[] => condition.type === "vocation" ? [{ action: condition.action, count: condition.count }] : condition.type === "all" || condition.type === "any" ? condition.conditions.flatMap(requiredWork) : [];
  const completeCapstone = (path: FigurePathDefinition) => {
    for (const requirement of requiredWork(path.capstone.requires)) completeWork(requirement.action, requirement.count);
    act(path.capstone.activityId);
  };
  const path = (id: string) => {
    const result = world.figurePaths!.find(path => path.id === id);
    assert.ok(result, `Missing figure route ${id}.`);
    return result;
  };
  const progress = (id: string) => getFigurePathProgress(world, path(id), life);
  const durable = () => { assert.deepEqual(engine.load(engine.save(life)), life); assert.deepEqual(engine.replay(life.seed, life.commands), life); };
  advanceTo(startAge);
  assert.deepEqual(life.deepCapabilities!.learned, {});
  assert.equal(life.deepCapabilities!.evidence.length, 0);
  assert.deepEqual(life.accomplishments, []);
  return { world, engine, get life() { return life; }, next, advanceTo, act, demo, yearly, cap, ensure, make, researchFoundation, researchMastery, sculptureFoundation, sculptureMastery, contribute, completeCapstone, completeWork, requiredWork, fundWork, workActivity, path, progress, durable };
}
