import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {REFERENCE_MOTION,referenceLaunchRank,sampleReferenceCard,referenceImpactTime,advanceSpring,cardDepthOrder} from '../client/lib/booster/motion.mjs';
import {canCommitTear,tearProgress} from '../client/lib/booster/tear-input.mjs';
import {cardLayout} from '../client/lib/booster/layout.mjs';

test('a click, short seal pull or body rotation cannot open the pack',()=>{
 for(const gesture of [{mode:'tear',distance:0,progress:0},{mode:'tear',distance:12,progress:.99},{mode:'tear',distance:90,progress:.4},{mode:'rotate',distance:300,progress:.99}])assert.equal(canCommitTear(gesture),false);
 for(const mode of ['tear','keyboard-tear'])assert.equal(canCommitTear({mode,distance:240,progress:.9}),true);
 assert.equal(tearProgress(-200,0,1440),0);assert.ok(tearProgress(220,0,1440)>.82);assert.ok(tearProgress(135,0,319)>.82);
});
test('reference burst exposes five independent faces within 0.22 seconds',()=>{
 assert.equal(4*REFERENCE_MOTION.stagger,.22);
 const poses=Array.from({length:5},(_,i)=>sampleReferenceCard(i,.221,cardLayout(i,1440,900)));
 assert.ok(poses.every(p=>p.visible));assert.equal(new Set(poses.map(p=>p.z)).size,5);
});
test('cards remain front-facing during the flight and settle exactly into their slots',()=>{
 for(const [w,h] of [[1440,900],[319,628]])for(let i=0;i<5;i++){
  const target=cardLayout(i,w,h);
  for(let t=0;t<2.06;t+=1/120){const p=sampleReferenceCard(i,t,target);assert.ok(Math.abs(p.ry)<.25);assert.ok(Math.abs(p.rx)<.19);assert.ok(Object.values(p).every(v=>typeof v!=='number'||Number.isFinite(v)));}
  const end=sampleReferenceCard(i,REFERENCE_MOTION.end,target);for(const key of ['x','y','z','rz','scale'])assert.ok(Math.abs(end[key]-target[key])<1e-10);
 }
});
test('the reference circulation changes front/rear order while every card remains a complete composite',()=>{
 const poses=t=>Array.from({length:5},(_,i)=>sampleReferenceCard(i,t,cardLayout(i,1440,900)));
 const a=poses(.50),b=poses(.72),c=poses(.94);
 assert.ok(a[4].z>a[0].z&&a[0].z>a[1].z,'leading face is in front of the first rear sweep');
 assert.ok(b[3].z>b[4].z&&b[4].z>b[0].z,'next front arc advances while the long route passes behind');
 assert.ok(c[2].z>c[1].z&&c[1].z>c[0].z,'the middle face advances in front of the rear routes');
 for(let t=0;t<=REFERENCE_MOTION.end;t+=1/240){
  const p=poses(t),order=cardDepthOrder(p);assert.equal(new Set(order).size,5);
  for(let j=1;j<order.length;j++)assert.ok(p[order[j]].z>=p[order[j-1]].z,'whole-card draw order must follow 3D depth');
 }
 assert.deepEqual(cardDepthOrder(Array.from({length:5},()=>({z:0}))),[0,1,2,3,4],'equal depth must sort stably');
});

test('hover springs remain stable after slow frames and settle without permanent jitter',()=>{
 let x=0,v=0,max=0;for(let i=0;i<180;i++){[x,v]=advanceSpring(x,v,1,i%10===0?.04:1/60);max=Math.max(max,x);}
 assert.ok(max>1&&max<1.12);assert.ok(Math.abs(x-1)<.001);
 for(let i=0;i<180;i++)[x,v]=advanceSpring(x,v,0,1/60);assert.ok(Math.abs(x)<.001);assert.ok(Math.abs(v)<.001);
});


test('each card follows one uninterrupted flight straight into its own slot',()=>{
 for(const [w,h] of [[1440,900],[319,667]])for(let i=0;i<5;i++){
  const target=cardLayout(i,w,h),at=referenceImpactTime(i,target);
  for(let t=referenceLaunchRank(i,target)*REFERENCE_MOTION.stagger;t<at;t+=1/240)assert.equal(sampleReferenceCard(i,t,target).state,'flight');
  const before=sampleReferenceCard(i,at-1e-5,target),after=sampleReferenceCard(i,at+1e-5,target);
  assert.ok(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<.001,'no jump or second placement phase');
  const p=sampleReferenceCard(i,at+REFERENCE_MOTION.impactSettle+.001,target);assert.equal(p.state,'placed');
  for(const key of ['x','y','z','rz','scale'])assert.ok(Math.abs(p[key]-target[key])<1e-10);
 }
});

test('the first released card takes the shortest 3D flight and later cards use different arcs',()=>{
 for(const [w,h] of [[1440,900],[319,667]]){
  const flights=[];
  for(let i=0;i<5;i++){
   const target=cardLayout(i,w,h),rank=referenceLaunchRank(i,target),start=rank*REFERENCE_MOTION.stagger,end=referenceImpactTime(i,target);
   let length=0,last=sampleReferenceCard(i,start,target),depthMin=Infinity,depthMax=-Infinity;
   for(let step=1;step<=300;step++){const p=sampleReferenceCard(i,start+(end-start)*step/300,target);length+=Math.hypot(p.x-last.x,p.y-last.y,p.z-last.z);depthMin=Math.min(depthMin,p.z);depthMax=Math.max(depthMax,p.z);last=p;}
   flights.push({rank,length,end});assert.ok(depthMax-depthMin>.25,'flight must have perspective depth');
  }
  flights.sort((a,b)=>a.rank-b.rank);
  for(let i=1;i<5;i++){assert.ok(flights[i].length>flights[0].length,`the first flight must be shortest (${w}x${h}): ${JSON.stringify(flights)}`);assert.ok(flights[i].end>flights[0].end);}
 }
});

test('each independent flight fits the desktop and portrait cameras',()=>{
 for(const [w,h] of [[1440,900],[319,667]]){
  const ratio=w/h,vh=w<760&&ratio<1.2?Math.max(8.5,6.5/ratio):Math.max(7.6,12/ratio);
  const camera=new THREE.PerspectiveCamera(36,ratio,.1,60);camera.position.set(0,.55,vh/(2*Math.tan(Math.PI/10)));camera.lookAt(0,-.05,0);camera.updateMatrixWorld();
  for(let t=.05;t<=REFERENCE_MOTION.end;t+=1/120)for(let i=0;i<5;i++){
   const p=sampleReferenceCard(i,t,cardLayout(i,w,h));if(!p.visible)continue;
   const matrix=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y,p.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx,p.ry,p.rz)),new THREE.Vector3(p.scale,p.scale,p.scale));
   for(const x of [-1,1])for(const y of [-1,1]){const q=new THREE.Vector3(x*1.025,y*1.44,0).applyMatrix4(matrix).project(camera);assert.ok(Math.abs(q.x)<=1&&Math.abs(q.y)<=1,`clipped flight ${i} at ${t} (${w}x${h})`);}
  }
 }
});
