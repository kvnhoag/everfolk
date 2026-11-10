import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, yearAtAge } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { BANNER_SITUATION_IDS, BANNER_SITUATIONS, resolveLifeBanner } from "../client/banner-state.ts";
import type { BannerSituationId } from "../client/banner-state.ts";
import type { SceneContext } from "../client/scene-model.ts";
import worldInput from "../worlds/alexandria-sample.json" with { type: "json" };

const world = worldInput as WorldPack;
const engine = createEngine(world);

// Isolated presentation fixtures: no saved run is rewritten by the UI.
function lifeAt(age = 24): LifeState {
  const life = structuredClone(engine.start("banner-state-fixture"));
  life.age = age; life.year = yearAtAge(world.startYear, age);
  life.phase = "ready"; life.pendingEventId = null; life.journal = [];
  life.health!.conditions = []; life.health!.needsCareDecision = false;
  life.character!.jobId = null; life.character!.children = [];
  life.character!.partnerId = null; life.character!.relationshipStatus = "single";
  life.character!.relationships!.partners = {};
  return life;
}

function context(change: Partial<SceneContext> = {}): SceneContext {
  return {
    id: "fixture-context", key: "fixture-context", kind: "fallback", scene: "history-city", motion: "city",
    title: "A day in the city", caption: "An errand takes you into the street.", alt: "A city street", ...change,
  };
}

test("the banner phase follows all six exact age boundaries and a high skill never creates a career", () => {
  for (const [age, stage, label, situation] of [
    [0, "infant", "Infancy", "home"], [2, "infant", "Infancy", "home"], [3, "child", "Childhood", "courtyard"],
    [12, "child", "Childhood", "courtyard"], [13, "youth", "Youth", "study"], [17, "youth", "Youth", "study"],
    [18, "adult", "Adulthood", "civic"], [39, "adult", "Adulthood", "civic"],
    [40, "middle", "Middle years", "civic"], [59, "middle", "Middle years", "civic"], [60, "elder", "Later life", "home"],
  ] as const) {
    const life = lifeAt(age);
    for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 100;
    const banner = resolveLifeBanner(life, world);
    assert.equal(banner.stage, stage); assert.equal(banner.title, label); assert.equal(banner.situation, situation);
    assert.equal(banner.actorPose === "cradle", age < 3);
  }
});

test("established occupations cover every current job, including all seven featured careers", () => {
  const expected: Record<string, BannerSituationId> = {
    apprentice: "workshop", porter: "harbor", potter: "workshop", clerk: "market", copyist: "study", sailor: "harbor",
    shopkeeper: "market", "ceramic-decorator": "workshop", "wood-carver": "workshop", sculptor: "sculpture",
    "philosophy-tutor": "philosophy", "sky-table-calculator": "astronomy", astrologer: "astronomy", soldier: "military",
    officer: "military", general: "military", "court-adviser": "civic", "patron-supported-reader": "study",
    "pottery-workshop-lead": "workshop", "carving-workshop-lead": "workshop", "sculpture-workshop-lead": "sculpture", performer: "music",
  };
  assert.deepEqual(Object.keys(expected).sort(), world.character!.jobs.map(job => job.id).sort());
  for (const [job, situation] of Object.entries(expected)) {
    const life = lifeAt(); life.character!.jobId = job;
    assert.equal(resolveLifeBanner(life, world).situation, situation, job);
  }
  const retired = lifeAt(65); retired.flags.retired = true; retired.character!.jobId = "potter";
  assert.equal(resolveLifeBanner(retired, world).situation, "retirement");
  const active = lifeAt(65); active.character!.jobId = "potter";
  assert.equal(resolveLifeBanner(active, world).situation, "workshop", "old age does not invent retirement");
});

test("actual death and active illness override cheerful scenes and retain the real life stage", () => {
  const life = lifeAt(8);
  life.health!.conditions = [{ id: "pneumonia", sinceAge: 8, lastProgressAge: 8, care: 0 }];
  const happy = context({ kind: "event", eventId: "child-shared-laughter", scene: "music", motion: "gather" });
  const options = { eventVisuals: { "child-shared-laughter": { scene: "music" as const, motion: "gather" as const, caption: "A happy song." } } };
  const ill = resolveLifeBanner(life, world, happy, options);
  assert.equal(ill.situation, "illness"); assert.equal(ill.stage, "child"); assert.equal(ill.actorPose, "reclined");
  assert.match(ill.caption, /Pneumonia/); assert.doesNotMatch(ill.caption, /happy/);
  life.phase = "ended"; life.endingId = world.endings.find(ending => ending.kind === "death")!.id;
  life.deathCauseId = "early-illness";
  const dead = resolveLifeBanner(life, world);
  assert.equal(dead.situation, "memorial"); assert.equal(dead.actorVisible, false); assert.equal(dead.motion, "still");
  assert.equal(dead.stageLabel, "Childhood"); assert.equal(dead.title, "Life ended");
});

test("loan banners distinguish a coming deadline from a collector threat, and care still takes priority", () => {
  const life = lifeAt(24);
  life.economy!.loan = { balance: 120, borrowedAge: 22, dueAge: 25, extensions: 0 };
  let banner = resolveLifeBanner(life, world);
  assert.equal(banner.situation, "debt"); assert.equal(banner.situationLabel, "Repayment due next year");
  life.economy!.loan.dueAge = 24;
  assert.equal(resolveLifeBanner(life, world).situationLabel, "Repayment due this year");
  life.economy!.loan.dueAge = 24 - world.economy!.moneylender!.threatAfterYears;
  assert.equal(resolveLifeBanner(life, world).situation, "danger");
  life.health!.conditions = [{ id: "pneumonia", sinceAge: 24, lastProgressAge: 24, care: 0 }];
  assert.equal(resolveLifeBanner(life, world).situation, "illness");
  life.health!.conditions = []; life.economy!.loan.balance = 0;
  assert.equal(resolveLifeBanner(life, world).situation, "civic");
});

test("pending offers never depict an accepted voyage, partner, child or business", () => {
  const life = lifeAt(); life.phase = "choice"; life.pendingEventId = "a-place-on-the-manifest";
  const pending = context({ kind: "pending", eventId: life.pendingEventId, scene: "sea", motion: "sail" });
  assert.equal(resolveLifeBanner(life, world, pending).situation, "civic");
  const dating = context({ kind: "outcome", eventId: "date-person-harbor", scene: "history-city", motion: "gather" });
  assert.equal(resolveLifeBanner(life, world, dating).situation, "civic");
  const proposal = context({ kind: "outcome", eventId: "business-proposal-person-harbor", scene: "history-city", motion: "work" });
  assert.equal(resolveLifeBanner(life, world, proposal).situation, "civic");
  const family = context({ kind: "event", eventId: "a-new-generation", scene: "family", motion: "gather" });
  assert.equal(resolveLifeBanner(life, world, family).situation, "home");
  life.character!.relationships!.partners["person-harbor"] = { closeness: 40, lastContactAge: 24, roles: ["friend", "business-partner"] };
  assert.equal(resolveLifeBanner(life, world, dating).situation, "friendship");
  assert.equal(resolveLifeBanner(life, world, proposal).situation, "business");
  life.character!.partnerId = "person-harbor"; life.character!.relationshipStatus = "courting";
  assert.equal(resolveLifeBanner(life, world, dating).situation, "courtship");
});

test("accepted training, marriage and child care use their concrete current situations", () => {
  const life = lifeAt();
  const activity = (id: string) => context({ id: `activity-${life.age}-7-${id}`, key: id, kind: "outcome", scene: "learning", motion: "write" });
  for (const [id, situation] of [
    ["train-sculpture", "sculpture"], ["train-philosophy", "philosophy"], ["train-seamanship", "harbor"],
    ["train-warfare", "military"], ["fulfil-significant-order", "market"], ["train-astronomy", "astronomy"], ["train-music", "music"],
    ["take-a-rest-day", "recovery"],
  ] as const) assert.equal(resolveLifeBanner(life, world, activity(id)).situation, situation, id);
  life.character!.partnerId = "person-harbor"; life.character!.relationshipStatus = "married";
  assert.equal(resolveLifeBanner(life, world, activity("marry-person-harbor")).situation, "marriage");
  life.character!.children = [{ id: "child-1", name: "A child", birthAge: 24, otherParentId: "person-harbor" }];
  assert.equal(resolveLifeBanner(life, world, activity("care-for-children")).situation, "parenthood");
});

test("historical battle news stays civic while an actual war scene is distinct, with explicit author overrides honored", () => {
  const life = lifeAt(18);
  const news = context({ kind: "history", eventId: "news-of-actium", scene: "history-city", motion: "city", caption: "News arrives from Actium." });
  assert.equal(resolveLifeBanner(life, world, news).situation, "civic");
  const war = context({ kind: "history", eventId: "caesar-in-alexandria", scene: "history-war", motion: "unrest" });
  assert.equal(resolveLifeBanner(life, world, war).situation, "war");
  const custom = { "caesar-in-alexandria": { scene: "rest" as const, motion: "still" as const, caption: "An author-selected pause. Another sentence. A third sentence." } };
  const override = resolveLifeBanner(life, world, war, { eventVisuals: custom });
  assert.equal(override.situation, "recovery"); assert.equal(override.motion, "still");
  assert.equal(override.caption, "An author-selected pause. Another sentence.");
});

test("all banner IDs have a stable asset path and reading the banner leaves life and world untouched", () => {
  assert.equal(BANNER_SITUATION_IDS.length, 24);
  assert.deepEqual(Object.keys(BANNER_SITUATIONS).sort(), [...BANNER_SITUATION_IDS].sort());
  const life = lifeAt(42), before = structuredClone(life), pack = structuredClone(world);
  const banner = resolveLifeBanner(life, world, context());
  assert.equal(banner.assetSrc, `/assets/pixel/banners/${banner.situation}.svg`);
  assert.ok(banner.caption.length > 0); assert.match(banner.alt, /middle years/);
  assert.deepEqual(life, before); assert.deepEqual(world, pack);
});

test("a child with an established apprenticeship keeps the childhood phase and the actual work setting", () => {
  const life = lifeAt(12);
  life.character!.jobId = "apprentice";
  const banner = resolveLifeBanner(life, world, context());
  assert.equal(banner.title, "Childhood");
  assert.equal(banner.stage, "child");
  assert.equal(banner.situation, "workshop");
});
