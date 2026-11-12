import { test } from "node:test";
import assert from "node:assert/strict";
import { PROOF_YEARS, SKILL_GATES } from "../src/vocations/pacing.ts";
import { capabilityProgress } from "../src/capabilities/engine.ts";
import { farmProofProgress } from "../src/capabilities/farming.ts";
import { militaryCareerReason } from "../src/capabilities/military.ts";
import { createEngine } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const fresh = shipped as unknown as WorldPack, kept = retained as unknown as WorldPack;
const node = (world: WorldPack, id: string) => world.capabilities!.nodes.find(item => item.id === id);
const lifeIn = (world: WorldPack): LifeState => structuredClone(createEngine(world).start("pacing")) as LifeState;
const progress = (world: WorldPack, id: string) => (id.startsWith("F") ? farmProofProgress : capabilityProgress)(world, lifeIn(world), id);

test("the new free-play world asks for the measured number of proof years, and its text says so", () => {
  for (const [id, years] of Object.entries(PROOF_YEARS)) {
    assert.equal(node(fresh, id)!.proofYears, years, id);
    assert.equal(progress(fresh, id).required, years, `${id} progress`);
    assert.match(node(fresh, id)!.proof, new RegExp(`\\b${years}\\b`), `${id}: ${node(fresh, id)!.proof}`);
  }
});

test("retained worlds keep their proof years", () => {
  for (const id of Object.keys(PROOF_YEARS)) {
    const old = node(kept, id);
    if (!old) continue;
    assert.equal(old.proofYears, undefined);
    assert.equal(progress(kept, id).required, 2, id);
  }
});

test("an officer's commission needs 2 proved service years, a general's 5", () => {
  const life = lifeIn(fresh);
  life.capabilities!.learned.M7 = { age: 30, year: 0 }; life.capabilities!.learned.M10 = { age: 30, year: 0 };
  life.stats.health = 80; life.stats.knowledge = 40;
  const service = (years: number) => Array.from({ length: years }, (_, age) => ({ age, role: "soldier", paid: 10, wage: 10, rations: 5, ration: 5, purseBefore: 100, purseAfter: 90, grainBefore: 50, grainAfter: 45 }));
  life.capabilities!.military = { service: service(1) };
  assert.match(militaryCareerReason(fresh, life, "officer") ?? "", /2 proved service years/);
  life.capabilities!.military = { service: service(4) };
  assert.match(militaryCareerReason(fresh, life, "general") ?? "", /5 proved service years/);
});

test("proof years are validated", () => {
  for (const value of [0, 7, 1.5]) {
    const world = structuredClone(fresh);
    node(world, "AT6")!.proofYears = value;
    assert.throws(() => validateWorld(world), /proofYears/, String(value));
  }
});

test("the military path asks for the measured skill levels in the new world", () => {
  for (const [id, gates] of Object.entries(SKILL_GATES)) for (const [skill, value] of Object.entries(gates)) {
    assert.equal(node(fresh, id)!.minimumProficiency[skill], value, `${id} ${skill}`);
  }
});

test("a qualified recruit whose book-learning has faded can still enlist; an unfit one cannot", () => {
  const life = lifeIn(fresh);
  life.age = 24;
  life.capabilities!.learned.M4 = { age: 22, year: 0 };
  life.stats.knowledge = 2; life.stats.health = 70;
  assert.equal(militaryCareerReason(fresh, life, "soldier"), undefined);
  life.stats.health = 30;
  assert.match(militaryCareerReason(fresh, life, "soldier") ?? "", /Health 45/);
});

test("each military rank asks for exactly the skills of its qualification", () => {
  for (const [job, id] of Object.entries({ soldier: "M4", officer: "M7", general: "M10" })) {
    assert.deepEqual(fresh.character!.jobs.find(item => item.id === job)!.requirements, node(fresh, id)!.minimumProficiency, job);
  }
});

test("an officer's commission is granted 40% of the time, with two years between tries", () => {
  const seek = fresh.character!.activities.find(activity => activity.id === "seek-officer-commission")!;
  assert.equal(seek.cooldownYears, 2);
  const weights = Object.fromEntries(seek.outcomes.map(outcome => [outcome.id, outcome.weight]));
  assert.deepEqual(weights, { "officer-appointed": 40, "officer-refused": 60 });
});
