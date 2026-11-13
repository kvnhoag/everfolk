#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pixelArt } from './lib/pixel-art-filter.mjs';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = createRequire(require.resolve('next/package.json'))('sharp'); }
const help = `Everfolk deterministic pixel-art filter
node scripts/pixel-art-filter.mjs INPUT OUTPUT [options]
  --width 100           Logical width; height preserves aspect unless specified
  --height 200          Explicit logical height; use same dimensions for all layers
  --colors 24           Adaptive palette size (2–256)
  --scale 4             Exact integer enlargement (1–16)
  --preset chiaroscuro  Authored 24-colour palette, width128, scale3, cleanup3
  --palette FILE        Reuse a palette JSON (array or {colors:[...]})
  --contrast 0.2        Restrained local edge emphasis (0–1)
  --cleanup 2           Low-contrast singleton cleanup passes (0–5)
  --dither 0            Sparse ordered dither in quiet transitions (0–1)
  --alpha-mode binary  binary (hard edges) or coverage (preserve cell opacity)
Writes OUTPUT, OUTPUT.logical.png, OUTPUT.palette.json, OUTPUT.filter.json.
No blur. No interpolated resize. Existing outputs require --overwrite.
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) { console.log(help); return; }
  const input = args.shift(), output = args.shift();
  if (!input || !output || output.startsWith('--')) throw new Error(help);
  let options = {};
  const accepted = new Set(['width', 'height', 'colors', 'scale', 'contrast', 'cleanup', 'dither', 'palette', 'alpha-mode', 'preset']);
  let overwrite = false, palettePath, preset;
  while (args.length) {
    const key = args.shift();
    if (key === '--overwrite') { overwrite = true; continue; }
    const name = key?.slice(2), value = args.shift();
    if (!key?.startsWith('--') || !accepted.has(name) || value === undefined || value.startsWith('--')) throw new Error(`Invalid option ${key}\n${help}`);
    if (name === 'preset') { if (value !== 'chiaroscuro') throw new Error(`Unknown preset: ${value}`); preset = value; }
    else if (name === 'palette') palettePath = path.resolve(value);
    else if (name === 'alpha-mode') options.alphaMode = value;
    else { options[name] = Number(value); if (!Number.isFinite(options[name])) throw new Error(`Invalid numeric option ${key}`); }
  }
  if (preset) options = { ...JSON.parse(await readFile(new URL(`./pixel-art-presets/${preset}.json`, import.meta.url), 'utf8')), ...options };
  if (preset && options.colors !== undefined && !palettePath) { delete options.palette; }
  const inputPath = path.resolve(input), outputPath = path.resolve(output);
  if (!/\.png$/i.test(outputPath)) throw new Error('Output must be a lossless .png file.');
  const stem = outputPath.slice(0, -4);
  const paths = { image: outputPath, logical: `${stem}.logical.png`, palette: `${stem}.palette.json`, metadata: `${stem}.filter.json` };
  if (Object.values(paths).some(p => p.toLowerCase() === inputPath.toLowerCase() || p.toLowerCase() === palettePath?.toLowerCase())) throw new Error('Outputs must not overwrite input artwork or the input palette.');
  if (palettePath) { const loaded = JSON.parse(await readFile(palettePath, 'utf8')); options.palette = Array.isArray(loaded) ? loaded : loaded.colors; if (!options.palette) throw new Error('Palette file needs an array or a colors array.'); }
  // Reserve all outputs before decoding, so existing files cannot be silently replaced.
  const { open, unlink } = await import('node:fs/promises');
  await mkdir(path.dirname(outputPath), { recursive: true });
  const reserved = [];
  if (!overwrite) {
    try { for (const filename of Object.values(paths)) { const file = await open(filename, 'wx'); await file.close(); reserved.push(filename); } }
    catch (error) { await Promise.all(reserved.map(filename => unlink(filename))); throw error; }
  }
  try {
    const source = await readFile(inputPath), hash = value => createHash('sha256').update(value).digest('hex');
    const { data, info } = await sharp(source).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = pixelArt(data, info.width, info.height, options);
    await sharp(result.data, { raw: { width: result.width, height: result.height, channels: 4 } }).png().toFile(paths.image);
    await sharp(result.logical, { raw: { width: result.logicalWidth, height: result.logicalHeight, channels: 4 } }).png().toFile(paths.logical);
    await writeFile(paths.palette, JSON.stringify({ name: 'Everfolk Chiaroscuro pixel palette', colors: result.palette }, null, 2) + '\n');
    await writeFile(paths.metadata, JSON.stringify({ input: inputPath, inputSha256: hash(source), outputSha256: hash(await readFile(paths.image)),
      source: { width: info.width, height: info.height }, logical: { width: result.logicalWidth, height: result.logicalHeight }, output: { width: result.width, height: result.height },
      options: { ...options, preset: preset ?? null, palette: palettePath ?? (options.palette ? `preset:${preset}` : 'adaptive') }, stats: result.stats, paths }, null, 2) + '\n');
    console.log(JSON.stringify({ output: paths.image, logical: [result.logicalWidth, result.logicalHeight], size: [result.width, result.height], ...result.stats }));
  } catch (error) { if (!overwrite) await Promise.all(reserved.map(filename => unlink(filename).catch(() => {}))); throw error; }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
