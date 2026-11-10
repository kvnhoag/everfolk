import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { getNetWorth } from "../src/economy.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { lifeYearChanges, lifeYearHeadline } from "../client/life-record.ts";
import type { LifeEventRow } from "../client/life-events.ts";

const event = (kind: LifeEventRow["kind"], text: string, title?: string): LifeEventRow => ({ key: text, kind, text, title, sourceIds: [] });
test("one highlight favors personal results and endings, with concise fallback and quiet years", () => {
  assert.equal(lifeYearHeadline([event("activity", "You work."), event("history", "The city changes."), event("event", "You learn letters. More details.", "Learning letters")]), "Learning letters");
  assert.equal(lifeYearHeadline([event("event", "A visit."), event("ending", "Your life ends.")]), "Your life ends.");
  assert.equal(lifeYearHeadline([event("event", "A letter arrives. You read the whole message.")]), "A letter arrives.");
  assert.equal(lifeYearHeadline([]), "A quiet year");
  assert.equal(lifeYearHeadline([event("event", "Knowledge fades by 1."), event("event", "You finish the commission.", "Your first commission")]), "Your first commission");
  assert.ok(lifeYearHeadline([event("event", "a".repeat(200))]).length <= 120);
});

function metrics(life: LifeState, world: WorldPack): Record<string, number> {
  return { ...life.stats, [world.economy!.stat]: getNetWorth(world, life), ...Object.fromEntries(Object.entries(life.character!.skills).map(([id, value]) => [`skill:${id}`, value])) };
}

test("annual arrows match actual end-of-year states, including clamping, net wealth and skills; projection is read-only", () => {
  const world = structuredClone(pack) as WorldPack;
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  const engine = createEngine(world);
  let life = engine.start("year-record-actual");
  const initial = metrics(life, world);
  const finalByAge = new Map<number, Record<string, number>>([[0, initial]]);
  for (let step = 0; life.age < 25 && step < 200; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
    finalByAge.set(life.age, metrics(life, world));
    // Exercise incremental projection, then compare against independent annual endpoints.
    lifeYearChanges(life, engine);
  }
  const saved = engine.save(life), snapshot = structuredClone(life);
  const projected = lifeYearChanges(life, engine);
  let previous = initial;
  for (const [age, final] of finalByAge) {
    const expected = Object.fromEntries(Object.entries(final).map(([id, value]) => [id, Math.round((value - (previous[id] ?? 0)) * 100) / 100]).filter(([, value]) => value !== 0));
    assert.deepEqual(Object.fromEntries((projected.get(age) ?? []).map(change => [change.id, change.delta])), expected, `age ${age}`);
    previous = final;
  }
  assert.deepEqual(life, snapshot);
  assert.equal(engine.save(life), saved);
  const changes = [...projected.values()].flat();
  assert.ok(changes.length > 0);
  assert.ok(changes.some(change => change.id === world.economy!.stat && change.unit === world.economy!.currency.short));
  // Reading an earlier save must reset cached future changes.
  assert.equal(lifeYearChanges(engine.start(life.seed), engine).size, 0);
  assert.deepEqual(lifeYearChanges(life, engine), projected);
  assert.equal(lifeYearChanges(engine.start("another-person"), engine).size, 0);
});


test("per-entry effects stay separate from other events and use clamped actual changes", async () => {
  const { lifeRecordChanges } = await import("../client/life-record.ts");
  const world: WorldPack = {
    schemaVersion: 1, id: "record-entry-test", version: "1", title: "Record test", description: "Synthetic fixture", startYear: -10, maxAge: 10,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 95 }, knowledge: { label: "Knowledge", min: 0, max: 10, initial: 8 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Born here.", weight: 1, effects: [] }], yearlyEffects: [{ type: "stat", stat: "health", delta: -1 }],
    events: [
      { id: "gift", title: "Gift", text: "A gift.", mode: "automatic", trigger: { type: "age", at: 1 }, choices: [], effects: [{ type: "stat", stat: "health", delta: 20 }, { type: "stat", stat: "knowledge", delta: 5 }] },
      { id: "setback", title: "Setback", text: "A setback.", mode: "automatic", trigger: { type: "age", at: 1 }, choices: [], effects: [{ type: "stat", stat: "health", delta: -4 }, { type: "stat", stat: "knowledge", delta: -3 }] },
      { id: "lesson", title: "Lesson", text: "Study?", trigger: { type: "age", at: 1 }, choices: [{ id: "study", text: "Study", outcomes: [{ id: "learned", text: "You learn.", weight: 1, effects: [{ type: "stat", stat: "knowledge", delta: 4 }] }] }] },
    ], endings: [{ id: "complete", title: "Complete", text: "Done." }], defaultEnding: "complete",
  };
  const engine = createEngine(world);
  let life = engine.advance(engine.start("entries"));
  const first = lifeRecordChanges(life, engine);
  const index = (id: string) => life.journal.findIndex(entry => entry.id === id);
  const delta = (id: string, result = first) => Object.fromEntries((result.entries.get(index(id)) ?? []).map(change => [change.id, change.delta]));
  assert.deepEqual(delta("gift"), { health: 6, knowledge: 2 });
  assert.deepEqual(delta("setback"), { health: -4, knowledge: -3 });
  assert.deepEqual(delta("lesson"), {});
  life = engine.choose(life, "study");
  const result = lifeRecordChanges(life, engine);
  assert.deepEqual(delta("learned", result), { knowledge: 3 });
  assert.deepEqual(delta("study", result), {});
  assert.deepEqual(delta("gift", result), { health: 6, knowledge: 2 });
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});


test("ranked record replays NFT influence commands and reports their actual changes", async () => {
  const { lifeRecordChanges } = await import("../client/life-record.ts");
  const world = structuredClone(pack) as WorldPack;
  world.influences = [{ id: "letters.teach", label: "Teach the young", baseWeight: 1,
    effects: [{ type: "stat", stat: "knowledge", delta: 5 }] }];
  const engine = createEngine(world);
  const initial = engine.start("ranked-record");
  const life = engine.influence(initial, { type: "influence", mode: "apply", entry: "letters.teach", power: 1,
    source: { contractId: "lives.testnet", tokenId: "7" } });
  const snapshot = engine.save(life);
  const result = lifeRecordChanges(life, engine);
  const index = life.journal.findIndex(entry => entry.type === "influence");
  assert.equal(result.entries.get(index)?.find(change => change.id === "knowledge")?.delta, life.stats.knowledge - initial.stats.knowledge);
  assert.equal(engine.save(life), snapshot);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
