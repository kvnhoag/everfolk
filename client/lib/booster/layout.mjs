export const PACK_SIZE=5;
export const isCompact=(width,height)=>width<760&&width/height<1.2;
export function cardLayout(index,width,height,count=5){
 const compact=isCompact(width,height),trackIndex=5-count+index;
 let x,y,scale;
 if(compact){
  if(count<=3){x=(index-(count-1)/2)*2.05;y=.90;scale=count===1?1.05:count===2?.90:.80;}
  else{const topCount=count===4?2:3,top=index<topCount,rowCount=top?topCount:count-topCount,j=top?index:index-topCount;x=(j-(rowCount-1)/2)*1.90;y=top?2.25:-.30;scale=.72;}
 }else{x=(index-(count-1)/2)*2.30;y=index%2?.04:-.035;scale=1;}
 return {x,y,z:.12+index*.018,rz:compact?0:(index-(count-1)/2)*-.008,scale,compact,trackIndex,count};
}
export function departure(index){return {x:(index-2)*.11,y:-.72-index*.025,z:-.32-index*.10,rx:0,ry:0,rz:0,scale:.64};}

export function legacyReviewLayout(indices,focus,width,height){
 const compact=isCompact(width,height);if(!indices.includes(focus))return [];
 const ratio=width/height,viewHeight=compact?Math.max(8.5,6.5/ratio):Math.max(7.6,12/ratio),viewWidth=viewHeight*ratio;
 const others=indices.filter(index=>index!==focus),thumbScale=compact?.36:.38,step=thumbScale*2.88+.20;
 // Keep the hero centred. All other saved cards belong to one small right rail.
 return indices.map(index=>{
  if(index===focus)return {index,x:0,y:.20,z:2.3,scale:compact?1.02:1.25,rx:0,ry:0,rz:0};
  const row=others.indexOf(index);
  return {index,x:viewWidth*.36,y:.20+((others.length-1)/2-row)*step,z:.10-row*.006,scale:thumbScale,rx:0,ry:0,rz:0};
 });
}
