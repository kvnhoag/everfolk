import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const core=[
 ['alexander','Alexander the Great','Campaign Provisioner','Campaign Staff Officer','Trusted Campaign Commander'],
 ['aristotle','Aristotle','Lyceum Copyist','Lyceum Researcher','Peripatetic Scholar'],
 ['euclid','Euclid','Geometrical Copyist','Proof Checker','Geometer of the Teaching Circle'],
 ['lysippos','Lysippos','Bronze Workshop Assistant','Portrait Modeller','Master of Lysippan Form'],
 ['pytheas','Pytheas of Massalia','Expedition Provisioner','Navigation Observer','Keeper of the Northern Voyage Log'],
 ['menander','Menander','Stage Copyist','New Comedy Collaborator','Dramatist of New Comedy'],
 ['demetrius','Demetrius the Besieger','Siege Workshop Assistant','Siege Engineer','Director of Siege Works'],
 ['theophrastus','Theophrastus','Plant Records Assistant','Comparative Plant Investigator','Peripatetic Botanical Scholar'],
 ['zeno','Zeno of Citium','Student of the Stoa','Stoic Discussion Leader','Scholar of Stoic Ethics'],
 ['ptolemy','Ptolemy I Soter','Egyptian Administration Clerk','Ptolemaic Supply Commissioner','Steward of Egyptian Government'],
 ['cleomenes','Cleomenes of Naucratis','Revenue Records Assistant','Grain Supply Auditor','Steward of Egyptian Grain Accounts'],
];
const extras=[['nearchus','Nearchus','Navigator of Nearchus'],['eumenes','Eumenes of Cardia','Secretary of Eumenes']];
const expected=[];
for(const [figureId,figureName,...titles] of core){
 expected.push({slug:figureId+'-parent',figureId,figureName,title:figureName,kind:'parent',tier:null,collection:'current-figure-paths'});
 ['uncommon','rare','epic'].forEach((tier,i)=>expected.push({slug:figureId+'-'+tier,figureId,figureName,title:titles[i],kind:'contribution',tier,collection:'current-figure-paths'}));
}
for(const [figureId,figureName,title] of extras){
 expected.push({slug:figureId+'-parent',figureId,figureName,title:figureName,kind:'parent',tier:null,collection:'classic-title-paths'});
 expected.push({slug:figureId+'-title',figureId,figureName,title,kind:'title',tier:null,collection:'classic-title-paths'});
}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dims=p=>{const b=fs.readFileSync(p);if(b.subarray(1,4).toString()!=='PNG')throw Error('Not PNG: '+p);return [b.readUInt32BE(16),b.readUInt32BE(20)]};
const failures=[];
const assets=expected.map(a=>{
 const paths={source:'source/'+a.slug+'.png',prompt:'prompts/'+a.slug+'.txt',final:'assets/'+a.slug+'-pixel.png',qa:'qa/'+a.slug+'-pixel.json',coarseQa:'qa/'+a.slug+'-coarse.json',coarse:'assets/'+a.slug+'-coarse.png',faceConfig:'source/'+a.slug+'-face.json'};
 const missing=Object.values(paths).filter(p=>!fs.existsSync(path.join(root,p)));
 if(missing.length)return {...a,...paths,status:'pending',missing};
 try{
  const q=JSON.parse(fs.readFileSync(path.join(root,paths.qa),'utf8').replace(/^\uFEFF/,''));
  const c=JSON.parse(fs.readFileSync(path.join(root,paths.coarseQa),'utf8').replace(/^\uFEFF/,''));
  const sourceSha256=hash(path.join(root,paths.source));
  const finalSha256=hash(path.join(root,paths.final));
  const coarseSha256=hash(path.join(root,paths.coarse));
  const finalSize=dims(path.join(root,paths.final));
  const ok=q.sourceSha256===sourceSha256 && q.outputSha256===finalSha256 && finalSize[0]===840 && finalSize[1]===1050
   && q.basePixelSize===3 && q.detailPixelSize===2 && q.outsideMaskChangedPixels===0 && q.selectedDetailDifferingPixels===0
   && q.deterministic===true && q.pngReadbackExact===true && q.sourceUnchanged===true && q.baseUnchanged===true
   && q.registeredExactIntegerBlocks===true && q.wholeCommonCells===true && q.interpolatingUpscale===false
   && c.sourceSha256===sourceSha256 && c.sourceUnchanged===true && c.deterministic===true && c.exactIntegerBlocks===true
   && q.configSha256===hash(path.join(root,paths.faceConfig)) && q.baseSha256===coarseSha256 && c.outputSha256===coarseSha256
   && q.baseQaSha256===hash(path.join(root,paths.coarseQa));
  if(!ok)throw Error('Filter/hash verification failed');
  return {...a,...paths,status:'complete',sourceSize:dims(path.join(root,paths.source)),finalSize,sourceSha256,finalSha256,faceRegions:q.config.regions,
   provenance:a.figureId==='alexander'?'Built-in generated illustration; user-supplied character/equipment design reference.':'Built-in generated illustration; imagined appearance and role-appropriate clothing informed by local authored content.'};
 }catch(e){failures.push({slug:a.slug,error:e.message});return {...a,...paths,status:'failed',error:e.message}}
});
const complete=assets.filter(x=>x.status==='complete').length;
const ready=assets.filter(x=>x.status==='complete');
const uniqueSourceImages=new Set(ready.map(a=>a.sourceSha256)).size;
const uniqueFinalImages=new Set(ready.map(a=>a.finalSha256)).size;
if(uniqueSourceImages!==complete || uniqueFinalImages!==complete)failures.push({slug:'library',error:'Duplicate image detected across distinct asset slots'});
const manifest={libraryId:'everfolk-figure-inner-art-v11',date:'2026-11-13',expected:48,complete,parentCount:13,subcardCount:35,
 scope:'11 default figure paths with three contribution subcards each, plus Nearchus and Eumenes from playable classic/sample title paths.',
 sources:['../../../src/figures/world.ts','../../../scripts/alexandria-historical-titles.mjs','../../../research/figure-biographies.json'],
 filter:{name:'PixelOE 1.0.0 legacy CPU',output:[840,1050],bodyPixelSize:3,facePixelSize:2,gridType:'mixed grid with whole-cell regional selection'},
 titleArtAliases:{'Right Hand of Alexander':'alexander-rare','General of Alexander':'alexander-epic','Disciple of Aristotle':'aristotle-epic','Disciple of Euclid':'euclid-epic','Scholar of Theophrastus':'theophrastus-epic','Trusted Adviser of Ptolemy':'ptolemy-epic','Navigator of Nearchus':'nearchus-title','Secretary of Eumenes':'eumenes-title'},
 assets};
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'qa/library-verification.json'),JSON.stringify({expected:48,complete,uniqueSourceImages,uniqueFinalImages,failures,allComplete:complete===48&&failures.length===0,sourceHashesVerified:true,finalHashesVerified:true,filterMetadataHashesVerified:true,filterChecks:'Individually verified by the bundled PixelOE scripts; source, coarse, final, face config and coarse metadata hashes independently rechecked by catalog builder.'},null,2)+'\n');
const data=JSON.stringify(manifest).replace(/</g,'\\u003c');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Everfolk · Figure inner art</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f2efe8;color:#222829;font:16px/1.5 system-ui,Segoe UI,sans-serif}header{padding:46px 5vw 25px;border-bottom:1px solid #d4d2c9}.eyebrow{font-size:12px;letter-spacing:.22em;color:#647268}h1{font-family:Georgia,serif;font-weight:400;font-size:44px;margin:6px 0 12px}header p{max-width:900px;margin:0;color:#59615d}.tools{position:sticky;top:0;z-index:4;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:16px 5vw;background:#f2efe8f2;backdrop-filter:blur(12px);border-bottom:1px solid #d4d2c9}button,select,input{font:inherit;border:1px solid #bdc4bb;border-radius:6px;background:#faf9f5;color:#28312b;padding:8px 12px;cursor:pointer}button.active{background:#304d42;color:white;border-color:#304d42}input{width:230px;cursor:text}.count{margin-left:auto;font-size:13px;color:#657068}.grid{padding:30px 5vw;display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:34px 24px;align-items:start}.card{min-width:0}.art{display:block;width:100%;aspect-ratio:4/5;object-fit:contain;background:#151b18;image-rendering:pixelated;cursor:zoom-in}.art.painting{image-rendering:auto}.kind{margin-top:12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#718075}.card h2{font:400 22px/1.2 Georgia,serif;margin:4px 0 7px}.fig{font-size:13px;color:#647068}.links{display:flex;gap:13px;margin-top:9px;font-size:12px}a{color:#3b6653;text-underline-offset:3px}.reference{margin:20px 5vw 45px;border-top:1px solid #cccfc5;padding-top:24px}.reference h2{font:400 28px Georgia,serif}.refgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1000px}.refgrid figure{margin:0}.refgrid img{height:360px;max-width:100%;object-fit:contain;background:#e8e4da}.refgrid figcaption{font-size:13px;color:#657068}.notes{max-width:1050px;font-size:14px;color:#657068}dialog{width:min(1320px,96vw);max-height:95vh;padding:20px;background:#f4f1e9;border:0;border-radius:10px}dialog::backdrop{background:#101813dc}.zoomhead{display:flex;align-items:center;justify-content:space-between}.zoomhead h2{font:400 26px Georgia,serif;margin:0 0 12px}.zoomgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.zoomgrid img{width:100%;height:auto}.zoomgrid .pixel{image-rendering:pixelated}footer{padding:25px 5vw 50px;color:#657068;font-size:13px}.pending{padding:100px 15px;background:#e0e1d8;color:#68736a;text-align:center}@media(max-width:650px){h1{font-size:34px}.grid{grid-template-columns:1fr 1fr;padding:20px;gap:25px 15px}.card h2{font-size:19px}.tools{padding:12px 20px}.count{margin-left:0}.refgrid,.zoomgrid{grid-template-columns:1fr}.refgrid img{height:300px}}</style>
<header><div class="eyebrow">EVERFOLK · ART LIBRARY V11</div><h1>Figures & earned contributions</h1><p>Distinct character illustrations and scenes of the work behind each subcard. Explore the filtered artwork or compare it with the original painting.</p></header>
<div class="tools"><button id="all" class="active" data-kind="all">All artwork</button><button data-kind="parent">Figures</button><button data-kind="subcard">Subcards</button><select id="figure"><option value="all">Every figure</option></select><input id="search" type="search" placeholder="Find a title"><button id="mode">Show paintings</button><span class="count" id="count"></span></div>
<main class="grid" id="grid"></main><section class="reference"><h2>Your equipment references</h2><div class="refgrid"><figure><img src="../references/user-alexander-character-armour.png" alt="User-supplied Alexander character armour"><figcaption>Alexander main card: supplied character outfit. Body armour adapted to the mounted pose; the anchor's bare head retained.</figcaption></figure><figure><img src="../references/user-military-equipment-sheet.png" alt="User-supplied simpler military equipment sheet"><figcaption>Military contribution cards: supplied equipment sheet, with simpler service gear and distinct task scenes.</figcaption></figure></div><p class="notes">These supplied illustrations are design references. The named figures' appearances are imaginative; they are not presented as authenticated portraits. Contribution scenes depict representative unnamed players doing authored work, rather than documenting real historical meetings. Eleven figures belong to the current figure paths; Nearchus and Eumenes are included from the playable classic/sample title paths. The pixel finish uses a coarse body grid with finer face detail.</p><p><a href="../catalog.json">Asset catalogue</a> · <a href="../REFERENCE-NOTES.txt">Source notes</a> · <a href="../qa/library-verification.json">Export verification</a></p></section><footer>13 figures · 35 subcards · Filtered PNGs 840 × 1050 · Painterly sources and exact prompts retained.</footer>
<dialog id="zoom"><div class="zoomhead"><h2 id="zoomtitle"></h2><button id="close">Close</button></div><div class="zoomgrid"><div><p>Pixel finish</p><img class="pixel" id="zoompixel" alt="Pixel finish"></div><div><p>Original painting</p><img id="zoomsource" alt="Original painting"></div></div></dialog>
<script>const library=${data};let selectedKind='all',painting=false;const grid=document.getElementById('grid'),figure=document.getElementById('figure'),search=document.getElementById('search'),count=document.getElementById('count');const names=[...new Map(library.assets.map(a=>[a.figureId,a.figureName])).entries()];for(const [id,name]of names){const o=document.createElement('option');o.value=id;o.textContent=name;figure.append(o)}function render(){grid.replaceChildren();const list=library.assets.filter(a=>(selectedKind==='all'||(selectedKind==='parent'?a.kind==='parent':a.kind!=='parent'))&&(figure.value==='all'||a.figureId===figure.value)&&(a.title+' '+a.figureName).toLowerCase().includes(search.value.toLowerCase()));for(const a of list){const c=document.createElement('article');c.className='card';if(a.status==='complete'){const img=document.createElement('img');img.className='art'+(painting?' painting':'');img.loading='lazy';img.src='../'+(painting?a.source:a.final);img.alt=a.title;img.onclick=()=>{document.getElementById('zoomtitle').textContent=a.title;document.getElementById('zoompixel').src='../'+a.final;document.getElementById('zoomsource').src='../'+a.source;document.getElementById('zoom').showModal()};c.append(img)}else{const p=document.createElement('div');p.className='pending';p.textContent='In production';c.append(p)}const k=document.createElement('div');k.className='kind';k.textContent=a.kind==='parent'?'Figure':a.kind==='title'?'Earned title':a.tier+' contribution';const h=document.createElement('h2');h.textContent=a.title;const f=document.createElement('div');f.className='fig';f.textContent=a.kind==='parent'?(a.collection==='classic-title-paths'?'Classic title path':'Current figure path'):a.figureName;const links=document.createElement('div');links.className='links';for(const [label,key]of [['PNG','final'],['Painting','source'],['Prompt','prompt']]){const l=document.createElement('a');l.href='../'+a[key];l.textContent=label;links.append(l)}c.append(k,h,f,links);grid.append(c)}count.textContent=list.filter(a=>a.status==='complete').length+' / '+list.length+' shown'}for(const b of document.querySelectorAll('[data-kind]'))b.onclick=()=>{selectedKind=b.dataset.kind;for(const x of document.querySelectorAll('[data-kind]'))x.classList.toggle('active',x===b);render()};figure.onchange=render;search.oninput=render;document.getElementById('mode').onclick=e=>{painting=!painting;e.target.textContent=painting?'Show pixel finish':'Show paintings';render()};document.getElementById('close').onclick=()=>document.getElementById('zoom').close();render();</script></html>`;
fs.writeFileSync(path.join(root,'review/index.html'),html);
console.log(JSON.stringify({expected:48,complete,failed:failures.length,pending:48-complete-failures.length}));
if(process.argv.includes('--require-complete')&&(complete!==48||failures.length)){console.error('Incomplete artwork: '+assets.filter(x=>x.status!=='complete').map(x=>x.slug).join(', '));process.exitCode=1;}
