const fs=require('node:fs'),path=require('node:path');
const {withMcp}=require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT=path.resolve(__dirname,'..'),concepts=require('./concepts.cjs');
const fonts={woodcut:require('./glyphs-woodcut.cjs'),uncial:require('./glyphs-uncial.cjs'),organic:require('./glyphs-organic.cjs')};
const vignettes=require('./story-vignettes.cjs'),flourishes=require('./flourishes.cjs');
const u=r=>{const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r;};
for(const d of ['masters','svg','png','review','qa'])fs.mkdirSync(path.join(ROOT,d),{recursive:true});
const warnings=[],manifest=[];

withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:120000},async({listTools,callTool})=>{
 const tools=await listTools();for(const n of ['draw_path','command_batch','save_file','export','inspect_document'])if(!tools.some(t=>t.name===n))throw Error(`Missing ${n}`);
 const catalog=u(await callTool('list_commands',{}));for(const id of ['object.clippingMask.make','object.transform','object.group','file.new'])if(!catalog.commands.some(c=>c.id===id))throw Error(`Missing ${id}`);
 const call=async(n,a={})=>{const r=u(await callTool(n,a));if(r?.warning)warnings.push(r.warning);if(r?.warnings?.length)warnings.push(...r.warnings);return r;};
 const run=(command,params={})=>call('run_command',{command,params});
 const layer=name=>run('layer.new',{name,top:true});
 const newDoc=(name,w=1000,h=600)=>run('file.new',{name,width:w,height:h,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb',created:1794355200});
 const ex=(format,dest,extra={})=>call('export',{format,path:path.join(ROOT,dest),...extra});
 const text=(str,x,y,size,color,extra={})=>run('text.create',{text:str,x,y,size,color,font:'Inter',style:'Regular',...extra});
 const light=c=>/^#[ef]/.test(c.background);
 async function group(ids,name){const r=await run('object.group',{ids});await run('object.setProps',{id:r.id,name});return r.id;}
 async function transform(id,x,y,sx=1,sy=sx){await run('object.transform',{ids:[id],matrix:[sx,0,0,sy,x,y],strokes:true});return id;}
 function color(c,t,context='normal'){
   if(!t||t==='none')return 'none';if(t==='face')return light(c)&&c.mode!=='woodcut'?'#24464b':c.face;
   if(t==='ink'&&context==='illustration'&&!light(c))return '#e4d5ae';
   return c[t]||t;
 }
 async function paths(shapes,c,name,context='normal'){
   if(!shapes?.length)return null;
   const steps=shapes.map((s,i)=>({id:'draw_path',params:{...s,fill:color(c,s.fill,context),stroke:color(c,s.stroke,context),name:s.name||`${name} / ${i+1}`}}));
   const r=await call('command_batch',{steps,atomic:true,label:name});if(r.failed||r.completed!==steps.length)throw Error(`${name}: ${JSON.stringify(r)}`);
   return group(r.created,name);
 }
 async function letter(c,g,ch,face,texture=false){
   const ids=[];
   for(let si=0;si<g.shapes.length;si++){
     const s=g.shapes[si];
     const shadow=await call('draw_path',{d:s.d,fill:light(c)?'#b5a58a':'#0b2328',stroke:light(c)?'#b5a58a':'#0b2328',strokeWidth:2.5,join:'round',name:`${ch} / ink offset`});
     await transform(shadow.id,1.2,1.9);ids.push(shadow.id);
     const front=await call('draw_path',{d:s.d,fill:face,stroke:c.ink,strokeWidth:1.35,join:'round',name:`${ch} / hand-cut letter face`});ids.push(front.id);
     if(texture){
       const strokes=[];
       for(let x=4;x<g.w;x+=5.5)strokes.push({id:'draw_path',params:{d:`M${x} -5C${x+2} 24 ${x-2} 60 ${x+1} 107`,fill:'none',stroke:c.ink,strokeWidth:.5,opacity:27,cap:'round',name:'Cut grain / curved ink line'}});
       for(let i=0;i<9;i++){const x=3+((i*17+si*11)%(g.w-6)),y=5+(i*13)%91;strokes.push({id:'draw_path',params:{d:`M${x} ${y}l1.8 2.6`,fill:'none',stroke:c.paper,strokeWidth:.65,opacity:65,cap:'round',name:'Cut grain / paper fleck'}});}
       const b=await call('command_batch',{steps:strokes,atomic:true,label:`Ink grain in ${ch}`});
       if(b.failed)throw Error('Texture batch failed');
       const mask=await call('draw_path',{d:s.d,fill:'none',stroke:'none',name:`${ch} / transparent grain mask`});
       const clip=await run('object.clippingMask.make',{ids:[...b.created,mask.id]});ids.push(clip.id);
     }
   }
   return group(ids,`${ch} / original illustrated letter`);
 }
 async function word(c,str,box,fontName='uncial',opts={}){
   const f=fonts[fontName],chars=[...str],track=opts.tracking??1.1;
   const glyph=ch=>opts.hybrid&&ch==='E'?fonts.woodcut.glyphs.E:f.glyphs[ch];
   const width=chars.reduce((n,ch)=>n+glyph(ch).w,0)+track*(chars.length-1),sx=box.w/width,sy=box.h/100,ids=[];let adv=0;
   for(let i=0;i<chars.length;i++){
     const ch=chars[i],g=glyph(ch),factor=i===0?(opts.first||1):i===chars.length-1?(opts.last||1):1;
     const face=opts.initial&&i===0?c.initial:color(c,'face');
     const l=await letter(c,g,ch,face,opts.texture||opts.initial&&i===0);
     const dx=box.x+adv*sx,dy=box.y+box.h*(1-factor)+(opts.wave||0)*Math.sin(i*1.5);
     await transform(l,dx,dy,sx,sy*factor);ids.push(l);adv+=g.w+track;
   }
   return group(ids,`${str} / drawn storybook title`);
 }
 async function scene(c,index,x,y,w,h,context='normal'){
   const v=vignettes[index],g=await paths(v.shapes,c,`${v.name} / narrative vignette`,context);return transform(g,x,y,w/100,h/100);
 }
 async function star(c,x,y,r=12){return paths([{d:`M${x} ${y-r}Q${x+r*.2} ${y-r*.2} ${x+r} ${y}Q${x+r*.2} ${y+r*.2} ${x} ${y+r}Q${x-r*.2} ${y+r*.2} ${x-r} ${y}Q${x-r*.2} ${y-r*.2} ${x} ${y-r}Z`,fill:'gold',stroke:'ink',strokeWidth:1.5}],c,'A guiding spark');}
 async function logo(c,x=0,y=0,s=1){
   const ids=[];
   if(c.mode==='initial'){
     ids.push(await paths([{d:'M137 145L237 149L232 236L137 238Z',fill:'paper',stroke:'ink',strokeWidth:1.4},{d:'M137 277L232 280L229 374L135 373Z',fill:'paper',stroke:'ink',strokeWidth:1.4}],c,'Two illustrated counters of the initial'));
     ids.push(await scene(c,c.motif,139,149,94,86));
     ids.push(await paths([{d:'M160 352C147 327 162 305 188 307C217 309 212 347 188 344C171 343 172 324 185 323C197 322 198 336 188 336',fill:'none',stroke:'gold',strokeWidth:3},{d:'M185 307Q177 289 166 294Q162 307 181 312ZM206 325Q219 314 224 324Q225 338 210 337Z',fill:'olive',stroke:'ink',strokeWidth:1.5}],c,'Seed and scroll within the initial'));
     const e=await letter(c,fonts.woodcut.glyphs.E,'E',c.initial,true);ids.push(await transform(e,67,116,182/71,2.88));
     ids.push(await word(c,'verfolk',{x:260,y:216,w:644,h:184},c.motif%2?'organic':'uncial',{tracking:1.2}));
     ids.push(await paths([{d:'M258 426C375 441 453 419 492 428C551 443 655 438 715 420C744 411 759 414 756 424C753 435 733 433 735 424',fill:'none',stroke:'gold',strokeWidth:2.7}],c,'The path continuing from the story'));
   }else if(c.mode==='woodcut'){
     ids.push(await scene(c,c.motif,80,83,143,133,'illustration'));
     ids.push(await word(c,'EVERFOLK',{x:83,y:258,w:835,h:131},'woodcut',{texture:true,first:1.35,last:1.09,tracking:2,wave:3}));
     ids.push(await paths([{d:'M108 416C234 427 375 403 493 420C632 439 741 417 895 422',fill:'none',stroke:'gold',strokeWidth:2.8},{d:'M882 417Q865 403 873 393Q889 396 894 410Z',fill:'olive',stroke:'ink',strokeWidth:1.5}],c,'Carved ink baseline'));
     ids.push(await star(c,866,196,12));ids.push(await star(c,916,224,6));
   }else if(c.mode==='flourish'){
     const flourish=await paths(flourishes[c.motif].shapes,c,`${flourishes[c.motif].name} / illustrated lettering extension`,'illustration');
     if(c.motif===3)await transform(flourish,0,25);
     ids.push(flourish);
     ids.push(await word(c,'Everfolk',{x:107,y:230,w:785,h:155},'uncial',{first:1.17,initial:true,tracking:1.3,wave:1.3}));
     // A long hand-drawn k terminal is part of the title's silhouette.
     if(c.motif<3)ids.push(await paths([{d:'M874 374C905 407 875 458 813 452C794 449 788 431 801 424C814 418 825 431 814 437',fill:'none',stroke:'gold',strokeWidth:4}],c,'The terminal k turns into a story path'));
   }else{
     ids.push(await scene(c,c.motif,405,63,190,181,'illustration'));
     ids.push(await paths([{d:'M350 248C410 264 452 248 500 256C551 267 594 249 650 250',fill:'none',stroke:'gold',strokeWidth:2.7},{d:'M363 253Q346 238 357 227Q372 234 376 251ZM632 252Q647 237 660 245Q655 261 639 260Z',fill:'olive',stroke:'ink',strokeWidth:1.5}],c,'A world growing from the title'));
     ids.push(await word(c,'Everfolk',{x:83,y:285,w:834,h:136},'organic',{hybrid:true,first:1.25,initial:true,tracking:1.2,wave:1.2}));
     ids.push(await paths([{d:'M139 449C252 431 382 456 496 442C617 426 724 452 861 441',fill:'none',stroke:'gold',strokeWidth:2.5}],c,'The shared ground of a life'));
   }
   const motto=await text('LIVE ANOTHER STORY',500,c.mottoY,15,light(c)?'#705638':'#cfb98e',{justify:'center',style:'Medium'});await run('text.setStyle',{id:motto.id,tracking:125});ids.push(motto.id);
   const g=await group(ids.filter(Boolean),`${c.id} ${c.name} / complete illustrated logo`);if(x||y||s!==1)await transform(g,x,y,s);return g;
 }
 const selected=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
 for(const c of concepts.filter(c=>!selected||selected.includes(c.id))){
   await newDoc(`Everfolk / illustrated story ${c.id} ${c.name}`);await run('artboard.setProps',{index:0,name:`${c.id} Transparent logo`});await run('artboard.new',{x:1100,y:0,width:1000,height:600,name:`${c.id} Storybook proof`});
   await layer('01 Proof ground');await paths([{d:'M1100 0H2100V600H1100Z',fill:c.background}],c,'Proof ground');
   await layer('02 Editable lettering, grain and story illustrations');const g=await logo(c);await run('object.transform',{ids:[g],matrix:[1,0,0,1,1100,0],copy:true,strokes:true});
   const f=await run('text.fonts');if(f.some(x=>x.status!=='exact'||x.missingGlyphs))throw Error('Supporting font unavailable');
   const base=`${c.id}-${c.slug}`;await call('save_file',{path:path.join(ROOT,'masters',`${base}.vectorcraft`),compress:true,preview:true});
   await ex('svg',`svg/${base}.svg`,{artboard:0,outlineText:true});await ex('png',`png/${base}-transparent.png`,{artboard:0,scale:2});await ex('png',`png/${base}-proof.png`,{artboard:1,scale:1.5});
   const d=await call('inspect_document',{depth:1});fs.writeFileSync(path.join(ROOT,'qa',`${c.id}.json`),JSON.stringify(d,null,2));
   manifest.push({...c,master:`masters/${base}.vectorcraft`,svg:`svg/${base}.svg`,proof:`png/${base}-proof.png`});await run('file.close');console.log(`Saved ${c.id} ${c.name}`);
 }
 if(!selected||process.argv.includes('--review')){
   if(selected){manifest.length=0;manifest.push(...JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).concepts);}
   await newDoc('Everfolk / illustrated narrative logo directions',2400,2420);await layer('Parchment review ground');await paths([{d:'M0 0H2400V2420H0Z',fill:'#eee3ca'}],concepts[0],'Parchment ground');
   await text('Everfolk',65,103,64,'#24464b',{font:'Source Serif 4'});await text('ILLUSTRATED STORY IDENTITIES / TWENTY OPTIONS',68,145,15,'#6c6851');
   await text('PENTIMENT × WILDERMYTH / REFERENCE STUDIES',2330,139,13,'#886d43',{justify:'right'});
   const labels=['ILLUMINATED INITIAL','PRINTED TALE','LETTERING IN BLOOM','LIVING CHRONICLE'];
   for(let col=0;col<4;col++){
     const x=65+col*573;await text(labels[col],x,209,15,'#24464b',{style:'Medium'});
     for(let row=0;row<5;row++){
       const c=concepts[col*5+row],y=244+row*416;await layer(`${c.id} ${c.name}`);await paths([{d:`M${x} ${y}h548v391h-548Z`,fill:c.background}],c,'Story proof panel');
       await text(c.id,x+18,y+30,13,light(c)?'#8f6c42':'#d6bd85',{style:'Medium'});await logo(c,x+10,y+30,.528);
       await text(c.name,x+18,y+355,19,light(c)?'#24464b':'#e8dfc4',{font:'Source Serif 4'});
       await text(c.mode==='woodcut'?'INK GRAIN + CUT LETTERS':'ILLUSTRATION BUILT INTO THE TITLE',x+18,y+378,9,light(c)?'#796c51':'#a5ae96');
     }
   }
   await text('Every title letter and illustration is editable vector artwork. References inform the storybook approach; the Everfolk designs are original.',65,2380,12,'#766d54');
   await call('save_file',{path:path.join(ROOT,'review','Everfolk-20-illustrated-story-logos.vectorcraft'),compress:true,preview:true});await ex('png','review/Everfolk-20-illustrated-story-logos.png',{scale:1});await ex('svg','review/Everfolk-20-illustrated-story-logos.svg',{outlineText:true});await run('file.close');
   for(const c of manifest.filter(c=>!selected||selected.includes(c.id))){await call('open_file',{path:path.join(ROOT,c.master)});const d=await call('inspect_document',{depth:0});if(d.artboards.length!==2)throw Error(`Native reopen ${c.id}`);fs.writeFileSync(path.join(ROOT,'qa',`${c.id}-reopened.json`),JSON.stringify(d,null,2));await run('file.close');}
   fs.writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify({brand:'Everfolk',revision:4,direction:'Illustrated story identity',references:['https://www.skylightcollective.com/case-study/xbox-pentiment/','https://wildermyth.com/'],concepts:manifest,warnings},null,2));console.log(`Finished ${manifest.length} illustrated logos; warnings ${warnings.length}`);
 }
}).catch(e=>{console.error(e.stack);process.exitCode=1});
