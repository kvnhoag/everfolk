import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { ActivityAvailability, LifeState } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { characterActivitySummary, visibleCharacterSections, visibleFamilyActivities } from "../client/models/character-panel-model.ts";
import { practiceBlockReason } from "../client/models/skill-tree.ts";

const engine = createEngine(pack);
function lifeAt(age: number): LifeState {
  const life = structuredClone(engine.start("progressive-character-ui"));
  life.age = age;
  life.year = pack.startYear + age;
  life.phase = "ready";
  life.pendingEventId = null;
  return life;
}
const ids = (life: LifeState, known = false) => visibleCharacterSections(life, engine.world, known).map(section => section.id);
function action(id: string, patch: Partial<ActivityAvailability> = {}): ActivityAvailability {
  return { id, category: "family", text: id, minAge: 12, available: true, outcomes: [{ id: `${id}-result`, weight: 1, text: "Done.", effects: [] }], ...patch };
}

test("newborn management shows skills and household money without adult career or family prompts", () => {
  const life = lifeAt(0), before = structuredClone(life);
  assert.deepEqual(ids(life), ["skills", "wealth"]);
  assert.equal(characterActivitySummary(life, engine.getActivities(life)), "Activities unlock as you grow.");
  assert.deepEqual(visibleFamilyActivities(life, engine.getActivities(life)), []);
  assert.deepEqual(life, before);
});

test("family and career sections unlock at relevant ages, while relationships still require a known adult", () => {
  assert.deepEqual(ids(lifeAt(11)), ["skills", "wealth"]);
  assert.deepEqual(ids(lifeAt(12)), ["career", "skills", "wealth", "children"]);
  assert.deepEqual(ids(lifeAt(16)), ["career", "skills", "wealth", "children"]);
  assert.equal(ids(lifeAt(17), true).includes("relationships"), false);
  assert.equal(ids(lifeAt(18)).includes("relationships"), false);
  assert.equal(ids(lifeAt(18), true).includes("relationships"), true);
  const employed = lifeAt(15);
  employed.character!.jobId = "porter";
  assert.equal(ids(employed).includes("career"), true);
});

test("family activities omit future-age, childcare and family-planning actions until relevant", () => {
  const chores = action("chores");
  const care = action("childcare", { minAge: 20, when: { type: "all", conditions: [{ type: "children", op: "gte", value: 1 }] } });
  const planning = action("start-family", { minAge: 20, outcomes: [{ id: "born", weight: 1, text: "Born.", effects: [{ type: "child" }] }] });
  const activities = [chores, care, planning];
  assert.deepEqual(visibleFamilyActivities(lifeAt(12), activities).map(activity => activity.id), ["chores"]);
  const adult = lifeAt(20);
  assert.deepEqual(visibleFamilyActivities(adult, activities).map(activity => activity.id), ["chores"]);
  adult.character!.relationshipStatus = "married";
  assert.deepEqual(visibleFamilyActivities(adult, activities).map(activity => activity.id), ["chores", "start-family"]);
  adult.character!.children.push({ id: "child", name: "Child", birthAge: 20, otherParentId: "partner" });
  assert.deepEqual(visibleFamilyActivities(adult, activities).map(activity => activity.id), ["chores", "childcare", "start-family"]);
});

test("family recovery actions appear only while an actual condition needs care", () => {
  const healthy = lifeAt(0);
  const activities = engine.getActivities(healthy);
  const careIds = activities.filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "care"))).map(activity => activity.id);
  assert.equal(careIds.length, 3);
  assert.deepEqual(visibleFamilyActivities(healthy, activities).filter(activity => careIds.includes(activity.id)), []);
  const unwell = structuredClone(healthy);
  unwell.health!.conditions.push({ id: "pneumonia", sinceAge: 0, lastProgressAge: -1, care: 0 });
  assert.deepEqual(visibleFamilyActivities(unwell, engine.getActivities(unwell)).filter(activity => careIds.includes(activity.id)).map(activity => activity.id), careIds);
});

test("activity status does not promise a yearly action when only a minor payment is available", () => {
  const life = lifeAt(20);
  const payment = action("repayment", { category: "finance", usesYearlyActivity: false });
  const locked = action("training", { category: "training", available: false, reason: "Needs cash." });
  assert.equal(characterActivitySummary(life, [payment, locked]), "Other actions are available below.");
  assert.equal(characterActivitySummary(life, [payment, { ...locked, available: true }]), "Choose one activity this year.");
  life.character!.lastActivityAge = life.age;
  assert.equal(characterActivitySummary(life, [payment]), "Yearly activity used. Other actions are still available.");
});

test("minor payments remain clickable after the yearly action without bypassing engine availability or pending choices", () => {
  const life = lifeAt(20);
  life.character!.lastActivityAge = life.age;
  const payment = action("repayment", { category: "finance", usesYearlyActivity: false });
  assert.equal(practiceBlockReason(payment, life), undefined);
  assert.equal(practiceBlockReason({ ...payment, available: false, reason: "Not enough cash." }, life), "Not enough cash.");
  assert.match(practiceBlockReason(action("training"), life)!, /next year/);
  life.phase = "choice";
  assert.match(practiceBlockReason(payment, life)!, /pending choice/);
  life.phase = "ended";
  assert.match(practiceBlockReason(payment, life)!, /ended/);
});
