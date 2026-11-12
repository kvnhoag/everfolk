import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { FIELD_IDS } from "../src/paths/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const byId = new Map(world.events.map(event => [event.id, event]));

interface Played { life: LifeState; offered: Array<[number, string]> }

function live(seed: string, pick: number): Played {
  let life = engine.start(seed);
  const offered: Array<[number, string]> = [];
  for (let guard = 0; life.phase !== "ended" && guard < 600; guard++) {
    if (life.phase === "choice") {
      offered.push([life.age, life.pendingEventId!]);
      const choices = engine.getChoices(life);
      life = engine.choose(life, choices[(pick + guard) % choices.length].id);
    } else life = engine.advance(life);
  }
  return { life, offered };
}

const lives = Array.from({ length: 300 }, (_, i) => live(`paths-content-${i}`, i));
const adults = lives.filter(({ life }) => life.age >= 18);

test("inspiration events exist for every field and stage band, with the right stages and scopes", () => {
  const expected: Record<string, { stages: string[]; scope?: string; automatic: boolean }> = {
    child: { stages: ["early-childhood", "childhood"], automatic: true },
    young: { stages: ["adolescence", "youth"], scope: "personal", automatic: false },
    adult: { stages: ["adulthood"], scope: "work", automatic: false },
    elder: { stages: ["later-life"], automatic: true },
  };
  for (const field of FIELD_IDS) for (const [band, rule] of Object.entries(expected)) {
    const event = byId.get(`inspire-${field}-${band}`);
    assert.ok(event, `inspire-${field}-${band}`);
    assert.deepEqual(event.stages, rule.stages);
    assert.equal(event.scope, rule.scope);
    assert.equal(event.mode === "automatic", rule.automatic);
    assert.deepEqual(event.fields, [field]);
  }
});

test("lives meet people from every field their districts have", () => {
  for (const field of FIELD_IDS) {
    const reachable = adults.filter(({ life }) => life.paths!.people[field].some(count => count > 0) ||
      life.paths!.practitioners.some(person => person.field === field));
    const met = reachable.filter(({ life }) => life.paths!.practitioners.some(person => person.field === field));
    assert.ok(reachable.length > 0, `${field} is reachable somewhere`);
    assert.ok(met.length >= reachable.length * 0.25, `${field}: met in ${met.length} of ${reachable.length} lives that could`);
  }
});

test("renowned people are rare in a village and common at court", () => {
  const renowned = (district: string) => {
    const group = lives.filter(({ life }) => life.paths!.home === district);
    return { share: group.filter(({ life }) => life.paths!.practitioners.some(person => person.tier === "renowned")).length / Math.max(1, group.length), count: group.length };
  };
  const village = renowned("delta-village"), court = renowned("court-quarter");
  assert.ok(village.share < 0.1, `village ${village.share}`);
  assert.ok(court.count >= 5, `court lives sampled: ${court.count}`);
  assert.ok(court.share > 0.3, `court ${court.share}`);
});
