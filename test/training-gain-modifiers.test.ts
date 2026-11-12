import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { applyStatDelta, skillEffectDelta } from "../src/progression.ts";
import { getSkillImpact } from "../client/models/skill-impact.ts";
import { trainingSkillChanges } from "../client/models/skill-tree.ts";
import type { Effect, WorldPack } from "../src/types.ts";

const modifiers = [
  { flag: "early-craft", multiplier: 1.2, reason: "A remembered interest in making things" },
  { flag: "patient-practice", multiplier: 1.1, reason: "A patient teacher's encouragement" },
];
const gain = (delta = 6): Extract<Effect, { type: "skill" }> => ({ type: "skill", skill: "craft", delta, gainModifiers: structuredClone(modifiers) });
function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "training-fixture", version: "optional-training", title: "Paid training fixture", description: "Fictional mechanics test.", startYear: -66, maxAge: 10,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 50 } },
    flags: { "early-craft": { label: "Early craft interest", initial: true }, "patient-practice": { label: "Patient practice", initial: true } },
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "The record ends", text: "A fictional ending.", kind: "death" }], defaultEnding: "end",
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored test currency.", assets: [] },
    character: {
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 39, gainCurve: [{ from: 0, multiplier: 1 }, { from: 40, multiplier: .5 }, { from: 70, multiplier: .2 }, { from: 90, multiplier: .05 }] } },
      jobs: [], partners: [], childNames: ["Child"], deathCauses: [{ id: "old", title: "A fictional ending", text: "The fixture ends.", weight: 1 }], deathCauseDescription: "Fictional fixture.",
      activities: [{ id: "train-craft", text: "Pay for supervised practice", category: "training", outcomes: [{ id: "practised", text: "You pay for supervised practice.", weight: 1, effects: [{ type: "cash", delta: -5 }, gain()] }] }],
    },
    legacy: { routes: [{ id: "sculpture", title: "Sculpture", description: "Make something.", skillIds: ["craft"], jobIds: [], achievementIds: ["first-work"], earlyInterestFlag: "early-craft" }],
      achievements: [{ id: "first-work", routeId: "sculpture", title: "First work", description: "Accepted work.", kind: "ordinary", nameTemplate: "A small work", people: ["Niko"], evidence: "fictional" }] },
  };
}
const close = (actual: number, expected: number, message = `${actual} differs from ${expected}`) => assert.ok(Math.abs(actual - expected) < 1e-10, message);

test("remembered interests choose one strongest bonus and leave penalties, inactive flags and old effects exact", () => {
  close(skillEffectDelta(gain(), { "early-craft": true, "patient-practice": true }), 7.2);
  close(skillEffectDelta(gain(), { "early-craft": false, "patient-practice": true }), 6.6);
  assert.equal(skillEffectDelta(gain(), {}), 6);
  assert.equal(skillEffectDelta(gain(-3), { "early-craft": true }), -3);
  assert.equal(skillEffectDelta(gain(0), { "early-craft": true }), 0);
  assert.equal(skillEffectDelta({ type: "skill", skill: "craft", delta: .123456789 }, { "early-craft": true }), .123456789);
  const excessive = gain(); excessive.gainModifiers![0].multiplier = 4;
  close(skillEffectDelta(excessive, { "early-craft": true }), 7.2, "Runtime keeps the soft cap even before pack validation.");
});

test("actual paid practice and all skill previews share the bonus, taper boundary, cash cost and replay", () => {
  const engine = createEngine(fixture()), before = engine.start("shared-training-preview");
  const snapshot = structuredClone(before), activity = engine.getActivities(before)[0];
  const preview = getSkillImpact(activity, before, engine.world)[0];
  const treePreview = trainingSkillChanges(activity, engine.world, before)[0];
  assert.deepEqual(before, snapshot);
  const after = engine.act(before, activity.id);
  close(after.character!.skills.craft, 43.1);
  close(preview.min, after.character!.skills.craft - before.character!.skills.craft);
  close(preview.max, preview.min); close(treePreview.min, preview.min);
  assert.equal(after.economy!.cash, before.economy!.cash - 5);
  assert.equal(after.character!.lastActivityAge, before.age);
  assert.throws(() => engine.act(after, activity.id), /activity.*year|already/i);
  assert.deepEqual(engine.replay(after.seed, after.commands), after);
  assert.deepEqual(engine.load(engine.save(after)), after);
});

test("previews project flag changes in outcome order without mutating the life", () => {
  const world = fixture();
  world.character!.activities[0].outcomes[0].effects = [{ type: "cash", delta: -5 },
    { type: "flag", flag: "early-craft", value: false }, { type: "flag", flag: "patient-practice", value: false }, gain(),
    { type: "flag", flag: "early-craft", value: true }, gain()];
  const engine = createEngine(world), before = engine.start("ordered-flags"), snapshot = structuredClone(before);
  const activity = engine.getActivities(before)[0], preview = getSkillImpact(activity, before, engine.world)[0];
  const after = engine.act(before, activity.id);
  close(after.character!.skills.craft, 46.1);
  close(preview.min, 7.1); close(preview.max, 7.1);
  assert.deepEqual(before, snapshot);
});

test("boosted practice still clamps at the existing cap and never applies effects after an ending", () => {
  const capped = fixture(); capped.character!.skills.craft.initial = 99.9;
  const capEngine = createEngine(capped), before = capEngine.start("bounded-bonus"), activity = capEngine.getActivities(before)[0];
  const after = capEngine.act(before, activity.id);
  assert.equal(after.character!.skills.craft, 100);
  close(getSkillImpact(activity, before, capEngine.world)[0].max, .1);
  const ending = fixture();
  ending.character!.activities[0].outcomes[0].effects = [{ type: "cash", delta: -5 }, gain(), { type: "end", ending: "end" }, gain(50)];
  const endEngine = createEngine(ending), life = endEngine.start("ending-bonus"), endActivity = endEngine.getActivities(life)[0];
  const ended = endEngine.act(life, endActivity.id);
  assert.equal(ended.phase, "ended"); close(ended.character!.skills.craft, 43.1);
  close(getSkillImpact(endActivity, life, endEngine.world)[0].max, 4.1);
});

test("only genuinely paid training outcomes may carry modifiers, including legacy resource payment", () => {
  const valid = fixture(); validateWorld(valid);
  const resource = fixture(); resource.character!.activities[0].outcomes[0].effects[0] = { type: "stat", stat: "wealth", delta: -.5 };
  validateWorld(resource);
  const unpaid = fixture(); unpaid.character!.activities[0].when = { type: "cash", op: "gte", value: 5 };
  unpaid.character!.activities[0].outcomes[0].effects.shift();
  assert.throws(() => validateWorld(unpaid), /actual cash or Wealth payment/);
  const afterEnd = fixture(); afterEnd.character!.activities[0].outcomes[0].effects = [{ type: "end", ending: "end" }, { type: "cash", delta: -5 }, gain()];
  assert.throws(() => validateWorld(afterEnd), /actual cash or Wealth payment/);
  const career = fixture(); career.character!.activities[0].category = "career";
  assert.throws(() => validateWorld(career), /only in paid training/);
  const birth = fixture(); birth.origins[0].effects.push(gain());
  assert.throws(() => validateWorld(birth), /only in paid training/);
  const yearly = fixture(); yearly.yearlyEffects.push(gain());
  assert.throws(() => validateWorld(yearly), /only in paid training/);
  const event = fixture(); event.events.push({ id: "offer", title: "An offer", text: "Choose.", trigger: { type: "age", at: 1 }, choices: [{ id: "take", text: "Take", outcomes: [{ id: "taken", text: "Taken.", weight: 1, effects: [{ type: "cash", delta: -5 }, gain()] }] }] });
  assert.throws(() => validateWorld(event), /only in paid training/);
});

test("validation rejects undeclared flags, duplicate factors, oversized bonuses and modified losses", () => {
  for (const multiplier of [.9, 1.20001, Infinity]) {
    const world = fixture(); (world.character!.activities[0].outcomes[0].effects[1] as Extract<Effect, { type: "skill" }>).gainModifiers![0].multiplier = multiplier;
    assert.throws(() => validateWorld(world), /multiplier/);
  }
  const unknown = fixture(); unknown.legacy!.routes[0].earlyInterestFlag = "invented";
  assert.throws(() => validateWorld(unknown), /unknown flag/);
  const badModifier = fixture(); (badModifier.character!.activities[0].outcomes[0].effects[1] as Extract<Effect, { type: "skill" }>).gainModifiers![0].flag = "invented";
  assert.throws(() => validateWorld(badModifier), /unknown flag/);
  const duplicate = fixture(); (duplicate.character!.activities[0].outcomes[0].effects[1] as Extract<Effect, { type: "skill" }>).gainModifiers!.push({ ...modifiers[0] });
  assert.throws(() => validateWorld(duplicate), /duplicate training modifier flag/);
  const loss = fixture(); (loss.character!.activities[0].outcomes[0].effects[1] as Extract<Effect, { type: "skill" }>).delta = -1;
  assert.throws(() => validateWorld(loss), /positive skill delta/);
});

test("omitting the optional fields preserves the old arithmetic, state shape and exact saved replay", () => {
  const world = fixture(); delete world.legacy!.routes[0].earlyInterestFlag;
  delete (world.character!.activities[0].outcomes[0].effects[1] as Extract<Effect, { type: "skill" }>).gainModifiers;
  const engine = createEngine(world), before = engine.start("old-training"), after = engine.act(before, "train-craft");
  assert.equal(after.character!.skills.craft, applyStatDelta(world.character!.skills.craft, 39, 6));
  assert.equal(after.character!.skills.craft, 42.5);
  assert.deepEqual(Object.keys(after), Object.keys(before));
  assert.deepEqual(engine.load(engine.save(after)), after);
});
