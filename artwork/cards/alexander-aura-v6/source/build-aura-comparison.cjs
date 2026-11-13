// Review-only evidence board: actual object photographs above, generated details below.
// All photos are embedded from the original files and focused through native view crops.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const master = path.join(ROOT, 'masters', 'Alexander-Aura-Comparison.vectorcraft');
const png = path.join(ROOT, 'review', 'Alexander-Aura-Comparison.png');
const source = 'source/alexander-aura-revised.png';
const panels = [
  { label: 'Actual machaira / upper blade', file: 'references/greek-machaira-met-2001.346.jpg', dimensions: [1200,591], roi: [205,55,940,240], x:40, y:170, note:'Upper blade profile; handle partly outside crop', provenance:'Actual public-domain object photograph / former Met record 2001.346' },
  { label: 'Actual mosaic / Alexander’s armour', file: 'references/mann-alexander-mosaic-10020.jpg', dimensions: [2560,1670], roi: [520,580,315,280], x:630, y:170, note:'Shoulder guards, cuirass and pteruges', provenance:'Actual MANN photograph / Giorgio Albano' },
  { label: 'Actual bronze / rider’s cloak', file: 'references/naples-alexander-mounted-cloak.jpg', dimensions: [1140,1200], roi: [290,50,360,500], x:1220, y:170, note:'Rider’s right-shoulder fastening and front drape', provenance:'Actual MANN bronze photograph / Salvatore Siano, by permission MANN' },
  { label: 'Heroic scale / reference-derived form', file: source, dimensions: [1122,1402], roi: [100,15,820,345], x:40, y:730, note:'Enlarged for aura; not a literal-scale replica', provenance:'Generated game-art reconstruction / deliberately heroic blade scale' },
  { label: 'Generated armour detail', file: source, dimensions: [1122,1402], roi: [225,540,460,640], x:630, y:730, note:'Revised painting / reconstruction', provenance:'Generated game-art reconstruction, not an ancient-object photograph' },
  { label: 'Wind-swept mantle / stylized motion', file: source, dimensions: [1122,1402], roi: [0,235,680,990], x:1220, y:730, note:'Reference-derived fastening; freely interpreted drape', provenance:'Generated game-art reconstruction, not an ancient-object photograph' },
];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const name of ['masters','review','qa']) fs.mkdirSync(path.join(ROOT,name), {recursive:true});
for (const panel of panels) panel.sha256 = sha(path.join(ROOT,panel.file));
const unwrap = result => {const text=result.content?.find(item=>item.type==='text');return text?JSON.parse(text.text):result;};
const warnings=[];

async function main(){
  await withMcp('VectorCraft',{readRoot:ROOT,writeRoot:ROOT,timeoutMs:60000},async({callTool})=>{
    const call=async(name,args={})=>{const result=unwrap(await callTool(name,args));if(result?.warning)warnings.push(result.warning);if(result?.warnings?.length)warnings.push(...result.warnings);return result;};
    const run=(command,params={})=>call('run_command',{command,params});
    const text=async(value,x,top,size,font='Inter',color='#24312c')=>{
      const created=await run('text.create',{text:value,x,y:0,size,font,style:'Regular',color});
      const b=(await call('inspect_document',{ids:[created.id],depth:0})).nodes[0].bounds;
      await run('object.move',{ids:[created.id],dx:x-b.x,dy:top-b.y});
      return created.id;
    };
    await run('file.new',{name:'Alexander / reference forms and heroic interpretation / review only',width:1810,height:1420,units:'Pixels',backgroundContents:'transparent',colorMode:'rgb'});
    await run('layer.setProps',{name:'00 Light review field / not game artwork'});
    await call('draw_shape',{shape:'rectangle',name:'Light museum-review background',x:0,y:0,width:1810,height:1420,fill:'#f2efe7',stroke:'none'});
    await run('layer.new',{name:'10 Editable heading and actual/generated panel labels',top:true});
    await text('Alexander / reference forms and heroic interpretation',40,30,34,'Source Serif 4');
    await text('Actual photographs above · deliberate heroic scale and motion below',40,84,16,'Inter','#667367');
    for(const panel of panels){
      await text(panel.label,panel.x,panel.y-40,21);
      await text(panel.note,panel.x,panel.y+465,14,'Inter','#667367');
    }
    for(let i=0;i<panels.length;i++){
      const panel=panels[i], [sx,sy,sw,sh]=panel.roi;
      const scale=Math.min(550/sw,450/sh), width=sw*scale, height=sh*scale;
      const left=panel.x+(550-width)/2, top=panel.y+(450-height)/2;
      await run('layer.new',{name:`${20+i} ${panel.label} / original embedded file and view crop`,top:true});
      await call('draw_shape',{shape:'rectangle',name:'Neutral panel field',x:panel.x,y:panel.y,width:550,height:450,fill:'#e8e5dc',stroke:'none'});
      const image=await run('file.place',{path:path.join(ROOT,panel.file),link:false,rect:[left-sx*scale,top-sy*scale,panel.dimensions[0]*scale,panel.dimensions[1]*scale]});
      await run('object.setProps',{id:image.ids[0],name:panel.provenance,data:{source:panel.file,source_sha256:panel.sha256,role:panel.provenance}});
      const clip=await call('draw_shape',{shape:'rectangle',name:'Equipment-focused view crop / source image unchanged',x:left,y:top,width,height,fill:'#ffffff',stroke:'none'});
      const group=await run('object.clippingMask.make',{ids:[image.ids[0],clip.id]});
      await run('object.setProps',{id:group.id,name:`${panel.label} / native clipping frame`});
      await call('draw_shape',{shape:'rectangle',name:'Quiet panel outline',x:panel.x-.5,y:panel.y-.5,width:551,height:451,fill:'none',stroke:'#c9c6b9',strokeWidth:.8});
      panel.display={left,top,width,height,scale};
    }
    await run('layer.new',{name:'40 Source credits, collection-history note and reconstruction caveat',top:true});
    await text('Sword: public-domain photograph; former Met record 2001.346 (restituted September 2025).',40,1238,16,'Inter','#48564b');
    await text('Mosaic: MANN / Giorgio Albano. Bronze: Salvatore Siano, by permission of MANN (Getty, Artistry in Bronze, 44-Siano).',40,1270,16,'Inter','#48564b');
    await text('Bronze reference: first century BCE; possible Roman adaptation / restoration. The clasp shown belongs to the rider, not the horse bridle.',40,1302,15,'Inter','#667367');
    await text('Review only. Original photographs are unchanged; lower panels deliberately stylize scale and motion and are not literal replicas.',40,1347,15,'Inter','#667367');
    const fonts=await run('text.fonts');
    if(fonts.some(font=>font.status!=='exact'||font.missingGlyphs))throw new Error('Equipment-board font substitution');
    await call('save_file',{path:master,compress:true,preview:true});
    await call('export',{format:'png',path:png,scale:1});
    await run('file.close');
  });
  const bytes=fs.readFileSync(png);
  const unchanged=panels.every(panel=>sha(path.join(ROOT,panel.file))===panel.sha256);
  if(!unchanged||warnings.length||bytes.readUInt32BE(16)!==1810||bytes.readUInt32BE(20)!==1420)throw new Error(JSON.stringify({unchanged,warnings}));
  fs.writeFileSync(path.join(ROOT,'qa','aura-comparison.json'),JSON.stringify({master,png,reviewOnly:true,unchanged,panels,warnings},null,2));
  console.log(JSON.stringify({master,png,unchanged,referencePanels:3,generatedDetailPanels:3,warnings}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1});
