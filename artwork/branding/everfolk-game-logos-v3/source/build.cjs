const fs=require('node:fs'),path=require('node:path');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..');
const concepts=require('./concepts.cjs');
const fonts={monumental:require('./glyphs-monumental.cjs'),uncial:require('./glyphs-uncial.cjs'),geometric:require('./glyphs-geometric.cjs'),organic:require('./glyphs-organic.cjs')};
fonts.display=fonts.monumental;
const u=r=>{const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r;};
for(const d of ['masters','svg','png','review','qa'])fs.mkdirSync(path.join(ROOT,d),{recursive:true});
const manifest=[],warnings=[];
const finish=c=>({gradient:{kind:'linear',angle:90,stops:c.finish==='pale'?[{offset:0,color:'#fff0c4'},{offset:.5,color:'#d3bb80'},{offset:1,color:'#9c7945'}]:[{offset:0,color:'#f8e8b5'},{offset:.56,color:'#d0ac67'},{offset:1,color:'#976b33'}]}});

withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:120000},async({listTools,callTool})=>{
 const t=await listTools();for(const n of ['draw_path','command_batch','save_file','export','inspect_document'])if(!t.some(x=>x.name===n))throw Error(`Missing ${n}`);
 const cat=u(await callTool('list_commands',{}));for(const id of ['object.transform','object.group','file.new','layer.new'])if(!cat.commands.some(x=>x.id===id))throw Error(`Missing ${id}`);
 const call=async(n,a={})=>{const r=u(await callTool(n,a));if(r?.warning)warnings.push({n,warning:r.warning});if(r?.warnings?.length)warnings.push({n,warnings:r.warnings});return r;};
 const run=(command,params={})=>call('run_command',{command,params});
 const layer=name=>run('layer.new',{name,top:true});
 const newDoc=(name,width=1000,height=600)=>run('file.new',{name,width,height,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb',created:1794355200});
 const ex=(format,dest,opts={})=>call('export',{format,path:path.join(ROOT,dest),...opts});
 const text=(str,x,y,size,color,extra={})=>run('text.create',{text:str,x,y,size,color,font:'Inter',style:'Regular',...extra});
 const rect=(x,y,w,h,color,name)=>call('draw_path',{d:`M${x} ${y}H${x+w}V${y+h}H${x}Z`,fill:color,stroke:'none',name});
 async function group(ids,name){const g=await run('object.group',{ids});await run('object.setProps',{id:g.id,name});return g.id;}
 function glyph(c,char){const f=c.hybrid&&char!=='E'?fonts.organic:fonts[c.family];const g=f.glyphs[char];if(!g)throw Error(`Missing ${c.id} glyph ${char}`);return g;}
 function paint(c,token,mono=false){if(!token||token==='none')return 'none';if(mono)return '#24464b';if(token==='face')return c.finish?finish(c):c.face;if(token==='accent')return c.accent;if(token==='shade')return c.finish?'#6e5439':'#152b2d';if(token==='light')return '#f8ecd0';return token;}
 async function paths(shapes,c,name,mono=false){
   if(!shapes.length)return null;
   const steps=shapes.map((s,i)=>({id:'draw_path',params:{...s,fill:paint(c,s.fill,mono),stroke:paint(c,s.stroke,mono),name:s.name||`${name} / ${i+1}`}}));
   const r=await call('command_batch',{steps,atomic:true,label:name});if(r.failed||r.completed!==steps.length)throw Error(`${name}: ${JSON.stringify(r)}`);
   return group(r.created,name);
 }
 async function word(c,line,mono=false){
   const chars=[...line.text],tracking=line.tracking??3,total=chars.reduce((sum,ch)=>sum+glyph(c,ch).w,0)+tracking*(chars.length-1);
   const sx=line.w/total,sy=line.h/100,roots=[];let adv=0;
   for(let i=0;i<chars.length;i++){
     const char=chars[i],g=glyph(c,char),factor=i===0?(line.first||1):i===chars.length-1?(line.last||1):1;
     let x=line.x+adv*sx,y=line.y+line.h*(1-factor)+(line.curve||0)*Math.sin(Math.PI*i/(chars.length-1));
     const letter=await paths(g.shapes,c,`${char} / custom ${c.family} letter ${i+1}`,mono);
     await run('object.transform',{ids:[letter],matrix:[sx,0,0,sy*factor,x,y],strokes:true});
     roots.push(letter);adv+=g.w+tracking;
   }
   return group(roots,`${line.text} / original ${fonts[c.family].name} lettering`);
 }
 async function logo(c,x=0,y=0,scale=1,mono=false){
   const roots=[];
   for(const line of c.lines)roots.push(await word(c,line,mono));
   roots.push(await paths(c.decor,c,'Everfolk signature details',mono));
   const light=/^#[ef]/.test(c.background),tagColor=mono?'#24464b':light?'#75613f':'#c5b58d';
   const tx=await text('LIVE ANOTHER STORY',500,c.mottoY,16,tagColor,{font:'Inter',justify:'center',style:'Medium'});
   await run('text.setStyle',{id:tx.id,tracking:125});roots.push(tx.id);
   const g=await group(roots.filter(Boolean),`${c.id} ${c.name} / ${mono?'one colour':'primary'} game logo`);
   if(x||y||scale!==1)await run('object.transform',{ids:[g],matrix:[scale,0,0,scale,x,y],strokes:true});
   return g;
 }
 const selected=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
 for(const c of concepts.filter(c=>!selected||selected.includes(c.id))){
   await newDoc(`Everfolk / reference-led ${c.id} ${c.name}`);
   await run('artboard.setProps',{index:0,name:`${c.id} Transparent primary`});
   await run('artboard.new',{x:1100,y:0,width:1000,height:600,name:`${c.id} Presentation proof`});
   await run('artboard.new',{x:2200,y:0,width:1000,height:600,name:`${c.id} One colour`});
   await layer('01 Presentation ground');await rect(1100,0,1000,600,c.background,'Proof ground');
   await layer('02 Original lettering and signature');const g=await logo(c);
   await run('object.transform',{ids:[g],matrix:[1,0,0,1,1100,0],copy:true,strokes:true});
   await layer('03 One-colour lettering');await logo(c,2200,0,1,true);
   const fontsInDoc=await run('text.fonts');if(fontsInDoc.some(f=>f.status!=='exact'||f.missingGlyphs))throw Error(`Missing supporting font ${c.id}`);
   const base=`${c.id}-${c.slug}`;
   await call('save_file',{path:path.join(ROOT,'masters',`${base}.vectorcraft`),compress:true,preview:true});
   await ex('svg',`svg/${base}.svg`,{artboard:0,outlineText:true});
   await ex('svg',`svg/${base}-mono.svg`,{artboard:2,outlineText:true});
   await ex('png',`png/${base}-transparent.png`,{artboard:0,scale:2});
   await ex('png',`png/${base}-proof.png`,{artboard:1,scale:1.5});
   const d=await call('inspect_document',{depth:1});fs.writeFileSync(path.join(ROOT,'qa',`${c.id}.json`),JSON.stringify(d,null,2));
   manifest.push({...c,master:`masters/${base}.vectorcraft`,svg:`svg/${base}.svg`,mono:`svg/${base}-mono.svg`,proof:`png/${base}-proof.png`});
   await run('file.close');console.log(`Saved ${c.id} ${c.name}`);
 }
 if(!selected||process.argv.includes('--review')){
   if(selected){manifest.length=0;manifest.push(...JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).concepts);}
   await newDoc('Everfolk / 20 reference-led game logos',2400,2020);
   await layer('Review ground');await rect(0,0,2400,2020,'#101f24','Review ground');
   await text('Everfolk',60,98,60,'#e5d9b8',{font:'Source Serif 4'});
   await text('TWENTY ORIGINAL GAME LOGOS / FIVE LETTERING DIRECTIONS',63,139,14,'#9aa9a3');
   await text('REFERENCE-LED STUDIES / V3',2328,135,13,'#bca06c',{justify:'right'});
   const labels=[['INSCRIPTION','Civilization VII · Anno 1800'],['CALLIGRAPHY','Crusader Kings III'],['GEOMETRY','Manor Lords'],['LIVING LETTERS','Old World'],['DISPLAY TITLE','Age of Empires IV']];
   for(let col=0;col<5;col++){
     const x=60+col*456;
     await text(labels[col][0],x,203,14,'#d8c496',{style:'Medium'});
     await text(labels[col][1],x,226,11,'#9caaa2');
     for(let row=0;row<4;row++){
       const c=concepts[col*4+row],y=252+row*420,light=/^#[ef]/.test(c.background);
       await layer(`${c.id} ${c.name}`);await rect(x,y,438,390,c.background,'Concept proof');
       await text(c.id,x+18,y+29,13,light?'#8e6e42':'#bca06c',{style:'Medium'});
       await logo(c,x+9,y+34,.42);
       await text(c.name,x+18,y+344,17,light?'#24464b':'#d8d8c4',{font:'Source Serif 4'});
       await text('ORIGINAL EVERFOLK LETTERING',x+18,y+370,9,light?'#7d725f':'#879a92');
     }
   }
   await text('References inform lettering and hierarchy. Every Everfolk letterform and symbol is original.',60,1980,12,'#9caaa2');
   await call('save_file',{path:path.join(ROOT,'review','Everfolk-20-reference-led-logos.vectorcraft'),compress:true,preview:true});
   await ex('png','review/Everfolk-20-reference-led-logos.png',{scale:1});
   await ex('svg','review/Everfolk-20-reference-led-logos.svg',{outlineText:true});
   await run('file.close');
   for(const c of manifest.filter(c=>!selected||selected.includes(c.id))){await call('open_file',{path:path.join(ROOT,c.master)});const d=await call('inspect_document',{depth:0});if(d.artboards.length!==3)throw Error(`Native reopen ${c.id}`);fs.writeFileSync(path.join(ROOT,'qa',`${c.id}-reopened.json`),JSON.stringify(d,null,2));await run('file.close');}
   fs.writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify({brand:'Everfolk',revision:3,method:'Original drawn vector lettering informed by official game logo research; created in VectorCraft',concepts:manifest,warnings},null,2));
   console.log(`Finished ${manifest.length} original-lettered logos; warnings ${warnings.length}`);
 }
}).catch(e=>{console.error(e.stack);process.exitCode=1});
