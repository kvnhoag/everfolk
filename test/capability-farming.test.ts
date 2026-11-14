import assert from "node:assert/strict";
import test from "node:test";
import type { WorldPack } from "../src/types.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import { initialHousehold, harvest, payRent, feedHousehold, spoilAndSpin, householdView, applyPlan } from "../src/demo/household.ts";
import { initialTown, tradeReason, executeTrade } from "../src/demo/market.ts";
import { demoContext } from "../src/demo/state.ts";
import { applyFarmWork, farmWorkReason, farmProofProgress, settleFarmCapabilities, farmReserve, farmSaleReason, farmWorkQuote, ordinarySeedGrain, farmCapacityBonus } from "../src/capabilities/farming.ts";
import design from "../design/skill-tree/catalog.json" with { type: "json" };
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };

function fixture() {
  const world = structuredClone(base) as unknown as WorldPack;
  world.capabilities = { version: 1, nodes: design.nodes.filter(node => node.branch === "Farming") };
  const life = {
    schemaVersion: 1, worldId: world.id, worldVersion: world.version, worldFingerprint: "fixture", seed: "farm-proof", rngState: 1,
    age: 20, year: -330, originId: world.origins[0].id, phase: "ready", pendingEventId: null, endingId: null,
    stats: { health: 100, knowledge: 50, wealth: 50, bonds: 50 }, flags: {}, journal: [], commands: [], eventCounts: {}, lastEventAge: {},
    character: { name: "Farmer", skills: { farming: 90, reckoning: 50 }, jobId: "tenant-farmer", children: [], relationshipStatus: "single", lastActivityAge: null },
    economy: { cash: 1000, debt: 0, assets: {} },
    demo: { household: initialHousehold(world.demo!), goods: { silver: 0, gold: 0, silk: 0, linen: 0 }, town: initialTown(world.demo!), year: { flood: "normal", army: "quiet", road: "safe" }, reputation: 20, built: [], works: {}, lastTradeAge: null },
    vocations: { inventory: { "flax-seed": 100, timber: 20, clay: 20 }, lots: [{ item: "flax-seed", quality: 1, quantity: 100 }, { item: "timber", quality: 1, quantity: 20 }, { item: "clay", quality: 1, quantity: 20 }], stock: {}, accounts: { merchant: 5000, workshop: 5000, school: 0, council: 0 }, demand: {}, completed: {}, workedAge: null },
    capabilities: { learned: {}, evidence: [] },
  } as unknown as LifeStateWithDemo;
  life.demo.household.grain = 2000;
  return { world, life };
}
function ctx(world: WorldPack, life: LifeStateWithDemo) {
  return demoContext(world, life, effects => {
    for (const effect of effects) {
      if (effect.type === "cash") life.economy!.cash += effect.delta;
      if (effect.type === "stat") life.stats[effect.stat] += effect.delta;
    }
  }, (id, text) => life.journal.push({ type: "event", id, text, age: life.age, year: life.year }));
}
function settle(world: WorldPack, life: LifeStateWithDemo) {
  const completedAge = life.age;
  life.age++; life.year++;
  const c = ctx(world, life);
  harvest(c); payRent(c); feedHousehold(c); spoilAndSpin(c);
  settleFarmCapabilities(world, life, completedAge);
}
function learnParents(world: WorldPack, life: LifeStateWithDemo, id: string) {
  for (const parent of world.capabilities!.nodes.find(n => n.id === id)!.prerequisites.all) {
    learnParents(world, life, parent);
    life.capabilities!.learned[parent] = { age: life.age - 1, year: life.year - 1 };
  }
}
function work(world: WorldPack, life: LifeStateWithDemo, node: string) {
  learnParents(world, life, node);
  const receipt = applyFarmWork(world, life, node);
  assert.equal(receipt.complete, false, "work is never proved by the click");
  settle(world, life);
}
const cashTotal = (life: LifeStateWithDemo) => life.economy!.cash + Object.values(life.vocations!.accounts).reduce((a, b) => a + b, 0) + life.demo.town.merchant.cash;

test("farming proof waits for an actual seeded, reconciled annual harvest", () => {
  const { world, life } = fixture();
  const before = life.demo.household.grain;
  applyFarmWork(world, life, "F1");
  assert.equal(life.demo.household.grain, before - 20);
  assert.equal(farmProofProgress(world, life, "F1").complete, false);
  assert.equal(life.capabilities!.learned.F1, undefined);
  settle(world, life);
  const receipt = life.capabilities!.evidence.find(e => e.kind === "farm-settlement")!;
  assert.equal(receipt.data.fullSeed, true);
  assert.equal(receipt.data.reconciled, true);
  assert.equal(receipt.data.fullRations, true);
  assert.equal(farmProofProgress(world, life, "F1").complete, true);
});

test("missing seed or maintenance money rejects before changing the candidate", () => {
  const { world, life } = fixture();
  life.demo.household.grain = 0;
  const before = structuredClone(life);
  assert.match(farmWorkReason(world, life, "F3W")!, /seed/);
  assert.throws(() => applyFarmWork(world, life, "F3W"), /seed/);
  assert.deepEqual(life, before);
  life.demo.household.grain = 100;
  life.economy!.cash = 0;
  const poor = structuredClone(life);
  assert.throws(() => applyFarmWork(world, life, "F3W"), /16 dr/);
  assert.deepEqual(life, poor);
});

test("paid channels change the low-flood factor and every fee has a recipient", () => {
  const { world, life } = fixture();
  learnParents(world, life, "F3W");
  life.capabilities!.learned.F3W = { age: 19, year: -331 };
  life.demo.year.flood = "low";
  const ordinary = householdView(world.demo!, life).expectedHarvest;
  const before = cashTotal(life);
  applyFarmWork(world, life, "F3W");
  assert.equal(cashTotal(life), before);
  const maintained = householdView(world.demo!, life).expectedHarvest;
  assert.ok(maintained > ordinary);
  const cash = life.economy!.cash;
  settle(world, life);
  assert.equal(life.economy!.cash, cash, "the annual ledger does not charge the plan twice");
  assert.equal(farmProofProgress(world, life, "F3W").complete, true);
});

test("both crop allocation proof years need distinct fully seeded single crops", () => {
  const { world, life } = fixture();
  learnParents(world, life, "FC8");
  work(world, life, "FC8");
  work(world, life, "FC8");
  assert.equal(farmProofProgress(world, life, "FC8").done, 1, "two grain plans are one crop type");
  applyPlan(ctx(world, life), { type: "plan", flaxPlots: life.demo.household.plots });
  const seedBefore = life.vocations!.inventory["flax-seed"];
  work(world, life, "FC8");
  assert.equal(life.vocations!.inventory["flax-seed"], seedBefore - 4);
  assert.equal(farmProofProgress(world, life, "FC8").complete, true);
  assert.throws(() => applyPlan(ctx(world, life), { type: "plan", flaxPlots: 1 }), /Crop allocation/);
  life.capabilities!.learned.FC8 = { age: life.age, year: life.year };
  applyPlan(ctx(world, life), { type: "plan", flaxPlots: 1 });
  assert.equal(life.demo.household.flaxPlots, 1);
});

test("storage extension debits materials and cash once and needs paid annual upkeep", () => {
  const { world, life } = fixture();
  learnParents(world, life, "FR7");
  work(world, life, "FR7");
  assert.equal(farmProofProgress(world, life, "FR7").complete, true);
  life.capabilities!.learned.FR7 = { age: life.age, year: life.year };
  const wood = life.vocations!.inventory.timber, clay = life.vocations!.inventory.clay;
  const total = cashTotal(life);
  applyFarmWork(world, life, "FR7");
  assert.equal(life.vocations!.inventory.timber, wood - 4);
  assert.equal(life.vocations!.inventory.clay, clay - 5);
  assert.equal(cashTotal(life), total);
  assert.equal(householdView(world.demo!, life).capacity, life.demo.household.capacity + 500);
  const cash = life.economy!.cash;
  settle(world, life);
  assert.equal(life.economy!.cash, cash - 4);
  const builtWood = life.vocations!.inventory.timber;
  applyFarmWork(world, life, "FR7");
  assert.equal(life.vocations!.inventory.timber, builtWood, "inspection does not build a second extension");
  life.economy!.cash = 0;
  assert.equal(householdView(world.demo!, life).capacity, life.demo.household.capacity);
});

test("food and seed reserves reject ordinary sales and allow an explicit override", () => {
  const { world, life } = fixture();
  life.capabilities!.learned.F2 = { age: 19, year: -331 };
  life.capabilities!.learned.FR6 = { age: 19, year: -331 };
  const reserve = farmReserve(world, life);
  assert.ok(reserve > 20);
  life.demo.household.grain = reserve + 10;
  const order = { type: "trade" as const, item: "grain" as const, side: "sell" as const, quantity: 11, counterparty: "merchant" as const };
  assert.match(farmSaleReason(world, life, 11)!, /protected/);
  assert.match(tradeReason(world.demo!, life, order)!, /protected/);
  const before = structuredClone(life);
  assert.throws(() => executeTrade(ctx(world, life), order), /protected/);
  assert.deepEqual(life, before);
  assert.equal(tradeReason(world.demo!, life, { ...order, reserveOverride: true }), undefined);
  executeTrade(ctx(world, life), { ...order, reserveOverride: true });
  assert.equal(life.demo.household.grain, before.demo.household.grain - 11);
});

test("cultivation mastery requires two real integrated years, not repeated settlement calls", () => {
  const { world, life } = fixture();
  work(world, life, "FC10");
  assert.equal(farmProofProgress(world, life, "FC10").complete, false);
  settleFarmCapabilities(world, life, life.age - 1);
  assert.equal(farmProofProgress(world, life, "FC10").done, 1);
  work(world, life, "FC10");
  assert.equal(farmProofProgress(world, life, "FC10").complete, true);
});

test("resilience mastery requires three consecutive fully fed, seed-reserved work years", () => {
  const { world, life } = fixture();
  work(world, life, "FR10"); work(world, life, "FR10");
  assert.equal(farmProofProgress(world, life, "FR10").done, 2);
  work(world, life, "F1");
  work(world, life, "FR10"); work(world, life, "FR10");
  assert.equal(farmProofProgress(world, life, "FR10").complete, false, "a gap resets the consecutive assessment");
  work(world, life, "FR10");
  assert.equal(farmProofProgress(world, life, "FR10").complete, true);
});

test("every Farming node has a qualifying real-settlement route", () => {
  for (const node of design.nodes.filter(node => node.branch === "Farming")) {
    const { world, life } = fixture();
    learnParents(world, life, node.id);
    if (node.id === "FC8") {
      work(world, life, node.id);
      life.demo.household.flaxPlots = life.demo.household.plots;
      work(world, life, node.id);
    } else {
      for (let i = 0; i < 3 && !farmProofProgress(world, life, node.id).complete; i++) work(world, life, node.id);
    }
    assert.equal(farmProofProgress(world, life, node.id).complete, true, `${node.id} is attainable through real harvest work`);
  }
});

test("worlds without capabilities retain exactly the old household settlement", () => {
  const a = fixture(), b = fixture();
  delete a.world.capabilities; delete a.life.capabilities;
  delete b.world.capabilities; delete b.life.capabilities;
  a.life.vocations!.inventory["flax-seed"] = 0;
  b.life.vocations!.inventory["flax-seed"] = 100;
  const seedA = a.life.demo.household.grain;
  settle(a.world, a.life); settle(b.world, b.life);
  assert.deepEqual(a.life.demo, b.life.demo);
  assert.deepEqual(a.life.journal, b.life.journal);
  assert.ok(a.life.demo.household.grain > seedA, "old worlds were not charged new seed inputs");
  assert.equal(a.life.capabilities, undefined);
});


test("contingency plans respect merchant stock and cash, with no new debt", () => {
  const { world, life } = fixture();
  learnParents(world, life, "FR9");
  life.capabilities!.learned.FR9 = { age: 19, year: -331 };
  life.demo.household.grain = 100;
  life.demo.town.merchant.grain = 30;
  life.demo.town.prices.grain.sell = 2;
  const before = cashTotal(life), debt = life.economy!.debt;
  applyFarmWork(world, life, "FR9");
  assert.equal(life.demo.town.merchant.grain, 0);
  assert.equal(life.demo.household.grain, 100 + 30 - 20);
  assert.equal(life.economy!.debt, debt);
  assert.equal(cashTotal(life), before);
  const plan = life.capabilities!.evidence.find(e => e.kind === "farm-plan")!;
  assert.equal(plan.data.contingencyBought, 30);
  assert.equal(plan.data.contingencyCost, 60);
});

test("all farming view and progress reads leave state and random streams untouched", () => {
  const { world, life } = fixture();
  life.capabilities!.learned.FR5 = { age: 19, year: -331 };
  const before = structuredClone(life);
  householdView(world.demo!, life);
  farmReserve(world, life); farmWorkReason(world, life, "F3W"); farmProofProgress(world, life, "FR10");
  assert.deepEqual(life, before);
});


test("new debt after a reserve assessment begins cannot count as debt-free resilience proof", () => {
  const { world, life } = fixture();
  learnParents(world, life, "FR10");
  applyFarmWork(world, life, "FR10");
  life.economy!.debt += 10;
  settle(world, life);
  assert.equal(farmProofProgress(world, life, "FR10").done, 0);
  assert.equal(life.capabilities!.evidence.find(e => e.kind === "farm-settlement")!.data.debtIncreased, true);
});

test("without seed in store, a new-world field is sown with seed borrowed from the royal granary and repaid from the harvest, never free", () => {
  const { world, life } = fixture();
  life.demo.household.grain = 0;
  life.economy!.cash = 0;
  life.demo.town.merchant.grain = 0;
  settle(world, life);
  const ledger = life.capabilities!.evidence.find(e => e.kind === "farm-ledger")!;
  const loan = Number(/borrows (\d+) measures/.exec(life.journal.find(e => e.id === "household-seed-loan")!.text)![1]);
  assert.equal(ledger.data.grainSeedBps, 10_000, "the field is fully sown");
  assert.ok(Number(ledger.data.grainHarvest) > loan, "it grows a harvest");
  assert.ok(life.journal.some(e => e.id === "household-seed-loan-repaid"), "the loan goes back from that harvest");
  assert.ok(Number(ledger.data.rent) >= loan, "the repaid seed leaves the store with the rent");
  const settlement = life.capabilities!.evidence.find(e => e.kind === "farm-settlement");
  assert.equal(settlement?.data.reconciled ?? true, true, "the store's ledger still balances");
});


test("master farmer appointments keep their field labour, and civilian farm work happens at home", () => {
  const { world, life } = fixture();
  life.demo.household.parents = "gone";
  life.character!.jobId = "master-cultivator";
  assert.ok(householdView(world.demo!, life).expectedHarvest > 0);
  life.character!.jobId = "tailor";
  assert.equal(householdView(world.demo!, life).expectedHarvest, 0);
  applyFarmWork(world, life, "F1");
  life.vocations!.workedAge = life.age;
  assert.ok(householdView(world.demo!, life).expectedHarvest > 0, "the annual fieldwork action supplies household labour rather than taking the player away");
});

test("ordinary engine actions earn farming nodes only after settlement and replay exactly", async () => {
  const { buildCapabilityWorld } = await import("../src/vocations/capability-world.ts");
  const { createEngine } = await import("../src/engine.ts");
  const { TRADE_ITEMS } = await import("../src/demo/types.ts");
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  delete world.knowledge;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  delete world.health!.mortalityCalibration;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(e => interrupts.has(e.id));
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const stat of Object.values(world.stats)) delete stat.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 90;
  world.origins = [{ id: "farm-fixture", title: "Farm fixture", text: "A deterministic household ledger.", weight: 1, effects: [] }];
  world.demo!.startingResources = { defaults: Object.fromEntries(TRADE_ITEMS.map(item => [item, { min: item === "grain" ? 2000 : 0, max: item === "grain" ? 2000 : 0 }])) as NonNullable<NonNullable<WorldPack["demo"]>["startingResources"]>["defaults"] };
  world.stats.wealth.initial = 1000 / world.economy!.unitsPerPoint;
  const engine = createEngine(world);
  let life = engine.start("farm-engine-replay");
  while (life.age < 12) life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  life = engine.act(life, "cap-work-f1");
  assert.equal(life.capabilities!.learned.F1, undefined);
  life = engine.advance(life);
  assert.ok(life.capabilities!.learned.F1);
  life = engine.act(life, "cap-work-f2");
  assert.equal(life.capabilities!.learned.F2, undefined);
  life = engine.advance(life);
  assert.ok(life.capabilities!.learned.F2);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});


test("crop-scaled farming preserves ordinary and dense seed ratios without scaling flax seed units", () => {
  const { world, life } = fixture();
  assert.equal(ordinarySeedGrain(life, world.demo), 20, "retained worlds keep original seed quantities");
  world.demo!.resourceScaleDivisor = 10;
  assert.equal(ordinarySeedGrain(life, world.demo), 2);
  assert.equal(farmWorkQuote(world, life, "F1").grainSeed, 2);
  life.capabilities!.learned.FC5 = { age: 19, year: -331 };
  assert.equal(farmWorkQuote(world, life, "FC5").grainSeed, 4);
  life.demo.household.flaxPlots = 2;
  assert.equal(farmWorkQuote(world, life, "FC5").flaxSeed, 4, "purchased flax seed packets remain discrete units");
});

test("crop-scaled harvest proofs retain full rations and use a proportional reserve threshold", () => {
  const { world, life } = fixture();
  world.demo!.resourceScaleDivisor = 10;
  Object.assign(world.demo!.household, { yieldPerPlot: 65, flaxPerPlot: 12, adultRation: 24, storeCapacity: 150, animalFeed: { ox: 12, donkey: 6 } });
  life.demo.household.grain = 50;
  life.demo.household.capacity = 150;
  work(world, life, "FR5");
  const receipt = life.capabilities!.evidence.find(e => e.kind === "farm-settlement")!;
  assert.equal(receipt.data.seedPaid, 2);
  assert.equal(receipt.data.fullRations, true);
  assert.equal(receipt.data.reconciled, true);
  assert.ok(life.demo.household.grain >= 24 && life.demo.household.grain < 240);
  assert.equal(farmProofProgress(world, life, "FR5").complete, true);
});

test("store extensions and household previews use the opted-in crop capacity scale", () => {
  const { world, life } = fixture();
  life.capabilities!.farm = { extension: true } as NonNullable<typeof life.capabilities>["farm"];
  assert.equal(farmCapacityBonus(life, life.age, world.demo), 500);
  world.demo!.resourceScaleDivisor = 10;
  assert.equal(farmCapacityBonus(life, life.age, world.demo), 50);
  assert.equal(householdView(world.demo!, life).capacity, life.demo.household.capacity + 50);
});
