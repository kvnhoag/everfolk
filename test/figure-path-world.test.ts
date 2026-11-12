import assert from "node:assert/strict";
import test from "node:test";
import { buildFigurePathWorld } from "../src/figures/world.ts";
import { validateWorld } from "../src/validate.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import { FIGURE_RANK_POLICY } from "../chain/catalog/figure-ranks.ts";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import base from "../worlds/demo/alexandria-deep-1.json" with { type: "json" };
import shipped from "../worlds/demo/alexandria-figures-1.json" with { type: "json" };
import type { Condition, WorldPack } from "../src/types.ts";
const build = () => buildFigurePathWorld(base as unknown as WorldPack);

test("eleven figure paths build reproducibly without changing the retained deep-skill world", async () => {
  const before = JSON.stringify(base), world = build();
  validateWorld(world);
  assert.deepEqual(world, shipped);
  assert.equal(world.figurePaths!.length, 11);
  assert.equal(world.deepCapabilities!.rules.length, 65);
  assert.equal(world.events.filter(event => event.id.startsWith("fig-story-")).length, 22);
  assert.equal(JSON.stringify(base), before);
  assert.equal((await loadLifeWorld("alexandria-deep-1")).figurePaths, undefined);
  assert.equal((await loadLifeWorld("alexandria-figures-1")).figurePaths!.length, 11);
  assert.throws(() => buildFigurePathWorld(world), /retained world/i);
});

test("all figures preserve the agreed ranks and each title requires its own work and prior tier", () => {
  const world = build();
  for (const path of world.figurePaths!) {
    const policy = FIGURE_RANK_POLICY.find(rule => rule.figureId === path.id)!;
    assert.equal(path.baseRank, policy.baseRank);
    assert.equal(path.maximumRank, policy.maximumRank);
    assert.deepEqual(path.stages.map(stage => stage.rank), ["Uncommon", "Rare", "Epic"]);
    for (const stage of path.stages) {
      const claim = world.character!.activities.find(activity => activity.id === stage.activityId)!;
      assert.deepEqual(claim.when, stage.requires);
      const work = world.vocations!.actions[stage.workActionId];
      assert.equal(work.kind, "work");
      assert.ok(world.character!.activities.some(activity => activity.usesYearlyActivity !== false && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === stage.workActionId))));
    }
  }
});

test("supply contributions debit actual grain, paid materials and finite payer balances", () => {
  const run = figureFixture("actual-supply-inputs", 18), path = run.path("alexander");
  run.act(path.encounter.activityId); run.next();
  const stage = path.stages[0], action = run.world.vocations!.actions[stage.workActionId];
  assert.equal(action.kind, "work"); if (action.kind !== "work") return;
  run.fundWork(stage.workActionId);
  const before = run.life, grain = before.demo!.household.grain, paper = before.vocations!.inventory.papyrus;
  const funds = before.economy!.cash + Object.values(before.vocations!.accounts).reduce((sum, value) => sum + value, 0);
  run.yearly("v-" + stage.workActionId);
  assert.equal(run.life.demo!.household.grain, grain - action.inputs!.grain);
  assert.equal(run.life.vocations!.inventory.papyrus, paper - action.inputs!.papyrus);
  assert.equal(run.life.economy!.cash, before.economy!.cash + action.pay - action.fee);
  assert.equal(run.life.economy!.cash + Object.values(run.life.vocations!.accounts).reduce((sum, value) => sum + value, 0), funds);
  assert.equal(run.progress("alexander").associationRank, null);
  const receipt = run.life.deepCapabilities!.evidence.find(record => record.action === stage.workActionId)!;
  assert.equal(receipt.facts.grainDelivered, action.inputs!.grain);
  assert.throws(() => run.engine.act(run.life, "v-" + stage.workActionId), /year|work|activity/i);
  run.act(stage.activityId);
  assert.equal(run.progress("alexander").associationRank, "Uncommon");
  assert.equal(run.progress("alexander").specialTitle, null);
  assert.equal(before.vocations!.completed[stage.workActionId], undefined);
  assert.deepEqual(run.engine.load(run.engine.save(run.life)), run.life);
});

test("missing project materials and an empty employer reject before any state change", () => {
  const run = figureFixture("no-project-paper", 18), path = run.path("alexander");
  run.act(path.encounter.activityId); run.next();
  const before = JSON.stringify(run.life);
  assert.throws(() => run.engine.act(run.life, "v-" + path.stages[0].workActionId), /materials/i);
  assert.equal(JSON.stringify(run.life), before);
  const empty = figureFixture("no-employer-purse", 18, world => { world.vocations!.accounts.workshop = 0; });
  const original = JSON.stringify(empty.life);
  assert.throws(() => empty.engine.act(empty.life, "v-fig-alexander-prepare"), /employer|fund/i);
  assert.equal(JSON.stringify(empty.life), original);
});

test("a later-tradition contribution saves its truthful title and rank in the collection", () => {
  const run = figureFixture("truthful-tradition-title", 30), path = run.path("alexander");
  run.act(path.tradition!.activityId);
  run.fundWork(path.stages[0].workActionId); run.yearly("v-" + path.stages[0].workActionId); run.act(path.stages[0].activityId);
  const record = run.life.accomplishments!.find(item => item.achievementId === path.stages[0].achievementId)!;
  assert.equal(record.name, path.stages[0].traditionTitle);
  assert.match(record.title, /Uncommon contribution/);
  assert.equal(run.progress(path.id).encounterMode, "tradition");
  assert.equal(run.progress(path.id).specialTitle, null);
  assert.deepEqual(run.engine.replay(run.life.seed, run.life.commands), run.life);
});

test("figure story decisions develop skills without creating projects, principal titles or mastery", () => {
  for (const event of build().events.filter(event => event.id.startsWith("fig-story-"))) {
    for (const choice of event.choices) for (const outcome of choice.outcomes) for (const effect of outcome.effects) {
      assert.ok(effect.type === "skill" || effect.type === "stat");
      if (effect.type === "skill" || effect.type === "stat") assert.ok(effect.delta <= 2);
    }
  }
});

test("validation rejects invented encounters, free contribution gates and wrong-figure promotions", () => {
  let world = build();
  world.figurePaths![0].encounter.activityId = "made-up-encounter";
  assert.throws(() => validateWorld(world), /source|achievement|unknown/i);
  world = build();
  const stage = world.figurePaths![0].stages[0];
  const free: Condition = { type: "age", op: "gte", value: 18 };
  stage.requires = free;
  world.character!.activities.find(activity => activity.id === stage.activityId)!.when = free;
  assert.throws(() => validateWorld(world), /completed project years/i);
  world = build();
  world.figurePaths!.find(path => path.id === "demetrius")!.promotion!.milestone = "ptolemaic-dynasty-founded";
  assert.throws(() => validateWorld(world), /match.*figure/i);
});

test("validation rejects work disguised as a minor action and executable metadata", () => {
  let world = build();
  const workId = world.figurePaths![0].stages[0].workActionId;
  world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === workId)))!.usesYearlyActivity = false;
  assert.throws(() => validateWorld(world), /year|annual|work/i);
  world = build(); let invoked = false;
  Object.defineProperty(world.figurePaths![0], "name", { enumerable: true, get() { invoked = true; return "forged"; } });
  assert.throws(() => validateWorld(world), /JSON data|data properties/);
  assert.equal(invoked, false);
});

test("figure-specific material work is opt-in and cannot silently rewrite retained worlds", () => {
  const retained = structuredClone(base) as unknown as WorldPack;
  const work = Object.values(retained.vocations!.actions).find(action => action.kind === "work")!;
  assert.equal(work.kind, "work");
  if (work.kind === "work") work.inputs = { papyrus: 1 };
  assert.throws(() => validateWorld(retained), /unknown.*field/i);
});
