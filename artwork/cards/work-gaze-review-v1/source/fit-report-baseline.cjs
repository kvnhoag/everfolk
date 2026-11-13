// Compatibility only for stale export-hash history in selected derived fit reports.
const crypto=require('node:crypto');
const need=(v,m)=>{if(!v)throw Error(m);};
const validHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function canonical(value){if(value===null||typeof value!=='object')return Object.is(value,-0)?'-0':JSON.stringify(value);if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';return'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';}
function selectedFit(file,ids){return ids.some(id=>file==='artwork/cards/framed-collection-v14/qa/'+id+'-fit.json');}
function semanticSha(bytes){const report=JSON.parse(bytes.toString('utf8'));need(report&&typeof report==='object'&&!Array.isArray(report)&&Object.hasOwn(report,'exportSha256')&&validHash(report.exportSha256),'Fit report requires its existing64-hex exportSha256');delete report.exportSha256;return crypto.createHash('sha256').update(canonical(report)).digest('hex');}
function descriptor(file,ids,bytes){need(selectedFit(file,ids),'Semantic compatibility is restricted to selected fit reports');return{semanticBeforeIgnoredField:'exportSha256',semanticBeforeSha256:semanticSha(bytes)};}
function matches(file,ids,entry,bytes){if(!entry.semanticBeforeSha256)return false;need(selectedFit(file,ids)&&entry.semanticBeforeIgnoredField==='exportSha256'&&validHash(entry.semanticBeforeSha256),'Unapproved semantic baseline descriptor '+file);return semanticSha(bytes)===entry.semanticBeforeSha256;}
module.exports={descriptor,matches};
