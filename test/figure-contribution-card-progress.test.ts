import test from "node:test";
import assert from "node:assert/strict";
import { yearAtAge } from "../src/calendar.ts";
import { buildContributionTierWorld } from "../src/figures/contribution-world.ts";
import { getFigureCardProgress } from "../src/figures/card-progress.ts";
import type { AccomplishmentRecord, LifeState, WorldPack } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

function fixture(id: string) {
  const world = buildContributionTierWorld(retained as unknown as WorldPack);
  const path = world.figurePaths!.find(path => path.id === id)!;
  const life = { age: 90, birthYear: world.startYear, year: yearAtAge(world.startYear, 90), phase: "ready",
    stats: { health: 100, knowledge: 100, bonds: 100, wealth: 100 }, flags: {},
    character: { skills: Object.fromEntries(Object.keys(world.character!.skills).map(id => [id, 100])) },
    vocations: { completed: {} }, capabilities: { learned: {}, evidence: [] }, accomplishments: [],
  } as unknown as LifeState;
  const entryAge = Math.max(18, path.encounter.fromYear - world.startYear);
  function award(achievementId: string, sourceId: string, age: number, outcomeId?: string) {
    const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
    const activity = world.character!.activities.find(item => item.id === sourceId)!;
    const outcome = outcomeId ?? activity.outcomes.find(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!.id;
    const record: AccomplishmentRecord = { id: achievementId + ":" + age, achievementId, routeId: definition.routeId, title: definition.title,
      description: definition.description, name: definition.nameTemplate, kind: definition.kind, people: [], age,
      year: yearAtAge(world.startYear, age), sourceId, outcomeId: outcome };
    life.accomplishments!.push(record);
    return record;
  }
  function throughSenior() {
    award(path.encounter.achievementId, path.encounter.activityId, entryAge);
    return path.stages.map((stage, index) => award(stage.achievementId, stage.activityId, entryAge + [1, 3, 6][index]));
  }
  function promote(failed = false) {
    award(path.capstone.achievementId, path.capstone.activityId, entryAge + 8);
    const age = Math.max(entryAge + 9, 46), promotion = path.promotion!;
    if (failed) {
      const activity = world.character!.activities.find(activity => activity.id === promotion.activityId)!;
      const failure = activity.outcomes.find(outcome => outcome.id.endsWith("-failed"))!;
      award(promotion.attemptAchievementId!, promotion.activityId, age, failure.id);
    } else award(promotion.achievementId, promotion.activityId, age);
    return age;
  }
  return { world, life, path, entryAge, award, throughSenior, promote, progress: () => getFigureCardProgress(world, life, id)! };
}

test("new Epic figure contribution ladders begin at Common without awarding a card from scores", () => {
  for (const id of ["pytheas", "theophrastus", "cleomenes", "demetrius", "ptolemy", "zeno"]) {
    const f = fixture(id), card = f.progress();
    assert.deepEqual(card.pathProgress!.stages.map(stage => stage.definition.rank), ["Common", "Uncommon", "Rare"]);
    assert.equal(card.pathProgress!.principalRank, "Epic");
    assert.equal(card.contributor.rank, null);
    assert.equal(card.contributor.nextRank, "Common");
    assert.ok(card.variants.every(variant => !variant.earned));
  }
});

test("completed contributions remain below a fixed Epic principal", () => {
  for (const id of ["pytheas", "theophrastus", "cleomenes"]) {
    const f = fixture(id); f.throughSenior();
    assert.equal(f.progress().contributor.rank, "Rare");
    assert.equal(f.progress().contributor.nextRank, null);
    assert.match(f.progress().traits.find(trait => trait.id.endsWith("-enduring-impact"))!.requirement, /cap is Rare/);
    assert.equal(f.progress().pathProgress!.legendaryContribution, null);
  }
});

test("Legendary promotion unlocks a separate Epic contribution claim without rewriting the earlier Rare record", () => {
  for (const id of ["demetrius", "ptolemy", "zeno"]) {
    const f = fixture(id), records = f.throughSenior(), rare = structuredClone(records[2]);
    assert.equal(f.progress().contributor.rank, "Rare");
    assert.equal(f.progress().contributor.nextRank, null);
    const age = f.promote();
    const promoted = f.progress();
    assert.equal(promoted.pathProgress!.principalRank, "Legendary");
    assert.equal(promoted.contributor.rank, "Rare");
    assert.equal(promoted.contributor.nextRank, "Epic");
    assert.equal(promoted.contributor.ready, true);
    const recognition = f.path.legendaryContribution!;
    f.award(recognition.achievementId, recognition.activityId, age + 1);
    assert.equal(f.progress().contributor.rank, "Epic");
    assert.equal(f.progress().contributor.nextRank, null);
    assert.deepEqual(f.life.accomplishments!.find(record => record.id === rare.id), rare);
  }
});

test("failed or premature Legendary recognition cannot grant an Epic contribution", () => {
  const failed = fixture("demetrius"); failed.throughSenior();
  const age = failed.promote(true), recognition = failed.path.legendaryContribution!;
  failed.award(recognition.achievementId, recognition.activityId, age + 1);
  assert.equal(failed.progress().pathProgress!.principalRank, "Epic");
  assert.equal(failed.progress().contributor.rank, "Rare");
  assert.equal(failed.progress().contributor.nextRank, null);
});

test("fixed Legendary figures retain their authored Uncommon Rare Epic project ladder", () => {
  const f = fixture("aristotle"); f.throughSenior();
  assert.deepEqual(f.progress().pathProgress!.stages.map(stage => stage.definition.rank), ["Uncommon", "Rare", "Epic"]);
  assert.equal(f.progress().contributor.rank, "Epic");
  assert.equal(f.progress().earnedPrincipalRank, null);
});
