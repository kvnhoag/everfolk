import assert from "node:assert/strict";
import test from "node:test";
import { packCardCount, MIN_PACK_AGE } from "../chain/pack-count.ts";
import { packMilestone } from "../client/models/pack-milestones.ts";

test("the pack moments match what the pack really holds at 18, 40 and 60", () => {
  for (const age of [MIN_PACK_AGE, 40, 60]) {
    const milestone = packMilestone(age, false)!;
    assert.equal(milestone.cards, packCardCount({ death_age: age, accomplishments: [], matched_figures: [] }), `age ${age}`);
  }
  assert.match(packMilestone(18, false)!.title, /Card pack earned/);
  assert.match(packMilestone(18, false)!.body, /Live to 40 for 2 cards/);
  assert.match(packMilestone(18, true)!.body, /mints it as real cards on NEAR/);
  assert.match(packMilestone(60, false)!.body, /3 cards/);
  assert.equal(packMilestone(17, false), null);
  assert.equal(packMilestone(19, false), null);
});
