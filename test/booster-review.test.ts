import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {legacyReviewLayout} from '../client/lib/booster/layout.mjs';
test('saved Legacy review keeps the hero centred and every thumbnail in one separate right column',()=>{
 for(let count=1;count<=5;count++)for(const [w,h] of [[1280,720],[582,667],[319,667]])for(let focus=0;focus<count;focus++){
  const slots=legacyReviewLayout(Array.from({length:count},(_,i)=>i),focus,w,h),center=slots.find(p=>p.index===focus);
  assert.equal(slots.length,count);assert.equal(new Set(slots.map(p=>p.index)).size,count);assert.equal(center.x,0);
  const thumbnails=slots.filter(p=>p.index!==focus);
  assert.ok(new Set(thumbnails.map(p=>p.x)).size<=1);
  for(const side of thumbnails){assert.ok(side.x>0);assert.ok(side.z<center.z);assert.ok(side.scale<center.scale*.4);assert.ok(side.x-side.scale*1.025>center.scale*1.025+.25);}
  for(let i=1;i<thumbnails.length;i++)assert.ok(Math.abs(thumbnails[i].y-thumbnails[i-1].y)>thumbnails[i].scale*2.88+.15);
 }
});

test('focused saved cards fit the viewport while rotating through front, edge and back views',()=>{
 for(const [w,h] of [[1280,720],[582,667],[319,667]]){
  const compact=w<760&&w/h<1.2,vh=compact?Math.max(8.5,6.5/(w/h)):Math.max(7.6,12/(w/h));
  const camera=new THREE.PerspectiveCamera(36,w/h,.1,60);camera.position.set(0,.55,vh/(2*Math.tan(Math.PI/10)));camera.lookAt(0,-.05,0);camera.updateMatrixWorld();
  const slot=legacyReviewLayout([0,1,2,3,4],2,w,h).find(p=>p.index===2);
  for(const pitch of [-1.1,-.5,0,.5,1.1])for(let yaw=0;yaw<Math.PI*2;yaw+=Math.PI/12){
   const matrix=new THREE.Matrix4().compose(new THREE.Vector3(slot.x,slot.y,slot.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0)),new THREE.Vector3(slot.scale,slot.scale,slot.scale));
   for(const x of [-1,1])for(const y of [-1,1]){const point=new THREE.Vector3(x*1.025,y*1.44,0).applyMatrix4(matrix).project(camera);assert.ok(Math.abs(point.x)<=1&&Math.abs(point.y)<=1,'rotating review card must remain in view');}
  }
 }
});
