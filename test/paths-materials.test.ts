import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import { livesWithPaths } from "./paths-lives-fixture.ts";

const kiln: LifeEvent = {
  id: "test-kiln", title: "A shared kiln", text: "A neighbour's kiln is free.", trigger: { type: "age", at: 13 }, stages: ["adolescence", "youth", "adulthood"], scope: "work",
  when: { type: "all", conditions: [{ type: "material", item: "clay", op: "gte", value: 2 }, { type: "material", item: "fuel", op: "gte", value: 1 }] },
  choices: [{ id: "fire", text: "Fire pots", outcomes: [{ id: "fired", text: "The pots come out whole.", weight: 1,
    effects: [{ type: "use-material", item: "clay", quantity: 2, cause: "fired in a neighbour's kiln" }, { type: "use-material", item: "fuel", quantity: 1, cause: "fired in a neighbour's kiln" }] }] }],
};

/** The free-play world with only its automatic and required events, so the kiln is the only decision. */
function world(): WorldPack {
  const pack = livesWithPaths();
  const required = new Set([pack.health?.careDecision, ...Object.values(pack.economy?.moneylender?.events ?? {})]);
  pack.events = [...pack.events.filter(event => event.mode === "automatic" || required.has(event.id)), kiln];
  return pack;
}

test("material conditions read the work inventory, and using materials consumes them", () => {
  const pack = world();
  const engine = createEngine(pack);
  let life = engine.start("kiln");
  while (life.age < 12 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  assert.equal(matchesCondition({ type: "material", item: "clay", op: "gte", value: 1 }, life), false);
  const stocked = structuredClone(life) as LifeState;
  stocked.vocations!.inventory = { ...stocked.vocations!.inventory, clay: 3, fuel: 1 };
  assert.equal(matchesCondition({ type: "material", item: "clay", op: "gte", value: 3 }, stocked), true);
  // Age milestones wait for the next decision slot; advance until the kiln is offered.
  let next = engine.advance(stocked);
  for (let guard = 0; next.pendingEventId !== "test-kiln" && guard < 40; guard++) {
    next = next.phase === "choice" ? engine.choose(next, engine.getChoices(next)[0].id) : engine.advance(next);
  }
  assert.equal(next.pendingEventId, "test-kiln");
  next = engine.choose(next, "fire");
  assert.equal(next.vocations!.inventory.clay, 1);
  assert.equal(next.vocations!.inventory.fuel ?? 0, 0);
  assert.ok(next.journal.some(entry => /fired in a neighbour's kiln/.test(entry.text)), "the use is journalled with its cause");
});

test("using a material the life lacks is never offered, and positive or unknown amounts are invalid", () => {
  const bad = (effect: unknown) => {
    const pack = world();
    pack.events = [...pack.events.filter(item => item.id !== "test-kiln"), { ...kiln, choices: [{ ...kiln.choices[0], outcomes: [{ ...kiln.choices[0].outcomes[0], effects: [effect as never] }] }] }];
    assert.throws(() => validateWorld(pack), /Invalid world/);
  };
  bad({ type: "use-material", item: "clay", quantity: 0, cause: "x" });
  bad({ type: "use-material", item: "unobtainium", quantity: 1, cause: "x" });
  bad({ type: "use-material", item: "clay", quantity: 1 });
  assert.throws(() => validateWorld({ ...world(), events: [...world().events, { ...kiln, id: "k2", when: { type: "material", item: "unobtainium", op: "gte", value: 1 } } as LifeEvent] }), /Invalid world/);
});
