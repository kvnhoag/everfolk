import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildFigurePathWorld } from "../src/figures/world.ts";
import { getFigurePathProgress } from "../src/figures/progress.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import shipped from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

test("the current figure world extends the published numeric tree, life stages and career paths", async () => {
  const before = JSON.stringify(base), world = buildFigurePathWorld(base as unknown as WorldPack);
  assert.deepEqual(world, shipped);
  assert.equal(world.version, "alexandria-lives-6");
  assert.deepEqual(world.capabilities, base.capabilities);
  assert.deepEqual(world.lifeStages, base.lifeStages);
  assert.deepEqual(world.paths, base.paths);
  assert.equal(world.deepCapabilities, undefined);
  assert.equal(world.figurePaths!.length, 11);
  assert.equal(JSON.stringify(base), before);
  assert.equal((await loadLifeWorld("alexandria-lives-5")).version, "alexandria-lives-5");
  assert.equal((await loadLifeWorld("alexandria-lives-6")).figurePaths!.length, 11);
});

test("Menander's actual title work coexists with numeric capabilities, life stages and career paths", () => {
  const world = buildFigurePathWorld(base as unknown as WorldPack);
  delete world.knowledge; delete world.demo!.startingResources; delete world.health!.mortalityCalibration;
  world.birthYears = { from: world.startYear, to: world.startYear };
  for (const event of world.events) { event.when = { type: "age", op: "gte", value: 1000 }; event.maxOccurrences = 1; }
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = {}; origin.assetRanges = {}; }
  world.stats.health.initial = 100; world.stats.wealth.initial = 100; world.economy!.unitsPerPoint = 1000;
  world.demo!.household.startingGrain = 1000000; world.demo!.household.storeCapacity = 1000000; world.demo!.household.spoilageBps = 0;
  const engine = createEngine(world);
  let life = engine.start("numeric-mainline-menander");
  const ready = () => { while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id); assert.notEqual(life.phase, "ended"); };
  const next = () => { life = engine.advance(life); ready(); };
  const act = (id: string) => { ready(); life = engine.act(life, id); };
  const yearly = (id: string) => { if (life.character!.lastActivityAge === life.age || life.vocations!.workedAge === life.age) next(); act(id); };
  const inventory = (item: string) => item === "linen" ? life.demo!.goods.linen : life.vocations!.inventory[item] ?? 0;
  const fund = (actionId: string) => {
    const action = world.vocations!.actions[actionId]; assert.equal(action.kind, "work"); if (action.kind !== "work") return;
    for (const [item, quantity] of Object.entries(action.inputs ?? {})) {
      const supplier = Object.entries(world.vocations!.actions).find(([, candidate]) => candidate.kind === "buy" && candidate.item === item)!;
      assert.ok(supplier, "A real supplier must provide " + item);
      while (inventory(item) < quantity) {
        let available = engine.getActivities(life).find(activity => activity.id === "v-" + supplier[0])!;
        while (!available.available) { assert.match(available.reason ?? "", /age|again|year/i); next(); available = engine.getActivities(life).find(activity => activity.id === "v-" + supplier[0])!; }
        act(available.id);
      }
    }
  };
  const path = world.figurePaths!.find(path => path.id === "menander")!;
  const entryAge = Math.max(18, path.encounter.fromYear - world.startYear);
  while (life.age < entryAge) next();
  assert.equal(life.deepCapabilities, undefined);
  assert.ok(life.capabilities);
  assert.ok(life.paths);
  assert.ok(engine.getActivities(life).find(activity => activity.id === path.encounter.activityId)!.available, "The authored entry year must be within Menander's working window.");
  act(path.encounter.activityId);
  for (const stage of path.stages) {
    for (let year = 0; year < stage.workYears; year++) { fund(stage.workActionId); yearly("v-" + stage.workActionId); }
    act(stage.activityId);
    assert.equal(getFigurePathProgress(world, path, life).associationRank, stage.rank);
  }
  for (let year = 0; year < 2; year++) { fund("fig-menander-capstone-work"); yearly("v-fig-menander-capstone-work"); }
  act(path.capstone.activityId);
  const progress = getFigurePathProgress(world, path, life);
  assert.equal(progress.associationRank, "Epic");
  assert.equal(progress.specialTitle?.rank, "Legendary");
  assert.equal(life.deepCapabilities, undefined);
  assert.ok(life.capabilities);
  assert.ok(life.paths);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
