import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { buildCrossoverWorld } from "../src/vocations/crossover-world.ts";
import { buildCapabilityWorld } from "../src/vocations/capability-world.ts";
import { BALANCED_ATTRIBUTE_NODES as ATTRIBUTE_NODES } from "../src/capabilities/attribute-catalog.ts";
import { buildCapabilityLayout,capabilityAncestors } from "../client/models/capability-layout.ts";
import { characterEffectReason } from "../src/character.ts";
import { militaryCareerReason } from "../src/capabilities/military.ts";
import { capabilityReason } from "../src/capabilities/engine.ts";
import { validateWorld } from "../src/validate.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with {type:"json"};
import retained from "../worlds/demo/alexandria-lives-3.json" with {type:"json"};

function fixture() {
  const world=buildCrossoverWorld(base as unknown as WorldPack);
  for(const event of world.events){event.when={type:"age",op:"gte",value:1000};event.maxOccurrences=1;}
  delete world.eventPacing;delete world.character!.encounterPacing;
  for(const band of world.mortality!.bands)band.annualProbability=0;
  for(const band of world.health!.incidenceBands)band.annualProbability=0;
  for(const band of world.health!.declineBands)band.healthLoss=0;
  delete world.health!.mortalityCalibration;
  world.yearlyRules=[];world.yearlyEffects=[];
  // Authored expertise/resources isolate progression and finance from survival balance.
  for(const skill of Object.values(world.character!.skills))skill.initial=90;
  for(const stat of Object.values(world.stats))delete stat.initialRange;
  world.stats.health.initial=100;world.stats.knowledge.initial=90;
  world.stats.wealth.max=10000;world.stats.wealth.initial=10000/world.economy!.unitsPerPoint;
  for(const origin of world.origins){origin.effects=[];origin.statRanges={};}
  delete world.demo!.startingResources;
  world.demo!.household.startingGrain=12000;world.demo!.household.storeCapacity=20000;
  world.demo!.market.start.army.grain=20000;world.demo!.market.start.army.purse=20000;
  // Prove qualification separately from the authored chance of a vacant command.
  for(const activity of world.character!.activities) if(['seek-officer-commission','seek-general-command'].includes(activity.id)) { activity.outcomes=activity.outcomes.filter(o=>o.effects.some(e=>e.type==='job')); delete activity.opportunity; }
  return createEngine(world);
}
function work(engine:LifeEngine,life:LifeState,id:string) {
  const action=`cap-work-${id.toLowerCase()}`;
  const available=engine.getActivities(life).find(a=>a.id===action)!;
  assert.ok(available.available,`${id}: ${available.reason}`);
  return engine.act(life,action);
}
function learn(engine:LifeEngine,life:LifeState,id:string) {
  for(let i=0;i<6&&!life.capabilities!.learned[id];i++) {
    life=work(engine,life,id);
    life=engine.advance(life);
  }
  assert.ok(life.capabilities!.learned[id],id);
  return life;
}

test("attribute graph has only two crossovers, no cycles, and skills rather than careers as nodes",()=>{
  const layout=buildCapabilityLayout(),links=layout.links.filter(l=>l.crossover);
  assert.equal(ATTRIBUTE_NODES.length,74);
  assert.deepEqual(links.map(l=>`${l.from}>${l.to}`).sort(),['P1>M4','P2>M8']);
  for(const link of layout.links)assert.ok(ATTRIBUTE_NODES.find(n=>n.id===link.from)!.depth<ATTRIBUTE_NODES.find(n=>n.id===link.to)!.depth);
  assert.ok(ATTRIBUTE_NODES.every(n=>!['Soldier','Officer','General'].includes(n.title)));
  const path=capabilityAncestors(ATTRIBUTE_NODES,'M10');
  for(const id of ['F1','B2','B3','P1','P2','M4','M7','M8','M10'])assert.ok(path.has(id),id);
  assert.ok(!path.has('P4'),'command builds on reasoned argument, not the deepest study');
  assert.ok(!path.has('FC10')&&!path.has('AT5')&&!path.has('PS10'));
});

test("all military ranks follow accepted work, real service accounts and exact replay",()=>{
  const engine=fixture();let life=engine.start('military-crossovers');
  while(life.age<12)life=engine.advance(life);
  for(const id of ['F1','B2','B3','P1','P2','P3','P4','M4'])life=learn(engine,life,id);
  assert.ok(life.age>=18);
  assert.equal(militaryCareerReason(engine.world,life,'soldier'),undefined);
  life=engine.act(life,'enlist-royal-army');life=engine.advance(life);
  for(const id of ['M5','M6','M7'])life=learn(engine,life,id);
  assert.equal(life.character!.jobId,'soldier');
  life=engine.act(life,'seek-officer-commission');life=engine.advance(life);
  assert.equal(life.character!.jobId,'officer');
  for(const id of ['M8','M9','M10'])life=learn(engine,life,id);
  life=engine.act(life,'seek-general-command');life=engine.advance(life);
  assert.equal(life.character!.jobId,'general');
  assert.ok(life.capabilities!.military!.service.some(r=>r.role==='officer'));
  assert.ok(life.capabilities!.military!.service.some(r=>r.role==='general'));
  for(const r of life.capabilities!.military!.service){assert.equal(r.purseBefore-r.purseAfter,r.paid);assert.equal(r.grainBefore-r.grainAfter,r.rations);assert.ok(r.purseAfter>=0&&r.grainAfter>=0);}
  assert.ok(life.capabilities!.evidence.filter(e=>/^M(?:[5-9]|10)$/.test(e.nodeId)).every(e=>e.data.qualifies===true&&e.data.serviceReconciled===true));
  assert.deepEqual(engine.replay(life.seed,life.commands),life);
  assert.deepEqual(engine.load(engine.save(life)),life);
});

test("stat scores cannot bypass physical, Knowledge or service prerequisites",()=>{
  const engine=fixture();let life=engine.start('no-rank-from-scores');while(life.age<30)life=engine.advance(life);
  assert.match(characterEffectReason(engine.world,life,{type:'job',job:'general'})!,/Learn/);
  assert.match(capabilityReason(engine.world,life,'M4')!,/Learn/);
  const candidate=structuredClone(life);candidate.capabilities!.learned.B3={age:29,year:life.year-1};candidate.capabilities!.learned.P1={age:29,year:life.year-1};candidate.stats.health=20;
  assert.match(capabilityReason(engine.world,candidate,'M4')!,/Health 45/);
  candidate.stats.health=90;candidate.stats.knowledge=0;
  assert.match(capabilityReason(engine.world,candidate,'M4')!,/Knowledge 8/);
});

test("physical work develops trainable Strength and Endurance separately from Health",()=>{
  const world=buildCrossoverWorld(base as unknown as WorldPack);
  assert.equal(world.character!.skills.strength.initial,0);
  assert.equal(world.character!.skills.endurance.initial,0);
  const engine=fixture();let life=engine.start('physical-attributes');while(life.age<12)life=engine.advance(life);
  const before={strength:life.character!.skills.strength,endurance:life.character!.skills.endurance,health:life.stats.health};
  life=work(engine,life,'F1');
  assert.ok(life.character!.skills.strength>before.strength);
  assert.ok(life.character!.skills.endurance>before.endurance);
  assert.equal(life.stats.health,before.health);
});

test("military work waits for real service and rejects an under-rationed year",()=>{
  const engine=fixture();let life=engine.start('service-proof-settlement');while(life.age<12)life=engine.advance(life);
  for(const id of ['F1','B2','B3','P1','M4'])life=learn(engine,life,id);
  while(life.age<18)life=engine.advance(life);
  life=engine.act(life,'enlist-royal-army');life=engine.advance(life);
  const before=structuredClone(life);
  life=work(engine,life,'M5');
  assert.equal(life.capabilities!.evidence.at(-1)!.data.qualifies,false);
  assert.equal(life.capabilities!.evidence.at(-1)!.data.awaitingService,true);
  assert.deepEqual(before.commands.length+1,life.commands.length);
  const short=structuredClone(life);short.demo!.town.army.grain=0;
  const failed=engine.advance(short).capabilities!.evidence.find(e=>e.nodeId==='M5'&&e.age===life.age)!;
  assert.equal(failed.data.qualifies,false);
  assert.equal(failed.data.rationsServed,0);
  life=engine.advance(life);
  assert.equal(life.capabilities!.evidence.find(e=>e.nodeId==='M5')!.data.qualifies,true);
  assert.deepEqual(engine.replay(life.seed,life.commands),life);
});

test("retained capability pack and its replay remain exactly unchanged",()=>{
  assert.deepEqual(buildCapabilityWorld(base as unknown as WorldPack),retained);
  const engine=createEngine(retained as unknown as WorldPack);let life=engine.start('retained-attributes');
  for(let i=0;i<3&&life.phase!=='ended';i++){while(life.phase==='choice')life=engine.choose(life,engine.getChoices(life)[0].id);life=engine.advance(life);}
  assert.equal(life.character!.skills.strength,undefined);
  assert.deepEqual(engine.replay(life.seed,life.commands),life);
});

test("a back edge or an unknown condition stat cannot enter a saved world",()=>{
  const world=buildCrossoverWorld(base as unknown as WorldPack);world.capabilities!.nodes.find(n=>n.id==='P1')!.prerequisites.all=['M10'];
  assert.throws(()=>validateWorld(world),/graph|prerequisite/);
  const other=buildCrossoverWorld(base as unknown as WorldPack);other.capabilities!.nodes.find(n=>n.id==='M4')!.minimumStats={missing:10};
  assert.throws(()=>validateWorld(other),/condition gate/);
});
