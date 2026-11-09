import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import alexandria from "../worlds/alexandria-sample.json" with { type: "json" };

const decision = (id: string, at = 3): LifeEvent => ({ id, title: id, text: "A different childhood situation.", exclusiveGroup: "early-play", trigger: { type: "age", at },
  choices: [{ id: "continue", text: "Continue", outcomes: [{ id: `${id}-done`, text: "You finish the activity.", weight: 1, effects: [] }] }] });
function fixture(paced = true): WorldPack {
  return { schemaVersion: 1, id: "exclusive-test", version: "1", title: "Childhood alternatives", description: "Synthetic.", startYear: -50, maxAge: 40,
    stats: { knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0 } }, flags: { allowed: { label: "Allowed", initial: false } },
    origins: [{ id: "home", title: "Home", text: "Home.", weight: 1, effects: [] }], yearlyEffects: [],
    ...(paced ? { eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3 } } : {}),
    events: [decision("a"), decision("b"), decision("c"), decision("d")],
    endings: [{ id: "record", title: "Record", text: "Complete." }], defaultEnding: "record" };
}
function ageTo(engine: ReturnType<typeof createEngine>, initial: LifeState, target: number): LifeState {
  let life = initial;
  while (life.age < target) life = life.phase === "choice" ? engine.choose(life, "continue") : engine.advance(life);
  return life;
}

test("seeded early-age groups choose different openings and offer exactly one member per life", () => {
  for (const paced of [true, false]) {
    const engine = createEngine(fixture(paced)), seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      let life = ageTo(engine, engine.start(`early-${seed}`), 3);
      assert.equal(life.age, 3);
      assert.equal(life.phase, "choice");
      seen.add(life.pendingEventId!);
      const original = engine.save(life), copy = structuredClone(life);
      engine.getChoices(life); engine.getChoices(life);
      assert.deepEqual(life, copy);
      assert.equal(engine.save(life), original);
      life = engine.choose(life, "continue");
      assert.equal(life.phase, "ready", "unchosen alternatives do not drain after the first choice");
      life = ageTo(engine, life, 15);
      assert.equal(Object.values(life.eventCounts).reduce((sum, count) => sum + count, 0), 1);
      assert.deepEqual(engine.load(engine.save(life)), life);
      assert.deepEqual(engine.replay(life.seed, life.commands), life);
    }
    assert.deepEqual([...seen].sort(), ["a", "b", "c", "d"]);
  }
});

test("group selection respects eligibility and later separate groups keep their age anchors", () => {
  const world = fixture();
  world.events[0].when = { type: "flag", flag: "allowed", value: true };
  world.events.push({ ...decision("later-a", 6), exclusiveGroup: "learning" }, { ...decision("later-b", 6), exclusiveGroup: "learning" });
  const engine = createEngine(world);
  for (let seed = 0; seed < 24; seed++) {
    let life = ageTo(engine, engine.start(`gated-${seed}`), 3);
    assert.notEqual(life.pendingEventId, "a");
    life = engine.choose(life, "continue");
    life = ageTo(engine, life, 6);
    assert.ok(["later-a", "later-b"].includes(life.pendingEventId!));
    life = engine.choose(life, "continue");
    assert.equal(life.phase, "ready");
    life = ageTo(engine, life, 12);
    assert.equal(life.journal.filter(entry => entry.type === "event").length, 2);
  }
});

test("a single enabled group member consumes no extra randomness compared with an unmarked event", () => {
  const grouped = fixture(); grouped.events = [grouped.events[0]];
  const plain = structuredClone(grouped); delete plain.events[0].exclusiveGroup;
  const a = createEngine(grouped), b = createEngine(plain);
  const comparable = (life: LifeState) => { const { worldFingerprint: _fingerprint, ...rest } = life; return rest; };
  assert.deepEqual(comparable(ageTo(a, a.start("single-member"), 3)), comparable(ageTo(b, b.start("single-member"), 3)));
});

test("exclusive groups reject invalid marks, incompatible trigger types and mismatched ages", () => {
  for (const change of [
    (event: LifeEvent) => { event.exclusiveGroup = "Bad Group"; },
    (event: LifeEvent) => { event.trigger = { type: "random", weight: 1 }; },
    (event: LifeEvent) => { event.trigger = { type: "year", at: -47 }; },
    (event: LifeEvent) => { event.mode = "automatic"; event.choices = []; },
    (event: LifeEvent) => { event.trigger = { type: "age", at: 4 }; },
  ]) {
    const world = fixture(); change(world.events[0]);
    assert.throws(() => validateWorld(world), /exclusiveGroup/);
  }
  for (const id of [alexandria.health.careDecision, alexandria.economy.moneylender.events.due]) {
    const world = structuredClone(alexandria) as WorldPack;
    const event = world.events.find(event => event.id === id)!;
    event.exclusiveGroup = "interrupt-group"; event.trigger = { type: "age", at: 18 };
    assert.throws(() => validateWorld(world), /interrupts cannot be grouped/);
  }
});
