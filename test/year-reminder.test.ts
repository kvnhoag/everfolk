import assert from "node:assert/strict";
import test from "node:test";
import { YEAR_TASK_TARGETS, yearReminderKey, yearReminderText, yearTasks, type YearTaskFacts } from "../client/models/year-reminder.ts";
import { liveNoticeKeys, nextNoticeFade, startNoticeClocks } from "../client/models/timed-notices.ts";

const facts = (over: Partial<YearTaskFacts> = {}): YearTaskFacts => ({ age: 16, phase: "ready", hasFields: true, focusShown: true, actionUsed: false, plantingAttention: true, ...over });

test("the yearly reminder names fields, focus and yearly action while each is open", () => {
  assert.deepEqual(yearTasks(facts()), ["planting", "focus", "action"]);
  assert.equal(yearReminderText(yearTasks(facts())), "Plan your fields in Inventory & Granary, check your focus and choose this year's action.");
  assert.deepEqual(yearTasks(facts({ actionUsed: true })), ["planting", "focus"], "a spent action is not asked for again");
  assert.deepEqual(yearTasks(facts({ age: 5, focusShown: false })), [], "a small child is asked about nothing; the yearly action opens at 6");
  assert.deepEqual(yearTasks(facts({ age: 15 })), ["focus", "action"], "the fields are the household's to plan until 16");
  assert.deepEqual(yearTasks(facts({ hasFields: false })), ["focus", "action"]);
  assert.equal(yearReminderText(["action"]), "Choose this year's action.");
  assert.deepEqual(yearTasks(facts({ plantingAttention: false })), ["focus", "action"], "a plan that needs nothing is not asked about");
});

test("no reminder during a decision or after the life ends; one key per year", () => {
  assert.deepEqual(yearTasks(facts({ phase: "choice" })), []);
  assert.deepEqual(yearTasks(facts({ phase: "ended" })), []);
  assert.notEqual(yearReminderKey("life", 8), yearReminderKey("life", 9));
  assert.equal(yearReminderKey("life", 8), yearReminderKey("life", 8));
  for (const targets of Object.values(YEAR_TASK_TARGETS)) assert.ok(targets.length > 0);
});

test("a timed notice shows once for its duration and its clock never restarts", () => {
  const started = startNoticeClocks(new Map(), ["skill:a", "year:8"], 1000, 3000);
  assert.deepEqual(liveNoticeKeys(started, ["skill:a", "year:8"], 3999), ["skill:a", "year:8"]);
  assert.deepEqual(liveNoticeKeys(started, ["skill:a", "year:8"], 4000), []);
  const again = startNoticeClocks(started, ["skill:a", "year:9"], 9000, 3000);
  assert.equal(again.get("skill:a"), 4000, "an existing clock keeps its expiry");
  assert.deepEqual(liveNoticeKeys(again, ["skill:a", "year:9"], 9500), ["year:9"]);
  assert.equal(startNoticeClocks(again, ["skill:a"], 10_000, 3000), again, "nothing new: same map");
  assert.equal(nextNoticeFade(again, ["skill:a", "year:9"], 9500), 2500);
  assert.equal(nextNoticeFade(again, ["skill:a"], 9500), null);
});
