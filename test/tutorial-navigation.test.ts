import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_TUTORIAL, resolveManualHint, tutorialKeyAction, tutorialPosition, tutorialReducer, type TutorialState } from "../client/models/tutorial-navigation.ts";
import { availableHints, type TutorialContext, type TutorialLifeFacts } from "../client/models/tutorial-triggers.ts";

function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  return { age: 0, ended: false, decisionPending: false, learnedSkills: 0, focusShown: false, resourcesShown: true, wealthShown: true, deckShown: true, notificationShown: false, tradeAge: 10, ...over };
}
const game = (over: Partial<TutorialLifeFacts> = {}): TutorialContext => ({ view: "game", characterSection: null, life: facts(over) });
const home: TutorialContext = { view: "home", characterSection: null, life: facts() };
const character: TutorialContext = { view: "character", characterSection: "skills", life: facts({ age: 8 }) };
const sources: TutorialContext = { view: "elsewhere", characterSection: null, life: facts({ age: 8 }) };

function run(state: TutorialState, context: TutorialContext, ...actions: Parameters<typeof tutorialReducer>[1][]): TutorialState {
  return actions.reduce((current, action) => tutorialReducer(current, action, context), state);
}

test("a first visit shows only the welcome hint, automatically", () => {
  const state = run(INITIAL_TUTORIAL, home, { type: "sync" });
  assert.equal(state.open, true);
  assert.equal(state.mode, "auto");
  assert.equal(state.hintId, "welcome");
  assert.deepEqual(state.queue, ["welcome"]);
});

test("one card at a time: hints for the same moment queue behind it", () => {
  const state = run(INITIAL_TUTORIAL, game({ age: 12, decisionPending: true, notificationShown: true }), { type: "sync" });
  assert.equal(state.hintId, "time-bar");
  assert.ok(state.queue.length > 1);
  assert.deepEqual(tutorialPosition(state), { index: 0, total: state.queue.length });
});

test("Next tip marks the tip seen and moves on; Back returns", () => {
  const context = game({ age: 12, decisionPending: true });
  const opened = run(INITIAL_TUTORIAL, context, { type: "sync" });
  const second = run(opened, context, { type: "next" });
  assert.equal(second.hintId, opened.queue[1]);
  assert.ok(second.seen.includes("time-bar"));
  assert.equal(run(second, context, { type: "back" }).hintId, "time-bar");
  assert.equal(run(opened, context, { type: "back" }), opened, "Back on the first tip changes nothing");
});

test("closing keeps progress and the current step; it never resets to the start", () => {
  const context = game({ age: 0 });
  const closed = run(INITIAL_TUTORIAL, context, { type: "sync" }, { type: "close" });
  assert.equal(closed.open, false);
  assert.equal(closed.hintId, "time-bar", "the current step is kept");
  assert.deepEqual(closed.seen, ["time-bar"]);
});

test("Next on the last tip closes like Got it", () => {
  const closed = run(INITIAL_TUTORIAL, game({ age: 0 }), { type: "sync" }, { type: "next" });
  assert.equal(closed.open, false);
  assert.ok(closed.seen.includes("time-bar"));
});

test("after a close the next tip waits for the next stage of life", () => {
  const closed = run(INITIAL_TUTORIAL, game({ age: 1 }), { type: "sync" }, { type: "close" });
  assert.equal(closed.hintId, "time-bar");
  assert.equal(run(closed, game({ age: 1 }), { type: "sync" }).open, false, "same year: stays closed");
  const nextYear = run(closed, game({ age: 2 }), { type: "sync" });
  assert.equal(nextYear.open, true);
  assert.equal(nextYear.hintId, "scene");
});

test("switching the Character popup to Skills is a new moment for the skill tree hint", () => {
  const career: TutorialContext = { view: "character", characterSection: "career", life: facts({ age: 8 }) };
  const closed = run(INITIAL_TUTORIAL, career, { type: "sync" }, { type: "close" });
  assert.equal(closed.hintId, "character");
  assert.equal(run(closed, career, { type: "sync" }).open, false);
  const skills = run(closed, character, { type: "sync" });
  assert.equal(skills.open, true);
  assert.equal(skills.hintId, "skills");
});

test("seen hints never repeat", () => {
  const seen = availableHints(game({ age: 12 }));
  const state: TutorialState = { ...INITIAL_TUTORIAL, seen };
  assert.equal(run(state, game({ age: 13, decisionPending: true }), { type: "sync" }).open, false);
});

test("the Tutorial button reopens at the current step while it is on screen", () => {
  const closed = run(INITIAL_TUTORIAL, game({ age: 0 }), { type: "sync" }, { type: "close" });
  const reopened = run(closed, game({ age: 3 }), { type: "open" });
  assert.equal(reopened.open, true);
  assert.equal(reopened.mode, "manual");
  assert.equal(reopened.hintId, "time-bar");
  assert.deepEqual(reopened.queue, availableHints(game({ age: 3 })), "Back and Next page through this screen's tips");
  assert.deepEqual(reopened.seen, closed.seen, "opening resets nothing");
});

test("the Tutorial button opens the hint for the section on screen when the current step is elsewhere", () => {
  const closed: TutorialState = { ...INITIAL_TUTORIAL, hintId: "time-bar", seen: ["time-bar"] };
  assert.equal(run(closed, character, { type: "open" }).hintId, "character");
  assert.equal(run(closed, { view: "nft-market", characterSection: null, life: null }, { type: "open" }).hintId, "nft-market");
  assert.equal(resolveManualHint(game({ age: 12, notificationShown: true }), "welcome", ["time-bar"]), "notifications", "a fresh event tip is the most relevant");
});

test("screens without tips open a short explanation instead of navigating", () => {
  const opened = run(INITIAL_TUTORIAL, sources, { type: "open" });
  assert.equal(opened.hintId, "about");
  assert.deepEqual(opened.queue, ["about"]);
});

test("a ? button opens its own hint, even one already seen", () => {
  const seen: TutorialState = { ...INITIAL_TUTORIAL, seen: ["market"], hintId: "time-bar" };
  const opened = run(seen, game({ age: 11 }), { type: "open", hintId: "market" });
  assert.equal(opened.hintId, "market");
  assert.equal(opened.mode, "manual");
  assert.ok(opened.queue.includes("market"));
});

test("an automatic hint whose section leaves the screen closes quietly and stays unseen", () => {
  const shown = run(INITIAL_TUTORIAL, game({ age: 0 }), { type: "sync" });
  const moved = run(shown, sources, { type: "sync" });
  assert.equal(moved.open, false);
  assert.deepEqual(moved.seen, []);
  const back = run(moved, game({ age: 0 }), { type: "sync" });
  assert.equal(back.hintId, "time-bar", "it returns with its section");
});

test("an automatic hint makes way for the new screen's own first-visit hint", () => {
  const shown = run(INITIAL_TUTORIAL, game({ age: 0 }), { type: "sync" });
  const moved = run(shown, character, { type: "sync" });
  assert.equal(moved.open, true);
  assert.equal(moved.hintId, "character");
});

test("an opened tutorial follows the player to the next screen, and closes where there is nothing to explain", () => {
  const opened = run(INITIAL_TUTORIAL, game({ age: 8 }), { type: "open", hintId: "rail" });
  const followed = run(opened, character, { type: "sync" });
  assert.equal(followed.open, true);
  assert.equal(followed.hintId, "character");
  const gone = run(opened, sources, { type: "sync" });
  assert.equal(gone.open, false);
  assert.equal(gone.hintId, "rail", "the step is kept for the next open");
});

test("transitions never mutate the previous state", () => {
  const frozen = Object.freeze(run(INITIAL_TUTORIAL, game({ age: 12, decisionPending: true }), { type: "sync" }));
  const next = tutorialReducer(frozen, { type: "next" }, game({ age: 12 }));
  assert.notEqual(next, frozen);
  assert.equal(frozen.hintId, "time-bar");
  assert.deepEqual(frozen.seen, []);
  assert.equal(tutorialReducer(INITIAL_TUTORIAL, { type: "close" }, home), INITIAL_TUTORIAL, "closing a closed tutorial changes nothing");
});

test("keyboard: Escape closes, arrows page only through queued tips, Enter on a button is left alone", () => {
  assert.equal(tutorialKeyAction("Escape", false, false), "close");
  assert.equal(tutorialKeyAction("ArrowRight", false, true), "next");
  assert.equal(tutorialKeyAction("ArrowLeft", false, true), "back");
  assert.equal(tutorialKeyAction("ArrowRight", false, false), null);
  assert.equal(tutorialKeyAction("Enter", true, true), null);
  assert.equal(tutorialKeyAction("Enter", false, true), "next");
  assert.equal(tutorialKeyAction("a", false, true), null);
});

test("with tips off a new section glows instead of opening a card, once", () => {
  const off = run(INITIAL_TUTORIAL, home, { type: "tips", on: false });
  assert.equal(off.tipsOn, false);
  const flashed = run(off, game({ age: 4 }), { type: "sync" });
  assert.equal(flashed.open, false, "no card opens by itself");
  assert.ok(flashed.flash && flashed.flash.ids.includes("time-bar"));
  assert.ok(!flashed.flash!.ids.includes("planting"), "a small child is not pointed at the fields");
  assert.ok(flashed.flash!.ids.every(id => flashed.seen.includes(id)), "a glowing section counts as seen");
  assert.equal(run(flashed, game({ age: 4, notificationShown: false }), { type: "sync" }), flashed, "the same sections do not glow twice");
  const later = run(flashed, game({ age: 5 }), { type: "sync" });
  assert.deepEqual(later.flash?.ids, ["life-record"]);
  assert.equal(later.flash!.run, flashed.flash!.run + 1);
  const grown = run(later, game({ age: 16 }), { type: "sync" });
  assert.ok(grown.flash?.ids.includes("planting"), "the fields glow once they are the player's to plan");
});

test("the Tutorial and ? buttons still open cards with tips off; turning tips back on resumes cards", () => {
  const context = game({ age: 12 });
  const off = run(INITIAL_TUTORIAL, context, { type: "tips", on: false });
  const manual = run(off, context, { type: "open", hintId: "focus" });
  assert.equal(manual.open, true);
  assert.equal(manual.hintId, "focus");
  const on = run(INITIAL_TUTORIAL, home, { type: "tips", on: false }, { type: "tips", on: true }, { type: "sync" });
  assert.equal(on.open, true);
  assert.equal(on.hintId, "welcome");
  assert.equal(run(on, home, { type: "tips", on: true }), on, "setting the same value changes nothing");
});

test("turning tips off keeps the open card until the player closes it", () => {
  const opened = run(INITIAL_TUTORIAL, home, { type: "sync" });
  const off = run(opened, home, { type: "tips", on: false });
  assert.equal(off.open, true);
  assert.equal(off.hintId, "welcome");
});

test("Next tip on an automatic card shows the next tip even when its section is not drawn right now", () => {
  const context = game({ age: 12, decisionPending: true, notificationShown: true });
  const opened = run(INITIAL_TUTORIAL, context, { type: "sync" });
  assert.equal(opened.mode, "auto");
  assert.ok(opened.queue.length > 1);
  const next = run(opened, context, { type: "next" });
  assert.equal(next.open, true);
  assert.equal(next.hintId, opened.queue[1]);
  assert.equal(next.mode, "manual", "a paged tip never waits invisibly for its section");
  assert.equal(run(next, context, { type: "back" }).mode, "manual");
});
