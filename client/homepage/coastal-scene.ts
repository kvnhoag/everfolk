import art from './scene-assets.json' with { type: 'json' };
import { createDawnWater, DAWN_SUN, quayEdge } from './dawn-water.ts';

/** A fixed pixel stage: CSS scales it with nearest-neighbour sampling. */
export const COAST_SIZE = { width: 768, height: 480 } as const;
type PixelSprite = { width: number; height: number; pixels: (string | number)[][] };
type Point = readonly [number, number];
export type CoastalScene = ReturnType<typeof createCoastalScene>;
const BOATS = [[423,218,.48,16,.018],[365,292,.94,29,.012],[636,190,.24,8,.021]];

function mix(a: string, b: string, amount: number) {
  const channel = (offset: number) => Math.round(parseInt(a.slice(offset,offset+2),16)*(1-amount)+parseInt(b.slice(offset,offset+2),16)*amount).toString(16).padStart(2,'0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// Sunrise grading of the existing warm limestone / clay / olive / teal palette.
const grading: Record<string, string> = {
  '#fff2d1': '#ffe7b0', '#f5e6bf': '#f6deb0', '#edcf91': '#f6cd8b',
  '#ddc79b': '#d5b58b', '#baa47a': '#ad8069', '#cbb58b': '#ac7f68',
  '#65503e': '#483d43', '#886447': '#785455', '#bf8b62': '#c9906d',
  '#263b43': '#252f3b', '#b8d2c4': '#a9b6a0', '#6b8051': '#717c5d',
};

function surface(width = 768, height = 480) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

function sprite(data: PixelSprite, modernActor=false) {
  const { canvas, context: c } = surface(data.width, data.height);
  for (const [x, y, w, h, color] of data.pixels) {
    c.fillStyle = modernActor && Number(y)>data.height*.55 && Number(y)<data.height*.84 && Number(w)>1 ? "#596b80" : grading[String(color)] ?? String(color);
    c.fillRect(Number(x), Number(y), Number(w), Number(h));
  }
  return canvas;
}

/** Scanline polygons retain integer pixel edges, including the perspective surfaces. */
function polygon(c: CanvasRenderingContext2D, points: readonly Point[], color: string) {
  c.fillStyle = color;
  const low = Math.floor(Math.min(...points.map(p => p[1])));
  const high = Math.ceil(Math.max(...points.map(p => p[1])));
  for (let y = low; y < high; y++) {
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        crossings.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length; i += 2)
      c.fillRect(Math.round(crossings[i]), y, Math.round(crossings[i + 1] - crossings[i]), 1);
  }
}

function disk(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  c.fillStyle = color;
  for (let row = -radius; row <= radius; row++) {
    const half = Math.floor(Math.sqrt(radius * radius - row * row));
    c.fillRect(x - half, y + row, half * 2, 1);
  }
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  c.fillStyle = '#f6ddc3'; c.fillRect(x + 8, y, size - 20, 2);
  c.fillRect(x, y + 2, size, 3); c.fillRect(x + 12, y + 5, size - 16, 1);
  c.fillStyle = '#c4cfd0'; c.fillRect(x + 4, y + 5, size - 20, 2);
}

/** Low flat-roofed coastal storehouses, using the shipped harbor's silhouettes. */
function house(c: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, depth: number, variant: number, modern=false) {
  const top = base - h, roof = top - depth;
  polygon(c, [[x, base], [x + w, base], [x + w - 35, base + 15], [x - 34, base + 15]], '#5e7375');
  polygon(c, [[x + w, top], [x + w + depth, roof], [x + w + depth, base - depth], [x + w, base]], '#89978f');
  c.fillStyle = ['#c2b08e', '#d8bc92', '#cbb08a'][variant % 3]; c.fillRect(x, top, w, h);
  polygon(c, [[x, top], [x + depth, roof], [x + w + depth, roof], [x + w, top]], '#ffe1a5');
  c.fillStyle = '#f4d2a2'; c.fillRect(x - 1, top, w + 2, 2);
  c.fillStyle = '#d9ae86'; c.fillRect(x + depth, roof - 2, w, 2);
  // Low parapet edges and a few warm roof pixels retain the original flat-roof shape.
  polygon(c, [[x,top],[x+depth,roof],[x+depth+1,roof+2],[x+1,top+2]], '#d6a87f');
  c.fillStyle = '#faD6a1'; c.fillRect(x+depth+2,roof-2,w-5,1);
  c.fillStyle = '#d7ae86'; c.fillRect(x+9,top-3,Math.max(4,w-17),1);
  c.fillStyle = '#ce9e7b'; c.fillRect(x+13,top-6,4,1);
  c.fillStyle = '#8c6a63'; c.fillRect(x + 2, top + 3, w - 4, 1);
  c.fillStyle = '#514951'; c.fillRect(x + Math.floor(w * .63), base - 14, 6, 14);
  c.fillStyle = '#c69979'; c.fillRect(x + Math.floor(w*.63)+6,base-13,1,13);
  c.fillStyle = '#e7bd8d'; c.fillRect(x + Math.floor(w * .63) - 1, base - 15, 8, 1);
  c.fillStyle = '#63535a'; c.fillRect(x + 6, top + 10, 5, 7);
  c.fillStyle = '#d4ab81'; c.fillRect(x + 6, top + 17, 7, 1);
  for (let y = top + 9; y < base - 3; y += 9) {
    c.fillStyle = '#a47b6b'; c.fillRect(x + 1, y, 4, 1); c.fillRect(x + w - 5, y + 2, 4, 1);
    c.fillStyle = '#d0a082'; c.fillRect(x+8+(y%5),y+3,3,1);
    c.fillStyle = '#82686a'; c.fillRect(x+w+2,y-depth+1,Math.max(2,depth-5),1);
  }
  if(modern){
    c.fillStyle='#d4dbcb';c.fillRect(x+1,top+3,w-2,h-5);
    for(let wy=top+8;wy<base-6;wy+=9)for(let wx=x+5;wx<x+w-3;wx+=8){
      c.fillStyle=(wx+wy+variant)%3?'#5c929e':'#c0c9ae';c.fillRect(wx,wy,5,6);
      c.fillStyle='#b2d9d4';c.fillRect(wx,wy,5,1);
      c.fillStyle='#748e91';c.fillRect(wx+4,wy+1,1,5);
    }
    c.fillStyle='#466c79';c.fillRect(x+Math.floor(w*.63),base-14,6,14);
    c.fillStyle='#e7dac2';c.fillRect(x,top+3,w,2);
    c.fillStyle='#487283';c.fillRect(x+depth+5,roof-5,Math.max(6,w-12),3);
    c.fillStyle='#b6d8d7';c.fillRect(x+depth+5,roof-5,Math.max(6,w-12),1);
  }
  // Cool contact occlusion stays attached to the base, beneath the long cast shadow.
  c.fillStyle = '#68565a'; c.fillRect(x, base - 2, w, 2);
}

function shore(modern=false) {
  const { canvas, context: c } = surface();
  // The source harbor's waterfront, recomposed as receding limestone quays.
  polygon(c, [[501, 183], [768, 226], [768, 480], [696, 480], [471, 289], [465, 232]], '#8d7870');
  polygon(c, [[501, 177], [768, 220], [768, 464], [699, 464], [477, 283], [470, 228]], '#b9977c');
  polygon(c, [[470, 228], [477, 283], [699, 464], [696, 473], [469, 288], [462, 229]], '#6b6264');
  polygon(c, [[470, 226], [478, 280], [700, 461], [704, 460], [482, 277], [475, 224]], '#e4bb90');
  // Perspective paving, no camera-dependent blur or anti-aliased lines.
  for (let row = 0; row < 17; row++) {
    const y = 205 + row * 15, start = Math.max(474, 463 + (y - 260) * 1.18);
    c.fillStyle = '#a18574'; c.fillRect(Math.round(start), y, 310, 1);
    for (let col = 0; col < 7; col++) {
      const x = Math.round(start + col * 31 + (row % 2) * 15);
      c.fillRect(x, y + 1, 1, 14);
    }
  }
  const buildings = [[521,216,25,24,11], [563,221,30,33,12], [610,238,35,36,15],
    [667,256,31,29,12], [721,285,43,42,17], [502,269,29,37,13],
    [544,301,40,44,16], [604,338,45,53,20], [677,390,46,61,20], [745,434,42,66,19]];
  buildings.forEach(([x,y,w,h,d], i) => house(c, x,y,w,modern?h+14+(i%3)*15:h,d,i,modern));
  if(modern){
    // The same waterfront becomes a modern promenade, not a different geographical scene.
    for(let y=282;y<440;y+=37){
      const x=Math.round(quayEdge(y)+8);
      c.fillStyle='#536d78';c.fillRect(x,y-25,1,25);c.fillRect(x-3,y-26,9,2);
      c.fillStyle='#f8dda2';c.fillRect(x+1,y-24,4,2);
      c.fillStyle='#dae0c9';c.fillRect(x-5,y,10,2);
    }
  }
  // Original cargo jars are composited separately at runtime.
  return canvas;
}

function sky(modern=false) {
  const { canvas, context: c } = surface();
  const colors = Array.from({length:24},(_,i)=>mix('#80a8bb','#ffe5b8',i/23));
  for (let band = 0; band < colors.length; band++) {
    c.fillStyle = colors[band]; c.fillRect(0, band * 7, 768, 7);
    // Ordered, sparse transition pixels instead of a smooth raster gradient.
    if (band) for (let y = 0; y < 2; y++) for (let x = y % 2; x < 768; x += 4) {
      c.fillStyle = colors[band - 1]; c.fillRect(x, band * 7 + y, 1, 1);
    }
  }
  disk(c, DAWN_SUN.x, DAWN_SUN.y, 21, '#fff1c5');
  c.fillStyle = '#ffe7bd'; c.fillRect(548, 157, 54, 1); c.fillRect(549, 164, 52, 1);
  c.fillStyle = '#c6d7cd'; c.fillRect(0, 162, 768, 8);
  c.fillStyle = '#f1ddbb'; c.fillRect(0, 162, 768, 1);
  // Far coast uses the same low storehouse silhouettes, veiled by atmospheric perspective.
  for (let i = 0; i < 19; i++) {
    const x = 376 + i * 23, h = modern ? 12+(i*17)%49 : 3 + i * 7 % 10;
    c.fillStyle = '#a5b7b3'; c.fillRect(x, 164 - h, 20, h + 3);
    c.fillStyle = '#c7aa91'; c.fillRect(x, 164 - h, 20, 1);
    if(modern)for(let yy=168-h;yy<160;yy+=7){c.fillStyle='#b6cdca';c.fillRect(x+4,yy,12,2);}
  }
  return canvas;
}

function foreground() {
  const { canvas, context: c } = surface();
  polygon(c, [[0,410], [150,425], [254,445], [407,480], [0,480]], '#343b40');
  polygon(c, [[0,407], [150,422], [254,442], [407,477], [390,480], [0,480]], '#59524e');
  c.fillStyle = '#867363'; c.fillRect(0,407,75,2);
  polygon(c, [[0,433], [195,454], [263,480], [0,480]], '#252e36');
  // A cropped quay edge provides the close plane; no unrelated decorative props.
  for (let i = 0; i < 11; i++) {
    const x = i * 27, y = 411 + Math.floor(i * 4.8);
    c.fillStyle = '#766257'; c.fillRect(x, y, 22, 2);
    c.fillStyle = '#454343'; c.fillRect(x + 20, y + 3, 1, 16);
  }
  return canvas;
}

export function createCoastalScene(canvas: HTMLCanvasElement, modern=false) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const c = context;
  canvas.width = COAST_SIZE.width; canvas.height = COAST_SIZE.height;
  c.imageSmoothingEnabled = false;
  const backdrop = sky(modern), settlement = shore(modern), near = foreground();
  const boats = art.shipFrames.map(frame=>{
    const image=sprite(frame);
    if(modern){
      const c=image.getContext('2d')!;
      c.clearRect(0,0,image.width,58);
      c.fillStyle='#dbe6dc';c.fillRect(21,57,19,14);c.fillRect(17,69,27,3);
      c.fillStyle='#699da8';c.fillRect(24,60,13,5);
      c.fillStyle='#3d6175';c.fillRect(10,73,30,3);
      c.fillStyle='#fff0ba';c.fillRect(39,66,2,2);
    }
    return image;
  });
  const people = art.actors.map(actor => actor.frames.map(frame=>sprite(frame,modern)));
  const cargo = sprite(art.cargo);
  const water = createDawnWater();
  const musician = sprite(art.festival.musician), rug = sprite(art.festival.rug), garland = sprite(art.festival.garland);
  // Fixed bounded pools: no particles or sprite objects allocated during animation.
  const dust = Array.from({ length: 21 }, (_, i) => ({ x: 390 + i * 79 % 360, y: 100 + i * 37 % 300, phase: i * 3.11 }));
  let cameraX = 0, cameraY = 0;
  function draw(time: number, pointerX = 0, pointerY = 0) {
    cameraX += (pointerX - cameraX) * .065; cameraY += (pointerY - cameraY) * .065;
    const px = Math.round(cameraX * 5), py = Math.round(cameraY * 3);
    c.fillStyle = '#25454c'; c.fillRect(0,0,768,480);
    c.drawImage(backdrop, Math.round(px * .2), Math.round(py * .2));
    // The moving height field shades every water sample, not a scrolling gradient.
    c.drawImage(water.draw(time), 0, 170, 768, 310);
    // Distorted reflections of the actual cached settlement along the water-facing quay.
    c.globalAlpha = .14;
    for (let row=228;row<466;row+=2) {
      const edge=quayEdge(row), displacement=Math.round(Math.sin(row*.29+time*.9)*2);
      c.save(); c.translate(Math.round(edge+px+displacement), row+py); c.scale(-.5,1);
      c.drawImage(settlement,Math.round(edge),row-7,48,2,0,0,48,2); c.restore();
    }
    c.globalAlpha=1;
    // Shoreline swash and refracted caustic glints share the water's slow wave cadence.
    for(let row=229;row<460;row+=4){
      const edge=quayEdge(row), swell=Math.sin(row*.22-time*.72);
      c.globalAlpha=.16+Math.max(0,swell)*.23; c.fillStyle='#cde7cd';
      c.fillRect(Math.round(edge-4+swell*2+px),row+py,3+Math.round(Math.max(0,swell)*3),1);
    }
    c.globalAlpha=1;
    // Clouds, sail cloth, wakes and individual people each have independent clocks.
    cloud(c, 415 + Math.round(Math.sin(time * .027) * 13 + px*.25), 54, 79);
    cloud(c, 626 + Math.round(Math.sin(time * .019 + 1) * 19), 83, 101);
    cloud(c, 211 + Math.round(Math.sin(time * .023 + 2) * 15), 102, 66);
    for (let i = 0; i < BOATS.length; i++) {
      const [x,y,s,range,speed] = BOATS[i];
      const bx = Math.round(x + Math.sin(time * speed + i) * range + px * .6);
      const by = Math.round(y + Math.sin(time * .65 + i * 2) * 1.2 + py * .6);
      const image = boats[Math.floor(time * (3 + i) + i) % boats.length];
      c.globalAlpha = .2; c.fillStyle = '#202f3e';
      c.fillRect(bx - 5, by + Math.round(image.height*s) + 3, Math.round(image.width*s)+9, 3);
      // Reflect hull and sail in independently displaced horizontal water strips.
      c.globalAlpha=.19;
      const base=by+image.height*s;
      for(let row=0;row<image.height;row+=3){
        const dy=Math.round(base+(image.height-row)*s*.34), shift=Math.round(Math.sin(dy*.37+time*1.3)*2);
        c.drawImage(image,0,row,image.width,3,bx+shift,dy,Math.round(image.width*s),1);
      }
      c.globalAlpha = 1; c.drawImage(image,bx,by,Math.round(image.width*s),Math.round(image.height*s));
      for(let w=0;w<4;w++){
        c.globalAlpha=.3-w*.055; c.fillStyle='#c6dfc4';
        c.fillRect(bx-5-w*3,Math.round(base+w*2+Math.sin(time*.8+w)),Math.round(image.width*s)+10+w*5,1);
      }
      c.globalAlpha=1;
    }
    c.drawImage(settlement,px,py);
    for(let row=242;row<450;row+=6){
      c.globalAlpha=Math.max(0,Math.sin(row*.19+time*.72))*.12;c.fillStyle='#e7efc5';
      c.fillRect(Math.round(quayEdge(row)-5+px),row+py,4,1);
    }
    c.globalAlpha=1;
    if(!modern)c.drawImage(cargo, 526+px,274+py, cargo.width, cargo.height);
    if(!modern)c.drawImage(cargo, 692+px,397+py, cargo.width*1.5, cargo.height*1.5);
    // A modest community gathering uses the shipped music scene, not a named ritual.
    if(!modern)c.drawImage(rug,653+px,294+py,42,6);
    if(!modern)c.drawImage(musician,679+px,279+py,14,17);
    for(let g=0;!modern&&g<2;g++){
      const gx=536+g*91, gy=202+g*40;
      for(let strip=0;strip<garland.width;strip+=5){
        const lift=Math.round(Math.sin(time*.65+strip*.12+g));
        c.drawImage(garland,strip,0,Math.min(5,garland.width-strip),garland.height,gx+strip*.55+px,gy+lift+py,3,5);
      }
    }
    // Remove only the five stationary listeners that formed the awkward central cluster.
    // The seated musician, decorations and all five waterfront walkers remain.
    // Five independent walkers stay spaced along the clear quay.
    for (let i = 0; i < 5; i++) {
      const person = people[i%2][Math.floor(time*4+i)%4];
      const progress = (time * (i === 1 ? -.011 : .008) + i * .19 + 100) % 1;
      // Follow the open strip along the quay, rather than crossing building faces.
      const x = Math.round(490+progress*196), y = Math.round(282+progress*166);
      const scale = .27 + progress*.16;
      c.globalAlpha = .35; c.fillStyle='#30303b';
      c.fillRect(x-5+px,y+py,Math.round(person.width*scale)+8,2); c.globalAlpha=1;
      c.drawImage(person,x+px,y-Math.round(person.height*scale)+py,Math.round(person.width*scale),Math.round(person.height*scale));
    }
    // Existing PixelAtmosphere birds, advanced through three wing frames.
    for (let i = 0; i < 3; i++) {
      const x = Math.round(470 + (time*5+i*37)%270), y = Math.round(87 + i*9+Math.sin(time*.4+i)*3);
      const flap = [0,1,0,-1][Math.floor(time*4+i)%4];
      c.fillStyle = '#4b5360'; c.fillRect(x,y,2,1);c.fillRect(x-2,y-1-flap,2,1);c.fillRect(x+2,y-1-flap,2,1);
    }
    c.drawImage(near,px*2,py*2);
    // Light catches airborne dust near the sun; no fantasy objects are introduced.
    for (const p of dust) {
      c.globalAlpha = Math.max(0, Math.sin(time*.45+p.phase))*.36;
      c.fillStyle='#f9d29b'; c.fillRect(Math.round(p.x+Math.sin(time*.2+p.phase)*9),Math.round(p.y-time*.9%22),1,1);
    }
    c.globalAlpha = 1;
  }
  return { draw, dispose() { for (const image of [backdrop,settlement,near,...boats,...people.flat(),cargo,musician,rug,garland]) { image.width=0; image.height=0; } water.dispose(); } };
}
