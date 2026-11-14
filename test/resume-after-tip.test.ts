import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canResumeAfterTip, TIP_RESUME_DELAY_MS, type TipResumeState } from "../client/hooks/useResumeAfterTip.ts";

const ready: TipResumeState = { phase: "ready", hasBegun: true, visible: true, otherOverlayOpen: false, yearEndPending: false };

test("a closed tip carries the year on after a short rest of about two seconds", () => {
  assert.equal(TIP_RESUME_DELAY_MS, 2000);
  assert.equal(canResumeAfterTip(ready), true);
});

test("a closed tip never resumes past a decision, a year-end choice, another window or a hidden game", () => {
  assert.equal(canResumeAfterTip({ ...ready, phase: "choice" }), false, "a turning point is waiting");
  assert.equal(canResumeAfterTip({ ...ready, phase: "ended" }), false);
  assert.equal(canResumeAfterTip({ ...ready, hasBegun: false }), false);
  assert.equal(canResumeAfterTip({ ...ready, yearEndPending: true }), false, "this year's action choice is waiting");
  assert.equal(canResumeAfterTip({ ...ready, otherOverlayOpen: true }), false, "a help popover or pack moment is open");
  assert.equal(canResumeAfterTip({ ...ready, visible: false }), false, "the game screen is not in view");
});

test("the game screen wires the resume and says so in the time bar", () => {
  const app = readFileSync(new URL("../client/screens/App.tsx", import.meta.url), "utf8");
  assert.match(app, /useResumeAfterTip\(tipShown, game\.isPlaying/);
  assert.match(app, /resumingAfterTip \? "Resuming…"/);
});
