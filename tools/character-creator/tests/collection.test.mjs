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

test('every historical figure has its own background and structural frame, reserved from NPCs',()=>{
 const frames=new Set(),backgrounds=new Set();
 const digest=data=>createHash('sha256').update(data).digest('hex');
 for(const profile of NFT_PROFILES){
  if(profile.kind==='figure'){
   assert.equal(profile.state.figure,profile.id);assert.equal(profile.frame,FIGURE_DESIGN[profile.id].frame);assert.equal(profile.state.backdrop,FIGURE_DESIGN[profile.id].scene);
   const frame=new Raster(480,640),background=new Raster(240,190);drawHistoricalFrame(frame,profile.id,'#d6aa52');drawLandscape(background,profile.state.birthplace,profile.state.backdrop);
   frames.add(digest(frame.data));backgrounds.add(digest(background.data));
   for(let rarity=0;rarity<5;rarity++)assert.ok(renderCard(profile,{title:profile.id,actions:[]},rarity).layers.some(layer=>layer.name==='98-historical-identity-frame'));
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

test('rarity-frame previews never repaint the character or manufacture a different identity',()=>{
 for(const profile of NFT_PROFILES){
  const descriptor={title:profile.id,actions:[{name:'First deed'},{name:'Second deed'}]},base=renderCard(profile,descriptor);
  for(let rarity=0;rarity<5;rarity++){
   const variant=renderCard(profile,descriptor,rarity);
   for(let y=100;y<484;y++)assert.deepEqual(variant.data.subarray((y*480+112)*4,(y*480+368)*4),base.data.subarray((y*480+112)*4,(y*480+368)*4));
  }
 }
});
