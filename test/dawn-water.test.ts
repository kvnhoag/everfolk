import assert from 'node:assert/strict';
import test from 'node:test';
import { createDawnWater, DAWN_SUN, quayEdge } from '../client/homepage/dawn-water.ts';

test('dawn water changes real pixels over time, is deterministic when paused, and keeps a bounded buffer', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis,'document');
  let buffer = new Uint8ClampedArray();
  const context = { createImageData: (width:number,height:number)=>({data:new Uint8ClampedArray(width*height*4)}),
    putImageData: (image:{data:Uint8ClampedArray})=>{buffer=image.data;} };
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>context})}});
  try {
    const water = createDawnWater();
    const start = performance.now();water.draw(0);const first = buffer.slice();
    water.draw(2);const second = buffer.slice();
    assert.equal(buffer.length,384*155*4);
    let changes=0; for(let i=0;i<first.length;i+=4) if(first[i]!==second[i] || first[i+1]!==second[i+1]) changes++;
    assert.ok(changes>15000,'waves must animate the water surface, rather than only a few overlay particles');
    water.draw(0);assert.deepEqual(buffer,first,'the same stopped scene time must produce the same surface');
    console.log(`Three software-water frames: ${(performance.now()-start).toFixed(1)} ms; animated samples: ${changes}`);
    for(let i=3;i<buffer.length;i+=4) assert.equal(buffer[i],255);
    water.dispose();
  } finally { if(original) Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document'); }
});

test('the sunrise and shallow-water model stay anchored to the original coast',()=>{
  assert.ok(DAWN_SUN.y<DAWN_SUN.horizon && DAWN_SUN.horizon-DAWN_SUN.y<24);
  assert.ok(Math.abs(quayEdge(228)-470)<1);
  assert.ok(Math.abs(quayEdge(283)-477)<1);
  assert.ok(quayEdge(440)>quayEdge(300));
});
