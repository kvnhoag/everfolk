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

test("deep skills notify in their learned year and use the active tree's titles and IDs", () => {
  const deepWorld = { deepCapabilities: { rules: [{ id: "A1", title: "Tool practice" }, { id: "A2", title: "Measurement" }] } } as WorldPack;
  const state = { ...life(20, { A1: { age: 20, year: -330 } }), year: -330,
    deepCapabilities: { learned: { A1: { year: -330, evidenceIds: [] }, A2: { year: -331, evidenceIds: [] } }, evidence: [] } };
  const before = structuredClone(state);
  assert.deepEqual(learnedThisYear(state, deepWorld), [{ key: "skill:s:deep:A1", id: "A1", title: "Tool practice", age: 20, year: -330 }]);
  assert.deepEqual(state, before, "notices never award skills or alter receipts");
  assert.deepEqual(learnedThisYear({ ...state, year: -329, age: 21 }, deepWorld), []);
});

test("current atlases supply their own titles instead of the reference atlas", () => {
  const currentWorld = { capabilities: { version: 2, nodes: [{ id: "custom", title: "Local field craft" }] } } as WorldPack;
  assert.equal(learnedThisYear(life(12, { custom: { age: 12, year: -330 } }), currentWorld)[0].title, "Local field craft");
});
