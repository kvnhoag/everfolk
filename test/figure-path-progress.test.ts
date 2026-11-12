import assert from "node:assert/strict";
import test from "node:test";
import { yearAtAge } from "../src/calendar.ts";
import { getFigurePaths, getFigurePathProgress, figurePathMissingRequirements } from "../src/figures/progress.ts";
import type { FigurePathDefinition } from "../src/figures/types.ts";
import type { AccomplishmentRecord, LifeState, WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

// These small authored-record fixtures test view/provenance rules; real-engine route
// feasibility is covered separately by the figure-path integration tests.
function fixture(options: { id?: string; conditional?: boolean; circle?: boolean } = {}) {
  const id = options.id ?? "aristotle", world = structuredClone(base) as unknown as WorldPack;
  const achievement = (stage: string) => `figure-${id}-${stage}`;
  const activity = (stage: string) => `figure-${id}-claim-${stage}`;
  const path: FigurePathDefinition = {
    id, name: options.conditional ? "Demetrius" : "Aristotle", summary: "An authored progress fixture.",
    baseRank: options.conditional ? "Epic" : "Legendary", maximumRank: "Legendary",
    sources: [{ title: "Fixture source", url: "https://example.org/source" }],
    encounter: { fromYear: -335, toYear: -322, location: "Athens", activityId: activity("encounter"), achievementId: achievement("encounter"), ...(options.circle ? { access: "circle" as const } : {}) },
    tradition: { fromYear: -321, location: "Teaching circle", activityId: activity("tradition"), achievementId: achievement("tradition") },
    stages: (["Uncommon", "Rare", "Epic"] as const).map((rank, index) => ({
      rank, title: `${rank} direct contributor`, traditionTitle: `${rank} contributor to the tradition`,
      achievementId: achievement(rank.toLowerCase()), activityId: activity(rank.toLowerCase()),
      workActionId: `figure-${id}-work-${index}`, workYears: index + 1, description: "A completed contribution.",
      requires: { type: "all", conditions: [{ type: "capability", node: "P4" }, { type: "vocation", action: `figure-${id}-work-${index}`, count: index + 1 }] },
    })),
    capstone: { title: "An independent body of work", achievementId: achievement("capstone"), activityId: activity("capstone"), description: "Earned work, not proximity to a famous person.", requires: { type: "capability", node: "PS10" } },
    ...(options.conditional ? { promotion: { achievementId: achievement("rhodes-captured"), activityId: activity("rhodes-captured"), milestone: "rhodes-captured" as const, title: "Demetrius, victor at Rhodes", alternateHistory: true } } : {}),
  };
  const sources = [
    [path.encounter.achievementId, path.encounter.activityId], [path.tradition!.achievementId, path.tradition!.activityId],
    ...path.stages.map(stage => [stage.achievementId, stage.activityId]),
    [path.capstone.achievementId, path.capstone.activityId],
    ...(path.promotion ? [[path.promotion.achievementId, path.promotion.activityId]] : []),
  ];
  for (const [achievementId, activityId] of sources) {
    world.legacy!.achievements.push({ id: achievementId, routeId: `figure-${id}`, title: achievementId, description: "A fixture achievement.", kind: "ordinary", nameTemplate: "{name}'s work", people: ["The reviewer"] });
    world.character!.activities.push({ id: activityId, minAge: 12, category: "career", usesYearlyActivity: false, text: "Submit the recorded work", outcomes: [
      { id: activityId + "-accepted", text: "The reviewer accepts the work.", weight: 1, effects: [{ type: "accomplishment", achievement: achievementId }] },
      { id: activityId + "-failed", text: "The reviewer does not accept the work.", weight: 1, effects: [] },
    ] });
  }
  (world as WorldPack & { figurePaths: FigurePathDefinition[] }).figurePaths = [path];
  const life = {
    age: 40, year: yearAtAge(world.startYear, 40), phase: "ready", rngState: 42,
    stats: { health: 100, knowledge: 100, bonds: 100, wealth: 100 }, flags: {},
    character: { skills: Object.fromEntries(Object.keys(world.character!.skills).map(id => [id, 100])) },
    capabilities: { learned: {}, evidence: [] }, vocations: { completed: {} }, accomplishments: [],
  } as unknown as LifeState;
  const record = (achievementId: string, activityId: string, age = 20): AccomplishmentRecord => ({
    id: achievementId + ":" + age, achievementId, routeId: `figure-${id}`, title: achievementId, description: "A recorded accepted contribution.", kind: "ordinary",
    name: "The work", age, year: yearAtAge(world.startYear, age), sourceId: activityId, outcomeId: activityId + "-accepted", people: ["The reviewer"],
  });
  const encounter = (tradition = false) => {
    const entry = tradition ? path.tradition! : path.encounter;
    life.accomplishments!.push(record(entry.achievementId, entry.activityId, tradition ? 30 : 18));
  };
  const allStages = (startAge = 21) => path.stages.forEach((stage, index) => life.accomplishments!.push(record(stage.achievementId, stage.activityId, startAge + index)));
  const progress = () => getFigurePathProgress(world, path, life);
  return { world, life, path, record, encounter, allStages, progress };
}

test("older worlds expose no figure paths and progress never changes a replayed life", () => {
  const f = fixture();
  assert.deepEqual(getFigurePaths(base as unknown as WorldPack, f.life), []);
  const before = JSON.stringify(f.life), worldBefore = JSON.stringify(f.world);
  assert.equal(getFigurePaths(f.world, f.life).length, 1);
  assert.equal(JSON.stringify(f.life), before);
  assert.equal(JSON.stringify(f.world), worldBefore);
});

test("high scores, dates and ordinary flags grant neither association nor a special title", () => {
  const f = fixture({ conditional: true });
  f.life.flags["rhodes-captured"] = true;
  const progress = f.progress();
  assert.equal(progress.principalRank, "Epic");
  assert.equal(progress.promoted, false);
  assert.equal(progress.encounterMode, null);
  assert.equal(progress.associationRank, null);
  assert.equal(progress.specialTitle, null);
});

test("a Legendary principal does not make the player's association Legendary", () => {
  const f = fixture(); f.encounter(); f.allStages();
  const progress = f.progress();
  assert.equal(progress.principalRank, "Legendary");
  assert.equal(progress.associationRank, "Epic");
  assert.equal(progress.associationTitle, "Epic direct contributor");
  assert.equal(progress.specialTitle, null);
  assert.equal(progress.nextStage, null);
});

test("only the authored accepted capstone awards a separate special title", () => {
  const f = fixture(); f.encounter(); f.allStages();
  const capstone = f.record(f.path.capstone.achievementId, f.path.capstone.activityId, 26);
  f.life.accomplishments!.push({ ...capstone, outcomeId: capstone.sourceId + "-failed" });
  assert.equal(f.progress().specialTitle, null);
  f.life.accomplishments!.push(capstone);
  assert.deepEqual(f.progress().specialTitle, { title: f.path.capstone.title, rank: "Legendary", alternateHistory: false, record: capstone });
});

test("association stages require the preceding accepted records in chronological order", () => {
  const f = fixture(); f.allStages();
  assert.equal(f.progress().associationRank, null);
  f.encounter();
  assert.equal(f.progress().associationRank, "Epic");
  f.life.accomplishments = f.life.accomplishments!.filter(record => record.achievementId !== f.path.stages[1].achievementId);
  assert.equal(f.progress().associationRank, "Uncommon");
  const rare = f.path.stages[1];
  f.life.accomplishments.push(f.record(rare.achievementId, rare.activityId, 19));
  assert.equal(f.progress().associationRank, "Uncommon");
});

test("late teaching-tradition work uses its own title and never fabricates personal discipleship", () => {
  const f = fixture();
  const direct = f.path.encounter;
  f.life.accomplishments!.push(f.record(direct.achievementId, direct.activityId, 31));
  assert.equal(f.progress().encounterMode, null);
  f.encounter(true); f.allStages(31);
  assert.equal(f.progress().encounterMode, "tradition");
  assert.equal(f.progress().associationTitle, "Epic contributor to the tradition");
});

test("a Euclidean teaching circle is not represented as an attested personal meeting", () => {
  const f = fixture({ circle: true }); f.encounter(); f.allStages();
  assert.equal(f.progress().encounterMode, "circle");
  assert.equal(f.progress().associationRank, "Epic");
});

test("an earned title remains valid after the original encounter window closes", () => {
  const f = fixture(); f.encounter(); f.allStages();
  const record = f.record(f.path.capstone.achievementId, f.path.capstone.activityId, 27);
  f.life.accomplishments!.push(record);
  assert.equal(f.life.year > f.path.encounter.toYear!, true);
  assert.equal(f.progress().specialTitle?.record.id, record.id);
  assert.equal(f.progress().directAvailable, false);
});

test("future, malformed-calendar, wrong-route and wrong-source records are ignored", () => {
  const f = fixture();
  const record = f.record(f.path.encounter.achievementId, f.path.encounter.activityId, 18);
  const variants = [
    { ...record, age: 50, year: yearAtAge(f.world.startYear, 50) },
    { ...record, year: record.year + 1 },
    { ...record, routeId: "figure-euclid" },
    { ...record, sourceId: "an-unrelated-activity" },
    { ...record, outcomeId: "an-unrelated-result" },
  ];
  for (const candidate of variants) {
    f.life.accomplishments = [candidate]; assert.equal(f.progress().encounterMode, null);
  }
});

test("only the matching successful promotion outcome changes the principal's rank", () => {
  const f = fixture({ id: "demetrius", conditional: true }); f.encounter(); f.allStages();
  const promotion = f.path.promotion!;
  const record = f.record(promotion.achievementId, promotion.activityId, 26);
  f.life.accomplishments!.push({ ...record, sourceId: f.path.capstone.activityId });
  assert.equal(f.progress().principalRank, "Epic");
  f.life.accomplishments!.push({ ...record, outcomeId: promotion.activityId + "-failed" });
  assert.equal(f.progress().principalRank, "Epic");
  f.life.accomplishments!.push(record);
  assert.equal(f.progress().principalRank, "Epic", "A promotion needs its figure-defining capstone as well as association work.");
  assert.equal(f.progress().specialTitle, null);
  f.life.accomplishments!.push(f.record(f.path.capstone.achievementId, f.path.capstone.activityId, 26));
  const progress = f.progress();
  assert.equal(progress.principalRank, "Legendary");
  assert.equal(progress.principalTitle, promotion.title);
  assert.equal(progress.alternateHistory, true);
  assert.equal(progress.specialTitle?.rank, "Legendary");
  assert.equal(progress.specialTitle?.title, promotion.title);
  assert.equal(progress.specialTitle?.alternateHistory, true);
});

test("an orphan or chronologically premature promotion cannot borrow another route's achievement", () => {
  const f = fixture({ id: "demetrius", conditional: true });
  const promotion = f.path.promotion!;
  f.life.accomplishments!.push(f.record(promotion.achievementId, promotion.activityId, 19));
  assert.equal(f.progress().promoted, false);
  f.encounter(); f.allStages();
  assert.equal(f.progress().promoted, false);
  f.life.accomplishments!.push(f.record(f.path.capstone.achievementId, f.path.capstone.activityId, 19));
  assert.equal(f.progress().specialTitle, null);
});

test("missing requirements explain actual capability and completed-work gaps", () => {
  const f = fixture(); f.encounter();
  let next = f.progress().nextStage!;
  assert.equal(next.ready, false);
  assert.ok(next.missingRequirements.some(text => text.includes("P4")));
  assert.ok(next.missingRequirements.some(text => text.includes("work year")));
  f.life.capabilities!.learned.P4 = { year: f.life.year, evidenceIds: [] };
  f.life.vocations!.completed[f.path.stages[0].workActionId] = 1;
  next = f.progress().nextStage!;
  assert.equal(next.ready, true);
  assert.deepEqual(next.missingRequirements, []);
  assert.deepEqual(figurePathMissingRequirements(f.world, f.life, { type: "any", conditions: [{ type: "capability", node: "PS10" }, { type: "vocation", action: "unperformed-work", count: 2 }] }).map(text => text.startsWith("Meet one of:")), [true]);
});


test("a separately recorded promotion must not precede the accepted figure-defining capstone", () => {
  const f = fixture({ id: "demetrius", conditional: true }); f.encounter(); f.allStages();
  const promotion = f.path.promotion!;
  f.life.accomplishments!.push(f.record(promotion.achievementId, promotion.activityId, 25));
  f.life.accomplishments!.push(f.record(f.path.capstone.achievementId, f.path.capstone.activityId, 26));
  assert.equal(f.progress().promoted, false);
  assert.equal(f.progress().specialTitle?.rank, "Epic");
  f.life.accomplishments = f.life.accomplishments!.filter(record => record.achievementId !== promotion.achievementId);
  f.life.accomplishments.push(f.record(promotion.achievementId, promotion.activityId, 27));
  assert.equal(f.progress().promoted, true);
});


test("a failed one-shot capstone is explicit and never displays a title or another ready attempt", () => {
  const f = fixture({ id: "alexander" }); f.encounter(); f.allStages();
  const attemptId = "figure-alexander-capstone-attempt";
  f.path.capstone.attemptAchievementId = attemptId;
  f.world.legacy!.achievements.push({ id: attemptId, routeId: "figure-alexander", title: "Campaign assessment resolved", description: "An attempt is not success.", kind: "prestige", nameTemplate: "Campaign attempt", people: ["The reviewer"] });
  const activity = f.world.character!.activities.find(activity => activity.id === f.path.capstone.activityId)!;
  activity.outcomes.find(outcome => outcome.id.endsWith("-failed"))!.effects.push({ type: "accomplishment", achievement: attemptId });
  const record = f.record(attemptId, activity.id, 26); record.outcomeId = activity.id + "-failed";
  f.life.accomplishments!.push({ ...record, sourceId: "an-unrelated-assessment" });
  assert.equal(f.progress().capstone.attempted, false);
  f.life.accomplishments!.push(record);
  const progress = f.progress();
  assert.equal(progress.capstone.attempted, true);
  assert.equal(progress.capstone.failed, true);
  assert.equal(progress.capstone.earned, false);
  assert.equal(progress.capstone.ready, false);
  assert.equal(progress.specialTitle, null);
});

test("a promotion failure needs its own authored attempt record and retains the earned Epic title", () => {
  const f = fixture({ id: "demetrius", conditional: true }); f.encounter(); f.allStages();
  f.life.accomplishments!.push(f.record(f.path.capstone.achievementId, f.path.capstone.activityId, 26));
  const promotion = f.path.promotion!, attemptId = "figure-demetrius-promotion-attempt";
  promotion.attemptAchievementId = attemptId;
  f.world.legacy!.achievements.push({ id: attemptId, routeId: "figure-demetrius", title: "Rhodes resolved", description: "A failed assault.", kind: "prestige", nameTemplate: "Rhodes outcome", people: ["The reviewer"] });
  const activity = f.world.character!.activities.find(activity => activity.id === promotion.activityId)!;
  activity.outcomes.find(outcome => outcome.id.endsWith("-failed"))!.effects.push({ type: "accomplishment", achievement: attemptId });
  const record = f.record(attemptId, activity.id, 27); record.outcomeId = activity.id + "-failed";
  f.life.accomplishments!.push({ ...record, sourceId: f.path.capstone.activityId });
  assert.equal(f.progress().promotionOutcome, "not-attempted");
  f.life.accomplishments!.push(record);
  const progress = f.progress();
  assert.equal(progress.promotionOutcome, "failed");
  assert.equal(progress.principalRank, "Epic");
  assert.equal(progress.specialTitle?.rank, "Epic");
  assert.equal(progress.promoted, false);
});
