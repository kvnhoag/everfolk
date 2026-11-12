import assert from "node:assert/strict";
import test from "node:test";
import base from "../worlds/demo/alexandria-lives-2.json" with { type:"json" };
import { buildDeepSkillWorld } from "../src/capabilities/world.ts";
import { createEngine } from "../src/engine.ts";
import { applyCapabilityAction, capabilityActionReason, deepInventory } from "../src/capabilities/actions.ts";
import { protectedGrain } from "../src/capabilities/runtime.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

// These fixtures isolate receipt and conservation invariants. Full earned paths
// through the engine are covered separately by capability-paths/world tests.
function fixture(nodes:string[]=[]){
  const world=buildDeepSkillWorld(base as unknown as WorldPack);
  const life=structuredClone(createEngine(world).start("action-invariants"));
  life.age=18;life.year+=18;life.economy!.cash=100000;
  life.character!.jobId=undefined;
  for(const id of Object.keys(life.character!.skills))life.character!.skills[id]=100;
  for(const node of nodes)life.capabilities!.learned[node]={year:life.year,evidenceIds:[]};
  for(const id of Object.keys(life.vocations!.accounts))life.vocations!.accounts[id as keyof typeof life.vocations.accounts]=100000;
  for(const id of Object.keys(life.vocations!.stock))life.vocations!.stock[id]=10000;
  for(const id of Object.keys(life.vocations!.demand))life.vocations!.demand[id]=10000;
  life.vocations!.inventory={};life.vocations!.lots=[];
  life.vocations!.capabilityWork={};
  life.demo!.household.grain=10000;life.demo!.household.flax=0;life.demo!.goods.linen=0;
  delete life.vocations!.workedAge;delete life.character!.lastActivityAge;
  return {world,life};
}
function next(life:LifeState){life.age++;life.year++;delete life.vocations!.workedAge;delete life.character!.lastActivityAge;}
const cashTotal=(life:LifeState)=>life.economy!.cash+Object.values(life.vocations!.accounts).reduce((sum,n)=>sum+n,0)+(life.vocations!.capabilityWork?.commission?.escrow??0);
function buyFor(world:WorldPack,life:LifeState,recipe:string,quantity=1){
  const r=world.vocations!.recipes[recipe];
  for(const [item,n]of Object.entries(r.inputs))while((deepInventory(life)[item]??0)<n*quantity)applyCapabilityAction(world,life,`buy-${item}`);
}
const artisan=["A1","A2","A3","A4"];

test("mentor wages debit a funded employer and reject unfunded work without mutation",()=>{
  const {world,life}=fixture();const before=cashTotal(life),cash=life.economy!.cash,budget=life.vocations!.accounts.workshop;
  applyCapabilityAction(world,life,"cap-tool-practice");
  assert.equal(life.economy!.cash,cash+12);assert.equal(life.vocations!.accounts.workshop,budget-12);assert.equal(cashTotal(life),before);
  assert.equal(life.capabilities!.evidence.at(-1)!.facts.supervised,true);
  assert.ok(life.capabilities!.learned.A1);
  const poor=fixture();poor.life.vocations!.accounts.workshop=11;
  const frozen=structuredClone(poor.life);
  assert.match(capabilityActionReason(poor.world,poor.life,"cap-tool-practice")!,/employer|fund/i);
  assert.throws(()=>applyCapabilityAction(poor.world,poor.life,"cap-tool-practice"),/fund|employer/i);
  assert.deepEqual(poor.life,frozen);
});

test("engine's already-marked activity does not reject its own major work",()=>{
  const {world,life}=fixture();life.character!.lastActivityAge=life.age;
  assert.match(capabilityActionReason(world,life,"cap-tool-practice")!,/year/i);
  applyCapabilityAction(world,life,"cap-tool-practice");
  assert.equal(life.vocations!.workedAge,life.age);
  assert.throws(()=>applyCapabilityAction(world,life,"cap-tool-practice"),/year/i);
});

test("orders protect the actual household ration reserve and preflight all money",()=>{
  const {world,life}=fixture(["FR6","T1","T2","T3","T4","T5"]);
  life.demo!.household.grain=protectedGrain(world,life)+19;
  assert.match(capabilityActionReason(world,life,"cap-delivery-order")!,/reserve|cargo/i);
  life.demo!.household.grain+=1;life.economy!.cash=11;
  const before=structuredClone(life);
  assert.match(capabilityActionReason(world,life,"cap-delivery-order")!,/12 dr/i);
  assert.throws(()=>applyCapabilityAction(world,life,"cap-delivery-order"),/12 dr/i);
  assert.deepEqual(life,before);
});

test("two delivery buyers pay from their own accounts and receive stock with exact haulage",()=>{
  const {world,life}=fixture(["T1","T2","T3","T4","T5"]);
  life.vocations!.capabilityWork!.tradeAcquisitionQuantity={grain:100};
  life.vocations!.capabilityWork!.tradeAcquisitionCost={grain:100};
  const conserved=cashTotal(life),beforeGrain=life.demo!.household.grain;
  for(const buyer of ["merchant","workshop"]as const){
    const budget=life.vocations!.accounts[buyer],shop=life.vocations!.accounts.workshop,cash=life.economy!.cash;
    applyCapabilityAction(world,life,"cap-delivery-order");
    const order=life.capabilities!.evidence.findLast(e=>e.action==="delivery-order")!;
    assert.equal(order.facts.buyerAccount,buyer);assert.equal(order.facts.haulage,12);
    assert.equal(life.economy!.cash,cash+Number(order.facts.payment)-12);
    assert.equal(life.vocations!.accounts[buyer],budget-Number(order.facts.payment)+(buyer==="workshop"?12:0));
    if(buyer==="merchant")assert.equal(life.vocations!.accounts.workshop,shop+12);
    assert.equal(life.capabilities!.evidence.at(-1)!.action,"fixed-price-order");
    assert.equal(cashTotal(life),conserved);next(life);
  }
  assert.equal(life.demo!.household.grain,beforeGrain-40);
  assert.equal(life.vocations!.capabilityWork!.tradeAcquisitionQuantity!.grain,60);
  assert.equal(life.vocations!.stock.grain,20);
  const stocks=(life.vocations!.capabilityWork as typeof life.vocations.capabilityWork&{buyerStock:{workshop:{grain:number}}}).buyerStock;
  assert.equal(stocks.workshop.grain,20);
});

test("inherited materials never become paid production inputs or a known sale margin",()=>{
  const {world,life}=fixture(["A1","A2","A3"]);
  life.demo!.goods.linen=2;life.vocations!.inventory.thread=2;life.vocations!.lots.push({item:"thread",quantity:2,quality:1});
  applyCapabilityAction(world,life,"make-garment");
  const produced=life.capabilities!.evidence.at(-1)!;
  assert.equal(produced.kind,"production");assert.equal(produced.facts.paidInputs,false);
  assert.equal(life.vocations!.capabilityWork!.tradeAcquisitionQuantity?.garment??0,0);
  applyCapabilityAction(world,life,"sell-garment");
  const sold=life.capabilities!.evidence.at(-1)!;
  assert.equal(sold.facts.costRecorded,false);assert.equal(sold.facts.realizedMargin,-1);
  assert.equal(deepInventory(life).garment,0);
});

test("commission escrow, actual production and paid inspection reconcile without minting cash",()=>{
  const {world,life}=fixture([...artisan,"AT5","AT6"]),before=cashTotal(life);
  applyCapabilityAction(world,life,"cap-commission-garment");
  assert.equal(cashTotal(life),before);
  assert.throws(()=>applyCapabilityAction(world,life,"cap-deliver-commission"),/products|enough|grade/i);
  buyFor(world,life,"garment");applyCapabilityAction(world,life,"make-garment");
  assert.equal(life.capabilities!.evidence.findLast(e=>e.action==="garment")!.facts.inspectionAccepted,false);
  const cash=life.economy!.cash,shop=life.vocations!.accounts.workshop,escrow=life.vocations!.capabilityWork!.commission!.escrow;
  applyCapabilityAction(world,life,"cap-deliver-commission");
  assert.equal(life.economy!.cash,cash+escrow-3);assert.equal(life.vocations!.accounts.workshop,shop+3);
  const receipt=life.capabilities!.evidence.findLast(e=>e.kind==="production"&&e.action==="commission-delivery")!;
  assert.equal(receipt.facts.inspectionFee,3);assert.equal(receipt.facts.inspectionAccepted,true);assert.equal(receipt.facts.paymentRecorded,true);
  assert.equal(receipt.facts.paidInputs,true);assert.equal(life.vocations!.capabilityWork!.commission,undefined);
  assert.equal(cashTotal(life),before);
});

test("registered assessment filters purchases and rejects insufficient output before acceptance",()=>{
  const {world,life}=fixture([...artisan,"AT5","AT6","AT7","AT8","AT9"]);
  applyCapabilityAction(world,life,"cap-register-at10");
  const registration=structuredClone(life);
  assert.throws(()=>applyCapabilityAction(world,life,"cap-register-at10"),/registered|assessment/i);
  assert.deepEqual(life,registration);
  for(let i=0;i<2;i++){buyFor(world,life,"ceremonial-garment");applyCapabilityAction(world,life,"make-ceremonial-garment-inspected");next(life);}
  const before=structuredClone(life);
  assert.match(capabilityActionReason(world,life,"cap-submit-at10")!,/requirements/i);
  assert.throws(()=>applyCapabilityAction(world,life,"cap-submit-at10"),/requirements/i);
  assert.deepEqual(life,before);assert.equal(life.capabilities!.evidence.some(e=>e.kind==="assessment"),false);
  buyFor(world,life,"ceremonial-garment",4);applyCapabilityAction(world,life,"make-ceremonial-garment-4-inspected");
  applyCapabilityAction(world,life,"cap-submit-at10");
  const assessed=life.capabilities!.evidence.at(-1)!;
  assert.equal(assessed.kind,"assessment");assert.ok(life.capabilities!.learned.AT10);
  assert.ok(assessed.references!.length>=2);
  for(const ref of assessed.references!){const record=life.capabilities!.evidence.find(e=>e.id===ref)!;assert.equal(record.kind,"production");assert.equal(record.action,"ceremonial-garment");}
  assert.equal(life.vocations!.capabilityWork!.assessment,undefined);
});

test("unrelated stock work cannot assert inquiry, inspection or delivery proofs",()=>{
  const {world,life}=fixture();
  applyCapabilityAction(world,life,"cap-stock-reconciliation");
  const facts=life.capabilities!.evidence.at(-1)!.facts;
  for(const unrelated of ["independentCheck","inspectionAccepted","questionRecorded","delivered","fundedPlan"])assert.equal(facts[unrelated],undefined);
  assert.equal(facts.paidInputs,false);
});