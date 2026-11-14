import assert from "node:assert/strict";
import test from "node:test";
import { packCardCount, MIN_PACK_AGE } from "../chain/pack-count.ts";
import { packMilestone } from "../client/models/pack-milestones.ts";

test("free play and earned-only worlds do not promise duration pack cards at 18, 40 or 60", () => {
  for (const age of [MIN_PACK_AGE, 40, 60]) {
    assert.equal(packMilestone(age, false), null, `free age ${age}`);
    assert.equal(packMilestone(age, false, { earnedOnly: false }), null, `free legacy flag ${age}`);
    assert.equal(packMilestone(age, true), null, `weave earned-only default age ${age}`);
  }
});

test("legacy non-figure ranked worlds match packCardCount at 18, 40 and 60", () => {
  for (const age of [MIN_PACK_AGE, 40, 60]) {
    const milestone = packMilestone(age, true, { earnedOnly: false })!;
    assert.equal(milestone.cards, packCardCount({ death_age: age, accomplishments: [], matched_figures: [] }), `age ${age}`);
  }
  assert.match(packMilestone(18, true, { earnedOnly: false })!.title, /Card pack earned/);
  assert.match(packMilestone(18, true, { earnedOnly: false })!.body, /Live to 40 for 2 cards/);
  assert.match(packMilestone(18, true, { earnedOnly: false })!.body, /Weave Mode mints it as real cards on NEAR/);
  assert.match(packMilestone(60, true, { earnedOnly: false })!.body, /3 cards/);
  assert.equal(packMilestone(17, true, { earnedOnly: false }), null);
  assert.equal(packMilestone(19, true, { earnedOnly: false }), null);
});
