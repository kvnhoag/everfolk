import assert from "node:assert/strict";
import test from "node:test";
import { completeAfterClick, completesShownTip, tipsCompletedByClick } from "../client/lib/tip-click.ts";
import { createTutorialStore } from "../client/state/tutorial-store.ts";
import type { TutorialHintId } from "../client/models/tutorial-hints.ts";
import type { TutorialContext } from "../client/models/tutorial-triggers.ts";

/** A clicked element that sits inside the given selectors. */
const element = (...within: string[]) => ({ closest: (selector: string) => within.includes(selector) ? {} : null });
const autoTip = (hintId: TutorialHintId) => ({ open: true, mode: "auto" as const, hintId });

test("a click on a section completes that section's tips", () => {
  assert.deepEqual(tipsCompletedByClick(element(".life-session-bar"), ["time-bar"], autoTip("time-bar")), ["time-bar"]);
  assert.deepEqual(tipsCompletedByClick(element(".yearly-focus"), ["focus"], { open: false, mode: "auto", hintId: null }), ["focus"]);
});

test("a click on the automatic tip's own target completes it even when it is not a section tip", () => {
  assert.deepEqual(tipsCompletedByClick(element(".event-notification-stack"), [], autoTip("notifications")), ["notifications"]);
  // A tip the player opened stays until they close it.
  assert.deepEqual(tipsCompletedByClick(element(".event-notification-stack"), [], { open: true, mode: "manual", hintId: "notifications" }), []);
});

test("clicks on the card, a section's ? or a non-element complete nothing", () => {
  assert.deepEqual(tipsCompletedByClick(element(".life-session-bar", ".everfolk-tutorial-layer"), ["time-bar"], autoTip("time-bar")), []);
  assert.deepEqual(tipsCompletedByClick(element(".yearly-focus", ".section-help"), ["focus"], autoTip("focus")), []);
  assert.deepEqual(tipsCompletedByClick(null, ["focus"], autoTip("focus")), []);
});

test("the tip completes only after the click's own handler ran, so Resume both resumes and closes in one click", () => {
  const store = createTutorialStore({ storage: () => undefined });
  const context: TutorialContext = { view: "game", characterSection: null, life: { lifeKey: "a", age: 0, ended: false, decisionPending: false, learnedSkills: 0, sections: ["time-bar", "story", "rail"], notificationShown: false, passed: [] } };
  store.setGameContext(context);
  assert.equal(store.getSnapshot().hintId, "time-bar");
  const queued: (() => void)[] = [];
  const order: string[] = [];
  // The capture listener schedules completion; the Resume handler then runs and still sees the tip on screen.
  assert.equal(completeAfterClick(["time-bar"], ids => { order.push("complete"); store.used(ids); }, run => queued.push(run)), true);
  order.push(store.getSnapshot().open ? "resume while tip open" : "resume after tip closed");
  queued.forEach(run => run());
  assert.deepEqual(order, ["resume while tip open", "complete"]);
  assert.equal(store.getSnapshot().open, false);
  assert.ok(store.getSnapshot().seen.includes("time-bar"));
});

test("nothing is scheduled for a click that completes no tip", () => {
  let scheduled = 0;
  assert.equal(completeAfterClick([], () => {}, () => { scheduled += 1; }), false);
  assert.equal(scheduled, 0);
});

test("a click that completes the tip on screen lifts its lock at once, so Next decision acts on that click", () => {
  assert.equal(completesShownTip(["time-bar"], autoTip("time-bar")), true);
  assert.equal(completesShownTip(["focus"], autoTip("time-bar")), false, "another section's tip leaves the lock in place");
  assert.equal(completesShownTip(["time-bar"], { open: true, mode: "manual", hintId: "time-bar" }), false, "a manual tip never locks");
  assert.equal(completesShownTip([], autoTip("time-bar")), false);
});
