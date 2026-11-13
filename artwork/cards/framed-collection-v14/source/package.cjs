const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const PROJECT=path.resolve(ROOT,'../../..');
const req=createRequire(path.join(PROJECT,'package.json'));
const sharp=createRequire(req.resolve('next/package.json'))('sharp');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function verifyZip(archive,files){
 const data=fs.readFileSync(archive);let eocd=data.length-22;
 while(eocd>=Math.max(0,data.length-65557)&&data.readUInt32LE(eocd)!==0x06054b50)eocd--;
 if(eocd<0)throw Error('No ZIP directory');
 const count=data.readUInt16LE(eocd+10);let p=data.readUInt32LE(eocd+16);
 const names=[];
 for(let i=0;i<count;i++){
  if(data.readUInt32LE(p)!==0x02014b50)throw Error('Invalid ZIP entry');
  const method=data.readUInt16LE(p+10),crc=data.readUInt32LE(p+16),size=data.readUInt32LE(p+20),uncompressed=data.readUInt32LE(p+24);
  const nl=data.readUInt16LE(p+28),el=data.readUInt16LE(p+30),cl=data.readUInt16LE(p+32),local=data.readUInt32LE(p+42);
  const name=data.subarray(p+46,p+46+nl).toString('utf8');
  const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);
  const compressed=data.subarray(start,start+size);
  const content=method===8?zlib.inflateRawSync(compressed):method===0?compressed:null;
  if(!content||content.length!==uncompressed||crc32(content)!==crc)throw Error('ZIP CRC mismatch '+name);
  if(!files.has(name)||hash(content)!==hash(fs.readFileSync(files.get(name))))throw Error('ZIP source hash mismatch '+name);
  names.push(name);p+=46+nl+el+cl;
 }
 if(names.length!==files.size)throw Error('ZIP file count mismatch');
 for(const [prefix,suffix] of [['framed-collection-v14/exports/','.png'],['framed-collection-v14/masters/','.vectorcraft']])if(names.filter(n=>n.startsWith(prefix)&&n.endsWith(suffix)).length!==117)throw Error('Collection count mismatch');
 return {archive,bytes:data.length,entries:count,allEntryCrcAndSourceHashesVerified:true};
}
async function main(){
 const files=new Map();
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.isFile()&&!file.endsWith('.zip')&&e.name!=='package-manifest.txt'&&!(dir===path.join(ROOT,'qa')&&e.name.endsWith('.png')))files.set(path.relative(path.dirname(ROOT),file).replaceAll('\\','/'),file);}}
 walk(ROOT);
 const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'catalog.json')));
 for(const a of catalog.assets){
  const file=path.resolve(PROJECT,a.sourceArt);
  const name=path.relative(path.dirname(ROOT),file).replaceAll('\\','/');
  files.set(name,file);
 }
 function artFiles(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())artFiles(file);else if(e.isFile()&&!file.endsWith('.zip'))files.set(path.relative(path.dirname(ROOT),file).replaceAll('\\','/'),file);}}
 artFiles(path.join(ROOT,'../figure-inner-art-v14'));
 const references=JSON.parse(fs.readFileSync(path.join(ROOT,'../figure-inner-art-v14/source/reference-inputs.json')));
 for(const ref of references)files.set(ref.reference,path.join(path.dirname(ROOT),ref.reference));
 const manifest=path.join(ROOT,'source','package-manifest.txt');fs.writeFileSync(manifest,[...files.keys()].sort().join('\n')+'\n');
 const archive=path.join(ROOT,'everfolk-framed-collection-v14.zip');
 const result=spawnSync('C:/Windows/System32/tar.exe',['-a','-cf',archive,'-C',path.dirname(ROOT),'-T',manifest],{encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw result.error||Error(result.stderr||'Archive creation failed');
 const qa=verifyZip(archive,files);fs.writeFileSync(path.join(ROOT,'qa','archive-verification.json'),JSON.stringify(qa,null,2));console.log(JSON.stringify(qa));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
