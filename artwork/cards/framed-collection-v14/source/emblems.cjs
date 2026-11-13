const fs=require('node:fs');
const path=require('node:path');
const cache=new Map();
function glyph(id){
 if(cache.has(id))return cache.get(id);
 const file=path.join(__dirname,'icons',id+'.svg');
 const source=fs.readFileSync(file,'utf8');
 if(/<script\b|\bon\w+\s*=|<foreignObject\b|<image\b/i.test(source))throw Error('Unexpected active icon content: '+id);
 const root=source.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
 if(!root)throw Error('Invalid sourced SVG: '+id);
 const view=root[1].match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[\s,]+/).map(Number);
 if(!view||view.length!==4||view.some(v=>!Number.isFinite(v))||view[2]!==view[3])throw Error('Expected square icon viewBox: '+id);
 let attrs=root[1].replace(/\s*(?:xmlns(?::\w+)?|width|height|viewBox|class|id|enable-background)\s*=\s*["'][^"']*["']/gi,'');
 let body=root[2].replace(/<!--[\s\S]*?-->/g,'');
 // Some web downloads include a full-canvas background, separate from the glyph.
 body=body.replace(/<path\b([^>]*?)\/?\s*>/gi,(tag,a)=>{
  const d=a.match(/\bd\s*=\s*["']([^"']+)["']/i)?.[1].replace(/[\s,]/g,'').toLowerCase();
  return d===`m00h${view[2]}v${view[3]}h0z`&&!/fill\s*=\s*["']none["']/i.test(a)?'':tag;
 });
 const result={body,attrs,view};cache.set(id,result);return result;
}
const recolor=(svg,color)=>svg.replace(/\b(fill|stroke)\s*=\s*(["'])([^"']+)\2/gi,(whole,key,quote,value)=>
 /^(?:none|transparent|url\()/i.test(value)?whole:`${key}=${quote}${color}${quote}`)
 .replace(/currentColor/g,color);
function emblem(id,color,size=64,x=0,y=0){
 const g=glyph(id),scale=size/g.view[2],attrs=recolor(g.attrs,color);
 const fill=/\bfill\s*=/.test(attrs)?'':`fill="${color}"`;
 return `<g id="Emblem_${id}" data-name="Figure emblem / ${id}" transform="translate(${x} ${y}) scale(${scale})"><g ${fill} ${attrs} transform="translate(${-g.view[0]} ${-g.view[1]})">${recolor(g.body,color)}</g></g>`;
}
module.exports={emblem};
