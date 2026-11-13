import assert from "node:assert/strict";
import test from "node:test";
import {
  availableHints, chainTutorialView, gameTutorialContext, hintAvailable, hintTriggered, triggeredHints,
  type TutorialContext, type TutorialLifeFacts,
} from "../client/models/tutorial-triggers.ts";
import { TUTORIAL_HINTS } from "../client/models/tutorial-hints.ts";

function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  return { age: 0, ended: false, decisionPending: false, learnedSkills: 0, focusShown: false, resourcesShown: true, wealthShown: true, deckShown: true, notificationShown: false, tradeAge: 10, ...over };
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

test("layout hints arrive one stage at a time as the child grows", () => {
  assert.ok(!hintTriggered("scene", game({ age: 0 })));
  assert.ok(hintTriggered("scene", game({ age: 1 })));
  assert.ok(!hintTriggered("rail", game({ age: 1 })) && hintTriggered("rail", game({ age: 2 })));
  assert.ok(!hintTriggered("resources", game({ age: 2 })) && hintTriggered("resources", game({ age: 3 })));
  assert.ok(!hintTriggered("wealth", game({ age: 3 })) && hintTriggered("wealth", game({ age: 4 })));
  assert.ok(!hintTriggered("life-record", game({ age: 4 })) && hintTriggered("life-record", game({ age: 5 })));
  assert.ok(!hintTriggered("command-deck", game({ age: 7 })) && hintTriggered("command-deck", game({ age: 8 })));
});

test("the yearly action box fires at age 6, not before", () => {
  assert.equal(hintTriggered("yearly-action", game({ age: 5 })), false);
  assert.equal(hintTriggered("yearly-action", game({ age: 6 })), true);
  assert.equal(hintAvailable("yearly-action", game({ age: 30, ended: true })), false, "an ended life has no yearly action");
});

test("This year's focus fires when the focus box first appears", () => {
  assert.equal(hintTriggered("focus", game({ age: 3, focusShown: false })), false);
  assert.equal(hintTriggered("focus", game({ age: 3, focusShown: true })), true);
});

test("the market hint fires exactly when trading opens, using the world's trading age", () => {
  assert.equal(hintTriggered("market", game({ age: 9 })), false);
  assert.equal(hintTriggered("market", game({ age: 10 })), true);
  assert.equal(hintTriggered("market", game({ age: 10, tradeAge: 12 })), false);
  assert.equal(hintTriggered("market", game({ age: 12, tradeAge: 12 })), true);
  assert.equal(hintTriggered("market", game({ age: 20, deckShown: false })), false, "never without the command deck on screen");
  assert.equal(hintTriggered("market", game({ age: 20, tradeAge: null })), false, "worlds without a market never show it");
});

test("notifications, turning points, skills and the ending fire on their events", () => {
  assert.equal(hintTriggered("notifications", game({ age: 1 })), false);
  assert.equal(hintTriggered("notifications", game({ age: 1, notificationShown: true })), true);
  assert.equal(hintTriggered("decision", game({ age: 1 })), false);
  assert.equal(hintTriggered("decision", game({ age: 1, decisionPending: true })), true);
  assert.equal(hintAvailable("decision", game({ age: 1 })), true, "the Next decision button is always on the time bar");
  assert.equal(hintTriggered("skills", game({ age: 7 })), false);
  assert.equal(hintTriggered("skills", game({ age: 7, learnedSkills: 1 })), true);
  assert.equal(hintTriggered("ending", game({ age: 40 })), false);
  assert.equal(hintTriggered("ending", game({ age: 40, ended: true })), true);
});

test("the Character popup and the skill tree fire when they first open", () => {
  const character: TutorialContext = { view: "character", characterSection: "career", life: facts({ age: 8 }) };
  assert.deepEqual(triggeredHints(character, []), ["character"]);
  const skills: TutorialContext = { ...character, characterSection: "skills" };
  assert.deepEqual(triggeredHints(skills, []), ["character", "skills"], "two hints for the same moment queue up");
  assert.deepEqual(triggeredHints(skills, ["character"]), ["skills"]);
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

test("event hints come before layout hints; seen hints are skipped", () => {
  const busy = game({ age: 12, notificationShown: true, decisionPending: true, focusShown: true });
  const queue = triggeredHints(busy, []);
  assert.deepEqual(queue.slice(0, 3), ["time-bar", "decision", "notifications"]);
  assert.ok(!triggeredHints(busy, ["decision"]).includes("decision"));
  assert.equal(new Set(queue).size, queue.length);
});

test("available hints follow the screen from top to bottom", () => {
  const ids = TUTORIAL_HINTS.map(hint => hint.id);
  const available = availableHints(game({ age: 12, focusShown: true }));
  assert.deepEqual(available, [...available].sort((a, b) => ids.indexOf(a) - ids.indexOf(b)));
  assert.equal(available[0], "time-bar");
});

test("the game's own state maps to the screen the player sees", () => {
  const life = facts({ age: 4 });
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
