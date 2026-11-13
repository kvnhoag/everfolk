const names=[
 ['The First Step','Kindred Lives','The Scribe’s Tale','Beyond the Shore','Roots of Tomorrow'],
 ['Ink and Ochre','The Wandering Page','Ways of the World','Folk and Fortune','An Unwritten Life'],
 ['Sparrow Song','Acorn Chronicle','Quill and Turning Leaf','The Road Together','Stars Above Our Lives'],
 ['A Story at Dawn','House of Stories','The Life We Write','Worlds Between Pages','The Everfolk Chronicle'],
];
const backgrounds=['#18383b','#1d3b35','#173d42','#f0e4cb','#213c39'];
module.exports=names.flatMap((family,fi)=>family.map((name,i)=>({
 id:String(fi*5+i+1).padStart(2,'0'),name,slug:name.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-'),
 family:['Illuminated initial','Printed tale','Lettering in bloom','Living chronicle'][fi],mode:['initial','woodcut','flourish','vignette'][fi],motif:i,
 background:backgrounds[(i+fi)%backgrounds.length],face:fi===1?['#d69a50','#d5ac69','#c98b50','#d8ba78','#c78f56'][i]:'#f1e4c4',
 accent:['#c3924e','#ae714d','#b98a45','#b88b49','#c49c56'][i],initial:['#c38748','#b47550','#bf934c','#c28151','#b58b4c'][i],
 ink:'#18383e',paper:'#f4e6c7',gold:'#c8a04e',clay:'#b06e4b',olive:'#78845c',
 mottoY:fi===2?491:fi===3?502:fi===0?476:478,
} )));
