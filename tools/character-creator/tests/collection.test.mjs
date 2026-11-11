import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NFT_PROFILES } from '../src/nft-collection.js';
import { normalize } from '../src/data.js';
import { renderSprite, renderCard } from '../scripts/build-collection.mjs';
import { Raster } from '../scripts/raster.mjs';
import { drawLandscape } from '../src/renderer.js';
import { FIGURE_DESIGN, drawHistoricalFrame } from '../src/historical-frame.js';
import { createHash } from 'node:crypto';
import { FIGURE_IDS, CAREER_GROUPS, RARITY_LABELS } from '../../../chain/ids.ts';

test('collection covers every figure and NPC career group in the NFT catalog',()=>{
 assert.deepEqual(NFT_PROFILES.filter(p=>p.kind==='figure').map(p=>p.id).sort(),[...FIGURE_IDS].sort());
 assert.deepEqual(NFT_PROFILES.filter(p=>p.kind==='npc').map(p=>p.id).sort(),[...CAREER_GROUPS].sort());
 for(const profile of NFT_PROFILES)assert.deepEqual(normalize(JSON.parse(JSON.stringify(profile.state))),profile.state);
 const manifest=JSON.parse(readFileSync(new URL('../nft-collection/manifest.json',import.meta.url)));
 assert.equal(manifest.characters.length,10);
 for(const entry of manifest.characters){assert.equal(entry.actions.length,2);assert.deepEqual(entry.rarityVariants.map(v=>v.label),[...RARITY_LABELS]);assert.ok(entry.rarityVariants.every(v=>v.artPreviewOnly));assert.equal(entry.supplyCap,entry.kind==='figure'?5:null);}
});

test('historical backgrounds advance through five stages, with gold frames only from Rare onward',()=>{
 const frames=new Set(),backgrounds=new Set();
 const digest=data=>createHash('sha256').update(data).digest('hex');
 for(const profile of NFT_PROFILES){
  if(profile.kind==='figure'){
   assert.equal(profile.state.figure,profile.id);assert.equal(profile.frame,FIGURE_DESIGN[profile.id].frame);assert.equal(profile.state.backdrop,FIGURE_DESIGN[profile.id].scene);
   const frame=new Raster(480,640),background=new Raster(240,190);drawHistoricalFrame(frame,profile.id,'#d6aa52',2);drawLandscape(background,profile.state.birthplace,profile.state.backdrop,0);
   frames.add(digest(frame.data));backgrounds.add(digest(background.data));
   const stages=new Set();
   for(let rarity=0;rarity<5;rarity++){
    const scenery=new Raster(240,190);drawLandscape(scenery,profile.state.birthplace,profile.state.backdrop,rarity);stages.add(digest(scenery.data));
    const card=renderCard(profile,{title:profile.id,actions:[]},rarity);
    assert.equal(card.layers.some(layer=>layer.name==='98-historical-identity-frame'),rarity>=2);
    if(rarity<2){const earlyFrame=new Raster(480,640);drawHistoricalFrame(earlyFrame,profile.id,'#d6aa52',rarity);assert.ok(earlyFrame.data.every(value=>value===0));}
   }
   assert.equal(stages.size,5,`${profile.id} needs five distinct backgrounds`);
  }else{assert.equal(profile.frame,'citizen');assert.equal(profile.state.figure,'none');assert.ok(!renderCard(profile,{title:profile.id,actions:[]}).layers.some(layer=>layer.name==='98-historical-identity-frame'));}
 }
 assert.equal(frames.size,4);assert.equal(backgrounds.size,4);
});

test('all ten identities remain visually distinct when costume, hair, beard and skin are equalized',()=>{
 const heads=new Set();
 for(const profile of NFT_PROFILES){
  const state=normalize({...profile.state,outfit:'tunic',hair:'shaved',beard:'none',marks:'none',skin:'honey',height:'medium',build:'average',prop:'none',jewelry:'none'}),sprite=renderSprite(state),head=[];
  for(let y=18;y<43;y++)head.push(...sprite.data.subarray((y*64+18)*4,(y*64+46)*4));
  heads.add(createHash('sha256').update(Buffer.from(head)).digest('hex'));
 }
 assert.equal(heads.size,10,'face features must distinguish identities without relying on clothing, hair, beard or skin');
});

test('every collection view has editable paint layers that reconstruct its exact sprite',()=>{
 for(const profile of NFT_PROFILES)for(const view of ['front','side','back']){
  const sprite=renderSprite(profile.state,view),composite=new Raster(64,96);
  assert.equal(sprite.clipped,0,`${profile.id}/${view} was cropped`);
  assert.equal(new Set(sprite.layers.map(layer=>layer.name)).size,sprite.layers.length);
  for(const layer of sprite.layers)composite.blit({width:64,height:96,data:layer.data},0,0);
  assert.deepEqual(composite.data,sprite.data,`${profile.id}/${view}: layers must reconstruct exactly`);
 }
});

test('rarity progression keeps every visible character pixel unchanged despite different settings',()=>{
 for(const profile of NFT_PROFILES){
  const descriptor={title:profile.id,actions:[{name:'First deed'},{name:'Second deed'}]},base=renderCard(profile,descriptor);
  const sprite=renderSprite(profile.state);
  const characterPixels=card=>{
   const pixels=[];
   for(let y=0;y<96;y++)for(let x=0;x<64;x++)if(sprite.data[(y*64+x)*4+3]){
    const offset=(((100+y*4+2)*480)+112+x*4+2)*4;pixels.push(...card.data.subarray(offset,offset+4));
   }
   return pixels;
  };
  const original=characterPixels(base);
  for(let rarity=0;rarity<5;rarity++){
   const variant=renderCard(profile,descriptor,rarity);
   assert.deepEqual(characterPixels(variant),original,`${profile.id}/${rarity} changed or obscured the character`);
  }
 }
});

test('Stargazer uses the ordinary local landscape at every rarity',()=>{
 const profile=NFT_PROFILES.find(entry=>entry.id==='sky');assert.equal(profile.state.backdrop,'local');
 const backgrounds=[];for(let rarity=0;rarity<5;rarity++){const scene=new Raster(240,190);drawLandscape(scene,profile.state.birthplace,profile.state.backdrop,rarity);backgrounds.push(scene.data);}
 for(const background of backgrounds)assert.deepEqual(background,backgrounds[0]);
});
