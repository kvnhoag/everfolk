/** Original, editable pixel artwork. All delivery SVG geometry is integer rects. */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

export const PALETTE = {
  ink: "#263b43", dark: "#3e4d4d", night: "#293c58", navy: "#41637b",
  sea: "#4e8f9a", teal: "#76b5b1", mist: "#b8d2c4", cream: "#f5e6bf",
  sand: "#d6b778", stone: "#baa47a", pale: "#edcf91", wood: "#886447",
  brown: "#65503e", clay: "#ba704c", red: "#8c4947", gold: "#e4b651",
  olive: "#6b8051", leaf: "#9ca968", skin: "#bf8b62", light: "#d9a579",
  deep: "#91644c", hair: "#483d38", grey: "#adb4a6", white: "#fff2d1",
};
const P = PALETTE;
const root = fileURLToPath(new URL("../public/assets/pixel/", import.meta.url));
const assets = [];

function surface(width = 64, height = 48, background = P.cream) {
  const pixels = Array.from({ length: height }, () => Array(width).fill(background));
  const put = (x, y, color) => { if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height) pixels[y][x] = color; };
  const rect = (x, y, w, h, color) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, color); };
  const line = (x0, y0, x1, y1, color) => {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) { put(x0, y0, color); if (x0 === x1 && y0 === y1) break; const e = 2 * error; if (e >= dy) { error += dy; x0 += sx; } if (e <= dx) { error += dx; y0 += sy; } }
  };
  const poly = (points, color) => {
    const lo = Math.floor(Math.min(...points.map(p => p[1]))), hi = Math.ceil(Math.max(...points.map(p => p[1])));
    for (let y = lo; y <= hi; y++) {
      const intersections = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i], b = points[j];
        if ((a[1] > y) !== (b[1] > y)) intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) rect(Math.ceil(intersections[i]), y, Math.floor(intersections[i + 1]) - Math.ceil(intersections[i]) + 1, 1, color);
    }
  };
  return { width, height, pixels, put, rect, line, poly };
}

function clouds(s, sunset = false) {
  s.rect(0, 0, 64, 28, sunset ? P.pale : P.mist);
  s.rect(3, 7, 15, 2, P.cream); s.rect(6, 5, 8, 2, P.cream);
  s.rect(35, 4, 15, 2, P.cream); s.rect(40, 2, 7, 2, P.cream);
  s.rect(53, 10, 8, 2, sunset ? P.sand : P.teal);
  s.rect(24, 11, 3, 1, P.navy); s.put(23, 10, P.navy); s.put(27, 10, P.navy);
}
function ground(s, y = 35) {
  s.rect(0, y, 64, 48 - y, P.sand); s.rect(0, y, 64, 2, P.pale);
  for (const [x, yy, w] of [[2, 42, 6], [19, 38, 5], [40, 44, 7], [51, 40, 5]]) s.rect(x, yy, w, 1, P.stone);
}
function wall(s) {
  s.rect(0, 0, 64, 48, P.pale); s.rect(0, 0, 64, 3, P.stone);
  for (let y = 8; y < 32; y += 8) { s.rect(0, y, 64, 1, P.sand); for (let x = (y % 16 ? 8 : 0); x < 64; x += 16) s.rect(x, y - 7, 1, 7, P.sand); }
  s.rect(0, 34, 64, 14, P.stone); s.rect(0, 34, 64, 2, P.sand);
  s.rect(0, 44, 64, 1, P.sand); s.rect(18, 36, 1, 8, P.sand); s.rect(46, 44, 1, 4, P.brown);
}
function windowAt(s, x, y, w = 12, h = 15, night = false) {
  s.rect(x - 1, y - 1, w + 2, h + 2, P.stone); s.rect(x, y, w, h, night ? P.night : P.teal);
  s.rect(x, y, w, 2, night ? P.navy : P.mist); s.rect(x + Math.floor(w / 2), y, 1, h, P.wood); s.rect(x, y + h - 4, w, 1, P.wood);
  s.rect(x - 2, y + h, w + 4, 2, P.cream); if (night) { s.put(x + 2, y + 3, P.white); s.put(x + w - 3, y + 6, P.white); }
}
function column(s, x, y, h = 24) { s.rect(x, y, 5, h, P.cream); s.rect(x + 3, y + 2, 2, h - 2, P.sand); s.rect(x - 1, y, 7, 2, P.pale); s.rect(x - 1, y + h - 1, 7, 2, P.stone); }
function plant(s, x, y) { s.rect(x + 1, y - 9, 1, 10, P.olive); s.rect(x - 2, y - 8, 3, 2, P.leaf); s.rect(x + 2, y - 5, 4, 2, P.olive); s.rect(x - 3, y - 3, 4, 2, P.olive); s.rect(x - 2, y, 7, 4, P.clay); s.rect(x - 1, y + 4, 5, 1, P.brown); }
function palm(s, x, y) { s.rect(x, y - 16, 2, 19, P.wood); s.rect(x + 1, y - 11, 1, 2, P.sand); s.line(x - 8, y - 12, x, y - 17, P.olive); s.line(x - 7, y - 13, x - 2, y - 17, P.leaf); s.line(x + 1, y - 17, x + 10, y - 13, P.olive); s.line(x, y - 18, x - 5, y - 21, P.leaf); s.line(x + 2, y - 18, x + 6, y - 22, P.olive); s.rect(x - 5, y - 17, 12, 2, P.olive); }
function pot(s, x, y, color = P.clay, scale = 1) {
  s.rect(x + scale, y, 3 * scale, scale, P.brown); s.rect(x + scale, y + scale, 3 * scale, scale, color);
  s.rect(x, y + 2 * scale, 5 * scale, 4 * scale, color); s.rect(x + scale, y + 6 * scale, 3 * scale, scale, P.brown); s.rect(x + scale, y + 2 * scale, scale, 3 * scale, P.pale);
}
function person(s, x, y, { child = false, elder = false, tunic = P.cream, skin = P.skin, facing = 1, seated = false, soldier = false } = {}) {
  const h = child ? 12 : 17, top = y - h;
  s.rect(x + 2, top, 4, 5, skin); s.rect(x + 2, top, 4, 1, elder ? P.grey : P.hair);
  s.rect(facing > 0 ? x + 5 : x + 2, top + 2, 1, 1, P.ink); s.rect(facing > 0 ? x + 6 : x + 1, top + 3, 1, 1, skin);
  s.rect(x + 2, top + 5, 3, 1, P.deep); s.rect(x + 1, top + 6, 6, child ? 4 : 8, tunic);
  s.rect(x, top + 7, 1, child ? 3 : 5, skin); s.rect(x + 7, top + 7, 1, child ? 3 : 5, skin);
  s.rect(x + 1, top + 9, 6, 1, tunic === P.cream ? P.sand : P.dark);
  if (seated) { s.rect(x + 1, y - 4, 9, 3, tunic); s.rect(x + 7, y - 1, 2, 2, skin); }
  else { s.rect(x + 2, y - 2, 1, 3, skin); s.rect(x + 5, y - 2, 1, 3, skin); s.rect(x + 1, y + 1, 3, 1, P.brown); s.rect(x + 5, y + 1, 3, 1, P.brown); }
  if (elder) { s.rect(x + 5, top + 4, 2, 3, P.grey); s.rect(x + 9, y - 8, 1, 11, P.wood); }
  if (soldier) { s.rect(x + 1, top - 1, 6, 2, P.gold); s.rect(x + 2, top - 3, 4, 2, P.red); s.rect(x + 7, top + 9, 4, 6, P.red); s.rect(x + 8, top + 10, 2, 4, P.gold); s.rect(x - 2, top - 3, 1, h + 5, P.wood); }
}
function scroll(s, x, y, w = 13) { s.rect(x, y, w, 7, P.cream); s.rect(x, y, 2, 7, P.sand); s.rect(x + w - 2, y, 2, 7, P.pale); s.rect(x + 3, y + 2, w - 6, 1, P.wood); s.rect(x + 3, y + 4, w - 7, 1, P.wood); }
function lamp(s, x, y) { s.rect(x - 2, y, 6, 2, P.clay); s.rect(x - 1, y + 2, 4, 1, P.brown); s.rect(x + 3, y - 2, 2, 2, P.gold); s.put(x + 4, y - 3, P.cream); }
function boat(s, x, y, size = 1, sailColor = P.cream) {
  s.poly([[x, y], [x + 18 * size, y], [x + 15 * size, y + 4 * size], [x + 3 * size, y + 4 * size]], P.brown);
  s.rect(x + 2 * size, y, 14 * size, size, P.clay); s.rect(x + 9 * size, y - 15 * size, size, 16 * size, P.wood);
  s.poly([[x + 8 * size, y - 14 * size], [x + 2 * size, y - 2 * size], [x + 8 * size, y - 2 * size]], sailColor);
  s.poly([[x + 11 * size, y - 13 * size], [x + 16 * size, y - 3 * size], [x + 11 * size, y - 3 * size]], P.pale);
  s.line(x + 9 * size, y - 14 * size, x + 17 * size, y, P.stone);
}
function sea(s, y = 27) { s.rect(0, y, 64, 48 - y, P.sea); s.rect(0, y, 64, 2, P.teal); for (let yy = y + 5; yy < 48; yy += 5) for (let x = (yy % 3) * 4; x < 64; x += 18) s.rect(x, yy, 8, 1, yy % 2 ? P.teal : P.mist); }
function lighthouse(s, x, y) { s.rect(x, y + 10, 7, 16, P.pale); s.rect(x + 1, y + 3, 5, 10, P.cream); s.rect(x + 2, y, 3, 5, P.sand); s.rect(x - 1, y + 10, 9, 2, P.stone); s.rect(x + 2, y + 6, 2, 3, P.navy); s.rect(x + 2, y + 19, 2, 4, P.navy); s.put(x + 3, y - 1, P.gold); }
function harbor() {
  const s = surface(); clouds(s, true); sea(s, 26);
  s.rect(0, 21, 23, 8, P.stone); s.rect(4, 17, 12, 5, P.pale); s.rect(2, 20, 18, 2, P.cream);
  for (const x of [3, 9, 15]) { s.rect(x, 23, 3, 6, P.cream); s.rect(x + 1, 24, 1, 4, P.navy); }
  lighthouse(s, 49, 2); s.rect(43, 27, 20, 2, P.stone); boat(s, 24, 32); boat(s, 2, 35);
  s.rect(0, 42, 64, 6, P.pale); s.rect(0, 42, 64, 1, P.cream); s.rect(0, 46, 64, 1, P.stone);
  for (const x of [12, 28, 44, 59]) s.rect(x, 43, 1, 3, P.sand);
  s.rect(0, 39, 14, 3, P.sand); person(s, 9, 43, { child: true, tunic: P.navy }); palm(s, 59, 38); pot(s, 18, 38);
  return s;
}

function makeScene(id) {
  const s = surface();
  if (id === "music") {
    clouds(s, true); ground(s, 34); column(s, 5, 9, 26); column(s, 53, 9, 26); s.rect(2, 7, 59, 3, P.cream);
    s.rect(7, 34, 50, 2, P.stone); s.rect(13, 36, 39, 2, P.pale); person(s, 25, 37, { tunic: P.navy });
    s.rect(31, 21, 2, 12, P.wood); s.rect(39, 21, 2, 12, P.wood); s.rect(31, 20, 10, 2, P.gold); s.rect(32, 30, 8, 6, P.clay); for (const x of [34, 36, 38]) s.rect(x, 22, 1, 12, P.pale);
    s.line(30, 27, 35, 29, P.skin); person(s, 12, 43, { seated: true, tunic: P.clay }); person(s, 43, 43, { seated: true, tunic: P.olive, facing: -1 }); plant(s, 57, 37); s.rect(17, 42, 2, 3, P.wood); return s;
  }
  if (["sea", "history-war", "history-city"].includes(id)) {
    clouds(s, id === "history-city"); sea(s, 28); lighthouse(s, 49, 1);
    s.rect(0, 19, 20, 12, P.stone); s.rect(0, 18, 23, 2, P.cream);
    for (const x of [2, 8, 14]) { s.rect(x, 22, 3, 7, P.pale); s.rect(x + 1, 23, 1, 4, P.navy); }
    if (id === "sea") { boat(s, 13, 37, 2); person(s, 30, 39, { child: true, tunic: P.navy }); s.rect(0, 45, 64, 3, P.teal); }
    else { ground(s, 37); boat(s, 26, 31); if (id === "history-war") { person(s, 9, 43, { tunic: P.red, soldier: true }); person(s, 22, 44, { tunic: P.navy }); s.rect(0, 36, 64, 2, P.brown); s.rect(30, 22, 2, 7, P.grey); s.rect(31, 18, 5, 4, P.grey); s.rect(33, 15, 7, 3, P.stone); } else { person(s, 8, 43, { tunic: P.cream }); person(s, 27, 43, { tunic: P.clay, facing: -1 }); pot(s, 41, 37); palm(s, 58, 35); s.rect(21, 26, 15, 4, P.red); s.rect(22, 30, 1, 8, P.wood); s.rect(34, 30, 1, 8, P.wood); } }
    return s;
  }
  if (id === "childhood") {
    clouds(s); ground(s, 31); s.rect(0, 18, 13, 17, P.pale); s.rect(0, 16, 16, 3, P.cream); s.rect(2, 23, 5, 11, P.navy); column(s, 52, 10, 25); s.rect(48, 8, 16, 3, P.cream);
    person(s, 19, 39, { child: true, tunic: P.navy }); person(s, 36, 38, { child: true, tunic: P.clay, facing: -1 }); s.rect(29, 38, 3, 3, P.gold); s.rect(30, 37, 1, 1, P.pale); s.rect(26, 43, 8, 1, P.wood); plant(s, 8, 37); palm(s, 59, 31); return s;
  }
  if (id === "memorial") {
    clouds(s, true); ground(s, 32); s.rect(0, 30, 64, 3, P.olive); s.rect(26, 12, 16, 25, P.stone); s.rect(28, 10, 12, 2, P.stone); s.rect(28, 13, 12, 22, P.pale); s.rect(30, 16, 8, 2, P.cream); s.rect(31, 20, 6, 1, P.wood); s.rect(30, 23, 8, 1, P.wood); s.rect(31, 26, 6, 1, P.wood); s.rect(23, 37, 22, 3, P.brown); s.rect(24, 36, 20, 2, P.cream); plant(s, 15, 37); lamp(s, 48, 39); s.rect(6, 42, 8, 1, P.olive); s.rect(8, 40, 3, 2, P.leaf); return s;
  }
  wall(s); windowAt(s, 43, 7, 13, 15, id === "learning"); s.rect(0, 4, 4, 31, P.wood); s.rect(60, 4, 4, 31, P.wood);
  if (id === "birth") {
    s.rect(16, 34, 22, 8, P.wood); s.rect(18, 32, 18, 8, P.sand); s.rect(19, 33, 16, 4, P.cream); s.rect(23, 30, 6, 4, P.skin); s.rect(24, 29, 4, 1, P.hair); s.rect(21, 35, 11, 4, P.teal); s.rect(19, 40, 2, 5, P.brown); s.rect(33, 40, 2, 5, P.brown); person(s, 39, 40, { tunic: P.navy, seated: true }); plant(s, 8, 32); lamp(s, 54, 32); s.rect(49, 34, 10, 2, P.wood);
  } else if (id === "learning") {
    s.rect(11, 28, 29, 3, P.wood); s.rect(13, 31, 2, 12, P.brown); s.rect(36, 31, 2, 12, P.brown); scroll(s, 17, 24, 15); person(s, 7, 40, { child: true, tunic: P.clay }); person(s, 35, 37, { tunic: P.navy, seated: true }); s.line(35, 24, 30, 29, P.skin); s.rect(7, 8, 23, 2, P.wood); scroll(s, 9, 3, 8); scroll(s, 19, 3, 8); lamp(s, 38, 26); plant(s, 53, 35);
  } else if (id === "work") {
    s.rect(7, 28, 36, 4, P.wood); s.rect(9, 32, 3, 12, P.brown); s.rect(37, 32, 3, 12, P.brown); pot(s, 17, 19, P.clay); s.rect(28, 20, 7, 8, P.cream); s.rect(29, 18, 5, 3, P.stone); s.rect(30, 16, 3, 3, P.pale); person(s, 39, 39, { tunic: P.navy }); s.line(38, 27, 33, 25, P.skin); s.rect(8, 9, 24, 2, P.wood); pot(s, 10, 2); pot(s, 19, 2, P.olive); pot(s, 48, 35, P.clay); pot(s, 54, 37, P.sand); s.rect(23, 37, 4, 1, P.cream); s.rect(30, 40, 3, 1, P.cream);
  } else if (id === "family") {
    person(s, 8, 38, { tunic: P.navy, seated: true }); person(s, 42, 39, { tunic: P.clay, seated: true, facing: -1 }); person(s, 30, 42, { child: true, tunic: P.olive }); s.rect(18, 31, 25, 3, P.wood); s.rect(20, 34, 2, 8, P.brown); s.rect(39, 34, 2, 8, P.brown); pot(s, 27, 25, P.clay); s.rect(21, 30, 4, 1, P.gold); s.rect(35, 30, 4, 1, P.cream); plant(s, 54, 34); s.rect(7, 7, 24, 2, P.wood); pot(s, 10, 0); pot(s, 20, 0, P.olive);
  } else if (id === "later-life") {
    person(s, 19, 38, { elder: true, tunic: P.navy, seated: true }); s.rect(17, 37, 12, 2, P.wood); s.rect(18, 39, 2, 6, P.brown); person(s, 37, 40, { child: true, tunic: P.clay, facing: -1 }); s.rect(43, 33, 12, 2, P.wood); scroll(s, 43, 26, 11); lamp(s, 53, 31); plant(s, 8, 34); s.rect(10, 10, 20, 2, P.wood); scroll(s, 13, 5, 12);
  } else if (id === "rest" || id === "rest-child") {
    s.rect(8, 33, 35, 8, P.wood); s.rect(9, 29, 33, 9, P.cream); s.rect(17, 29, 24, 8, P.teal); s.rect(10, 30, 7, 5, P.light); s.rect(10, 29, 6, 1, id === "rest-child" ? P.hair : P.grey); s.rect(11, 32, 2, 1, P.deep); s.rect(8, 26, 2, 14, P.brown); s.rect(40, 29, 3, 14, P.brown); s.rect(11, 41, 2, 4, P.brown); s.rect(38, 41, 2, 4, P.brown); person(s, 45, 40, { tunic: P.clay }); pot(s, 22, 37, P.sand); if (id === "rest-child") { s.rect(15, 29, 14, 8, P.teal); s.rect(29, 29, 12, 8, P.cream); s.rect(5, 42, 3, 3, P.gold); } lamp(s, 54, 30);
  }
  return s;
}

function worldScene(id) {
  if (id === "alexandria") return harbor();
  const s = surface(); clouds(s, id === "ottoman-constantinople");
  if (id === "medieval-europe") {
    s.poly([[0, 28], [10, 21], [25, 29], [43, 22], [64, 29], [64, 48], [0, 48]], P.olive);
    s.rect(9, 18, 20, 17, P.grey); s.rect(7, 15, 7, 21, P.stone); s.rect(25, 12, 7, 24, P.stone); s.rect(16, 10, 7, 23, P.grey);
    for (const [x, y] of [[7, 13], [11, 13], [16, 8], [20, 8], [25, 10], [29, 10]]) s.rect(x, y, 3, 3, P.grey);
    for (const [x, y] of [[10, 20], [19, 16], [28, 17], [16, 26], [24, 27]]) s.rect(x, y, 2, 4, P.navy);
    s.rect(17, 28, 5, 7, P.brown); s.rect(18, 27, 3, 1, P.brown); s.poly([[18, 35], [24, 35], [37, 48], [22, 48]], P.sand);
    for (const [x, y] of [[37, 29], [48, 33]]) { s.rect(x, y, 10, 10, P.pale); s.poly([[x - 1, y], [x + 5, y - 7], [x + 11, y]], P.red); s.rect(x + 4, y + 4, 3, 6, P.brown); }
    s.rect(3, 35, 2, 9, P.wood); s.poly([[4, 24], [-2, 37], [11, 37]], P.leaf); s.rect(58, 29, 2, 14, P.wood); s.poly([[59, 20], [52, 35], [66, 35]], P.olive); s.rect(20, 5, 1, 5, P.wood); s.rect(21, 5, 5, 2, P.red);
  } else {
    sea(s, 33); s.rect(0, 29, 64, 5, P.stone); s.rect(7, 23, 10, 8, P.pale); s.rect(44, 24, 15, 8, P.clay);
    s.rect(24, 19, 18, 15, P.cream); s.poly([[23, 20], [25, 15], [29, 12], [36, 12], [40, 15], [43, 20]], P.navy); s.rect(30, 10, 7, 3, P.navy); s.rect(33, 7, 1, 4, P.gold); s.rect(34, 7, 2, 1, P.gold);
    for (const x of [18, 47]) { s.rect(x, 10, 3, 24, P.cream); s.rect(x - 1, 18, 5, 2, P.stone); s.poly([[x - 1, 10], [x + 1, 5], [x + 4, 10]], P.navy); }
    for (const x of [27, 33, 38]) { s.rect(x, 25, 2, 7, P.navy); s.put(x + 1, 24, P.navy); }
    s.rect(0, 42, 64, 6, P.brown); s.rect(0, 40, 64, 2, P.pale); boat(s, 7, 35); boat(s, 39, 37); s.rect(53, 36, 1, 5, P.wood);
  }
  return s;
}

function portrait(stage, variant) {
  const s = surface(32, 40, P.pale);
  s.rect(1, 1, 30, 38, P.cream); s.rect(2, 2, 28, 36, variant === 1 ? P.mist : P.sand);
  s.rect(3, 3, 26, 25, P.pale); s.rect(3, 28, 26, 9, P.stone);
  const skin = [P.skin, P.light, P.deep][variant], tunic = [P.navy, P.olive, P.clay][variant];
  if (stage === "infant") {
    s.rect(10, 14, 12, 10, skin); s.rect(12, 12, 8, 3, skin); s.rect(12, 13, 5, 1, P.hair); s.put(12, 18, P.brown); s.put(19, 18, P.brown);
    s.rect(9, 23, 14, 9, tunic); s.rect(11, 31, 10, 4, tunic); s.line(10, 24, 22, 30, P.cream); s.line(11, 30, 21, 24, P.cream); s.rect(6, 33, 20, 2, P.wood); s.rect(7, 30, 2, 7, P.wood); s.rect(23, 30, 2, 7, P.wood);
  } else {
    const child = stage === "child", youth = stage === "youth", elder = stage === "elder", middle = stage === "middle";
    const top = child ? 10 : 5, headX = child ? 11 : 10, headW = child ? 10 : 12, hair = elder ? P.grey : P.hair;
    s.rect(headX, top + 3, headW, 12, skin); s.rect(headX + 2, top + 1, headW - 4, 3, skin); s.rect(headX + 1, top, headW - 2, 4, hair); s.rect(headX, top + 2, headW, 3, hair);
    s.rect(headX, top + 4, variant === 2 ? 3 : 2, variant === 1 ? 6 : 4, hair); s.rect(headX + headW - 2, top + 4, 2, 4, hair);
    s.rect(headX - 1, top + 8, 1, 3, skin); s.rect(headX + headW, top + 8, 1, 3, skin);
    s.put(headX + 3, top + 8, P.ink); s.put(headX + headW - 4, top + 8, P.ink); s.rect(headX + 5, top + 9, 1, 2, P.deep); s.rect(headX + 4, top + 13, 4, 1, P.brown);
    s.rect(headX + 2, top + 15, headW - 4, 2, P.deep);
    s.poly([[7, 37], [7, top + 22], [11, top + 18], [20, top + 18], [25, top + 22], [25, 37]], tunic);
    s.line(11, top + 18, 16, top + 25, P.cream); s.line(20, top + 18, 16, top + 25, P.cream); s.line(16, top + 25, 16, 37, P.sand);
    if (middle || elder) { s.rect(headX + 2, top + 12, 2, 2, elder ? P.grey : P.brown); s.rect(headX + headW - 4, top + 12, 2, 2, elder ? P.grey : P.brown); }
    if (elder) { s.rect(headX + 3, top + 14, 6, 3, P.grey); s.rect(headX + 4, top + 17, 4, 1, P.grey); s.rect(headX + 1, top + 7, 3, 1, P.stone); s.rect(headX + 8, top + 7, 3, 1, P.stone); }
    if (youth) s.rect(headX + 2, top + 1, headW - 4, 2, P.brown);
  }
  s.rect(0, 0, 32, 1, P.wood); s.rect(0, 39, 32, 1, P.wood); s.rect(0, 0, 1, 40, P.wood); s.rect(31, 0, 1, 40, P.wood);
  return s;
}

function routeArt(id) {
  const s = surface(64, 64, P.ink);
  s.rect(2, 2, 60, 60, P.gold); s.rect(3, 3, 58, 58, P.wood); s.rect(5, 5, 54, 54, P.pale); s.rect(7, 7, 50, 50, id === "astronomy-calendar" ? P.night : P.cream);
  for (const [x, y] of [[4, 4], [57, 4], [4, 57], [57, 57]]) { s.rect(x, y, 3, 3, P.gold); s.put(x + 1, y + 1, P.cream); }
  s.rect(11, 48, 42, 3, P.stone); s.rect(14, 51, 36, 2, P.wood);
  if (id === "sculpture") {
    s.rect(23, 39, 19, 9, P.stone); s.rect(20, 37, 25, 3, P.pale); s.poly([[22, 37], [24, 30], [29, 27], [36, 27], [41, 31], [43, 37]], P.cream); s.rect(28, 15, 12, 14, P.cream); s.rect(30, 12, 8, 4, P.sand); s.rect(27, 15, 13, 4, P.stone); s.rect(27, 19, 3, 6, P.stone); s.put(36, 21, P.wood); s.rect(35, 25, 4, 1, P.stone); s.rect(14, 30, 2, 15, P.wood); s.rect(12, 28, 7, 4, P.grey); s.line(47, 29, 43, 41, P.brown);
  } else if (id === "philosophy") {
    s.rect(16, 23, 15, 22, P.sand); s.rect(33, 23, 15, 22, P.sand); s.rect(17, 21, 14, 21, P.cream); s.rect(33, 21, 14, 21, P.pale); s.rect(31, 22, 2, 23, P.wood); for (const y of [26, 30, 34, 38]) { s.rect(20, y, 8, 1, P.wood); s.rect(36, y, 8, 1, P.wood); } s.line(12, 40, 20, 13, P.olive); s.rect(16, 18, 6, 3, P.leaf); s.rect(11, 26, 6, 3, P.olive); s.rect(17, 12, 4, 4, P.leaf); s.rect(28, 14, 9, 1, P.gold);
  } else if (id === "seafaring") {
    s.rect(9, 33, 46, 14, P.sea); s.rect(10, 40, 44, 1, P.teal); boat(s, 19, 37); s.rect(30, 11, 2, 25, P.wood); s.poly([[29, 13], [18, 33], [29, 33]], P.cream); s.poly([[34, 14], [45, 32], [34, 32]], P.pale); s.rect(12, 44, 10, 1, P.mist); s.rect(36, 43, 13, 1, P.mist); s.rect(46, 13, 4, 2, P.gold);
  } else if (id === "military") {
    // Bronze oval shield, central boss and separate rim marks: no later
    // Christian heraldry or medieval kite-shield silhouette.
    s.poly([[28, 13], [36, 13], [41, 17], [44, 24], [44, 33], [40, 40], [35, 44], [29, 44], [24, 40], [21, 33], [21, 24], [24, 17]], P.wood);
    s.poly([[29, 15], [35, 15], [39, 18], [42, 25], [42, 32], [38, 39], [34, 42], [30, 42], [26, 38], [23, 32], [23, 25], [26, 18]], P.gold);
    s.rect(29, 24, 7, 9, P.wood); s.rect(30, 23, 5, 10, P.pale); s.rect(29, 25, 6, 6, P.pale); s.rect(34, 26, 2, 6, P.clay);
    for (const [x, y, w, h] of [[31, 17, 2, 3], [31, 36, 2, 3], [25, 27, 2, 2], [38, 27, 2, 2], [26, 20, 2, 2], [37, 20, 2, 2], [26, 35, 2, 2], [37, 35, 2, 2]]) s.rect(x, y, w, h, P.wood);
    s.rect(14, 17, 2, 29, P.wood); s.poly([[12, 18], [15, 10], [18, 18]], P.grey); s.rect(48, 18, 2, 28, P.wood); s.poly([[46, 19], [49, 11], [52, 19]], P.grey);
  } else if (id === "commerce") {
    s.rect(30, 17, 3, 28, P.wood); s.rect(28, 44, 7, 3, P.brown); s.rect(16, 21, 31, 2, P.gold); s.rect(17, 23, 1, 10, P.wood); s.rect(25, 23, 1, 10, P.wood); s.rect(38, 23, 1, 10, P.wood); s.rect(46, 23, 1, 10, P.wood); s.poly([[14, 33], [29, 33], [26, 37], [17, 37]], P.clay); s.poly([[35, 33], [50, 33], [47, 37], [38, 37]], P.clay); for (const [x, y] of [[15, 43], [20, 41], [44, 43]]) { s.rect(x, y, 6, 3, P.gold); s.rect(x + 1, y, 4, 1, P.pale); } pot(s, 10, 25, P.olive);
  } else if (id === "astronomy-calendar") {
    for (const [x, y] of [[13, 13], [23, 10], [42, 12], [50, 23], [12, 30], [46, 37]]) { s.put(x, y, P.cream); s.put(x + 1, y, P.cream); }
    s.rect(19, 22, 26, 23, P.pale); s.rect(21, 24, 22, 19, P.cream); for (const x of [27, 34]) s.rect(x, 25, 1, 17, P.stone); for (const y of [29, 34, 39]) s.rect(22, y, 20, 1, P.stone); s.rect(29, 30, 3, 3, P.clay); s.line(15, 37, 40, 14, P.gold); s.rect(35, 12, 8, 3, P.gold); s.rect(37, 10, 4, 2, P.pale);
  } else {
    s.rect(22, 18, 3, 20, P.wood); s.rect(40, 18, 3, 20, P.wood); s.rect(23, 16, 19, 4, P.gold); s.rect(25, 34, 15, 10, P.wood); s.rect(26, 35, 13, 7, P.clay); for (const x of [27, 30, 33, 36, 39]) s.rect(x, 20, 1, 18, P.gold); s.rect(21, 35, 4, 6, P.gold); s.rect(40, 35, 4, 6, P.gold); s.rect(13, 15, 2, 12, P.navy); s.rect(14, 15, 5, 2, P.navy); s.rect(10, 26, 5, 3, P.navy); s.rect(48, 25, 2, 12, P.navy); s.rect(49, 25, 4, 2, P.navy); s.rect(45, 36, 5, 3, P.navy);
  }
  s.rect(27, 55, 10, 1, P.gold); s.put(25, 55, P.wood); s.put(38, 55, P.wood);
  return s;
}

function svg(s, title) {
  const rects = [], active = new Map();
  for (let y = 0; y < s.height; y++) {
    const seen = new Set();
    for (let x = 0; x < s.width;) {
      const color = s.pixels[y][x]; let end = x + 1; while (end < s.width && s.pixels[y][end] === color) end++;
      const key = `${x}:${end - x}:${color}`, previous = active.get(key);
      if (previous && previous.y + previous.h === y) previous.h++; else { const item = { x, y, w: end - x, h: 1, color }; rects.push(item); active.set(key, item); }
      seen.add(key); x = end;
    }
    for (const key of active.keys()) if (!seen.has(key)) active.delete(key);
  }
  const groups = Object.values(P).map(color => { const cells = rects.filter(r => r.color === color); return cells.length ? `<g fill="${color}">${cells.map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`).join("")}</g>` : ""; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.width} ${s.height}" shape-rendering="crispEdges" role="img"><title>${title}</title>${groups}</svg>\n`;
}
function deliver(path, s, title) { const target = `${root}${path}`; mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true }); writeFileSync(target, svg(s, title)); assets.push({ path: `/assets/pixel/${path}`, title, width: s.width, height: s.height, surface: s }); }

const sceneIds = ["birth", "childhood", "learning", "work", "sea", "family", "later-life", "memorial", "rest", "rest-child", "history-war", "history-city", "music"];
for (const id of sceneIds) deliver(`scenes/${id}.svg`, makeScene(id), `Original pixel scene: ${id}`);
for (const id of ["alexandria", "medieval-europe", "ottoman-constantinople"]) deliver(`worlds/${id}.svg`, worldScene(id), `Original pixel world: ${id}`);
for (const stage of ["infant", "child", "youth", "adult", "middle", "elder"]) for (let variant = 0; variant < 3; variant++) deliver(`portraits/${stage}-${variant}.svg`, portrait(stage, variant), `Fictional ${stage} portrait, variant ${variant + 1}`);
for (const id of ["sculpture", "philosophy", "seafaring", "military", "commerce", "astronomy-calendar", "music-performance"]) deliver(`routes/${id}.svg`, routeArt(id), `Original achievement artwork: ${id}`);

// Tiny dependency-free PNG renderer: contact sheet is rendered from the same
// editable pixel surfaces as delivery SVGs, rather than a separate illustration.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type, data) { const name = Buffer.from(type), length = Buffer.alloc(4); length.writeUInt32BE(data.length); let crc = 0xffffffff; for (const b of Buffer.concat([name, data])) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8); const sum = Buffer.alloc(4); sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0); return Buffer.concat([length, name, data, sum]); }
function png(s, scale = 4) {
  const width = s.width * scale, height = s.height * scale, raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const color = s.pixels[Math.floor(y / scale)][Math.floor(x / scale)], at = y * (width * 4 + 1) + 1 + x * 4; raw[at] = parseInt(color.slice(1, 3), 16); raw[at + 1] = parseInt(color.slice(3, 5), 16); raw[at + 2] = parseInt(color.slice(5, 7), 16); raw[at + 3] = 255; }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const previewAssets = assets.filter(a => !a.path.includes("/portraits/"));
const sheet = surface(4 * 68 + 4, Math.ceil(previewAssets.length / 4) * 68 + 4, P.ink);
previewAssets.forEach((asset, i) => { const xx = 4 + (i % 4) * 68, yy = 4 + Math.floor(i / 4) * 68; for (let y = 0; y < asset.height; y++) for (let x = 0; x < asset.width; x++) sheet.put(xx + x, yy + y, asset.surface.pixels[y][x]); });
const previews = fileURLToPath(new URL("../artifacts/", import.meta.url)); mkdirSync(previews, { recursive: true }); writeFileSync(`${previews}pixel-art-contact-sheet.png`, png(sheet));
const portraits = surface(6 * 36 + 4, 3 * 44 + 4, P.ink); assets.filter(a => a.path.includes("/portraits/")).forEach((asset, i) => { const xx = 4 + Math.floor(i / 3) * 36, yy = 4 + (i % 3) * 44; for (let y = 0; y < 40; y++) for (let x = 0; x < 32; x++) portraits.put(xx + x, yy + y, asset.surface.pixels[y][x]); }); writeFileSync(`${previews}pixel-portrait-contact-sheet.png`, png(portraits));
writeFileSync(`${root}manifest.json`, `${JSON.stringify({ generator: "scripts/build-pixel-assets.mjs", palette: P, assets: assets.map(({ surface: _surface, ...asset }) => asset) }, null, 2)}\n`);
for (const asset of assets) { const content = readFileSync(`${root}${asset.path.replace("/assets/pixel/", "")}`, "utf8"); if (/<(?:image|path|circle|ellipse|filter|linearGradient)\b/.test(content) || !content.includes('shape-rendering="crispEdges"')) throw new Error(`Non-pixel SVG geometry: ${asset.path}`); }
console.log(`Generated ${assets.length} original editable pixel SVG assets; all integer-rectangle geometry checked. QA sheets saved under artifacts/.`);
