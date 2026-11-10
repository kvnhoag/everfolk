import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,OPTIONS,SKINS,CLOTH,HAIR,ACCENTS,ROLES,normalize,randomState,promptFor,GROUPS,FIGURE_PRESETS,figurePreset} from '../src/data.js';
import {drawCharacter,paletteColors} from '../src/renderer.js';

// Minimal integer RGBA canvas: tests use actual raster output, not only option state.
function raster(){const width=64,height=96,data=new Uint8ClampedArray(width*height*4);let color='#000000';let clipped=0;const ctx={imageSmoothingEnabled:false,
set fillStyle(v){color=v;},get fillStyle(){return color;},
clearRect(){data.fill(0);},
fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isInteger));const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16));for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){if(xx<0||xx>=width||yy<0||yy>=height){clipped++;continue;}let i=(yy*width+xx)*4;data.set([...rgb,255],i);}},
getImageData(){return {data:new Uint8ClampedArray(data)};},putImageData(image){data.set(image.data);}};return {width,height,getContext:()=>ctx,data,get clipped(){return clipped;}};}
const image=(s=DEFAULT,view='front',mode='color')=>{const c=raster();drawCharacter(c,s,view,mode);return c;};

test('configuration validation handles unknown values, truncation, and schema versions',()=>{
 const s=normalize({...DEFAULT,skin:'invalid',height:null,name:'x'.repeat(100),extra:'omit'});assert.equal(s.skin,DEFAULT.skin);assert.equal(s.height,DEFAULT.height);assert.equal(s.name.length,24);assert.equal(s.extra,undefined);assert.throws(()=>normalize({version:2}));assert.throws(()=>normalize(null));
});
test('random generation preserves each locked group independently',()=>{for(const [group,keys]of Object.entries(GROUPS)){const next=randomState(DEFAULT,{[group]:true},()=>.91);for(const key of keys)assert.equal(next[key],DEFAULT[key],`${group}:${key}`);}});
test('each visual control changes raster pixels',()=>{
 const base=image();for(const key of ['presentation','build','height','face','hair','beard','finish','eyes','brows','nose','expression','marks','outfit','jewelry','footwear','prop']){
   for(const [value]of OPTIONS[key]){if(value===DEFAULT[key])continue;const alt=image({...DEFAULT,[key]:value});assert.notDeepEqual(alt.data,base.data,`${key}:${value} has no visual change`);}
 }
 for(const [key,values]of Object.entries({skin:SKINS,cloth:CLOTH,hairColor:HAIR,accent:ACCENTS}))for(const v of values)if(v.id!==DEFAULT[key])assert.notDeepEqual(image({...DEFAULT,[key]:v.id}).data,base.data,`${key}:${v.id}`);
});
test('front/side/back are distinct, silhouette is uniform, grayscale has equal channels',()=>{
 assert.notDeepEqual(image().data,image(DEFAULT,'side').data);assert.notDeepEqual(image().data,image(DEFAULT,'back').data);
 for(const mode of ['silhouette','gray']){const c=image(DEFAULT,'front',mode);for(let i=0;i<c.data.length;i+=4)if(c.data[i+3]){if(mode==='silhouette')assert.deepEqual([...c.data.slice(i,i+3)],[41,37,42]);else assert.ok(c.data[i]===c.data[i+1]&&c.data[i]===c.data[i+2]);}}
});
test('raster stays in frame with opaque pixel clusters and palette-legal colors',()=>{
 for(let n=0;n<100;n++){const s=randomState(DEFAULT,{},()=>((n*17+11)%101)/101);for(const view of ['front','side','back']){const c=image(s,view);assert.equal(c.clipped,0,`clipped ${JSON.stringify(s)}`);const allowed=new Set(paletteColors(s));const colors=new Set();for(let i=0;i<c.data.length;i+=4){assert.ok(c.data[i+3]===0||c.data[i+3]===255);if(c.data[i+3])colors.add('#'+[...c.data.slice(i,i+3)].map(x=>x.toString(16).padStart(2,'0')).join(''));}for(const color of colors)assert.ok(allowed.has(color),`unexpected color ${color}`);assert.ok(colors.size<=40,`${colors.size} colors exceeds prototype budget`);}}
});
test('role references and identity choices survive export/import and prompt generation',()=>{
 for(const role of ROLES){const s={...DEFAULT,role:role.id,prop:role.prop,name:'Người bạn'};assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))),s);const prompt=promptFor(s);assert.ok(prompt.includes(role.nv));assert.ok(prompt.includes('64×96'));assert.ok(prompt.includes('Người bạn'));}
});

test('historical presets are editable modular states and round-trip with no schema break',()=>{
 const old={...DEFAULT};delete old.beard;assert.equal(normalize(old).beard,'none');
 for(const preset of FIGURE_PRESETS){const s=figurePreset(preset.id);assert.deepEqual(normalize(JSON.parse(JSON.stringify(s))),s);assert.equal(s.name,preset.name);const changed=normalize({...s,cloth:'terracotta',expression:'smile'});assert.equal(changed.cloth,'terracotta');assert.equal(figurePreset(preset.id).cloth,s.cloth);assert.ok(promptFor(s).includes(preset.id==='alexander'?'thế kỷ IV TCN':'300 TCN'));}
 assert.throws(()=>figurePreset('missing'));
});
test('both historical silhouettes and all new parts fit the original raster and palette in every view',()=>{
 for(const preset of FIGURE_PRESETS)for(const build of OPTIONS.build.map(x=>x[0]))for(const height of OPTIONS.height.map(x=>x[0]))for(const view of ['front','side','back'])for(const frame of [0,1]){
 const s={...figurePreset(preset.id),build,height};const c=raster();drawCharacter(c,s,view,'color',frame);assert.equal(c.clipped,0,`${preset.id}:${build}:${height}:${view}`);const allowed=new Set(paletteColors(s));for(let i=0;i<c.data.length;i+=4)if(c.data[i+3]){assert.equal(c.data[i+3],255);assert.ok(allowed.has('#'+[...c.data.slice(i,i+3)].map(x=>x.toString(16).padStart(2,'0')).join('')));}
 }
 for(const preset of FIGURE_PRESETS){const s=figurePreset(preset.id);assert.notDeepEqual(image(s).data,image(s,'side').data);assert.notDeepEqual(image(s).data,image(s,'back').data);}
 assert.notDeepEqual(image(figurePreset('alexander'),'front','silhouette').data,image(figurePreset('euclid'),'front','silhouette').data);
});
