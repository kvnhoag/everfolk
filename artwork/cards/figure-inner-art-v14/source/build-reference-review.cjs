const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),CARDS=path.dirname(ROOT),OLD=require('../../figure-inner-art-v12/catalog.json'),NEW=require('../catalog.json');
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const REVIEW=path.join(ROOT,'review');fs.mkdirSync(REVIEW,{recursive:true});
const url=p=>path.relative(REVIEW,p).split(path.sep).map(encodeURIComponent).join('/');
const references=NEW.assets.map(a=>{
 let reference=a.reference;
 if(!reference&&a.origin?.reference){const old=OLD.assets.find(x=>x.slug===a.origin.reference);if(old)reference=path.resolve(CARDS,'figure-inner-art-v12',old.source);}
 if(!reference||!fs.existsSync(reference))throw Error('Missing actual input reference: '+a.slug);
 return {slug:a.slug,reference:path.relative(CARDS,reference).replaceAll('\\','/'),sha256:sha(reference),credit:'Previously approved Everfolk generated painting; actual style/identity input, not an archaeological photograph.'};
});
const rows=NEW.assets.map(a=>{
 const ref=references.find(r=>r.slug===a.slug);
 const panes=[[path.join(CARDS,ref.reference),'Actual painting input'],[path.join(ROOT,a.source),'New generated painting'],[path.join(ROOT,a.final),'Mixed PixelOE finish']];
 return `<section><h2>${esc(a.title)} · ${esc(a.gender)} <small>${esc(a.figureName)}</small></h2><div class="panes">${panes.map(([file,title])=>`<figure><img loading="lazy" src="${url(file)}" alt="${esc(title)}: ${esc(a.slug)}"><figcaption>${esc(title)}</figcaption></figure>`).join('')}</div><p>${esc(ref.credit)} <a href="${url(path.join(ROOT,a.prompt))}">Actual prompt</a></p></section>`;
}).join('\n');
fs.writeFileSync(path.join(ROOT,'source/reference-inputs.json'),JSON.stringify(references,null,2));
fs.writeFileSync(path.join(REVIEW,'reference-comparison.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Everfolk · New artwork references</title><style>body{margin:0;background:#10231e;color:#eee4ce;font:16px/1.5 system-ui}main{max-width:1200px;margin:auto;padding:40px 25px}h1,h2{font-family:Georgia,serif;font-weight:400}h1{font-size:40px}h2{font-size:27px;margin:0 0 20px}small{display:block;font:14px system-ui;color:#bd9b66}.panes{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}section{padding:35px 0;border-top:1px solid #536c56}figure{margin:0}img{display:block;width:100%;aspect-ratio:4/5;object-fit:contain;background:#07120f}figcaption{padding-top:10px;color:#d2b37d}p{color:#a4b5a8;font-size:13px}a{color:#d2b37d}@media(max-width:650px){.panes{gap:10px}figcaption{font-size:11px}}</style><main><h1>New scenes, preserved references.</h1><p>34 new contributor illustrations. The left image is the actual, unmodified painting input supplied to generation. The centre is the new base made with the built-in image generator. The right is the verified mixed-grid PixelOE result. These are imaginative game illustrations.</p>${rows}</main></html>`);
console.log(JSON.stringify({references:references.length,review:'review/reference-comparison.html'}));
