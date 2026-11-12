import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '../src/index.ts';
import { getNetWorth, getDemoResourceValue } from '../src/economy.ts';
import { TRADE_ITEMS } from '../src/demo/types.ts';
import { getVisibleBirthRollResources } from '../client/models/birth-stat-roll.ts';
import { getWealthSummary } from '../client/models/wealth.ts';
import current from '../worlds/demo/alexandria-lives-2.json' with {type:'json'};
import previous from '../worlds/demo/alexandria-lives-1.json' with {type:'json'};

test('actual WSL free-play households roll their real grain and goods by background', () => {
  const engine=createEngine(current), missing=new Set(engine.world.origins.map(origin=>origin.id));
  for(let index=0;index<2048 && missing.size;index++){
    const life=engine.start(`wsl-actual-resource-${index}`);
    missing.delete(life.originId);
    const resources=getVisibleBirthRollResources(engine.world,life);
    assert.equal(resources[0].label,'Grain');
    for(const id of TRADE_ITEMS){
      const row=resources.find(row=>row.id===`demo-resource:${id}`)!;
      const range=engine.world.demo!.startingResources!.origins?.[life.originId]?.[id] ?? engine.world.demo!.startingResources!.defaults[id];
      assert.ok(row.value>=range.min && row.value<=range.max,`${life.originId}: ${id}`);
      assert.equal(row.unitPrice,life.demo!.town.prices[id].buy);
    }
    const value=resources.reduce((sum,row)=>sum+row.marketValue,0);
    assert.equal(getDemoResourceValue(engine.world,life),value);
    assert.equal(getNetWorth(engine.world,life),life.economy!.cash+value-life.economy!.debt);
    assert.equal(getWealthSummary(engine.world,life)!.assetTotal,value);
    assert.deepEqual(engine.load(engine.save(life)),life);
  }
  assert.equal(missing.size,0);
});

test('WSL newcomers show their grain roll even when other resources are zero',()=>{
  const engine=createEngine(current);
  for(let index=0;index<512;index++){
    const life=engine.start(`wsl-newcomer-resource-${index}`);
    if(life.originId!=='delta-newcomers')continue;
    const rows=getVisibleBirthRollResources(engine.world,life);
    assert.equal(rows.length,8);
    assert.ok(life.demo!.household.grain>=180 && life.demo!.household.grain<=320);
    assert.ok(rows.some(row=>row.value===0));
    return;
  }
  assert.fail('Newcomer fixture was not reached');
});

test('existing WSL free-play keeps its previous resource RNG and valuation',()=>{
  const engine=createEngine(previous), born=engine.start('wsl-old-actual-resources');
  assert.equal(born.demo!.household.grain,engine.world.demo!.household.startingGrain);
  assert.equal(getDemoResourceValue(engine.world,born),0);
  assert.equal(getNetWorth(engine.world,born),born.economy!.cash);
  assert.deepEqual(engine.load(engine.save(born)),born);
});
