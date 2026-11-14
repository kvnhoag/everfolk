import assert from "node:assert/strict";
import test from "node:test";
import { FIRST_STEP, firstStepDone, guidedStartPaused, guidedStepLocked, nextDecisionAction, shieldClipPath } from "../client/models/guided-step.ts";
import { blockedByTipLock, setTipLock } from "../client/lib/tip-lock.ts";
import { INITIAL_TUTORIAL, tutorialReducer } from "../client/models/tutorial-navigation.ts";
import { visibleSections } from "../client/models/onboarding-sections.ts";
import type { TutorialContext } from "../client/models/tutorial-triggers.ts";

const AGES = { focus: 6, action: 6, trade: 12, firstJob: 12, fields: 16 };
const birth: TutorialContext = { view: "game", characterSection: null, life: {
  lifeKey: "newborn", age: 0, ended: false, decisionPending: false, learnedSkills: 0, notificationShown: false, passed: [],
  sections: [...visibleSections({ age: 0, economy: true, learnedSkills: 0, hadDecision: false }, AGES)],
} };

test("a new life with tips on starts paused, with step 1 (the time bar) showing at once", () => {
  assert.equal(FIRST_STEP, "time-bar");
  assert.equal(guidedStartPaused({ tipsOn: true, firstStepSeen: false, age: 0 }), true);
  const opened = tutorialReducer(INITIAL_TUTORIAL, { type: "sync" }, birth);
  assert.equal(opened.open && opened.hintId, FIRST_STEP, "step 1 opens the moment the game screen shows");
  assert.equal(guidedStartPaused({ tipsOn: false, firstStepSeen: false, age: 0 }), false, "tips off: the clock starts as before");
  assert.equal(guidedStartPaused({ tipsOn: true, firstStepSeen: true, age: 0 }), false, "a player who already learned the time bar is not held");
  assert.equal(guidedStartPaused({ tipsOn: true, firstStepSeen: false, age: 23 }), false, "a loaded mid-life save does not restart the tutorial");
});

test("the clock starts once step 1 is finished or closed, or tips are turned off", () => {
  assert.equal(firstStepDone({ pending: true, tipsOn: true, firstStepSeen: false }), false);
  assert.equal(firstStepDone({ pending: true, tipsOn: true, firstStepSeen: true }), true);
  assert.equal(firstStepDone({ pending: true, tipsOn: false, firstStepSeen: false }), true);
  assert.equal(firstStepDone({ pending: false, tipsOn: true, firstStepSeen: true }), false, "nothing to start when the life did not wait");
});

test("a guided step on the page locks every other control; tips off unlocks everything at once", () => {
  const shown = { tipsOn: true, tipShown: true, mode: "auto" as const, hosted: false };
  assert.equal(guidedStepLocked(shown), true);
  assert.equal(guidedStepLocked({ ...shown, tipsOn: false }), false, "turning the Tutorial off releases every lock");
  assert.equal(guidedStepLocked({ ...shown, tipShown: false }), false, "a tip still waiting for its section locks nothing");
  assert.equal(guidedStepLocked({ ...shown, mode: "manual" }), false, "a tip the player opened from ? or the Tutorial button locks nothing");
  assert.equal(guidedStepLocked({ ...shown, hosted: true }), false, "an open decision or popup keeps working");
});

test("Next decision does nothing while a step shows; afterwards it opens a waiting decision or runs on", () => {
  assert.equal(nextDecisionAction({ phase: "ready", locked: true }), "wait-for-tip");
  assert.equal(nextDecisionAction({ phase: "choice", locked: true }), "wait-for-tip");
  assert.equal(nextDecisionAction({ phase: "choice", locked: false }), "open-decision");
  assert.equal(nextDecisionAction({ phase: "ready", locked: false }), "advance");
});

function fakeElement(matches: readonly string[]) {
  return { closest: (selector: string) => matches.includes(selector) ? {} : null };
}

test("a click is let through only on the step's section, the tip itself, the Tutorial switch or an open popup", () => {
  const card = { contains: (node: unknown) => node === insideCard };
  const insideCard = fakeElement([]);
  setTipLock({ targets: [".yearly-focus"], card });
  assert.equal(blockedByTipLock(fakeElement([".yearly-focus"])), false, "the highlighted section works");
  assert.equal(blockedByTipLock(insideCard), false, "Got it, Next and × work");
  assert.equal(blockedByTipLock(fakeElement(["[data-tutorial-button]"])), false, "the Tutorial switch always works");
  assert.equal(blockedByTipLock(fakeElement(["dialog[open]"])), false, "an open decision still works");
  assert.equal(blockedByTipLock(fakeElement([".session-play"])), true, "Resume, speeds and Next decision wait");
  setTipLock(null);
  assert.equal(blockedByTipLock(fakeElement([".session-play"])), false, "no lock, no block");
  assert.equal(blockedByTipLock(null), false);
});

test("the veil over locked controls leaves holes for the step's section and the Tutorial switch", () => {
  const path = shieldClipPath({ width: 1440, height: 900 }, [{ top: 100, left: 50, width: 300, height: 200 }, { top: 10, left: 1200, width: 120, height: 36 }]);
  assert.equal(path, 'path(evenodd, "M0 0H1440V900H0Z M50 100H350V300H50Z M1200 10H1320V46H1200Z")');
  assert.equal(shieldClipPath({ width: 800, height: 600 }, []), 'path(evenodd, "M0 0H800V600H0Z")');
});
