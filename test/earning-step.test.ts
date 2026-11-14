import assert from "node:assert/strict";
import test from "node:test";
import { cashShort, earningFacts, householdCosts, workOffered, yearOfCosts } from "../client/models/earning-step.ts";
import { INITIAL_TUTORIAL, tutorialReducer, type TutorialAction, type TutorialState } from "../client/models/tutorial-navigation.ts";
import { hintAvailable, hintTriggered, type TutorialContext, type TutorialLifeFacts } from "../client/models/tutorial-triggers.ts";
import { tutorialHint } from "../client/models/tutorial-hints.ts";
import { visibleSections } from "../client/models/onboarding-sections.ts";

const AGES = { focus: 6, action: 6, trade: 12, firstJob: 12, fields: 16 };
function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  const base = { lifeKey: "life", age: 0, ended: false, decisionPending: false, learnedSkills: 0, notificationShown: false, passed: [], ...over };
  const sections = over.sections ?? [...visibleSections({ age: base.age, economy: true, learnedSkills: base.learnedSkills, hadDecision: base.decisionPending }, AGES)];
  return { ...base, sections };
}
const game = (over: Partial<TutorialLifeFacts> = {}): TutorialContext => ({ view: "game", characterSection: null, life: facts(over) });
const run = (state: TutorialState, context: TutorialContext, ...actions: TutorialAction[]) => actions.reduce((current, action) => tutorialReducer(current, action, context), state);
const costs = { eating: 30, rent: 10, grainPrice: 2 };

test("a year of costs is the household's food and rent at the grain price", () => {
  assert.equal(yearOfCosts(costs), 80);
  assert.equal(yearOfCosts(null), 0, "no household economy, no costs");
  assert.equal(yearOfCosts({ eating: -5, rent: 0, grainPrice: 2 }), 0);
  assert.equal(cashShort(79, costs), true);
  assert.equal(cashShort(80, costs), false);
  assert.equal(cashShort(0, null), false, "a world without costs is never short");
  assert.equal(cashShort(undefined, costs), false);
});

test("work is offered when an available career action is in the deck", () => {
  assert.equal(workOffered([{ category: "training", available: true }, { category: "career", available: false }]), false);
  assert.equal(workOffered([{ category: "career", available: true }]), true);
  assert.deepEqual(earningFacts([{ category: "career", available: true }], 200, costs), { workOffered: true, cashShort: false });
});

test("the household's costs are read from its screen", () => {
  const screen = { household: { expectedEating: 30, expectedRent: 10 }, market: { quotes: [{ item: "flax", sell: 9 }, { item: "grain", sell: 2 }] } };
  assert.deepEqual(householdCosts(screen), costs);
  assert.equal(householdCosts(null), null);
  assert.equal(householdCosts({ ...screen, market: { quotes: [] } }), null);
});

test("the earning step points at the Work tab and says work and jobs pay", () => {
  const hint = tutorialHint("earning")!;
  assert.match(hint.body, /^Work actions pay cash\. A job pays every year\./);
  assert.match(hint.targets[0], /life-action-tabs/);
});

test("it opens when work first appears or cash runs short, whichever comes first, only with the deck drawn", () => {
  assert.equal(hintTriggered("earning", game({ age: 8 })), false);
  assert.equal(hintTriggered("earning", game({ age: 8, workOffered: true })), true);
  assert.equal(hintTriggered("earning", game({ age: 8, cashShort: true })), true);
  assert.equal(hintAvailable("earning", game({ age: 5, cashShort: true })), false, "no deck before the yearly action");
  assert.equal(hintTriggered("earning", game({ age: 8, workOffered: true, decisionPending: true })), false, "the deck is hidden during a decision");
  assert.equal(hintTriggered("earning", game({ age: 70, workOffered: true, ended: true })), false);
});

test("it respects one tip a year and shows only once", () => {
  const seen: TutorialState = { ...INITIAL_TUTORIAL, seen: ["time-bar", "scene"] };
  const six = run(seen, game({ age: 6, workOffered: true }), { type: "sync" });
  assert.equal(six.hintId, "focus", "the year's tip comes first");
  const sixClosed = run(six, game({ age: 6, workOffered: true }), { type: "close" });
  assert.equal(sixClosed.open, false, "earning waits for a later year");
  const later = run({ ...sixClosed, seen: [...sixClosed.seen, "yearly-action"] }, game({ age: 7, workOffered: true }), { type: "sync" });
  assert.equal(later.hintId, "earning");
  const done = run(later, game({ age: 7, workOffered: true }), { type: "close" });
  assert.ok(done.seen.includes("earning"));
  const again = run(done, game({ age: 9, cashShort: true }), { type: "sync" });
  assert.ok(!(again.open && again.hintId === "earning"), "never twice");
});
