import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { getFigureCardProgress } from "../src/figures/card-progress.ts";
import { getFigurePathProgress } from "../src/figures/progress.ts";
import { buildContributionTierWorld } from "../src/figures/contribution-world.ts";
import { buildCommonContributionWorld } from "../src/figures/common-contribution-world.ts";
import { validateWorld } from "../src/validate.ts";
import type { Condition, WorldPack } from "../src/types.ts";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import numeric from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import deep from "../worlds/demo/alexandria-figures-2.json" with { type: "json" };

const fixedLegends = ["alexander", "aristotle", "euclid", "lysippos", "menander"];
const sources = [numeric, deep];
const requiresAward = (condition: Condition | undefined, id: string): boolean => condition?.type === "accomplishment" ? condition.achievement === id
  : condition?.type === "all" ? condition.conditions.some(child => requiresAward(child, id)) : false;
const build = () => buildCommonContributionWorld(numeric as unknown as WorldPack);

test("new fixed Legendary contribution ladders start at Common without rewriting retained packs or grades", () => {
  for (const source of sources) {
    const base = source as unknown as WorldPack, before = JSON.stringify(base);
    const world = buildCommonContributionWorld(base);
    validateWorld(world);
    assert.equal(world.version, base.version === "alexandria-lives-7" ? "alexandria-lives-8" : "alexandria-figures-3");
    assert.equal(JSON.stringify(base), before);
    for (const path of world.figurePaths!) {
      const old = base.figurePaths!.find(candidate => candidate.id === path.id)!;
      if (fixedLegends.includes(path.id)) {
        assert.deepEqual(path.stages.map(stage => stage.rank), ["Common", "Uncommon", "Rare", "Epic"]);
        assert.deepEqual(path.stages.slice(1).map(stage => stage.achievementId), old.stages.map(stage => stage.achievementId));
        assert.deepEqual(path.stages.slice(1).map(stage => stage.activityId), old.stages.map(stage => stage.activityId));
        assert.deepEqual(path.capstone, old.capstone);
        assert.equal(path.baseRank, "Legendary");
        assert.equal(path.maximumRank, "Legendary");
        const [common, uncommon] = path.stages;
        assert.equal(common.workYears, 1);
        assert.notEqual(common.title, uncommon.title);
        assert.notEqual(common.workActionId, uncommon.workActionId);
        assert.ok(requiresAward(uncommon.requires, common.achievementId));
        const claim = world.character!.activities.find(activity => activity.id === uncommon.activityId)!;
        const work = world.character!.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === uncommon.workActionId)))!;
        assert.ok(requiresAward(claim.when, common.achievementId));
        assert.ok(requiresAward(work.when, common.achievementId));
      } else {
        assert.deepEqual(path, old, path.id + " keeps its Epic-principal path and conditional recognition");
        assert.deepEqual(path.stages.map(stage => stage.rank), ["Common", "Uncommon", "Rare"]);
      }
    }
    assert.throws(() => buildCommonContributionWorld(world), /retained|lives-7|figures-2/i);
  }
});

test("high scores and arbitrary flags do not award Common contributions or downgrade Legendary principals", () => {
  const world = build(), life = structuredClone(createEngine(world).start("legendary-common-no-free-card"));
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 100;
  for (const id of Object.keys(life.stats)) life.stats[id] = 100;
  for (const id of fixedLegends) {
    life.flags[`fig-${id}-common`] = true;
    const card = getFigureCardProgress(world, life, id)!;
    assert.equal(card.pathProgress!.principalRank, "Legendary");
    assert.equal(card.contributor.rank, null);
    assert.equal(card.contributor.nextRank, "Common");
    assert.equal(card.pathProgress!.stages[0].earned, false);
    assert.ok(card.variants.every(variant => !variant.earned));
  }
});

function actualAristotle() {
  const run = figureFixture("legendary-common-real-aristotle", 12, world => Object.assign(world, buildCommonContributionWorld(buildContributionTierWorld(world))));
  run.researchFoundation();
  const path = run.path("aristotle"), [common, uncommon] = path.stages;
  run.yearly(path.encounter.activityId);
  run.next(); // Isolate the Common gate from the annual activity limit.
  const firstWork = run.workActivity(uncommon.workActionId);
  assert.equal(run.engine.getActivities(run.life).find(activity => activity.id === firstWork.id)!.available, false);
  assert.throws(() => run.act(firstWork.id), /unavailable|require|condition/i);
  assert.throws(() => run.act(uncommon.activityId), /unavailable|require|condition/i);
  run.completeWork(common.workActionId, common.workYears);
  assert.equal(run.progress("aristotle").stages[0].earned, false, "qualified work still requires the separate Common title claim");
  assert.equal(run.progress("aristotle").stages[0].ready, true);
  run.act(common.activityId);
  assert.equal(run.progress("aristotle").associationRank, "Common");
  assert.equal(run.progress("aristotle").nextStage!.definition.rank, "Uncommon");
  assert.equal(run.progress("aristotle").specialTitle, null);
  run.durable();
  run.completeWork(uncommon.workActionId, uncommon.workYears);
  run.act(uncommon.activityId);
  assert.equal(run.progress("aristotle").associationRank, "Uncommon");
  assert.equal(run.progress("aristotle").nextStage!.definition.rank, "Rare");
  run.durable();
  return run;
}
let actual: ReturnType<typeof actualAristotle> | undefined;
const actualRun = () => actual ??= actualAristotle();

test("real work and separate claims earn Common then Uncommon and survive save/replay", () => {
  const run = actualRun(), [common, uncommon] = run.path("aristotle").stages;
  const commonRecord = run.life.accomplishments!.find(record => record.achievementId === common.achievementId)!;
  const uncommonRecord = run.life.accomplishments!.find(record => record.achievementId === uncommon.achievementId)!;
  assert.ok(commonRecord.age < uncommonRecord.age);
  assert.ok(run.life.accomplishments!.indexOf(commonRecord) < run.life.accomplishments!.indexOf(uncommonRecord));
  assert.equal(run.life.vocations!.completed[common.workActionId], common.workYears);
  assert.equal(run.life.vocations!.completed[uncommon.workActionId], uncommon.workYears);
});

test("skipped or unrelated Common records cannot validate a later contribution", () => {
  const run = actualRun(), path = run.path("aristotle"), common = path.stages[0];
  for (const alter of [
    (life: typeof run.life) => { life.accomplishments = life.accomplishments!.filter(record => record.achievementId !== common.achievementId); },
    (life: typeof run.life) => { life.accomplishments!.find(record => record.achievementId === common.achievementId)!.sourceId = path.stages[1].activityId; },
  ]) {
    const life = structuredClone(run.life); alter(life);
    const progress = getFigurePathProgress(run.world, path, life);
    assert.equal(progress.stages[0].earned, false);
    assert.equal(progress.stages[1].earned, false);
    assert.equal(progress.associationRank, null);
  }
});

test("validation rejects a missing Common stage or an out-of-order four-grade ladder", () => {
  let world = build(), path = world.figurePaths!.find(path => path.id === "euclid")!;
  path.stages.shift();
  assert.throws(() => validateWorld(world), /Common|stage|contribution/i);
  world = build(); path = world.figurePaths!.find(path => path.id === "euclid")!;
  [path.stages[0].rank, path.stages[1].rank] = [path.stages[1].rank, path.stages[0].rank];
  assert.throws(() => validateWorld(world), /Common|stage|contribution/i);
});


test("Alexander's four contribution grades and funded campaign resolve by his 323 BCE deadline", () => {
  const run = figureFixture("legendary-common-alexander-deadline", 18, world => {
    Object.assign(world, buildCommonContributionWorld(buildContributionTierWorld(world)));
    const path = world.figurePaths!.find(path => path.id === "alexander")!;
    const claim = world.character!.activities.find(activity => activity.id === path.capstone.activityId)!;
    for (const outcome of claim.outcomes) outcome.weight = outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === path.capstone.achievementId) ? 1_000_000_000 : 1;
  });
  const path = run.path("alexander");
  assert.equal(run.life.year, -332);
  run.act(path.encounter.activityId);
  assert.equal(run.progress("alexander").encounterMode, "direct");
  run.contribute(path);
  assert.deepEqual(run.progress("alexander").stages.filter(stage => stage.earned).map(stage => stage.definition.rank), ["Common", "Uncommon", "Rare", "Epic"]);
  run.completeCapstone(path);
  const progress = run.progress("alexander");
  assert.equal(progress.specialTitle!.rank, "Legendary");
  assert.equal(progress.capstone.record!.year, -323);
  assert.equal(run.life.age, 27);
  assert.equal(run.life.vocations!.completed["fig-alexander-capstone-work"], 2);
  assert.deepEqual(path.stages.map(stage => run.life.accomplishments!.find(record => record.achievementId === stage.achievementId)!.year), [-331, -330, -328, -325]);
  run.durable();
});
