import { test } from "node:test";
import assert from "node:assert/strict";
import type { Choice } from "../src/types.ts";
import { removeChoiceOutcome, renameChoiceOutcome } from "../client/admin/opportunity-edit.ts";

function opportunity(): Choice {
  return {
    id: "apply", text: "Apply for the appointment",
    opportunity: { label: "Appointment", outcomeIds: ["accepted"] },
    outcomes: [
      { id: "accepted", text: "You receive the appointment.", weight: 1, effects: [], weightModifiers: [{ when: { type: "origin", origin: "household" }, multiplier: 1.4, reason: "Household contacts" }] },
      { id: "declined", text: "The appointment goes to someone else.", weight: 9, effects: [] },
      { id: "deferred", text: "They ask you to return later.", weight: 2, effects: [] },
    ],
  };
}

test("renaming an outcome preserves its success selection and conditional odds", () => {
  const original = opportunity();
  const edited = renameChoiceOutcome(original, 0, "appointed");
  assert.deepEqual(edited.opportunity?.outcomeIds, ["appointed"]);
  assert.equal(edited.outcomes[0].weightModifiers?.[0].multiplier, 1.4);
  assert.deepEqual(original.opportunity?.outcomeIds, ["accepted"]);
});

test("removing the sole success removes the preview rather than keeping a stale reference", () => {
  const edited = removeChoiceOutcome(opportunity(), 0);
  assert.equal(edited.opportunity, undefined);
  assert.equal(edited.outcomes.length, 2);
});

test("removing a failure retains a valid chance but the final failure removes it", () => {
  const edited = removeChoiceOutcome(opportunity(), 2);
  assert.deepEqual(edited.opportunity?.outcomeIds, ["accepted"]);
  assert.equal(removeChoiceOutcome(edited, 1).opportunity, undefined);
});
