import assert from "node:assert/strict";
import test from "node:test";
import { buildContributionTierWorld } from "../src/figures/contribution-world.ts";
import { getFigurePathProgress } from "../src/figures/progress.ts";
import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import numeric from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };
import deep from "../worlds/demo/alexandria-figures-1.json" with { type: "json" };

const build = () => buildContributionTierWorld(numeric as unknown as WorldPack);
function tierFixture(seed: string, startAge = 12, success = true) {
  return figureFixture(seed, startAge, world => {
    Object.assign(world, buildContributionTierWorld(world));
    for (const path of world.figurePaths!) if (path.promotion) {
      const activity = world.character!.activities.find(activity => activity.id === path.promotion!.activityId)!;
      for (const outcome of activity.outcomes) outcome.weight = outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === path.promotion!.achievementId) === success ? 1_000_000_000 : 1;
    }
  });
}
function resolveZeno(success: boolean) {
  const run = tierFixture(`tiered-zeno-${success}`, 12, success);
  run.researchMastery(); run.cap("public-address"); run.cap("public-address");
  const path = run.path("zeno");
  run.advanceTo(path.encounter.fromYear - run.world.startYear);
  run.act(path.encounter.activityId);
  run.contribute(path);
  run.completeCapstone(path);
  const recognition = path.legendaryContribution!;
  assert.equal(run.progress("zeno").associationRank, "Rare");
  assert.equal(run.progress("zeno").principalRank, "Epic");
  assert.equal(run.progress("zeno").legendaryContribution!.ready, false);
  const before = JSON.stringify(run.life);
  assert.throws(() => run.act(recognition.activityId), /unavailable|require|condition/i);
  assert.equal(JSON.stringify(run.life), before);
  const promotionActivity = run.world.character!.activities.find(activity => activity.id === path.promotion!.activityId)!;
  for (const work of run.requiredWork(promotionActivity.when!)) run.completeWork(work.action, work.count);
  run.act(path.promotion!.activityId);
  assert.equal(run.progress("zeno").promoted, success);
  assert.equal(run.progress("zeno").associationRank, "Rare", "a principal promotion does not rewrite the earlier Rare record");
  assert.equal(run.progress("zeno").legendaryContribution!.ready, success);
  if (success) run.act(recognition.activityId);
  else assert.throws(() => run.act(recognition.activityId), /unavailable|require|condition/i);
  run.durable();
  return run;
}
let successful: ReturnType<typeof resolveZeno> | undefined;
const successRun = () => successful ??= resolveZeno(true);

test("new tiered revisions clone retained worlds, preserve IDs and gates, and keep old rank semantics intact", () => {
  for (const source of [numeric, deep]) {
    const base = source as unknown as WorldPack, before = JSON.stringify(base);
    const world = buildContributionTierWorld(base);
    validateWorld(base); validateWorld(world);
    assert.equal(world.version, base.version === "alexandria-lives-6" ? "alexandria-lives-7" : "alexandria-figures-2");
    assert.equal(JSON.stringify(base), before);
    for (const path of world.figurePaths!) {
      const old = base.figurePaths!.find(candidate => candidate.id === path.id)!;
      assert.deepEqual(old.stages.map(stage => stage.rank), ["Uncommon", "Rare", "Epic"]);
      assert.deepEqual(path.stages.map(stage => stage.rank), path.baseRank === "Epic" ? ["Common", "Uncommon", "Rare"] : ["Uncommon", "Rare", "Epic"]);
      assert.deepEqual(path.stages.map(stage => stage.achievementId), old.stages.map(stage => stage.achievementId));
      assert.deepEqual(path.stages.map(stage => stage.requires), old.stages.map(stage => stage.requires));
      assert.deepEqual(path.capstone, old.capstone);
      assert.equal(Boolean(path.legendaryContribution), Boolean(path.promotion));
    }
    assert.throws(() => buildContributionTierWorld(world), /retained/i);
  }
});

test("an Epic figure's actual three contribution projects stop at Rare and preserve replay", () => {
  const run = tierFixture("tiered-pytheas", 20), path = run.path("pytheas");
  run.act(path.encounter.activityId); run.contribute(path); run.completeCapstone(path);
  const progress = run.progress("pytheas");
  assert.equal(progress.associationRank, "Rare");
  assert.equal(progress.principalRank, "Epic");
  assert.equal(progress.specialTitle?.rank, "Epic");
  assert.equal(progress.legendaryContribution, null);
  run.durable();
});

test("Epic recognition is a separate post-Legendary claim and leaves the Rare title record intact", () => {
  const run = successRun(), path = run.path("zeno"), progress = run.progress("zeno");
  assert.equal(progress.associationRank, "Epic");
  assert.equal(progress.principalRank, "Legendary");
  assert.equal(progress.legendaryContribution!.earned, true);
  assert.equal(progress.legendaryContribution!.ready, false);
  assert.ok(run.life.accomplishments!.some(record => record.achievementId === path.stages[2].achievementId));
  assert.ok(run.life.accomplishments!.some(record => record.achievementId === path.legendaryContribution!.achievementId));
  assert.match(progress.associationTitle!, /^Distinguished /);
  const before = JSON.stringify(run.life);
  assert.throws(() => run.act(path.legendaryContribution!.activityId), /unavailable|require|condition/i);
  assert.equal(JSON.stringify(run.life), before);
});

test("a failed founding outcome keeps the principal Epic and contributor Rare", () => {
  const run = resolveZeno(false), progress = run.progress("zeno");
  assert.equal(progress.principalRank, "Epic");
  assert.equal(progress.associationRank, "Rare");
  assert.equal(progress.promotionOutcome, "failed");
  assert.equal(progress.legendaryContribution!.earned, false);
  assert.equal(progress.legendaryContribution!.ready, false);
});

test("recognition projection rejects missing, premature, reordered and wrong-source proof", () => {
  const run = successRun(), path = run.path("zeno"), recognition = path.legendaryContribution!;
  const view = (edit: (life: typeof run.life) => void) => {
    const life = structuredClone(run.life); edit(life);
    return getFigurePathProgress(run.world, path, life);
  };
  for (const edit of [
    (life: typeof run.life) => { life.accomplishments = life.accomplishments!.filter(record => record.achievementId !== path.promotion!.achievementId); },
    (life: typeof run.life) => { life.accomplishments!.find(record => record.achievementId === recognition.achievementId)!.sourceId = path.capstone.activityId; },
    (life: typeof run.life) => { life.accomplishments!.find(record => record.achievementId === recognition.achievementId)!.outcomeId = "forged"; },
    (life: typeof run.life) => { const record = life.accomplishments!.find(record => record.achievementId === recognition.achievementId)!; life.accomplishments = [record, ...life.accomplishments!.filter(item => item !== record)]; },
    (life: typeof run.life) => { life.accomplishments!.find(record => record.achievementId === recognition.achievementId)!.age = 0; },
  ]) {
    const progress = view(edit);
    assert.equal(progress.legendaryContribution!.earned, false);
    assert.notEqual(progress.associationRank, "Epic");
  }
});

test("validation rejects overlapping ladders, free recognition, wrong-figure milestones and dependency cycles", () => {
  let world = build();
  world.figurePaths!.find(path => path.id === "pytheas")!.stages[2].rank = "Epic";
  assert.throws(() => validateWorld(world), /Common, Uncommon, Rare/);
  world = build();
  let path = world.figurePaths!.find(path => path.id === "zeno")!;
  path.legendaryContribution!.requires = { type: "age", op: "gte", value: 18 };
  world.character!.activities.find(activity => activity.id === path.legendaryContribution!.activityId)!.when = path.legendaryContribution!.requires;
  assert.throws(() => validateWorld(world), /senior Rare.*successful Legendary/i);
  world = build(); path = world.figurePaths!.find(path => path.id === "zeno")!;
  const requirement = path.legendaryContribution!.requires;
  assert.equal(requirement.type, "all");
  if (requirement.type === "all") requirement.conditions[1] = { type: "accomplishment", achievement: world.figurePaths!.find(path => path.id === "ptolemy")!.promotion!.achievementId };
  assert.throws(() => validateWorld(world), /senior Rare.*successful Legendary/i);
  world = build(); path = world.figurePaths!.find(path => path.id === "zeno")!;
  path.capstone.requires = { type: "all", conditions: [path.capstone.requires, { type: "accomplishment", achievement: path.legendaryContribution!.achievementId }] };
  world.character!.activities.find(activity => activity.id === path.capstone.activityId)!.when = path.capstone.requires;
  assert.throws(() => validateWorld(world), /cycle|earlier stage/i);
  world = build();
  world.figurePaths!.find(path => path.id === "pytheas")!.legendaryContribution = structuredClone(world.figurePaths!.find(path => path.id === "zeno")!.legendaryContribution);
  assert.throws(() => validateWorld(world), /conditional Legendary principal/i);
});
