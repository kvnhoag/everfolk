import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack, LifeEngine } from "../src/types.ts";
import { buildCapabilityWorld } from "../src/vocations/capability-world.ts";
import { capabilityView } from "../src/capabilities/view.ts";
import { validateWorld } from "../src/validate.ts";
import { CAPABILITY_NODES } from "../src/capabilities/catalog.ts";
import { artisanLimits, productionQuote } from "../src/capabilities/production.ts";
import { workQuote } from "../src/capabilities/work.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };

function fixture() {
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  for (const event of world.events) { event.when = { type: "age", op: "gte", value: 1000 }; event.maxOccurrences = 1; }
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  delete world.health!.mortalityCalibration;
  delete world.eventPacing; delete world.character!.encounterPacing;
  world.yearlyRules = []; world.yearlyEffects = [];
  // An authored adult-expertise fixture isolates proofs from training and survival balance.
  for (const skill of Object.values(world.character!.skills)) skill.initial = 90;
  world.stats.wealth.max = 10000;
  world.stats.wealth.initial = 10000 / world.economy!.unitsPerPoint;
  for (const stat of Object.values(world.stats)) delete stat.initialRange;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = {}; }
  delete world.demo!.startingResources;
  world.demo!.household.startingGrain = 12000; world.demo!.household.storeCapacity = 20000;
  return createEngine(world);
}
function parents(target: string): string[] {
  const result: string[] = [];
  function visit(id: string) { for (const parent of CAPABILITY_NODES.find(n=>n.id===id)!.prerequisites.all) visit(parent); if(!result.includes(id)) result.push(id); }
  visit(target); return result;
}
function progress(engine: LifeEngine, target: string) {
  let life=engine.start(`proof-${target}`);
  while(life.age<12)life=engine.advance(life);
  const path=parents(target);
  for(let turn=0;turn<65 && !life.capabilities!.learned[target];turn++) {
    const next=path.find(id=>!life.capabilities!.learned[id])!;
    if(next==='FC8') {
      const grainDone=life.capabilities!.evidence.some(e=>e.nodeId===next&&e.kind==='farm-settlement'&&e.data.qualifies&&e.data.crop==='grain');
      life=engine.demo(life,{type:'plan',flaxPlots:grainDone?life.demo!.household.plots:0});
      while(grainDone&&(life.vocations!.inventory['flax-seed']??0)<8)life=engine.act(life,'v-buy-flax-seed');
    } else if(life.demo!.household.flaxPlots)life=engine.demo(life,{type:'plan',flaxPlots:0});
    const workNode=next==='PP10'&&life.demo!.reputation<60?'PP8':next;
    const action=engine.getActivities(life).find(a=>a.id===`cap-work-${workNode.toLowerCase()}`)!;
    assert.equal(action.available,true,`${target}/${next}: ${action.reason}`);
    life=engine.act(life,action.id);
    if(!life.capabilities!.learned[target])life=engine.advance(life);
  }
  assert.ok(life.capabilities!.learned[target],`${target} reachable through actual proof work`);
  return life;
}

test("all eight mastery paths can be earned with real accepted work and exact replay", () => {
  for(const target of ['FC10','FR10','AT10','AC10','AS10','PS10','PP10','T10']) {
    const engine=fixture(),life=progress(engine,target);
    assert.deepEqual(engine.replay(life.seed,life.commands),life);
    assert.deepEqual(engine.load(engine.save(life)),life);
    assert.ok(life.capabilities!.evidence.filter(e=>e.nodeId===target).length>0);
    assert.ok(Object.values(life.vocations!.accounts).every(n=>n>=0));
    assert.ok(Object.values(life.vocations!.inventory).every(n=>n>=0));
  }
});

test("every non-farming receipt reconciles real payments and stock", () => {
  for(const target of ['AT10','AC10','AS10','PS10','PP10','T10']) {
    const engine=fixture(),life=progress(engine,target);
    const records=life.capabilities!.evidence.filter(e=>e.kind!=='farm-ledger'&&e.kind!=='farm-plan'&&e.kind!=='farm-settlement');
    assert.ok(records.every(e=>e.data.reconciled===true && e.data.cashConserved===true));
    const last=records.at(-1)!;
    assert.equal(last.data.cashAtClosing,life.economy!.cash);
  }
});

test("the trading assessment reserves two paid orders and sends each to its buyer", () => {
  const engine=fixture(),life=progress(engine,'T10');
  const records=life.capabilities!.evidence.filter(e=>e.nodeId==='T10');
  assert.equal(records.length,2);
  assert.deepEqual(records.map(e=>e.data.payer),['merchant','council']);
  assert.deepEqual(records.map(e=>e.data.activeWorkYear),[1,2]);
  assert.equal(records[0].data.completedAssessment,false);
  assert.equal(records[1].data.completedAssessment,true);
  assert.equal(life.capabilities!.civicGrain,10);
  assert.equal(life.capabilities!.reservedPayment,0);
  assert.equal(life.capabilities!.project,undefined);
  assert.equal(records[0].data.reservedGrain,10);
  assert.equal(records[1].data.reservedGrain,0);
});

test("master artisan assessments reserve inputs once and wait for two work years",()=>{
  for(const target of ['AT10','AC10','AS10']) {
    const life=progress(fixture(),target),records=life.capabilities!.evidence.filter(e=>e.nodeId===target);
    assert.equal(records.length,2);
    assert.equal(records[0].data.completedAssessment,false);
    assert.equal(records[1].data.completedAssessment,true);
    assert.equal(records[1].data.materialsPaid,0);
    assert.equal(records[1].data.feePaid,0);
    assert.ok(Number(records[0].data.quality)>=4);
    assert.ok(Number(records[0].data.quantity)>0);
  }
});

test("viewing the whole atlas never changes any ledger or random stream",()=>{
  const engine=fixture(),life=engine.start('atlas-pure'),before=structuredClone(life);
  const view=capabilityView(engine.world,life);
  assert.equal(view.nodes.length,65);assert.deepEqual(life,before);
  assert.ok(view.nodes.every(n=>n.state==='locked'));
});

test("learned artisan rewards change actual production limits and material quotes",()=>{
  const engine=fixture(),tailor=progress(engine,'AT10'),potter=progress(engine,'AC10');
  assert.deepEqual(artisanLimits(tailor,'Clothing'),{quality:5,batch:12});
  assert.deepEqual(artisanLimits(potter,'Ceramics'),{quality:5,batch:16});
  assert.equal(productionQuote(engine.world,tailor,'garment',4).inputs.linen,7);
  assert.equal(productionQuote(engine.world,potter,'vessel',8).inputs.fuel,4);
});

test("assessment quotes reject unfunded buyers and missing upfront cash without changing a life",()=>{
  const engine=fixture();
  const trading=structuredClone(engine.advance(progress(engine,'T10')));
  trading.vocations!.accounts.council=0;
  const before=structuredClone(trading);
  assert.match(workQuote(engine.world,trading,'T10').reason!,/Both buyers/);
  assert.deepEqual(trading,before);
  const artisan=structuredClone(engine.advance(progress(engine,'AT10')));
  artisan.economy!.cash=0;
  assert.match(workQuote(engine.world,artisan,'AT10').reason!,/up front/);
});

test("a paused assessment retains its escrow and counts only active work years",()=>{
  const engine=fixture();
  let life=engine.advance(progress(engine,'AT10'));
  life=engine.act(life,'cap-work-at10');
  const reserved=life.capabilities!.reservedPayment,project=structuredClone(life.capabilities!.project);
  life=engine.advance(life);
  assert.match(engine.getActivities(life).find(a=>a.id==='v-make-thread')!.reason!,/registered capability/);
  life=engine.act(life,'v-practice-craft');
  life=engine.advance(life);
  assert.deepEqual(life.capabilities!.project,project);
  assert.equal(life.capabilities!.reservedPayment,reserved);
  life=engine.act(life,'cap-work-at10');
  assert.equal(life.capabilities!.project,undefined);
  assert.equal(life.capabilities!.reservedPayment,0);
  assert.deepEqual(engine.replay(life.seed,life.commands),life);
});

test("capability pack validation rejects unsupported graphs and accessors without reading them",()=>{
  const variants=[(w:WorldPack)=>{w.capabilities!.nodes[0].id='X1';},(w:WorldPack)=>{w.capabilities!.nodes[0].prerequisites.all=['T10'];},(w:WorldPack)=>{delete w.capabilities!.nodes[1];}];
  for(const mutate of variants){const world=buildCapabilityWorld(base as unknown as WorldPack);mutate(world);assert.throws(()=>validateWorld(world),/capabilit|graph|JSON|node/i);}
  const world=buildCapabilityWorld(base as unknown as WorldPack);let reads=0;
  Object.defineProperty(world.capabilities!.nodes[0].minimumProficiency,'farming',{get(){reads++;return 0;},enumerable:true});
  assert.throws(()=>validateWorld(world),/JSON/);assert.equal(reads,0);
});
