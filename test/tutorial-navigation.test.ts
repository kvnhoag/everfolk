import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_TUTORIAL, resolveManualHint, tutorialKeyAction, tutorialPosition, tutorialReducer, type TutorialState } from "../client/models/tutorial-navigation.ts";
import { availableHints, type TutorialContext, type TutorialLifeFacts } from "../client/models/tutorial-triggers.ts";
import { visibleSections } from "../client/models/onboarding-sections.ts";

const AGES = { focus: 6, action: 6, trade: 12, firstJob: 12, fields: 16 };
function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  const base = { lifeKey: "life", age: 0, ended: false, decisionPending: false, learnedSkills: 0, notificationShown: false, passed: [], ...over };
  const sections = over.sections ?? [...visibleSections({ age: base.age, economy: true, learnedSkills: base.learnedSkills, hadDecision: base.decisionPending }, AGES)];
  return { ...base, sections };
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

test("one tip at a time: an automatic tip stands alone, the others wait their turn", () => {
  const state = run(INITIAL_TUTORIAL, game({ age: 12, decisionPending: true, notificationShown: true }), { type: "sync" });
  assert.equal(state.hintId, "time-bar");
  assert.deepEqual(state.queue, ["time-bar"], "no paging through a pile of tips");
  assert.deepEqual(tutorialPosition(state), { index: 0, total: 1 });
});

test("at most one automatic tip per in-game year: the others wait, in teaching order, for later years", () => {
  const six = game({ age: 6 });
  let state = run(INITIAL_TUTORIAL, six, { type: "sync" });
  assert.equal(state.hintId, "time-bar");
  state = run(state, six, { type: "close" });
  assert.equal(state.open, false, "closing a tip never opens another the same year");
  assert.equal(run(state, six, { type: "sync" }).open, false);
  const order = ["time-bar"];
  for (const age of [7, 8, 9, 10]) {
    state = run(state, game({ age }), { type: "sync" });
    if (state.open) { order.push(state.hintId!); state = run(state, game({ age }), { type: "close" }); }
  }
  assert.deepEqual(order, ["time-bar", "scene", "focus", "yearly-action"]);
  assert.equal(run(state, game({ age: 11 }), { type: "sync" }).open, false, "nothing comes back once seen");
});

test("a new life, the home screen and the ending are not held back by the year's tip", () => {
  const shown = run(INITIAL_TUTORIAL, game({ age: 6 }), { type: "sync" }, { type: "close" });
  assert.equal(run(shown, game({ age: 6, lifeKey: "next" }), { type: "sync" }).hintId, "scene", "another life starts its own years");
  assert.equal(run(shown, home, { type: "sync" }).hintId, "welcome");
  const seen: TutorialState = { ...shown, seen: availableHints(game({ age: 6 })) };
  assert.equal(run(seen, game({ age: 6, ended: true }), { type: "sync" }).hintId, "ending");
});

test("Next tip on an automatic tip closes it like Got it; Back does nothing", () => {
  const context = game({ age: 6 });
  const opened = run(INITIAL_TUTORIAL, context, { type: "sync" });
  const second = run(opened, context, { type: "next" });
  assert.equal(second.open, false, "the next tip waits for a later year");
  assert.ok(second.seen.includes("time-bar"));
  const nextYear = run(second, game({ age: 7 }), { type: "sync" });
  assert.equal(nextYear.hintId, "scene");
  assert.equal(nextYear.mode, "auto");
  assert.equal(run(opened, context, { type: "back" }), opened);
});

test("using a section closes its tip and teaches it for good", () => {
  const six = run({ ...INITIAL_TUTORIAL, seen: ["time-bar", "scene"] }, game({ age: 6 }), { type: "sync" });
  assert.equal(six.hintId, "focus");
  const used = run(six, game({ age: 6 }), { type: "used", hintIds: ["focus"] });
  assert.ok(used.seen.includes("focus"));
  assert.equal(used.open, false, "the next step waits for next year");
  assert.equal(run(used, game({ age: 7 }), { type: "sync" }).hintId, "yearly-action", "the guide moves on to the next step");
  const early = run(INITIAL_TUTORIAL, game({ age: 0 }), { type: "used", hintIds: ["market"] });
  assert.ok(early.seen.includes("market"), "a section used before its tip showed is never taught");
  assert.equal(run(early, game({ age: 12 }), { type: "sync" }, { type: "close" }, { type: "close" }).hintId !== "market", true);
  assert.equal(run(used, game({ age: 6 }), { type: "used", hintIds: ["focus"] }), used, "using it again changes nothing");
});

test("a manual tip stays open when its section is used", () => {
  const manual = run(INITIAL_TUTORIAL, game({ age: 6 }), { type: "open", hintId: "focus" });
  const used = run(manual, game({ age: 6 }), { type: "used", hintIds: ["focus"] });
  assert.equal(used.open, true);
  assert.ok(used.seen.includes("focus"));
});

test("entering a life mid-way treats the tips of passed stages as seen", () => {
  const thirteen = game({ age: 13, passed: ["time-bar", "scene", "focus", "yearly-action", "wealth", "resources", "market", "character"] });
  const entered = run(INITIAL_TUTORIAL, thirteen, { type: "enter", passed: thirteen.life!.passed }, { type: "sync" });
  assert.equal(entered.open, false, "no old tips replay for a loaded save");
  const open = run(INITIAL_TUTORIAL, game({ age: 6 }), { type: "sync" });
  const loaded = game({ age: 6, lifeKey: "loaded" });
  const stale = run(open, loaded, { type: "enter", passed: ["time-bar"] });
  assert.equal(stale.hintId, "scene", "a passed tip on screen makes way for the next one");
  assert.equal(run(stale, loaded, { type: "enter", passed: ["time-bar"] }), stale);
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

test("a tip whose stage has not come yet waits for its year", () => {
  const closed = run(INITIAL_TUTORIAL, game({ age: 0 }), { type: "sync" }, { type: "close" });
  assert.equal(closed.open, false, "at birth only the time bar has a tip");
  const nextYear = run(closed, game({ age: 1 }), { type: "sync" });
  assert.equal(nextYear.open, true);
  assert.equal(nextYear.hintId, "scene");
});

test("switching the Character popup to Skills is a new moment for the skill tree hint", () => {
  const career: TutorialContext = { view: "character", characterSection: "career", life: facts({ age: 8 }) };
  const closed = run(INITIAL_TUTORIAL, career, { type: "sync" });
  assert.equal(closed.open, false, "the Character popup itself is help-only");
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
  assert.equal(run(closed, character, { type: "open" }).hintId, "skills");
  assert.equal(run(closed, { view: "nft-market", characterSection: null, life: null }, { type: "open" }).hintId, "nft-market");
  assert.equal(resolveManualHint(game({ age: 12, decisionPending: true }), "welcome", ["time-bar", "scene"]), "decision", "a fresh event tip is the most relevant");
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
  assert.equal(moved.hintId, "skills");
});

test("an opened tutorial follows the player to the next screen, and closes where there is nothing to explain", () => {
  const opened = run(INITIAL_TUTORIAL, game({ age: 8 }), { type: "open", hintId: "rail" });
  const followed = run(opened, character, { type: "sync" });
  assert.equal(followed.open, true);
  assert.equal(followed.hintId, "skills");
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
  assert.equal(run(flashed, game({ age: 5 }), { type: "sync" }), flashed, "nothing new opens at 5");
  const later = run(flashed, game({ age: 6 }), { type: "sync" });
  assert.deepEqual(later.flash?.ids, ["focus", "yearly-action"]);
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

test("paging a manual tour shows the next tip even when its section is not drawn right now", () => {
  const context = game({ age: 12, decisionPending: true, notificationShown: true });
  const opened = run(INITIAL_TUTORIAL, context, { type: "open", hintId: "time-bar" });
  assert.ok(opened.queue.length > 1);
  const next = run(opened, context, { type: "next" });
  assert.equal(next.open, true);
  assert.equal(next.hintId, opened.queue[1]);
  assert.equal(next.mode, "manual", "a paged tip never waits invisibly for its section");
  assert.equal(run(next, context, { type: "back" }).mode, "manual");
});
