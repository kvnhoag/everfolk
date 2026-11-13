// Deterministic pixel-art abstraction. No spatial blur or interpolating resize.
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const linear = x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
const gamma = x => x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;

export function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(v => linear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function labToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map(v => Math.round(clamp(gamma(clamp(v))) * 255));
}

const distance = (a, b) => 1.4 * (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');

export function parsePalette(colours) {
  if (!Array.isArray(colours) || colours.length < 1 || colours.length > 256) throw new Error('Palette needs 1–256 RGB hex colours.');
  const values = colours.map(value => {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid palette colour: ${value}`);
    return [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  });
  return [...new Map(values.map(rgb => [hex(rgb), rgb])).values()];
}

function weightedMedian(samples, channel) {
  const sorted = [...samples].sort((a, b) => a.lab[channel] - b.lab[channel]);
  const half = sorted.reduce((sum, item) => sum + item.weight, 0) / 2;
  let total = 0;
  for (const sample of sorted) { total += sample.weight; if (total >= half) return sample.lab[channel]; }
  return sorted.at(-1).lab[channel];
}

// Select an actual source colour nearest the weighted perceptual median.
// Unlike a box average, a two-colour boundary never acquires a third colour.
export function sampleCells(rgba, sourceWidth, sourceHeight, width, height, alphaMode = 'binary') {
  if (!Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) || sourceWidth < 1 || sourceHeight < 1 || rgba.length !== sourceWidth * sourceHeight * 4) throw new Error('Invalid source RGBA buffer or dimensions.');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > sourceWidth || height > sourceHeight) throw new Error('Logical grid must fit inside the source.');
  if (!['binary', 'coverage'].includes(alphaMode)) throw new Error('alphaMode must be binary or coverage.');
  const samples = [];
  const cache = new Map();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.floor(x * sourceWidth / width), x1 = Math.floor((x + 1) * sourceWidth / width);
    const y0 = Math.floor(y * sourceHeight / height), y1 = Math.floor((y + 1) * sourceHeight / height);
    const cell = [];
    let alphaSum = 0;
    let sampled = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      const i = (sy * sourceWidth + sx) * 4, alpha = rgba[i + 3] / 255;
      sampled++; alphaSum += alpha;
      if (!alpha) continue; // Invisible RGB cannot darken an edge or train the palette.
      const rgb = [rgba[i], rgba[i + 1], rgba[i + 2]], key = rgb.join(',');
      if (!cache.has(key)) { if (cache.size >= 65536) cache.clear(); cache.set(key, rgbToLab(rgb)); }
      const cx = (sx + 0.5 - x0) / (x1 - x0) - 0.5;
      const cy = (sy + 0.5 - y0) / (y1 - y0) - 0.5;
      cell.push({ rgb, lab: cache.get(key), weight: alpha * (1 - 0.35 * (cx * cx + cy * cy)) });
    }
    const coverage = alphaSum / sampled;
    const alpha = alphaMode === 'binary' ? (coverage >= 0.5 ? 255 : 0) : Math.round(coverage * 255);
    if (!cell.length || alpha === 0) { samples.push({ rgb: [0, 0, 0], lab: [0, 0, 0], alpha: 0 }); continue; }
    const median = [0, 1, 2].map(c => weightedMedian(cell, c));
    let representative = cell[0], best = Infinity;
    for (const candidate of cell) {
      const error = distance(candidate.lab, median) / Math.sqrt(candidate.weight);
      if (error < best) { best = error; representative = candidate; }
    }
    samples.push({ rgb: [...representative.rgb], lab: [...representative.lab], alpha });
  }
  return samples;
}

export function learnPalette(samples, count = 24) {
  if (!Number.isInteger(count) || count < 2 || count > 256) throw new Error('Colour count must be 2–256.');
  const bins = new Map();
  for (const sample of samples) {
    if (!sample.alpha) continue;
    const key = sample.rgb.map(v => v >> 3).join(',');
    if (!bins.has(key)) bins.set(key, { sum: [0, 0, 0], weight: 0 });
    const bin = bins.get(key), weight = sample.alpha / 255;
    bin.weight += weight;
    sample.lab.forEach((v, c) => { bin.sum[c] += v * weight; });
  }
  if (!bins.size) return [[0, 0, 0]];
  const points = [...bins.values()].map(bin => ({ lab: bin.sum.map(v => v / bin.weight), weight: bin.weight }));
  const bandWeights = Array(10).fill(0);
  for (const p of points) { p.band = Math.min(9, Math.floor(p.lab[0] * 10)); bandWeights[p.band] += p.weight; }
  // Sublinear band balancing leaves skin highlights room beside a dark backdrop.
  for (const p of points) p.weight /= Math.sqrt(bandWeights[p.band]);
  const centres = [[...points.reduce((a, b) => a.weight > b.weight ? a : b).lab]];
  while (centres.length < Math.min(count, points.length)) {
    let next, best = -1;
    for (const p of points) {
      const score = Math.min(...centres.map(c => distance(p.lab, c))) * Math.sqrt(p.weight);
      if (score > best) { best = score; next = p.lab; }
    }
    if (best <= 1e-14) break;
    centres.push([...next]);
  }
  for (let iteration = 0; iteration < 16; iteration++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of points) {
      let index = 0, best = Infinity;
      centres.forEach((c, i) => { const d = distance(p.lab, c); if (d < best) { index = i; best = d; } });
      p.lab.forEach((v, i) => { sums[index][i] += v * p.weight; }); sums[index][3] += p.weight;
    }
    sums.forEach((sum, i) => { if (sum[3]) centres[i] = sum.slice(0, 3).map(v => v / sum[3]); });
  }
  return [...new Map(centres.map(labToRgb).map(rgb => [hex(rgb), rgb])).values()].sort((a, b) => rgbToLab(a)[0] - rgbToLab(b)[0]);
}

function neighbours(index, width, height) {
  const x = index % width, y = Math.floor(index / width), result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
    result.push((y + dy) * width + x + dx);
  }
  return result;
}

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export function indexPixels(samples, palette, width, height, { contrast = 0.2, cleanup = 2, dither = 0 } = {}) {
  const labs = palette.map(rgbToLab), indices = new Int16Array(samples.length).fill(-1);
  const neighboursByIndex = samples.map((_, index) => neighbours(index, width, height));
  let removedSpeckles = 0;
  samples.forEach((sample, index) => {
    if (!sample.alpha) return;
    const adjacent = neighboursByIndex[index].filter(i => samples[i].alpha);
    const mean = adjacent.length ? adjacent.reduce((sum, i) => sum + samples[i].lab[0], 0) / adjacent.length : sample.lab[0];
    const target = [...sample.lab];
    target[0] = clamp(target[0] + clamp((target[0] - mean) * contrast, -0.025, 0.025));
    let best = 0, second = 0, d1 = Infinity, d2 = Infinity;
    labs.forEach((lab, i) => {
      const d = distance(target, lab);
      if (d < d1) { second = best; d2 = d1; best = i; d1 = d; }
      else if (d < d2) { second = i; d2 = d; }
    });
    // Optional sparse ordered dithering only in quiet, low-contrast transitions.
    const localRange = adjacent.length ? Math.max(...adjacent.map(i => samples[i].lab[0])) - Math.min(...adjacent.map(i => samples[i].lab[0])) : 0;
    if (dither > 0 && localRange < 0.055 && Math.abs(labs[best][0] - labs[second][0]) < 0.13) {
      const vector = labs[second].map((v, c) => v - labs[best][c]);
      const norm = vector.reduce((s, v) => s + v * v, 0);
      const fraction = norm ? clamp(vector.reduce((s, v, c) => s + (target[c] - labs[best][c]) * v, 0) / norm) : 0;
      const x = index % width, y = Math.floor(index / width);
      if (fraction * dither > (bayer[(y % 4) * 4 + x % 4] + 0.5) / 16) best = second;
    }
    indices[index] = best;
  });
  for (let pass = 0; pass < cleanup; pass++) {
    const before = indices.slice();
    before.forEach((current, index) => {
      if (current < 0) return;
      const adjacent = neighboursByIndex[index].filter(i => before[i] >= 0);
      if (adjacent.length < 5) return;
      const counts = new Map();
      adjacent.forEach(i => counts.set(before[i], (counts.get(before[i]) ?? 0) + 1));
      const [candidate, votes] = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      const currentVotes = counts.get(current) ?? 0;
      if (candidate === current || votes < Math.ceil(adjacent.length * 0.5) || votes < currentVotes + 2) return;
      // A high-contrast eye glint or contour is never erased as mere grain.
      if (distance(labs[current], labs[candidate]) > 0.006 || Math.abs(labs[current][0] - labs[candidate][0]) > 0.062) return;
      indices[index] = candidate; removedSpeckles++;
    });
  }
  return { indices, removedSpeckles };
}

export function enlargeNearest(logical, width, height, scale) {
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) throw new Error('Scale must be an integer between 1 and 16.');
  const output = new Uint8Array(width * height * scale * scale * 4), outputWidth = width * scale;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (y * width + x) * 4;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const destination = ((y * scale + dy) * outputWidth + x * scale + dx) * 4;
      output.set(logical.subarray(source, source + 4), destination);
    }
  }
  return output;
}

export function pixelArt(rgba, sourceWidth, sourceHeight, options = {}) {
  const width = options.width ?? 100, height = options.height ?? Math.round(width * sourceHeight / sourceWidth);
  const scale = options.scale ?? 4, count = options.colors ?? 24;
  if (!Number.isFinite(options.contrast ?? 0.2) || (options.contrast ?? 0.2) < 0 || (options.contrast ?? 0.2) > 1) throw new Error('Contrast must be between 0 and 1.');
  if (!Number.isInteger(options.cleanup ?? 2) || (options.cleanup ?? 2) < 0 || (options.cleanup ?? 2) > 5) throw new Error('Cleanup must be an integer from 0 to 5.');
  if (!Number.isFinite(options.dither ?? 0) || (options.dither ?? 0) < 0 || (options.dither ?? 0) > 1) throw new Error('Dither must be between 0 and 1.');
  const samples = sampleCells(rgba, sourceWidth, sourceHeight, width, height, options.alphaMode ?? 'binary');
  const palette = options.palette ? parsePalette(options.palette) : learnPalette(samples, count);
  const { indices, removedSpeckles } = indexPixels(samples, palette, width, height, options);
  const logical = new Uint8Array(width * height * 4);
  indices.forEach((index, i) => { if (index >= 0) { logical.set(palette[index], i * 4); logical[i * 4 + 3] = samples[i].alpha; } });
  const data = enlargeNearest(logical, width, height, scale);
  const used = new Set([...indices].filter(i => i >= 0));
  return { data, logical, width: width * scale, height: height * scale, logicalWidth: width, logicalHeight: height,
    palette: palette.map(hex), stats: { paletteSize: palette.length, coloursUsed: used.size, removedSpeckles, scale, dither: options.dither ?? 0,
      alphaMode: options.alphaMode ?? 'binary', sampling: 'perceptual-medoid', enlargement: 'integer-nearest', blur: false } };
}
