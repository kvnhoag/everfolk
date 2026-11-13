const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const PROJECT=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(PROJECT,'package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
async function main(){
 const slugs=['alexander-parent','alexander-rare-male','alexander-rare-female','ptolemy-parent','aristotle-parent','aristotle-epic-male','aristotle-epic-female','ptolemy-rare-female'];
 const layers=[];
 for(let i=0;i<slugs.length;i++){
  const input=await sharp(path.join(ROOT,'exports',slugs[i]+'.png')).resize(270,378,{kernel:'nearest'}).png().toBuffer();
  layers.push({input,left:16+(i%4)*286,top:16+Math.floor(i/4)*394});
 }
 await sharp({create:{width:1160,height:804,channels:4,background:'#172b28'}}).composite(layers).png().toFile(path.join(ROOT,'review','framed-preview.png'));
 // A portable ZIP includes the sibling inner-art PNGs used by gallery links.
 const python=String.raw`import pathlib,zipfile,json
root=pathlib.Path(r'${ROOT}')
archive=root/'everfolk-framed-collection-v13.zip'
catalog=json.loads((root/'catalog.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if not p.is_file() or p==archive or p.suffix=='.zip': continue
  if p.parent==root/'qa' and p.suffix=='.png': continue
  z.write(p,pathlib.Path(root.name)/p.relative_to(root))
 for a in catalog['assets']:
  p=root.parent/'figure-inner-art-v12'/'assets'/(a['slug']+'-pixel.png')
  z.write(p,pathlib.Path('figure-inner-art-v12/assets')/p.name)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert sum(x.filename.startswith(root.name+'/exports/') and x.filename.endswith('.png') for x in z.infolist())==83
 assert sum(x.filename.startswith(root.name+'/masters/') and x.filename.endswith('.vectorcraft') for x in z.infolist())==83
 print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'entries':len(z.infolist()),'crcVerified':True}))
`;
 const result=spawnSync('python',['-c',python],{encoding:'utf8',windowsHide:true});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status!==0)throw Error('Packaging failed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
