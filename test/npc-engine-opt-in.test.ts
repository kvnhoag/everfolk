import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import type { NpcCommand, NpcDecision } from "../src/npc/types.ts";
import { availableNpcActions, createNpcSimulation, npcStateFromLife, replayNpcSimulation, stepNpcSimulation } from "../src/npc/simulation.ts";
import { orderValue } from "../src/demo/market-depth.ts";
import { TRADE_ITEMS } from "../src/demo/types.ts";
import retainedWorld from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };

// Deliberately retain lives-4 as the base: new engine behavior requires a custom opt-in.
function fixture(optIn = true): WorldPack {
  const world = structuredClone(retainedWorld) as unknown as WorldPack;
  world.id = "npc-engine-fixture";
  world.version = "npc-engine-test-1";
  if (optIn) world.npcAgents = { version: 1 };
  else delete world.npcAgents;
  for (const event of world.events) {
    event.when = { type: "age", op: "gte", value: 1000 };
    event.maxOccurrences = 1;
  }
  delete world.eventPacing;
  delete world.character!.encounterPacing;
  world.character!.familyBackgrounds = false;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  delete world.health!.mortalityCalibration;
  world.stats.health.initial = 100;
  delete world.stats.health.initialRange;
  world.yearlyRules = [];
  world.yearlyEffects = [];
  return world;
}
function money(life: LifeState): number {
  return life.economy!.cash + life.demo!.town.merchant.cash
    + Object.values(life.vocations!.accounts).reduce((sum, value) => sum + value, 0)
    + Object.values(life.npcs?.people ?? {}).reduce((sum, npc) => sum + npc.cash, 0);
}
function restDecisions(world: WorldPack, life: LifeState): Record<string, NpcDecision> {
  const state = npcStateFromLife(life);
  return Object.fromEntries(Object.values(state.slots).filter(id => availableNpcActions(state, id, world).length)
    .map(id => [id, { action: "rest", speech: "Rest this year.", source: "external" }]));
}
function atAge(engine: LifeEngine, initial: LifeState, age: number): LifeState {
  let life = initial;
  while (life.age < age) {
    assert.equal(life.phase, "ready");
    life = engine.npc(life, { type: "npc-turn", decisions: restDecisions(engine.world, life) });
    life = engine.advance(life);
  }
  return life;
}
function depthWorld(): WorldPack {
  const world = fixture();
  world.demo!.market.depth = {
    halfUnits: Object.fromEntries(TRADE_ITEMS.map(item => [item, 1000])) as Record<typeof TRADE_ITEMS[number], number>,
    keepBps: 5000, minFactorBps: 2500, maxFactorBps: 20000,
    grainAskBps: 5000, grainSpreadBps: 500, leanYearMeasuresPerStanding: 20, leanYearStandingCap: 5,
  };
  return world;
}

test("NPC opt-in is strict, validates dependencies, and leaves retained worlds unchanged", () => {
  const legacy = createEngine(fixture(false));
  const birth = legacy.start("npc-opt-in");
  assert.equal(birth.npcs, undefined);
  assert.doesNotThrow(() => legacy.advance(birth));
  assert.throws(() => legacy.npc(birth, { type: "npc-turn", decisions: {} }), /no NPC companion/);
  for (const invalid of [null, [], {}, { version: 0 }, { version: 2 }, { version: "1" }, { version: 1, enabled: true }]) {
    const world = fixture();
    (world as unknown as Record<string, unknown>).npcAgents = invalid;
    assert.throws(() => createEngine(world), /world.npcAgents/);
  }
  const unsupported = fixture();
  delete unsupported.vocations;
  assert.throws(() => createEngine(unsupported), /world.npcAgents.*requires/);
  let reads = 0;
  const executable = fixture();
  Object.defineProperty(executable.npcAgents!, "version", { enumerable: true, get() { reads++; return 1; } });
  assert.throws(() => createEngine(executable), /world.npcAgents.version.*data property/);
  assert.equal(reads, 0);
});

test("opted-in births retain real family initialization and conserve NPC endowments", () => {
  const ordinary = createEngine(fixture(false)).start("npc-conservation");
  const engine = createEngine(fixture());
  const birth = engine.start("npc-conservation");
  assert.equal(Object.keys(birth.npcs!.slots).length, 5);
  assert.equal(money(birth), money(ordinary));
  assert.ok(birth.vocations!.accounts.workshop < ordinary.vocations!.accounts.workshop);
  const mother = birth.character!.family!.find(person => person.relation === "mother")!;
  assert.ok(mother);
  assert.equal(birth.npcs!.people[birth.npcs!.slots["caregiver-a"]].name, mother.name);
  assert.equal(Object.isFrozen(birth.npcs!.people), true);
  assert.deepEqual(engine.load(engine.save(birth)), birth);
});

test("accepted NPC turns, offers and dialogue survive save/load and exact engine replay", () => {
  const engine = createEngine(fixture());
  const birth = engine.start("npc-accepted-history");
  const original = structuredClone(birth);
  assert.throws(() => engine.advance(birth), /Resolve the NPC turn/);
  let life = atAge(engine, birth, 12);
  assert.deepEqual(birth, original);
  const mentor = life.npcs!.slots.mentor;
  const merchant = life.npcs!.slots.merchant;
  const decisions = restDecisions(engine.world, life);
  decisions[mentor] = { action: "offer-lesson", speech: "I can teach your letters.", source: "external" };
  decisions[merchant] = { action: "offer-grain", speech: "Here is the grain quote.", source: "external" };
  life = engine.npc(life, { type: "npc-turn", decisions });
  const grain = life.npcs!.offers.find(offer => offer.kind === "grain")!;
  assert.ok(grain);
  assert.throws(() => engine.npc(life, { type: "npc-answer", offerId: grain.id, accept: true }), /household still decides/);
  const lesson = life.npcs!.offers.find(offer => offer.kind === "lesson")!;
  const literacy = life.character!.skills.literacy, cash = life.economy!.cash, before = money(life);
  life = engine.npc(life, { type: "npc-answer", offerId: lesson.id, accept: true });
  assert.equal(life.character!.skills.literacy, literacy + 2);
  assert.equal(life.economy!.cash, cash - lesson.price);
  assert.equal(money(life), before);
  life = engine.npc(life, { type: "npc-speech", npcId: mentor, text: "Thank you for the lesson.", reply: "You are welcome." });
  assert.equal(life.npcs!.events.at(-1)!.text, "You are welcome.");
  assert.ok(life.commands.some(command => command.type === "npc-turn"));
  assert.ok(life.commands.some(command => command.type === "npc-answer"));
  assert.ok(life.commands.some(command => command.type === "npc-speech"));
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.throws(() => engine.npc(life, { type: "npc-turn", decisions: {}, surprise: true } as unknown as NpcCommand), /Unknown or executable field/);
  assert.throws(() => engine.npc(life, { type: "npc-answer", offerId: grain.id, accept: "yes" } as unknown as NpcCommand), /Choose accept/);
});

test("the NPC session wrapper uses opted-in engine commands and replays the same player state", () => {
  const world = fixture(), engine = createEngine(world);
  let state = createNpcSimulation(world, "npc-wrapper");
  state = stepNpcSimulation(engine, state, { type: "resolve", decisions: restDecisions(world, state.player) });
  state = stepNpcSimulation(engine, state, { type: "player", command: { type: "advance" } });
  assert.ok(state.player.npcs);
  assert.deepEqual(engine.replay(state.seed, state.player.commands), state.player);
  assert.deepEqual(replayNpcSimulation(world, state.seed, state.commands), state);
});

test("NPC food availability and payment use the actual depth order and move market pressure", () => {
  const world = depthWorld(), engine = createEngine(world);
  const birth = structuredClone(engine.start("npc-depth-food"));
  birth.demo!.town.pressure = { grain: 1500 };
  const cost = orderValue(world.demo!, birth.demo!, "grain", "buy", 10).total;
  assert.ok(cost < 10 * birth.demo!.town.prices.grain.sell);
  birth.economy!.cash = cost;
  const caregiver = birth.npcs!.slots["caregiver-a"];
  assert.ok(availableNpcActions(npcStateFromLife(birth), caregiver, world).some(action => action.id === "buy-food"));
  const decisions = restDecisions(world, birth);
  decisions[caregiver] = { action: "buy-food", speech: "We need food.", source: "external" };
  const next = engine.npc(birth, { type: "npc-turn", decisions });
  assert.equal(next.economy!.cash, 0);
  assert.equal(next.demo!.household.grain, birth.demo!.household.grain + 10);
  assert.equal(next.demo!.town.merchant.cash, birth.demo!.town.merchant.cash + cost);
  assert.equal(next.demo!.town.pressure!.grain, 1490);
  assert.equal(money(next), money(birth));
});

test("NPC grain offers honor the displayed quantity quote and reject stale depth quotes", () => {
  const world = depthWorld(), engine = createEngine(world);
  const adult = structuredClone(atAge(engine, engine.start("npc-depth-offer"), 16));
  adult.demo!.town.pressure = { grain: 1500 };
  adult.economy!.cash = 1000;
  adult.demo!.town.merchant.grain = 1000;
  const merchant = adult.npcs!.slots.merchant, decisions = restDecisions(world, adult);
  decisions[merchant] = { action: "offer-grain", speech: "A grain order.", source: "external" };
  const quoted = engine.npc(adult, { type: "npc-turn", decisions });
  const offer = quoted.npcs!.offers.find(entry => entry.npcId === merchant && entry.kind === "grain")!;
  assert.equal(offer.price, orderValue(world.demo!, quoted.demo!, "grain", "buy", offer.quantity).total);
  const accepted = engine.npc(quoted, { type: "npc-answer", offerId: offer.id, accept: true });
  assert.equal(accepted.economy!.cash, quoted.economy!.cash - offer.price);
  assert.equal(accepted.demo!.town.pressure!.grain, 1500 - offer.quantity);
  assert.equal(money(accepted), money(quoted));
  const changed = structuredClone(quoted);
  changed.demo!.town.pressure!.grain = -1500;
  const before = structuredClone(changed);
  assert.throws(() => engine.npc(changed, { type: "npc-answer", offerId: offer.id, accept: true }), /quote has changed/);
  assert.deepEqual(changed, before);
});


test("NPC study pays the quantity quote in depth worlds and retains the old fixed supplies cost", () => {
  for (const world of [fixture(), depthWorld()]) {
    const engine = createEngine(world);
    const life = structuredClone(atAge(engine, engine.start("npc-study-cost"), 12));
    if (world.demo!.market.depth) life.demo!.town.pressure = { grain: 1500 };
    const cost = world.demo!.market.depth ? orderValue(world.demo!, life.demo!, "grain", "buy", 2).total : 4;
    const mentor = life.npcs!.slots.mentor;
    life.npcs!.people[mentor].cash = cost;
    const decisions = restDecisions(world, life);
    decisions[mentor] = { action: "study", speech: "I will buy supplies.", source: "external" };
    const next = engine.npc(life, { type: "npc-turn", decisions });
    assert.equal(next.npcs!.people[mentor].cash, 0);
    assert.equal(next.demo!.town.merchant.cash, life.demo!.town.merchant.cash + cost);
    assert.equal(next.demo!.town.merchant.grain, life.demo!.town.merchant.grain - 2);
    assert.equal(next.demo!.town.pressure?.grain, world.demo!.market.depth ? 1498 : undefined);
    assert.equal(money(next), money(life));
  }
});
