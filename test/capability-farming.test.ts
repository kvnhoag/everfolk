import assert from "node:assert/strict";
import test from "node:test";
import { demoEngine } from "./fixtures/demo/world.ts";
import { createEngine } from "../src/engine.ts";
import { buildDeepSkillWorld } from "../src/capabilities/world.ts";
import sourceWorld from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import { demoContext } from "../src/demo/state.ts";
import { initialVocations } from "../src/vocations/engine.ts";
import { CAPABILITY_RULES } from "../src/capabilities/rules.ts";
import { annualHouseholdRations, capabilityFarmPlan, capabilityFarmSettlementFacts, capabilityStoreCapacity, prepareCapabilityFarmSettlement } from "../src/capabilities/farming.ts";
import { applyPlan, harvest, payRent, feedHousehold, spoilAndSpin, householdView, labourUnits } from "../src/demo/household.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const legacyEngine = demoEngine();
function through(id: string): string[] {
  const ids = new Set<string>(); const visit = (key: string) => { if (ids.has(key)) return; const rule = CAPABILITY_RULES.find(rule => rule.id === key)!; for (const parent of rule.prerequisites.all) visit(parent); ids.add(key); }; visit(id); return [...ids];
}
function fixture(learned: string[] = [], deep = true) {
  const world = structuredClone(legacyEngine.world) as WorldPack;
  if (deep) world.capabilities = { version: "deep-1", rules: structuredClone([...CAPABILITY_RULES]) };
  world.vocations = { materials: { "flax-seed": { price: 2, stock: 100 } }, recipes: {}, actions: {}, accounts: { merchant: 1000, workshop: 1000, school: 1000, council: 1000 }, demand: {} };
  const h = world.demo!.household;
  h.yieldPerPlot = 1000; h.flaxPerPlot = 100; h.skillBonusBps = 0; h.oxBonusBps = 0; h.rentBps = 0; h.spoilageBps = 0; h.overCapacitySpoilageBps = 0; h.flaxPerLinen = 0;
  h.reckoningSpoilageCutBpsPerPoint = 0; h.reckoningSpoilageCutCapBps = 0;
  const life = structuredClone(legacyEngine.start("deep-farming")) as LifeStateWithDemo;
  life.age = 30; life.year = -320; life.character!.jobId = "tenant-farmer"; life.character!.relationshipStatus = "single"; life.character!.children = [];
  life.vocations = initialVocations(world.vocations); life.economy!.cash = 100;
  life.capabilities = { learned: Object.fromEntries(learned.map(id => [id, { year: -321, evidenceIds: [] }])), evidence: [] };
  Object.assign(life.demo.household, { parents: "gone", headSinceAge: 20, plots: 2, flaxPlots: 0, grain: 100, flax: 0, capacity: 1000, harvestBonusBps: 0, lastShortfallBps: 0 });
  life.demo.household.animals = { ox: 0, donkey: 0 }; life.demo.year.flood = "normal";
  const lines: { id: string; text: string }[] = [];
  const ctx = demoContext(world, life, effects => { for (const effect of effects) { if (effect.type === "stat") life.stats[effect.stat] += effect.delta; if (effect.type === "cash") life.economy!.cash += effect.delta; } }, (id, text) => lines.push({ id, text }));
  return { world, life, ctx, lines };
}

test("sowing debits actual grain seed exactly once and creates no cash or stock", () => {
  const f = fixture(); const cash = f.life.economy!.cash, accounts = structuredClone(f.life.vocations!.accounts);
  prepareCapabilityFarmSettlement(f.ctx); prepareCapabilityFarmSettlement(f.ctx);
  assert.equal(f.life.demo.household.grain, 80);
  assert.equal(f.life.vocations!.capabilityWork!.farmPlan!.grainSeed, 20);
  harvest(f.ctx);
  assert.equal(f.life.demo.household.grain, 1080);
  assert.equal(f.life.economy!.cash, cash); assert.deepEqual(f.life.vocations!.accounts, accounts);
  assert.equal(capabilityFarmSettlementFacts(f.world, f.life)!.ledgerReconciled, true);
});

test("missing seed gives fallow land and partial seed reduces the actually productive share", () => {
  const empty = fixture(); empty.life.demo.household.grain = 0; harvest(empty.ctx);
  assert.equal(empty.life.demo.household.grain, 0);
  assert.equal(capabilityFarmPlan(empty.world, empty.life)!.fullSeedAllocation, false);
  const partial = fixture(); partial.life.demo.household.grain = 10; harvest(partial.ctx);
  assert.equal(partial.life.demo.household.grain, 500);
  assert.equal(partial.life.vocations!.capabilityWork!.farmPlan!.grainSeed, 10);
  assert.equal(capabilityFarmPlan(partial.world, partial.life)!.grainSeedRatioBps, 5000);
});

test("flax requires purchased seed and consumes matching inventory lots without inventing inputs", () => {
  const f = fixture(); f.life.demo.household.flaxPlots = 2;
  f.life.vocations!.inventory["flax-seed"] = 2; f.life.vocations!.lots.push({ item: "flax-seed", quality: 1, quantity: 2 });
  harvest(f.ctx);
  assert.equal(f.life.demo.household.flax, 50);
  assert.equal(f.life.vocations!.inventory["flax-seed"], 0);
  assert.equal(f.life.vocations!.lots.find(lot => lot.item === "flax-seed")!.quantity, 0);
  assert.equal(capabilityFarmSettlementFacts(f.world, f.life)!.seedReserved, false);
});

test("preparatory farm work records real work but cannot receive an unlearned bonus", () => {
  const f = fixture(through("F2"));
  f.life.vocations!.workedAge = 29; f.life.vocations!.capabilityWork = { farmWorkAge: 29, farmPlan: { age: 29, mode: "soil-preparation", sowing: "ordinary", maintainChannels: false, planRecorded: true } };
  assert.equal(capabilityFarmPlan(f.world, f.life)!.grainBonusBps, 0);
  harvest(f.ctx); assert.equal(f.life.demo.household.grain, 1080);
  assert.equal(capabilityFarmSettlementFacts(f.world, f.life)!.preparedSoil, true);
  const learned = fixture(through("F3S"));
  learned.life.vocations!.workedAge = 29; learned.life.vocations!.capabilityWork = { farmWorkAge: 29, farmPlan: { age: 29, mode: "soil-preparation", sowing: "ordinary", maintainChannels: false, planRecorded: true } };
  harvest(learned.ctx); assert.equal(learned.life.demo.household.grain, 1130);
});

test("farm work restores only the player's labour, while other work leaves household helpers intact", () => {
  const farmer = fixture(), away = fixture();
  for (const f of [farmer, away]) { f.life.age = 29; f.life.demo.household.parents = "working"; f.life.vocations!.workedAge = 29; }
  farmer.life.vocations!.capabilityWork = { farmWorkAge: 29 };
  assert.equal(labourUnits(farmer.world.demo!, farmer.life, farmer.world), 300);
  assert.equal(labourUnits(away.world.demo!, away.life, away.world), 200);
});

test("learned integrated plans cap crop bonuses separately from paid low-flood correction", () => {
  const f = fixture(through("FC10")); f.life.demo.year.flood = "low";
  f.life.vocations!.capabilityWork = { farmWorkAge: 29, farmPlan: { age: 29, mode: "integrated", sowing: "conservative", maintainChannels: true, planRecorded: true, maintenancePaid: true, integratedPlan: true } };
  f.life.vocations!.workedAge = 29;
  const plan = capabilityFarmPlan(f.world, f.life)!;
  assert.equal(plan.grainBonusBps, 2000); assert.equal(plan.grainFloodBps, 6000);
  harvest(f.ctx); assert.equal(f.life.demo.household.grain, 800);
  const noPayment = fixture(through("FC10")); noPayment.life.demo.year.flood = "low";
  noPayment.life.vocations!.capabilityWork = { farmPlan: { age: 29, mode: "integrated", sowing: "ordinary", maintainChannels: true, planRecorded: true, maintenancePaid: false } };
  assert.equal(capabilityFarmPlan(noPayment.world, noPayment.life)!.grainFloodBps, noPayment.world.demo!.household.floodFactorBps.low);
});

test("resilience changes only in-capacity spoilage and retains earlier overflow reductions", () => {
  const f = fixture(through("FR10")); const h = f.world.demo!.household;
  h.spoilageBps = 800; h.overCapacitySpoilageBps = 2000; h.reckoningSpoilageCutBpsPerPoint = 100; h.reckoningSpoilageCutCapBps = 5000;
  f.life.character!.skills.reckoning = 50; f.life.demo.household.grain = 1500;
  spoilAndSpin(f.ctx);
  assert.equal(f.life.demo.household.grain, 1424); // 26 in-capacity + 50 overflow, never 35% off overflow.
});

test("store upkeep transfers four actual drachmas once and unavailable funds suspend only its extra capacity", () => {
  const paid = fixture(through("FR7")); paid.life.demo.household.capacity = 1500; paid.life.demo.household.plots = 0;
  paid.life.vocations!.capabilityWork = { storeExtended: true }; paid.life.economy!.cash = 4;
  const before = paid.life.vocations!.accounts.workshop;
  prepareCapabilityFarmSettlement(paid.ctx); prepareCapabilityFarmSettlement(paid.ctx);
  assert.equal(paid.life.economy!.cash, 0); assert.equal(paid.life.vocations!.accounts.workshop, before + 4);
  assert.equal(capabilityStoreCapacity(paid.world, paid.life), 1500);
  const missed = fixture(through("FR7")); missed.life.demo.household.capacity = 1500; missed.life.demo.household.plots = 0;
  missed.life.vocations!.capabilityWork = { storeExtended: true }; missed.life.economy!.cash = 3;
  const missedBudget = missed.life.vocations!.accounts.workshop;
  prepareCapabilityFarmSettlement(missed.ctx);
  assert.equal(capabilityStoreCapacity(missed.world, missed.life), 1000);
  assert.equal(missed.life.economy!.cash, 3); assert.equal(missed.life.vocations!.accounts.workshop, missedBudget);
});

test("free plans record unchanged allocations, allow single crops and gate coordinated mixtures", () => {
  const f = fixture(); const before = f.life.economy!.cash;
  applyPlan(f.ctx, { type: "plan", flaxPlots: 0 });
  assert.equal(f.life.vocations!.capabilityWork!.farmPlan!.planRecorded, true); assert.equal(f.life.economy!.cash, before);
  assert.throws(() => applyPlan(f.ctx, { type: "plan", flaxPlots: 1 }), /crop allocation/);
  applyPlan(f.ctx, { type: "plan", flaxPlots: 2 }); assert.equal(f.life.demo.household.flaxPlots, 2);
  const mixed = fixture(through("FC8")); applyPlan(mixed.ctx, { type: "plan", flaxPlots: 1 }); assert.equal(mixed.life.demo.household.flaxPlots, 1);
});

test("food purchased with cash is not misreported as grain drawn from stored reserves", () => {
  const f = fixture(through("FR9")); f.life.demo.household.plots = 0; f.life.demo.household.grain = 0; f.life.demo.year.flood = "low";
  f.life.economy!.cash = 10000; f.life.demo.town.merchant.grain = 10000;
  harvest(f.ctx); payRent(f.ctx); feedHousehold(f.ctx); spoilAndSpin(f.ctx);
  const facts = capabilityFarmSettlementFacts(f.world, f.life)!;
  assert.equal(facts.fullRations, true); assert.ok(facts.purchasedGrain > 0); assert.equal(facts.reserveGrainUsed, 0); assert.equal(facts.reservesUsed, false); assert.equal(facts.ledgerReconciled, true);
  const stored = fixture(through("FR9")); stored.life.demo.household.plots = 0; stored.life.demo.household.grain = 1000; stored.life.demo.year.flood = "low"; stored.life.economy!.cash = 0;
  harvest(stored.ctx); feedHousehold(stored.ctx); spoilAndSpin(stored.ctx);
  const actual = capabilityFarmSettlementFacts(stored.world, stored.life)!;
  assert.equal(actual.reservesUsed, true); assert.equal(actual.reserveGrainUsed, annualHouseholdRations(stored.world.demo!, stored.life));
});

test("archived worlds ignore every new farm flag, retain free old sowing and do not pay new upkeep", () => {
  const f = fixture(through("FR10"), false); f.life.vocations!.capabilityWork = { storeExtended: true };
  harvest(f.ctx); assert.equal(f.life.demo.household.grain, 1100); assert.equal(f.life.economy!.cash, 100);
  assert.equal(f.life.vocations!.capabilityWork!.farmPlan, undefined);
  assert.equal(capabilityFarmSettlementFacts(f.world, f.life), null);
  applyPlan(f.ctx, { type: "plan", flaxPlots: 1 }); assert.equal(f.life.demo.household.flaxPlots, 1);
  const preview = structuredClone(f.life); householdView(f.world.demo!, f.life, f.world); assert.deepEqual(f.life, preview);
});


test("farming settlement emits exact proof keys from recorded allocation and actual annual flows", () => {
  const f = fixture(through("F2"));
  f.life.age = 29; applyPlan(f.ctx, { type: "plan", flaxPlots: 0 }); f.life.age = 30;
  f.life.vocations!.workedAge = 29; f.life.vocations!.capabilityWork!.farmWorkAge = 29; f.life.vocations!.capabilityWork!.farmPlan!.mode = "soil-preparation";
  harvest(f.ctx); payRent(f.ctx); feedHousehold(f.ctx); spoilAndSpin(f.ctx);
  const facts = capabilityFarmSettlementFacts(f.world, f.life)!;
  assert.equal(facts.grainBefore, 100); assert.equal(facts.preparedSoil, true);
  assert.equal(facts.planRecorded, true); assert.equal(facts.plotsRecorded, true); assert.equal(facts.labourRecorded, true);
  assert.equal(facts.reconciled, true); assert.equal(facts.seedReserved, true); assert.equal(facts.cropPlan, "grain");
  const unrecorded = fixture(); harvest(unrecorded.ctx);
  assert.equal(capabilityFarmSettlementFacts(unrecorded.world, unrecorded.life)!.plotsRecorded, false);
});

test("grain and flax proof trials are available before mixed-crop coordination", () => {
  const grain = fixture(through("FC7")), flax = fixture(through("FC7"));
  for (const [f, flaxPlots] of [[grain, 0], [flax, 2]] as const) {
    f.life.demo.household.grain = 1000; f.life.vocations!.inventory["flax-seed"] = 8;
    f.life.age = 29; applyPlan(f.ctx, { type: "plan", flaxPlots }); f.life.age = 30;
    harvest(f.ctx); payRent(f.ctx); feedHousehold(f.ctx); spoilAndSpin(f.ctx);
  }
  const grainFacts = capabilityFarmSettlementFacts(grain.world, grain.life)!, flaxFacts = capabilityFarmSettlementFacts(flax.world, flax.life)!;
  assert.equal(grainFacts.cropPlan, "grain"); assert.equal(grainFacts.seedReserved, true); assert.equal(grainFacts.reconciled, true);
  assert.equal(flaxFacts.cropPlan, "flax"); assert.equal(flaxFacts.seedReserved, true); assert.equal(flaxFacts.reconciled, true);
  const fallow = fixture(); fallow.life.demo.household.plots = 0; harvest(fallow.ctx);
  assert.equal(capabilityFarmSettlementFacts(fallow.world, fallow.life)!.cropPlan, "fallow");
});


test("actual annual farm commands reach both farming masteries without injected learned nodes or receipts", () => {
  const world = buildDeepSkillWorld(sourceWorld as unknown as WorldPack);
  delete world.knowledge; delete world.demo!.startingResources; delete world.health!.mortalityCalibration;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => interrupts.has(event.id)); world.yearlyRules = []; world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  world.origins = [{ id: "farm-proof-household", title: "Established household", text: "Wealth and proficiency isolate real annual farming proofs.", weight: 1, effects: [] }];
  world.stats.wealth.initial = 100; world.stats.health.initial = 100;
  world.demo!.household.startingGrain = 15000; world.demo!.household.storeCapacity = 1000000;
  world.demo!.household.spoilageBps = 0;
  const engine = createEngine(world);
  const ready = (state: LifeState) => { while (state.phase === "choice") state = engine.choose(state, engine.getChoices(state)[0].id); return state; };
  const next = (state: LifeState) => ready(engine.advance(state));
  const work = (state: LifeState, id: string) => engine.act(state, `v-cap-${id}`);
  let life = engine.start("actual-farm-path"); while (life.age < 18) life = next(life);
  assert.deepEqual(life.capabilities!.learned, {});
  life = work(life, "fieldwork"); assert.ok(life.capabilities!.learned.F1);
  life = next(life); assert.ok(life.capabilities!.learned.F2);
  life = work(life, "soil-preparation"); life = next(life); assert.ok(life.capabilities!.learned.F3S);
  life = work(life, "channel-maintenance"); assert.ok(life.capabilities!.learned.F4); assert.ok(life.capabilities!.learned.FC5);
  for (let year = 0; year < 2; year++) { life = next(life); life = work(life, "crop-care"); }
  assert.ok(life.capabilities!.learned.FC6);
  life = next(life); life = engine.act(life, "v-buy-flax-seed"); life = work(life, "channel-maintenance");
  life = next(life); assert.ok(life.capabilities!.learned.FC7);
  life = engine.act(life, "v-buy-flax-seed");
  life = engine.demo(life, { type: "plan", flaxPlots: life.demo!.household.plots });
  life = work(life, "fieldwork"); life = next(life);
  assert.ok(life.capabilities!.learned.FC8); assert.ok(life.capabilities!.learned.FC9);
  life = engine.demo(life, { type: "plan", flaxPlots: 0 });
  for (let year = 0; year < 2; year++) { life = work(life, "integrated-plan"); life = next(life); if (year === 0) assert.equal(life.capabilities!.learned.FC10, undefined); }
  assert.ok(life.capabilities!.learned.FC10); assert.ok(life.capabilities!.learned.FR6);
  life = work(life, "store-inspection"); life = next(life); life = work(life, "stock-reconciliation");
  assert.ok(life.capabilities!.learned.FR7); assert.ok(life.capabilities!.learned.FR10);
  const receipts = life.capabilities!.evidence.filter(record => record.kind === "harvest");
  assert.ok(receipts.length >= 8);
  assert.ok(receipts.every(record => record.facts.plotsRecorded === true && record.facts.labourRecorded === true && record.facts.reconciled === true));
  assert.ok(receipts.some(record => record.facts.cropPlan === "grain")); assert.ok(receipts.some(record => record.facts.cropPlan === "flax"));
  assert.equal(life.economy!.debt, 0); assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
