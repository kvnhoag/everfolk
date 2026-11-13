import test from 'node:test';
import assert from 'node:assert/strict';
import {createPouchSurface,createPouchBridges,updatePouchGeometry,createCrimpedSeal,updateSealPeel,tearProfile,sampleTearLine,createInnerLip,updateInnerLip} from '../client/lib/booster/pack-geometry.mjs';
import {PACK_SIZE,cardLayout,departure} from '../client/lib/booster/layout.mjs';

test('all deformed pouch borders meet the front and back exactly, without inverted thickness',()=>{
 const front=createPouchSurface(1),back=createPouchSurface(-1),walls=createPouchBridges(front);
 for(const tear of [0,.15,.58,1])for(const time of [0,1.8,7.9]){
  updatePouchGeometry(front,back,walls,{tear,flex:.8,time});
  const a=front.attributes.position,b=back.attributes.position;
  for(let i=0;i<a.count;i++){assert.ok(a.getZ(i)>b.getZ(i));assert.ok(Number.isFinite(a.getZ(i)));}
  for(const wall of walls)wall.userData.boundary.forEach((source,i)=>{for(const [n,face] of [[0,front],[1,back]]){const p=wall.attributes.position,q=face.attributes.position;for(let c=0;c<3;c++)assert.equal(p.array[(i*2+n)*3+c],q.array[source*3+c]);}});
 }
});
test('the serrated seal is closed and stays closed through peel deformation',()=>{
 const seal=createCrimpedSeal(),edges=new Map(),idx=seal.index.array;
 for(let i=0;i<idx.length;i+=3)for(const [a,b] of [[idx[i],idx[i+1]],[idx[i+1],idx[i+2]],[idx[i+2],idx[i]]]){const key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);}
 assert.ok([...edges.values()].every(n=>n===2),'every seal edge must belong to two faces');
 for(const tear of [0,.3,.8,1])for(const curl of [0,.5,1]){updateSealPeel(seal,tear,2.1,curl);assert.ok([...seal.attributes.position.array].every(Number.isFinite));}
});
test('settled cards have non-overlapping footprints on desktop and narrow layouts',()=>{
 for(const [width,height] of [[1440,900],[1024,768],[390,844],[319,516]]){
  const slots=Array.from({length:PACK_SIZE},(_,i)=>cardLayout(i,width,height));
  for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){const a=slots[i],b=slots[j];const margin=.06;const separatedX=Math.abs(a.x-b.x)>(a.scale+b.scale)*2.05/2+margin;const separatedY=Math.abs(a.y-b.y)>(a.scale+b.scale)*2.88/2+margin;assert.ok(separatedX||separatedY,`cards ${i}/${j} collide at ${width}x${height}`);}
 }
});
test('hidden stack faces retain distinct depth before release',()=>{
 assert.equal(new Set(Array.from({length:PACK_SIZE},(_,i)=>departure(i).z)).size,PACK_SIZE);
});

test('a curved fibrous tear leaves unopened foil sealed and pale laminate follows the actual edge',()=>{
 const front=createPouchSurface(1),back=createPouchSurface(-1),walls=createPouchBridges(front),lip=createInnerLip(front);
 for(const tear of [.2,.5,.85]){
  updatePouchGeometry(front,back,walls,{tear});updateInnerLip(lip,front,tear);
  assert.equal(sampleTearLine(Math.min(1,tear+.1),tear),1.91);
  const heights=Array.from({length:20},(_,i)=>sampleTearLine(i/20*tear,tear));assert.ok(Math.max(...heights)-Math.min(...heights)>.04);
  const top=walls.find(g=>g.userData.edge==='top');assert.ok(top.index.count>0&&top.index.count<front.userData.nx*6);
  const {nx,ny}=front.userData,p=front.attributes.position,q=lip.attributes.position;
  for(let i=0;i<=nx;i++){const at=ny*(nx+1)+i;assert.equal(q.getX(i*3+1),p.getX(at));assert.ok(Math.abs(q.getY(i*3+1)-p.getY(at))<.018);}
 }
});

test('the peeled green seal retains a broad shallow bow without cross-section twisting',()=>{
 const seal=createCrimpedSeal(),{nx,ny}=seal.userData;
 for(const tear of [.2,.5,.8,1])for(const curl of [0,.5,1]){
  updateSealPeel(seal,tear,1,curl);const p=seal.attributes.position;
  for(let i=0;i<=nx;i++){
   const a=i,b=ny*(nx+1)+i;
   assert.ok(p.getY(b)-p.getY(a)>.23,'the strip must retain its visible face width');
   assert.ok(Math.abs(p.getZ(b)-p.getZ(a))<.10,'the cross section must not corkscrew');
  }
 }
});

test('the opened seal bows towards the viewer while its unpeeled end remains attached',()=>{
 const seal=createCrimpedSeal();updateSealPeel(seal,.7,0,0);const {nx,ny,rest}=seal.userData,p=seal.attributes.position;
 const middle=Math.floor(ny/2)*(nx+1);
 assert.ok(p.getZ(middle)-rest[middle*3+2]>.35,'the peeled edge should bow forwards');
 assert.ok(Math.abs(p.getZ(middle+nx)-rest[(middle+nx)*3+2])<1e-6,'the unpeeled edge stays attached');
});

test('the torn contour stays fixed after cutting and matches both nylon halves',()=>{
 for(const u of [.02,.15,.3,.55,.75,.9])assert.equal(sampleTearLine(u,Math.min(1,u+.08)),sampleTearLine(u,1));
 const seal=createCrimpedSeal(2.72,.28,96,10,{torn:true}),p=seal.attributes.position;
 for(let i=0;i<=96;i++)assert.ok(Math.abs(p.getY(i)+2.02-sampleTearLine(i/96,1)-.012)<1e-6,'upper and lower torn edges must retain the same contour');
 assert.equal(seal.groups[2].materialIndex,3,'the torn nylon cross-section uses the pale laminate material');
});

test('peeling bends nylon without stretching its cross sections',()=>{
 const seal=createCrimpedSeal(2.72,.28,96,10,{torn:true}),{nx,ny,rest}=seal.userData;
 for(const tear of [0,.25,.6,1])for(const curl of [0,.5,1]){
  updateSealPeel(seal,tear,3,curl);const p=seal.attributes.position;
  for(let i=0;i<=nx;i+=3){
   const a=i,b=ny*(nx+1)+i;
   const old=Math.hypot(rest[a*3]-rest[b*3],rest[a*3+1]-rest[b*3+1],rest[a*3+2]-rest[b*3+2]);
   const now=Math.hypot(p.getX(a)-p.getX(b),p.getY(a)-p.getY(b),p.getZ(a)-p.getZ(b));
   assert.ok(Math.abs(old-now)<1e-6,'material width must be preserved throughout peeling and release');
  }
 }
});

test('the bottom factory seam remains in front of the pinched pouch collar',()=>{
 const front=createPouchSurface(1),back=createPouchSurface(-1);updatePouchGeometry(front,back,[],{});
 const {nx}=front.userData,p=front.attributes.position;
 for(let row=0;row<=1;row++)for(let i=0;i<=nx;i++)assert.ok(p.getZ(row*(nx+1)+i)<.034,'the pouch must not cover the lower crimped seam');
});
