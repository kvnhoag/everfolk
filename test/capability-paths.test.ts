import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildDeepSkillWorld } from "../src/capabilities/world.ts";
import base from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";

// These are engine reachability checks, not measurements of ordinary-life mastery rates.
// The authored fixture supplies high starting proficiency, food and capital; it never
// supplies learned capabilities, completion receipts, reputation or assessment evidence.
function fixture(seed: string) {
  const world = buildDeepSkillWorld(base as unknown as WorldPack);
  delete world.knowledge;
  delete world.demo!.startingResources;
  delete world.health!.mortalityCalibration;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => interrupts.has(event.id));
  world.yearlyEffects = []; world.yearlyRules = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  world.stats.health.initial = 100;
  world.stats.knowledge.initial = 80;
  world.stats.bonds.initial = 80;
  world.stats.wealth.max = 100000;
  world.stats.wealth.initial = 100000 / world.economy!.unitsPerPoint;
  world.demo!.household.startingGrain = 1000000;
  world.demo!.household.storeCapacity = 1000000;
  world.origins = [{ id: "path-fixture", title: "Path fixture", text: "High-proficiency mechanics fixture; every proof must still be earned.", weight: 1, effects: [] }];
  const engine = createEngine(world);
  let life = engine.start(seed);
  while (life.age < 18) life = next(engine, life);
  assert.deepEqual(life.capabilities!.learned, {});
  assert.equal(life.capabilities!.evidence.length, 0);
  return { engine, world, life };
}
function ready(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  assert.notEqual(life.phase, "dead");
  return life;
}
const next = (engine: LifeEngine, life: LifeState) => ready(engine, engine.advance(life));
const cap = (engine: LifeEngine, life: LifeState, id: string) => engine.act(life, `v-cap-${id.toLowerCase()}`);
const buy = (engine: LifeEngine, life: LifeState, item: string) => engine.act(life, `v-buy-${item}`);
function work(engine: LifeEngine, life: LifeState, id: string): LifeState {
  life = ready(engine, life);
  if (life.vocations!.workedAge === life.age || life.character!.lastActivityAge === life.age) life = next(engine, life);
  return cap(engine, life, id);
}
function foundation(engine: LifeEngine, life: LifeState): LifeState {
  for (const id of ["guided-reading", "argument-exercise", "evidence-comparison", "evidence-comparison", "reviewed-inquiry", "public-dilemma"]) life = work(engine, life, id);
  for (const id of ["P1", "P2", "P3", "P4"]) assert.ok(life.capabilities!.learned[id], `Missing philosophy foundation ${id}`);
  return life;
}
function learned(life: LifeState, ids: string[]): void {
  for (const id of ids) assert.ok(life.capabilities!.learned[id], `Missing earned capability ${id}`);
}
function assertDurable(engine: LifeEngine, life: LifeState): void {
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.ok(Object.isFrozen(life.capabilities!.learned));
}
function assessmentReferences(life: LifeState, node: string) {
  const receipt = life.capabilities!.evidence.find(record => record.action === `assess-${node}`)!;
  assert.ok(receipt, `No accepted assessment receipt for ${node}`);
  const referenced = life.capabilities!.evidence.filter(record => receipt.references?.includes(record.id));
  assert.ok(new Set(referenced.map(record => record.year)).size >= 2);
  assert.ok(referenced.every(record => record.group === receipt.group && record.successful));
  return { receipt, referenced };
}

test("Research PS10 is reachable through paid inquiry, independent checks and two registered work years", () => {
  const { engine, life: initial } = fixture("actual-research-path");
  let life = foundation(engine, initial);
  for (const id of ["observation-project", "observation-project", "measurement-calculation", "measurement-calculation", "test-explanation", "independent-check", "independent-check", "research-synthesis"]) life = work(engine, life, id);
  learned(life, ["PS5", "PS6", "PS7", "PS8", "PS9"]);
  assert.equal(life.capabilities!.learned.PS10, undefined);
  life = cap(engine, life, "register-PS10");
  const registeredYear = life.year;
  const before = JSON.stringify(life);
  assert.throws(() => cap(engine, life, "submit-PS10"), /work|year|evidence/i);
  assert.equal(JSON.stringify(life), before);
  life = work(engine, life, "original-inquiry");
  assert.equal(life.capabilities!.learned.PS10, undefined);
  assert.throws(() => cap(engine, life, "submit-PS10"), /work|year|evidence/i);
  life = work(engine, life, "original-inquiry");
  life = cap(engine, life, "submit-PS10");
  learned(life, ["PS10"]);
  const { receipt, referenced } = assessmentReferences(life, "PS10");
  assert.ok(referenced.every(record => record.action === "original-inquiry" && record.year >= registeredYear));
  assert.equal(new Set(referenced.map(record => record.facts.datasetId)).size, 2);
  assert.ok(referenced.some(record => record.facts.independentCheck === true));
  assert.equal(receipt.facts.questionRecorded, true);
  assert.equal(receipt.facts.conclusionRecorded, true);
  assert.ok(life.economy!.cash < initial.economy!.cash);
  assert.equal(initial.capabilities!.evidence.length, 0);
  assertDurable(engine, life);
});

test("Civic PP10 is reachable through funded services, reviewed policy and earned public reputation", () => {
  const { engine, life: initial } = fixture("actual-civic-path");
  let life = foundation(engine, initial);
  for (const id of ["public-address", "public-address", "negotiate-agreement", "negotiate-agreement", "public-budget", "public-service", "coalition-agreement", "coalition-agreement", "policy-project", "policy-project"]) life = work(engine, life, id);
  learned(life, ["PP5", "PP6", "PP7", "PP8", "PP9"]);
  // The public-trust gate is earned by funded services rather than set on the life.
  for (let attempts = 0; life.demo!.reputation < 60 && attempts < 30; attempts++) {
    life = work(engine, life, "public-budget");
    life = work(engine, life, "public-service");
  }
  assert.ok(life.demo!.reputation >= 60);
  assert.equal(life.capabilities!.learned.PP10, undefined);
  life = cap(engine, life, "register-PP10");
  const councilBefore = life.vocations!.accounts.council;
  life = work(engine, life, "policy-project");
  assert.equal(life.capabilities!.learned.PP10, undefined);
  assert.throws(() => cap(engine, life, "submit-PP10"), /work|year|evidence/i);
  life = work(engine, life, "policy-project");
  life = cap(engine, life, "submit-PP10");
  learned(life, ["PP10"]);
  const { receipt, referenced } = assessmentReferences(life, "PP10");
  assert.ok(referenced.every(record => record.action === "policy-work" && record.facts.reconciled === true));
  for (const fact of ["fundedPlan", "agreementSecured", "delivered"]) assert.equal(receipt.facts[fact], true);
  assert.ok(life.vocations!.accounts.council < councilBefore);
  assert.ok(life.demo!.reputation > initial.demo!.reputation);
  assertDurable(engine, life);
});

function buyGrain(engine: LifeEngine, life: LifeState): LifeState {
  return engine.demo(life, { type: "trade", item: "grain", side: "buy", quantity: 20, counterparty: "merchant" });
}
function shippingYear(engine: LifeEngine, life: LifeState, id: string): LifeState {
  if (life.vocations!.workedAge === life.age || life.character!.lastActivityAge === life.age) life = next(engine, life);
  life = buyGrain(engine, life);
  return cap(engine, life, id);
}
function makeGarment(engine: LifeEngine, life: LifeState): LifeState {
  if (life.vocations!.workedAge === life.age || life.character!.lastActivityAge === life.age) life = next(engine, life);
  life = buy(engine, life, "linen"); life = buy(engine, life, "thread");
  return engine.act(life, "v-make-garment");
}

test("Trade T10 is reachable through actual purchases, profitable sales and funded deliveries to two buyers", () => {
  const { engine, life: initial } = fixture("actual-trade-path");
  let life = initial;
  life = buy(engine, life, "clay"); life = buy(engine, life, "papyrus"); life = buy(engine, life, "ink");
  learned(life, ["T1"]);
  life = work(engine, life, "cost-basket");
  life = work(engine, life, "price-comparison");
  assert.equal(life.capabilities!.learned.T3, undefined);
  life = work(engine, life, "price-comparison");
  life = work(engine, life, "stock-reconciliation");
  life = work(engine, life, "stock-reconciliation");
  learned(life, ["T2", "T3", "T4"]);
  for (let year = 0; year < 2; year++) life = shippingYear(engine, life, "supply-plan");
  learned(life, ["T5"]);
  // The delivery job records its funded fixed-price agreement and completed delivery.
  for (let year = 0; year < 2; year++) life = shippingYear(engine, life, "delivery-order");
  learned(life, ["T6", "T7"]);
  // Manufacture the sale stock through the ordinary supervised workshop path.
  life = work(engine, life, "tool-practice");
  life = work(engine, life, "measurement-exercise");
  life = buy(engine, life, "flax");
  life = work(engine, life, "prepare-textiles"); life = work(engine, life, "prepare-textiles");
  life = makeGarment(engine, life); life = makeGarment(engine, life);
  learned(life, ["A4"]);
  for (let year = 0; year < 2; year++) {
    life = next(engine, life);
    life = engine.act(life, "v-sell-garment");
    life = cap(engine, life, "trading-year");
  }
  learned(life, ["T8"]);
  for (let year = 0; year < 2; year++) life = shippingYear(engine, life, "enterprise-contract");
  learned(life, ["T9"]);
  assert.equal(life.capabilities!.learned.T10, undefined);
  life = cap(engine, life, "register-T10");
  life = shippingYear(engine, life, "enterprise-contract");
  assert.throws(() => cap(engine, life, "submit-T10"), /work|year|evidence/i);
  life = shippingYear(engine, life, "enterprise-contract");
  life = cap(engine, life, "submit-T10");
  learned(life, ["T10"]);
  const { referenced } = assessmentReferences(life, "T10");
  assert.equal(new Set(referenced.map(record => record.facts.buyerAccount)).size, 2);
  assert.ok(referenced.every(record => record.kind === "contract" && record.facts.paymentRecorded === true && record.facts.paidInputs === true));
  const sales = life.capabilities!.evidence.filter(record => record.action === "sale");
  assert.equal(sales.length, 2);
  assert.ok(sales.every(record => Number(record.facts.realizedMargin) > 0 && record.facts.costRecorded === true));
  assertDurable(engine, life);
});
