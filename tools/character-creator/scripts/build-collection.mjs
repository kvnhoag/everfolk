import { mkdir, writeFile, readFile, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Raster, encodePng, openRaster, zip } from './raster.mjs';
import { NFT_PROFILES } from '../src/nft-collection.js';
import { drawCharacter, drawLandscape } from '../src/renderer.js';
import { DEFAULT, OPTIONS, normalize } from '../src/data.js';
import { FIGURE_DESIGN, drawHistoricalFrame } from '../src/historical-frame.js';
import { historicalStage, stageIndex } from '../src/historical-stages.js';
import { FIGURES } from '../../../chain/catalog/figures.ts';
import { NPC_INFLUENCES } from '../../../chain/catalog/npc-influences.ts';
import { FIGURE_ACTIONS, NPC_ACTIONS, RARITY_LABELS, RARITY_POWER_BPS } from '../../../chain/ids.ts';
import { ACTION_NAMES, GROUP_TITLE } from '../../../client/chain/chain-copy.ts';

const root=fileURLToPath(new URL('../',import.meta.url)),repo=path.resolve(root,'../..'),out=path.join(root,'nft-collection');
const rarityColors=['#b8b5a6','#7f9364','#608baf','#b596bb','#d6aa52'];
async function write(relative,data){const full=path.join(out,relative);await mkdir(path.dirname(full),{recursive:true});await writeFile(full,data);}
export function renderSprite(state,view='front'){const raster=new Raster(64,96,{layers:true});drawCharacter(raster,state,view);return raster;}
export function renderCard(profile,descriptor,rarity=null){
  const tier=stageIndex(rarity),card=new Raster(480,640,{layers:true}),accent=profile.kind==='figure'?rarityColors[tier]:rarity===null?profile.accent:rarityColors[tier];
  card.beginLayer('00-landscape');card.rect(0,0,480,640,'#29252a');card.rect(24,72,432,416,'#695140');
  const landscape=new Raster(240,190);drawLandscape(landscape,profile.state.birthplace,profile.state.backdrop,tier);card.blit(landscape,24,72,432,416);
  const sprite=renderSprite(profile.state);
  for(const layer of sprite.layers){card.beginLayer(layer.name);card.blit({width:64,height:96,data:layer.data},112,100,256,384);}
  if(profile.kind==='figure'&&tier>=2){card.beginLayer('98-historical-identity-frame');drawHistoricalFrame(card,profile.id,accent,tier);}
  card.beginLayer('99-frame-and-lettering');
  for(const [x,y,w,h]of [[7,7,466,2],[7,631,466,2],[7,7,2,626],[471,7,2,626],[16,16,448,1],[16,623,448,1]])card.rect(x,y,w,h,accent);
  card.text('EVERFOLK',26,28,2,accent);card.text('LIVING LEGACIES',26,48,1,'#f4e8c6');
  const badge=rarity===null?(profile.kind==='figure'?'FIGURE / CAP 5':'NPC / STUDY'):RARITY_LABELS[rarity].toUpperCase();card.text(badge,454-badge.length*6,33,1,accent);
  card.rect(26,505,40,3,accent);card.text(profile.state.name,26,524,3,'#fff5d8');
  card.text(descriptor.title,26,554,1,accent);
  descriptor.actions.forEach((action,i)=>card.text(action.name,26,577+i*19,action.name.length>34?1:2,'#f4e8c6'));
  card.text(rarity===null?'ART STUDY / NOT A MINTED TOKEN':`RARITY ART PREVIEW / ${RARITY_LABELS[rarity]}`,26,615,1,accent);
  return card;
}

export async function buildCollection(){
 await mkdir(out,{recursive:true});
 const manifest={schemaVersion:1,collection:'Everfolk / Living Legacies',purpose:'Editable collection artwork; no tokens are minted by this tool.',sourceCommit:'56f5d69631f9df2e717a22de3d7334f5a0a004ee',sources:['chain/ids.ts','chain/catalog/figures.ts','chain/catalog/npc-influences.ts','chain/catalog/figure-influences.ts','client/chain/chain-copy.ts','guide/TUTORIAL.md'],rarityRules:RARITY_LABELS.map((label,i)=>({label,powerBps:RARITY_POWER_BPS[i]})),historicalNote:'Fictional, stylized appearances. Euclid and Cleomenes are not authenticated portraits. Visual colors and costumes are art direction, not NFT rarity assignments. Five artwork variants do not allocate the five historical-figure token copies.',characters:[]};
 const contact=new Raster(1280,766);contact.rect(0,0,1280,766,'#efe6cc');contact.text('EVERFOLK / LIVING LEGACIES',28,22,3,'#3e4f3d');contact.text('4 HISTORICAL FIGURES + 6 PEOPLE OF ALEXANDRIA / CREATOR PIXEL ART',28,53,1,'#695140');
 const historicalContact=new Raster(1072,414);historicalContact.rect(0,0,1072,414,'#efe6cc');historicalContact.text('EVERFOLK / HISTORICAL FIGURES',24,18,3,'#3e4f3d');historicalContact.text('COMMON LIFE STAGES / DISTINCT SETTINGS / THE SAME CHARACTER AT EVERY TIER',24,48,1,'#695140');let historicalIndex=0;
 const progression=new Raster(1328,1472);progression.rect(0,0,1328,1472,'#efe6cc');progression.text('EVERFOLK / LIVES IN FIVE CHAPTERS',24,20,3,'#3e4f3d');progression.text('ONE IDENTITY / FIVE PRESTIGE STAGES / BACKGROUND AND FRAME PROGRESSION',24,51,1,'#695140');RARITY_LABELS.forEach((label,i)=>progression.text(label,32+i*260,80,2,'#3e4f3d'));
 for(const [index,profile]of NFT_PROFILES.entries()){
  if(profile.kind==='figure'&&(!FIGURE_DESIGN[profile.id]||profile.frame!==FIGURE_DESIGN[profile.id].frame||profile.state.figure!==profile.id||profile.state.backdrop!==FIGURE_DESIGN[profile.id].scene))throw new Error(`Historical frame/background rule violated: ${profile.id}`);
  if(profile.kind==='npc'&&(profile.frame!=='citizen'||profile.state.figure!=='none'))throw new Error(`NPC must use the citizen frame: ${profile.id}`);
  const figure=FIGURES.find(entry=>entry.figure===profile.id),ids=figure?FIGURE_ACTIONS[profile.id]:NPC_ACTIONS[profile.id].actions;
  const descriptor={id:profile.id,kind:profile.kind,title:figure?.title??GROUP_TITLE[profile.id],summary:figure?.summary??NPC_INFLUENCES.filter(entry=>ids.includes(entry.id)).map(entry=>entry.label).join(' '),supplyCap:figure?.supplyCap??null,actions:ids.map(id=>({id,name:ACTION_NAMES[id]})),profile:`${profile.id}/profile.json`,card:`${profile.id}/card.png`,sprite:`${profile.id}/front-3x.png`,sheet:`${profile.id}/three-views-3x.png`,layeredCard:`${profile.id}/card.ora`,views:[],rarityVariants:RARITY_LABELS.map((label,i)=>({label,path:`${profile.id}/rarity-${i}.png`,artPreviewOnly:true}))};
  await write(descriptor.profile,JSON.stringify(profile.state,null,2)+'\n');
  descriptor.frameFamily=profile.frame;descriptor.frameStyle='citizen';descriptor.background=`${profile.id}/background.png`;descriptor.face={shape:profile.state.face,eyes:profile.state.eyes,brows:profile.state.brows,nose:profile.state.nose,expression:profile.state.expression};
  const background=new Raster(240,190);drawLandscape(background,profile.state.birthplace,profile.state.backdrop);await write(descriptor.background,background.png());
  const card=renderCard(profile,descriptor);await write(descriptor.card,card.png());await write(descriptor.layeredCard,openRaster(card));
  const sheet=new Raster(192,96);
  for(const [viewIndex,view]of ['front','side','back'].entries()){
    const sprite=renderSprite(profile.state,view),large=new Raster(192,288);large.blit(sprite,0,0,192,288);
    await write(`${profile.id}/${view}.png`,sprite.png());await write(`${profile.id}/${view}-3x.png`,large.png());await write(`${profile.id}/${view}.ora`,openRaster(sprite));
    const layers=[];for(const layer of sprite.layers){if(!layer.data.some((v,i)=>i%4===3&&v))continue;const file=`${profile.id}/layers/${view}/${layer.name}.png`;await write(file,encodePng(64,96,layer.data));layers.push({name:layer.name,path:file,width:64,height:96});}
    descriptor.views.push({view,path:`${profile.id}/${view}.png`,layered:`${profile.id}/${view}.ora`,layers});sheet.blit(sprite,viewIndex*64,0);
  }
  const largeSheet=new Raster(576,288);largeSheet.blit(sheet,0,0,576,288);await write(descriptor.sheet,largeSheet.png());
  for(let rarity=0;rarity<5;rarity++){
    const variant=descriptor.rarityVariants[rarity],variantCard=renderCard(profile,descriptor,rarity);
    variant.background=`${profile.id}/background-rarity-${rarity}.png`;variant.layeredCard=`${profile.id}/rarity-${rarity}.ora`;variant.profile=`${profile.id}/profile-rarity-${rarity}.json`;variant.stage=historicalStage(profile.id,rarity);variant.frameStyle=figure&&rarity>=2?profile.frame:'citizen';
    await write(variant.path,variantCard.png());await write(variant.layeredCard,openRaster(variantCard));await write(variant.profile,JSON.stringify({...profile.state,rarity:String(rarity)},null,2)+'\n');
    const variantBackground=new Raster(240,190);drawLandscape(variantBackground,profile.state.birthplace,profile.state.backdrop,rarity);await write(variant.background,variantBackground.png());
    if(figure){const y=104+historicalIndex*340;progression.blit(variantCard,24+rarity*260,y,240,320);progression.text(variant.stage.title,26+rarity*260,y+324,1,'#695140');}
  }
  contact.blit(card,28+(index%5)*248,82+Math.floor(index/5)*336,232,310);
  descriptor.sha256=createHash('sha256').update(card.png()).digest('hex');manifest.characters.push(descriptor);
  if(['alexander','euclid'].includes(profile.id)){
    const examples=path.join(root,'historical-figures');await mkdir(examples,{recursive:true});
    await writeFile(path.join(examples,`${profile.id}.json`),JSON.stringify(profile.state,null,2)+'\n');
    await writeFile(path.join(examples,`${profile.id}-collectible.png`),card.png());
    await copyFile(path.join(out,descriptor.sprite),path.join(examples,`${profile.id}-front-3x.png`));
  }
  if(figure){historicalContact.blit(card,24+historicalIndex*256,72,240,320);historicalIndex++;const figuresDir=path.join(repo,'public/assets/figures');await mkdir(figuresDir,{recursive:true});await writeFile(path.join(figuresDir,`${profile.id}.png`),card.png());await writeFile(path.join(figuresDir,`${profile.id}-front.png`),await readFile(path.join(out,descriptor.sprite)));}
 }
 const faceSheet=new Raster(976,452);faceSheet.rect(0,0,976,452,'#efe6cc');faceSheet.text('EVERFOLK / FACES OF ALEXANDRIA',20,20,3,'#3e4f3d');faceSheet.text('6 FACE SHAPES / EYES, NOSES, BROWS AND EXPRESSIONS / EDITABLE CREATOR PROFILES',20,53,1,'#695140');
 const studies=[];
 for(const [index,[shape]]of OPTIONS.face.entries())for(let row=0;row<2;row++){
  const study=normalize({...DEFAULT,name:`Face ${shape} ${row+1}`,face:shape,skin:['sand','honey','copper','clay','umber','date'][(index+row)%6],hair:['short','wavy','curly','shaved','braids','bun'][(index+row)%6],hairColor:row?'silver':'ink',beard:'none',marks:'none',eyes:['almond','round','deep','narrow','wide','relaxed'][(index+row)%6],nose:['small','straight','broad','aquiline','long','straight'][(index+row)%6],brows:row?'arched':'straight',expression:row?'thoughtful':'smile',prop:'none'});
  const sprite=renderSprite(study),crop=new Raster(40,46);for(let y=0;y<46;y++)crop.data.set(sprite.data.subarray(((y+6)*64+12)*4,((y+6)*64+52)*4),y*40*4);
  const x=20+index*156,y=80+row*180;faceSheet.blit(crop,x+16,y,120,138);faceSheet.text(shape,x+16,y+145,2,'#3e4f3d');faceSheet.text(`${study.eyes} / ${study.expression}`,x+5,y+164,1,'#695140');
  const file=`face-studies/${shape}-${row+1}.png`;await write(file,crop.png());studies.push({image:file,state:study});
 }
 await write('face-studies.json',JSON.stringify(studies,null,2)+'\n');await write('face-study.png',faceSheet.png());
 await write('historical-contact-sheet.png',historicalContact.png());
 await write('historical-progression.png',progression.png());
 await write('DESIGN.md',await readFile(path.join(root,'DESIGN.md')));
 await write('contact-sheet.png',contact.png());await write('manifest.json',JSON.stringify(manifest,null,2)+'\n');
 const archive=[];async function collect(dir){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const full=path.join(dir,entry.name);if(entry.isDirectory())await collect(full);else if(entry.name!=='collection.zip')archive.push([path.relative(out,full).replaceAll('\\','/'),await readFile(full)]);}}await collect(out);await write('collection.zip',zip(archive));
 console.log(`Built ${manifest.characters.length} characters, 50 rarity art previews, 30 view masters, 60 layered cards and 20 historical stage backgrounds.`);
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildCollection();
