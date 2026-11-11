import art from './scene-assets.json' with { type: 'json' };

/** A fixed pixel stage: CSS scales it with nearest-neighbour sampling. */
export const COAST_SIZE = { width: 768, height: 480 } as const;
type PixelSprite = { width: number; height: number; pixels: (string | number)[][] };
type Point = readonly [number, number];
export type CoastalScene = ReturnType<typeof createCoastalScene>;
const BOATS = [[423,218,.48,16,.018],[365,292,.94,29,.012],[636,190,.24,8,.021]];
const SEA_COLORS = ['#7a9290','#638783','#537b79','#43696b','#365960','#2d4c55','#29434e'];

function mix(a: string, b: string, amount: number) {
  const channel = (offset: number) => Math.round(parseInt(a.slice(offset,offset+2),16)*(1-amount)+parseInt(b.slice(offset,offset+2),16)*amount).toString(16).padStart(2,'0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// Sunset grading of the existing warm limestone / clay / olive / teal palette.
const grading: Record<string, string> = {
  '#fff2d1': '#ffe7b0', '#f5e6bf': '#f0c993', '#edcf91': '#f6cd8b',
  '#ddc79b': '#c59477', '#baa47a': '#ad8069', '#cbb58b': '#ac7f68',
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

function sprite(data: PixelSprite) {
  const { canvas, context: c } = surface(data.width, data.height);
  for (const [x, y, w, h, color] of data.pixels) {
    c.fillStyle = grading[String(color)] ?? String(color);
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
  c.fillStyle = '#e3b0a0'; c.fillRect(x + 8, y, size - 20, 2);
  c.fillRect(x, y + 2, size, 3); c.fillRect(x + 12, y + 5, size - 16, 1);
  c.fillStyle = '#ba8c94'; c.fillRect(x + 4, y + 5, size - 20, 2);
}

/** Low flat-roofed coastal storehouses, using the shipped harbor's silhouettes. */
function house(c: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, depth: number, variant: number) {
  const top = base - h, roof = top - depth;
  polygon(c, [[x, base], [x + w, base], [x + w - 35, base + 15], [x - 34, base + 15]], '#423f43');
  polygon(c, [[x + w, top], [x + w + depth, roof], [x + w + depth, base - depth], [x + w, base]], '#746064');
  c.fillStyle = ['#b08776', '#c7997b', '#bd8c72'][variant % 3]; c.fillRect(x, top, w, h);
  polygon(c, [[x, top], [x + depth, roof], [x + w + depth, roof], [x + w, top]], '#ecc49a');
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
  // Cool contact occlusion stays attached to the base, beneath the long cast shadow.
  c.fillStyle = '#68565a'; c.fillRect(x, base - 2, w, 2);
}

function shore() {
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
  buildings.forEach(([x,y,w,h,d], i) => house(c, x,y,w,h,d,i));
  // Original cargo jars are composited separately at runtime.
  return canvas;
}

function sky() {
  const { canvas, context: c } = surface();
  const colors = Array.from({length:24},(_,i)=>mix('#454052','#e1b795',i/23));
  for (let band = 0; band < colors.length; band++) {
    c.fillStyle = colors[band]; c.fillRect(0, band * 7, 768, 7);
    // Ordered, sparse transition pixels instead of a smooth raster gradient.
    if (band) for (let y = 0; y < 2; y++) for (let x = y % 2; x < 768; x += 4) {
      c.fillStyle = colors[band - 1]; c.fillRect(x, band * 7 + y, 1, 1);
    }
  }
  disk(c, 574, 119, 27, '#f4cda1');
  c.fillStyle = '#e1bb99'; c.fillRect(542, 138, 65, 2); c.fillRect(547, 146, 55, 3);
  c.fillStyle = '#798c8b'; c.fillRect(0, 162, 768, 8);
  c.fillStyle = '#9ba49a'; c.fillRect(0, 162, 768, 1);
  // Far coast uses the same low storehouse silhouettes, veiled by atmospheric perspective.
  for (let i = 0; i < 19; i++) {
    const x = 376 + i * 23, h = 3 + i * 7 % 10;
    c.fillStyle = '#958f8b'; c.fillRect(x, 164 - h, 20, h + 3);
    c.fillStyle = '#c7aa91'; c.fillRect(x, 164 - h, 20, 1);
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

export function createCoastalScene(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const c = context;
  canvas.width = COAST_SIZE.width; canvas.height = COAST_SIZE.height;
  c.imageSmoothingEnabled = false;
  const backdrop = sky(), settlement = shore(), near = foreground();
  const boats = art.shipFrames.map(sprite);
  const people = art.actors.map(actor => actor.frames.map(sprite));
  const cargo = sprite(art.cargo);
  const waterBands = Array.from({length:28},(_,i)=>{
    const progress = i/27*(SEA_COLORS.length-1), index = Math.floor(progress);
    return mix(SEA_COLORS[index],SEA_COLORS[Math.min(index+1,SEA_COLORS.length-1)],progress-index);
  });
  // Fixed bounded pools: no particles or sprite objects allocated during animation.
  const wavelets = Array.from({ length: 108 }, (_, i) => ({ x: (i * 127 + 31) % 800,
    y: 176 + (i * 47) % 290, size: 2 + i % 14, phase: i * 1.73 }));
  const dust = Array.from({ length: 21 }, (_, i) => ({ x: 390 + i * 79 % 360, y: 100 + i * 37 % 300, phase: i * 3.11 }));
  const reflections = Array.from({ length: 50 }, (_, i) => ({ y: 172 + i * 3, width: 10 + i * 1.5, phase: i * 2.7 }));
  let cameraX = 0, cameraY = 0;
  function draw(time: number, pointerX = 0, pointerY = 0) {
    cameraX += (pointerX - cameraX) * .065; cameraY += (pointerY - cameraY) * .065;
    const px = Math.round(cameraX * 5), py = Math.round(cameraY * 3);
    c.fillStyle = '#25454c'; c.fillRect(0,0,768,480);
    c.drawImage(backdrop, Math.round(px * .2), Math.round(py * .2));
    // Quantized sea depth with warm sky reflections and cool ambient fill.
    for (let i = 0; i < waterBands.length; i++) {
      c.fillStyle = waterBands[i]; c.fillRect(0,170+i*12,768,13);
    }
    for (const r of reflections) {
      const x = 574 + Math.sin(time * .45 + r.phase) * (5 + r.width * .08);
      c.fillStyle = r.y < 220 ? '#dfb48b' : '#a29f84';
      c.globalAlpha = .35 + .13 * Math.sin(time + r.phase);
      c.fillRect(Math.round(x - r.width / 2 + px * .4), r.y, Math.round(r.width), 1);
    }
    c.globalAlpha = 1;
    for (const w of wavelets) {
      const x = (w.x + time * (1 + (w.y - 170) / 120)) % 800 - 20;
      c.fillStyle = Math.sin(time * .65 + w.phase) > .2 ? '#8daba2' : '#42666c';
      c.globalAlpha = .17 + .12 * Math.sin(time + w.phase);
      c.fillRect(Math.round(x + px * .5), w.y, w.size, 1);
    }
    c.globalAlpha = 1;
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
      c.globalAlpha = .2; c.save(); c.translate(bx,by+image.height*s*1.3+2); c.scale(s,-s*.3); c.drawImage(image,0,0); c.restore();
      c.globalAlpha = 1; c.drawImage(image,bx,by,Math.round(image.width*s),Math.round(image.height*s));
      c.fillStyle = '#b3b49b'; c.fillRect(bx-8,by+Math.round(image.height*s),10+Math.floor(Math.sin(time+i)*3),1);
    }
    c.drawImage(settlement,px,py);
    c.drawImage(cargo, 526+px,274+py, cargo.width, cargo.height);
    c.drawImage(cargo, 692+px,397+py, cargo.width*1.5, cargo.height*1.5);
    for (let i = 0; i < 3; i++) {
      const person = people[i%2][Math.floor(time*4+i)%4];
      const progress = (time * (i === 1 ? -.011 : .008) + i * .32 + 100) % 1;
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
  return { draw, dispose() { for (const image of [backdrop,settlement,near,...boats,...people.flat(),cargo]) { image.width=0; image.height=0; } } };
}
