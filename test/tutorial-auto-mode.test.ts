import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_TUTORIAL, tutorialReducer, type TutorialAction, type TutorialState } from "../client/models/tutorial-navigation.ts";
import { guidedStepLocked } from "../client/models/guided-step.ts";
import { createTutorialStore } from "../client/state/tutorial-store.ts";
import type { TutorialContext, TutorialLifeFacts } from "../client/models/tutorial-triggers.ts";
import { visibleSections } from "../client/models/onboarding-sections.ts";

const AGES = { focus: 6, action: 6, trade: 12, firstJob: 12, fields: 16 };
function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  const base = { lifeKey: "life", age: 0, ended: false, decisionPending: false, learnedSkills: 0, notificationShown: false, passed: [], ...over };
  const sections = over.sections ?? [...visibleSections({ age: base.age, economy: true, learnedSkills: base.learnedSkills, hadDecision: base.decisionPending }, AGES)];
  return { ...base, sections };
}
const game = (over: Partial<TutorialLifeFacts> = {}): TutorialContext => ({ view: "game", characterSection: null, life: facts(over) });
const run = (state: TutorialState, context: TutorialContext, ...actions: TutorialAction[]) => actions.reduce((current, action) => tutorialReducer(current, action, context), state);

test("turning Auto mode on closes the tip on screen as seen, so its veil lifts", () => {
  const shown = run(INITIAL_TUTORIAL, game({ age: 6 }), { type: "sync" });
  assert.equal(shown.open, true);
  assert.equal(guidedStepLocked({ tipsOn: shown.tipsOn, tipShown: true, mode: shown.mode, hosted: false }), true);
  const auto = run(shown, game({ age: 6 }), { type: "auto-play", on: true });
  assert.equal(auto.open, false, "no card, no veil");
  assert.ok(auto.seen.includes("time-bar"));
  assert.equal(auto.autoPlay, true);
});

test("in Auto mode pending tips are marked seen and never open, not even a turning point's", () => {
  const auto = run(INITIAL_TUTORIAL, game({ age: 6 }), { type: "auto-play", on: true });
  assert.equal(auto.open, false);
  assert.ok(["time-bar", "scene", "focus", "yearly-action"].every(id => auto.seen.includes(id as never)));
  const decision = run(auto, game({ age: 7, decisionPending: true }), { type: "sync" });
  assert.equal(decision.open, false, "Auto choosing… never waits for the decision tip");
  assert.ok(decision.seen.includes("decision"));
});

test("a tip the player opens still shows in Auto mode, and turning Auto mode off brings tips back", () => {
  const auto = run(INITIAL_TUTORIAL, game({ age: 6 }), { type: "auto-play", on: true });
  const asked = run(auto, game({ age: 6 }), { type: "open", hintId: "focus" });
  assert.equal(asked.open, true);
  assert.equal(asked.mode, "manual");
  assert.equal(run(asked, game({ age: 6 }), { type: "auto-play", on: true }), asked, "no change when already on");
  const off = run(auto, game({ age: 6 }), { type: "auto-play", on: false });
  assert.equal(off.autoPlay, false);
  assert.equal(run(off, game({ age: 13 }), { type: "sync" }).hintId, "market", "the next new section has its tip again");
});

test("Auto mode does not touch first-visit tips outside a life in play", () => {
  const home: TutorialContext = { view: "home", characterSection: null, life: facts() };
  const auto = run(INITIAL_TUTORIAL, home, { type: "auto-play", on: true });
  assert.equal(auto.hintId, "welcome");
  assert.equal(auto.open, true);
});

test("the store's Auto mode switch lifts an open guided step", () => {
  const store = createTutorialStore({ storage: () => undefined });
  store.setGameContext(game({ age: 0 }));
  assert.equal(store.getSnapshot().open, true);
  store.setAutoPlay(true);
  assert.equal(store.getSnapshot().open, false);
  assert.ok(store.getSnapshot().seen.includes("time-bar"));
});
