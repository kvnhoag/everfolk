const fs = require('node:fs');
const path = require('node:path');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const C = { ink:'#24464b', gold:'#b58a49', clay:'#98584b', olive:'#72805a', paper:'#fbf3df', ground:'#f3ebda', panel:'#fcf7eb', muted:'#736957', line:'#d1bd98' };
const concepts = [...require('./concepts-01-10.cjs'), ...require('./concepts-11-20.cjs')];
for (const dir of ['masters','svg','png','review','qa']) fs.mkdirSync(path.join(ROOT,dir),{recursive:true});
const u = r => { const t=r.content?.find(x=>x.type==='text');return t?JSON.parse(t.text):r; };
const warnings=[];
const manifest=[];
function watch(r,label){if(r?.warning)warnings.push({label,warning:r.warning});if(r?.warnings?.length)warnings.push({label,warnings:r.warnings});return r;}

async function build(api) {
  const call = async (name,args) => watch(u(await api.callTool(name,args)),name);
  const run = (command,params={}) => call('run_command',{command,params});
  const layer = name => run('layer.new',{name,top:true});
  const rect = async(x,y,w,h,fill,name='Background') => call('draw_shape',{shape:'rectangle',x,y,width:w,height:h,fill,stroke:'none',name});
  async function text(str,x,y,size,font='Inter',color=C.ink,extra={}) {
    return run('text.create',{text:str,x,y,size,font,color,style:'Regular',...extra});
  }
  async function icon(c,x,y,size,variant='color') {
    const paint = t => !t||t==='none' ? 'none' : variant==='mono' ? C.ink : variant==='reverse' ? (t==='ink'||t==='olive'||t==='clay'?C.paper:C.gold) : C[t]||t;
    const steps=c.shapes.map((s,i)=>({id:'draw_path',params:{...s,fill:paint(s.fill),stroke:paint(s.stroke),name:s.name||`${c.name} / element ${i+1}`}}));
    const gi=steps.length;
    steps.push({id:'object.group',params:{ids:c.shapes.map((_,i)=>`$${i}.id`)}});
    steps.push({id:'object.setProps',params:{id:`$${gi}.id`,name:`${c.id} ${c.name} / ${variant} device`}});
    steps.push({id:'object.scale',params:{ids:[`$${gi}.id`],sx:size,origin:[0,0],strokes:true,corners:true}});
    steps.push({id:'object.move',params:{ids:[`$${gi}.id`],dx:x,dy:y}});
    const r=await call('command_batch',{steps,atomic:true,label:`Draw ${c.name}`});
    if(r.failed||r.completed!==steps.length)throw Error(`Drawing failed ${c.id}: ${JSON.stringify(r)}`);
    return r.results[gi];
  }
  async function lockup(c,x,y,scale=1,variant='color') {
    const color=variant==='reverse'?C.paper:C.ink;
    const secondary=variant==='reverse'?C.gold:C.muted;
    if(c.layout==='stacked') {
      await icon(c,x+314*scale,y+35*scale,92*scale,variant);
      await text('Everfolk',x+360*scale,y+212*scale,66*scale,c.font,color,{style:c.fontStyle,justify:'center'});
      await text('Live another story',x+360*scale,y+249*scale,16*scale,'Inter',secondary,{justify:'center'});
    } else {
      await icon(c,x+64*scale,y+90*scale,148*scale,variant);
      await text('Everfolk',x+250*scale,y+188*scale,66*scale,c.font,color,{style:c.fontStyle});
      await text('Live another story',x+253*scale,y+226*scale,16*scale,'Inter',secondary);
    }
  }
  async function newDoc(name,width,height){await run('file.new',{name,width,height,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb',created:1794355200});}
  async function exportTo(format,dest,opts={}){return call('export',{format,path:path.join(ROOT,dest),...opts});}
  const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7).split(',');
  for(const c of concepts.filter(c=>!only||only.includes(c.id))) {
    await newDoc(`Everfolk / ${c.id} ${c.name}`,720,340);
    await run('artboard.setProps',{index:0,name:`${c.id} Primary lockup`});
    await run('artboard.new',{x:760,y:0,width:160,height:160,name:`${c.id} Colour device`});
    await run('artboard.new',{x:960,y:0,width:160,height:160,name:`${c.id} One-colour device`});
    await run('artboard.new',{x:0,y:400,width:720,height:340,name:`${c.id} Reverse lockup`});
    await layer('01 Primary lockup / live type');
    await lockup(c,0,0);
    await layer('02 Colour device');await icon(c,776,16,128);
    await layer('03 One-colour device');await icon(c,976,16,128,'mono');
    await layer('04 Reverse lockup / live type');await lockup(c,0,400,1,'reverse');
    const fonts=await run('text.fonts');
    if(fonts.some(f=>f.status!=='exact'||Number(f.missingGlyphs)>0))throw Error(`Font substitution ${c.id}: ${JSON.stringify(fonts)}`);
    const base=`${c.id}-${c.slug}`;
    const saved=await call('save_file',{path:path.join(ROOT,'masters',`${base}.vectorcraft`),compress:true,preview:true});
    await exportTo('svg',`svg/${base}.svg`,{artboard:0,outlineText:true});
    await exportTo('png',`png/${base}.png`,{artboard:0,scale:2});
    await exportTo('svg',`svg/${base}-icon.svg`,{artboard:1,outlineText:true});
    await exportTo('png',`png/${base}-icon.png`,{artboard:1,scale:2});
    await exportTo('svg',`svg/${base}-mono.svg`,{artboard:2,outlineText:true});
    await exportTo('svg',`svg/${base}-reverse.svg`,{artboard:3,outlineText:true});
    const inspected=await call('inspect_document',{depth:1});
    fs.writeFileSync(path.join(ROOT,'qa',`${base}.json`),JSON.stringify({fonts,document:inspected},null,2));
    manifest.push({...c,shapes:undefined,master:`masters/${base}.vectorcraft`,svg:`svg/${base}.svg`,png:`png/${base}.png`,icon:`svg/${base}-icon.svg`,mono:`svg/${base}-mono.svg`,reverse:`svg/${base}-reverse.svg`});
    await run('file.close');
    console.log(`Saved ${c.id} ${c.name}`);
  }
  if(!only){
    const W=2400,H=2330;
    await newDoc('Everfolk / 20 logo directions',W,H);
    await layer('01 Parchment and panels');await rect(0,0,W,H,C.ground);
    await layer('02 Title');
    await text('Everfolk',84,110,66,'Source Serif 4');
    await text('TWENTY LOGO DIRECTIONS',86,155,16,'Inter',C.muted);
    await text('Live another story',2316,109,22,'Source Serif 4',C.ink,{justify:'right'});
    await text('VectorCraft  /  November 2026',2316,153,13,'Inter',C.muted,{justify:'right'});
    const families=['Chronicle','Possibility','Belonging','Continuity'];
    for(let col=0;col<4;col++){
      const left=84+col*570;
      await text(families[col].toUpperCase(),left,224,15,'Inter',C.ink,{style:'SemiBold'});
      await call('draw_path',{d:`M${left} 244H${left+528}`,fill:'none',stroke:C.gold,strokeWidth:2});
      for(let row=0;row<5;row++) {
        const c=concepts[col*5+row],top=270+row*390;
        await layer(`${c.id} ${c.name}`);
        await rect(left,top,528,364,C.panel);
        await text(c.id,left+26,top+38,17,'Inter',C.gold,{style:'Medium'});
        // The shared scale makes each mark directly comparable.
        await lockup(c,left-4,top+27,0.74);
        await text(c.name,left+26,top+295,21,'Source Serif 4');
        await text(c.rationale,left+26,top+315,11.5,'Inter',C.muted,{area:{width:476,height:38,fit:'autoHeight'}});
      }
    }
    await layer('Footer');
    await text('Original vector concepts  /  Deep teal · antique gold · clay · olive',84,2280,14,'Inter',C.muted);
    await text('Choose by number 01–20',2316,2280,14,'Inter',C.ink,{justify:'right'});
    await call('save_file',{path:path.join(ROOT,'review','Everfolk-20-logo-directions.vectorcraft'),compress:true,preview:true});
    await exportTo('png','review/Everfolk-20-logo-directions.png',{scale:1});
    await exportTo('svg','review/Everfolk-20-logo-directions.svg',{outlineText:true});
    await run('file.close');
    await newDoc('Everfolk / symbol and contrast checks',2000,2100);
    await layer('Proof background');await rect(0,0,2000,2100,C.ground);
    await text('Twenty marks, three treatments',66,87,43,'Source Serif 4');
    await text('COLOUR  /  ONE COLOUR  /  REVERSE',68,125,13,'Inter',C.muted);
    for(let i=0;i<concepts.length;i++) {
      const c=concepts[i],x=66+(i%4)*480,y=174+Math.floor(i/4)*374;
      await layer(`${c.id} ${c.name} proof`);await rect(x,y,448,342,C.panel);
      await text(`${c.id}  ${c.name}`,x+22,y+37,20,'Source Serif 4');
      await icon(c,x+25,y+74,120);
      await icon(c,x+175,y+102,64,'mono');
      await rect(x+280,y+79,144,144,C.ink,'Reverse test swatch');
      await icon(c,x+292,y+91,120,'reverse');
      await text('COLOUR',x+84,y+267,10,'Inter',C.muted,{justify:'center'});
      await text('ONE COLOUR',x+207,y+267,10,'Inter',C.muted,{justify:'center'});
      await text('REVERSE',x+352,y+267,10,'Inter',C.muted,{justify:'center'});
      await text(c.family,x+22,y+316,12,'Inter',C.muted);
    }
    await call('save_file',{path:path.join(ROOT,'review','Everfolk-symbol-tests.vectorcraft'),compress:true,preview:true});
    await exportTo('png','review/Everfolk-symbol-tests.png',{scale:1});
    await run('file.close');
    for(const c of manifest){
      await call('open_file',{path:path.join(ROOT,c.master)});
      const reopened=await call('inspect_document',{depth:0});
      if(reopened.artboards?.length!==4)throw Error(`Reopen artboard count ${c.id}`);
      fs.writeFileSync(path.join(ROOT,'qa',`${c.id}-reopened.json`),JSON.stringify(reopened,null,2));
      await run('file.close');
    }
    fs.writeFileSync(path.join(ROOT,'manifest.json'),JSON.stringify({brand:'Everfolk',motto:'Live another story',date:'2026-11-11',createdWith:'ArtCraft VectorCraft headless MCP',palette:C,concepts:manifest,warnings},null,2));
    console.log(`Finished ${manifest.length} masters, overview and native reopen verification. Warnings: ${warnings.length}`);
  }
}
withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:120000},build).catch(e=>{console.error(e.stack);process.exitCode=1});
