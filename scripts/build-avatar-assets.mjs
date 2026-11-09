/** Reproducible 32×40 pixel portraits. The original legacy assets are untouched. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const base = new URL("../public/assets/pixel/", import.meta.url);
const P = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")).palette;
const STAGES = ["infant", "child", "youth", "adult", "middle", "elder"];
const SEXES = ["male", "female"];
const ORIGINS = [
  { id: "merchant-household", title: "Merchant household", background: P.sand, accent: P.gold, motif: "accounts" },
  { id: "artisan-household", title: "Pottery-worker household", background: P.pale, accent: P.clay, motif: "pots" },
  { id: "harbor-household", title: "Quay-laborer household", background: P.mist, accent: P.navy, motif: "quay" },
  { id: "fishing-household", title: "Fishing household", background: P.teal, accent: P.sea, motif: "net" },
  { id: "bakery-household", title: "Bakery household", background: P.pale, accent: P.red, motif: "oven" },
  { id: "clerk-household", title: "Clerk's household", background: P.cream, accent: P.navy, motif: "papyrus" },
  { id: "weaver-household", title: "Weaving household", background: P.mist, accent: P.red, motif: "loom" },
  { id: "delta-newcomers", title: "Newcomers from the Delta", background: P.mist, accent: P.olive, motif: "reeds" },
];

function surface(width = 32, height = 40, fill = P.cream) {
  const pixels = Array.from({ length: height }, () => Array(width).fill(fill));
  const put = (x, y, color) => { if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height) pixels[y][x] = color; };
  const rect = (x, y, w, h, color) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, color); };
  const line = (x0, y0, x1, y1, color) => {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) { put(x0, y0, color); if (x0 === x1 && y0 === y1) break; const e = 2 * error; if (e >= dy) { error += dy; x0 += sx; } if (e <= dx) { error += dx; y0 += sy; } }
  };
  return { width, height, pixels, put, rect, line };
}

function backdrop(s, origin) {
  s.rect(1, 1, 30, 38, origin.background);
  s.rect(2, 2, 28, 35, P.cream);
  s.rect(3, 3, 26, 26, origin.background);
  s.rect(3, 29, 26, 8, P.stone);
  const x = 4, y = 5;
  if (origin.motif === "accounts") {
    s.rect(x, y, 5, 9, P.wood); s.rect(x + 1, y + 1, 3, 7, P.pale);
    for (const yy of [y + 2, y + 4, y + 6]) s.rect(x + 1, yy, 2, 1, P.brown);
    s.rect(25, 21, 3, 1, P.gold); s.rect(24, 23, 4, 1, P.gold);
  } else if (origin.motif === "pots") {
    s.rect(x, y + 4, 5, 5, P.clay); s.rect(x + 1, y + 2, 3, 2, P.clay); s.rect(x, y + 2, 5, 1, P.wood);
    s.rect(25, 18, 3, 5, P.clay); s.rect(24, 23, 5, 1, P.wood);
  } else if (origin.motif === "quay") {
    s.rect(x, y, 1, 17, P.wood); s.line(x + 1, y + 2, x + 4, y + 6, P.wood);
    s.rect(3, 24, 26, 4, P.sea); s.rect(4, 25, 5, 1, P.mist); s.rect(24, 27, 4, 1, P.teal);
    s.rect(25, 16, 3, 8, P.stone); s.rect(24, 15, 5, 2, P.pale);
  } else if (origin.motif === "net") {
    for (const xx of [4, 6, 8]) s.rect(xx, y, 1, 13, P.wood);
    for (const yy of [y + 1, y + 4, y + 7, y + 10]) s.rect(4, yy, 5, 1, P.wood);
    s.rect(3, 24, 26, 4, P.sea); s.rect(24, 25, 4, 1, P.mist);
    s.line(25, 7, 27, 12, P.wood); s.line(27, 12, 25, 16, P.wood);
  } else if (origin.motif === "oven") {
    s.rect(3, 8, 7, 15, P.clay); s.rect(4, 6, 5, 2, P.clay); s.rect(5, 5, 3, 1, P.clay);
    s.rect(5, 13, 3, 8, P.brown); s.rect(5, 19, 3, 1, P.pale); s.put(6, 17, P.gold);
    s.rect(24, 21, 5, 2, P.wood); s.rect(25, 19, 3, 2, P.sand); s.put(26, 19, P.cream);
  } else if (origin.motif === "papyrus") {
    s.rect(x, y, 5, 14, P.pale); s.rect(x, y, 5, 2, P.wood); s.rect(x, y + 12, 5, 2, P.wood);
    for (const yy of [y + 4, y + 7, y + 10]) s.rect(x + 1, yy, 3, 1, P.brown);
    s.rect(25, 17, 3, 5, P.navy); s.line(26, 18, 28, 11, P.wood);
  } else if (origin.motif === "loom") {
    s.rect(3, 5, 1, 20, P.wood); s.rect(9, 5, 1, 20, P.wood); s.rect(3, 5, 7, 1, P.wood);
    for (const xx of [5, 7]) s.rect(xx, 6, 1, 17, P.cream);
    for (const yy of [10, 12, 14, 16]) s.rect(4, yy, 5, 1, yy % 4 ? P.red : P.navy);
    s.rect(25, 21, 3, 5, P.red); s.rect(24, 20, 5, 1, P.wood);
  } else {
    s.rect(3, 24, 26, 4, P.teal);
    for (const [xx, height] of [[4, 14], [7, 18], [26, 12], [28, 16]]) {
      s.rect(xx, 26 - height, 1, height, P.olive); s.rect(xx - 1, 23 - height, 3, 4, P.wood);
      s.line(xx, 20, xx + (xx % 2 ? 2 : -2), 16, P.leaf);
    }
  }
  s.rect(1, 1, 30, 1, origin.accent); s.rect(1, 37, 30, 2, origin.accent);
}

/** The variant's skin, face proportions and hair arrangement stay fixed for life. */
function portrait(origin, sex, stage, variant) {
  const s = surface(), skin = [P.skin, P.light, P.deep][variant];
  const cloth = [P.navy, P.olive, P.clay][variant];
  const baseHair = [P.hair, P.brown, P.hair][variant];
  const elder = stage === "elder", middle = stage === "middle", child = stage === "child", youth = stage === "youth";
  const hair = elder ? P.grey : baseHair;
  backdrop(s, origin);
  if (stage === "infant") {
    s.rect(10, 12, 12, 11, skin); s.rect(12, 10, 8, 3, skin);
    s.rect(12, 11, variant === 1 ? 6 : 4, 1, baseHair); s.put(12, 16, P.ink); s.put(19, 16, P.ink);
    s.rect(15, 20, 2, 1, P.brown); if (variant === 2) s.put(16, 11, baseHair);
    s.rect(8, 22, 16, 10, cloth); s.rect(10, 31, 12, 4, cloth);
    s.line(9, 23, 23, 31, P.cream); s.line(10, 31, 22, 23, origin.accent);
    s.rect(6, 34, 20, 2, P.wood); s.rect(6, 30, 2, 7, P.wood); s.rect(24, 30, 2, 7, P.wood);
    // A swaddled infant's sex is recorded in the birth UI, rather than encoded
    // through colour. The tiny arrangement difference keeps the set distinct.
    s.put(sex === "female" ? 18 : 17, 11, baseHair);
  } else {
    const top = child ? 9 : youth || elder ? 6 : 4, x = child ? 11 : 10, w = child ? 10 : 12;
    const neck = top + 16, shoulder = top + 19;
    // Hair behind the face: variants are bun, side braid and short rounded hair.
    if (sex === "female") {
      if (variant === 0) { s.rect(x - 2, top + 1, w + 4, 14, hair); s.rect(x + 3, top - 2, 6, 4, hair); }
      else if (variant === 1) { s.rect(x - 1, top + 1, w + 3, 14, hair); s.rect(x + w, top + 8, 2, child ? 10 : 14, hair); s.put(x + w, top + 18, P.cream); }
      else { s.rect(x - 1, top, w + 2, 11, hair); s.rect(x - 2, top + 3, 2, 8, hair); s.rect(x + w, top + 3, 2, 8, hair); }
    }
    s.rect(x + 2, neck - 1, w - 4, 5, skin);
    s.rect(child ? 8 : 6, shoulder + 3, child ? 16 : 20, 37 - shoulder - 3, cloth);
    s.rect(child ? 10 : 8, shoulder + 1, child ? 12 : 16, 4, cloth);
    s.rect(x + 1, shoulder, w - 2, 3, cloth);
    s.line(x + 1, shoulder, 16, shoulder + 7, P.cream); s.line(x + w - 2, shoulder, 16, shoulder + 7, P.cream);
    s.rect(16, shoulder + 7, 1, Math.max(0, 37 - shoulder - 7), origin.accent);
    s.rect(child ? 8 : 6, 34, child ? 16 : 20, 1, origin.accent);
    s.rect(x, top + 3, w, 12, skin); s.rect(x + 2, top + 1, w - 4, 3, skin);
    s.rect(x + 1, top, w - 2, 3, hair); s.rect(x, top + 2, w, 3, hair);
    if (sex === "male") {
      if (variant === 0) { s.rect(x, top + 4, 2, 3, hair); s.rect(x + w - 2, top + 4, 2, 3, hair); s.put(x + 3, top - 1, hair); }
      if (variant === 1) { s.rect(x + 1, top + 3, 5, 2, hair); s.rect(x, top + 4, 1, 5, hair); s.rect(x + w - 1, top + 4, 1, 4, hair); }
      if (variant === 2) { s.rect(x, top - 1, w, 4, hair); s.rect(x - 1, top + 2, 2, 5, hair); s.rect(x + w - 1, top + 2, 2, 5, hair); }
    } else {
      if (variant === 0) { s.rect(x, top + 3, 2, 5, hair); s.rect(x + w - 2, top + 3, 2, 5, hair); }
      if (variant === 1) { s.rect(x + 1, top + 3, 5, 2, hair); s.rect(x + w - 2, top + 3, 2, 8, hair); }
      if (variant === 2) { s.rect(x, top + 2, w, 2, origin.accent); s.rect(x, top + 4, 2, 5, hair); s.rect(x + w - 2, top + 4, 2, 5, hair); }
    }
    s.rect(x - 1, top + 8, 1, 3, skin); s.rect(x + w, top + 8, 1, 3, skin);
    const eyeShift = variant === 1 ? 1 : 0;
    s.put(x + 3, top + 8 + eyeShift, P.ink); s.put(x + w - 4, top + 8 + eyeShift, P.ink);
    s.rect(x + (variant === 2 ? 5 : 6), top + 9, 1, 2, variant === 2 ? P.brown : P.deep);
    s.rect(x + 4, top + 13, w - 8 || 2, 1, P.brown);
    if (!child && !youth && sex === "male" && variant !== 1) {
      s.rect(x + 2, top + 12, 2, 2, hair); s.rect(x + w - 4, top + 12, 2, 2, hair);
      if (variant === 0) { s.rect(x + 3, top + 14, w - 6, elder ? 3 : 2, hair); s.rect(x + 4, top + 13, w - 8, 1, P.brown); }
    }
    if (middle) { s.put(x, top + 4, P.grey); s.put(x + w - 1, top + 4, P.grey); if (sex === "female" && variant === 1) s.put(x + w, top + 12, P.grey); }
    if (elder) { s.rect(x + 1, top + 7, 3, 1, P.stone); s.rect(x + w - 4, top + 7, 3, 1, P.stone); s.put(x + 2, top + 11, P.stone); s.put(x + w - 3, top + 11, P.stone); }
  }
  s.rect(0, 0, 32, 1, P.wood); s.rect(0, 39, 32, 1, P.wood); s.rect(0, 0, 1, 40, P.wood); s.rect(31, 0, 1, 40, P.wood);
  return s;
}

function svg(s, title) {
  const rects = [], active = new Map();
  for (let y = 0; y < s.height; y++) {
    const seen = new Set();
    for (let x = 0; x < s.width;) {
      const color = s.pixels[y][x]; let end = x + 1; while (end < s.width && s.pixels[y][end] === color) end++;
      const key = `${x}:${end - x}:${color}`, previous = active.get(key);
      if (previous && previous.y + previous.h === y) previous.h++;
      else { const item = { x, y, w: end - x, h: 1, color }; rects.push(item); active.set(key, item); }
      seen.add(key); x = end;
    }
    for (const key of active.keys()) if (!seen.has(key)) active.delete(key);
  }
  const groups = [...new Set(Object.values(P))].map(color => {
    const cells = rects.filter(rect => rect.color === color);
    return cells.length ? `<g fill="${color}">${cells.map(rect => `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/>`).join("")}</g>` : "";
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" shape-rendering="crispEdges" role="img"><title>${title}</title>${groups}</svg>\n`;
}

const assets = [];
for (const origin of ORIGINS) for (const sex of SEXES) for (let variant = 0; variant < 3; variant++) for (const stage of STAGES) {
  const path = `portraits/${origin.id}/${sex}/${stage}-${variant}.svg`;
  const s = portrait(origin, sex, stage, variant);
  const title = `Fictional ${sex} ${stage} portrait, ${origin.title.toLowerCase()}, avatar ${variant + 1}`;
  const destination = fileURLToPath(new URL(path, base));
  mkdirSync(fileURLToPath(new URL(`portraits/${origin.id}/${sex}/`, base)), { recursive: true });
  writeFileSync(destination, svg(s, title));
  assets.push({ path: `/assets/pixel/${path}`, title, originId: origin.id, sex, stage, variant, width: 32, height: 40, surface: s });
}
writeFileSync(new URL("avatar-manifest.json", base), `${JSON.stringify({ generator: "scripts/build-avatar-assets.mjs", origins: ORIGINS.map(({ id, title }) => ({ id, title })), sexes: SEXES, variants: [0, 1, 2], stages: STAGES, assets: assets.map(({ surface: _surface, ...asset }) => asset) }, null, 2)}\n`);

// Contact sheets are rendered from the delivery pixels, not separate artwork.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4); length.writeUInt32BE(data.length); let crc = 0xffffffff;
  for (const b of Buffer.concat([name, data])) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const sum = Buffer.alloc(4); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, sum]);
}
function png(s, scale = 4) {
  const width = s.width * scale, height = s.height * scale, raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const color = s.pixels[Math.floor(y / scale)][Math.floor(x / scale)], at = y * (width * 4 + 1) + 1 + x * 4; raw[at] = parseInt(color.slice(1, 3), 16); raw[at + 1] = parseInt(color.slice(3, 5), 16); raw[at + 2] = parseInt(color.slice(5, 7), 16); raw[at + 3] = 255; }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function draw(s, item, x, y) { for (let yy = 0; yy < 40; yy++) for (let xx = 0; xx < 32; xx++) s.put(x + xx, y + yy, item.surface.pixels[yy][xx]); }
const previewRoot = new URL("../artifacts/", import.meta.url); mkdirSync(previewRoot, { recursive: true });
for (const origin of ORIGINS) {
  const sheet = surface(6 * 36 + 4, 6 * 44 + 4, P.ink);
  for (const item of assets.filter(item => item.originId === origin.id)) draw(sheet, item, 4 + STAGES.indexOf(item.stage) * 36, 4 + (SEXES.indexOf(item.sex) * 3 + item.variant) * 44);
  writeFileSync(new URL(`avatars-${origin.id}.png`, previewRoot), png(sheet));
}
const adults = surface(ORIGINS.length * 36 + 4, 6 * 44 + 4, P.ink);
for (const item of assets.filter(item => item.stage === "adult")) draw(adults, item, 4 + ORIGINS.findIndex(origin => origin.id === item.originId) * 36, 4 + (SEXES.indexOf(item.sex) * 3 + item.variant) * 44);
writeFileSync(new URL("avatar-adult-pool.png", previewRoot), png(adults));
console.log(`Generated ${assets.length} origin/sex/variant/stage pixel SVGs. Legacy portraits unchanged. Contact sheets saved under artifacts/.`);
