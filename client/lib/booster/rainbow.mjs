// Fixed stripe coordinates expose only new rays at the moving cut, not all colors at once.
import {sampleTearLine} from './pack-geometry.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const p=clamp((x-a)/(b-a));return p*p*(3-2*p);};
export const RAINBOW={bands:40,rows:40,bloomDuration:.10,detachAt:.46,exitAt:1.08,mouthLeft:-1.275,mouthWidth:2.55};
export const rainbowPalette=['#ff4e9f','#ff8754','#ffd341','#a6df55','#3ad4b4','#4aaef1','#8c75ed','#c46dde'];
export function sampleRainbowState(progress,openingTime,viewHeight=7.6){
 const p=clamp(progress),released=p>=.999&&openingTime>=0;
 const bloom=released?1-Math.pow(1-clamp(openingTime/RAINBOW.bloomDuration),3):0;
 return {progress:p,released,visible:p>.012&&(!released||openingTime<RAINBOW.exitAt),
  left:RAINBOW.mouthLeft,right:RAINBOW.mouthLeft+RAINBOW.mouthWidth*p,width:RAINBOW.mouthWidth*p,
  height:(.18+1.72*Math.sqrt(p))+(released?1.95*bloom:0),
  // The field stays anchored. A curved alpha boundary consumes it bottom-up.
  erase:released?smooth(RAINBOW.detachAt,RAINBOW.exitAt,openingTime):0,lift:0,
  detached:released&&openingTime>=RAINBOW.detachAt,opacity:.98*smooth(0,.035,p)};
}
export function rainbowPoint(u,v,state,time){
 const cut=state.progress,q=Math.min(u,cut),born=smooth(u-.005,u+.045,cut);
 const angle=(q-.5)*1.25,r=v*state.height;
 const wave=Math.sin(v*15-time*5+q*7)*.055*v;
 const curvedWipe=state.erase>0?smooth(state.erase+.16*(1-(q*2-1)**2)*Math.sin(state.erase*Math.PI)-.035,state.erase+.16*(1-(q*2-1)**2)*Math.sin(state.erase*Math.PI)+.045,v):1;
 return {x:RAINBOW.mouthLeft+q*RAINBOW.mouthWidth+Math.sin(angle)*r*.95+wave-v*.24,
  y:sampleTearLine(q,cut)+Math.cos(angle)*r*(.35+.65*born)+Math.sin(q*15-time*2)*.035*v*v,
  z:-.20+Math.sin(v*11-time*4+q*5)*.018*v,
  alpha:u>cut?0:born*(1-smooth(.73,1,v))*curvedWipe};
}
