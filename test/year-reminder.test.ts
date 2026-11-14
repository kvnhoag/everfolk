import assert from "node:assert/strict";
import test from "node:test";
import { YEAR_TASK_TARGETS, yearReminderKey, yearReminderLine, yearTask, type YearTaskFacts } from "../client/models/year-reminder.ts";
import { liveNoticeKeys, nextNoticeFade, startNoticeClocks } from "../client/models/timed-notices.ts";

const facts = (over: Partial<YearTaskFacts> = {}): YearTaskFacts => ({
  phase: "ready", open: ["focus", "action", "market", "planting"], learned: [], pointed: [], introduced: [],
  planProblem: false, overfull: false, ongoing: [], ...over,
});
const task = (over: Partial<YearTaskFacts> = {}) => yearTask(facts(over))?.task ?? null;

test("the reminder names one thing: the first step the player has not learned yet, in order", () => {
  assert.equal(task(), "focus");
  assert.equal(task({ learned: ["focus"] }), "action", "once a focus is set, the pointer moves on to the yearly action");
  assert.equal(task({ learned: ["focus", "action"] }), "market");
  assert.equal(task({ learned: ["focus", "action", "market"] }), "planting");
  assert.equal(task({ learned: ["focus", "action", "market", "planting"] }), null, "nothing left to teach: no reminder");
});

test("a focus that is set is never asked about again", () => {
  for (const pointed of [[], ["action"], ["action", "market"]] as const) {
    assert.notEqual(task({ learned: ["focus"], pointed: [...pointed] }), "focus");
  }
  assert.equal(task({ learned: ["focus"], open: ["focus"] }), null, "with only the focus open there is nothing to say");
});

test("each step is pointed at once at most, so nothing repeats every year", () => {
  assert.equal(task({ pointed: ["focus"] }), "action", "an unused step already pointed at once is left alone");
  assert.equal(task({ pointed: ["focus", "action", "market", "planting"] }), null);
});

test("a step introduced by its tip this year is not pointed at again the same year", () => {
  assert.equal(task({ introduced: ["focus", "action"] }), "market");
  assert.equal(task({ open: ["focus", "action"], introduced: ["focus", "action"] }), null, "the year focus and the action open, the tips do the teaching");
});

test("only what the player can do now is named", () => {
  assert.equal(task({ open: [] }), null);
  assert.equal(task({ open: ["action"], learned: [] }), "action", "a closed focus is skipped");
  assert.equal(task({ phase: "choice" }), null, "never during a decision");
  assert.equal(task({ phase: "ended" }), null);
});

test("an overfull store never asks to plan fields; it points at the market when it is open, else says nothing", () => {
  const full = { learned: ["focus", "action", "market", "planting"] as const, overfull: true };
  assert.deepEqual(yearTask(facts({ ...full, learned: [...full.learned] })), { task: "market", reason: "problem" });
  assert.equal(task({ ...full, learned: [...full.learned], open: ["focus", "action", "planting"] }), null, "a market visit already used: say nothing");
  assert.notEqual(task({ ...full, learned: [...full.learned], open: ["planting"] }), "planting");
});

test("a field plan that a new plan can fix is named once while the problem lasts", () => {
  const learned = ["focus", "action", "market", "planting"] as const;
  assert.deepEqual(yearTask(facts({ learned: [...learned], planProblem: true })), { task: "planting", reason: "problem" });
  assert.equal(task({ learned: [...learned], planProblem: true, ongoing: ["planting"] }), null, "the same problem is not repeated next year");
  assert.equal(task({ learned: [...learned], planProblem: true, open: ["focus"] }), null, "fields not open yet: nothing");
});

test("the notice and the callout name the same one thing", () => {
  for (const pick of [{ task: "focus", reason: "learn" }, { task: "action", reason: "learn" }, { task: "market", reason: "learn" },
    { task: "planting", reason: "learn" }, { task: "market", reason: "problem" }, { task: "planting", reason: "problem" }] as const) {
    const line = yearReminderLine(pick);
    assert.ok(line.body.length > 0 && line.body.endsWith("."), `${pick.task} body`);
    assert.ok(line.body.toLowerCase().includes(line.thing), `${pick.task} body names ${line.thing}`);
    assert.ok(line.label.toLowerCase().includes(line.thing), `${pick.task} callout names ${line.thing}`);
    assert.ok(YEAR_TASK_TARGETS[pick.task].length > 0);
  }
  assert.doesNotMatch(yearReminderLine({ task: "market", reason: "problem" }).body, /plan your fields/i);
});

test("one key per life and year", () => {
  assert.notEqual(yearReminderKey("life", 8), yearReminderKey("life", 9));
  assert.equal(yearReminderKey("life", 8), yearReminderKey("life", 8));
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
