import assert from "node:assert/strict";
import test from "node:test";
import { FIGURES } from "../chain/catalog/figures.ts";
import { DEMO_FIGURES } from "../chain/catalog/demo-figures.ts";
import {
  matchStageFigure,
  matchStageRecordToHistorical,
  type StageCharacterContext,
  type StageRecord,
} from "../chain/stage-figures.ts";

test("historical figure requirements define stage and age windows", () => {
  const alexander = FIGURES.find(f => f.figure === "alexander")!;
  assert.ok(alexander.stages?.includes("adulthood"), "Alexander includes adulthood");
  assert.ok(alexander.stages?.includes("youth"), "Alexander includes youth");
  assert.equal(alexander.minAge, 14);
  assert.equal(alexander.maxAge, 32);

  const aristotle = FIGURES.find(f => f.figure === "aristotle")!;
  assert.ok(aristotle.stages?.includes("adulthood"));
  assert.equal(aristotle.minAge, 30);

  const euclid = FIGURES.find(f => f.figure === "euclid")!;
  assert.ok(euclid.stages?.includes("adulthood"));
  assert.equal(euclid.minAge, 25);

  const cleomenes = FIGURES.find(f => f.figure === "cleomenes")!;
  assert.ok(cleomenes.stages?.includes("adulthood"));
  assert.equal(cleomenes.minAge, 30);

  const demoCleomenes = DEMO_FIGURES.find(f => f.figure === "cleomenes")!;
  assert.ok(demoCleomenes.stages?.includes("adulthood"));
  assert.equal(demoCleomenes.minAge, 30);
});

test("stage record meeting Alexander requirements at similar age matches historical figure", () => {
  const stage: StageRecord = {
    stageId: "adulthood",
    title: "Adulthood",
    fromAge: 16,
    toAge: 30,
    district: "royal-quarter",
    field: "warfare",
    tier: 4,
    jobId: "general",
    topSkills: { warfare: 75, oratory: 55 },
    nodes: ["tactics", "command", "logistics"],
    reputation: 35,
    accomplishments: ["military-prestige"],
    mentors: ["mentor-general"],
  };

  const context: StageCharacterContext = {
    characterName: "Alexandros",
    originId: "royal-household",
    sex: "male",
    avatarVariant: 0,
    seed: "test-seed-alexander",
  };

  const match = matchStageFigure(stage, context, FIGURES);
  assert.equal(match.kind, "historical");
  assert.equal(match.historicalFigureId, "alexander");
  assert.equal(match.name, "Alexander the Great");
  assert.equal(match.title, "Alexander the Great");
  assert.match(match.media, /alexander\.png/);
});

test("Alexander requirements are rejected if stage age is out of window", () => {
  const childhoodStage: StageRecord = {
    stageId: "childhood",
    title: "Childhood",
    fromAge: 6,
    toAge: 11,
    district: "royal-quarter",
    field: "warfare",
    tier: 1,
    jobId: "general", // hypothetical
    topSkills: { warfare: 75, oratory: 55 },
    nodes: [],
    reputation: 30,
    accomplishments: ["military-prestige"],
    mentors: [],
  };

  const context: StageCharacterContext = {
    characterName: "Alexandros",
    originId: "royal-household",
    sex: "male",
    avatarVariant: 0,
    seed: "test-seed-alexander-child",
  };

  const historical = matchStageRecordToHistorical(childhoodStage, context, FIGURES);
  assert.equal(historical, null, "Childhood must not match Alexander");

  const match = matchStageFigure(childhoodStage, context, FIGURES);
  assert.equal(match.kind, "generic");
  assert.equal(match.name, "Alexandros");
  assert.match(match.media, /\.svg/);
});

test("Alexander requirements are rejected if age exceeds maxAge", () => {
  const olderStage: StageRecord = {
    stageId: "adulthood",
    title: "Adulthood",
    fromAge: 35,
    toAge: 50,
    district: "royal-quarter",
    field: "warfare",
    tier: 4,
    jobId: "general",
    topSkills: { warfare: 85, oratory: 65 },
    nodes: [],
    reputation: 40,
    accomplishments: ["military-prestige"],
    mentors: [],
  };

  const context: StageCharacterContext = {
    characterName: "Alexandros",
    originId: "royal-household",
    sex: "male",
    avatarVariant: 0,
    seed: "test-seed-alexander-older",
  };

  const historical = matchStageRecordToHistorical(olderStage, context, FIGURES);
  assert.equal(historical, null, "Ages 35-50 must not match Alexander (maxAge 32)");

  const match = matchStageFigure(olderStage, context, FIGURES);
  assert.equal(match.kind, "generic");
  assert.equal(match.name, "Alexandros");
});

test("stage record meeting Aristotle requirements matches Aristotle", () => {
  const stage: StageRecord = {
    stageId: "adulthood",
    title: "Adulthood",
    fromAge: 16,
    toAge: 40,
    district: "museum-quarter",
    field: "letters",
    tier: 4,
    jobId: "philosophy-tutor",
    topSkills: { literacy: 80, philosophy: 80, oratory: 55 },
    nodes: ["dialectic", "logic"],
    reputation: 35,
    accomplishments: ["philosophy-first-work"],
    mentors: [],
  };

  const context: StageCharacterContext = {
    characterName: "Aristoteles",
    originId: "clerk-household",
    sex: "male",
    avatarVariant: 1,
    seed: "test-seed-aristotle",
    stats: { knowledge: 70 },
  };

  const match = matchStageFigure(stage, context, FIGURES);
  assert.equal(match.kind, "historical");
  assert.equal(match.historicalFigureId, "aristotle");
  assert.equal(match.name, "Aristotle");
  assert.equal(match.title, "Aristotle, the philosopher and naturalist");
});

test("stage record for ordinary work resolves to generic stage portrait with character portrait", () => {
  const farmerStage: StageRecord = {
    stageId: "adulthood",
    title: "Adulthood",
    fromAge: 16,
    toAge: 45,
    district: "rhakotis",
    field: "farming",
    tier: 2,
    jobId: "tenant-farmer",
    topSkills: { farming: 60, reckoning: 30 },
    nodes: ["crop-rotation", "irrigation"],
    reputation: 25,
    accomplishments: [],
    mentors: ["mentor-farmer"],
  };

  const context: StageCharacterContext = {
    characterName: "Damon",
    originId: "delta-newcomers",
    sex: "male",
    avatarVariant: 1,
    seed: "test-seed-damon",
  };

  const match = matchStageFigure(farmerStage, context, DEMO_FIGURES);
  assert.equal(match.kind, "generic");
  assert.equal(match.historicalFigureId, undefined);
  assert.equal(match.name, "Damon");
  assert.match(match.title, /Tenant farmer/i);
  assert.match(match.media, /portraits\/delta-newcomers\/male\/adult-1\.svg/);
  assert.deepEqual(match.stageRecord, farmerStage);
});

test("infancy stage resolves to generic infant portrait", () => {
  const infantStage: StageRecord = {
    stageId: "infancy",
    title: "Infancy",
    fromAge: 0,
    toAge: 2,
    district: "rhakotis",
    field: "farming",
    tier: 1,
    topSkills: {},
    nodes: [],
    reputation: 0,
    accomplishments: [],
    mentors: [],
  };

  const context: StageCharacterContext = {
    characterName: "Petosiris",
    originId: "fishing-household",
    sex: "male",
    avatarVariant: 0,
    seed: "test-infant",
  };

  const match = matchStageFigure(infantStage, context, DEMO_FIGURES);
  assert.equal(match.kind, "generic");
  assert.equal(match.name, "Petosiris");
  assert.match(match.media, /portraits\/fishing-household\/male\/infant-0\.svg/);
});
