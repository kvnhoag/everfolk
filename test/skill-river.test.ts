import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/index.ts';
import { buildSkillTree, currentSkillTree } from '../client/skill-tree.ts';
import { skillRiverGroups, isMainRiverEdge, skillRiverPath, skillRequirementNotes } from '../client/skill-river.ts';
import type { WorldPack } from '../src/types.ts';
import current from '../worlds/alexandria-sample.json' with { type: 'json' };
import legacy from '../worlds/alexandria-0.4.0.json' with { type: 'json' };

for(const world of [current,legacy] as WorldPack[]) test(`${world.version}: responsive channels preserve every skill and prerequisite`,()=>{
 const engine=createEngine(world),life=engine.start('delta-contract');
 const full=buildSkillTree(world,life,engine.getActivities(life));
 for(const model of [full,currentSkillTree(full)]) {
  const before=structuredClone({model,life});
  const groups=skillRiverGroups(model);
  assert.deepEqual(groups.flatMap(group=>group.stages.flat().map(node=>node.id)).sort(),model.nodes.map(node=>node.id).sort());
  for(const edge of model.edges) {
   const main=isMainRiverEdge(edge,model);
   assert.ok(groups.some(group=>group.nodes.some(node=>node.id===edge.from)));
   assert.ok(groups.some(group=>group.nodes.some(node=>node.id===edge.to)));
   if(main)assert.equal(model.nodes.find(node=>node.id===edge.from)!.branch,model.nodes.find(node=>node.id===edge.to)!.branch);
   assert.doesNotMatch(skillRiverPath({x:0,y:0,width:72,height:72},{x:main?0:220,y:125,width:72,height:72},main),/NaN|Infinity/);
  }
  assert.deepEqual({model,life},before);
 }
});

test('cross-branch and skip-tier conditions remain supplementary rather than inventing a direct channel',()=>{
 const world=current as WorldPack,engine=createEngine(world),life=engine.start('delta-links');
 const model=buildSkillTree(world,life,engine.getActivities(life));
 for(const [from,to] of [['craft','warfare'],['literacy','astronomy'],['literacy','philosophy'],['reckoning','astrology']]) {
  const edge=model.edges.find(edge=>edge.from===from&&edge.to===to);
  assert.ok(edge,`${from}->${to} is still a real prerequisite`);
  assert.equal(isMainRiverEdge(edge,model),false);
 }
 assert.ok(isMainRiverEdge(model.edges.find(edge=>edge.from==='craft'&&edge.to==='pottery')!,model));
});

test('open-source icons cover all skills with source, license and unchanged original files',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/skill-icons/open-source-v3/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.assets.map((asset:{id:string})=>asset.id).sort(),Object.keys(current.character.skills).sort());
 for(const asset of manifest.assets) {
  assert.equal(asset.license,'CC-BY-3.0');
  assert.ok(asset.author && asset.source && asset.original_path);
  const original=readFileSync(new URL('../'+asset.original_path,import.meta.url),'utf8');
  const displayed=readFileSync(new URL('../'+asset.path,import.meta.url),'utf8');
  assert.match(original,/viewBox="0 0 512 512"/);
  assert.match(displayed,/viewBox="0 0 512 512"/);
  assert.doesNotMatch(displayed,/<script|foreignObject|(?:xlink:)?href=|\son[a-z]+=/i);
  assert.doesNotMatch(displayed,/M0 0h512v512H0z/,'solid background must not fill the alpha mask');
 }
});

test('skill connections use only straight segments, including cross-branch and skip-tier links',()=>{
 for(const main of [true,false]) for(const target of [{x:0,y:108},{x:240,y:108},{x:-180,y:216}]) {
  const path=skillRiverPath({x:0,y:0,width:60,height:60},{...target,width:60,height:60},main);
  assert.doesNotMatch(path,/[CQAST]/i,'no curves or arcs in a skill connection');
  assert.doesNotMatch(path,/NaN|Infinity/);
 }
});

test('remote prerequisites remain explicit requirement notes without adding nearby connections',()=>{
 const world=current as WorldPack,engine=createEngine(world),life=engine.start('requirement-notes');
 const model=buildSkillTree(world,life,engine.getActivities(life));
 for(const [id,expected] of [['astronomy',['literacy']],['astrology',['reckoning']],['philosophy',['literacy']],['warfare',['craft']],['pottery',[]]] as const) {
  const node=model.nodes.find(node=>node.id===id)!;
  const notes=skillRequirementNotes(node,model);
  assert.deepEqual(notes.map(note=>note.id),expected);
  for(const note of notes)assert.deepEqual(note,node.requirements.find(requirement=>requirement.id===note.id));
 }
});
