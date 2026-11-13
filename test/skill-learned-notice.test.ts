import assert from "node:assert/strict";
import test from "node:test";
import { learnedThisYear } from "../client/models/skill-learned-notice.ts";
import { CAPABILITY_NODES } from "../client/models/capability-layout.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const world = { capabilities: undefined } as unknown as WorldPack;
const [first, second] = CAPABILITY_NODES;
const life = (age: number, learned: Record<string, { age: number; year: number }>) =>
  ({ age, seed: "s", capabilities: { learned, evidence: [], costBasis: {}, reservedPayment: 0 } }) as unknown as LifeState;

test("skills learned this year become notices with their titles", () => {
  const notices = learnedThisYear(life(12, { [first.id]: { age: 12, year: -330 }, [second.id]: { age: 9, year: -333 } }), world);
  assert.deepEqual(notices.map(notice => notice.id), [first.id]);
  assert.equal(notices[0].title, first.title);
  assert.equal(notices[0].key, `skill:s:${first.id}`);
});

test("a life without learned skills has no notices", () => {
  assert.deepEqual(learnedThisYear(life(3, {}), world), []);
  assert.deepEqual(learnedThisYear({ age: 3, seed: "s" } as LifeState, world), []);
});
