import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import { cashCost, cashNote } from "../client/models/cash-note.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const paid = { id: "lesson", text: "Lesson", outcomes: [{ id: "a", weight: 1, text: "", effects: [{ type: "stat", stat: "wealth", delta: -2 }] }] } as unknown as Choice;
const free = { id: "walk", text: "Walk", outcomes: [{ id: "a", weight: 1, text: "", effects: [] }] } as unknown as Choice;
const life = (cash: number) => ({ economy: { cash, debt: 0, assets: {} } }) as unknown as LifeState;

test("an action's cash cost comes from its own effects", () => {
  assert.equal(cashCost(paid, world), 20);
  assert.equal(cashCost(free, world), 0);
});

test("every paid action shows the purse beside its cost, and says plainly when it cannot be afforded", () => {
  assert.deepEqual(cashNote(paid, life(80), world), { affordable: true, text: "You have 80 dr; 60 dr left after." });
  assert.deepEqual(cashNote(paid, life(10), world), { affordable: false, text: "Can't afford: costs 20 dr, you have 10 dr." });
  assert.equal(cashNote(free, life(10), world), null, "free actions say nothing about cash");
});
