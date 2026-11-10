/** Native ArtCraft actor geometry, sharing identity features with every portrait. */
import { getAvatarAppearance } from '../client/avatar-appearance.ts';
export const ACTOR_STAGES = Object.freeze(['infant','child','youth','adult','middle','elder']);
export const ACTOR_POSES = Object.freeze(['standing','seated','reclined']);
export const ACTOR_SEXES = Object.freeze(['male','female']);
export const ACTOR_VARIANTS = Object.freeze([0,1,2]);
const INK='#263b43', CREAM='#f5e6bf', WHITE='#fff2d1', WOOD='#886447', DARK='#65503e', GREY='#adb4a6', SHADOW='#a18c68';
function drawing(){
  const layers=['01 Contact shadow','02 Limbs','03 Tunic and mantle','04 Face and neck','05 Hair and age marks','06 Sandals and small details'].map(name=>({name,rects:[]}));
  const rect=(layer,x,y,w,h,fill)=>{if(w>0&&h>0)layers[layer].rects.push({x,y,w,h,fill});};
  return{layers,rect};
}
/** The small full-body head preserves the portrait's hairstyle and facial-hair identity. */
function head(r,p,x,y,w,h,{sleeping=false}={}){
  const young=p.stage==='child';
  r(3,x,y+1,w,h-2,p.skin);r(3,x+1,y+h-1,w-2,1,p.shade);
  r(3,x-1,y+Math.floor(h/2),1,2,p.skin);r(3,x+w,y+Math.floor(h/2),1,2,p.shade);
  r(4,x,y,w,2,p.hair);
  switch(p.hairStyle){
    case 'bun':
      r(4,x+Math.floor(w/2)-2,y-2,4,3,p.hair);r(4,x-1,y+2,2,h-2,p.hair);r(4,x+w-1,y+2,2,h-2,p.hair);
      r(4,x+Math.floor(w/2)-1,y-1,2,1,p.accent);break;
    case 'side-braid':
      r(4,x,y+1,Math.max(3,w-2),2,p.hair);r(4,x-1,y+2,2,3,p.hair);
      r(4,x+w-1,y+2,2,h+(young?2:4),p.hair);r(4,x+w,y+h+2,1,2,p.accent);
      r(4,x+w-1,y+h,1,1,p.shade);break;
    case 'headband':
      r(4,x-1,y+1,w+2,2,p.hair);r(4,x-1,y+3,2,h-2,p.hair);r(4,x+w-1,y+3,2,h-2,p.hair);
      r(4,x,y+2,w,1,p.accent);break;
    case 'short-curls':
      r(4,x+1,y-1,2,1,p.hair);r(4,x+w-3,y-1,2,1,p.hair);r(4,x,y+2,1,2,p.hair);r(4,x+w-1,y+2,1,2,p.hair);break;
    case 'side-part':
      r(4,x+1,y-1,w-2,1,p.hair);r(4,x,y+2,Math.max(2,w-3),1,p.hair);r(4,x,y+3,1,2,p.hair);break;
    case 'rounded-crop':
      r(4,x+1,y-1,w-2,1,p.hair);r(4,x-1,y+1,2,3,p.hair);r(4,x+w-1,y+1,2,3,p.hair);break;
  }
  if(p.stage==='middle'){r(4,x,y+2,1,2,GREY);r(4,x+w-1,y+2,1,2,GREY);}
  if(p.facialHair==='full'){
    r(4,x+1,y+h-3,1,3,p.hair);r(4,x+w-2,y+h-3,1,3,p.hair);r(4,x+2,y+h-1,w-4,2,p.hair);
  }else if(p.facialHair==='chin'){r(4,x+2,y+h-1,Math.max(2,w-4),1,p.hair);}
  const eyeY=y+(young?3:4)+p.eyeOffset;
  if(sleeping)r(5,x+Math.floor(w/2),eyeY,2,1,INK);
  else{r(5,x+2,eyeY,1,1,INK);r(5,x+w-2,eyeY,1,1,INK);}
  r(5,x+Math.floor(w/2),y+h-2,1,1,p.shade);
  if(p.stage==='elder'){r(5,x+1,y+3,2,1,CREAM);r(5,x+w-3,y+3,2,1,CREAM);}
}
function infant(p){
  const{layers,rect:r}=drawing();
  r(0,155,96,29,2,SHADOW);r(1,156,87,28,6,DARK);r(1,155,85,3,9,WOOD);r(1,183,85,3,9,WOOD);
  r(1,158,93,3,4,DARK);r(1,179,93,3,4,DARK);
  r(2,158,84,24,8,p.robe);r(2,166,84,15,1,p.robeDark);r(2,166,91,15,1,p.robeDark);
  if(p.infantBinding==='cross'){
    for(let i=0;i<6;i++){r(2,166+i*2,85+i,3,1,p.accent);r(2,176-i*2,85+i,3,1,CREAM);}
  }else{r(2,165,86,17,2,p.accent);r(2,168,89,13,1,CREAM);}
  r(3,159,82,7,6,p.skin);r(3,160,87,5,1,p.shade);
  r(4,159,81,6,2,p.baseHair);r(4,158,83,2,3,p.baseHair);
  if(p.variant===1)r(4,161,80,3,1,p.baseHair);else if(p.variant===2)r(4,164,82,2,1,p.baseHair);
  r(5,161,85,2,1,INK);r(5,156,92,29,2,WOOD);r(5,159,92,1,2,p.accent);r(5,181,92,1,2,p.accent);
  return layers;
}
function standing(p){
  const{layers,rect:r}=drawing();const child=p.stage==='child',elder=p.stage==='elder';
  const height=child?23:p.stage==='youth'?32:elder?33:37;
  const w=child?10:p.stage==='youth'?12:14;
  const hw=child?(p.faceShape==='narrow'?5:6):(p.faceShape==='narrow'?7:p.faceShape==='round'?9:8),hh=child?6:8;
  const center=elder?166:168,x=center-Math.floor(w/2),top=96-height,hy=top, hx=center-Math.floor(hw/2),shoulder=hy+hh+1,hem=90;
  r(0,x-3,96,w+7,2,SHADOW);r(1,x-1,shoulder+3,2,child?6:11,p.skin);r(1,x+w-1,shoulder+3,2,child?6:10,p.skin);
  r(1,center-4,hem,3,6,p.skin);r(1,center+1,hem,3,6,p.shade);
  r(2,x+2,shoulder,w-4,2,p.robe);r(2,x,shoulder+2,w,hem-shoulder-1,p.robe);r(2,x+w-2,shoulder+3,2,hem-shoulder-2,p.robeDark);
  r(2,center-1,shoulder+6,1,Math.max(2,hem-shoulder-7),p.robeDark);
  r(2,center-4,shoulder+1,3,5,p.mantle);r(2,center-2,shoulder+5,3,5,p.mantle);r(2,center,shoulder+9,3,Math.max(1,hem-shoulder-9),p.mantle);
  r(2,center-3,shoulder+2,1,3,CREAM);r(2,x+1,hem-1,w-2,1,p.accent);
  if(p.sex==='female'){r(2,x+1,hem,w-2,3,p.robe);r(2,x+w-3,hem,2,3,p.robeDark);}
  r(3,center-2,shoulder-2,4,3,p.skin);head(r,p,hx,hy,hw,hh);
  if(elder){r(5,x+w+3,shoulder+7,2,96-shoulder-6,DARK);r(5,x+w,shoulder+7,5,2,WOOD);r(5,x+w-1,shoulder+6,3,2,p.skin);}
  r(5,center-5,95,5,2,DARK);r(5,center+1,95,5,2,DARK);r(5,center-4,94,2,1,WOOD);r(5,center+2,94,2,1,WOOD);
  return layers;
}
function seated(p){
  const{layers,rect:r}=drawing();const child=p.stage==='child';
  const y=child?72:p.stage==='youth'?66:63, hw=child?6:p.faceShape==='narrow'?7:p.faceShape==='round'?9:8,hh=child?6:8,x=168-Math.floor(hw/2),shoulder=y+hh+1;
  r(0,158,97,24,2,SHADOW);r(1,160,87,18,3,WOOD);r(1,161,90,2,7,DARK);r(1,175,90,2,7,DARK);
  r(1,171,89,3,7,p.skin);r(1,177,89,3,7,p.shade);
  r(2,163,shoulder,11,86-shoulder,p.robe);r(2,164,84,15,5,p.robe);r(2,163,shoulder+1,2,85-shoulder,p.robeDark);
  r(2,166,shoulder,3,6,p.mantle);r(2,168,shoulder+5,3,85-shoulder-4,p.mantle);r(2,172,86,6,1,p.robeDark);
  if(p.sex==='female')r(2,173,89,6,5,p.robe);
  r(3,166,shoulder-2,4,3,p.skin);head(r,p,x,y,hw,hh);
  r(5,173,shoulder+5,3,5,p.skin);r(5,175,shoulder+8,7,2,p.skin);r(5,170,95,6,2,DARK);r(5,176,95,6,2,DARK);
  return layers;
}
function reclined(p){
  const{layers,rect:r}=drawing();const child=p.stage==='child', length=child?25:p.stage==='youth'?34:39,y=child?83:81;
  r(0,148,90,length+8,2,SHADOW);r(1,148,y+2,12,7,CREAM);r(1,150,y+1,8,1,WHITE);
  r(2,159,y+3,length-7,7,p.robe);r(2,161,y+2,length-12,1,p.robeDark);r(2,159,y+8,length-7,2,p.robeDark);
  r(2,162,y+3,2,5,p.mantle);r(2,164,y+7,length-16,1,p.accent);
  head(r,p,151,y,7,7,{sleeping:true});r(3,158,y+4,3,2,p.skin);
  r(5,164,y+3,5,2,p.skin);r(5,165,y+5,3,1,p.shade);r(5,151+length-2,y+6,3,2,p.robe);
  return layers;
}
export function createActorLayers(stage,sex,variant,pose='standing',originId='merchant-household'){
  if(!ACTOR_STAGES.includes(stage))throw new Error(`Unknown banner stage ${stage}`);
  if(!ACTOR_POSES.includes(pose)&&pose!=='cradle')throw new Error(`Unknown banner pose ${pose}`);
  const p=getAvatarAppearance({originId,sex,variant,stage});
  if(stage==='infant')return infant(p);
  if(pose==='cradle')throw new Error('The cradle pose is only available for infants.');
  return pose==='reclined'?reclined(p):pose==='seated'?seated(p):standing(p);
}
