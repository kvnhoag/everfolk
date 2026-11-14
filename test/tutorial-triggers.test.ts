import assert from "node:assert/strict";
import test from "node:test";
import {
  availableHints, chainTutorialView, gameTutorialContext, hintAvailable, hintTriggered, triggeredHints, tutorialYearKey, yearAllowsTip,
  type TutorialContext, type TutorialLifeFacts,
} from "../client/models/tutorial-triggers.ts";
import { TUTORIAL_HINTS } from "../client/models/tutorial-hints.ts";
import { visibleSections } from "../client/models/onboarding-sections.ts";

const AGES = { focus: 6, action: 6, trade: 12, firstJob: 12, fields: 16 };
/** A life's facts with the sections the age map draws at that age (unless given). */
function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  const base = { lifeKey: "life", age: 0, ended: false, decisionPending: false, learnedSkills: 0, notificationShown: false, passed: [], ...over };
  const sections = over.sections ?? [...visibleSections({ age: base.age, economy: true, learnedSkills: base.learnedSkills, hadDecision: base.decisionPending }, AGES)];
  return { ...base, sections };
}
function game(over: Partial<TutorialLifeFacts> = {}): TutorialContext {
  return { view: "game", characterSection: null, life: facts(over) };
}

test("the home screen welcomes a first visit; nothing else fires there", () => {
  const home: TutorialContext = { view: "home", characterSection: null, life: facts() };
  assert.deepEqual(triggeredHints(home, []), ["welcome"]);
  assert.deepEqual(triggeredHints(home, ["welcome"]), [], "a seen welcome never repeats");
  assert.ok(availableHints(home).includes("home-begin"), "the home tips can still be paged by hand");
});

test("the new-life roll fires when the stat roll opens", () => {
  assert.deepEqual(triggeredHints({ view: "new-life", characterSection: null, life: facts() }, []), ["roll"]);
});

test("when a life first begins only the time bar fires", () => {
  assert.deepEqual(triggeredHints(game({ age: 0 }), []), ["time-bar"]);
});

test("section tips arrive when their section first appears, one stage at a time", () => {
  assert.ok(!hintTriggered("scene", game({ age: 0 })));
  assert.ok(hintTriggered("scene", game({ age: 1 })));
  assert.ok(!hintTriggered("planting", game({ age: 15 })) && hintTriggered("planting", game({ age: 16 })));
  assert.ok(!hintAvailable("wealth", game({ age: 5 })) && hintAvailable("wealth", game({ age: 6 })), "health and wealth appear with the yearly action");
  assert.ok(!hintAvailable("resources", game({ age: 11 })) && hintAvailable("resources", game({ age: 12 })), "the household bar appears with trading");
  // Health and wealth, the household's goods, the Character popup and notifications only open from their "?".
  for (const id of ["rail", "life-record", "command-deck", "wealth", "resources", "character", "notifications"] as const) {
    assert.ok(hintAvailable(id, game({ age: 30 })), `${id} still opens from its ?`);
    assert.ok(!hintTriggered(id, game({ age: 30 })), `${id} is introduced by another tip, so it never opens by itself`);
  }
});

test("a tip never opens for a section the age map has not drawn yet", () => {
  for (const age of [0, 3, 5, 6, 11, 12, 15, 16, 40]) {
    const context = game({ age });
    const drawn = context.life!.sections;
    if (!drawn.includes("focus")) assert.ok(!hintAvailable("focus", context), `focus at ${age}`);
    if (!drawn.includes("resources")) assert.ok(!hintAvailable("resources", context), `resources at ${age}`);
    if (!drawn.includes("deck-market")) assert.ok(!hintAvailable("market", context), `market at ${age}`);
    if (!drawn.includes("planting")) assert.ok(!hintAvailable("planting", context), `planting at ${age}`);
  }
});

test("the yearly action box fires at age 6, not before", () => {
  assert.equal(hintTriggered("yearly-action", game({ age: 5 })), false);
  assert.equal(hintTriggered("yearly-action", game({ age: 6 })), true);
  assert.equal(hintAvailable("yearly-action", game({ age: 30, ended: true })), false, "an ended life has no yearly action");
});

test("This year's focus fires when the focus box first appears", () => {
  assert.equal(hintTriggered("focus", game({ age: 3, sections: ["time-bar"] })), false);
  assert.equal(hintTriggered("focus", game({ age: 3, sections: ["time-bar", "focus"] })), true);
});

test("the market hint fires exactly when the market tab is drawn", () => {
  assert.equal(hintTriggered("market", game({ age: 11 })), false);
  assert.equal(hintTriggered("market", game({ age: 12 })), true);
  assert.equal(hintTriggered("market", game({ age: 20, sections: ["time-bar", "command-deck"] })), false, "never without the market tab on screen");
});

test("notifications, turning points, skills and the ending fire on their events", () => {
  assert.equal(hintTriggered("notifications", game({ age: 1, notificationShown: true })), false, "notifications are help-only");
  assert.equal(hintTriggered("decision", game({ age: 1 })), false);
  assert.equal(hintTriggered("decision", game({ age: 1, decisionPending: true })), true);
  assert.equal(hintAvailable("decision", game({ age: 1 })), true, "the Next decision button is always on the time bar");
  assert.equal(hintTriggered("skills", game({ age: 7 })), false);
  assert.equal(hintTriggered("skills", game({ age: 7, learnedSkills: 1 })), true);
  assert.equal(hintTriggered("ending", game({ age: 40 })), false);
  assert.equal(hintTriggered("ending", game({ age: 40, ended: true })), true);
});

test("the skill tree fires when the Character popup first opens on Skills; the popup itself is help-only", () => {
  const character: TutorialContext = { view: "character", characterSection: "career", life: facts({ age: 12 }) };
  assert.deepEqual(triggeredHints(character, []), []);
  assert.ok(hintAvailable("character", character), "its ? still explains it");
  const skills: TutorialContext = { ...character, characterSection: "skills" };
  assert.deepEqual(triggeredHints(skills, []), ["skills"]);
});

test("each Weave screen fires the first time it is visited", () => {
  for (const [kind, id] of [["ranked", "weave"], ["market", "nft-market"], ["figures", "figures"], ["mine", "mine"]] as const) {
    const view = chainTutorialView(kind);
    assert.ok(view);
    assert.deepEqual(triggeredHints({ view, characterSection: null, life: facts() }, []), [id]);
  }
  assert.equal(chainTutorialView("token"), "elsewhere");
  assert.equal(chainTutorialView(null), null);
});

test("a hint never fires for a section that is not on screen", () => {
  const contexts: TutorialContext[] = [
    { view: "home", characterSection: null, life: facts() }, { view: "elsewhere", characterSection: null, life: facts({ age: 30 }) },
    { view: "decision", characterSection: null, life: facts({ age: 9, decisionPending: true }) }, { view: "character", characterSection: "wealth", life: facts({ age: 12 }) },
    game({ age: 0 }), game({ age: 12, notificationShown: true, learnedSkills: 3, focusShown: true, decisionPending: true }), game({ age: 70, ended: true }),
    { view: "game", characterSection: null, life: null },
  ];
  for (const context of contexts) {
    const available = availableHints(context);
    for (const id of triggeredHints(context, [])) assert.ok(available.includes(id), `${id} is on screen in ${context.view}`);
  }
  assert.deepEqual(triggeredHints({ view: "elsewhere", characterSection: null, life: facts({ age: 30 }) }, []), []);
  assert.deepEqual(availableHints({ view: "game", characterSection: null, life: null }), [], "no life, no game hints");
});

test("event hints come before section tips, and section tips follow the teaching order; seen hints are skipped", () => {
  const busy = game({ age: 12, notificationShown: true, decisionPending: true });
  const queue = triggeredHints(busy, []);
  assert.deepEqual(queue.slice(0, 3), ["time-bar", "decision", "scene"]);
  const sections = triggeredHints(game({ age: 16, learnedSkills: 1 }), ["time-bar", "scene"]);
  assert.deepEqual(sections, ["focus", "yearly-action", "market", "skills", "planting"]);
  assert.ok(!triggeredHints(busy, ["decision"]).includes("decision"));
  assert.equal(new Set(queue).size, queue.length);
});

test("available hints follow the screen from top to bottom", () => {
  const ids = TUTORIAL_HINTS.map(hint => hint.id);
  const available = availableHints(game({ age: 12 }));
  assert.deepEqual(available, [...available].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)));
  assert.equal(available[0], "time-bar");
});

test("the game's own state maps to the screen the player sees", () => {
  const life = facts({ age: 12 });
  const base = { menuOpen: false, birthPopoverOpen: false, hasBegun: true, panel: null, characterSection: "career", decisionOpen: false, blockingDialog: false, life };
  assert.equal(gameTutorialContext(base).view, "game");
  assert.equal(gameTutorialContext({ ...base, menuOpen: true }).view, "home");
  assert.equal(gameTutorialContext({ ...base, menuOpen: true, birthPopoverOpen: true, hasBegun: false }).view, "new-life");
  assert.equal(gameTutorialContext({ ...base, panel: "character" }).view, "character");
  assert.equal(gameTutorialContext({ ...base, panel: "character" }).characterSection, "career");
  assert.equal(gameTutorialContext(base).characterSection, null, "the section only matters inside the popup");
  assert.equal(gameTutorialContext({ ...base, panel: "sources" }).view, "elsewhere");
  assert.equal(gameTutorialContext({ ...base, decisionOpen: true }).view, "decision");
  assert.equal(gameTutorialContext({ ...base, blockingDialog: true }).view, "elsewhere");
  assert.equal(gameTutorialContext({ ...base, hasBegun: false }).view, "elsewhere");
  assert.equal(gameTutorialContext(base).life, life);
});

test("the yearly-action tip waits while a decision is pending, because its cards are not drawn then", () => {
  assert.equal(hintAvailable("yearly-action", game({ age: 7 })), true);
  assert.equal(hintAvailable("yearly-action", game({ age: 7, decisionPending: true })), false);
});

test("one automatic tip per in-game year: the year key counts only a life in play, and the ending is never held back", () => {
  const year6 = game({ age: 6, lifeKey: "a" });
  assert.equal(tutorialYearKey(year6), "a:6");
  assert.equal(tutorialYearKey({ view: "home", characterSection: null, life: facts() }), null, "the home screen is not a year");
  assert.equal(tutorialYearKey({ view: "character", characterSection: null, life: facts({ age: 6, lifeKey: "a" }) }), "a:6");
  assert.equal(yearAllowsTip("yearly-action", year6, null), true);
  const focusAt6 = { key: "a:6", hintId: "focus" as const };
  assert.equal(yearAllowsTip("yearly-action", year6, focusAt6), false, "a second tip in the same year waits");
  assert.equal(yearAllowsTip("focus", year6, focusAt6), true, "the year's own tip may come back after being pushed aside");
  assert.equal(yearAllowsTip("yearly-action", game({ age: 7, lifeKey: "a" }), focusAt6), true, "and opens the next year");
  assert.equal(yearAllowsTip("yearly-action", game({ age: 6, lifeKey: "b" }), focusAt6), true, "a new life starts fresh");
  assert.equal(yearAllowsTip("ending", game({ age: 6, lifeKey: "a", ended: true }), focusAt6), true);
  assert.equal(yearAllowsTip("welcome", { view: "home", characterSection: null, life: facts() }, { key: "life:0", hintId: "time-bar" }), true);
});
