import art from './scene-assets.json' with { type: 'json' };
import { createDawnWater, DAWN_SUN, quayEdge } from './dawn-water.ts';

/** A fixed pixel stage: CSS scales it with nearest-neighbour sampling. */
export const COAST_SIZE = { width: 768, height: 480 } as const;
type PixelSprite = { width: number; height: number; pixels: (string | number)[][] };
type Point = readonly [number, number];
export type CoastalScene = ReturnType<typeof createCoastalScene>;

function mix(a: string, b: string, amount: number) {
  const channel = (offset: number) => Math.round(
    parseInt(a.slice(offset, offset + 2), 16) * (1 - amount) +
    parseInt(b.slice(offset, offset + 2), 16) * amount,
  ).toString(16).padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

// Sunrise grading of the existing warm limestone / clay / olive / teal palette.
const grading: Record<string, string> = {
  '#fff2d1': '#ffe9b8', '#f5e6bf': '#f6dfb2', '#edcf91': '#f6ce8c',
  '#ddc79b': '#d7b78d', '#baa47a': '#b0866d', '#cbb58b': '#b2856c',
  '#65503e': '#483d43', '#886447': '#7a5654', '#bf8b62': '#ca916e',
  '#263b43': '#232e3a', '#b8d2c4': '#acc0ad', '#6b8051': '#6f7f5c',
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

/** Integer-grid midground & horizon sailing ship sprites (4 sail frames each) for zero-blur 1:1 rendering. */
function buildScaledShipFrames(scaleNum: number, scaleDen: number): HTMLCanvasElement[] {
  return art.shipFrames.map((_, frame) => {
    const w = Math.round(50 * scaleNum / scaleDen);
    const h = Math.round(77 * scaleNum / scaleDen);
    const { canvas, context: c } = surface(w, h);
    const shift = [0, 1, 0, -1][frame];
    const sx = (v: number) => Math.round(v * scaleNum / scaleDen);
    const sy = (v: number) => Math.round(v * scaleNum / scaleDen);
    // Hull & gunwale
    c.fillStyle = '#f0d8a8'; c.fillRect(0, sy(60), w, Math.max(1, sy(3)));
    c.fillStyle = '#7c5652'; c.fillRect(sx(4), sy(63), w - sx(8), Math.max(2, sy(6)));
    c.fillStyle = '#483d43'; c.fillRect(sx(7), sy(69), w - sx(14), Math.max(2, sy(5)));
    c.fillStyle = '#684846'; c.fillRect(sx(12), sy(74), w - sx(24), Math.max(1, sy(3)));
    // Mast & yardarm
    const mastX = sx(27);
    c.fillStyle = '#483d43'; c.fillRect(mastX, 0, Math.max(1, sx(2)), sy(63));
    c.fillStyle = '#7c5652'; c.fillRect(sx(6), sy(4), w - sx(11), Math.max(1, sy(2)));
    // Sunlit left sail & warm-shaded right sail
    for (let step = 0; step < 7; step++) {
      const top = sy(7 + step * 5.2);
      const sh = Math.max(2, sy(5.5));
      const lw = Math.max(2, sx(17 - step * 2));
      c.fillStyle = step % 2 === 0 ? '#ffe9b8' : '#f6dfb2';
      c.fillRect(mastX - lw - sx(1) + shift, top, lw, sh);
      const rw = Math.max(2, sx(15 - step * 2));
      c.fillStyle = step % 2 === 0 ? '#f6dfb2' : '#d7b78d';
      c.fillRect(mastX + Math.max(1, sx(2)) + shift, top + 1, rw, sh);
    }
    return canvas;
  });
}

/** Crisp 1:1 integer-pixel harbor walker frames (12x24) in the project's tunic & mantle palettes. */
function buildWalkerFrames(): HTMLCanvasElement[][] {
  const outfits = [
    { robe: '#3d5e75', dark: '#2c4659', mantle: '#4e8f9a', skin: '#ca916e', hair: '#3e3434', accent: '#f6dfb2' },
    { robe: '#6d7e58', dark: '#4d5d3d', mantle: '#91a77b', skin: '#d9a579', hair: '#584438', accent: '#f6ce8c' },
    { robe: '#b86e4c', dark: '#884e38', mantle: '#e6c896', skin: '#ca916e', hair: '#3e3434', accent: '#ffe9b8' },
    { robe: '#d8bc90', dark: '#a88a64', mantle: '#41637b', skin: '#d9a579', hair: '#483d38', accent: '#f6ce8c' },
  ];
  return outfits.map(p => Array.from({ length: 4 }, (_, frame) => {
    const { canvas, context: c } = surface(12, 24);
    const stride = [0, 1, 0, -1][frame];
    const bob = frame % 2 === 1 ? -1 : 0;
    // Head & hair
    c.fillStyle = p.hair; c.fillRect(4, 1 + bob, 4, 2);
    c.fillStyle = p.skin; c.fillRect(4, 3 + bob, 4, 4);
    c.fillStyle = '#232e3a'; c.fillRect(4, 4 + bob, 1, 1); c.fillRect(7, 4 + bob, 1, 1);
    // Neck & shoulders
    c.fillStyle = p.skin; c.fillRect(5, 7 + bob, 2, 1);
    // Tunic body & shaded right fold
    c.fillStyle = p.robe; c.fillRect(3, 8 + bob, 6, 11);
    c.fillStyle = p.dark; c.fillRect(7, 8 + bob, 2, 11);
    // Diagonal woven mantle & sunlit trim
    c.fillStyle = p.mantle;
    c.fillRect(3, 8 + bob, 3, 4);
    c.fillRect(4, 11 + bob, 3, 5);
    c.fillRect(5, 15 + bob, 3, 4);
    c.fillStyle = p.accent; c.fillRect(3, 18 + bob, 6, 1);
    // Arms swinging in opposition to stride
    c.fillStyle = p.skin;
    c.fillRect(2, 9 + bob + stride, 1, 5);
    c.fillRect(9, 9 + bob - stride, 1, 5);
    // Legs & leather sandals
    c.fillStyle = p.skin;
    c.fillRect(4 - stride, 19, 2, 3);
    c.fillRect(6 + stride, 19, 2, 3);
    c.fillStyle = '#483d43';
    c.fillRect(3 - stride, 22, 3, 2);
    c.fillRect(6 + stride, 22, 3, 2);
    return canvas;
  }));
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

/** Same scanline polygon but clipped strictly to the limestone quay deck (never spills into water). */
function landPolygon(c: CanvasRenderingContext2D, points: readonly Point[], color: string) {
  c.fillStyle = color;
  const low = Math.floor(Math.min(...points.map(p => p[1])));
  const high = Math.ceil(Math.max(...points.map(p => p[1])));
  for (let y = low; y < high; y++) {
    const minLandX = Math.ceil(quayEdge(y)) + 6;
    const crossings: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        crossings.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i < crossings.length; i += 2) {
      const x0 = Math.max(minLandX, Math.round(crossings[i]));
      const x1 = Math.min(768, Math.round(crossings[i + 1]));
      if (x1 > x0) c.fillRect(x0, y, x1 - x0, 1);
    }
  }
}

function disk(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  c.fillStyle = color;
  for (let row = -radius; row <= radius; row++) {
    const half = Math.floor(Math.sqrt(radius * radius - row * row));
    c.fillRect(x - half, y + row, half * 2, 1);
  }
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, size: number, warm = true) {
  const topColor = warm ? '#faDFC0' : '#d8e0dc';
  const midColor = warm ? '#f3caa6' : '#b8c8cc';
  const bottomColor = warm ? '#ffe9be' : '#e6d8c0';
  c.fillStyle = topColor;
  c.fillRect(x + 10, y, size - 22, 2);
  c.fillRect(x + 4, y + 2, size - 8, 2);
  c.fillStyle = midColor;
  c.fillRect(x, y + 4, size, 3);
  c.fillStyle = bottomColor;
  c.fillRect(x + 6, y + 7, size - 14, 1);
}

/**
 * Compact, richly decorated 2.5D Egyptian-Greek coastal limestone buildings of 350 BCE Rhakotis.
 * Every architectural decoration (frieze, sun-awning, amphorae, stone bench, rooftop windcatcher)
 * is strictly bounded within the building's own footprint so nothing ever overlaps wrongly.
 */
function house(
  c: CanvasRenderingContext2D,
  x: number,
  base: number,
  w: number,
  h: number,
  depth: number,
  variant: number,
  kind: 'storehouse' | 'stoa' | 'courtyard' | 'workshop' = 'storehouse',
) {
  const top = base - h, roof = top - depth;

  // 1. Radial cast shadow away from DAWN_SUN (574, 151), strictly clipped to land
  const cx = x + w * 0.5;
  const sunDx = cx - DAWN_SUN.x;
  const sunDy = Math.max(48, base - DAWN_SUN.y);
  const shadowDx = Math.round(Math.max(-18, Math.min(18, (sunDx / sunDy) * h * 0.32 - 6)));
  const shadowDy = Math.round(h * 0.22 + 4);
  landPolygon(c, [
    [x, base],
    [x + w + depth, base - depth],
    [x + w + depth + shadowDx, base - depth + shadowDy],
    [x + shadowDx, base + shadowDy],
  ], '#9c8370');

  // 2. Paved stone doorstep threshold connecting the doorway cleanly toward the street
  const doorX = x + Math.floor(w * 0.55);
  const doorW = w >= 38 ? 8 : 7;
  c.fillStyle = '#b8987a';
  c.fillRect(doorX - 2, base, doorW + 4, 3);
  c.fillStyle = '#e5c69c';
  c.fillRect(doorX - 1, base, doorW + 2, 1);

  // 3. Receding right side wall (sky-hemisphere shaded limestone)
  polygon(c, [
    [x + w, top],
    [x + w + depth, roof],
    [x + w + depth, base - depth],
    [x + w, base],
  ], '#818c88');
  for (let sy = top + 6; sy < base - 4; sy += 6) {
    c.fillStyle = '#6b7574';
    c.fillRect(x + w + 2, sy - Math.floor(depth * 0.45), Math.max(3, depth - 4), 1);
  }
  polygon(c, [
    [x + w, base - 2],
    [x + w + depth, base - depth - 2],
    [x + w + depth, base - depth],
    [x + w, base],
  ], '#4a4548');

  // 4. Sun-facing front wall
  const wallColors = ['#d5b892', '#e0c49e', '#cca982', '#d9bb95'];
  const wallBase = wallColors[variant % wallColors.length];
  c.fillStyle = wallBase;
  c.fillRect(x, top, w, h);

  // Warm limestone dado (lower plinth course along the bottom of the front wall)
  c.fillStyle = '#bfa07e';
  c.fillRect(x, base - 5, w, 4);
  c.fillStyle = '#e6c89e';
  c.fillRect(x, base - 6, w, 1);

  // Corner pilaster strips (sunlit left edge & shaded right bevel)
  c.fillStyle = '#f4d9b0'; c.fillRect(x, top, 2, h - 2);
  c.fillStyle = '#b08e70'; c.fillRect(x + w - 2, top, 2, h - 2);

  // 5. Roof top plane (2.5D isometric projection)
  polygon(c, [
    [x, top],
    [x + depth, roof],
    [x + w + depth, roof],
    [x + w, top],
  ], '#fae0a8');
  if (depth >= 10) {
    polygon(c, [
      [x + 4, top - 2],
      [x + depth + 1, roof + 2],
      [x + w + depth - 4, roof + 2],
      [x + w - 2, top - 2],
    ], '#dfb888');
  }

  // Rooftop architectural ornaments (strictly inside the roof terrace polygon)
  if (kind === 'courtyard') {
    // Traditional Egyptian rooftop wind-catcher (malqaf) catching the morning sea breeze
    const mx = x + depth + Math.floor(w * 0.35), my = roof + 2;
    c.fillStyle = '#818c88'; c.fillRect(mx + 7, my - 4, 3, 5);
    c.fillStyle = '#e5c69c'; c.fillRect(mx, my - 4, 7, 5);
    c.fillStyle = '#46393f'; c.fillRect(mx + 1, my - 2, 5, 3);
    c.fillStyle = '#fff0c4'; c.fillRect(mx - 1, my - 5, 10, 1);
  } else {
    // Classical limestone corner acroteria finials on parapet corners
    c.fillStyle = '#fff0c4';
    c.fillRect(x, top - 2, 2, 2);
    c.fillRect(x + w - 2, top - 2, 2, 2);
  }

  // 6. Stepped Egyptian-Greek cornice & painted decorative frieze band
  c.fillStyle = '#fff0c4'; c.fillRect(x - 1, top, w + 2, 2);
  c.fillStyle = '#cfa37a'; c.fillRect(x + depth, roof - 2, w + 1, 2);
  polygon(c, [[x, top], [x + depth, roof], [x + depth + 2, roof + 2], [x + 2, top + 2]], '#d8aa80');
  c.fillStyle = '#8c695e'; c.fillRect(x + 1, top + 2, w - 2, 1);

  // Painted terracotta-and-teal frieze / cedar beam ends below cornice
  for (let bx = x + 3; bx < x + w - 3; bx += 5) {
    if (kind === 'stoa' || kind === 'courtyard') {
      c.fillStyle = (bx + variant) % 10 === 0 ? '#a85844' : '#426b75';
      c.fillRect(bx, top + 3, 2, 2);
      c.fillStyle = '#f2d4a4';
      c.fillRect(bx + 2, top + 3, 2, 1);
    } else {
      c.fillStyle = '#65503e'; c.fillRect(bx, top + 3, 2, 2);
      c.fillStyle = '#e7be8c'; c.fillRect(bx, top + 3, 1, 1);
    }
  }

  // Dressed ashlar masonry courses across the front facade
  for (let y = top + 9; y < base - 7; y += 7) {
    c.fillStyle = '#b08b6e';
    c.fillRect(x + 2, y, 5, 1);
    c.fillRect(x + w - 7, y + 2, 5, 1);
    c.fillStyle = '#eccb9e';
    c.fillRect(x + 6 + (y % 5), y + 1, 5, 1);
  }

  // 7. Typology-specific openings & non-overlapping facade decorations
  if (kind === 'stoa') {
    // Colonnaded Stoa / Civic Portico: deep shaded gallery with fluted limestone columns
    const galleryTop = top + 8;
    const galleryH = h - 11;
    c.fillStyle = '#352d35';
    c.fillRect(x + 4, galleryTop, w - 8, galleryH);
    // Warm ochre-red fresco dado inside the portico
    c.fillStyle = '#7c483a';
    c.fillRect(x + 4, base - 10, w - 8, 7);
    // Fluted columns along the front stylobate
    const cols = 5;
    const stepX = Math.floor((w - 10) / (cols - 1));
    for (let i = 0; i < cols; i++) {
      const cxCol = x + 4 + i * stepX;
      c.fillStyle = '#fff0c4'; c.fillRect(cxCol - 1, galleryTop, 4, 2);
      c.fillStyle = '#fff0c4'; c.fillRect(cxCol, galleryTop + 2, 1, galleryH - 4);
      c.fillStyle = '#e5c699'; c.fillRect(cxCol + 1, galleryTop + 2, 1, galleryH - 4);
      c.fillStyle = '#a6866a'; c.fillRect(cxCol + 2, galleryTop + 2, 1, galleryH - 4);
      c.fillStyle = '#e5c699'; c.fillRect(cxCol - 1, base - 5, 4, 2);
    }
    c.fillStyle = '#ecd0a4'; c.fillRect(x - 1, base - 3, w + 2, 2);
  } else if (kind === 'courtyard') {
    // Two-tier residence with carved cavetto lintel, shuttered windows & facade bench/amphora
    const doorH = 15;
    c.fillStyle = '#f5dcaf'; c.fillRect(doorX - 2, base - doorH - 2, doorW + 4, 2);
    c.fillStyle = '#a85844'; c.fillRect(doorX - 1, base - doorH - 1, doorW + 2, 1);
    c.fillStyle = '#46393f'; c.fillRect(doorX, base - doorH, doorW, doorH);
    c.fillStyle = '#6e4e44'; c.fillRect(doorX + 1, base - doorH + 1, 3, doorH - 2);
    c.fillStyle = '#c89b78'; c.fillRect(doorX + doorW, base - doorH, 1, doorH - 1);

    // Upper clerestory windows with wooden shutters & terracotta window-box ledges
    for (const wx of [x + 5, x + Math.floor(w * 0.34)]) {
      c.fillStyle = '#4e4046'; c.fillRect(wx, top + 8, 6, 7);
      c.fillStyle = '#7c5648'; c.fillRect(wx - 1, top + 8, 1, 7);
      c.fillStyle = '#7c5648'; c.fillRect(wx + 6, top + 8, 1, 7);
      c.fillStyle = '#e5c496'; c.fillRect(wx - 1, top + 15, 8, 1);
    }

    // Flush limestone mastaba bench & terracotta jar on left facade plinth (x + 4..x + 15)
    c.fillStyle = '#e8ca9e'; c.fillRect(x + 4, base - 5, 8, 2);
    c.fillStyle = '#8c705e'; c.fillRect(x + 5, base - 3, 6, 2);
    c.fillStyle = '#b86248'; c.fillRect(x + 13, base - 6, 3, 4);
    c.fillStyle = '#f0c496'; c.fillRect(x + 13, base - 7, 3, 1);
  } else {
    // Workshop or Harbor Storehouse: doorway with striped linen sun-awning & amphorae
    const doorH = 14;
    c.fillStyle = '#f2d4a4'; c.fillRect(doorX - 1, base - doorH - 1, doorW + 2, 1);
    c.fillStyle = '#483c44'; c.fillRect(doorX, base - doorH, doorW, doorH);
    c.fillStyle = '#6c4d44'; c.fillRect(doorX + 1, base - doorH + 1, Math.max(2, doorW - 3), doorH - 2);

    // Striped linen sun-awning (canopy) mounted cleanly above the doorway
    const awX = Math.max(x + 2, doorX - 3);
    const awW = Math.min(w - (awX - x) - 2, doorW + 6);
    const awY = base - doorH - 5;
    c.fillStyle = '#382d35'; c.fillRect(awX, awY + 3, awW, 1); // Canopy cast shadow on wall
    for (let sx = 0; sx < awW; sx++) {
      const stripe = Math.floor(sx / 2) % 2 === 0;
      c.fillStyle = stripe ? '#fff0c6' : (kind === 'workshop' ? '#b85a44' : '#46737e');
      c.fillRect(awX + sx, awY, 1, 3);
    }
    // Thin cedar support poles at awning corners
    c.fillStyle = '#705444';
    c.fillRect(awX, awY + 3, 1, doorH + 2);
    c.fillRect(awX + awW - 1, awY + 3, 1, doorH + 2);

    // Upper window on left half of facade
    c.fillStyle = '#56474f'; c.fillRect(x + 5, top + 8, 6, 7);
    c.fillStyle = '#e0b88a'; c.fillRect(x + 4, top + 15, 8, 1);

    // Pair of terracotta wine/grain amphorae resting flush against the left plinth (x + 4..x + 12)
    c.fillStyle = '#be684c'; c.fillRect(x + 4, base - 7, 3, 6);
    c.fillStyle = '#f2c89a'; c.fillRect(x + 4, base - 8, 3, 1);
    c.fillStyle = '#9e543e'; c.fillRect(x + 8, base - 6, 3, 5);
    c.fillStyle = '#e6b88a'; c.fillRect(x + 8, base - 7, 3, 1);
  }

  // 8. Crisp contact ambient occlusion at building base
  c.fillStyle = '#544349'; c.fillRect(x, base - 2, w, 1);
  c.fillStyle = '#382d33'; c.fillRect(x, base - 1, w, 1);
}

/**
 * 8 larger, well-proportioned buildings arranged across the brick-tiled Rhakotis peninsula:
 * - Upper Row (0..3): x = 526..752, base = 228..308
 * - Lower/Middle Row (4..7): x = 510..738, base = 286..430
 */
const BUILDINGS: readonly [number, number, number, number, number, 'storehouse' | 'stoa' | 'courtyard' | 'workshop'][] = [
  // Upper Row
  [526, 228, 34, 30, 12, 'storehouse'],
  [584, 246, 48, 36, 14, 'stoa'],
  [656, 274, 38, 36, 14, 'courtyard'],
  [714, 308, 38, 38, 14, 'workshop'],
  // Lower/Middle Row
  [510, 286, 36, 34, 13, 'workshop'],
  [566, 330, 40, 38, 14, 'courtyard'],
  [630, 378, 42, 40, 15, 'workshop'],
  [696, 430, 42, 44, 15, 'storehouse'],
];

function shore() {
  const { canvas, context: c } = surface();

  // Northern sea-wall Y helper: gentle continuous slope from (501, 177) to (768, 190)
  const northEdgeY = (x: number) => 177 + (Math.max(501, x) - 501) * (13 / 267);

  // 1. Submerged & wet stone foundation along BOTH the western quay edge and the northern headland edge
  polygon(c, [[501, 173], [768, 186], [768, 480], [694, 480], [469, 291], [463, 234]], '#3f444c');
  // 2. Cut-stone ashlar sea wall face along western and northern edges
  polygon(c, [[501, 175], [768, 188], [768, 480], [696, 480], [471, 289], [465, 232]], '#7c6a64');
  // 3. Main limestone harbor deck base
  polygon(c, [[501, 177], [768, 190], [768, 480], [718, 480], [477, 283], [470, 228]], '#c8aa88');

  // 4. Clean staggered stone/brick tile grid (ô gạch) across the entire village ground,
  // strictly clipped inside BOTH the western quay coping stone and the continuous northern coping border.
  const tileW = 22, tileH = 11;
  const tileShades = ['#c9ab89', '#c2a482', '#cfb18f', '#c6a886'] as const;
  for (let y = 180; y < 480; y++) {
    const minX = Math.ceil(quayEdge(y)) + 7;
    // Northern coping stone inner limit at row y
    const maxX = y < 194 ? Math.min(768, Math.floor(501 + (y - 181) * (267 / 13))) : 768;
    if (maxX <= minX) continue;

    const row = Math.floor((y - 178) / tileH);
    const ty = (y - 178) % tileH;
    const stagger = (row % 2) * (tileW >> 1);

    if (ty === 0) {
      c.fillStyle = '#a6896c';
      c.fillRect(minX, y, maxX - minX, 1);
      continue;
    }

    for (let x = minX; x < maxX;) {
      const shiftedX = x - 470 + stagger;
      const col = Math.floor(shiftedX / tileW);
      const tx = ((shiftedX % tileW) + tileW) % tileW;
      const span = Math.min(maxX - x, tileW - tx);

      c.fillStyle = tileShades[(row * 5 + col * 3) & 3];
      c.fillRect(x, y, span, 1);

      if (ty === 1 && span > 2) {
        c.fillStyle = '#d6b998';
        c.fillRect(x + (tx === 0 ? 1 : 0), y, span - (tx === 0 ? 1 : 0), 1);
      }

      if (tx === 0) {
        c.fillStyle = '#a6896c';
        c.fillRect(x, y, 1, 1);
      } else if (tx === 1 && ty > 1) {
        c.fillStyle = '#d4b796';
        c.fillRect(x, y, 1, 1);
      }

      x += span;
    }
  }

  // 5. Shaded sea-wall bevel wrapping continuously around the northern corner (501, 177) to x = 768
  polygon(c, [[501, 179], [470, 228], [477, 283], [718, 480], [708, 480], [469, 289], [463, 231], [496, 176]], '#5e555a');
  polygon(c, [[501, 175], [768, 188], [768, 190], [501, 177]], '#5e555a');

  // 6. Sunlit chamfered limestone coping stones wrapping continuously from the western quay all the way along the northern edge to x = 768 (no blunt cut!)
  polygon(c, [[501, 177], [470, 226], [478, 280], [720, 478], [725, 476], [483, 277], [475, 224], [505, 179]], '#edd5aa');
  polygon(c, [[501, 177], [768, 190], [768, 193], [501, 180]], '#edd5aa');
  for (let nx = 512; nx < 764; nx += 18) {
    const ny = Math.round(northEdgeY(nx));
    c.fillStyle = '#b59676';
    c.fillRect(nx, ny, 1, 3);
  }

  // Wet tide-line darkening & stone courses along the western sea wall
  for (let row = 228; row < 476; row += 3) {
    const edge = Math.round(quayEdge(row));
    c.fillStyle = row % 6 === 0 ? '#463f46' : '#584e52';
    c.fillRect(edge - 5, row, 5, 1);
    c.fillStyle = '#2d353e';
    c.fillRect(edge - 7, row + 2, 4, 2);
  }

  // Stone mooring bollards along the main limestone quay edge
  for (const by of [234, 294, 348, 398, 444]) {
    const bx = Math.round(quayEdge(by)) + 2;
    c.fillStyle = '#383238'; c.fillRect(bx - 2, by, 6, 2);
    c.fillStyle = '#6e5e58'; c.fillRect(bx, by - 5, 4, 5);
    c.fillStyle = '#f2d6a8'; c.fillRect(bx, by - 6, 4, 2);
  }

  // 7. Render 350 BCE Rhakotis buildings (painter's algorithm: Upper Row first, then Lower Row)
  BUILDINGS.forEach(([x, y, w, h, d, kind], i) => {
    house(c, x, y, w, h, d, i, kind);
  });

  return canvas;
}

function sky() {
  const { canvas, context: c } = surface();
  // Rich 32-band Mediterranean dawn sky: deep zenith indigo-slate to golden-apricot horizon
  const zenith = '#2c4a5e', midSky = '#6c96a6', lowSky = '#e6be98', horizonGlow = '#ffe8bc';
  const bands = 32, bandH = 6;
  const colors = Array.from({ length: bands }, (_, i) => {
    const t = i / (bands - 1);
    return t < 0.45
      ? mix(zenith, midSky, t / 0.45)
      : t < 0.78
        ? mix(midSky, lowSky, (t - 0.45) / 0.33)
        : mix(lowSky, horizonGlow, (t - 0.78) / 0.22);
  });

  for (let band = 0; band < colors.length; band++) {
    const y0 = band * bandH;
    c.fillStyle = colors[band];
    c.fillRect(0, y0, 768, bandH);
    if (band > 0) {
      c.fillStyle = colors[band - 1];
      for (let y = 0; y < 2; y++) {
        for (let x = (y * 2 + band) % 4; x < 768; x += 4) {
          c.fillRect(x, y0 + y, 1, 1);
        }
      }
    }
  }

  // Subtle fading morning stars in the high western sky
  c.fillStyle = '#e8dec8';
  for (const [sx, sy] of [[68, 22], [144, 16], [228, 28], [312, 14], [96, 42]]) {
    c.fillRect(sx, sy, 1, 1);
  }

  // Stepped dawn sun & warm atmospheric corona rings
  disk(c, DAWN_SUN.x, DAWN_SUN.y, 33, '#f7d4a2');
  disk(c, DAWN_SUN.x, DAWN_SUN.y, 26, '#ffe4b5');
  disk(c, DAWN_SUN.x, DAWN_SUN.y, 20, '#fff4cf');
  c.fillStyle = '#fff9e2';
  c.fillRect(DAWN_SUN.x - 12, DAWN_SUN.y - 6, 24, 12);

  // Horizon sea-mist & Distant Rhakotis / Pharos Island headland in atmospheric perspective
  c.fillStyle = '#d6d8c8'; c.fillRect(0, 162, 768, 8);
  c.fillStyle = '#f5e0bc'; c.fillRect(0, 161, 768, 1);

  // Western limestone headland & Pharos island ridge spanning the entire horizon (x = 0..768)
  polygon(c, [
    [0, 152], [54, 148], [116, 151], [178, 156], [238, 163],
    [295, 157], [375, 159], [460, 155], [768, 156], [768, 165], [0, 165],
  ], '#94aab0');
  polygon(c, [
    [0, 156], [62, 153], [134, 156], [198, 161], [238, 165], [0, 165],
  ], '#7d959e');
  c.fillStyle = '#dfc29c';
  c.fillRect(36, 148, 22, 1);
  c.fillRect(102, 151, 24, 1);
  c.fillRect(160, 155, 20, 1);

  // Western headland coastal watchtower & harbor storehouses (x = 18..164)
  const westBuildings: readonly [number, number, number, boolean][] = [
    [18, 14, 7, false],
    [38, 10, 13, true],
    [56, 15, 6, false],
    [78, 16, 7, false],
    [104, 14, 8, false],
    [126, 12, 6, false],
    [148, 15, 6, false],
  ];
  for (const [wx, ww, wh, isTower] of westBuildings) {
    const base = wx < 90 ? 151 : 154;
    c.fillStyle = '#869ea4';
    c.fillRect(wx, base - wh, ww, wh + 2);
    c.fillStyle = '#e5c69e';
    c.fillRect(wx, base - wh, ww, 1);
    c.fillRect(wx + ww - 2, base - wh + 1, 2, wh);
    if (isTower) {
      c.fillStyle = '#ffdf9e';
      c.fillRect(wx + ww - 2, base - wh - 2, 2, 2);
    }
  }

  // Distant coastal storehouses, walls & watchtower along the eastern Pharos/Rhakotis headland
  for (let i = 0; i < 22; i++) {
    const x = 330 + i * 20;
    const isTower = i === 4 || i === 13;
    const h = isTower ? 13 : 4 + (i * 7) % 8;
    const w = isTower ? 9 : 14 + (i % 3) * 3;
    c.fillStyle = i % 2 === 0 ? '#8fa6a8' : '#9bb0ae';
    c.fillRect(x, 164 - h, w, h + 2);
    c.fillStyle = '#dfc19a';
    c.fillRect(x, 164 - h, w, 1);
    if (isTower) {
      c.fillStyle = '#758c92';
      c.fillRect(x + w - 3, 164 - h + 1, 3, h);
    }
  }
  c.fillStyle = '#e8cfa6';
  c.fillRect(0, 166, 768, 1);

  return canvas;
}

function foreground() {
  const { canvas, context: c } = surface();

  // Close-plane cut-stone breakwater mole framing the bottom-left corner
  polygon(c, [[0, 398], [168, 418], [286, 442], [428, 480], [0, 480]], '#232e37');
  polygon(c, [[0, 392], [168, 412], [286, 436], [428, 476], [408, 480], [0, 480]], '#484546');
  polygon(c, [[0, 424], [212, 452], [286, 480], [0, 480]], '#1b242c');

  // Warm dawn rim-light catching the top chamfer of the foreground stone mole
  polygon(c, [[0, 391], [168, 411], [286, 435], [286, 437], [168, 413], [0, 393]], '#cfa87e');

  // Dressed ashlar blocks & joints along the foreground parapet
  for (let i = 0; i < 14; i++) {
    const x = i * 28, y = 400 + Math.floor(i * 5.2);
    c.fillStyle = '#6e5c54'; c.fillRect(x, y, 23, 2);
    c.fillStyle = '#32343a'; c.fillRect(x + 21, y + 3, 1, 18);
  }

  // Foreground stone mooring bollards on the western breakwater
  c.fillStyle = '#1b242c'; c.fillRect(38, 377, 10, 16);
  c.fillStyle = '#38373c'; c.fillRect(39, 377, 8, 15);
  c.fillStyle = '#d8b284'; c.fillRect(39, 376, 8, 2);

  c.fillStyle = '#1b242c'; c.fillRect(142, 391, 9, 14);
  c.fillStyle = '#38373c'; c.fillRect(143, 391, 7, 13);
  c.fillStyle = '#d8b284'; c.fillRect(143, 390, 7, 2);

  return canvas;
}

/** Mid-left cut-stone harbor breakwater & stone beacon obelisk (x = 0..130, y = 232..280) */
function drawWesternBreakwater(c: CanvasRenderingContext2D, px: number, py: number, time: number) {
  const ox = Math.round(px * 0.72), oy = Math.round(py * 0.72);

  // Water reflection of the western stone mole & beacon flame
  for (let r = 0; r < 14; r += 2) {
    const wy = 278 + r + oy;
    const shift = Math.round(Math.sin(wy * 0.4 + time * 1.4) * 2);
    c.globalAlpha = 0.20 - r * 0.012;
    c.fillStyle = r < 4 ? '#cfa982' : '#5c5558';
    c.fillRect(shift, wy, 124 - r * 3, 1);
    c.globalAlpha = (0.30 - r * 0.018) * (0.85 + 0.15 * Math.sin(time * 3.9));
    c.fillStyle = r < 6 ? '#ffe29a' : '#f0a858';
    c.fillRect(108 + shift + ox, wy, Math.max(2, 6 - Math.floor(r / 3)), 1);
  }
  c.globalAlpha = 1;

  // Shoreline swash along the western mole base
  for (let sx = 4; sx < 126; sx += 9) {
    const swell = Math.sin(sx * 0.18 - time * 0.9);
    c.globalAlpha = 0.22 + Math.max(0, swell) * 0.24;
    c.fillStyle = swell > 0.3 ? '#e4f4ea' : '#bde0d4';
    c.fillRect(sx + ox, 276 + Math.round(swell) + oy, 6, 1);
  }
  c.globalAlpha = 1;

  // Submerged stone foundation & ashlar sea wall of the western mole
  c.fillStyle = '#2d3740';
  c.fillRect(0, 274 + oy, 128 + ox, 3);
  polygon(c, [[0, 265 + oy], [126 + ox, 269 + oy], [130 + ox, 275 + oy], [0, 275 + oy]], '#685b58');
  polygon(c, [[0, 262 + oy], [124 + ox, 266 + oy], [126 + ox, 269 + oy], [0, 265 + oy]], '#c8a686');
  c.fillStyle = '#edd2a6';
  c.fillRect(0, 262 + oy, 124 + ox, 1);
  c.fillRect(92 + ox, 265 + oy, 33, 2);
  for (let mx = 10; mx < 118; mx += 16) {
    c.fillStyle = '#483f44';
    c.fillRect(mx + ox, 267 + oy, 1, 7);
  }

  // Stone harbor watch-post / customs shelter on the western mole (x = 18..46)
  const hx = 18 + ox, hy = 263 + oy, hw = 28, hh = 20;
  c.fillStyle = '#7e6a5c';
  c.fillRect(0, hy - 1, hx, 2);
  c.fillStyle = '#9c8878';
  c.fillRect(hx, hy - hh, hw, hh);
  c.fillStyle = '#dfc29b';
  c.fillRect(hx + 16, hy - hh, 12, hh);
  c.fillStyle = '#fff0c4';
  c.fillRect(hx + hw - 2, hy - hh, 2, hh);
  c.fillRect(hx - 1, hy - hh - 2, hw + 2, 2);
  c.fillStyle = '#483c44';
  c.fillRect(hx + 6, hy - 11, 5, 11);
  c.fillRect(hx + 20, hy - 14, 4, 6);

  // Tall Ptolemaic/Egyptian Harbor Beacon Obelisk at the mole tip (x = 106)
  const bx = 106 + ox, by = 266 + oy;
  c.fillStyle = '#584e52'; c.fillRect(bx - 3, by - 5, 14, 5);
  c.fillStyle = '#cbb094'; c.fillRect(bx - 1, by - 5, 12, 5);
  c.fillStyle = '#f2d8aa'; c.fillRect(bx + 8, by - 5, 3, 5);
  c.fillStyle = '#7c6e68'; c.fillRect(bx, by - 25, 8, 20);
  c.fillStyle = '#d2b48e'; c.fillRect(bx + 3, by - 25, 5, 20);
  c.fillStyle = '#fff0c4'; c.fillRect(bx + 6, by - 25, 2, 20);
  c.fillStyle = '#edd2a4'; c.fillRect(bx - 1, by - 27, 10, 2);
  c.fillStyle = '#ba704c'; c.fillRect(bx + 1, by - 30, 6, 3);
  const flicker = Math.sin(time * 4.5);
  c.globalAlpha = 0.18 + flicker * 0.04;
  disk(c, bx + 4, by - 32, 9, '#ffdc96');
  c.globalAlpha = 0.28 + flicker * 0.05;
  disk(c, bx + 4, by - 32, 5, '#ffe8b0');
  c.globalAlpha = 1;
  c.fillStyle = '#f6ce8c'; c.fillRect(bx + 2, by - 32, 4, 2);
  c.fillStyle = '#fff8dc'; c.fillRect(bx + 3 + (flicker > 0.2 ? 1 : 0), by - 34, 2, 2);
}

// Coastal buildings close enough to the quay edge to cast vertical water reflections
const COASTAL_REFLECTORS = [
  BUILDINGS[0],
  BUILDINGS[4],
  BUILDINGS[5],
  BUILDINGS[6],
  BUILDINGS[7],
] as const;

export function createCoastalScene(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return null;
  const c = context;
  canvas.width = COAST_SIZE.width; canvas.height = COAST_SIZE.height;
  c.imageSmoothingEnabled = false;

  const backdrop = sky(), settlement = shore(), near = foreground();
  const nearBoats = art.shipFrames.map(sprite);
  const midBoats = buildScaledShipFrames(3, 5); // Crisp 30x46 integer-grid mid-bay ship
  const farBoats = buildScaledShipFrames(1, 3); // Crisp 17x26 integer-grid horizon ship
  const people = art.actors.map(actor => actor.frames.map(sprite));
  const walkers = buildWalkerFrames();
  const water = createDawnWater();

  // Fixed bounded pools: no particles or sprite objects allocated during animation.
  const dust = Array.from({ length: 28 }, (_, i) => ({
    x: 340 + (i * 83) % 410,
    y: 70 + (i * 41) % 340,
    phase: i * 2.73,
    size: i % 5 === 0 ? 2 : 1,
  }));

  // 4 warm oil lamps / harbor braziers placed strictly on the limestone quay coping edge
  const lamps = [
    { x: 476, y: 244, waterY: 252 }, // Northern quay coping brazier
    { x: 516, y: 304, waterY: 314 }, // Mid-north quay coping brazier
    { x: 576, y: 356, waterY: 366 }, // Mid-south quay coping brazier
    { x: 616, y: 236, waterY: 0 },   // Inside Upper Colonnaded Stoa gallery
  ] as const;

  // Obstacle-free pedestrian promenade walking along the western harbor quay
  const quayWalkers = [
    { speed: 0.0080, offset: 0.08, outfit: 0, laneOffset: -2 },
    { speed: -0.0090, offset: 0.36, outfit: 1, laneOffset: 3 },
    { speed: 0.0072, offset: 0.64, outfit: 2, laneOffset: -1 },
    { speed: -0.0078, offset: 0.88, outfit: 3, laneOffset: 2 },
  ] as const;

  let cameraX = 0, cameraY = 0;

  function draw(time: number, pointerX = 0, pointerY = 0) {
    cameraX += (pointerX - cameraX) * 0.065;
    cameraY += (pointerY - cameraY) * 0.065;
    const px = Math.round(cameraX * 5), py = Math.round(cameraY * 3);

    c.fillStyle = '#1d3c48';
    c.fillRect(0, 0, 768, 480);

    // 1. Sky dome & distant headland (0.2x parallax)
    c.drawImage(backdrop, Math.round(px * 0.2), Math.round(py * 0.2));

    // 2. Software-shaded Mediterranean dawn sea
    c.drawImage(water.draw(time), 0, 170, 768, 310);

    // 3. Vertically aligned water reflections of coastal buildings (strictly vertical X column, no diagonal skew)
    for (const [bx, base, bw, bh] of COASTAL_REFLECTORS) {
      const reflRows = Math.min(26, Math.round(bh * 0.6));
      const baseEdge = Math.floor(quayEdge(base));
      for (let r = 1; r < reflRows; r++) {
        const wy = base + 4 + r;
        if (wy >= 478) break;
        const waterLimit = Math.floor(quayEdge(wy)) - 5;
        const waveShift = Math.round(Math.sin(wy * 0.38 - time * 1.45 + bx * 0.07) * (1.2 + r * 0.08));
        // Anchor horizontally to baseEdge so the reflection drops vertically into the water
        const rx = baseEdge - bw + 6 + waveShift;
        const rw = Math.min(bw - 4, waterLimit - rx);
        if (rw <= 2) continue;
        if (r > reflRows * 0.55 && (r + Math.floor(time * 3)) % 2 === 1) continue;
        const fade = (1 - r / reflRows) * 0.20;
        c.globalAlpha = fade;
        c.fillStyle = r < 4 ? '#f5dca8' : (r % 6 === 0 ? '#8c7868' : '#d2b48e');
        c.fillRect(rx + px, wy + py, rw, 1);
      }
    }

    // Sea-wall masonry reflection band immediately below the coping stones in the water
    for (let row = 228; row < 466; row += 2) {
      const edge = Math.round(quayEdge(row));
      const shift = Math.round(Math.sin(row * 0.31 - time * 1.2) * 2);
      c.globalAlpha = 0.18;
      c.fillStyle = '#a8927c';
      c.fillRect(edge - 14 + shift + px, row + 2 + py, 10, 1);
      c.globalAlpha = 0.12;
      c.fillStyle = '#e0c49c';
      c.fillRect(edge - 22 + shift + px, row + 4 + py, 8, 1);
    }

    // Warm golden brazier reflections dancing vertically in the water below each harbor lamp
    for (const lamp of lamps) {
      if (!lamp.waterY) continue;
      const baseRx = quayEdge(lamp.waterY) - 9;
      for (let r = 0; r < 14; r += 2) {
        const wy = lamp.waterY + r;
        const shift = Math.round(Math.sin(wy * 0.45 + time * 2.1) * 2);
        c.globalAlpha = (0.28 - r * 0.016) * (0.85 + 0.15 * Math.sin(time * 3.7 + lamp.x));
        c.fillStyle = r < 6 ? '#ffe29a' : '#f0a858';
        c.fillRect(Math.round(baseRx - r * 0.2 + shift + px), wy + py, Math.max(2, 6 - Math.floor(r / 3)), 1);
      }
    }
    c.globalAlpha = 1;

    // 4. Shoreline swash, foam & refracted caustic glints along the sea-wall
    for (let row = 226; row < 466; row += 3) {
      const edge = quayEdge(row);
      const swell = Math.sin(row * 0.22 - time * 0.78);
      c.globalAlpha = 0.18 + Math.max(0, swell) * 0.26;
      c.fillStyle = swell > 0.35 ? '#e4f4ea' : '#bde0d4';
      c.fillRect(
        Math.round(edge - 5 + swell * 2 + px),
        row + py,
        3 + Math.round(Math.max(0, swell) * 4),
        1,
      );
    }
    c.globalAlpha = 1;

    // 5. Layered dawn clouds drifting at independent speeds
    cloud(c, 48 + Math.round(Math.sin(time * 0.019 + 0.5) * 12 + px * 0.22), 62, 92, true);
    cloud(c, 405 + Math.round(Math.sin(time * 0.025) * 14 + px * 0.25), 48, 84, true);
    cloud(c, 618 + Math.round(Math.sin(time * 0.018 + 1) * 18 + px * 0.2), 78, 104, true);
    cloud(c, 198 + Math.round(Math.sin(time * 0.021 + 2) * 15 + px * 0.18), 96, 68, false);
    cloud(c, 488 + Math.round(Math.sin(time * 0.015 + 3) * 12 + px * 0.22), 118, 62, true);

    // 5b. Mid-left cut-stone harbor breakwater, watch-post & beacon obelisk
    drawWesternBreakwater(c, px, py, time);

    // 6. Three sailing vessels at crisp 1:1 integer pixel scales (horizon, mid-bay, foreground)
    const fleet = [
      { frames: farBoats, x: 204, y: 162, range: 12, speed: 0.021, parallax: 0.35 },
      { frames: midBoats, x: 144, y: 196, range: 14, speed: 0.018, parallax: 0.55 },
      { frames: nearBoats, x: 158, y: 292, range: 18, speed: 0.012, parallax: 0.75 },
    ] as const;

    for (let i = 0; i < fleet.length; i++) {
      const vessel = fleet[i];
      const bx = Math.round(vessel.x + Math.sin(time * vessel.speed + i * 1.4) * vessel.range + px * vessel.parallax);
      const by = Math.round(vessel.y + Math.sin(time * 0.65 + i * 2.1) * 1.2 + py * vessel.parallax);
      const image = vessel.frames[Math.floor(time * (2.6 + i * 0.4) + i) % vessel.frames.length];
      const base = by + image.height;

      // Water contact shadow
      c.globalAlpha = 0.24;
      c.fillStyle = '#162836';
      c.fillRect(bx - 4, base + 1, image.width + 8, 3);

      // Vertically inverted & wave-displaced water-strip hull & sail reflection
      c.globalAlpha = 0.20;
      for (let row = 0; row < image.height; row += 3) {
        const dy = Math.round(base + 2 + (image.height - 1 - row) * 0.34);
        const shift = Math.round(Math.sin(dy * 0.37 - time * 1.35) * 2);
        c.drawImage(image, 0, row, image.width, 3, bx + shift, dy, image.width, 1);
      }

      // Crisp 1:1 integer pixel vessel draw
      c.globalAlpha = 1;
      c.drawImage(image, bx, by);

      // V-shaped bow and stern wakes
      for (let w = 0; w < 4; w++) {
        c.globalAlpha = 0.32 - w * 0.06;
        c.fillStyle = w === 0 ? '#e4f2e8' : '#b8dcd0';
        c.fillRect(
          bx - 4 - w * 3,
          Math.round(base + w * 2 + Math.sin(time * 0.85 + w)),
          image.width + 8 + w * 6,
          1,
        );
      }
      c.globalAlpha = 1;
    }

    // 7. Main Rhakotis harbor settlement & brick-tiled limestone peninsula
    c.drawImage(settlement, px, py);

    // Refracted water caustic glints dancing up onto the lower sea-wall masonry
    for (let row = 240; row < 452; row += 5) {
      c.globalAlpha = Math.max(0, Math.sin(row * 0.21 + time * 0.82)) * 0.16;
      c.fillStyle = '#eff4ca';
      c.fillRect(Math.round(quayEdge(row) - 4 + px), row + py, 4, 1);
    }
    c.globalAlpha = 1;

    // 8. Warm flickering terracotta oil lamps & harbor braziers
    for (let i = 0; i < lamps.length; i++) {
      const lamp = lamps[i];
      const lx = lamp.x + px, ly = lamp.y + py;
      const flicker = Math.sin(time * 4.2 + i * 1.9);
      c.globalAlpha = 0.14 + flicker * 0.03;
      disk(c, lx + 2, ly, 9, '#ffdc96');
      c.globalAlpha = 0.24 + flicker * 0.05;
      disk(c, lx + 2, ly - 1, 5, '#ffe8b0');
      c.globalAlpha = 1;
      c.fillStyle = '#ba704c'; c.fillRect(lx, ly, 5, 2);
      c.fillStyle = '#65503e'; c.fillRect(lx + 1, ly + 2, 3, 2);
      c.fillStyle = '#f6ce8c'; c.fillRect(lx + 1, ly - 2, 3, 2);
      c.fillStyle = '#fff6d6'; c.fillRect(lx + 2 + (flicker > 0.3 ? 1 : 0), ly - 3, 1, 2);
    }

    // 9. Inhabitants strolling along the western harbor promenade
    for (let i = 0; i < quayWalkers.length; i++) {
      const w = quayWalkers[i];
      const progress = ((time * w.speed + w.offset) % 1 + 1) % 1;
      const frameIdx = Math.floor(time * 4.2 + i * 1.7) % 4;
      const spriteFrame = walkers[w.outfit][frameIdx];
      const y = Math.round(284 + progress * 158);
      const walkX = Math.round(quayEdge(y)) + 19 + w.laneOffset;
      c.globalAlpha = 0.36;
      c.fillStyle = '#2d2c36';
      c.fillRect(walkX + 1 + px, y - 1 + py, 10, 2);
      c.globalAlpha = 1;
      c.drawImage(spriteFrame, walkX + px, y - spriteFrame.height + py);
    }

    // Southern plaza citizen at matching village scale (17px tall, unobstructed on open stone tiles)
    const citizen = walkers[0][Math.floor(time * 2.2) % 4];
    const cx = 672 + px, cy = 452 + py;
    c.globalAlpha = 0.36; c.fillStyle = '#2d2c36'; c.fillRect(cx + 1, cy - 1, 10, 2);
    c.globalAlpha = 1;
    c.drawImage(citizen, cx, cy - citizen.height);

    // 12. Seabirds wheeling over the bay in 3-frame wing cadence
    for (let i = 0; i < 4; i++) {
      const x = Math.round(430 + ((time * (5.5 + i * 0.6) + i * 53) % 310));
      const y = Math.round(82 + i * 11 + Math.sin(time * 0.45 + i) * 3);
      const flap = [0, 1, 0, -1][Math.floor(time * 4.2 + i) % 4];
      c.fillStyle = '#43515e';
      c.fillRect(x, y, 2, 1);
      c.fillRect(x - 2, y - 1 - flap, 2, 1);
      c.fillRect(x + 2, y - 1 - flap, 2, 1);
    }

    // 13. Subtle atmospheric morning glow above the horizon (no diagonal water streaks)
    for (let ray = 0; ray < 3; ray++) {
      const pulse = 0.018 + 0.008 * Math.sin(time * 0.35 + ray * 2.1);
      c.globalAlpha = pulse;
      const rx = DAWN_SUN.x - 10 + ray * 14 + Math.round(px * 0.25);
      const ry = DAWN_SUN.y + 4 + Math.round(py * 0.25);
      polygon(c, [
        [rx - 6, ry],
        [rx + 10, ry],
        [rx - 36 + ray * 22, 174],
        [rx - 64 + ray * 22, 174],
      ], '#ffe6b0');
    }
    c.globalAlpha = 1;

    // 14. Foreground breakwater mole (1.8x parallax depth framing)
    const fx = Math.round(px * 1.8), fy = Math.round(py * 1.8);
    c.drawImage(near, fx, fy);

    // 15. Sunlit airborne dust motes drifting through the morning light
    for (const p of dust) {
      const alpha = Math.max(0, Math.sin(time * 0.48 + p.phase)) * 0.42;
      if (alpha <= 0.02) continue;
      c.globalAlpha = alpha;
      c.fillStyle = p.size > 1 ? '#ffeab8' : '#f9d29b';
      const dx = Math.round(p.x + Math.sin(time * 0.22 + p.phase) * 10 + px * 0.9);
      const dy = Math.round(p.y - ((time * 1.1 + p.phase * 7) % 26) + py * 0.9);
      c.fillRect(dx, dy, p.size, p.size);
    }
    c.globalAlpha = 1;
  }

  return {
    draw,
    dispose() {
      for (const image of [
        backdrop, settlement, near,
        ...nearBoats, ...midBoats, ...farBoats,
        ...people.flat(), ...walkers.flat(),
      ]) {
        image.width = 0;
        image.height = 0;
      }
      water.dispose();
    },
  };
}
