import { withoutMarketSignals, withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, StatDefinition, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with {type:"json"};
import previous from "../worlds/alexandria-0.17.0.json" with {type:"json"};
import { advanceYearWithFocus } from "../client/models/yearly-focus.ts";

const curve: NonNullable<StatDefinition["gainCurve"]> = [
  {from:0,multiplier:1}, {from:40,multiplier:0.5},
  {from:70,multiplier:0.2}, {from:90,multiplier:0.05},
];

function fixture(initial: number): WorldPack {
  const attribute = (label: string): StatDefinition => ({label,min:0,max:100,initial,gainCurve:structuredClone(curve)});
  return {
    schemaVersion:1,id:"strict-progression-life",version:"1",title:"Progression fixture",description:"Authored progression rules.",startYear:-30,maxAge:90,
    stats:{health:attribute("Health"),knowledge:attribute("Knowledge"),wealth:{label:"Wealth",min:0,max:100,initial:30}},flags:{},
    origins:[{id:"home",title:"Home",text:"Born at home.",weight:1,effects:[]}],yearlyEffects:[],events:[],
    endings:[{id:"record",title:"Record complete",text:"The record stops.",kind:"chapter"}],defaultEnding:"record",
    economy:{stat:"wealth",currency:{singular:"drachma",plural:"drachmas",short:"dr"},unitsPerPoint:10,description:"Authored currency.",assets:[]},
    character:{skills:{craft:attribute("Tool handling")},jobs:[],partners:[],childNames:["Child"],deathCauseDescription:"Authored causes.",
      deathCauses:[{id:"illness",title:"Illness",text:"An illness.",weight:1}],activities:[
        {id:"practice",text:"Practise a task",category:"training",outcomes:[{id:"practised",text:"You practise.",weight:1,effects:[
          {type:"skill",skill:"craft",delta:10},{type:"stat",stat:"knowledge",delta:10},{type:"stat",stat:"health",delta:5},{type:"cash",delta:-10},
        ]}]},
        {id:"risk",text:"Try a difficult task",category:"training",outcomes:[{id:"risk-result",text:"The task goes badly.",weight:1,effects:[
          {type:"skill",skill:"craft",delta:-12},{type:"stat",stat:"knowledge",delta:-8},{type:"stat",stat:"health",delta:-10},
        ]}]},
      ]},
  };
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) life = engine.advance(life);
  return life;
}

test("the same accepted lesson makes useful low-level progress and smaller high-level gains", () => {
  const lowEngine = createEngine(fixture(20)), highEngine = createEngine(fixture(80));
  const low = lowEngine.start("gain-budget"), high = highEngine.start("gain-budget");
  const lowAfter = lowEngine.act(low,"practice"), highAfter = highEngine.act(high,"practice");
  assert.equal(lowAfter.stats.knowledge,30);
  assert.equal(highAfter.stats.knowledge,82);
  assert.equal(lowAfter.character!.skills.craft,30);
  assert.equal(highAfter.character!.skills.craft,82);
  assert.equal(lowAfter.stats.health,25);
  assert.equal(highAfter.stats.health,81);
  assert.equal(highAfter.economy!.cash,high.economy!.cash-10,"Diminishing gains cannot discount the price.");
  assert.deepEqual(highAfter.commands,[{type:"act",activity:"practice"}]);
  assert.equal(highAfter.rngState,high.rngState,"Progression does not add a random draw.");
  assert.equal(high.stats.knowledge,80,"Earlier snapshots stay immutable.");
  assert.deepEqual(highEngine.load(highEngine.save(highAfter)),highAfter);
});

test("higher values do not reduce the losses from a failed activity", () => {
  const engine = createEngine(fixture(80)), before = engine.start("full-penalties");
  const after = engine.act(before,"risk");
  assert.equal(after.stats.health,70);
  assert.equal(after.stats.knowledge,72);
  assert.equal(after.character!.skills.craft,68);
  assert.deepEqual(engine.replay(after.seed,after.commands),after);
});

function currentCareerFixture(): WorldPack {
  const world = withoutMoneylender(structuredClone(current) as WorldPack);
  withoutMarketSignals(world);
  // Keep this qualification schedule independent of annual illness onset.
  delete world.health!.mortalityCalibration;
  world.events = world.events.filter(event=>event.id===world.health!.careDecision);
  delete world.eventPacing;
  delete world.character!.encounterPacing;
  world.health!.incidenceBands.forEach(band=>{band.annualProbability=0;});
  world.health!.declineBands.forEach(band=>{band.healthLoss=0;});
  world.yearlyRules=[];
  world.yearlyEffects=[{type:"cash",delta:20}];
  for (const origin of world.origins) {
    origin.effects=[];
    origin.statRanges={...origin.statRanges,health:{min:80,max:80},knowledge:{min:20,max:20},wealth:{min:50,max:50}};
  }
  return world;
}

test("new progression still permits early paid work and affordable study alongside it", () => {
  const engine = createEngine(currentCareerFixture());
  let life = ageTo(engine,engine.start("strict-early-copyist"),6);
  for (let age=6; age<12; age++) life=advanceYearWithFocus(engine,life,"study");
  assert.ok(life.character!.skills.literacy>=30 && life.character!.skills.literacy<100);
  life=ageTo(engine,life,14);
  const job=engine.getActivities(life).find(activity=>activity.id==="work-copyist")!;
  assert.equal(job.available,true,job.reason);
  life=engine.act(life,job.id);
  life=engine.orderMarket(life,{side:"buy",asset:"papyrus",quantity:8});
  life=engine.orderMarket(life,{side:"buy",asset:"ink",quantity:8});
  life=engine.advance(life);
  const before=life, after=advanceYearWithFocus(engine,life,"study");
  assert.equal(after.character!.jobId,"copyist");
  assert.ok(after.character!.skills.literacy>before.character!.skills.literacy);
  assert.equal(after.knowledge!.lastPracticeAge,after.age,"Scholarly work is still recorded as genuine learning.");
  assert.ok(after.economy!.cash>=0);
  assert.equal(after.economy!.debt,0);
  assert.deepEqual(engine.load(engine.save(after)),after);
});

test("retained 0.17 lives keep their original rewards and command replay", () => {
  assert.equal(previous.stats.health.gainCurve,undefined);
  assert.equal(previous.character.skills.literacy.gainCurve,undefined);
  const engine=createEngine(previous);
  let life=engine.start("strict-release-legacy");
  while (life.age<6 && life.phase!=="ended") life=life.phase==="choice"?engine.choose(life,engine.getChoices(life)[0].id):engine.advance(life);
  while (life.phase==="choice") life=engine.choose(life,engine.getChoices(life)[0].id);
  const lesson=engine.getActivities(life).find(activity=>activity.id==="train-literacy");
  if (lesson?.available) {
    const before=life.character!.skills.literacy;
    life=engine.act(life,lesson.id);
    assert.equal(life.character!.skills.literacy,before+10);
  }
  assert.deepEqual(engine.replay(life.seed,life.commands),life);
  assert.deepEqual(engine.load(engine.save(life)),life);
});
