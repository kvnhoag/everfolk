const fs=require('node:fs'),path=require('node:path');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..');
const concepts=[...require('./concepts-01-10.cjs'),...require('./concepts-11-20.cjs')];
const C={dark:'#122a2e',gold:'#d9b771',paper:'#f3e2ba',bronze:'#bb8d4b',silver:'#bbcbc4',copper:'#c28c61'};
const METALS={bronze:['#735126','#c39552','#f6df9e','#fff0b9','#9a632d','#d6b473'],silver:['#536a68','#a5b6ac','#e7e9d1','#ffffdf','#647b76','#c0cdc1'],copper:['#6e3e2e','#b77750','#edbd86','#ffe0ac','#8e5035','#d9a170']};
const grad=metal=>({gradient:{kind:'linear',angle:90,stops:[0,.22,.46,.49,.54,1].map((offset,i)=>({offset,color:METALS[metal][i]}))}});
const paint=t=>['bronze','silver','copper'].includes(t)?grad(t):C[t]||t||'none';
const unpack=r=>{const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r;};
for(const d of ['masters','svg','png','review','qa'])fs.mkdirSync(path.join(ROOT,d),{recursive:true});
const warnings=[],manifest=[];

withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:120000},async({listTools,callTool})=>{
 const tools=await listTools();
 for(const n of ['draw_path','set_paint','command_batch','save_file','export'])if(!tools.some(t=>t.name===n))throw Error(`Missing tool ${n}`);
 const catalog=unpack(await callTool('list_commands',{}));
 for(const id of ['text.create','type.createOutlines','object.transform','object.ungroup','object.group'])if(!catalog.commands.some(c=>c.id===id))throw Error(`Missing command ${id}`);
 const call=async(n,a={})=>{const r=unpack(await callTool(n,a));if(r?.warning)warnings.push({tool:n,warning:r.warning});if(r?.warnings?.length)warnings.push({tool:n,warnings:r.warnings});return r;};
 const run=(command,params={})=>call('run_command',{command,params});
 const layer=name=>run('layer.new',{name,top:true});
 const newDoc=(name,width=1000,height=560)=>run('file.new',{name,width,height,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb',created:1794355200});
 const text=(str,x,y,size=20,color='#dfcba3',extra={})=>run('text.create',{text:str,x,y,size,font:'Inter',style:'Regular',color,...extra});
 const rect=(x,y,w,h,fill,name)=>call('draw_path',{d:`M${x} ${y}H${x+w}V${y+h}H${x}Z`,fill,stroke:'none',name});
 const exportTo=(format,dest,opts={})=>call('export',{format,path:path.join(ROOT,dest),...opts});
 async function group(ids,name){const g=await run('object.group',{ids});await run('object.setProps',{id:g.id,name});return g.id;}
 async function paths(shapes,name){
   if(!shapes.length)return null;
   const steps=shapes.map((s,i)=>({id:'draw_path',params:{...s,fill:paint(s.fill),stroke:paint(s.stroke),name:s.name||`${name} / detail ${i+1}`}}));
   const r=await call('command_batch',{steps,atomic:true,label:name});
   if(r.failed||r.completed!==steps.length)throw Error(`Path batch ${name}: ${JSON.stringify(r)}`);
   return group(r.created,name);
 }
 async function glyphs(str,c,box,mode){
   const tx=await run('text.create',{text:str,x:0,y:150,size:150,font:c.font,style:'Bold',color:C[c.metal]});
   if(tx.warning)throw Error(`Font unavailable ${c.font}: ${tx.warning}`);
   await run('text.setStyle',{id:tx.id,tracking:c.tracking??8});
   await run('select.set',{ids:[tx.id]});const o=await run('type.createOutlines');
   await run('object.ungroup',{ids:o.ids});
   let d=await call('inspect_document',{depth:0});const ids=d.selection;
   let nodes=(await call('inspect_document',{ids})).nodes.sort((a,b)=>a.bounds.x-b.bounds.x);
   const minx=Math.min(...nodes.map(n=>n.bounds.x)),miny=Math.min(...nodes.map(n=>n.bounds.y));
   const maxx=Math.max(...nodes.map(n=>n.bounds.x+n.bounds.width)),maxy=Math.max(...nodes.map(n=>n.bounds.y+n.bounds.height));
   const off=mode==='shadow'?[3,8]:[0,0],sx=box.w/(maxx-minx),sy=box.h/(maxy-miny);
   await run('object.transform',{ids,matrix:[sx,0,0,sy,box.x-minx*sx+off[0],box.y-miny*sy+off[1]],strokes:true});
   nodes=(await call('inspect_document',{ids})).nodes.sort((a,b)=>a.bounds.x-b.bounds.x);
   for(let i=0;i<nodes.length;i++){
     const n=nodes[i],b=n.bounds,t=i/(nodes.length-1);
     if(c.layout==='arch')await run('object.move',{ids:[n.id],dx:0,dy:-27*Math.sin(t*Math.PI)});
     if((c.layout==='bookends'||c.layout==='arch')&&(i===0||i===nodes.length-1)){
       await run('object.scale',{ids:[n.id],sx:102,sy:c.layout==='bookends'?128:114,origin:[b.x+b.width/2,b.y+b.height],strokes:true});
     }
     await run('object.setProps',{id:n.id,name:`${str[i]} / ${mode} / ${i+1}`});
   }
   if(mode==='shadow')await call('set_paint',{ids,fill:'#101a1c',stroke:'#101a1c',strokeWidth:9});
   else if(mode==='rim')await call('set_paint',{ids,fill:C[c.metal],stroke:grad(c.metal),strokeWidth:4.5});
   else{
     await call('set_paint',{ids,fill:grad(c.metal),stroke:'#513a27',strokeWidth:0.65});
     await call('apply_effect',{ids,effect:'threeD.extrude',params:{depth:5,bevel:'classic',bevelWidth:1.7,bevelHeight:1.5,rotationX:0,rotationY:0,rotationZ:0,lightHeight:65,lightRotation:125,ambient:50,lightIntensity:80}});
   }
   return group(ids,`EVERFOLK ${mode} / ${c.font} customised outlines`);
 }
 async function title(c){
   const lines=c.layout==='stacked'?[['EVER',{x:265,y:149,w:470,h:106}],['FOLK',{x:235,y:281,w:530,h:120}]]:[['EVERFOLK',{x:97,y:221,w:806,h:119}]];
   const all=[];
   for(const mode of ['shadow','rim','face'])for(const [str,box]of lines)all.push(await glyphs(str,c,box,mode));
   return group(all,'Title / cast metal and editable engraved lettering');
 }
 async function drawLogo(c,x=0,y=0,scale=1){
   const roots=[];
   roots.push(await paths(c.back,'Architectural emblem / behind title'));
   roots.push(await title(c));
   roots.push(await paths(c.front,'Engraved finishing details'));
   const ty=c.tagY||443;
   const tag=await text('LIVE ANOTHER STORY',500,ty,17,'#e4cea5',{justify:'center',font:'Georgia',style:'Regular'});
   await run('text.setStyle',{id:tag.id,tracking:130});
   roots.push(tag.id);
   const g=await group(roots.filter(Boolean),`${c.id} ${c.name} / complete game title logo`);
   if(scale!==1||x||y)await run('object.transform',{ids:[g],matrix:[scale,0,0,scale,x,y],strokes:true,corners:true});
   return g;
 }
 const selected=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
 for(const c of concepts.filter(c=>!selected||selected.includes(c.id))){
   await newDoc(`Everfolk / game title ${c.id} ${c.name}`);
   await run('artboard.setProps',{index:0,name:`${c.id} Transparent logo`});
   await run('artboard.new',{x:1100,y:0,width:1000,height:560,name:`${c.id} Dark proof`});
   await layer('01 Dark proof ground');
   await rect(1100,0,1000,560,{gradient:{kind:'radial',stops:[{offset:0,color:'#26494c'},{offset:1,color:'#101f24'}]}},'Dark teal proof ground');
   await layer('02 Game title / editable vector lettering and emblem');
   const g=await drawLogo(c);
   await run('object.transform',{ids:[g],matrix:[1,0,0,1,1100,0],copy:true,strokes:true});
   const base=`${c.id}-${c.slug}`;
   await call('save_file',{path:path.join(ROOT,'masters',`${base}.vectorcraft`),compress:true,preview:true});
   await exportTo('svg',`svg/${base}.svg`,{artboard:0,outlineText:true});
   await exportTo('png',`png/${base}-transparent.png`,{artboard:0,scale:2});
   await exportTo('png',`png/${base}-dark.png`,{artboard:1,scale:1.5});
   const inspection=await call('inspect_document',{depth:1});
   fs.writeFileSync(path.join(ROOT,'qa',`${base}.json`),JSON.stringify(inspection,null,2));
   manifest.push({id:c.id,name:c.name,slug:c.slug,font:c.font,metal:c.metal,layout:c.layout,master:`masters/${base}.vectorcraft`,svg:`svg/${base}.svg`,proof:`png/${base}-dark.png`});
   await run('file.close');console.log(`Saved ${c.id} ${c.name}`);
 }
 if(!selected||process.argv.includes('--review')){
   if(selected){manifest.length=0;manifest.push(...JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).concepts);}
   await newDoc('Everfolk / 20 historical strategy game titles',2400,2180);
   await layer('Ground');await rect(0,0,2400,2180,'#101f24','Overview ground');
   await text('EVERFOLK',60,88,51,'#ead3a0',{font:'Georgia',style:'Bold'});
   await text('HISTORICAL STRATEGY / 20 GAME TITLE LOGO STUDIES',62,130,15,'#acb5a4');
   await text('VECTORCRAFT  /  V2',2340,124,13,'#bca06c',{justify:'right'});
   for(let i=0;i<concepts.length;i++){
     const c=concepts[i],x=60+(i%4)*576,y=181+Math.floor(i/4)*392;
     await layer(`${c.id} ${c.name}`);
     await rect(x,y,552,368,{gradient:{kind:'radial',stops:[{offset:0,color:'#294a4c'},{offset:1,color:'#172c31'}]}},'Dark title panel');
     await text(`${c.id}  ${c.name}`,x+20,y+31,15,'#c9af7a',{style:'Medium'});
     await drawLogo(c,x+21,y+28,.51);
     await text(`${c.metal.toUpperCase()}  /  ${c.layout.toUpperCase()}`,x+20,y+345,10,'#718a83');
   }
   await call('save_file',{path:path.join(ROOT,'review','Everfolk-20-game-title-logos.vectorcraft'),compress:true,preview:true});
   await exportTo('png','review/Everfolk-20-game-title-logos.png',{scale:1});
   await exportTo('svg','review/Everfolk-20-game-title-logos.svg',{outlineText:true});
   await run('file.close');
   for(const m of manifest.filter(m=>!selected||selected.includes(m.id))){await call('open_file',{path:path.join(ROOT,m.master)});const d=await call('inspect_document',{depth:0});if(d.artboards.length!==2)throw Error(`${m.id}: native artboard loss`);fs.writeFileSync(path.join(ROOT,'qa',`${m.id}-reopened.json`),JSON.stringify(d,null,2));await run('file.close');}
   fs.writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify({brand:'Everfolk',revision:2,direction:'Historical strategy',motto:'Live another story',createdWith:'ArtCraft VectorCraft native paths, outlined and customised lettering, vector extrusion and bevels',concepts:manifest,warnings},null,2));
   console.log(`Completed ${manifest.length} game title logos. Reopened every native master. Warnings: ${warnings.length}`);
 }
}).catch(e=>{console.error(e.stack);process.exitCode=1});
