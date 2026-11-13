import assert from "node:assert/strict";
import test from "node:test";
import type { WorldPack } from "../src/types.ts";
import { yearlyFocusFirstAge } from "../client/models/yearly-focus.ts";

function world(activities: { id: string; minAge?: number }[]): WorldPack {
  return { character: { activities } } as unknown as WorldPack;
}

test("This year's focus appears at the youngest age of any focus activity", () => {
  assert.equal(yearlyFocusFirstAge(world([{ id: "train-literacy", minAge: 5 }, { id: "visit-a-friend", minAge: 3 }, { id: "unrelated", minAge: 0 }])), 3);
  assert.equal(yearlyFocusFirstAge(world([{ id: "take-an-easy-walk" }])), 0, "no minimum age means from birth");
  assert.equal(yearlyFocusFirstAge(world([])), Infinity, "a world without focus activities never shows the box");
});
