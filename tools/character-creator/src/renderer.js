import { SKINS, CLOTH, HAIR, ACCENTS, PALETTE_CORE } from './data.js';
import { drawHistoricalScene } from './historical-scenes.js';
import { drawHistoricalFrame } from './historical-frame.js';
export const WIDTH=64, HEIGHT=96;
// All raster primitives use integer pixels; no antialiased paths or scaled source art.
export function painter(ctx) {
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
  const line=(x0,y0,x1,y1,c,w=1)=>{x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;for(let i=0;i<500;i++){rect(x0,y0,w,w,c);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}};
  const poly=(points,c)=>{const min=Math.ceil(Math.min(...points.map(p=>p[1]))),max=Math.floor(Math.max(...points.map(p=>p[1])));for(let y=min;y<=max;y++){let xs=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)rect(Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1,c);}};
  const oval=(x,y,w,h,c)=>{for(let row=0;row<h;row++){const t=(row+.5-h/2)/(h/2),span=Math.sqrt(Math.max(0,1-t*t))*w/2;rect(Math.ceil(x+w/2-span),y+row,Math.max(1,Math.floor(x+w/2+span)-Math.ceil(x+w/2-span)),1,c);}};
  return {rect,line,poly,oval};
}
export function drawCharacter(canvas,s,view='front',mode='color',frame=0) {
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.imageSmoothingEnabled=false;
  const {rect:r,line:l,poly:p,oval:o}=painter(ctx);
  const skin=SKINS.find(x=>x.id===s.skin).colors,cloth=CLOTH.find(x=>x.id===s.cloth).colors,hair=HAIR.find(x=>x.id===s.hairColor).colors,accent=ACCENTS.find(x=>x.id===s.accent).colors;
  const ink='#29252a',dark='#493d34',gold=['#8b5d35','#d6aa52','#f1d889'],linen=['#958467','#d8c8a0','#f4e8c6'];
  const side=view==='side',back=view==='back';
  const bob=frame%2;const top=(s.height==='short'?22:s.height==='tall'?14:18)+bob;
  const shoulder=top+27,waist=top+43,hem=['dress','himation'].includes(s.outfit)?83:top+54;
  const garment=['linothorax','himation'].includes(s.outfit)?linen:cloth;
  const half=side?6:({slim:7,average:9,sturdy:11,soft:12}[s.build]);
  const cx=31,legW=s.build==='slim'?5:6;
  // Legs and feet retain visible negative space.
  ctx.beginLayer?.('01-legs-and-feet');
  const legs=side?[cx-2,cx+3]:[cx-half+2,cx+half-legW-1];
  for(let i=0;i<2;i++) {let x=legs[i],end=88+(frame===2?(i?-1:1):0);r(x-1,waist+7,legW+2,end-waist-5,ink);r(x,waist+7,legW,end-waist-5,skin[1]);r(x+legW-2,waist+9,2,end-waist-7,skin[0]);r(x-1,end,legW+3,3,ink);r(x,end,legW+1,2,s.footwear==='sandals'?'#9b7852':skin[1]);if(s.footwear==='sandals')r(x+1,end-2,legW-1,1,dark);}
  ctx.beginLayer?.('02-rear-cloak');
  if(['linothorax','himation'].includes(s.outfit)) {
    p([[cx-half-4,shoulder-2],[cx+half+2,shoulder],[cx+half+3,82],[cx-half-5,80]],ink);
    p([[cx-half-3,shoulder-1],[cx+half+1,shoulder+1],[cx+half+2,80],[cx-half-4,79]],cloth[1]);
    l(cx-half-2,shoulder+4,cx-half-3,77,cloth[2]);
  }
  // Back arm and tunic body.
  ctx.beginLayer?.('03-body-and-base-garment');
  let armL=cx-half-4,armR=cx+half+1;
  r(armL-1,shoulder+1,5,23,ink);r(armL,shoulder+2,3,21,skin[1]);r(armL,shoulder+3,1,17,skin[2]);r(armL-1,shoulder+21,5,6,ink);r(armL,shoulder+21,3,5,skin[1]);
  const torso=[[cx-half,shoulder-1],[cx+half,shoulder-1],[cx+half+2,waist+7],[cx-half-2,waist+7]];
  p(torso,ink);p([[cx-half+1,shoulder],[cx+half-1,shoulder],[cx+half+1,waist+6],[cx-half-1,waist+6]],s.outfit==='wrap'?skin[1]:garment[1]);
  if(s.outfit==='wrap') {r(cx-half+1,shoulder+2,2,12,skin[2]);r(cx+half-2,shoulder+2,2,14,skin[0]);if(!back&&!side){r(cx-1,shoulder+12,1,1,skin[0]);}}
  else {p([[cx+half-4,shoulder],[cx+half-1,shoulder],[cx+half+1,waist+6],[cx+half-3,waist+6]],garment[0]);r(cx-half+2,shoulder+3,2,10,garment[2]);}
  // Garment hem and belt; big folds, not noise.
  p([[cx-half-1,waist],[cx+half+1,waist],[cx+half+4,hem],[cx-half-4,hem]],ink);
  p([[cx-half,waist+1],[cx+half,waist+1],[cx+half+2,hem-1],[cx-half-2,hem-1]],garment[1]);
  p([[cx+2,waist+2],[cx+half,waist+1],[cx+half+2,hem-1],[cx+6,hem-1]],garment[0]);
  l(cx-half+3,waist+4,cx-half+1,hem-3,garment[2]);l(cx-2,waist+5,cx-4,hem-2,garment[2]);l(cx+3,waist+3,cx+4,hem-2,garment[0]);
  r(cx-half-1,waist,half*2+3,3,'#695140');r(cx-half,waist,half*2,1,'#9b7852');
  if(s.outfit==='mantle') {p([[cx-half-2,shoulder-2],[cx+2,shoulder],[cx+half+3,hem-2],[cx-half-4,hem-1]],ink);p([[cx-half-1,shoulder-1],[cx,shoulder+1],[cx+half+1,hem-3],[cx-half-2,hem-2]],garment[1]);l(cx-half+1,shoulder+5,cx-1,hem-4,garment[2]);l(cx+2,shoulder+9,cx+half-2,hem-5,garment[0]);r(cx-half,shoulder+1,3,3,gold[1]);}
  // Sleeves change with outfit, never with gender identity.
  ctx.beginLayer?.('04-arms-and-sleeves');
  if(s.outfit!=='wrap'){r(armL-1,shoulder,6,8,ink);r(armL,shoulder+1,4,6,garment[1]);r(armL,shoulder+1,1,5,garment[2]);}
  r(armR,shoulder+1,5,24,ink);r(armR+1,shoulder+2,3,22,skin[1]);r(armR+3,shoulder+3,1,18,skin[0]);
  if(s.outfit!=='wrap'){r(armR-1,shoulder,7,8,ink);r(armR,shoulder+1,5,6,garment[1]);r(armR+3,shoulder+1,2,6,garment[0]);}
  ctx.beginLayer?.('05-outer-garment-and-footwear');
  if(s.outfit==='linothorax') {
    if(back) {
      p([[cx-half-2,shoulder],[cx+half+1,shoulder],[cx+half+2,79],[cx-half-3,78]],cloth[1]);
      l(cx-half+1,shoulder+6,cx-half-1,75,cloth[2]);l(cx+half-2,shoulder+8,cx+half,77,cloth[0]);
    } else {
      r(cx-half+2,shoulder+2,half*2-3,waist-shoulder-2,linen[1]);
      r(cx-half+2,shoulder+2,half*2-3,2,linen[2]);
      l(cx-half+3,shoulder+7,cx+half-3,shoulder+7,linen[0]);
      for(let x=cx-half+3;x<cx+half-1;x+=4){r(x,waist+3,3,hem-waist-4,linen[2]);r(x+2,waist+4,1,hem-waist-5,linen[0]);}
      for(const x of [cx-half+3,cx+half-4]){r(x,shoulder+3,3,9,linen[0]);r(x,shoulder+3,2,8,linen[2]);}
      p([[cx-half-3,shoulder-1],[cx-half+2,shoulder],[cx-1,waist+8],[cx-half-4,hem-2]],cloth[0]);
      p([[cx-half-2,shoulder],[cx-half+1,shoulder+1],[cx-2,waist+6],[cx-half-3,hem-3]],cloth[1]);
    }
  }
  if(s.outfit==='himation') {
    p(back?[[cx-half-2,shoulder],[cx+half+2,shoulder+5],[cx+half+2,80],[cx-half-3,81]]:[[cx-half-2,shoulder],[cx-half+3,shoulder-1],[cx+half+3,waist+5],[cx+half+2,81],[cx-half-2,81]],ink);
    p(back?[[cx-half-1,shoulder+1],[cx+half+1,shoulder+6],[cx+half+1,79],[cx-half-2,80]]:[[cx-half-1,shoulder+1],[cx-half+2,shoulder],[cx+half+2,waist+6],[cx+half+1,80],[cx-half-1,80]],cloth[1]);
    l(cx-half+2,shoulder+6,cx+half-2,waist+7,cloth[2]);l(cx-half+2,waist+8,cx-half+2,77,cloth[2]);l(cx+half-2,waist+10,cx+half-2,77,cloth[0]);
  }
  if(s.footwear==='boots') for(const x of legs){r(x-1,81,legW+2,9,ink);r(x,82,legW,7,'#9b7852');r(x,82,legW,2,'#c7a66c');r(x+legW-2,84,2,5,dark);}
  ctx.beginLayer?.('06-garment-trim');
  if(s.finish&&s.finish!=='classic') {
    const trim=s.finish==='aurum'?gold:accent;
    l(cx-half-1,hem-2,cx+half+1,hem-2,trim[1]);
    l(cx-half,shoulder+2,cx-half,waist+7,trim[1]);
    for(let y=waist+7;y<hem-4;y+=6){r(cx-half+2,y,2,2,trim[2]);r(cx+half-3,y+2,2,2,trim[1]);}
    if(!back){r(cx-half+2,waist-1,half*2-3,2,gold[0]);r(cx-2,waist-2,5,4,gold[1]);r(cx-1,waist-1,3,2,accent[2]);}
    for(const ax of [armL,armR+1]){r(ax,shoulder+18,3,2,gold[1]);r(ax,shoulder+18,1,1,gold[2]);}
  }
  // Neck, ears, head silhouette.
  ctx.beginLayer?.('07-head-and-neck');
  r(cx-3,top+20,7,9,ink);r(cx-2,top+21,5,7,skin[1]);r(cx,top+21,3,4,skin[0]);
  const [fw,fh]=({round:[22,22],oval:[19,24],square:[22,22],long:[18,27],heart:[23,24],diamond:[22,25]})[s.face]??[22,22],hx=cx-Math.floor(fw/2)+(side?2:0),hy=top;
  if(s.face==='square'){r(hx+2,hy,fw-4,fh,ink);r(hx,hy+3,fw,fh-7,ink);r(hx+2,hy+2,fw-4,fh-4,skin[1]);r(hx+fw-5,hy+4,3,fh-8,skin[0]);}
  else if(s.face==='heart'||s.face==='diamond'){
    const inset=s.face==='heart'?2:6;
    p([[hx+inset,hy],[hx+fw-inset,hy],[hx+fw,hy+9],[hx+fw-3,hy+17],[cx+1,hy+fh],[hx+3,hy+17],[hx,hy+9]],ink);
    p([[hx+inset+1,hy+1],[hx+fw-inset-1,hy+1],[hx+fw-1,hy+9],[hx+fw-4,hy+17],[cx+1,hy+fh-2],[hx+4,hy+17],[hx+1,hy+9]],skin[1]);
    p([[hx+fw-5,hy+7],[hx+fw-2,hy+10],[hx+fw-5,hy+18],[cx+2,hy+fh-3],[cx+4,hy+15]],skin[0]);
  }else {o(hx,hy,fw,fh,ink);o(hx+1,hy+1,fw-2,fh-2,skin[1]);p([[hx+fw-5,hy+3],[hx+fw-2,hy+7],[hx+fw-2,hy+fh-8],[hx+fw-7,hy+fh-2],[hx+fw-5,hy+11]],skin[0]);}
  r(hx-2,hy+10,3,6,ink);r(hx-1,hy+11,2,4,skin[1]);if(!side){r(hx+fw-1,hy+10,3,6,ink);r(hx+fw,hy+11,1,4,skin[0]);}
  if(back) {o(hx+1,hy+1,fw-2,fh-3,s.hair==='shaved'?skin[0]:hair[1]);}
  // Hair shares a single shape and two shades across views.
  ctx.beginLayer?.('08-hair');
  if(s.hair!=='shaved'){
    p([[hx+3,hy-2],[hx+fw-5,hy-2],[hx+fw,hy+2],[hx+fw+1,hy+9],[hx+fw-4,hy+10],[hx+fw-5,hy+5],[hx+6,hy+5],[hx+3,hy+10],[hx-1,hy+9],[hx-1,hy+3]],ink);
    p([[hx+3,hy-1],[hx+fw-5,hy-1],[hx+fw-1,hy+3],[hx+fw,hy+8],[hx+fw-3,hy+8],[hx+fw-5,hy+4],[hx+5,hy+4],[hx+2,hy+8],[hx,hy+7],[hx+1,hy+2]],hair[1]);
    l(hx+4,hy,hx+fw-7,hy,hair[2]);r(hx+3,hy+1,3,2,hair[2]);
    if(s.hair==='wavy'){r(hx-2,hy+3,4,7,ink);r(hx-1,hy+4,3,4,hair[1]);r(hx+5,hy+4,5,3,hair[1]);r(hx+fw-3,hy+6,4,7,ink);r(hx+fw-2,hy+6,2,5,hair[1]);}
    if(s.hair==='anastole') {
      p([[hx+3,hy+2],[hx+5,hy-4],[hx+9,hy-5],[hx+11,hy-2],[hx+fw-4,hy-4],[hx+fw,hy],[hx+fw-2,hy+5],[hx+10,hy+3],[hx+6,hy+6]],ink);
      p([[hx+4,hy+2],[hx+6,hy-3],[hx+9,hy-4],[hx+11,hy-1],[hx+fw-4,hy-3],[hx+fw-1,hy],[hx+fw-3,hy+3],[hx+10,hy+2],[hx+6,hy+4]],hair[1]);
      l(hx+6,hy-2,hx+9,hy-3,hair[2]);l(hx+12,hy,hx+fw-4,hy-2,hair[2]);
      if(!back){r(hx+2,hy+6,3,4,hair[1]);r(hx+fw-3,hy+5,3,6,hair[1]);}
    }
    if(s.hair==='curly') {
      for(const [dx,dy] of [[1,1],[5,-2],[10,-3],[15,-1],[fw-4,3]]){o(hx+dx-2,hy+dy-1,7,7,ink);o(hx+dx-1,hy+dy,5,5,hair[1]);r(hx+dx,hy+dy,2,1,hair[2]);}
      r(hx,hy+7,3,4,hair[1]);r(hx+fw-2,hy+7,3,5,hair[1]);
    }
    if(s.hair==='bun'){o(back?cx-5:hx-5,hy-5,10,9,ink);o(back?cx-4:hx-4,hy-4,8,7,hair[1]);r(back?cx-2:hx-2,hy-3,4,2,hair[2]);}
    if(s.hair==='braids'){for(const x of [hx-1,hx+fw-2]){r(x-1,hy+8,5,23,ink);r(x,hy+9,3,21,hair[1]);for(let i=0;i<5;i++)r(x+(i%2),hy+10+i*4,2,2,hair[2]);r(x,hy+28,3,2,accent[1]);}}
    if(back&&s.hair!=='short'){r(hx+2,hy+10,fw-4,fh-10,hair[1]);l(hx+6,hy+7,hx+6,hy+fh-3,hair[2]);}
  } else {o(hx+3,hy+2,fw-6,7,skin[0]);r(hx+5,hy+3,fw-10,2,skin[1]);}
  ctx.beginLayer?.('09-face');
  if(!back){
    const ey=hy+11;const eyes=side?[cx+7]:[cx-6,cx+5];
    for(const ex of eyes){
      if(s.eyes==='round'){r(ex-1,ey-1,4,3,skin[2]);r(ex,ey,2,2,ink);}
      else if(s.eyes==='relaxed'){l(ex-1,ey+1,ex+2,ey+1,ink);}
      else if(s.eyes==='deep'){r(ex-2,ey-1,6,3,skin[0]);r(ex-1,ey,4,1,ink);r(ex,ey+1,2,1,ink);}
      else if(s.eyes==='narrow'){r(ex-1,ey,4,1,ink);r(ex+1,ey+1,2,1,skin[0]);}
      else if(s.eyes==='wide'){r(ex-2,ey-1,6,4,skin[2]);r(ex,ey-1,2,3,ink);r(ex-1,ey-2,4,1,skin[0]);}
      else{r(ex-1,ey,4,1,skin[2]);r(ex,ey,2,2,ink);}
      const by=ey-3+(['determined','stern'].includes(s.expression)?1:0);
      if(s.brows==='arched'){r(ex-1,by,1,1,hair[0]);r(ex,by-1,3,1,hair[0]);r(ex+3,by,1,1,hair[0]);}
      else{r(ex-1,by,s.brows==='soft'?3:4,s.brows==='thick'?2:1,hair[0]);if(s.brows==='soft')r(ex,by-1,1,1,hair[0]);}
      if(s.expression==='curious'&&ex===eyes[0])r(ex-1,by-1,2,1,hair[0]);if(s.expression==='stern')r(ex+(ex<cx?2:-1),by+1,2,1,hair[0]);
    }
    if(side){const depth=s.nose==='aquiline'?5:s.nose==='long'?4:3;r(hx+fw-1,hy+11,depth,s.nose==='broad'?4:s.nose==='long'?5:3,skin[1]);r(hx+fw+depth-2,hy+12,1,2,skin[0]);if(s.nose==='aquiline')r(hx+fw+2,hy+14,2,2,skin[0]);}
    else if(s.nose==='broad'){r(cx-1,hy+14,4,2,skin[0]);r(cx-1,hy+14,2,1,skin[2]);}
    else if(s.nose==='aquiline'){r(cx+1,hy+11,2,4,skin[0]);r(cx+2,hy+14,2,3,skin[0]);r(cx,hy+16,3,1,skin[2]);}
    else if(s.nose==='long'){r(cx+1,hy+11,1,7,skin[0]);r(cx,hy+17,3,1,skin[0]);r(cx,hy+13,1,3,skin[2]);}
    else {r(cx+1,hy+12,s.nose==='straight'?2:1,4,skin[0]);r(cx,hy+14,1,1,skin[2]);}
    let mx=side?cx+7:cx-2,my=hy+18;
    if(s.expression==='smile'){r(mx,my,5,1,'#754335');r(mx+1,my+1,3,1,'#754335');r(mx+1,my,3,1,'#efc497');}else if(s.expression==='curious'){r(mx+2,my,2,2,'#754335');}
    else if(s.expression==='thoughtful'){r(mx+1,my+1,4,1,'#754335');r(mx+4,my,1,1,'#754335');r(cx-6,hy+17,2,1,skin[0]);}
    else if(s.expression==='stern'){r(mx,my+1,5,1,'#754335');r(mx,my+2,1,1,'#754335');r(mx+4,my+2,1,1,'#754335');}
    else r(mx,my,s.expression==='determined'?5:4,1,'#754335');
    if(s.presentation==='masculine'){r(cx-3,hy+fh-4,7,1,skin[0]);}
    if(s.presentation==='feminine'){for(const ex of eyes)r(ex+2,ey-1,1,1,ink);}
    if(s.marks==='freckles') {r(cx-8,hy+15,1,1,skin[0]);r(cx-5,hy+16,1,1,skin[0]);if(!side){r(cx+7,hy+15,1,1,skin[0]);r(cx+5,hy+16,1,1,skin[0]);}}
    if(s.marks==='scar')l(cx+7,hy+12,cx+6,hy+16,skin[2]);
  }
  ctx.beginLayer?.('10-beard');
  if(!back&&s.beard&&s.beard!=='none') {
    const bx=side?cx+3:cx-7,by=hy+16,bw=side?8:15,bh=s.beard==='scholar'?12:7;
    p([[bx,by],[bx+bw,by],[bx+bw-1,by+bh-3],[bx+Math.floor(bw/2),by+bh],[bx+1,by+bh-3]],hair[0]);
    p([[bx+1,by+1],[bx+bw-1,by+1],[bx+bw-2,by+bh-4],[bx+Math.floor(bw/2),by+bh-1],[bx+2,by+bh-4]],hair[1]);
    r(side?cx+6:cx-2,hy+18,4,1,'#754335');r(bx+2,by+3,1,bh-4,hair[2]);
    if(s.beard==='scholar')r(bx+bw-4,by+4,1,bh-5,hair[2]);
  }
  // Jewelry follows the body, is absent where occluded by the back.
  ctx.beginLayer?.('11-jewelry');
  if(!back&&(s.jewelry==='amulet'||s.jewelry==='beads')){l(cx-4,shoulder,cx,shoulder+7,gold[0]);l(cx+4,shoulder,cx,shoulder+7,gold[0]);if(s.jewelry==='amulet'){r(cx-1,shoulder+6,4,5,ink);r(cx,shoulder+6,2,4,accent[1]);r(cx,shoulder+6,1,2,accent[2]);}else for(let i=-5;i<=5;i+=2)r(cx+i,shoulder+6-Math.abs(i)/2,2,2,accent[1]);}
  if(s.jewelry==='earrings'){r(hx-1,hy+15,2,4,gold[1]);if(!side)r(hx+fw,hy+15,2,4,gold[1]);}
  if(s.jewelry==='fibula'){const fx=back?cx+half-3:cx-half+1;o(fx,shoulder,5,5,gold[0]);o(fx+1,shoulder+1,3,3,accent[1]);r(fx+1,shoulder+1,1,1,accent[2]);}
  if(s.jewelry==='bracelet')r(armL-1,shoulder+21,5,2,gold[1]);
  // The prop's grip is fixed at the right hand. Different tools change silhouette.
  ctx.beginLayer?.('12-prop-and-grip');
  const handX=armR+2,handY=shoulder+24;
  const wood='#695140',lightWood='#c7a66c';
  if(s.prop==='hoe'){const px=Math.min(59,handX+5);l(px-1,shoulder-13,px-1,87,ink,3);l(px,shoulder-12,px,86,wood);l(px,shoulder-12,px+5,shoulder-8,ink,2);r(px+3,shoulder-9,5,3,'#9b7852');l(handX,handY,px,handY,skin[1],2);}
  if(s.prop==='spear'){const px=Math.min(57,handX+5);l(px,top+3,px,88,ink,3);l(px,top+4,px,87,wood);p([[px,top-5],[px-3,top+4],[px+3,top+4]],ink);p([[px,top-3],[px-1,top+3],[px+1,top+3]],linen[1]);l(handX,handY,px,handY,skin[1],2);}
  if(s.prop==='geometry'){
    const px=Math.min(47,handX-2),py=handY-10,pw=side?7:13;r(px-1,py-1,pw+2,19,ink);r(px,py,pw,17,linen[1]);r(px,py,pw,2,linen[2]);r(px,py+16,pw,1,linen[0]);
    if(!back){l(px+1,py+12,px+pw-3,py+12,dark);l(px+1,py+12,px+Math.floor(pw/2)-1,py+4,dark);l(px+Math.floor(pw/2)-1,py+4,px+pw-3,py+12,dark);
      const dx=px+pw-3;r(dx,py+3,1,4,gold[0]);l(dx,py+5,dx-2,py+10,gold[0]);l(dx,py+5,dx+2,py+10,gold[1]);
    } else {r(px+2,py+4,1,9,linen[0]);r(px+4,py+3,1,11,linen[2]);}
  }
  if(s.prop==='divider'){const px=Math.min(53,handX+3);o(px-1,handY-14,4,4,ink);o(px,handY-13,2,2,gold[1]);l(px+1,handY-10,px-3,handY+7,ink,2);l(px+1,handY-10,px+5,handY+7,ink,2);l(px+1,handY-10,px-2,handY+5,gold[1]);l(px+1,handY-10,px+4,handY+5,gold[2]);l(handX,handY,px+1,handY-5,skin[1],2);}
  if(s.prop==='pot'){o(handX-1,handY-3,11,14,ink);o(handX,handY-2,9,12,'#b3694c');r(handX+2,handY-5,5,4,ink);r(handX+3,handY-4,3,3,'#d99166');r(handX+1,handY+1,2,5,'#d99166');}
  if(s.prop==='scroll'){r(handX-1,handY-9,10,17,ink);r(handX,handY-8,8,15,linen[1]);r(handX,handY-8,8,2,linen[2]);for(let i=0;i<3;i++)r(handX+2,handY-4+i*3,4,1,linen[0]);r(handX-2,handY-10,12,3,linen[0]);r(handX-2,handY+6,12,3,linen[0]);}
  if(s.prop==='bag'){l(handX,handY-5,handX+7,handY-5,wood);o(handX-1,handY-3,12,15,ink);o(handX,handY-2,10,13,'#9b7852');r(handX+1,handY+1,2,6,lightWood);r(handX+3,handY-3,4,2,wood);}
  if(s.prop==='grain'){const gx=handX-2,gy=handY-2;o(gx-2,gy,14,17,ink);o(gx-1,gy+1,12,15,'#c7a66c');r(gx+1,gy+4,2,8,'#dfc899');r(gx+1,gy,7,2,wood);for(const dx of [0,4,8]){l(gx+dx,gy,gx+dx-1,gy-13,'#9b7852');for(let n=0;n<3;n++){r(gx+dx-3,gy-13+n*3,2,2,'#d6aa52');r(gx+dx,gy-12+n*3,2,2,linen[2]);}}}
  if(s.prop==='net'){const nx=Math.min(58,handX+6);l(nx,handY-18,nx,87,wood,2);o(nx-7,handY-22,14,15,ink);o(nx-6,handY-21,12,13,'#b4c494');for(let d=-4;d<=4;d+=3)l(nx+d,handY-19,nx+d,handY-10,'#7f9364');for(let d=-18;d<=-10;d+=3)l(nx-4,handY+d,nx+5,handY+d,'#7f9364');l(handX,handY,nx,handY,skin[1],2);}
  if(s.prop==='sistrum'){const nx=Math.min(58,handX+5);r(nx,handY-12,2,15,gold[0]);o(nx-4,handY-28,10,17,ink);o(nx-3,handY-27,8,15,gold[1]);o(nx-1,handY-25,4,11,cloth[0]);for(let y=handY-24;y<handY-14;y+=4)r(nx-4,y,10,1,gold[2]);l(handX,handY,nx,handY,skin[1],2);}
  r(handX-1,handY-1,3,4,skin[1]);r(handX-1,handY-1,1,2,skin[2]);
  if(mode!=='color'){
    const data=ctx.getImageData(0,0,WIDTH,HEIGHT);for(let i=0;i<data.data.length;i+=4){if(!data.data[i+3])continue;if(mode==='silhouette'){data.data[i]=41;data.data[i+1]=37;data.data[i+2]=42;}else{const v=Math.round(.2126*data.data[i]+.7152*data.data[i+1]+.0722*data.data[i+2]);data.data[i]=data.data[i+1]=data.data[i+2]=v;}}ctx.putImageData(data,0,0);
  }
  return {skin,cloth,hair,accent};
}
export function usedColors(canvas){const d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const set=new Set();for(let i=0;i<d.length;i+=4)if(d[i+3])set.add('#'+[d[i],d[i+1],d[i+2]].map(x=>x.toString(16).padStart(2,'0')).join(''));return [...set];}
export function drawLandscape(canvas,place='nile',backdrop='local') {
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const {rect:r,line:l,poly:p,oval:o}=painter(ctx);
  if(drawHistoricalScene({rect:r,line:l,poly:p,oval:o},backdrop))return;
  if(backdrop==='palace'||backdrop==='observatory') {
    const night=backdrop==='observatory';
    r(0,0,240,190,night?'#172e35':'#493d34');
    r(24,14,192,126,night?'#23454b':'#8b633b');r(38,25,164,108,night?'#395756':'#c39b59');
    p([[38,100],[69,72],[95,88],[133,63],[174,85],[202,74],[202,136],[38,136]],night?'#23454b':'#9b7852');
    r(38,112,164,28,night?'#38665e':'#608b85');r(38,117,164,1,night?'#6caaa0':'#b0d3bb');
    o(99,35,43,43,night?'#b0d3bb':'#f1d889');o(103,39,35,35,night?'#95b8a3':'#e8c985');
    if(night){o(114,31,35,36,'#395756');for(const [x,y]of [[61,38],[172,39],[79,64],[155,63],[119,21]]){r(x,y,1,5,'#f1d889');r(x-2,y+2,5,1,'#f1d889');}l(62,41,81,67,'#6caaa0');l(81,67,119,24,'#6caaa0');}
    // Tall, layered stone piers and a gilded arch frame the silhouette.
    for(const x of [13,204]){r(x,20,23,133,'#493d34');r(x+3,23,17,127,night?'#608b85':'#d8c8a0');r(x+5,24,4,125,night?'#95b8a3':'#f4e8c6');r(x+16,24,3,125,night?'#38665e':'#958467');r(x-4,19,31,6,'#d6aa52');r(x-4,146,31,7,'#8b5d35');r(x-3,146,29,2,'#f1d889');}
    p([[32,24],[58,9],[182,9],[208,24],[208,31],[179,17],[61,17],[32,31]],'#8b5d35');l(34,24,61,12,'#f1d889');l(61,12,179,12,'#f1d889');l(179,12,206,24,'#f1d889');
    r(0,154,240,36,night?'#23454b':'#695140');r(0,154,240,2,'#d6aa52');
    for(let y=160;y<190;y+=10)l(0,y,239,y,night?'#395756':'#958467');
    for(let x=-60;x<300;x+=40)l(120,145,x,190,night?'#395756':'#958467');
    o(73,175,95,7,night?'#172e35':'#493d34');
    for(const x of [48,187]){r(x-2,112,4,43,'#8b5d35');r(x-7,111,14,3,'#d6aa52');o(x-3,99,7,11,'#e8c985');r(x-1,101,2,6,'#fff5d8');}
    for(const [x,y]of [[59,53],[180,49],[75,133],[165,125]]){p([[x,y-4],[x+2,y],[x,y+4],[x-2,y]],night?'#b0d3bb':'#f1d889');r(x,y,1,1,'#fff5d8');}
    if(night){o(165,88,25,25,'#8b5d35');o(167,90,21,21,'#395756');l(177,91,177,110,'#d6aa52');l(168,100,187,100,'#d6aa52');}
    return;
  }
  if(place==='pella') {
    r(0,0,240,190,'#e9e5ce');r(0,24,240,60,'#e1e3c6');o(174,18,17,17,'#e8ce8b');
    p([[0,93],[38,47],[69,77],[101,50],[151,94],[197,62],[240,83],[240,136],[0,136]],'#b9c2a0');
    p([[0,113],[60,87],[98,100],[150,84],[191,99],[240,93],[240,151],[0,151]],'#9eaf8b');
    r(0,130,240,60,'#e8d5ac');r(12,106,51,28,'#d6c39b');p([[8,106],[37,93],[67,106]],'#b3694c');
    r(173,77,49,57,'#dcc99e');p([[168,77],[198,63],[227,77]],'#c7a66c');r(171,78,53,4,'#b5a275');
    for(let x=176;x<222;x+=12){r(x,84,5,46,'#b5a275');r(x+1,84,3,46,'#f4e8c6');}
    r(167,132,62,4,'#b5a275');
    l(27,145,27,95,'#9b7852',4);l(27,113,13,99,'#9b7852',2);l(27,113,43,97,'#9b7852',2);
    for(const [x,y]of [[8,85],[24,77],[37,86]]){o(x,y,24,24,'#7f9364');o(x+3,y+2,18,17,'#9aab7b');}
    for(let i=0;i<14;i++)r((i*41+7)%240,150+(i*13)%35,4,1,'#d2bc8e');
    r(77,177,86,3,'#d2bc8e');return;
  }
  r(0,0,240,190,'#e9e5ce');r(0,22,240,66,'#e1e3c6');
  const cloud=(x,y)=>{r(x,y,29,4,'#f8f0d9');r(x+5,y-3,16,3,'#f8f0d9');r(x-4,y+4,40,2,'#f8f0d9');};cloud(27,22);cloud(168,35);
  o(168,14,17,17,'#e8ce8b');r(169,15,4,4,'#f3dfad');
  p([[0,84],[23,65],[48,77],[72,60],[105,87],[148,66],[185,83],[212,64],[240,81],[240,112],[0,112]],'#d5cca9');
  p([[0,92],[32,79],[51,85],[76,72],[103,93],[144,84],[177,96],[214,81],[240,94],[240,121],[0,121]],'#c9c29e');
  // distant river and reed beds
  r(0,101,240,26,'#95b8a3');r(0,108,240,2,'#b0d3bb');r(0,119,240,2,'#6caaa0');
  for(let i=0;i<10;i++)r((i*31)%240,104+(i%4)*5,8+(i%3)*5,1,'#c6d6b8');
  p([[0,126],[39,116],[78,122],[109,127],[159,121],[202,123],[240,119],[240,190],[0,190]],'#dfc899');
  p([[0,142],[51,132],[96,139],[150,133],[199,141],[240,135],[240,190],[0,190]],'#e8d5ac');
  for(let i=0;i<25;i++){const x=(i*43+9)%240,y=142+(i*17)%46;r(x,y,2+i%3,1,'#d2bc8e');}
  // Low limestone wall and gateway: environment stays quieter than the sprite.
  if(place==='memphis'||place==='rhakotis'){
    r(163,54,39,57,'#c7b586');r(160,52,46,5,'#b5a275');r(167,62,31,45,'#dcc99e');r(176,77,15,32,'#a89970');r(179,79,10,30,'#807a5c');r(155,109,57,4,'#b5a275');
    for(let i=0;i<4;i++)l(165,65+i*10,199,65+i*10,'#c7b586');
  } else {r(174,90,43,25,'#c7b586');r(171,87,48,5,'#d6c39b');r(178,94,34,19,'#dfc899');r(183,95,3,18,'#c7b586');r(201,95,3,18,'#c7b586');}
  // Palms, staggered leaves, and river reeds.
  if(place==='alexandria') {
    r(141,81,70,34,'#dcc99e');p([[137,81],[176,67],[215,81]],'#d6c39b');r(138,82,76,4,'#b5a275');
    for(let x=145;x<210;x+=12){r(x,87,4,26,'#b5a275');r(x+1,87,2,24,'#f4e8c6');}
    r(137,113,79,3,'#c7b586');l(75,98,75,117,'#9b7852');p([[74,99],[62,112],[74,112]],'#f4e8c6');p([[59,116],[87,116],[81,121],[65,121]],'#9b7852');
  }
  const palm=(x,y)=>{p([[x,y],[x+4,y],[x+7,y+48],[x+1,y+48]],'#9b7852');r(x+1,y+4,2,40,'#c7a66c');for(let j=1;j<5;j++)r(x+1,y+j*9,4,2,'#806c49');for(const [dx,dy]of [[-22,4],[-17,-9],[0,-17],[20,-11],[24,4]]){l(x+2,y+3,x+dx,y+dy,'#7f9364',3);l(x+dx,y+dy,x+dx+(dx<0?-3:3),y+dy+8,'#7f9364',2);l(x+2,y+2,x+dx,y+dy+1,'#9aab7b');}r(x,y+3,6,5,'#9b7852');};palm(33,59);palm(221,72);
  for(let i=0;i<9;i++){let x=6+i*4,y=124+(i%3)*2;l(x,y,x+(i%2?2:-2),y-10-(i%4),'#7f9364');}
  // Foreground planting, amphora, and paving make a friendly little diorama.
  r(15,173,31,3,'#c3ac7e');r(19,169,25,4,'#d4be92');
  o(192,157,16,20,'#9b7852');o(194,157,12,18,'#b3694c');r(196,151,8,7,'#80463d');r(197,152,6,4,'#d99166');r(195,162,2,8,'#d99166');
  for(const [x,y] of [[204,174],[16,161],[220,151]]){l(x,y,x,y-9,'#7f9364',2);l(x,y-3,x-5,y-7,'#7f9364',2);l(x,y-5,x+5,y-10,'#9aab7b',2);}
  r(77,177,86,3,'#d2bc8e');r(83,180,75,2,'#ddc79f');
}
export function paletteColors(s){return [...new Set([...PALETTE_CORE,...SKINS.find(x=>x.id===s.skin).colors,...CLOTH.find(x=>x.id===s.cloth).colors,...HAIR.find(x=>x.id===s.hairColor).colors,...ACCENTS.find(x=>x.id===s.accent).colors])];}

/** Export the same modular artwork as a composed collectible portrait. */
export function drawCollectible(canvas,s,view,scratch) {
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const prism=s.finish==='prism',ink=prism?'#172e35':'#29252a',gold=prism?'#95b8a3':'#d6aa52';
  ctx.fillStyle=ink;ctx.fillRect(0,0,480,640);ctx.strokeStyle=gold;ctx.lineWidth=2;ctx.strokeRect(7,7,466,626);ctx.strokeRect(12,12,456,616);
  scratch.width=240;scratch.height=190;drawLandscape(scratch,s.birthplace,s.backdrop);
  // Crop to fill, preserving background proportions.
  const cropWidth=190*456/432;
  ctx.drawImage(scratch,(240-cropWidth)/2,0,cropWidth,190,12,52,456,432);
  scratch.width=64;scratch.height=96;drawCharacter(scratch,s,view);
  ctx.drawImage(scratch,112,100,256,384);
  drawHistoricalFrame(ctx,s.figure,prism?'#95b8a3':'#d6aa52');
  ctx.fillStyle=gold;ctx.font='12px monospace';ctx.fillText('BÊN DÒNG NILE',26,35);ctx.textAlign='right';ctx.fillText(s.finish==='classic'?'CHARACTER':prism?'PRISM ◇':'AURUM ◇',454,35);ctx.textAlign='left';
  ctx.fillRect(26,510,42,2);ctx.fillStyle='#fff5d8';ctx.font='26px Georgia';ctx.fillText(s.name,26,551,428);
  const roleTitle={commander:'MACEDONIAN COMMANDER',geometer:'ALEXANDRIAN GEOMETER',philosopher:'PHILOSOPHER OF THE LYCEUM','grain-official':'GRAIN ADMINISTRATOR',soldier:'SOLDIER OF ALEXANDRIA',stargazer:'STARGAZER OF ALEXANDRIA'}[s.role]??'CHARACTER PORTRAIT';
  ctx.fillStyle=gold;ctx.font='13px sans-serif';ctx.fillText(roleTitle,26,578,420);
  ctx.font='11px monospace';ctx.fillText('HISTORICAL IMAGINATION · PIXEL COLLECTION',26,611,420);
  for(const [x,y]of [[18,18],[462,18],[18,622],[462,622]]){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle=gold;ctx.fillRect(-3,-3,6,6);ctx.restore();}
}
