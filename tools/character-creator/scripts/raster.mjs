import { deflateSync, deflateRawSync, crc32 } from 'node:zlib';

// Small opaque-pixel canvas used by the creator's integer-only painter.
// It records actual paint passes, including pixels hidden by later layers.
export class Raster {
  constructor(width,height,{layers=false}={}) {
    this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4);
    this.layers=[];this.recordLayers=layers;this.fillStyle='#000000';this.clipped=0;
  }
  getContext(){return this;}
  beginLayer(name){if(this.recordLayers){const layer={name,data:new Uint8ClampedArray(this.data.length)};this.layers.push(layer);this.activeLayer=layer;}}
  clearRect(x,y,w,h){for(let yy=Math.max(0,y);yy<Math.min(this.height,y+h);yy++)this.data.fill(0,(yy*this.width+Math.max(0,x))*4,(yy*this.width+Math.min(this.width,x+w))*4);}
  fillRect(x,y,w,h){
    const rgb=this.fillStyle.slice(1).match(/../g).map(v=>parseInt(v,16));
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
      if(xx<0||yy<0||xx>=this.width||yy>=this.height){this.clipped++;continue;}
      const offset=(yy*this.width+xx)*4;this.data.set([...rgb,255],offset);this.activeLayer?.data.set([...rgb,255],offset);
    }
  }
  getImageData(){return {data:new Uint8ClampedArray(this.data)};}
  putImageData(image){this.data.set(image.data);}
  rect(x,y,w,h,color){this.fillStyle=color;this.fillRect(x,y,w,h);}
  blit(source,x,y,width=source.width,height=source.height){
    for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++){
      const sx=Math.floor(dx*source.width/width),sy=Math.floor(dy*source.height/height),offset=(sy*source.width+sx)*4;
      if(!source.data[offset+3]||x+dx<0||y+dy<0||x+dx>=this.width||y+dy>=this.height)continue;
      const target=((y+dy)*this.width+x+dx)*4,pixel=source.data.subarray(offset,offset+4);
      this.data.set(pixel,target);this.activeLayer?.data.set(pixel,target);
    }
  }
  text(text,x,y,scale=2,color='#fff5d8'){
    const clean=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    for(const ch of clean){const rows=FONT[ch]??FONT['?'];for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(rows[row]&(1<<(4-col)))this.rect(x+col*scale,y+row*scale,scale,scale,color);x+=6*scale;}
  }
  png(){return encodePng(this.width,this.height,this.data);}
}
const FONT={
 ' ':[0,0,0,0,0,0,0],A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[14,17,16,16,16,17,14],D:[30,17,17,17,17,17,30],E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],I:[31,4,4,4,4,4,31],J:[7,2,2,2,18,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],M:[17,27,21,21,17,17,17],N:[17,25,21,19,17,17,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,21,10],X:[17,17,10,4,10,17,17],Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],
 '0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[30,1,1,14,1,1,30],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],'6':[14,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,1,14],'-':[0,0,0,31,0,0,0],'/':[1,2,2,4,8,8,16],'.':[0,0,0,0,0,12,12],':':[0,12,12,0,12,12,0],'&':[12,18,20,8,21,18,13],'+':[0,4,4,31,4,4,0],'?':[14,17,1,2,4,0,4]
};
function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
export function encodePng(width,height,pixels){
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)rows.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

// Ordinary ZIP, used for OpenRaster and a portable collection download.
export function zip(entries){
  const files=[],central=[];let offset=0;
  for(const [path,input]of entries){const name=Buffer.from(path),data=Buffer.isBuffer(input)?input:Buffer.from(input),stored=path==='mimetype',method=stored?0:8;
    const body=stored?data:deflateRawSync(data),crc=crc32(data),local=Buffer.alloc(30),record=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
    record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(method,10);record.writeUInt32LE(crc,16);record.writeUInt32LE(body.length,20);record.writeUInt32LE(data.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(offset,42);
    files.push(local,name,body);central.push(record,name);offset+=30+name.length+body.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...files,directory,end]);
}
export function openRaster(canvas){
  const layers=canvas.layers.filter(layer=>layer.data.some((value,i)=>i%4===3&&value));
  const files=layers.map((layer,i)=>[`data/layer${i}.png`,encodePng(canvas.width,canvas.height,layer.data)]);
  const xml=`<?xml version="1.0" encoding="UTF-8"?><image version="0.0.3" w="${canvas.width}" h="${canvas.height}" name="Everfolk Living Legacies"><stack>${layers.map((layer,i)=>`<layer name="${layer.name}" src="data/layer${i}.png" opacity="1.0" visibility="visible" composite-op="svg:src-over" x="0" y="0"/>`).reverse().join('')}</stack></image>`;
  return zip([['mimetype','image/openraster'],['stack.xml',xml],['mergedimage.png',canvas.png()],...files]);
}
