import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { workQuote } from "../src/capabilities/work.ts";
import { payWages } from "../src/demo/service.ts";
import { demoContext } from "../src/demo/state.ts";
import { fieldOfNode, scaledPay } from "../src/paths/index.ts";
import type { Effect, LifeState, WorldPack } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import { livesWithPaths, staffed } from "./paths-lives-fixture.ts";

const world = livesWithPaths();
const engine = createEngine(world);
const base = engine.start("paths-pay");

test("skill-atlas nodes map to their fields", () => {
  assert.equal(fieldOfNode(world, "PS5"), "research");
  assert.equal(fieldOfNode(world, "PP5"), "civic");
  assert.equal(fieldOfNode(world, "FC5") ?? fieldOfNode(world, "F1"), "farming");
  assert.equal(fieldOfNode(world, "P1"), "research");
  assert.equal(fieldOfNode(world, "F1"), "farming");
  assert.equal(fieldOfNode(world, "M4"), "soldiering");
  assert.equal(fieldOfNode(world, "B2"), "soldiering");
  assert.equal(fieldOfNode(world, "A1"), null);
  assert.equal(fieldOfNode(world, "nope"), null);
});

test("the same research work pays more where scholars are scarce, within the bounds", () => {
  const scarce = workQuote(world, staffed(world, base, "research", 1), "PS5").pay;
  const steady = workQuote(world, staffed(world, base, "research", 4), "PS5").pay;
  const crowded = workQuote(world, staffed(world, base, "research", 12), "PS5").pay;
  assert.equal(steady, 20);
  assert.ok(scarce > steady && steady > crowded, `${scarce} > ${steady} > ${crowded}`);
  assert.equal(scarce, 32);
  assert.equal(crowded, 14);
});

test("a payer that cannot fund the scaled pay refuses the work instead of creating money", () => {
  const life = staffed(world, base, "research", 1);
  life.vocations!.accounts.school = 25;
  assert.match(workQuote(world, life, "PS5").reason ?? "", /cannot fund the quoted 32 dr/);
});

test("a soldier short district pays soldiers more from the same army purse", () => {
  const wage = (workers: number): { paid: number; purseSpent: number } => {
    const life = staffed(world, base, "soldiering", workers);
    life.character!.jobId = "soldier";
    life.demo!.year = { ...life.demo!.year, army: "war" };
    life.demo!.town.army.purse = 100_000;
    let paid = 0;
    const ctx = demoContext(world, life, (effects: readonly Effect[]) => {
      for (const effect of effects) if (effect.type === "cash") paid += effect.delta;
    }, () => {});
    payWages(ctx);
    return { paid, purseSpent: 100_000 - life.demo!.town.army.purse };
  };
  const short = wage(1), steady = wage(6);
  assert.ok(short.paid >= Math.floor(steady.paid * 1.2), `${short.paid} vs ${steady.paid}`);
  assert.equal(short.paid, short.purseSpent, "every drachma comes from the purse");
});

test("worlds without paths keep their pay", () => {
  const plain = retained as unknown as WorldPack;
  const life = createEngine(plain).start("paths-pay") as LifeState;
  assert.equal(workQuote(plain, life, "PS5").pay, 20);
  assert.equal(scaledPay(plain, life, "research", 20), 20);
});

test("scaled pay says why: the wage journal and the work quote name the need", () => {
  const notes = (workers: number): string[] => {
    const life = staffed(world, base, "soldiering", workers);
    life.character!.jobId = "soldier";
    life.demo!.year = { ...life.demo!.year, army: "war" };
    life.demo!.town.army.purse = 100_000;
    const lines: string[] = [];
    payWages(demoContext(world, life, () => {}, (_id, text) => lines.push(text)));
    return lines;
  };
  assert.ok(notes(1).some(line => /soldiers are scarce/i.test(line) && /1\.6×/.test(line)), notes(1).join(" | "));
  assert.ok(!notes(6).some(line => /scarce|crowded/i.test(line)), "a steady field adds no note");
  assert.match(workQuote(world, staffed(world, base, "research", 1), "PS5").need ?? "", /scholars are scarce.*1\.6×/i);
  assert.match(workQuote(world, staffed(world, base, "research", 12), "PS5").need ?? "", /crowded.*0\.7×/i);
  assert.equal(workQuote(world, staffed(world, base, "research", 4), "PS5").need, undefined);
});
