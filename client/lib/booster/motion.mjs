// Individually tracked front/rear sweeps from the second reference opening.
// XY anchors follow visible faces; Z is inferred from occlusion, not a recovered camera.
export const REFERENCE_MOTION={stagger:.055,rise:.31,impactSettle:.14,end:1.82,extraFlight:.10};
export const launchRanks=[1,2,3,4,0];
export const referenceLaunchRank=(index,target)=>launchRanks[target?.trackIndex??index];
const baseImpactTime=index=>[1.50,1.38,1.26,1.14,1.02][index];
export const referenceImpactTime=(index,target)=>baseImpactTime(target?.trackIndex??index)+REFERENCE_MOTION.extraFlight;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,p)=>a+(b-a)*p;
const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a));return p*p*(3-2*p);};
// t, x, y, depth. The leading face takes the short front arc rightwards;
// the others circulate through the rear, with different radii and arrival times.
export const CARD_TRACKS=[
 [[.30,.15,.85,1.45],[.50,1.45,.75,.90],[.72,2.05,1.30,-.80],[.94,.15,1.65,-1.25],[1.18,-2.50,1.05,-.65]],
 [[.30,.10,1.15,.75],[.50,.65,1.55,-.60],[.72,-.50,1.65,-1.40],[.94,-1.85,1.05,-.25],[1.16,-2.45,.32,.35]],
 [[.30,-.05,1.45,.05],[.50,-1.25,1.60,-.20],[.72,-2.15,.85,.50],[.94,-.95,.12,1.15],[1.10,-.25,-.05,.70]],
 [[.30,-.20,1.65,-.70],[.50,-1.55,.65,1.60],[.72,-.65,-.10,2.30],[.94,1.10,-.15,1.40],[1.06,1.95,-.03,.45]],
 [[.30,-.35,.45,2.30],[.50,-.15,-.05,2.45],[.72,1.65,-.22,1.85],[.94,3.80,-.06,.50]]
];
function hermite(keys,time){
 let j=0;while(j<keys.length-2&&time>keys[j+1][0])j++;
 const a=keys[j],b=keys[j+1],prev=keys[Math.max(0,j-1)],next=keys[Math.min(keys.length-1,j+2)],dt=b[0]-a[0],u=clamp((time-a[0])/dt),u2=u*u,u3=u2*u;
 return [1,2,3].map(k=>{
  const m0=j===0?0:(b[k]-prev[k])/(b[0]-prev[0]);
  const m1=j+1===keys.length-1?0:(next[k]-a[k])/(next[0]-a[0]);
  return (2*u3-3*u2+1)*a[k]+(u3-2*u2+u)*dt*m0+(-2*u3+3*u2)*b[k]+(u3-u2)*dt*m1;
 });
}
export function sampleReferenceCard(index,time,target){
 const track=target.trackIndex??index,rank=referenceLaunchRank(index,target),start=rank*REFERENCE_MOTION.stagger,impact=referenceImpactTime(index,target),local=time-start;
 const stackZ=2.30-rank*.62;
 if(local<0)return {visible:false,x:0,y:.65,z:stackZ,rx:0,ry:0,rz:0,scale:.78,reveal:0,state:'waiting'};
 if(time>=impact){
  const p=clamp((time-impact)/REFERENCE_MOTION.impactSettle),kick=p>=1?0:Math.sin(p*Math.PI*2)*Math.exp(-p*5);
  return {...target,y:target.y+kick*.025,rx:kick*.016,ry:0,rz:target.rz+kick*.010,reveal:1,visible:true,state:p<1?'impact':'placed'};
 }
 const compact=target.compact??target.scale<.9,amount=target.count??5,spread=(compact?.60:1)*(amount===1?.14:.35+.65*(amount-1)/4),settle=smooth(.65,1,local/(impact-start)),pathTime=start+local*(baseImpactTime(track)-start)/(impact-start);
 const keys=[[start,(rank-2)*.025,.65,stackZ],...CARD_TRACKS[track].map(([t,x,y,z])=>[t,x*spread,y,z]),[baseImpactTime(track),target.x,target.y,target.z]];
 // Every track terminates at its real slot; no common orbit then fan-out.
 const [x,y,z]=hermite(keys,pathTime),arc=Math.sin(Math.PI*clamp(local/(impact-start))),tilt=smooth(.24,.46,pathTime)*(1-settle);
 return {visible:true,x,y,z,rx:(.045+z*.032)*tilt,ry:-x*.065*tilt,rz:lerp(-x*.045*arc,target.rz,settle),
  scale:lerp(.78,target.scale,smooth(.20,1,local/(impact-start))),reveal:smooth(.015,.12,local),state:'flight'};
}
export function advanceSpring(value,velocity,target,dt,frequency=21,damping=.72){
 // Substeps keep a temporarily slow browser from destabilising the hover spring.
 const steps=Math.max(1,Math.ceil(dt/.012)),h=dt/steps;
 for(let i=0;i<steps;i++){velocity+=((target-value)*frequency*frequency-2*damping*frequency*velocity)*h;value+=velocity*h;}
 return [value,velocity];
}





// Composite thin card faces by their actual 3D centre depth. This prevents two
// stylised paper planes cutting through each other's illustrations mid-circulation.
export function cardDepthOrder(poses){return poses.map((p,index)=>({index,z:p.z})).sort((a,b)=>a.z-b.z||a.index-b.index).map(p=>p.index);}
