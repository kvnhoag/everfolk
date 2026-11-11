/** Original hand-drawn Everfolk glyphs, not a font or rasterized HTML text.
 * Each 1 is one square on the shared grid. Ascenders and stepped terminals vary
 * deliberately; baseline and stroke weights keep the mark legible as a family.
 */
export const WORDMARK_GLYPHS = [
  { letter:'E', y:3, rows:[
    '11111111111110','11111111111110','01110000000110','01110000000000','01110000000000','01110000000000','01110000000000','01110000011000','01111111111000','01111111111000','01110000011000','01110000000000','01110000000000','01110000000000','01110000000000','01110000000110','11111111111110','11111111111110'] },
  { letter:'v', y:9, rows:[
    '111100001111','111100001111','011000000110','011000000110','011100001110','001100001100','001100001100','001110011100','000110011000','000111111000','000011110000','000001100000'] },
  { letter:'e', y:9, rows:[
    '000111111000','001111111100','011100001110','011000000110','111000000111','111111111111','111111111111','111000000000','011000000000','011100000110','001111111100','000111111000'] },
  { letter:'r', y:8, rows:[
    '11100111100','11111111110','01111100110','01110000000','01110000000','01110000000','01110000000','01110000000','01110000000','01110000000','01110000000','11111000000','11111000000'] },
  { letter:'f', y:1, rows:[
    '000001111110','000011111111','000111000111','000110000010','000110000000','000110000000','000110000000','111111111000','111111111000','000110000000','000110000000','000110000000','000110000000','000110000000','000110000000','000110000000','000110000000','000110000000','001111100000','001111100000'] },
  { letter:'o', y:9, rows:[
    '000111111000','001111111100','011100001110','011000000110','111000000111','111000000111','111000000111','111000000111','011000000110','011100001110','001111111100','000111111000'] },
  { letter:'l', y:2, rows:[
    '1111100','1111100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','0011100','1111111','1111111'] },
  { letter:'k', y:3, rows:[
    '111100000000','111100000000','011100000000','011100000000','011100000000','011100001111','011100011110','011100111000','011101110000','011111100000','011111100000','011111110000','011100111000','011100011100','011100001110','011100000111','111110001111','111110001111'] },
] as const;
export const JEWEL_RAMPS = [
  ['#fff0bc','#efcc77','#c79948','#896133','#fff9df'],
  ['#c8edd6','#78bea1','#408974','#2d605a','#eff8d5'],
  ['#c4eee6','#71c5c4','#368a9a','#315b70','#e7fff3'],
  ['#e8d4ef','#b298cd','#7c6ca8','#51476f','#fff0e9'],
  ['#ffe0bc','#e7aa86','#b97569','#7a5360','#fff1ce'],
  ['#c9ebda','#79bda7','#458b8a','#335d6c','#edffe3'],
  ['#e3d5f0','#aaa0d1','#7974af','#534d7b','#fcf0e6'],
  ['#ffe1c1','#dda08e','#ae716f','#755261','#fff2ce'],
] as const;
const square = (x:number,y:number) => `M${x} ${y}h1v1h-1z`;
export const WORDMARK_WIDTH = 118;
export const WORDMARK_HEIGHT = 30;
export function buildWordmark() {
  let origin=3;
  return WORDMARK_GLYPHS.map((glyph,index)=>{
    const cells: {x:number;y:number;shade:number;batch:number}[]=[];
    const occupied = new Set<string>();
    glyph.rows.forEach((row,y)=>[...row].forEach((value,x)=>{if(value==='1')occupied.add(`${x},${y}`);}));
    let outline='',shadow='';
    const border=new Set<string>();
    occupied.forEach(key=>{
      const [x,y]=key.split(',').map(Number), xx=origin+x, yy=glyph.y+y+2;
      const top=!occupied.has(`${x},${y-1}`),left=!occupied.has(`${x-1},${y}`),bottom=!occupied.has(`${x},${y+1}`);
      const shade=top?0:left?1:bottom?3:((x+y+index)%11===0?4:2);
      cells.push({x:xx,y:yy,shade,batch:(x*7+y*13+index*3)%12});
      shadow+=square(xx+1,yy+3);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)border.add(`${xx+dx},${yy+dy}`);
    });
    border.forEach(key=>{const [x,y]=key.split(',').map(Number);outline+=square(x,y);});
    const silhouette=cells.map(c=>square(c.x,c.y)).join('');
    origin+=glyph.rows[0].length+2;
    return {letter:glyph.letter,cells,outline,shadow,silhouette,palette:JEWEL_RAMPS[index]};
  });
}
export const WORDMARK_ART = buildWordmark();
export function wordmarkPixelPath(cells: {x:number;y:number}[]) {return cells.map(c=>square(c.x,c.y)).join('');}
