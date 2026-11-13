import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{v=clamp((v-a)/(b-a),0,1);return v*v*(3-2*v);};

// Shared by the printed shell, pale laminate and detached seal. Untorn foil
// remains at its original height; the cut has a shallow bow and small fibres.
export function tearProfile(u){return -.080-.025*Math.sin(u*Math.PI)+.013*Math.sin(u*171)+.007*Math.sin(u*63+1.3);}
export function sampleTearLine(u,tear){
 const opened=tear>=1?1:(1-smooth(tear-.018,tear+.018,u))*smooth(.005,.035,tear);
 return 1.91+opened*tearProfile(u);
}

export function createInnerLip(surface){
 const nx=surface.userData.nx,g=new THREE.BufferGeometry(),idx=[];
 g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((nx+1)*3*3),3));
 for(let i=0;i<nx;i++)for(let row=0;row<2;row++){const a=i*3+row,b=a+3;idx.push(a,b,b+1,a,b+1,a+1);}
 g.setIndex(idx);g.userData={nx};return g;
}
export function updateInnerLip(lip,surface,tear){
 const {nx,ny}=surface.userData,p=lip.attributes.position,q=surface.attributes.position;
 for(let i=0;i<=nx;i++){
  const at=ny*(nx+1)+i,u=i/nx,open=tear>=1?1:(1-smooth(tear-.025,tear+.015,u))*smooth(.015,.12,tear);
  for(let row=0;row<3;row++)p.setXYZ(i*3+row,q.getX(at),q.getY(at)+[-.019,.017,.033][row]*open,q.getZ(at)+[.004,.005,-.043][row]*open);
 }
 p.needsUpdate=true;lip.computeVertexNormals();
}

export function createPouchSurface(side,nx=96,ny=76){
 const p=[],uv=[],indices=[];
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){p.push((i/nx-.5)*2.72,-2.04+j/ny*3.95,0);uv.push(side>0?i/nx:1-i/nx,j/ny);}
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;side>0?indices.push(a,b,d,a,d,c):indices.push(a,d,b,a,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.userData={nx,ny,side};return g;
}

export function createPouchBridges(surface){
 const {nx,ny}=surface.userData;
 const boundaries={left:Array.from({length:ny+1},(_,j)=>j*(nx+1)),right:Array.from({length:ny+1},(_,j)=>j*(nx+1)+nx),bottom:Array.from({length:nx+1},(_,i)=>i),top:Array.from({length:nx+1},(_,i)=>ny*(nx+1)+i)};
 return Object.entries(boundaries).map(([edge,boundary])=>{
  const g=new THREE.BufferGeometry(),indices=[];g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(boundary.length*6),3));
  for(let i=0;i<boundary.length-1;i++){let a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}g.setIndex(indices);g.userData={edge,boundary};return g;
 });
}

export function updatePouchGeometry(front,back,bridges,{tear=0,flex=0,time=0,reduced=false}={}){
 for(const geometry of [front,back]){
  const {nx,ny,side}=geometry.userData,p=geometry.attributes.position;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   const u=i/nx,v=j/ny,x=(u-.5)*2.72,edge=Math.exp(-Math.min(u,1-u)*17),seal=Math.exp(-Math.min(v,1-v)*22);
   const inflate=Math.pow(Math.sin(u*Math.PI),.65)*Math.pow(Math.sin(v*Math.PI),.45);
   const crease=Math.sin(u*26+v*11)*edge*.035+Math.sin(u*38-v*16)*seal*.014;
   const breathe=reduced?0:Math.sin(time*1.15+v*5+u*4)*.003;
   // Positive half-thickness prevents front/back faces crossing at a crease.
   let thickness=Math.max(.016,.024+inflate*.16+crease+breathe);
   const topCollar=smooth(.91,1,v),bottomCollar=1-smooth(0,.08,v),collar=Math.max(topCollar,bottomCollar);
   thickness=thickness*(1-collar)+(.026*topCollar+.018*bottomCollar);
   const topMask=smooth(.74,1,v),peeled=1-smooth(tear-.06,tear+.1,u);
   const y=-2.04+v*3.95+topMask*(sampleTearLine(u,tear)-1.91);
   const z=side*(thickness+topMask*peeled*smooth(0,.035,tear)*.055)+Math.sin(v*15+u*5+time*3)*flex*.018*(1-collar);
   p.setXYZ(j*(nx+1)+i,x*(1+edge*Math.sin(v*10)*.005*(1-collar)),y,z);
  }
  p.needsUpdate=true;geometry.computeVertexNormals();
 }
 // Every bridge endpoint is copied from the actual deformed face vertex.
 // No fixed-width strip can leave a gap as the pouch changes shape.
 for(const bridge of bridges){const p=bridge.attributes.position;bridge.userData.boundary.forEach((source,i)=>{for(const [n,face] of [[0,front],[1,back]]){const q=face.attributes.position;p.setXYZ(i*2+n,q.getX(source),q.getY(source),q.getZ(source));}});
  if(bridge.userData.edge==='top'){
   const count=bridge.userData.boundary.length-1,indices=[];
   for(let i=0;i<count;i++)if((i+.5)/count>=tear){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
   bridge.setIndex(indices);
  }
  p.needsUpdate=true;bridge.computeVertexNormals();}
}

export function createCrimpedSeal(w=2.77,h=.28,nx=192,ny=10,{torn=false}={}){
 const p=[],uv=[],idx=[],stride=nx+1,layer=stride*(ny+1);
 for(const side of [1,-1])for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
  const u=i/nx,v=j/ny,tooth=j===ny?Math.abs((u*48%1)-.5)*.045:0;
  const cut=torn?(h*.5-.098+tearProfile(u))*(1-smooth(0,.55,v)):0;
  p.push((u-.5)*w,(v-.5)*h+tooth+cut,side*(.040+Math.cos(u*Math.PI*96)*.006));uv.push(u,v);
 }
 for(let side=0;side<2;side++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=side*layer+j*stride+i,b=a+1,c=a+stride,d=c+1;side===0?idx.push(a,b,d,a,d,c):idx.push(a,d,b,a,c,d);}
 const edge=ids=>{for(let i=0;i<ids.length-1;i++){const a=ids[i],b=ids[i+1];idx.push(a,a+layer,b+layer,a,b+layer,b);}};
 const bottomStart=idx.length;edge(Array.from({length:nx+1},(_,i)=>nx-i));const bottomCount=idx.length-bottomStart;
 edge(Array.from({length:nx+1},(_,i)=>ny*stride+i));edge(Array.from({length:ny+1},(_,j)=>j*stride));edge(Array.from({length:ny+1},(_,j)=>(ny-j)*stride+nx));
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);const faceCount=nx*ny*6;g.addGroup(0,faceCount,0);g.addGroup(faceCount,faceCount,1);g.addGroup(bottomStart,bottomCount,torn?3:2);g.addGroup(bottomStart+bottomCount,idx.length-bottomStart-bottomCount,2);g.computeVertexNormals();g.userData={rest:Float32Array.from(p),w,h,nx,ny,torn};return g;
}

export function updateSealPeel(geometry,tear,time=0,curl=0){
 const {rest,w}=geometry.userData,p=geometry.attributes.position;
 for(let k=0;k<p.count;k++){
  const x=rest[k*3],u=x/w+.5,s=Math.max(0,tear-u)*w,y=rest[k*3+1],z=rest[k*3+2];
  // Arc length is the material coordinate s. Bending rotates each cross-section
  // rigidly; neither the printed strip nor its immutable torn edge is stretched.
  const curvature=.20*(1-.25*curl),angle=s*curvature,cs=Math.cos(angle),sn=Math.sin(angle),dy=.22,dz=Math.sqrt(1-dy*dy);
  const bow=(1-cs)/curvature,tip=(tear-.5)*w,dot=dz*y-dy*z;
  p.setXYZ(k,(s>0?tip-Math.sin(angle)/curvature:x)+(dz*z+dy*y)*sn,
   dy*bow+y*cs+dz*dot*(1-cs),dz*bow+z*cs-dy*dot*(1-cs));
 }
 p.needsUpdate=true;geometry.computeVertexNormals();
}
