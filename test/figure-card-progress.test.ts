import assert from "node:assert/strict";
import test from "node:test";
import { yearAtAge } from "../src/calendar.ts";
import { getFigureCardProgress, canPreviewFigureRank } from "../src/figures/card-progress.ts";
import type { AccomplishmentRecord, LifeState, WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

// Authored records isolate projection/provenance behavior. Real command reachability,
// qualified material consumption and replay are covered by the existing figure route suites.
function fixture(id = "aristotle") {
  const world = structuredClone(base) as unknown as WorldPack, path = world.figurePaths!.find(path => path.id === id)!;
  const life = {
    age: 90, birthYear: world.startYear, year: yearAtAge(world.startYear, 90), phase: "ready",
    stats: { health: 100, knowledge: 100, bonds: 100, wealth: 100 }, flags: {},
    character: { skills: Object.fromEntries(Object.keys(world.character!.skills).map(id => [id, 100])) },
    vocations: { completed: {} }, capabilities: { learned: {}, evidence: [] }, accomplishments: [],
  } as unknown as LifeState;
  const entryAge = Math.max(18, path.encounter.fromYear - world.startYear);
  function record(achievementId: string, sourceId: string, age: number, outcomeId?: string): AccomplishmentRecord {
    const definition = world.legacy!.achievements.find(item => item.id === achievementId)!;
    const activity = world.character!.activities.find(item => item.id === sourceId)!;
    const outcome = outcomeId ?? activity.outcomes.find(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))!.id;
    return { id: achievementId + ":" + age, achievementId, routeId: definition.routeId, title: definition.title, description: definition.description,
      name: definition.nameTemplate, kind: definition.kind, people: [], age, year: yearAtAge(world.startYear, age), sourceId, outcomeId: outcome };
  }
  const encounter = () => life.accomplishments!.push(record(path.encounter.achievementId, path.encounter.activityId, entryAge));
  const stages = () => path.stages.forEach((stage, index) => life.accomplishments!.push(record(stage.achievementId, stage.activityId, entryAge + [1, 3, 6][index])));
  const capstone = () => life.accomplishments!.push(record(path.capstone.achievementId, path.capstone.activityId, entryAge + 8));
  const promotionAge = Math.max(entryAge + 9, id === "demetrius" || id === "ptolemy" ? 46 : 0);
  const progress = () => getFigureCardProgress(world, life, id)!;
  return { world, life, path, entryAge, promotionAge, encounter, stages, capstone, record, progress };
}

test("high scores, arbitrary flags and a preview selection grant no rarity or traits", () => {
  for (const id of ["alexander", "pytheas", "demetrius", "ptolemy", "zeno"]) {
    const f = fixture(id);
    f.life.flags["rhodes-captured"] = true;
    f.life.flags["ptolemaic-dynasty-founded"] = true;
    f.life.flags["stoic-school-established"] = true;
    const before = JSON.stringify(f.life), worldBefore = JSON.stringify(f.world);
    const card = f.progress();
    assert.equal(card.earnedPrincipalRank, null);
    assert.equal(card.contributor.rank, null);
    assert.ok(card.traits.every(trait => !trait.earned));
    assert.ok(card.variants.every(variant => !variant.earned));
    assert.equal(canPreviewFigureRank(id, card.roster.maximumRank), true);
    assert.equal(JSON.stringify(f.life), before);
    assert.equal(JSON.stringify(f.world), worldBefore);
  }
});

test("contribution traits track qualified work before a non-circular rank claim", () => {
  const f = fixture(); f.encounter();
  const first = f.path.stages[0], rare = f.path.stages[1];
  f.life.accomplishments!.push(f.record(first.achievementId, first.activityId, f.entryAge + 1));
  f.life.vocations!.completed[rare.workActionId] = rare.workYears;
  for (const node of f.world.capabilities!.nodes) f.life.capabilities!.learned[node.id] = { age: 18, year: yearAtAge(f.world.startYear, 18) };
  const card = f.progress();
  assert.equal(card.contributor.rank, "Uncommon");
  assert.equal(card.contributor.nextRank, "Rare");
  assert.equal(card.contributor.ready, true);
  assert.equal(card.traits.find(trait => trait.id === "aristotle-specialist")!.earned, true);
  assert.equal(card.earnedPrincipalRank, null);
  assert.ok(card.contributor.requirements.some(text => text.includes("Record")));
});

test("Epic contributor impact stays separate from a Legendary principal card", () => {
  const f = fixture(); f.encounter(); f.stages();
  const card = f.progress();
  assert.equal(card.contributor.rank, "Epic");
  assert.equal(card.contributor.nextRank, null);
  assert.equal(card.earnedPrincipalRank, null);
  assert.equal(card.traits.find(trait => trait.id === "aristotle-enduring-impact")!.earned, true);
  assert.equal(card.traits.find(trait => trait.id === "aristotle-defining-legacy")!.earned, false);
  f.capstone();
  assert.equal(f.progress().earnedPrincipalRank, "Legendary");
  assert.equal(f.progress().traits.find(trait => trait.id === "aristotle-defining-legacy")!.earned, true);
});

test("conditional Legendary cards need the successful matching milestone and a valid capstone", () => {
  for (const id of ["demetrius", "ptolemy", "zeno"]) {
    const f = fixture(id); f.encounter(); f.stages();
    const promotion = f.path.promotion!;
    const success = f.record(promotion.achievementId, promotion.activityId, f.promotionAge);
    f.life.accomplishments!.push(success);
    assert.equal(f.progress().earnedPrincipalRank, null);
    assert.equal(f.progress().variants.find(variant => variant.rank === "Legendary")!.earned, false);
    f.capstone();
    assert.equal(f.progress().earnedPrincipalRank, "Legendary");
    assert.equal(f.progress().variants.find(variant => variant.rank === "Legendary")!.earned, true);
    assert.equal(f.progress().traits.find(trait => trait.id.endsWith("-defining-legacy"))!.earned, true);
  }
});

test("wrong-figure and failed milestone records never award the Legendary variant", () => {
  const f = fixture("demetrius"); f.encounter(); f.stages(); f.capstone();
  const other = f.world.figurePaths!.find(path => path.id === "ptolemy")!;
  f.life.accomplishments!.push(f.record(other.promotion!.achievementId, other.promotion!.activityId, 46));
  assert.equal(f.progress().earnedPrincipalRank, "Epic");
  const promotion = f.path.promotion!, activity = f.world.character!.activities.find(activity => activity.id === promotion.activityId)!;
  const failure = activity.outcomes.find(outcome => !outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === promotion.achievementId))!;
  f.life.accomplishments!.push(f.record(promotion.achievementId, promotion.activityId, 46, failure.id));
  assert.equal(f.progress().earnedPrincipalRank, "Epic");
  assert.equal(f.progress().variants.find(variant => variant.rank === "Legendary")!.earned, false);
  assert.equal(f.progress().traits.find(trait => trait.id === "demetrius-defining-legacy")!.earned, false);
});

test("fixed Epic cards cannot become Legendary through traits or a mismatched world policy", () => {
  for (const id of ["pytheas", "theophrastus", "cleomenes"]) {
    const f = fixture(id); f.encounter(); f.stages(); f.capstone();
    assert.equal(f.progress().earnedPrincipalRank, "Epic");
    assert.equal(f.progress().variants.length, 1);
    assert.equal(canPreviewFigureRank(id, "Legendary"), false);
    f.path.maximumRank = "Legendary";
    assert.equal(f.progress().earnedPrincipalRank, null);
    assert.equal(f.progress().pathProgress, null);
  }
});

test("failed decisive command keeps contribution traits without granting the principal title", () => {
  const f = fixture("alexander"); f.encounter(); f.stages();
  const attemptId = f.path.capstone.attemptAchievementId!, activity = f.world.character!.activities.find(activity => activity.id === f.path.capstone.activityId)!;
  const failure = activity.outcomes.find(outcome => !outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === f.path.capstone.achievementId))!;
  f.life.accomplishments!.push(f.record(attemptId, activity.id, 26, failure.id));
  const card = f.progress();
  assert.equal(card.pathProgress!.capstone.failed, true);
  assert.equal(card.contributor.rank, "Epic");
  assert.equal(card.earnedPrincipalRank, null);
  assert.equal(card.traits.find(trait => trait.id === "alexander-defining-legacy")!.earned, false);
  assert.ok(card.variants[0].requirements.some(text => /unsuccessful/i.test(text)));
});

test("specialist trait subjects reflect distinct historical paths", () => {
  const ids = ["alexander", "aristotle", "lysippos", "menander", "pytheas", "cleomenes", "zeno"];
  const labels = ids.map(id => fixture(id).progress().traits.find(trait => trait.id.endsWith("-specialist"))!.label);
  assert.equal(new Set(labels).size, ids.length);
});

test("older worlds and unknown figures do not fabricate earned cards", () => {
  const f = fixture(); delete f.world.figurePaths;
  const card = f.progress();
  assert.equal(card.pathProgress, null);
  assert.equal(card.earnedPrincipalRank, null);
  assert.ok(card.traits.every(trait => !trait.earned));
  assert.equal(getFigureCardProgress(f.world, f.life, "invented"), undefined);
});
