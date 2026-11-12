import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { lifeStageAt } from "../src/life-stages/index.ts";
import type { FieldId } from "../src/paths/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-6.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const scopeOf = new Map(world.events.map(event => [event.id, event.scope ?? "personal"]));
const FIRST_AGE = { personal: 3, work: 12, community: 14, household: 16 } as const;

interface Played { life: LifeState; offered: Array<[number, string]>; at18?: Record<FieldId, number> }

function live(seed: string, pick: number): Played {
  let life = engine.start(seed);
  const offered: Array<[number, string]> = [];
  let at18: Record<FieldId, number> | undefined;
  for (let guard = 0; life.phase !== "ended" && guard < 600; guard++) {
    if (life.phase === "choice") {
      offered.push([life.age, life.pendingEventId!]);
      const choices = engine.getChoices(life);
      life = engine.choose(life, choices[(pick + guard) % choices.length].id);
    } else life = engine.advance(life);
    if (life.age === 18 && !at18) at18 = { ...life.paths!.affinity };
  }
  return { life, offered, at18 };
}

const lives = Array.from({ length: 300 }, (_, i) => live(`acceptance-${i}`, i));

test("no decision comes before its stage allows it, and none in infancy", () => {
  for (const { offered } of lives) for (const [age, id] of offered) {
    assert.ok(age >= 3, `${id} at ${age}`);
    const scope = scopeOf.get(id) as keyof typeof FIRST_AGE;
    assert.ok(age >= FIRST_AGE[scope], `${scope} decision ${id} at ${age}`);
  }
});

test("lives replay exactly", () => {
  for (const { life } of lives.slice(0, 3)) assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("the events of a district, beyond the household background, pull a life toward its work by eighteen", () => {
  const mean = (home: string, fields: FieldId[]) => {
    const group = lives.filter(({ life, at18 }) => life.paths!.home === home && at18);
    // Affinity the life's events added, minus the household background it was born with (not circular).
    const gained = (life: LifeState, at18: Record<FieldId, number>, field: FieldId) => at18[field] - (world.paths!.originAffinity?.[life.originId]?.[field] ?? 0);
    return { value: group.reduce((sum, { life, at18 }) => sum + fields.reduce((total, field) => total + gained(life, at18!, field), 0), 0) / Math.max(1, group.length), count: group.length };
  };
  const villageFarming = mean("delta-village", ["farming"]), courtFarming = mean("court-quarter", ["farming"]);
  const villageLearning = mean("delta-village", ["research", "civic"]), courtLearning = mean("court-quarter", ["research", "civic"]);
  assert.ok(courtFarming.count >= 5, `${courtFarming.count} court lives reached 18`);
  assert.ok(villageFarming.value > courtFarming.value, `farming: village ${villageFarming.value} vs court ${courtFarming.value}`);
  assert.ok(courtLearning.value > villageLearning.value, `research and civic: court ${courtLearning.value} vs village ${villageLearning.value}`);
});

test("every ended life has one contiguous record per stage it lived through", () => {
  for (const { life } of lives) {
    assert.equal(life.phase, "ended");
    const records = life.stageRecords!;
    assert.equal(records[0].fromAge, 0);
    for (let i = 1; i < records.length; i++) assert.equal(records[i].fromAge, records[i - 1].toAge + 1, `${life.seed} record ${i}`);
    assert.equal(records.at(-1)!.toAge, life.age);
    assert.equal(records.at(-1)!.stageId, lifeStageAt(world, life.age)!.id);
  }
});
