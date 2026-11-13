const fs=require('node:fs'),path=require('node:path');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..'),emblem=require('./emblem.cjs'),font=require('./glyphs-title.cjs');
const C={ink:'#203c42',carbon:'#111b20',teal:'#183b40',paper:'#f4f0e3',gold:'#b59a61',muted:'#9c916f'};
const u=r=>{const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r;};
for(const dir of ['masters','svg','png','review','qa'])fs.mkdirSync(path.join(ROOT,dir),{recursive:true});
const warnings=[];
withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:120000},async({listTools,callTool})=>{
 const ts=await listTools();for(const n of ['draw_path','command_batch','save_file','export','inspect_document'])if(!ts.some(t=>t.name===n))throw Error(`Missing ${n}`);
 const cat=u(await callTool('list_commands',{}));for(const id of ['object.group','object.transform','file.new','artboard.new','text.create'])if(!cat.commands.some(c=>c.id===id))throw Error(`Missing ${id}`);
 const call=async(n,a={})=>{const r=u(await callTool(n,a));if(r?.warning)warnings.push(r.warning);if(r?.warnings?.length)warnings.push(...r.warnings);return r;};
 const run=(command,params={})=>call('run_command',{command,params});
 const layer=name=>run('layer.new',{name,top:true});
 const nd=(name,width,height)=>run('file.new',{name,width,height,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb',created:1794355200});
 const ex=(format,dest,extra={})=>call('export',{format,path:path.join(ROOT,dest),...extra});
 const tx=(text,x,y,size,color,extra={})=>run('text.create',{text,x,y,size,color,font:'Inter',style:'Regular',...extra});
 async function group(ids,name){const g=await run('object.group',{ids});await run('object.setProps',{id:g.id,name});return g.id;}
 const tr=(id,x,y,sx=1,sy=sx,copy=false)=>run('object.transform',{ids:[id],matrix:[sx,0,0,sy,x,y],strokes:true,copy});
 async function paths(shapes,name){const steps=shapes.map(s=>({id:'draw_path',params:{stroke:'none',...s}}));const r=await call('command_batch',{steps,atomic:true,label:name});if(r.failed||r.completed!==steps.length)throw Error(JSON.stringify(r));return group(r.created,name);}
 const rect=(x,y,w,h,fill,name)=>paths([{d:`M${x} ${y}H${x+w}V${y+h}H${x}Z`,fill}],name);
 async function symbol(x,y,size,color=C.ink,compact=false){
   const body=await call('draw_path',{d:emblem.body,fill:color,stroke:'none',name:'Serpent / continuously tapered body and tail'});
   const head=await call('draw_path',{d:compact?emblem.headSimple:emblem.head,fill:color,stroke:'none',name:'Serpent / head, open jaws and tail bite'});
   const united=await call('pathfinder',{ids:[body.id,head.id],operation:'unite'});
   if(!united.ids?.length)throw Error(`Could not unite serpent: ${JSON.stringify(united)}`);
   const g=await group(united.ids,compact?'Ouroboros / compact emblem':'Ouroboros / detailed emblem');
   await tr(g,x,y,size/256);return g;
 }
 async function word(x,y,w,h,color=C.ink,integrated=false){
   const chars=[...'EVERFOLK'],tracking=15,total=chars.reduce((a,ch)=>a+(integrated&&ch==='O'?100:font.glyphs[ch].w),0)+tracking*7;
   const sx=w/total,sy=h/100,ids=[];let adv=0;
   for(let i=0;i<chars.length;i++){
     const ch=chars[i];let g;
     if(integrated&&ch==='O'){
       g=await symbol(0,0,100,color,true);await tr(g,x+adv*sx,y,sx,sy);
     }else{
       g=await paths(font.glyphs[ch].shapes.map(s=>({...s,fill:color,name:`${ch} / original sharp serif outline`})),`${ch} / title letter ${i+1}`);
       await tr(g,x+adv*sx,y,sx,sy);
     }
     ids.push(g);adv+=(integrated&&ch==='O'?100:font.glyphs[ch].w)+tracking;
   }
   return group(ids,integrated?'EVERFOLK / ouroboros O wordmark':'EVERFOLK / custom spaced title');
 }
 async function motto(x,y,color,size=17){const t=await tx('LIVE ANOTHER STORY',x,y,size,color,{justify:'center',style:'Medium'});await run('text.setStyle',{id:t.id,tracking:220});return t.id;}
 async function hero(x,y,s=1,palette='light'){
   const mark=palette==='heritage'?C.gold:palette==='reverse'?C.paper:C.ink,letters=palette==='light'?C.ink:C.paper,secondary=palette==='reverse'?'#b7b5a8':C.gold;
   const ids=[await symbol(437,94,326,mark),await word(180,496,840,108,letters),await motto(600,672,secondary)];
   const g=await group(ids,`Everfolk ouroboros / ${palette} primary`);if(x||y||s!==1)await tr(g,x,y,s);return g;
 }
 async function horizontal(x,y,s=1,color=C.ink){
   const ids=[await symbol(40,46,196,color),await word(298,83,810,91,color),await motto(703,230,C.gold,15)];
   const g=await group(ids,'Everfolk ouroboros / horizontal signature');if(x||y||s!==1)await tr(g,x,y,s);return g;
 }
 async function inline(x,y,s=1,color=C.ink){
   const ids=[await word(156,76,888,104,color,true),await motto(600,237,C.gold,15)];
   const g=await group(ids,'Everfolk ouroboros / integrated O signature');if(x||y||s!==1)await tr(g,x,y,s);return g;
 }

 await nd('Everfolk / Ouroboros identity',1200,800);await run('artboard.setProps',{index:0,name:'01 Primary / ink'});
 const boards=[
  {x:1300,y:0,width:1200,height:800,name:'02 Primary / reverse'},
  {x:2600,y:0,width:1200,height:800,name:'03 Primary / heritage gold'},
  {x:0,y:900,width:1200,height:300,name:'04 Horizontal signature'},
  {x:1300,y:900,width:1200,height:300,name:'05 Integrated O signature'},
  {x:2600,y:900,width:1200,height:260,name:'06 Wordmark'},
  {x:0,y:1300,width:512,height:512,name:'07 Ouroboros emblem'},
  {x:650,y:1300,width:256,height:256,name:'08 Compact emblem'},
 ];for(const b of boards)await run('artboard.new',b);
 await layer('01 Primary ink / custom lettering and serpent');await hero(0,0);
 await layer('02 Reverse / ivory');await hero(1300,0,1,'reverse');
 await layer('03 Heritage / gold and ivory');await hero(2600,0,1,'heritage');
 await layer('04 Horizontal');await horizontal(0,900);
 await layer('05 Ouroboros O');await inline(1300,900);
 await layer('06 Title lettering');await word(2780,958,840,108);
 await layer('07 Detailed symbol');await symbol(22,1322,468);
 await layer('08 Small-size symbol');await symbol(650,1300,256,C.ink,true);
 const f=await run('text.fonts');if(f.some(x=>x.status!=='exact'||x.missingGlyphs))throw Error('Motto font unavailable');
 const master='masters/Everfolk-Ouroboros.vectorcraft';await call('save_file',{path:path.join(ROOT,master),compress:true,preview:true});
 const files=['everfolk-ouroboros-primary','everfolk-ouroboros-reverse','everfolk-ouroboros-gold','everfolk-ouroboros-horizontal','everfolk-ouroboros-inline-o','everfolk-wordmark','everfolk-ouroboros-emblem','everfolk-ouroboros-compact'];
 for(let i=0;i<files.length;i++){await ex('svg',`svg/${files[i]}.svg`,{artboard:i,outlineText:true});await ex('png',`png/${files[i]}.png`,{artboard:i,scale:i<6?2:1});}
 for(const size of [16,24,32,48,64,128,256,512,1024])await ex('png',`png/emblem-${size}.png`,{artboard:7,scale:size/256});
 const d=await call('inspect_document',{depth:1});fs.writeFileSync(path.join(ROOT,'qa','master-inspection.json'),JSON.stringify(d,null,2));await run('file.close');

 await nd('Everfolk / Ouroboros presentation',2400,1800);await layer('Presentation ground');await rect(0,0,2400,1800,'#ece7da','Warm paper ground');
 await tx('Everfolk / Endless Life',70,98,43,C.ink,{font:'Source Serif 4'});await tx('OUROBOROS IDENTITY',72,140,14,'#7d7158');await tx('A CONTINUOUS LIFE. A CLEAR SIGNATURE.',2330,133,13,'#7d7158',{justify:'right'});
 await layer('01 Main night identity');await rect(70,190,1115,770,C.carbon,'Charcoal proof');await hero(70,190,.9291666667,'reverse');
 await layer('02 Heritage identity');await rect(1215,190,1115,770,C.teal,'Deep teal proof');await hero(1215,190,.9291666667,'heritage');
 await layer('03 Compact signatures');await rect(70,994,1430,331,'#f7f3e8','Horizontal paper proof');await horizontal(130,1007,1.1);
 await rect(70,1350,1430,330,'#f7f3e8','Integrated O paper proof');await inline(130,1360,1.1);
 await tx('HORIZONTAL SIGNATURE',95,1030,11,'#89795a');await tx('OUROBOROS AS THE O',95,1384,11,'#89795a');
 await layer('04 Emblem scale');await rect(1530,994,800,686,'#f7f3e8','Emblem proof');await symbol(1768,1065,324,C.ink);await tx('THE SERPENT CLOSES THE CYCLE',1930,1443,13,'#7d7158',{justify:'center'});
 for(const [i,size] of [64,48,32,24,16].entries()){const xx=1637+i*137;await symbol(xx,1516,size,C.ink,true);await tx(`${size} px`,xx+size/2,1629,11,'#7d7158',{justify:'center'});}
 await layer('Footer');await tx('Filled vector geometry / custom title lettering / primary, horizontal and integrated-O signatures',70,1750,12,'#7d7158');
 await call('save_file',{path:path.join(ROOT,'review','Everfolk-Ouroboros-Identity.vectorcraft'),compress:true,preview:true});await ex('png','review/Everfolk-Ouroboros-Identity.png');await ex('svg','review/Everfolk-Ouroboros-Identity.svg',{outlineText:true});await run('file.close');

 // Dedicated hero proofs avoid placing a transparent white logo on a white viewer.
 for(const palette of ['light','reverse','heritage']){
   await nd(`Everfolk / ${palette} proof`,1200,800);await rect(0,0,1200,800,palette==='light'?'#f5f0e2':palette==='reverse'?C.carbon:C.teal,'Presentation ground');await hero(0,0,1,palette);await ex('png',`review/everfolk-ouroboros-${palette}-proof.png`,{scale:1.5});await run('file.close');
 }
 const variants=[];
 for(const [name,color]of [['reverse',C.paper],['gold',C.gold]]){
   await nd(`Everfolk / ${name} emblem`,512,512);await symbol(22,22,468,color);await ex('svg',`svg/everfolk-ouroboros-emblem-${name}.svg`);await ex('png',`png/everfolk-ouroboros-emblem-${name}.png`,{scale:2});await run('file.close');variants.push({svg:`svg/everfolk-ouroboros-emblem-${name}.svg`,png:`png/everfolk-ouroboros-emblem-${name}.png`});
 }
 await nd('Everfolk / favicon proof',256,256);await rect(0,0,256,256,C.teal,'Deep teal icon field');await symbol(12,12,232,C.paper,true);await ex('svg','svg/everfolk-favicon.svg');for(const size of [16,32,64,128,256])await ex('png',`png/favicon-${size}.png`,{scale:size/256});await run('file.close');
 await call('open_file',{path:path.join(ROOT,master)});const reopened=await call('inspect_document',{depth:0});if(reopened.artboards.length!==8)throw Error('Master lost artboards');fs.writeFileSync(path.join(ROOT,'qa','master-reopened.json'),JSON.stringify(reopened,null,2));await ex('png','qa/emblem-reopened.png',{artboard:6,scale:1});await run('file.close');
 fs.writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify({brand:'Everfolk',concept:'Endless Life / Ouroboros',reference:'https://www.ubisoft.com/en-us/game/assassins-creed',master,artboards:8,files:files.map((f,i)=>({artboard:i,svg:`svg/${f}.svg`,png:`png/${f}.png`})),variants,palette:C,warnings},null,2));
 console.log(`Saved one editable ouroboros identity, 8 artboards, 8 SVGs and size exports. Warnings: ${warnings.length}`);
}).catch(e=>{console.error(e.stack);process.exitCode=1});
