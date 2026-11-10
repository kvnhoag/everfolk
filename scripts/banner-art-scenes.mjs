// Original pixel-vector scenery for the Everfolk banner library.
// The ArtCraft build consumes these drawing specifications as native vector
// paths on named layers. This module does not emit flattened artwork.
export const BANNER_SITUATIONS = Object.freeze([
  "home", "courtyard", "study", "workshop", "sculpture", "philosophy",
  "harbor", "military", "market", "astronomy", "music", "friendship",
  "courtship", "marriage", "parenthood", "business", "illness", "recovery",
  "debt", "danger", "war", "civic", "retirement", "memorial",
]);

const P = Object.freeze({
  ink: "#263b43", blue: "#41637b", teal: "#76b5b1", sea: "#b8d2c4",
  cream: "#f5e6bf", sunlight: "#edcf91", sand: "#baa47a", wood: "#886447",
  clay: "#ba704c", olive: "#6b8051", pale: "#fff2d1", wall: "#ddc79b",
  mortar: "#cbb58b", floor: "#c9b184", shade: "#9b8a6b", dark: "#65503e",
  skin: "#bf8b62", hair: "#483d38", rose: "#cb9879", night: "#26394e",
  dusk: "#526978", mist: "#adb4a6", leaf: "#91a77b", lightStone: "#e9d6ac",
});

function canvas() {
  const names = ["01 Atmosphere and light", "02 Buildings landscape and ground",
    "03 Architectural details", "04 Story objects and company",
    "05 Foreground rugs and shadows", "06 Small atmospheric details"];
  const layers = names.map(name => ({ name, rects: [] }));
  const rect = (layer, x, y, w, h, fill) => {
    if (![x, y, w, h].every(Number.isInteger)) throw new Error("Banner pixels must be whole numbers");
    if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > 240 || y + h > 112) {
      throw new Error(`Out of bounds banner rectangle ${[x, y, w, h]}`);
    }
    layers[layer].rects.push({ x, y, w, h, fill: P[fill] ?? fill });
  };
  return { layers, rect };
}

function steppedDisk(r, layer, x, y, diameter, color) {
  r(layer, x + 3, y, diameter - 6, 2, color);
  r(layer, x + 1, y + 2, diameter - 2, 2, color);
  r(layer, x, y + 4, diameter, diameter - 8, color);
  r(layer, x + 1, y + diameter - 4, diameter - 2, 2, color);
  r(layer, x + 3, y + diameter - 2, diameter - 6, 2, color);
}

function sky(r, { night = false, sunset = false, cloud = true } = {}) {
  r(0, 0, 0, 240, 112, night ? "night" : sunset ? "rose" : "sea");
  r(0, 0, 43, 240, 28, night ? "dusk" : "lightStone");
  r(0, 0, 62, 240, 28, night ? "blue" : "cream");
  if (!night) {
    steppedDisk(r, 0, 196, sunset ? 29 : 12, 20, sunset ? "clay" : "sunlight");
    r(0, 189, 21, 5, 1, "pale"); r(0, 219, 21, 7, 1, "pale");
  } else {
    steppedDisk(r, 0, 205, 12, 14, "cream");
    r(0, 209, 11, 11, 12, "night");
    for (const [x, y] of [[11, 12], [31, 26], [52, 9], [79, 22], [101, 12], [127, 27], [150, 8], [180, 15], [228, 32], [189, 39]]) {
      r(5, x, y, 1, 1, "pale");
    }
    for (const [x, y] of [[133, 11], [173, 25], [230, 9]]) {
      r(5, x, y, 1, 3, "sunlight"); r(5, x - 1, y + 1, 3, 1, "sunlight");
    }
  }
  if (cloud && !night) {
    for (const [x, y, w] of [[6, 20, 32], [51, 11, 27], [104, 28, 25]]) {
      r(0, x + 5, y, w - 9, 2, "pale");
      r(0, x, y + 2, w, 3, "pale");
      r(0, x + 9, y + 5, w - 7, 1, "cream");
    }
  }
}

function skyline(r, { water = false, night = false } = {}) {
  const city = [[0, 57, 19, 26], [16, 50, 23, 34], [36, 60, 22, 25], [55, 48, 29, 38],
    [81, 58, 21, 25], [98, 52, 32, 34], [127, 62, 22, 23], [146, 53, 24, 32],
    [169, 59, 22, 28], [188, 47, 30, 39], [215, 54, 25, 33]];
  for (const [x, y, w, h] of city) {
    r(1, x, y, w, h, night ? "blue" : "wall");
    r(1, x, y, w, 2, night ? "dusk" : "lightStone");
    if (w > 20) { r(2, x + 5, y + 7, 3, 5, night ? "sunlight" : "shade"); r(2, x + 13, y + 9, 3, 4, night ? "dark" : "sand"); }
  }
  if (water) {
    r(1, 0, 76, 240, 20, night ? "blue" : "teal");
    for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
      const x = 4 + col * 34 + (row % 2) * 6;
      if (x + 14 <= 240) r(2, x, 79 + row * 4, 14, 1, night ? "teal" : "sea");
    }
  }
}

function floor(r, { y = 88, dark = false, tiled = true } = {}) {
  r(1, 0, y, 240, 112 - y, dark ? "dark" : "floor");
  r(2, 0, y, 240, 2, dark ? "shade" : "lightStone");
  if (tiled) {
    for (let row = 0; row < 3; row++) {
      const yy = y + 6 + row * 7;
      if (yy >= 112) break;
      r(2, 0, yy, 240, 1, dark ? "wood" : "sand");
      for (let col = 0; col < 10; col++) {
        const xx = col * 25 + (row % 2) * 12;
        if (xx < 240 && yy + 6 < 112) r(2, xx, yy + 1, 1, 6, dark ? "wood" : "mortar");
      }
    }
  }
  for (const [x, yy, w] of [[7, 107, 7], [41, 94, 5], [68, 105, 4], [116, 102, 6], [202, 108, 8], [229, 98, 4]]) {
    if (yy >= y) r(5, x, yy, w, 1, dark ? "shade" : "lightStone");
  }
}

function interior(r, { night = false, opening = true, low = false } = {}) {
  r(0, 0, 0, 240, 112, night ? "dark" : "cream");
  r(1, 0, 0, 240, 8, night ? "wood" : "wall");
  r(1, 0, 8, 7, 80, night ? "wood" : "mortar");
  r(1, 233, 8, 7, 80, night ? "wood" : "mortar");
  r(1, 0, 76, 240, 12, night ? "wood" : "wall");
  for (let row = 0; row < 7; row++) {
    const y = 14 + row * 9;
    r(2, 103, y, 130, 1, night ? "wood" : "wall");
    for (let col = 0; col < 6; col++) r(2, 110 + col * 21 + (row % 2) * 6, y + 1, 1, 7, night ? "wood" : "wall");
  }
  if (opening) window(r, 190, 18, night);
  floor(r, { dark: night, y: low ? 94 : 88 });
}

function window(r, x, y, night = false) {
  r(2, x - 3, y - 2, 34, 43, "sand");
  r(2, x, y, 28, 38, night ? "night" : "sea");
  r(2, x, y + 25, 28, 13, night ? "dusk" : "teal");
  r(2, x + 6, y + 27, 10, 11, night ? "blue" : "wall");
  r(2, x + 20, y + 22, 8, 16, night ? "blue" : "wall");
  r(2, x + 12, y, 2, 38, "wood");
  r(2, x, y + 18, 28, 2, "wood");
  r(2, x - 5, y + 38, 38, 3, "lightStone");
  if (night) r(5, x + 7, y + 7, 1, 1, "pale");
}

function column(r, x, y = 17, height = 72, color = "lightStone") {
  r(2, x - 3, y, 15, 3, "cream");
  r(2, x, y + 3, 9, height - 8, color);
  r(2, x + 2, y + 4, 2, height - 10, "pale");
  r(2, x + 7, y + 4, 2, height - 10, "sand");
  r(2, x - 3, y + height - 5, 15, 5, "cream");
}

function courtyard(r, { sunset = false, night = false, columns = false } = {}) {
  sky(r, { sunset, night }); skyline(r, { night });
  r(1, 0, 68, 240, 20, night ? "wood" : "wall");
  r(2, 0, 67, 240, 3, night ? "shade" : "lightStone");
  for (let x = 5; x < 240; x += 17) r(2, x, 74, 1, 13, night ? "shade" : "sand");
  r(2, 115, 11, 125, 5, night ? "wood" : "wall");
  r(2, 115, 16, 125, 2, night ? "dark" : "sand");
  if (columns) { column(r, 122); column(r, 225); }
  floor(r, { dark: night });
}

function jar(r, x, baseline, color = "clay", scale = 1, layer = 3) {
  r(layer, x + scale, baseline - 12 * scale, 5 * scale, 2 * scale, "dark");
  r(layer, x + 2 * scale, baseline - 10 * scale, 3 * scale, 2 * scale, color);
  r(layer, x, baseline - 8 * scale, 7 * scale, 6 * scale, color);
  r(layer, x + scale, baseline - 2 * scale, 5 * scale, 2 * scale, color);
  r(layer, x + scale, baseline - 7 * scale, scale, 4 * scale, "sunlight");
  r(layer, x + 6 * scale, baseline - 7 * scale, scale, 4 * scale, "wood");
}

function person(r, x, baseline, { robe = "blue", height = 30, seated = false, facing = 1 } = {}) {
  const headY = baseline - height;
  r(3, x - 3, headY, 6, 3, "hair");
  r(3, x - 3, headY + 3, 6, 5, "skin");
  r(3, x + (facing > 0 ? 2 : -3), headY + 4, 1, 1, "ink");
  r(3, x - 4, headY + 8, 8, seated ? height - 15 : height - 12, robe);
  r(3, x - 2, headY + 10, 2, seated ? height - 18 : height - 15, "sea");
  r(3, x + (facing > 0 ? 4 : -6), headY + 12, 2, 7, "skin");
  if (seated) {
    r(3, x - 3, baseline - 7, 12, 4, robe);
    r(3, x + 7, baseline - 3, 2, 3, "skin");
  } else {
    r(3, x - 3, baseline - 4, 2, 4, "skin"); r(3, x + 1, baseline - 4, 2, 4, "skin");
  }
  r(3, x - 4, baseline - 1, 4, 1, "dark");
  r(3, x + (seated ? 6 : 0), baseline - 1, 4, 1, "dark");
}

function bench(r, x, y, w = 31, layer = 3) {
  r(layer, x, y, w, 4, "wood"); r(layer, x + 1, y, w - 2, 1, "sunlight");
  r(layer, x + 3, y + 4, 3, 12, "dark"); r(layer, x + w - 6, y + 4, 3, 12, "dark");
}

function scroll(r, x, y, w = 18, layer = 3) {
  r(layer, x, y, w, 9, "pale");
  r(layer, x, y - 1, 2, 11, "sand"); r(layer, x + w - 2, y - 1, 2, 11, "sunlight");
  for (let row = 0; row < 3; row++) r(layer, x + 4, y + 2 + row * 2, w - 8, 1, "mortar");
}

function lamp(r, x, y, layer = 3) {
  r(layer, x, y, 10, 3, "clay"); r(layer, x + 2, y + 3, 6, 2, "wood");
  r(layer, x + 8, y - 3, 1, 3, "sunlight"); r(layer, x + 7, y - 1, 3, 2, "sunlight");
  r(layer, x + 8, y - 1, 1, 1, "pale");
}

function plant(r, x, baseline, { tall = false, olive = false } = {}) {
  jar(r, x - 2, baseline, "clay");
  const top = baseline - (tall ? 37 : 27);
  r(3, x + 1, top, 2, baseline - 12 - top, "wood");
  for (const [dx, dy, w] of [[-7, 3, 7], [2, 0, 9], [-9, 11, 9], [2, 9, 11], [-6, 18, 7], [2, 17, 7]]) {
    r(3, x + dx, top + dy, w, 3, olive ? "olive" : "leaf");
    r(3, x + dx + 1, top + dy, Math.max(2, w - 4), 1, "sea");
  }
}

function hangingGarland(r, x, y, width = 80) {
  for (let i = 0; i < 12; i++) {
    const xx = x + i * Math.floor(width / 12);
    const yy = y + Math.floor((6 - Math.abs(5 - i)) / 2);
    r(3, xx, yy, 5, 1, "olive"); r(3, xx + 1, yy + 1, 2, 3, i % 3 ? "leaf" : "clay");
  }
}

function cushion(r, x, y, w = 15, color = "blue") {
  r(3, x + 1, y, w - 2, 2, color); r(3, x, y + 2, w, 3, color);
  r(3, x + 2, y + 1, w - 4, 1, "sea");
}

function table(r, x, y, width = 39) {
  r(3, x, y, width, 4, "wood"); r(3, x, y, width, 1, "sunlight");
  r(3, x + 3, y + 4, 3, 22, "dark"); r(3, x + width - 6, y + 4, 3, 22, "dark");
}

function groundShadows(r, xs = [130, 194, 220]) {
  for (const x of xs) r(4, x, 96, 13, 2, "shade");
}

function home(r) {
  interior(r); window(r, 111, 22);
  r(2, 222, 18, 2, 43, "wood"); r(2, 219, 18, 8, 2, "wood");
  r(2, 210, 66, 23, 3, "wood"); jar(r, 215, 66, "olive");
  bench(r, 184, 89, 36); cushion(r, 187, 84, 15); cushion(r, 204, 84, 11, "clay");
  table(r, 124, 77, 24); jar(r, 134, 77); lamp(r, 124, 75);
  r(3, 111, 90, 28, 2, "olive");
  for (let x = 114; x < 137; x += 5) r(3, x, 91, 2, 4, "sea");
  plant(r, 224, 106); groundShadows(r, [186, 213]);
}

function playCourtyard(r) {
  courtyard(r, { columns: true });
  plant(r, 226, 107, { tall: true });
  person(r, 199, 94, { height: 20, robe: "clay", facing: -1 });
  person(r, 142, 95, { height: 18, robe: "olive" });
  r(3, 185, 93, 6, 5, "clay"); r(3, 186, 92, 4, 1, "sunlight");
  for (const [x, y] of [[146, 102], [152, 101], [157, 104], [193, 104]]) r(3, x, y, 3, 2, "pale");
  r(4, 135, 104, 67, 1, "cream"); r(4, 136, 105, 1, 4, "cream");
  r(4, 162, 103, 1, 7, "cream"); r(4, 188, 104, 1, 5, "cream");
  bench(r, 204, 84, 17); jar(r, 112, 96, "olive");
}

function study(r) {
  interior(r); table(r, 185, 72, 39); scroll(r, 191, 63, 22); lamp(r, 214, 68);
  person(r, 213, 95, { robe: "olive", seated: true, facing: -1 });
  r(2, 117, 24, 34, 4, "wood"); r(2, 117, 40, 34, 4, "wood");
  for (let i = 0; i < 8; i++) {
    r(3, 119 + i * 4, 15, 3, 9, i % 3 ? "pale" : "sunlight");
    r(3, 119 + i * 4, 31, 3, 9, i % 3 ? "wall" : "pale");
  }
  r(3, 124, 67, 24, 16, "dark"); r(3, 126, 69, 20, 12, "wood");
  for (let j = 0; j < 3; j++) r(3, 129, 72 + j * 3, 12, 1, "cream");
  r(3, 145, 68, 2, 17, "sunlight"); bench(r, 124, 90, 22);
}

function workshop(r) {
  interior(r, { opening: false }); window(r, 190, 14);
  table(r, 182, 70, 44);
  r(3, 185, 65, 35, 5, "sand"); r(3, 186, 65, 34, 1, "cream");
  r(3, 212, 63, 3, 8, "dark"); r(3, 208, 62, 10, 3, "ink");
  r(3, 193, 62, 14, 2, "dark"); r(3, 195, 60, 2, 5, "ink");
  r(2, 116, 25, 45, 4, "wood");
  for (const x of [122, 135, 149]) {
    r(3, x, 29, 2, 16, "dark"); r(3, x - 3, 43, 8, 3, "sand");
    r(3, x, 46, 2, 2, "cream");
  }
  for (let i = 0; i < 6; i++) { r(3, 112 + i * 5, 65 + (i % 2) * 3, 4, 26, i % 2 ? "wood" : "sand"); r(3, 113 + i * 5, 67 + (i % 2) * 3, 1, 21, "sunlight"); }
  jar(r, 219, 105, "olive");
  for (const [x, y] of [[186, 99], [197, 103], [209, 98], [219, 101], [178, 106]]) r(5, x, y, 4, 1, "cream");
}

function sculpture(r) {
  courtyard(r, { columns: true });
  r(3, 202, 83, 23, 5, "sand"); r(3, 206, 54, 15, 29, "lightStone");
  r(3, 208, 50, 11, 5, "cream"); r(3, 210, 46, 7, 4, "pale");
  r(3, 207, 60, 4, 17, "cream"); r(3, 216, 59, 3, 21, "sand");
  r(3, 208, 77, 11, 6, "mortar"); r(3, 204, 87, 20, 3, "wood");
  table(r, 184, 73, 31); r(3, 185, 63, 23, 10, "lightStone");
  for (let i = 0; i < 3; i++) { r(3, 188 + i * 6, 65, 3, 3, "mortar"); r(3, 187 + i * 6, 68, 5, 4, "cream"); }
  r(3, 211, 67, 8, 2, "ink"); r(3, 215, 64, 2, 4, "wood");
  jar(r, 128, 95, "olive");
  for (const [x, y] of [[182, 98], [188, 101], [201, 103], [208, 98], [219, 105]]) { r(5, x, y, 3, 2, "pale"); r(5, x + 2, y + 2, 2, 1, "sand"); }
}

function philosophy(r) {
  courtyard(r, { columns: true });
  bench(r, 190, 87, 30); person(r, 198, 88, { robe: "olive", seated: true, facing: -1 });
  person(r, 217, 96, { robe: "cream", height: 27, facing: -1 });
  scroll(r, 187, 77, 17); plant(r, 132, 104, { tall: true, olive: true });
  r(3, 175, 98, 19, 3, "clay"); r(3, 179, 101, 11, 1, "wood");
  r(3, 184, 94, 2, 4, "dark");
  for (const [x, y] of [[189, 23], [197, 25], [205, 22]]) r(5, x, y, 2, 1, "pale");
}

function harbor(r) {
  sky(r); skyline(r, { water: true });
  // Low coastal storehouses keep the shared scene usable before the Pharos.
  r(1, 114, 65, 18, 10, "lightStone"); r(1, 134, 67, 15, 8, "wall");
  r(2, 112, 63, 22, 3, "cream"); r(2, 132, 65, 19, 3, "sand");
  r(2, 121, 69, 4, 6, "dark");
  r(3, 188, 83, 43, 5, "wood"); r(3, 191, 88, 36, 5, "dark");
  r(3, 196, 93, 25, 3, "wood"); r(3, 211, 19, 2, 64, "dark");
  r(3, 190, 23, 39, 2, "wood");
  for (let step = 0; step < 8; step++) r(3, 192 + step * 2, 26 + step * 5, 17 - step * 2, 5, step % 2 ? "cream" : "pale");
  for (let step = 0; step < 7; step++) r(3, 214, 27 + step * 6, 15 - step * 2, 6, step % 2 ? "wall" : "cream");
  r(3, 184, 79, 50, 3, "lightStone");
  floor(r, { y: 96 });
  for (let x = 8; x < 230; x += 14) r(4, x, 100, 10, 1, "wood");
  r(3, 144, 86, 12, 10, "wood"); r(3, 145, 88, 10, 1, "sunlight"); r(3, 149, 86, 1, 10, "dark");
  jar(r, 127, 96); jar(r, 138, 96, "olive");
  r(5, 207, 108, 13, 1, "dark"); r(5, 208, 106, 11, 1, "wood");
}

function military(r) {
  sky(r); skyline(r); floor(r);
  r(1, 180, 44, 47, 43, "wall"); r(1, 183, 40, 41, 4, "lightStone");
  r(2, 185, 56, 5, 31, "wood"); r(2, 217, 56, 5, 31, "wood");
  r(2, 185, 56, 37, 3, "wood");
  for (const x of [192, 200, 209]) { r(3, x, 32, 2, 53, "dark"); r(3, x - 1, 29, 4, 5, "ink"); r(3, x, 27, 2, 3, "sand"); }
  steppedDisk(r, 3, 185, 67, 16, "clay"); steppedDisk(r, 3, 207, 66, 16, "blue");
  r(3, 192, 74, 2, 3, "sunlight"); r(3, 214, 73, 2, 3, "sunlight");
  person(r, 135, 95, { robe: "clay" });
  r(3, 130, 61, 10, 3, "sand"); r(3, 132, 57, 6, 4, "wood");
  r(3, 143, 54, 2, 41, "dark"); r(3, 142, 51, 4, 4, "ink");
  r(2, 113, 31, 2, 56, "dark"); r(2, 115, 34, 24, 11, "clay"); r(2, 115, 43, 15, 3, "wood");
  for (let x = 179; x < 229; x += 9) r(5, x, 102, 5, 2, "lightStone");
}

function market(r) {
  sky(r); skyline(r); floor(r);
  r(1, 179, 29, 57, 54, "lightStone");
  r(2, 177, 39, 61, 4, "wood"); r(2, 180, 43, 2, 45, "dark"); r(2, 232, 43, 2, 45, "dark");
  for (let i = 0; i < 9; i++) {
    r(2, 177 + i * 6, 34, 6, 10, i % 2 ? "cream" : "clay");
    r(2, 177 + i * 6, 44, 5, 3, i % 2 ? "wall" : "wood");
  }
  table(r, 183, 76, 49);
  person(r, 211, 76, { robe: "olive", height: 28, facing: -1 });
  for (let i = 0; i < 6; i++) { r(3, 185 + i * 7, 71, 6, 4, "sunlight"); r(3, 186 + i * 7, 70, 4, 1, "pale"); }
  jar(r, 220, 102, "olive"); jar(r, 230, 102); jar(r, 190, 102);
  r(3, 127, 83, 21, 11, "wood");
  for (let x = 129; x < 147; x += 4) r(3, x, 83, 2, 11, "sunlight");
  plant(r, 116, 96); hangingGarland(r, 181, 24, 53);
}

function astronomy(r) {
  courtyard(r, { night: true });
  r(1, 186, 63, 39, 25, "dark"); r(2, 184, 61, 43, 3, "sand");
  table(r, 190, 78, 36); scroll(r, 192, 67, 24); lamp(r, 217, 73);
  r(3, 134, 55, 2, 38, "wood"); r(3, 123, 62, 25, 2, "wood");
  r(3, 133, 54, 4, 3, "sunlight"); r(3, 126, 92, 19, 2, "dark");
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) r(3, 193 + col * 4, 69 + row * 2, 1, 1, "blue");
  r(5, 139, 23, 21, 1, "mist"); r(5, 160, 23, 1, 17, "mist");
  r(5, 146, 39, 15, 1, "mist");
  for (const [x, y] of [[138, 22], [159, 22], [159, 38], [145, 38]]) { r(5, x, y, 3, 3, "sunlight"); r(5, x + 1, y + 1, 1, 1, "pale"); }
}

function lyre(r, x, y) {
  r(3, x, y, 3, 19, "wood"); r(3, x + 14, y, 3, 19, "wood");
  r(3, x - 1, y - 2, 5, 4, "sunlight"); r(3, x + 13, y - 2, 5, 4, "sunlight");
  r(3, x + 2, y + 3, 13, 2, "sand");
  for (const dx of [5, 8, 11]) r(3, x + dx, y + 5, 1, 15, "cream");
  r(3, x + 1, y + 17, 15, 5, "clay"); r(3, x + 4, y + 22, 9, 2, "wood");
}

function music(r) {
  courtyard(r, { sunset: true, columns: true }); hangingGarland(r, 133, 20, 84);
  bench(r, 199, 88, 24); person(r, 209, 89, { robe: "clay", height: 29, seated: true, facing: -1 });
  lyre(r, 194, 60); r(3, 201, 71, 3, 2, "skin");
  r(4, 143, 98, 77, 8, "clay"); r(4, 146, 99, 71, 1, "sunlight"); r(4, 146, 104, 71, 1, "sunlight");
  for (let x = 149; x < 216; x += 8) r(4, x, 101, 3, 2, "cream");
  bench(r, 124, 91, 18); jar(r, 226, 106); plant(r, 118, 104);
}

function friendship(r) {
  sky(r); skyline(r); floor(r);
  r(1, 201, 17, 39, 71, "wall"); r(2, 204, 30, 24, 53, "wood");
  r(2, 207, 33, 18, 50, "dark");
  plant(r, 126, 104, { tall: true, olive: true });
  bench(r, 190, 89, 32); person(r, 202, 90, { robe: "olive", height: 30, seated: true, facing: -1 });
  jar(r, 224, 105); table(r, 137, 84, 16); r(3, 140, 80, 7, 4, "clay");
  r(3, 139, 79, 9, 1, "sunlight");
  for (let i = 0; i < 6; i++) r(5, 185 + i * 5, 27 + (i % 2) * 2, 3, 1, "pale");
}

function courtship(r) {
  sky(r, { sunset: true }); skyline(r, { water: true });
  floor(r, { y: 95 });
  r(2, 113, 78, 126, 4, "lightStone");
  for (let x = 119; x < 239; x += 16) r(2, x, 82, 3, 13, "sand");
  person(r, 198, 96, { robe: "blue", height: 30, facing: -1 });
  plant(r, 226, 107, { tall: true, olive: true });
  r(3, 181, 91, 7, 2, "clay"); r(3, 182, 90, 5, 1, "sunlight");
  r(3, 176, 94, 17, 2, "wood");
  r(5, 155, 49, 3, 1, "blue"); r(5, 158, 50, 3, 1, "blue"); r(5, 161, 49, 3, 1, "blue");
}

function marriage(r) {
  courtyard(r, { sunset: true, columns: true });
  hangingGarland(r, 130, 24, 88);
  person(r, 194, 96, { robe: "pale", height: 31, facing: -1 });
  table(r, 208, 78, 21); jar(r, 215, 78); lamp(r, 207, 73);
  r(4, 147, 98, 58, 7, "blue");
  for (let x = 151; x < 203; x += 6) { r(4, x, 99, 2, 1, "sunlight"); r(4, x, 103, 2, 1, "sunlight"); }
  plant(r, 129, 107, { tall: true });
  person(r, 223, 96, { robe: "olive", height: 26, facing: -1 });
}

function parenthood(r) {
  interior(r); bench(r, 190, 88, 33); cushion(r, 193, 83, 24);
  person(r, 212, 89, { robe: "olive", height: 30, seated: true, facing: -1 });
  // The child belongs only to the parenthood composition, never generic home.
  person(r, 189, 96, { robe: "clay", height: 16, facing: -1 });
  r(3, 185, 98, 4, 2, "sunlight"); r(3, 181, 102, 5, 2, "wood");
  r(3, 123, 86, 27, 4, "wood"); r(3, 125, 90, 3, 7, "dark"); r(3, 145, 90, 3, 7, "dark");
  r(3, 127, 81, 19, 5, "pale"); r(3, 130, 79, 14, 2, "sea");
  table(r, 222, 78, 13); lamp(r, 223, 74); jar(r, 113, 102, "olive");
}

function business(r) {
  interior(r, { opening: false }); window(r, 116, 16);
  r(2, 186, 20, 45, 3, "wood"); r(2, 186, 40, 45, 3, "wood");
  for (const x of [188, 200, 213, 223]) { jar(r, x, 40, x % 2 ? "olive" : "clay"); }
  table(r, 186, 77, 42); scroll(r, 187, 66, 22);
  person(r, 217, 77, { robe: "olive", height: 29, facing: -1 });
  for (const x of [211, 215, 219]) { r(3, x, 72, 3, 2, "sunlight"); r(3, x, 74, 3, 1, "wood"); }
  r(3, 130, 78, 18, 18, "wood"); r(3, 132, 80, 14, 1, "sunlight");
  r(3, 138, 78, 2, 18, "dark"); r(3, 130, 87, 18, 2, "dark");
  jar(r, 231, 105); lamp(r, 217, 40);
}

function illness(r) {
  interior(r, { night: true, opening: false }); window(r, 193, 16, true);
  r(3, 146, 89, 65, 7, "wood"); r(3, 149, 96, 4, 7, "dark"); r(3, 205, 96, 4, 7, "dark");
  r(3, 147, 84, 62, 5, "cream"); cushion(r, 148, 79, 18, "pale");
  r(3, 164, 79, 32, 7, "blue"); r(3, 166, 80, 28, 1, "teal");
  person(r, 220, 96, { robe: "olive", height: 31, facing: -1 });
  table(r, 207, 81, 21); jar(r, 216, 81, "olive"); lamp(r, 208, 77);
  r(3, 126, 78, 8, 3, "clay"); r(3, 127, 76, 6, 2, "sunlight");
}

function recovery(r) {
  courtyard(r, { columns: true });
  r(3, 146, 89, 65, 7, "wood"); r(3, 149, 96, 4, 7, "dark"); r(3, 205, 96, 4, 7, "dark");
  r(3, 147, 84, 62, 5, "cream"); cushion(r, 148, 79, 18, "pale");
  r(3, 168, 81, 33, 3, "sea");
  person(r, 220, 96, { robe: "olive", height: 29, facing: -1 });
  table(r, 213, 85, 15); jar(r, 218, 85, "olive");
  plant(r, 221, 107, { tall: true, olive: true });
  r(3, 133, 72, 2, 28, "wood"); r(3, 133, 72, 8, 2, "wood");
  r(3, 132, 99, 4, 2, "dark");
  r(5, 184, 30, 8, 1, "pale"); r(5, 181, 34, 5, 1, "pale");
}

function debt(r) {
  interior(r, { opening: false }); window(r, 116, 19);
  table(r, 185, 75, 43); scroll(r, 188, 65, 21);
  person(r, 218, 75, { robe: "dark", height: 29, facing: -1 });
  r(3, 212, 68, 7, 3, "sunlight"); r(3, 213, 66, 5, 2, "sunlight");
  r(3, 211, 71, 9, 1, "wood");
  r(2, 191, 25, 35, 3, "wood"); jar(r, 197, 25, "olive"); jar(r, 215, 25);
  r(3, 130, 81, 16, 12, "dark"); r(3, 133, 78, 10, 3, "wood");
  r(3, 130, 85, 16, 1, "clay"); lamp(r, 218, 40);
  r(3, 205, 53, 1, 10, "wood"); r(3, 202, 52, 8, 2, "wood");
}

function danger(r) {
  sky(r, { sunset: true, cloud: false });
  r(1, 0, 55, 240, 40, "wall");
  r(1, 112, 6, 32, 89, "wood"); r(2, 116, 9, 24, 86, "shade");
  r(1, 216, 8, 24, 88, "dark"); r(2, 216, 8, 5, 88, "wood");
  r(1, 144, 44, 72, 51, "wall"); r(2, 173, 54, 20, 41, "dark");
  r(2, 175, 57, 16, 38, "wood");
  for (let row = 0; row < 5; row++) { r(2, 146, 50 + row * 9, 68, 1, "sand"); r(2, 149 + (row % 2) * 11, 51 + row * 9, 1, 7, "sand"); }
  for (let row = 0; row < 8; row++) {
    r(2, 116, 14 + row * 10, 24, 1, "wood");
    r(2, 120 + (row % 2) * 9, 15 + row * 10, 1, 7, "sand");
    r(2, 222, 15 + row * 10, 18, 1, "wood");
    r(2, 226 + (row % 2) * 8, 16 + row * 10, 1, 7, "shade");
  }
  r(2, 147, 46, 25, 3, "lightStone");
  r(2, 196, 46, 19, 3, "mortar");
  r(2, 177, 58, 2, 35, "sand");
  r(2, 188, 58, 2, 35, "dark");
  floor(r, { dark: true, y: 95 });
  person(r, 199, 98, { robe: "dark", height: 34, facing: -1 });
  person(r, 226, 99, { robe: "wood", height: 35, facing: -1 });
  r(3, 206, 76, 2, 22, "wood"); jar(r, 131, 106);
  r(5, 151, 104, 10, 1, "ink"); r(5, 180, 108, 17, 1, "ink");
}

function war(r) {
  sky(r, { sunset: true, cloud: false }); skyline(r, { water: true });
  r(1, 184, 49, 18, 28, "dark"); r(1, 207, 42, 22, 37, "wood");
  for (const [x, y] of [[189, 50], [215, 45], [222, 52]]) {
    r(3, x, y, 3, 9, "clay"); r(3, x + 1, y + 3, 1, 7, "sunlight");
  }
  for (const [x, y, w] of [[189, 28, 7], [193, 20, 11], [198, 12, 15], [219, 26, 9], [218, 15, 14]]) {
    r(5, x, y, w, 7, "mist"); r(5, x + 2, y - 2, w - 3, 3, "mist");
  }
  floor(r, { y: 96 });
  r(3, 200, 89, 29, 5, "wood"); r(3, 205, 94, 18, 2, "dark");
  r(3, 210, 60, 2, 29, "dark");
  for (let i = 0; i < 6; i++) r(3, 212, 63 + i * 4, 12 - i * 2, 4, "wall");
  person(r, 132, 96, { height: 28, robe: "dark" });
  jar(r, 144, 96); r(3, 115, 86, 11, 9, "wood");
}

function civic(r) {
  sky(r); skyline(r); floor(r);
  r(1, 136, 32, 104, 55, "wall");
  r(2, 132, 27, 108, 5, "lightStone"); r(2, 138, 22, 97, 5, "cream");
  column(r, 143, 32, 56); column(r, 222, 32, 56);
  r(2, 184, 42, 22, 42, "shade"); r(2, 187, 45, 16, 39, "dark");
  r(3, 202, 53, 17, 23, "wood"); r(3, 204, 55, 13, 19, "pale");
  for (let row = 0; row < 4; row++) r(3, 207, 59 + row * 3, 7, 1, "mortar");
  person(r, 190, 95, { robe: "olive", height: 27, facing: -1 });
  person(r, 230, 96, { robe: "clay", height: 29, facing: -1 });
  r(2, 133, 87, 107, 3, "cream"); r(4, 129, 91, 111, 3, "lightStone");
}

function retirement(r) {
  courtyard(r, { sunset: true, columns: true });
  bench(r, 148, 90, 38); cushion(r, 153, 85, 27);
  plant(r, 218, 107, { tall: true, olive: true });
  table(r, 189, 83, 17); lamp(r, 192, 78); jar(r, 196, 83);
  r(3, 139, 73, 2, 29, "wood"); r(3, 140, 72, 7, 2, "wood");
  scroll(r, 192, 97, 18); r(3, 205, 96, 3, 3, "wood");
  r(5, 183, 42, 6, 1, "blue"); r(5, 189, 43, 6, 1, "blue"); r(5, 195, 42, 6, 1, "blue");
}

function memorial(r) {
  sky(r, { sunset: true, cloud: false }); skyline(r, { water: true });
  floor(r, { y: 96 });
  r(2, 199, 56, 18, 40, "lightStone"); r(2, 201, 52, 14, 4, "cream");
  r(2, 203, 50, 10, 2, "cream"); r(2, 201, 59, 2, 33, "pale");
  r(2, 213, 59, 3, 35, "sand"); r(2, 196, 94, 24, 4, "sand");
  r(2, 193, 98, 30, 3, "wood");
  r(3, 205, 64, 6, 1, "mortar"); r(3, 205, 69, 6, 1, "mortar");
  r(3, 205, 74, 6, 1, "mortar");
  lamp(r, 177, 94); jar(r, 225, 100, "olive");
  r(3, 170, 102, 24, 2, "wood");
  for (let i = 0; i < 6; i++) {
    r(3, 172 + i * 4, 99 - (i % 2) * 3, 4, 2, "olive");
    r(3, 174 + i * 3, 104, 3, 2, "leaf");
  }
  r(5, 126, 30, 8, 1, "blue"); r(5, 134, 31, 8, 1, "blue"); r(5, 142, 30, 8, 1, "blue");
}

const compositions = {
  home, courtyard: playCourtyard, study, workshop, sculpture, philosophy,
  harbor, military, market, astronomy, music, friendship, courtship, marriage,
  parenthood, business, illness, recovery, debt, danger, war, civic, retirement,
  memorial,
};

export function createBannerLayers(id) {
  if (!BANNER_SITUATIONS.includes(id)) throw new Error(`Unknown banner situation ${id}`);
  const { layers, rect } = canvas();
  compositions[id](rect);
  if (!layers[4].rects.length) {
    for (const x of [126, 192, 219]) rect(4, x, 99, 12, 1, "shade");
  }
  return layers;
}
