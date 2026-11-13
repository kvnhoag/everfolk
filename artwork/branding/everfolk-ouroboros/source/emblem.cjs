const n=v=>Number(v.toFixed(4));
function polygon(points){return `M${points.map(p=>p.map(n).join(' ')).join('L')}Z`;}
function area(p){return p.reduce((a,q,i)=>{const r=p[(i+1)%p.length];return a+q[0]*r[1]-r[0]*q[1];},0)/2;}
function spline(points){
 let d=`M${points[0].map(n).join(' ')}`;
 for(let i=0;i<points.length-1;i++){
  const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],e=points[Math.min(points.length-1,i+2)];
  d+=`C${n(b[0]+(c[0]-a[0])/6)} ${n(b[1]+(c[1]-a[1])/6)} ${n(c[0]-(e[0]-b[0])/6)} ${n(c[1]-(e[1]-b[1])/6)} ${n(c[0])} ${n(c[1])}`;
 }
 return d;
}
const outer=[],inner=[];
for(let i=0;i<=70;i++){
 const deg=-124+i*5,t=deg*Math.PI/180,thickness=(23+5*Math.sin(t))*Math.min(1,i*5/45);
 outer.push([128+(105+thickness/2)*Math.cos(t),128+(105+thickness/2)*Math.sin(t)]);
 inner.push([128+(105-thickness/2)*Math.cos(t),128+(105-thickness/2)*Math.sin(t)]);
}
outer[0]=[68,47];inner[0]=[68,47];
const reversed=inner.toReversed();
const body=spline(outer)+`L${reversed[0].map(n).join(' ')}`+spline(reversed).replace(/^M[-.\d]+ [-.\d]+/,'')+'Z';
const head=[[44,45],[49,30],[70,21],[83,27],[60,51],[87,39],[88,50],[67,63],[58,63],[62,63]];
let eye=[[55,35],[63,32],[60,36]];
if(Math.sign(area(head))===Math.sign(area(eye)))eye=eye.toReversed();
module.exports={name:'Endless Life',viewBox:[0,0,256,256],body,head:polygon(head)+polygon(eye),headSimple:polygon(head),tailTip:outer[0],bite:{x:73,y:41}};
