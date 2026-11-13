import * as THREE from 'three';
import {gsap as animation} from 'gsap';
import {createPouchSurface,createPouchBridges,updatePouchGeometry,createCrimpedSeal,updateSealPeel,createInnerLip,updateInnerLip} from './pack-geometry.mjs';
import {isCompact,cardLayout,departure,legacyReviewLayout} from './layout.mjs';
import {REFERENCE_MOTION,referenceLaunchRank,sampleReferenceCard,referenceImpactTime,advanceSpring,cardDepthOrder} from './motion.mjs';
import {canCommitTear,tearProgress} from './tear-input.mjs';

import {RAINBOW,rainbowPalette,sampleRainbowState,rainbowPoint} from './rainbow.mjs';

/** Isolated canvas scene; the React owner supplies authoritative outcomes and storage. */
export function mountBooster(hostWindow,config){
 const window=hostWindow,document=window.document;
 const Image=window.Image,matchMedia=window.matchMedia.bind(window);
 const tweens=new Set();
 const track=value=>{tweens.add(value);return value;};
 const gsap={...animation,to:(...args)=>track(animation.to(...args)),fromTo:(...args)=>track(animation.fromTo(...args)),timeline:(...args)=>track(animation.timeline(...args))};
 let disposed=false,frameId=0;
 const requestAnimationFrame=cb=>frameId=window.requestAnimationFrame(cb);
 const devicePixelRatio=window.devicePixelRatio;
 const $=id=>document.getElementById(id);
 const A={pack:'/assets/booster/pack-print.png',logo:'/assets/booster/wordmark.png'};
 function toggleCardSelection(selection,index,count){const next=new Set(selection);if(index<0||index>=count)return next;next.has(index)?next.delete(index):next.add(index);return next;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,t)=>{t=clamp((t-a)/(b-a),0,1);return t*t*(3-2*t);};
const tiers=[{name:'Common',color:'#d5dcd4',power:0},{name:'Uncommon',color:'#70caa1',power:1},{name:'Rare',color:'#6ab9ed',power:2},{name:'Epic',color:'#bd9af0',power:3},{name:'Legendary',color:'#eac36e',power:4}];
const people=config.cards.map((card,tile)=>({...card,tile}));
let phase='loading', preset='signature', selected=-1, inspected=-1, hovered=-1, packNumber=0, openingTL=null, resetTL=null;
let motionPaused=false,keyboardTearHeld=false;
let selection=new Set(),desiredPackSize=config.cards.length,activePackSize=config.cards.length,packId='',legacyCount=0,reviewIndices=[];
const openingClock={time:-1};
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches, soundEnabled=true, audio=null, renderFailed=false;
let renderer,scene,camera,pack,body,strip,backBody,floor,shadow,environment,raycaster;
const pointer=new THREE.Vector2(0,0), drag={active:false,mode:'',x:0,y:0,startX:0,startY:0,distance:0,rotation:0,tearStart:0};
const foil={tear:0,flex:0,time:0,curl:0}, pose={x:0,y:.12,z:0,rx:-.025,ry:-.12,rz:-.035,scale:1,bodyScale:1,bodyDrop:0};
const inspection={x:0,y:0};
let W=window.innerWidth,H=window.innerHeight, viewWidth=12, viewHeight=7.6, clock=0, previous=performance.now(), held=false;
const cardList=[], packParts=[], pouchBridges=[], transient=[], allMaterials=new Set(), textures=new Set(), cardsFront=new Map();
const images={};
let plume;
let ready=false, quietMode=false, backgroundHidden=false, lastGeometryUpdate=0;
const fx=$('fx'),ctx=fx.getContext('2d'),particles=[],rings=[],rays=[],ambientGlints=[];
let flash=0, flashColor='#e8bc57', exposureKick=0, shake=0, stepIndex=0;
let hoverX=0,hoverY=0;

function announce(message){$('announcer').textContent=message;}
function toast(message){$('toast').textContent=message;gsap.killTweensOf($('toast'));gsap.timeline().to($('toast'),{opacity:1,duration:.18}).to($('toast'),{opacity:0,duration:.4},'+=2.7');}
function setPhase(value){phase=value;document.body.dataset.phase=value;$('stage').setAttribute('aria-busy',String(value==='opening'||value==='loading'));}
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function rounded(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function tex(canvas,crisp=false){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4;t.magFilter=crisp?THREE.NearestFilter:THREE.LinearFilter;textures.add(t);return t;}
function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('An embedded artwork could not be decoded.'));i.src=src;});}
function frontCanvas(person,level){
 const key=person.tile+':'+level;if(cardsFront.has(key))return cardsFront.get(key);
 const c=makeCanvas(768,1064),g=c.getContext('2d'),color=tiers[level].color;
 g.fillStyle=level===4?'#c99b47':'#afc4bf';rounded(g,0,0,768,1064,32);g.fill();
 g.fillStyle='#103d3d';rounded(g,7,7,754,1050,27);g.fill();g.save();rounded(g,17,17,734,1030,20);g.clip();
 g.imageSmoothingEnabled=false;g.fillStyle='#e6d4ab';g.fillRect(17,17,734,818);const art=images.cards[person.tile];const scale=Math.min(734/art.width,818/art.height);g.drawImage(art,17+(734-art.width*scale)/2,17+(818-art.height*scale)/2,art.width*scale,art.height*scale);
 g.fillStyle='#103b3d';g.fillRect(17,835,734,212);g.fillStyle=color;g.fillRect(17,835,734,3);
 g.textAlign='center';g.fillStyle='#f3e9ce';g.font=`600 ${person.name.length>13?39:51}px Eczar,Georgia,serif`;g.fillText(person.name,384,910,686);
 g.font='500 21px Arial';g.letterSpacing='7px';g.fillStyle=color;g.fillText(tiers[level].name.toUpperCase(),384,962);g.letterSpacing='1.7px';g.font='12px Arial';g.fillStyle='#adcbc0';g.fillText(person.sub,384,1012,675);g.restore();
 g.strokeStyle=level===4?'#f5d88d':'#d8e4d7';g.lineWidth=2;rounded(g,13,13,742,1038,23);g.stroke();
 if(level===4){
  // Restrained laurel engraving, exclusive to the historical Legendary frame.
  g.strokeStyle='#edc76d';g.fillStyle='#edc76d';g.lineWidth=3;
  for(const sx of [1,-1])for(const sy of [1,-1]){g.save();g.translate(sx===1?34:734,sy===1?35:1029);g.scale(sx,sy);g.beginPath();g.moveTo(0,80);g.quadraticCurveTo(8,18,73,1);g.stroke();for(let i=0;i<6;i++){const x=7+i*10,y=58-i*9;g.save();g.translate(x,y);g.rotate(-.8);g.beginPath();g.ellipse(0,0,5,12,0,0,Math.PI*2);g.fill();g.restore();}g.restore();}
 }
 cardsFront.set(key,c);return c;
}
function backCanvas(){const c=makeCanvas(768,1064),g=c.getContext('2d');g.fillStyle='#113f40';rounded(g,0,0,768,1064,30);g.fill();g.strokeStyle='#c7d5c4';g.lineWidth=3;rounded(g,14,14,740,1036,20);g.stroke();g.drawImage(images.logo,90,469,588,139);return c;}
function packPrint(){const c=makeCanvas(1024,1536),g=c.getContext('2d');g.drawImage(images.pack,0,0,1024,1536);g.fillStyle='#075052';g.fillRect(0,1420,1024,116);g.fillStyle='#f5e8c8';g.textAlign='center';g.font='500 30px Arial';g.letterSpacing='10px';g.fillText(activePackSize+' '+(activePackSize===1?'CARD':'CARDS'),512,1490);return c;}
function rearPack(){const c=makeCanvas(1024,1536),g=c.getContext('2d');g.fillStyle='#075052';g.fillRect(0,0,1024,1536);g.imageSmoothingEnabled=false;g.drawImage(packPrint(),0,400,1024,1100,0,180,1024,1356);g.drawImage(images.logo,205,90,614,145);return c;}
function foilNormal(){const c=makeCanvas(256,384),g=c.getContext('2d'),im=g.createImageData(256,384);for(let y=0;y<384;y++)for(let x=0;x<256;x++){const edge=Math.exp(-Math.min(x,255-x)/25);const n=Math.sin(x*.38+y*.05)*edge*.15+Math.sin(x*.07+y*.09)*.025;const i=(y*256+x)*4;im.data[i]=128+n*100;im.data[i+1]=128+Math.sin(x*.14+y*.1)*edge*8;im.data[i+2]=251;im.data[i+3]=255;}g.putImageData(im,0,0);return c;}
function roundedShape(w,h,r){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
function faceGeometry(w,h){const geo=new THREE.ShapeGeometry(roundedShape(w,h,.065),12);const pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/w+.5,pos.getY(i)/h+.5);return geo;}
function keepMat(m){allMaterials.add(m);return m;}
function glowTexture(color){const c=makeCanvas(256,256),g=c.getContext('2d');const grad=g.createRadialGradient(128,128,1,128,128,126);grad.addColorStop(0,color+'66');grad.addColorStop(.35,color+'2b');grad.addColorStop(1,color+'00');g.fillStyle=grad;g.fillRect(0,0,256,256);return tex(c);}
function sheenTexture(level){const c=makeCanvas(512,512),g=c.getContext('2d');const grad=g.createLinearGradient(0,512,512,0);grad.addColorStop(0,'#ffffff00');grad.addColorStop(.35,'#ffffff00');grad.addColorStop(.46,tiers[level].color+'12');grad.addColorStop(.49,'#ffffff8a');grad.addColorStop(.505,'#ffffff10');grad.addColorStop(.55,tiers[level].color+'30');grad.addColorStop(.65,'#ffffff00');grad.addColorStop(1,'#ffffff00');g.fillStyle=grad;g.fillRect(0,0,512,512);return tex(c);}
function buildCard(person,level,index){
 const group=new THREE.Group();scene.add(group);const base={...departure(index),shine:0,reveal:0};
 const shape=roundedShape(2.05,2.88,.085);const geo=new THREE.ExtrudeGeometry(shape,{depth:.042,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.018,bevelThickness:.012,curveSegments:10});geo.translate(0,0,-.023);
 const clipPlane=new THREE.Plane(new THREE.Vector3(0,1,0),100);
 const edge=new THREE.Mesh(geo,keepMat(new THREE.MeshStandardMaterial({color:level===4?'#cb9d48':tiers[level].color,roughness:.34,metalness:.68,transparent:true,depthTest:false,depthWrite:false,clippingPlanes:[clipPlane]})));edge.castShadow=true;group.add(edge);
 const face=new THREE.Mesh(faceGeometry(2.035,2.865),keepMat(new THREE.MeshBasicMaterial({map:tex(frontCanvas(person,level)),transparent:true,depthTest:false,depthWrite:false,toneMapped:false})));face.position.z=.035;group.add(face);
 const back=new THREE.Mesh(faceGeometry(2.035,2.865),keepMat(new THREE.MeshBasicMaterial({map:sharedBack,transparent:true,depthTest:false,depthWrite:false,toneMapped:false})));back.position.z=-.043;back.rotation.y=Math.PI;group.add(back);
 const sheen=new THREE.Mesh(faceGeometry(2.03,2.86),keepMat(new THREE.MeshBasicMaterial({map:sheenTexture(level),transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending})));sheen.position.z=.041;group.add(sheen);
 for(const surface of [face,back,sheen])surface.material.clippingPlanes=[clipPlane];
 const aura=new THREE.Sprite(keepMat(new THREE.SpriteMaterial({map:glows[level],transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false})));aura.scale.set(3.85,4.5,1);aura.position.z=-.09;group.add(aura);
 const selectionRim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(roundedShape(2.22,3.05,.13).getPoints(80)),keepMat(new THREE.LineBasicMaterial({color:'#126962',transparent:true,opacity:0,depthTest:false,depthWrite:false})));selectionRim.position.z=.065;selectionRim.renderOrder=6;group.add(selectionRim);
 const rarityRim=level>=3?new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(roundedShape(2.15,2.98,.12).getPoints(80)),keepMat(new THREE.LineBasicMaterial({color:tiers[level].color,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending}))):null;if(rarityRim){rarityRim.position.z=.055;rarityRim.renderOrder=5;group.add(rarityRim);}
 const card={group,base,selectionRim,rarityRim,person,level,index,face,sheen,aura,clipPlane,hover:0,hoverVelocity:0,tiltX:0,tiltY:0,tiltVelocityX:0,tiltVelocityY:0,targetHover:0,lift:0,turn:0,selected:false,screen:{x:0,y:0},burst:false};edge.userData.card=index;face.userData.card=index;back.userData.card=index;
 aura.renderOrder=0;edge.renderOrder=1;back.renderOrder=2;face.renderOrder=3;sheen.renderOrder=4;group.visible=false;cardList.push(card);return card;
}
let sharedBack,glows=[];
function createPackSurface(side,material){
 const m=new THREE.Mesh(createPouchSurface(side),material);m.castShadow=true;m.receiveShadow=true;packParts.push(m);return m;
}
function buildPack(){
 pack=new THREE.Group();scene.add(pack);const frontMap=tex(packPrint());
 const n=tex(foilNormal());n.colorSpace=THREE.NoColorSpace;
 const frontMat=keepMat(new THREE.MeshPhysicalMaterial({map:frontMap,color:'#ffffff',metalness:.22,roughness:.46,clearcoat:.12,clearcoatRoughness:.5,normalMap:n,normalScale:new THREE.Vector2(.16,.16),envMapIntensity:.6,side:THREE.DoubleSide}));
 const rearMat=keepMat(new THREE.MeshPhysicalMaterial({map:tex(rearPack()),metalness:.22,roughness:.47,clearcoat:.08,envMapIntensity:.6,side:THREE.DoubleSide}));
 body=new THREE.Group();pack.add(body);const front=createPackSurface(1,frontMat);backBody=createPackSurface(-1,rearMat);body.add(front,backBody);
 const seamMat=keepMat(new THREE.MeshStandardMaterial({color:'#087270',metalness:.32,roughness:.48,side:THREE.DoubleSide,envMapIntensity:.58}));
 const silverFoil=keepMat(new THREE.MeshStandardMaterial({color:'#fff8eb',metalness:0,roughness:.83,envMapIntensity:.25,side:THREE.DoubleSide}));
 strip=new THREE.Group();strip.position.set(0,2.02,0);const top=new THREE.Mesh(createCrimpedSeal(2.72,.28,front.geometry.userData.nx,10,{torn:true}),[seamMat,silverFoil,seamMat,silverFoil]);top.castShadow=true;strip.add(top);pack.add(strip);
 const bottom=new THREE.Mesh(createCrimpedSeal(2.77,.27),seamMat);bottom.position.set(0,-2.11,0);bottom.rotation.z=Math.PI;bottom.castShadow=true;body.add(bottom);
 const sideMaterial=keepMat(new THREE.MeshStandardMaterial({color:'#057573',roughness:.48,metalness:.25,side:THREE.DoubleSide}));
 for(const geometry of createPouchBridges(front.geometry)){const wall=new THREE.Mesh(geometry,sideMaterial);wall.castShadow=true;body.add(wall);pouchBridges.push(wall);}
 const inner=new THREE.Mesh(createInnerLip(front.geometry),silverFoil);inner.visible=false;body.add(inner);pack.userData.inner=inner;
 pack.userData.top=top;pack.userData.count=activePackSize;
 updateFoil(0);
}
function updateFoil(t){
 updatePouchGeometry(packParts[0].geometry,packParts[1].geometry,pouchBridges.map(m=>m.geometry),{tear:foil.tear,flex:foil.flex,time:t,reduced});
 if(strip&&phase!=='settled'&&phase!=='inspect')updateSealPeel(pack.userData.top.geometry,foil.tear,t,foil.curl);
 if(pack?.userData.inner){pack.userData.inner.visible=foil.tear>.015;updateInnerLip(pack.userData.inner.geometry,packParts[0].geometry,foil.tear);}
}
function init3D(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.localClippingEnabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(W,H);renderer.setClearColor('#f4efe5',1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.13;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;$('stage').append(renderer.domElement);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(disposed)return;quietMode=true;toast('The 3D context was interrupted. Close and reopen this pack to continue.');});
 scene=new THREE.Scene();scene.background=new THREE.Color('#f4efe5');scene.fog=new THREE.Fog('#f4efe5',17,35);camera=new THREE.PerspectiveCamera(36,W/H,.1,60);raycaster=new THREE.Raycaster();
 const envScene=new THREE.Scene();envScene.background=new THREE.Color('#b8c9c1');const panel=(x,y,z,w,h,bright)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(bright,bright*.98,bright*.91),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);envScene.add(m);};panel(-4,5,4,5,5,3);panel(4,2,4,2,6,1.5);panel(0,4,-4,5,2,1.8);const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(envScene,.06);scene.environment=environment.texture;pmrem.dispose();for(const child of envScene.children){child.geometry.dispose();child.material.dispose();}
 scene.add(new THREE.HemisphereLight('#fff7e3','#8caaa2',2.05));const key=new THREE.DirectionalLight('#fff2d6',2.15);key.position.set(-3.6,6.2,7.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=7;key.shadow.camera.bottom=-7;key.shadow.bias=-.0003;key.shadow.normalBias=.025;key.shadow.radius=4;scene.add(key);const fill=new THREE.DirectionalLight('#b8e7e3',.5);fill.position.set(5,1.2,4);scene.add(fill);
 floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),keepMat(new THREE.MeshStandardMaterial({color:'#f4efe5',roughness:1,metalness:0})));floor.rotation.x=-Math.PI/2;floor.position.y=-2.47;floor.receiveShadow=true;scene.add(floor);
 const c=makeCanvas(256,128),g=c.getContext('2d');const grad=g.createRadialGradient(128,64,1,128,64,100);grad.addColorStop(0,'#193d3739');grad.addColorStop(.55,'#193d371a');grad.addColorStop(1,'#193d3700');g.fillStyle=grad;g.fillRect(0,0,256,128);shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.6,2.1),keepMat(new THREE.MeshBasicMaterial({map:tex(c),transparent:true,depthWrite:false,opacity:.8})));shadow.rotation.x=-Math.PI/2;shadow.position.set(.22,-2.455,.15);scene.add(shadow);
 sharedBack=tex(backCanvas());glows=tiers.map(t=>glowTexture(t.color));buildPack();buildPlume();resize();bindStage();
}
function disposeCards(){for(const c of cardList){gsap.killTweensOf(c.base);scene.remove(c.group);c.group.traverse(o=>{o.geometry?.dispose();if(o.material){allMaterials.delete(o.material);const map=o.material.map;if(map&&map!==sharedBack&&!glows.includes(map)){map.dispose();textures.delete(map);}o.material.dispose();}});}cardList.length=0;selected=-1;inspected=-1;hovered=-1;}
function chosenCards(){return people.map((person,index)=>[index,person.rarity]);}
function cardPositions(i){return cardLayout(i,W,H,activePackSize);}
function resetPack(animate=true){
 activePackSize=desiredPackSize;selection.clear();reviewIndices=[];packId=crypto.randomUUID?.()??Date.now()+'-'+Math.random().toString(16).slice(2);
 $('again').textContent='Skip';$('keep').hidden=false;$('again').onclick=skipPack;$('back').innerHTML='Return to collection';$('inspect-tip').textContent='Drag to rotate · Arrow keys to turn · F to flip';
 if(pack&&pack.userData.count!==activePackSize){
  for(const [part,canvas] of [[packParts[0],packPrint()],[packParts[1],rearPack()]]){const old=part.material.map;part.material.map=tex(canvas);old.dispose();textures.delete(old);part.material.needsUpdate=true;}
  pack.userData.count=activePackSize;
 }
 openingTL?.kill();resetTL?.kill();motionPaused=false;gsap.killTweensOf(foil);gsap.killTweensOf(inspection);inspection.x=inspection.y=0;openingClock.time=-1;foil.curl=0;if(plume)plume.userData.releaseOrigin=null;particles.length=0;rings.length=0;rays.length=0;ambientGlints.length=0;flash=0;shake=0;exposureKick=0;stepIndex=0;selected=-1;inspected=-1;drag.active=false;held=false;keyboardTearHeld=false;
 $('actions').hidden=true;$('inspection-actions').hidden=true;$('inspect-tip').hidden=true;$('card-nav').hidden=true;$('card-nav').innerHTML='';$('keep').disabled=true;$('keep').textContent='Save to Legacy (0)';$('hint').innerHTML='Hold the top seal and drag right to tear <span class="hint-gem"></span> Drag the body to rotate';$('stage').setAttribute('aria-label','Everfolk booster pack. Hold and drag the top seal right to tear. Drag the body to rotate. Keyboard: hold Space and press Right Arrow repeatedly.');
 if(renderFailed){setPhase('sealed');fallbackPack();return;}
 disposeCards();chosenCards().forEach(([p,l],i)=>buildCard(people[p],l,i));
 // Warm the clipping and foil programs while the new deck is still hidden.
 cardList.forEach(c=>c.group.visible=true);renderer.compile(scene,camera);cardList.forEach(c=>c.group.visible=false);
 pack.visible=true;body.visible=true;strip.visible=true;strip.position.set(0,2.02,0);strip.rotation.set(0,0,0);strip.scale.set(1,1,1);foil.tear=0;foil.flex=0;
 Object.assign(pose,{x:0,y:.12,z:0,rx:-.025,ry:-.12,rz:-.035,scale:1,bodyScale:1,bodyDrop:0});body.rotation.set(0,0,0);body.scale.set(1,1,1);body.position.set(0,0,0);shadow.material.opacity=.8;
 setPhase('sealed');packNumber++;updateFoil(clock);if(animate&&!reduced){pose.x=viewWidth*.62;pose.y=.18;pose.ry=-Math.PI+.14;pose.rz=.09;pose.scale=.97;resetTL=gsap.timeline({defaults:{ease:'power3.out'}}).to(pose,{x:0,y:.12,ry:-.12,scale:1,duration:.68},0).to(pose,{rz:-.065,duration:.14,ease:'sine.inOut'},.47).to(pose,{rz:.012,duration:.14,ease:'sine.inOut'},.61).to(pose,{rz:-.035,duration:.25,ease:'sine.out'},.75);}
 announce('A new booster pack is ready. Hold and drag the top seal right to reveal '+activePackSize+' '+(activePackSize===1?'card':'cards')+'. A click will not open it.');
}
function startOpening(){
 if(!canCommitTear({mode:drag.mode,distance:drag.distance,progress:foil.tear}))return;
 keyboardTearHeld=false;
 startReferenceOpening();
}
function addPouchRelease(tl){
 tl.to(foil,{curl:1,flex:.10,duration:.24,ease:'power2.out'},'release');
 tl.to(strip.position,{x:.78,y:2.65,z:.85,duration:.28,ease:'power2.out'},'release');
 tl.to(strip.rotation,{z:-.20,x:.20,y:.10,duration:.28,ease:'power2.out'},'release');
 tl.to(strip.position,{x:2.65,y:.55,z:1.1,duration:.58,ease:'sine.in'},'release+=.28');
 tl.to(strip.rotation,{z:-.95,x:.55,y:.15,duration:.58,ease:'none'},'release+=.28');
 tl.to(strip.position,{x:3.3,y:-4.7,z:.3,duration:.75,ease:'power2.in'},'release+=.86');
 tl.to(strip.rotation,{z:-1.8,x:1.6,y:.25,duration:.75,ease:'none'},'release+=.86');
 // The intact wrapper falls away independently of the upward ribbon field.
 tl.to(pose,{bodyDrop:-.16,rz:.035,duration:.11,ease:'sine.in'},'release');
 tl.to(pose,{bodyDrop:-6.5,x:-.16,rz:-.10,rx:.12,duration:.52,ease:'power2.in'},'release+=.11');
 tl.call(()=>{body.visible=false;},null,'release+=.64');
 tl.call(()=>{strip.visible=false;},null,'release+=1.62');
 tl.to(shadow.material,{opacity:.14,duration:.65,ease:'sine.out'},'release');
 tl.call(()=>{sound('release');const p=project(new THREE.Vector3(0,1.6,.2));for(let k=0;k<5;k++)burst(p.x,p.y,k,12,false,false);},null,'release+=.10');
}
function startReferenceOpening(){
 if(!ready||phase!=='sealed')return;if(renderFailed){fallbackOpen();return;}
 drag.active=false;held=false;hovered=-1;resetTL?.kill();setPhase('opening');openingClock.time=-1;
 $('hint').textContent='A lifetime, ready to unfold…';$('stage').setAttribute('aria-label','Opening '+activePackSize+' cards. Please wait.');sound('tear');
 const release=.14;
 openingTL=gsap.timeline({defaults:{ease:'power2.inOut'},onComplete:settle});openingTL.timeScale(Number($('speed').value));
 openingTL.to(pose,{ry:0,rx:0,rz:-.045,x:0,duration:Math.min(.23,release)},0);
 openingTL.to(foil,{tear:1,flex:.38,duration:.14,ease:'power2.inOut'},0);
 openingTL.addLabel('release',release);
 openingTL.fromTo(openingClock,{time:0},{time:REFERENCE_MOTION.end,duration:REFERENCE_MOTION.end,ease:'none',immediateRender:false},'release');
 addPouchRelease(openingTL);
 cardList.forEach((c,i)=>{const at=release+referenceLaunchRank(i,cardPositions(i))*REFERENCE_MOTION.stagger;
  openingTL.call(()=>announce(c.person.name+', '+tiers[c.level].name+'.'),null,at+.22);
  openingTL.call(()=>{const p=project(c.group.position);sound('card',c.level);burst(p.x,p.y,c.level,c.level===4?42:c.level===3?26:6+c.level*4,c.level===4,c.level>=3);},null,release+Math.max(.08,referenceImpactTime(i,cardPositions(i))-.18));
  openingTL.call(()=>landingImpact(c),null,release+referenceImpactTime(i,cardPositions(i)));
 });
 if(reduced){openingTL.progress(1);for(const c of cardList){Object.assign(c.base,sampleReferenceCard(c.index,REFERENCE_MOTION.end,cardPositions(c.index)));c.group.visible=true;c.clipPlane.constant=100;}particles.length=0;rings.length=0;rays.length=0;}
}
function buildPlume(){
 plume=new THREE.Group();plume.visible=false;scene.add(plume);
 const {bands,rows}=RAINBOW,count=bands*(rows+1)*3,positions=new Float32Array(count*3),colors=new Float32Array(count*4),indices=[];
 const white=new THREE.Color('#ffffff');
 for(let band=0;band<bands;band++){
  const base=new THREE.Color(rainbowPalette[band%rainbowPalette.length]);
  for(let row=0;row<=rows;row++)for(let column=0;column<3;column++){
   const vertex=(band*(rows+1)+row)*3+column,color=base.clone().lerp(white,column===1?0:.08);
   colors.set([color.r,color.g,color.b,0],vertex*4);
   if(row<rows&&column<2){const a=vertex,b=vertex+1,c=vertex+3,d=vertex+4;indices.push(a,c,b,b,c,d);}
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,4).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
 const material=keepMat(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.98,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,fog:false}));
 const field=new THREE.Mesh(geometry,material);field.frustumCulled=false;plume.add(field);plume.userData.field=field;
}
function updatePlume(t){
 if(!plume)return;const at=phase==='opening'?openingClock.time:-1,state=sampleRainbowState(foil.tear,at,viewHeight);
 plume.visible=!reduced&&(phase==='sealed'||phase==='opening')&&state.visible;if(!plume.visible)return;
 if(phase==='opening'&&at>=0){
  const o=plume.userData.releaseOrigin??= {position:pack.position.clone(),rotation:pack.rotation.clone(),scale:pose.scale,waveStart:t};
  plume.position.copy(o.position);plume.rotation.copy(o.rotation);plume.scale.setScalar(o.scale);
 }else{plume.position.copy(pack.position);plume.rotation.copy(pack.rotation);plume.scale.setScalar(pose.scale);}
 const waveTime=phase==='opening'&&at>=0?plume.userData.releaseOrigin.waveStart+at:t;
 const {bands,rows}=RAINBOW,field=plume.userData.field,p=field.geometry.attributes.position,color=field.geometry.attributes.color;
 for(let band=0;band<bands;band++)for(let row=0;row<=rows;row++)for(let column=0;column<3;column++){
  const vertex=(band*(rows+1)+row)*3+column,u=(band+column*.5)/bands,v=row/rows,point=rainbowPoint(u,v,state,waveTime);
  p.setXYZ(vertex,point.x,point.y,point.z);color.setW(vertex,point.alpha);
 }
 p.needsUpdate=true;color.needsUpdate=true;field.material.opacity=state.opacity;
}
function settle(){
 motionPaused=false;if(!renderFailed)applyReferenceCards(REFERENCE_MOTION.end);
 if(!renderFailed)pack.visible=false;setPhase('settled');$('actions').hidden=false;
 $('stage').setAttribute('aria-label',activePackSize+' revealed cards. Click to select any cards to save. Double-click to inspect.');
 const nav=$('card-nav');nav.hidden=false;nav.innerHTML='';
 const cards=renderFailed?fallbackCards:cardList;
 cards.forEach((c,i)=>{const b=document.createElement('button');b.className='card-choice';b.textContent=c.person.name;
  b.setAttribute('aria-label','Select '+c.person.name+', '+tiers[c.level].name);b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>selectCard(i));b.addEventListener('focus',()=>{hovered=i;});b.addEventListener('blur',()=>{hovered=-1;});nav.append(b);});
 updateSelectionUI();announce('All '+activePackSize+' cards revealed. Select any cards to save, or skip this pack.');
}
function updateSelectionUI(){
 if(config.onRevealed){$('again').hidden=true;$('keep').disabled=false;$('keep').textContent='Review confirmed pack';$('keep').onclick=config.onRevealed;$('hint').textContent='Confirmed outcomes · Continue to choose your life NFT';return;}

 const cards=renderFailed?fallbackCards:cardList;
 cards.forEach((c,i)=>{c.selected=selection.has(i);});
 [...$('card-nav').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(selection.has(i))));
 $('keep').disabled=selection.size===0;$('keep').textContent='Save to Legacy ('+selection.size+')';
 $('hint').textContent=selection.size?selection.size+' of '+activePackSize+' selected · Click again to deselect':'Select any cards to keep · Double-click a card to inspect';
 if(renderFailed)[...$('fallback').querySelectorAll('img')].forEach((im,i)=>im.classList.toggle('selected',selection.has(i)));
}
function saveSelected(){
 if(phase!=='settled'||selection.size===0)return;
 try{
  legacyCount=config.onSave([...selection]);$('legacy-count').textContent='Legacy · '+legacyCount;
  reviewIndices=[...selection].sort((a,b)=>a-b);openSavedReview();
 }catch{toast('Unable to save Legacy in this browser. Your selection is still available.');}
}
function skipPack(){if(phase!=='settled')return;try{config.onSkip();}catch{toast('Unable to save this decision. Please try again.');}}
function reviewSlots(focus){return legacyReviewLayout(reviewIndices,focus,W,H);}
function focusSavedCard(index,animate=true){
 if(!reviewIndices.includes(index))return;inspected=index;inspection.x=inspection.y=0;gsap.killTweensOf(inspection);
 for(const slot of reviewSlots(index)){const c=cardList[slot.index];c.group.visible=true;gsap.killTweensOf(c.base);const {index:slotIndex,...poseSlot}=slot;gsap.to(c.base,{...poseSlot,duration:animate&&!reduced?.48:0,ease:'power3.inOut'});}
 [...$('card-nav').children].forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.card)===index)));
 $('hint').textContent=reviewIndices.length+' saved to Legacy · '+cardList[index].person.name+' · '+(reviewIndices.indexOf(index)+1)+' / '+reviewIndices.length;
 $('stage').setAttribute('aria-label','Saved Legacy review. Drag '+cardList[index].person.name+' to rotate. Click a thumbnail on the right to review that card.');announce($('hint').textContent);
}
function openSavedReview(){
 if(renderFailed){setPhase('saved');$('card-nav').hidden=true;$('keep').hidden=true;$('again').textContent='Back to memorial';$('again').onclick=config.onClose;$('hint').textContent=selection.size+' cards saved to your local Legacy';return;}
 setPhase('review');$('actions').hidden=true;$('inspection-actions').hidden=false;$('inspect-tip').hidden=false;$('inspect-tip').textContent='Drag to rotate · Choose a card on the right · F to flip';$('back').textContent='Back to memorial';
 cardList.forEach((c,i)=>{if(!reviewIndices.includes(i))c.group.visible=false;});
 const nav=$('card-nav');nav.innerHTML='';nav.hidden=false;
 reviewIndices.forEach(index=>{const b=document.createElement('button');b.className='card-choice';b.dataset.card=String(index);b.textContent=cardList[index].person.name;b.setAttribute('aria-label','Review '+cardList[index].person.name);b.setAttribute('aria-pressed','false');b.onclick=()=>focusSavedCard(index);nav.append(b);});
 focusSavedCard(reviewIndices[0]);
}
function applyReferenceCards(time){
 for(const c of cardList){const p=sampleReferenceCard(c.index,time,cardPositions(c.index));Object.assign(c.base,p);c.group.visible=p.visible;c.clipPlane.constant=time<.42?-(pose.y+pose.bodyDrop+1.89*pose.bodyScale-.025):100;}
}
function landingImpact(c){
 if(reduced)return;
 const place=cardPositions(c.index),p=project(new THREE.Vector3(place.x,place.y-1.20*place.scale,place.z));
 const unit=W/viewWidth,radius=Math.max(18,Math.min(72,unit*.56));
 rings.push({x:p.x,y:p.y,r:6,maxR:radius,life:.22,max:.22,color:tiers[c.level].color,width:c.level===4?2:1.4});
 for(let i=0;i<5+c.level*2;i++){const side=i%2?1:-1;particles.push({x:p.x+side*Math.random()*radius*.6,y:p.y,vx:side*(35+Math.random()*65),vy:-20-Math.random()*25,life:.15+Math.random()*.13,max:.28,size:1+Math.random()*2,color:tiers[c.level].color,rot:0,spin:0,star:false,gravity:190});}
}
function selectCard(index){
 if(phase!=='settled')return;
 selected=index;selection=toggleCardSelection(selection,index,activePackSize);updateSelectionUI();
 const c=(renderFailed?fallbackCards:cardList)[index];announce(c.person.name+(selection.has(index)?' selected.':' deselected.'));sound('select',c.level);
}
function inspectCard(index){if(phase!=='settled'||renderFailed)return;selected=index;inspectSelected();}
function inspectSelected(){if(phase!=='settled'||selected<0)return;if(renderFailed){toast('Collection — '+fallbackCards[selected].person.name+' selected. No NFT was minted.');return;}inspection.x=inspection.y=0;inspected=selected;setPhase('inspect');$('actions').hidden=true;$('card-nav').hidden=true;$('inspection-actions').hidden=false;$('inspect-tip').hidden=false;$('hint').textContent=cardList[selected].person.name+' · '+tiers[cardList[selected].level].name+' · Personal collection';$('stage').setAttribute('aria-label','Close-up of '+cardList[selected].person.name+'. Drag to rotate and see the back. Arrow keys rotate, F flips, Escape returns.');
 cardList.forEach((c,i)=>{if(i===selected)gsap.to(c.base,{x:0,y:.30,z:2.3,scale:1.4,rx:0,rz:0,ry:0,duration:reduced?0:.65,ease:'power3.inOut'});else gsap.to(c.base,{x:(i<selected?-1:1)*(viewWidth+2+Math.abs(i-selected)*2.3),scale:.6,z:-1,duration:reduced?0:.5,ease:'power2.inOut',onComplete:()=>{if(phase==='inspect')c.group.visible=false;}});});announce('Close-up of '+cardList[selected].person.name+'. Drag to rotate the card, or press F to view its back. No NFT has been minted.');}
function flipCard(){if(phase!=='inspect'&&phase!=='review')return;gsap.to(inspection,{x:0,y:(Math.round(inspection.y/Math.PI)+1)*Math.PI,duration:reduced?0:.6,ease:'power2.inOut'});}
function returnCollection(){if(phase!=='inspect')return;gsap.killTweensOf(inspection);inspection.x=inspection.y=0;cardList.forEach((c,i)=>{gsap.killTweensOf(c.base);c.group.visible=true;const p=cardPositions(i);gsap.to(c.base,{x:p.x,y:p.y,z:p.z,rz:p.rz,rx:0,ry:0,scale:p.scale,duration:reduced?0:.6,ease:'power3.inOut'});});inspected=-1;setPhase('settled');$('inspection-actions').hidden=true;$('inspect-tip').hidden=true;$('actions').hidden=false;$('card-nav').hidden=false;$('stage').setAttribute('aria-label','Five revealed cards. Hover to inspect. Click a card to select it.');updateSelectionUI();}
function project(v){if(!camera)return {x:W*.5,y:H*.5};const p=v.clone().project(camera);return {x:(p.x*.5+.5)*W,y:(-.5*p.y+.5)*H};}
function burst(x,y,level,count,big,withRing=true){if(reduced)return;const color=tiers[level].color;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=(big?105:50)+Math.random()*(big?230:130);particles.push({x:x+(Math.random()-.5)*45,y:y+(Math.random()-.5)*60,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(big?60:15),life:1.2+Math.random()*1.2,max:2.4,size:1+Math.random()*(big?5:3),color,rot:Math.random()*6,spin:(Math.random()-.5)*6,star:i%9===0,gravity:big?60:35});}
 const unit=W/viewWidth;
 if(level>0&&withRing)rings.push({x,y,r:15,maxR:big?Math.min(240,Math.max(65,unit*1.5)):Math.min(160,unit*1.2),life:big?1.5:.95,max:big?1.5:.95,color,width:big?2:1});
 if(big){for(let i=0;i<20;i++)rays.push({x,y,a:i*Math.PI/10+Math.random()*.1,len:unit*(.25+Math.random()*.4),start:unit*(.75+Math.random()*.3),life:1.3,max:1.3,color});}
}
function star(x,y,size,color,alpha){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size*.22,y-size*.22);ctx.lineTo(x+size,y);ctx.lineTo(x+size*.22,y+size*.22);ctx.lineTo(x,y+size);ctx.lineTo(x-size*.22,y+size*.22);ctx.lineTo(x-size,y);ctx.lineTo(x-size*.22,y-size*.22);ctx.closePath();ctx.fill();ctx.restore();}
function drawFX(dt){ctx.clearRect(0,0,W,H);if(reduced)return;
 for(const c of cardList){if(c.level<3||!c.group.visible||c.base.reveal<.8||phase==='sealed'||phase==='loading')continue;
  const gate=phase==='opening'?smooth(.35,.75,openingClock.time):1;if(gate===0)continue;
  c.group.updateMatrixWorld();const n=c.level===4?6:3,color=tiers[c.level].color;
  for(let k=0;k<n;k++){
   const distance=((clock*(c.level===4?.075:.055)+k/n)%1)*4;let x,y;
   if(distance<1){x=-1.13+distance*2.26;y=1.56;}else if(distance<2){x=1.13;y=1.56-(distance-1)*3.12;}else if(distance<3){x=1.13-(distance-2)*2.26;y=-1.56;}else{x=-1.13;y=-1.56+(distance-3)*3.12;}
   const p=project(c.group.localToWorld(new THREE.Vector3(x,y,.08)));ctx.shadowBlur=7;ctx.shadowColor=color;star(p.x,p.y,c.level===4?3.4:2.7,color,(.50+.25*Math.sin(clock*2+k))*gate);ctx.shadowBlur=0;
  }
 }
 if(flash>.001){ctx.fillStyle=flashColor;ctx.globalAlpha=flash;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;flash*=Math.pow(.03,dt);}
 for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.life-=dt;const p=1-r.life/r.max;r.r=mix(25,r.maxR,1-(1-p)**3);ctx.strokeStyle=r.color;ctx.globalAlpha=Math.max(0,r.life/r.max)*.65;ctx.lineWidth=r.width;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.76,0,0,Math.PI*2);ctx.stroke();if(r.life<=0)rings.splice(i,1);}ctx.globalAlpha=1;
 for(let i=rays.length-1;i>=0;i--){const r=rays[i];r.life-=dt;const p=1-r.life/r.max,offset=p*80;ctx.strokeStyle=r.color;ctx.globalAlpha=clamp(r.life/r.max,0,1)*.75;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(r.x+Math.cos(r.a)*(r.start+offset),r.y+Math.sin(r.a)*(r.start+offset));ctx.lineTo(r.x+Math.cos(r.a)*(r.start+r.len+offset),r.y+Math.sin(r.a)*(r.start+r.len+offset));ctx.stroke();if(r.life<=0)rays.splice(i,1);}ctx.globalAlpha=1;
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.4,dt);p.vy+=p.gravity*dt;p.rot+=p.spin*dt;const a=clamp(p.life/.6,0,1);if(p.star)star(p.x,p.y,p.size*1.7,p.color,a);else{ctx.save();ctx.globalAlpha=a;ctx.translate(Math.round(p.x),Math.round(p.y));ctx.rotate(p.rot);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,Math.max(1,p.size*.6));ctx.restore();}if(p.life<=0)particles.splice(i,1);}
 if((phase==='settled'||phase==='inspect'||phase==='review')&&Math.random()<dt*.8){const c=cardList.filter(c=>c.level>0)[Math.floor(Math.random()*cardList.filter(c=>c.level>0).length)];if(c){const p=project(c.group.position);ambientGlints.push({x:p.x+(Math.random()-.5)*120,y:p.y+(Math.random()-.5)*180,life:.8,max:.8,color:tiers[c.level].color,size:3+Math.random()*3});}}
 for(let i=ambientGlints.length-1;i>=0;i--){const p=ambientGlints[i];p.life-=dt;star(p.x,p.y,p.size,p.color,Math.sin(clamp(p.life/p.max,0,1)*Math.PI)*.75);if(p.life<=0)ambientGlints.splice(i,1);}
}
function sound(kind,level=0){if(!soundEnabled)return;try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const now=audio.currentTime,master=audio.createGain();master.gain.value=.14;master.connect(audio.destination);
 const tone=(f,time,dur,vol,type='sine')=>{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;o.connect(g);g.connect(master);g.gain.setValueAtTime(0,now+time);g.gain.linearRampToValueAtTime(vol,now+time+.015);g.gain.exponentialRampToValueAtTime(.0001,now+time+dur);o.start(now+time);o.stop(now+time+dur+.04);};
 if(kind==='tear'||kind==='release'){const dur=kind==='tear'?.65:.3,buf=audio.createBuffer(1,audio.sampleRate*dur,audio.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length)*(.5+.5*Math.sin(i*.0008));const n=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();n.buffer=buf;filter.type='highpass';filter.frequency.value=kind==='tear'?1600:650;g.gain.value=.2;n.connect(filter);filter.connect(g);g.connect(master);n.start();n.stop(now+dur);if(kind==='release')tone(220,0,.3,.25);}
 else if(kind==='select'){tone(370+level*65,0,.2,.12);tone(740+level*65,.04,.25,.07);}
 else{const notes=level===4?[261.63,329.63,392,523.25,783.99]:level===3?[293.66,440,587.33]:level===2?[329.63,493.88,659.25]:level===1?[349.23,523.25]:[440];notes.forEach((n,i)=>tone(n,i*.075,level===4?1.7:.7,.19/(i*.3+1),'sine'));if(level===4)tone(130.81,0,1.5,.18);}
 setTimeout(()=>master.disconnect(),3500);
 }catch{soundEnabled=false;updateSound();}}
function updateSound(){$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Turn sound off':'Turn sound on');$('sound').title=(soundEnabled?'Sound on':'Sound off')+' · S';$('sound').innerHTML=soundEnabled?'<svg viewBox="0 0 24 24"><path d="M4 10h4l5-4v12l-5-4H4zM17 8q4 4 0 8m2-11q7 7 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="M4 10h4l5-4v12l-5-4H4z"/><path class="off" d="m17 9 5 6m0-6-5 6"/></svg>';}
function hitAt(x,y){if(!raycaster)return null;pointer.set(x/W*2-1,-y/H*2+1);raycaster.setFromCamera(pointer,camera);if(phase==='sealed'){return raycaster.intersectObject(pack,true).find(h=>h.object.visible)||null;}if(phase==='settled'||phase==='inspect'||phase==='review'){const hit=raycaster.intersectObjects(cardList.filter(c=>c.group.visible).map(c=>c.group),true).find(h=>h.object.userData.card!==undefined);return hit||null;}return null;}
function handleSealKeyDown(e){
 if(phase!=='sealed')return;
 if(e.code==='Enter'){e.preventDefault();toast('Drag the top seal right, or hold Space and press Right Arrow repeatedly.');}
 if(e.code==='Space'){e.preventDefault();if(!keyboardTearHeld){keyboardTearHeld=true;drag.mode='keyboard-tear';drag.distance=0;gsap.killTweensOf(foil);toast('Hold Space and press Right Arrow repeatedly to tear the seal.');}}
 if(e.code==='ArrowRight'&&keyboardTearHeld){e.preventDefault();drag.distance+=24;foil.tear=Math.min(.99,foil.tear+.14);foil.flex=foil.tear*.75;startOpening();}
}
function handleSealKeyUp(e){
 if(e.code!=='Space')return;keyboardTearHeld=false;
 if(phase==='sealed')gsap.to(foil,{flex:0,duration:.3});
}
function bindStage(){const stage=$('stage');
 stage.addEventListener('dblclick',e=>{if(phase!=='settled')return;const hit=hitAt(e.clientX,e.clientY);if(hit?.object.userData.card!==undefined)inspectCard(hit.object.userData.card);});
 stage.addEventListener('pointerdown',e=>{if(e.button!==0||phase==='opening')return;const hit=hitAt(e.clientX,e.clientY);if(!hit&&phase!=='inspect')return;if(phase==='review'&&hit?.object.userData.card!==undefined&&hit.object.userData.card!==inspected){focusSavedCard(hit.object.userData.card);return;}stage.setPointerCapture(e.pointerId);drag.active=true;held=true;drag.x=drag.startX=e.clientX;drag.y=drag.startY=e.clientY;drag.distance=0;drag.rotation=pose.ry;drag.mode=phase==='inspect'||phase==='review'?'inspect':'rotate';if(phase==='inspect'||phase==='review')gsap.killTweensOf(inspection);if(phase==='sealed'){const local=pack.worldToLocal(hit.point.clone());if(local.y>1.68&&Math.cos(pose.ry)>.5){drag.mode='tear';drag.tearStart=foil.tear;gsap.killTweensOf(foil);sound('tear');}}});
 stage.addEventListener('pointermove',e=>{hoverX=e.clientX/W*2-1;hoverY=e.clientY/H*2-1;const hit=hitAt(e.clientX,e.clientY);if(drag.active&&(phase==='sealed'||phase==='inspect'||phase==='review')){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.distance=Math.max(drag.distance,Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY));if(drag.mode==='inspect'){inspection.y+=dx*.012;inspection.x=clamp(inspection.x+dy*.006,-1.1,1.1);}else if(drag.mode==='tear'){foil.tear=Math.max(foil.tear,Math.min(.99,drag.tearStart+tearProgress(e.clientX-drag.startX,e.clientY-drag.startY,W)));foil.flex=foil.tear*.75;if(canCommitTear({mode:drag.mode,distance:drag.distance,progress:foil.tear}))startOpening();}else{pose.ry+=dx*.012;pose.rx=clamp(pose.rx+dy*.006,-.55,.55);foil.flex=clamp(Math.abs(dx)*.08,0,.65);}drag.x=e.clientX;drag.y=e.clientY;stage.style.cursor=drag.mode==='tear'?'ew-resize':'grabbing';}
 else{hovered=hit?.object.userData.card??-1;if(phase==='sealed'&&hit){const local=pack.worldToLocal(hit.point.clone());stage.style.cursor=local.y>1.68?'ew-resize':'grab';}else stage.style.cursor=hovered>=0?'pointer':phase==='sealed'?'default':'default';}
 });
 const release=e=>{if(!drag.active)return;const was=drag.mode,dist=drag.distance;drag.active=false;held=false;stage.style.cursor='grab';try{stage.releasePointerCapture(e.pointerId);}catch{}if(phase==='sealed'){if(was==='tear'){if(canCommitTear({mode:was,distance:dist,progress:foil.tear}))startOpening();else{gsap.to(foil,{flex:0,duration:.3});$('hint').textContent='Hold the remaining seal and continue dragging right to finish the tear.';}}else if(dist<7){toast('Hold the top seal and drag right to tear the pack.');}else gsap.to(foil,{flex:0,duration:.7});}else if(phase==='settled'&&dist<8){const hit=hitAt(e.clientX,e.clientY);if(hit?.object.userData.card!==undefined)selectCard(hit.object.userData.card);}};
 stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',()=>{drag.active=false;held=false;if(phase==='sealed')gsap.to(foil,{flex:0,duration:.3});});stage.addEventListener('lostpointercapture',()=>{drag.active=false;held=false;});stage.addEventListener('pointerleave',()=>{if(!drag.active)hovered=-1;});
 stage.addEventListener('keyup',handleSealKeyUp);
 stage.addEventListener('keydown',e=>{handleSealKeyDown(e);if((phase==='inspect'||phase==='review')&&e.key.startsWith('Arrow')){e.preventDefault();gsap.killTweensOf(inspection);if(e.key==='ArrowLeft')inspection.y-=.3;if(e.key==='ArrowRight')inspection.y+=.3;if(e.key==='ArrowUp')inspection.x=clamp(inspection.x-.15,-1.1,1.1);if(e.key==='ArrowDown')inspection.x=clamp(inspection.x+.15,-1.1,1.1);}});
}
function resize(){W=window.innerWidth;H=window.innerHeight;const ratio=W/H;viewHeight=isCompact(W,H)?Math.max(8.5,6.5/ratio):Math.max(7.6,12/ratio);viewWidth=viewHeight*ratio;
 // The distant portrait camera looks beyond the studio shadow receiver. Use the paper background there.
 if(floor)floor.visible=!isCompact(W,H);
 if(renderer&&camera){renderer.setSize(W,H);camera.aspect=ratio;camera.position.set(0,.55,viewHeight/(2*Math.tan(THREE.MathUtils.degToRad(18))));camera.lookAt(0,-.05,0);camera.updateProjectionMatrix();if(phase==='settled')cardList.forEach((c,i)=>{if(!openingTL?.isActive()){const p=cardPositions(i);Object.assign(c.base,p);}});}
 if(phase==='review'&&inspected>=0)focusSavedCard(inspected,false);
 const dpr=Math.min(devicePixelRatio,1.7);fx.width=Math.round(W*dpr);fx.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
function frame(now){if(disposed)return;requestAnimationFrame(frame);const dt=motionPaused?0:Math.min((now-previous)/1000,.04);previous=now;if(backgroundHidden||quietMode)return;clock+=dt;
 if(renderer&&ready){
  if(phase==='sealed'||phase==='opening'){const idle=(!reduced&&phase==='sealed'&&!drag.active)?Math.sin(clock*1.2)*.015:0;pack.position.set(pose.x,pose.y+idle,pose.z);pack.rotation.set(pose.rx,pose.ry,pose.rz);pack.scale.setScalar(pose.scale);body.scale.y=pose.bodyScale;body.position.y=pose.bodyDrop;strip.visible=phase==='sealed'||openingClock.time<1.62; if(now-lastGeometryUpdate>32){updateFoil(clock);lastGeometryUpdate=now;}foil.flex*=Math.pow(.6,dt);}
  if(phase==='opening'&&openingClock.time>=0)applyReferenceCards(openingClock.time);
  updatePlume(clock);
  cardDepthOrder(cardList.map(c=>({z:c.base.z+c.hover*.12}))).forEach((index,layer)=>{cardList[index].group.renderOrder=20+layer*10;});
  cardList.forEach((c,i)=>{if(!c.group.visible)return;const active=phase==='review'?inspected===i:(hovered===i||c.selected||phase==='inspect'&&inspected===i)&&phase!=='opening';if(reduced){c.hover=active?1:0;c.hoverVelocity=0;}else [c.hover,c.hoverVelocity]=advanceSpring(c.hover,c.hoverVelocity,active?1:0,dt);const p=c.base,idle=0;
   const closeup=(phase==='inspect'||phase==='review')&&inspected===i;
   const mouseOver=hovered===i&&phase==='settled';const halfWidth=W/viewWidth*2.05*p.scale*.5,halfHeight=halfWidth*2.88/2.05;
   const localX=clamp(((hoverX+1)*W*.5-c.screen.x)/Math.max(halfWidth,1),-1,1),localY=clamp(((hoverY+1)*H*.5-c.screen.y)/Math.max(halfHeight,1),-1,1);
   if(reduced){c.tiltX=c.tiltY=0;c.tiltVelocityX=c.tiltVelocityY=0;}else{[c.tiltX,c.tiltVelocityX]=advanceSpring(c.tiltX,c.tiltVelocityX,mouseOver?-localY*.075:0,dt);[c.tiltY,c.tiltVelocityY]=advanceSpring(c.tiltY,c.tiltVelocityY,mouseOver?localX*.105:0,dt);}
   c.group.position.set(p.x,p.y+idle+(phase==='review'?0:c.hover*.16),p.z+c.hover*.12);c.group.scale.setScalar(p.scale*(1+(phase==='review'?0:c.hover*.025)));c.group.rotation.set(p.rx+(closeup?inspection.x:c.tiltX),p.ry+(closeup?inspection.y:c.tiltY),p.rz);
   const vip=c.level>=3,gate=phase==='opening'?smooth(.35,.75,openingClock.time):1,pulse=reduced?1:.92+.08*Math.sin(clock*1.7+i);
   c.aura.material.opacity=(vip?(c.level===4?.70:.48)*pulse*gate:(c.level===0?.018:.055+c.level*.012))*p.reveal+c.hover*.055;
   if(c.rarityRim)c.rarityRim.material.opacity=(c.level===4?.80:.58)*pulse*p.reveal*gate;
   c.selectionRim.material.opacity=c.selected&&phase==='settled'?.95:0;
   c.sheen.material.opacity=c.level===0?c.hover*.035:(.08+c.level*.018+c.hover*.17)*p.reveal;
   if(!reduced){const sweep=Math.sin(clock*.5+i*1.4)*.45+hoverX*.14;c.sheen.material.map.offset.set(sweep,0);c.sheen.material.map.wrapS=THREE.RepeatWrapping;}
   c.screen=project(c.group.position);
   const choice=phase==='review'?[...$('card-nav').children].find(b=>Number(b.dataset.card)===i):$('card-nav').children[i];if(choice&&(phase==='settled'||phase==='review')){
    c.group.updateMatrixWorld();const corner=project(c.group.localToWorld(new THREE.Vector3(.86,1.25,.08)));choice.style.left=corner.x+'px';choice.style.top=corner.y+'px';
   }
  });
  const jitter=reduced?0:shake;renderer.domElement.style.transform=jitter>.08?`translate(${(Math.random()-.5)*jitter}px,${(Math.random()-.5)*jitter}px)`:'none';shake*=Math.pow(.012,dt);renderer.toneMappingExposure=1.13+exposureKick;exposureKick*=Math.pow(.01,dt);renderer.render(scene,camera);
 }
 drawFX(dt);
}
let fallbackCards=[];
function fallbackPack(){
 const f=$('fallback');f.hidden=false;f.innerHTML='';const b=document.createElement('button');b.className='fallback-pack';b.style.touchAction='none';b.setAttribute('aria-label','Hold the top seal and drag right to open. Keyboard: hold Space and press Right Arrow repeatedly.');const im=document.createElement('img');im.src=packPrint().toDataURL();im.alt='Everfolk temple-print booster with '+activePackSize+' cards';im.draggable=false;b.append(im);f.append(b);
 b.onclick=e=>{e.preventDefault();if(phase==='sealed')toast('Hold the top seal and drag right to tear the pack.');};
 b.onkeydown=handleSealKeyDown;b.onkeyup=handleSealKeyUp;
 b.onpointerdown=e=>{const r=im.getBoundingClientRect();if(e.button!==0||e.clientY>r.top+r.height*.18)return;b.setPointerCapture(e.pointerId);drag.active=true;drag.mode='tear';drag.distance=0;drag.startX=e.clientX;drag.startY=e.clientY;};
 b.onpointermove=e=>{if(!drag.active)return;drag.distance=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY);foil.tear=tearProgress(e.clientX-drag.startX,e.clientY-drag.startY,W);startOpening();};
 const end=()=>{drag.active=false;if(phase==='sealed')foil.tear=0;};b.onpointerup=end;b.onpointercancel=end;b.onlostpointercapture=end;
}
function fallbackOpen(){fallbackCards=chosenCards().map(([i,l])=>({person:people[i],level:l}));const f=$('fallback');f.innerHTML='';fallbackCards.forEach((c,i)=>{const im=document.createElement('img');im.src=frontCanvas(c.person,c.level).toDataURL();im.alt=c.person.name+', '+tiers[c.level].name;im.tabIndex=0;im.onclick=()=>selectCard(i);im.onkeydown=e=>{if(e.key==='Enter')selectCard(i);};f.append(im);});settle();$('card-nav').hidden=true;}
function setMotion(value){reduced=value;$('motion').setAttribute('aria-pressed',String(value));if(value){openingTL?.isActive()&&openingTL.progress(1);resetTL?.progress(1);particles.length=0;rings.length=0;rays.length=0;flash=0;shake=0;}toast(value?'Reduced motion enabled.':'Full animation enabled.');}
function bindUI(){
 if(config.onRevealed)document.querySelector('.version').textContent='WEAVE MODE · VERIFIED PACK';
 $('collection-close').onclick=config.onClose;
 $('sound').onclick=()=>{soundEnabled=!soundEnabled;updateSound();if(soundEnabled)sound('select');};
 $('lab-toggle').onclick=()=>{const open=$('lab').hidden;$('lab').hidden=!open;$('lab-toggle').setAttribute('aria-expanded',String(open));};
 $('pack-size').value=String(activePackSize);
 $('preset').onchange=e=>{preset=e.target.value;toast('Next pack: '+e.target.selectedOptions[0].textContent);};
 $('speed').onchange=()=>openingTL?.timeScale(Number($('speed').value));
 $('motion').setAttribute('aria-pressed',String(reduced));$('motion').onclick=()=>setMotion(!reduced);
 $('reset-lab').onclick=()=>{resetPack();$('lab').hidden=true;$('lab-toggle').setAttribute('aria-expanded','false');};
 $('again').onclick=skipPack;$('keep').onclick=saveSelected;$('back').onclick=()=>{if(phase==='review')config.onClose();else returnCollection();};$('flip').onclick=flipCard;
 document.addEventListener('keydown',e=>{if(e.target.matches('select,input,textarea'))return;if(e.key.toLowerCase()==='p'&&phase==='opening'&&!e.repeat){e.preventDefault();motionPaused=!motionPaused;openingTL?.paused(motionPaused);toast(motionPaused?'Motion paused. Press P to resume.':'Motion resumed.');}if(e.key.toLowerCase()==='f'&&(phase==='inspect'||phase==='review')){e.preventDefault();flipCard();}if(e.key.toLowerCase()==='s'){$('sound').click();}if(e.key==='Escape'){if(phase==='inspect')returnCollection();else if(phase==='review')config.onClose();$('lab').hidden=true;$('lab-toggle').setAttribute('aria-expanded','false');}});
 document.addEventListener('visibilitychange',()=>{backgroundHidden=document.hidden;if(audio){if(document.hidden)audio.suspend();else if(soundEnabled)audio.resume();}});
 motionQuery.addEventListener('change',motionChange);
 window.addEventListener('resize',resize);window.addEventListener('blur',()=>{drag.active=false;held=false;hovered=-1;keyboardTearHeld=false;if(phase==='sealed')gsap.to(foil,{flex:0,duration:.3});});
}
async function boot(){try{
 const assets=await Promise.all([loadImage(A.pack),loadImage(A.logo),Promise.all(people.map(person=>loadImage(person.art))),document.fonts.load('600 40px Eczar')]);if(disposed)return;images.pack=assets[0];images.logo=assets[1];images.cards=assets[2];
 try{init3D();}catch(err){renderFailed=true;console.warn('WebGL unavailable; using accessible cards.',err);toast('3D is unavailable in this browser. Showing accessible cards.');}
 bindUI();updateSound();legacyCount=config.legacyCount||0;$('legacy-count').textContent='Legacy · '+legacyCount;ready=true;resetPack(false);$('stage').setAttribute('aria-busy','false');$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,reduced?0:430);requestAnimationFrame(frame);
 if(config.reviewIndices?.length){if(renderFailed){fallbackOpen();}selection=new Set(config.reviewIndices);reviewIndices=[...config.reviewIndices];cardList.forEach(c=>{Object.assign(c.base,cardPositions(c.index),{reveal:1});c.group.visible=true;c.clipPlane.constant=100;});if(pack)pack.visible=false;openSavedReview();}
 config.onReady?.();
 }catch(err){console.error(err);$('loading').querySelector('p').textContent='Unable to load this pack. Close and try again.';}}
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),motionChange=e=>setMotion(e.matches);
boot();
return ()=>{disposed=true;window.cancelAnimationFrame(frameId);motionQuery.removeEventListener('change',motionChange);window.removeEventListener('resize',resize);for(const tween of tweens)tween.kill();audio?.close();scene?.traverse(object=>object.geometry?.dispose());for(const material of allMaterials)material.dispose();for(const texture of textures)texture.dispose();environment?.dispose();renderer?.dispose();renderer?.forceContextLoss();};
}
