import assert from "node:assert/strict";
import test from "node:test";
import { CLOSED_TUTORIAL, planAppScreen, tutorialKeyAction, tutorialTransition } from "../client/models/tutorial-navigation.ts";

const total = 5;

test("start opens at step one, or at a requested step within range", () => {
  assert.deepEqual(tutorialTransition(CLOSED_TUTORIAL, { type: "start" }, total), { open: true, index: 0, run: 1 });
  assert.equal(tutorialTransition(CLOSED_TUTORIAL, { type: "start", index: 3 }, total).index, 3);
  assert.equal(tutorialTransition(CLOSED_TUTORIAL, { type: "start", index: 99 }, total).index, 4);
  assert.equal(tutorialTransition(CLOSED_TUTORIAL, { type: "start", index: -2 }, total).index, 0);
});

test("next and back move one step and stay within the tour", () => {
  const open = tutorialTransition(CLOSED_TUTORIAL, { type: "start" }, total);
  const second = tutorialTransition(open, { type: "next" }, total);
  assert.equal(second.index, 1);
  assert.equal(tutorialTransition(second, { type: "back" }, total).index, 0);
  assert.equal(tutorialTransition(open, { type: "back" }, total), open, "Back on step one changes nothing");
});

test("transitions never mutate the previous state", () => {
  const open = Object.freeze(tutorialTransition(CLOSED_TUTORIAL, { type: "start" }, total));
  const next = tutorialTransition(open, { type: "next" }, total);
  assert.notEqual(next, open);
  assert.equal(open.index, 0);
});

test("Next on the last step closes the tour; close works from any step", () => {
  const last = tutorialTransition(CLOSED_TUTORIAL, { type: "start", index: 4 }, total);
  assert.equal(tutorialTransition(last, { type: "next" }, total).open, false);
  const middle = tutorialTransition(CLOSED_TUTORIAL, { type: "start", index: 2 }, total);
  const closed = tutorialTransition(middle, { type: "close" }, total);
  assert.equal(closed.open, false);
  assert.equal(tutorialTransition(closed, { type: "next" }, total), closed, "a closed tour ignores Next");
});

test("restarting begins a new run so the same step navigates again", () => {
  const first = tutorialTransition(CLOSED_TUTORIAL, { type: "start" }, total);
  const again = tutorialTransition(first, { type: "start" }, total);
  assert.equal(again.run, first.run + 1);
});

test("keyboard: arrows move, Enter moves unless a button has focus, Escape closes", () => {
  assert.equal(tutorialKeyAction("ArrowRight", false), "next");
  assert.equal(tutorialKeyAction("ArrowDown", false), "next");
  assert.equal(tutorialKeyAction("ArrowLeft", false), "back");
  assert.equal(tutorialKeyAction("ArrowUp", false), "back");
  assert.equal(tutorialKeyAction("Enter", false), "next");
  assert.equal(tutorialKeyAction("Enter", true), null, "a focused button handles Enter itself");
  assert.equal(tutorialKeyAction("Escape", false), "close");
  assert.equal(tutorialKeyAction("a", false), null);
});

test("an existing life is never replaced: the tour continues it", () => {
  for (const screen of [{ kind: "home" }, { kind: "new-life" }, { kind: "game" }, { kind: "character", section: "skills" }, { kind: "chain", hash: "#market" }] as const) {
    assert.equal(planAppScreen(screen, { hasBegun: true }).beginLife, false, screen.kind);
  }
  assert.deepEqual(planAppScreen({ kind: "new-life" }, { hasBegun: true }), { menuOpen: true, birthPopoverOpen: false, panel: null, beginLife: false });
  assert.deepEqual(planAppScreen({ kind: "game" }, { hasBegun: true }), { menuOpen: false, birthPopoverOpen: false, panel: null, beginLife: false });
});

test("without a life, the tour opens the stat roll and then begins through the normal flow", () => {
  assert.deepEqual(planAppScreen({ kind: "home" }, { hasBegun: false }), { menuOpen: true, birthPopoverOpen: false, panel: null, beginLife: false });
  assert.deepEqual(planAppScreen({ kind: "new-life" }, { hasBegun: false }), { menuOpen: true, birthPopoverOpen: true, panel: null, beginLife: false });
  assert.equal(planAppScreen({ kind: "game" }, { hasBegun: false }).beginLife, true);
});

test("Character steps open the popup at a section; chain steps leave the game as it is", () => {
  assert.deepEqual(planAppScreen({ kind: "character", section: "wealth" }, { hasBegun: true }), { menuOpen: false, birthPopoverOpen: false, panel: "character", characterSection: "wealth", beginLife: false });
  assert.deepEqual(planAppScreen({ kind: "chain", hash: "#weave" }, { hasBegun: true }), { menuOpen: "keep", birthPopoverOpen: false, panel: null, beginLife: false });
});
