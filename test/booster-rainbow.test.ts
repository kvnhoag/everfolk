import test from 'node:test';
import assert from 'node:assert/strict';
import {RAINBOW,sampleRainbowState,rainbowPoint} from '../client/lib/booster/rainbow.mjs';

test('the tear reveals only the reached stripes and unexposed rays remain collapsed and transparent',()=>{
 assert.equal(sampleRainbowState(0,-1).visible,false);
 for(const progress of [.05,.15,.35,.65,.82,.99]){
  const state=sampleRainbowState(progress,-1);assert.equal(state.visible,true);assert.equal(state.width,RAINBOW.mouthWidth*progress);
  for(const u of [progress+.001,1]){const ray=rainbowPoint(u,.5,state,2);assert.equal(ray.alpha,0);assert.equal(ray.x,rainbowPoint(progress,.5,state,2).x);}
  assert.ok(rainbowPoint(progress*.4,.3,state,2).alpha>.7);
 }
 const first=sampleRainbowState(1,1/60),half=sampleRainbowState(1,.05),full=sampleRainbowState(1,.1);
 assert.equal(first.visible,true);assert.ok(half.opacity>.8);assert.ok(first.height<half.height&&half.height<full.height);
 assert.ok(Math.abs(rainbowPoint(0,0,full,2).x-RAINBOW.mouthLeft)<1e-10);
 assert.ok(Math.abs(rainbowPoint(1,0,full,2).x-(RAINBOW.mouthLeft+RAINBOW.mouthWidth))<1e-10);
});
test('the anchored rainbow is erased bottom-up along an arch rather than translated upward',()=>{
 const before=sampleRainbowState(1,.20),during=sampleRainbowState(1,.70),late=sampleRainbowState(1,.95);
 for(const u of [.1,.5,.9])for(const v of [.1,.4,.7]){
  const a=rainbowPoint(u,v,before,2),b=rainbowPoint(u,v,during,2);
  for(const k of ['x','y','z'])assert.equal(a[k],b[k],'the field geometry must not translate during erasure');
 }
 assert.equal(during.lift,0);assert.ok(during.erase>0&&late.erase>during.erase);
 assert.equal(rainbowPoint(.5,.1,during,2).alpha,0);assert.ok(rainbowPoint(.5,.7,during,2).alpha>.9);
 assert.equal(rainbowPoint(.5,.7,late,2).alpha,0);
 const crown=rainbowPoint(.5,.8,before,2),edge=rainbowPoint(0,.8,before,2);assert.ok(crown.y>edge.y+.3,'the field crown must remain arched');
 assert.equal(sampleRainbowState(1,RAINBOW.exitAt).visible,false);
});
test('the ribbon field has no crossed stripes, unbounded points or gaps during peel and release',()=>{
 for(const progress of [.12,.38,.74,1])for(const time of [-1,.02,.2,.6,1]){
  const state=sampleRainbowState(progress,time);
  for(let row=0;row<=RAINBOW.rows;row++){
   let last=-Infinity;
   for(let column=0;column<=RAINBOW.bands*2;column++){
    const p=rainbowPoint(column/(RAINBOW.bands*2),row/RAINBOW.rows,state,time);
    assert.ok(p.x>=last);last=p.x;assert.ok(Object.values(p).every(Number.isFinite));
   }
  }
 }
});
