#!/usr/bin/env node
/** Portable illustration replacement: approved frames are never rasterized again. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const kitRoot = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch {
  try { sharp = createRequire(require.resolve('next/package.json'))('sharp'); }
  catch { throw Error('Run npm install in the extracted card-art kit first (Node 24 or later).'); }
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const need = (value, message) => { if (!value) throw Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
const cleanPath = value => value.split('\\').join('/');
const rgba = async input => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const png = async input => sharp(input).png().toBuffer();

export function containedPath(root, name) {
  need(typeof name === 'string' && name && !isAbsolute(name), 'Expected a relative asset path');
  const file = resolve(root, name), rel = relative(root, file);
  need(rel && !rel.startsWith('..') && !isAbsolute(rel), 'Asset path escapes its bundle: ' + name);
  if (existsSync(file)) {
    const real = relative(realpathSync(root), realpathSync(file));
    need(real && !real.startsWith('..') && !isAbsolute(real), 'Asset symlink escapes its bundle: ' + name);
  }
  return file;
}

export function loadKit(root = kitRoot) {
  const bytes = readFileSync(resolve(root, 'data/cards.json'));
  const data = JSON.parse(bytes.toString('utf8'));
  need(data.id === 'everfolk-card-art-handoff-v1' && data.complete && data.assets.length === 117 && data.parentVariants.length >= 16, 'Incomplete or incompatible card-art kit');
  const rows = [...data.assets, ...data.parentVariants];
  need(new Set(rows.map(row => row.id)).size === rows.length, 'Duplicate kit card IDs');
  return { root, data, rows, manifestSha256: sha256(bytes) };
}

async function readArtwork(file, width, height, mode = 'finished') {
  need(['finished', 'native-pixel'].includes(mode), 'Mode must be finished or native-pixel');
  const bytes = readFileSync(file), meta = await sharp(bytes).metadata();
  need(meta.format === 'png', 'Artwork must be a lossless PNG: ' + file);
  need(meta.depth === 'uchar', 'Artwork must use 8-bit RGB or RGBA pixels: ' + file);
  need(!meta.pages || meta.pages === 1, 'Animated artwork is unsupported');
  need(!meta.orientation || meta.orientation === 1, 'Apply orientation before exporting artwork');
  const factor = width / meta.width;
  need(width * meta.height === height * meta.width, `Wrong aspect ratio: expected ${width}:${height}, received ${meta.width}×${meta.height}`);
  need(mode === 'finished' ? meta.width === width && meta.height === height : Number.isInteger(factor) && factor >= 1 && factor <= 8,
    mode === 'finished' ? `Finished artwork must be exactly ${width}×${height}` : `Native pixel artwork must be an integer divisor of ${width}×${height}, scale 1–8`);
  const raw = await rgba(bytes);
  for (let p = 3; p < raw.data.length; p += 4) need(raw.data[p] === 255, 'Artwork must be opaque; composite its background before export');
  // Normalize before resize: a WebP decoder can otherwise shrink before nearest resampling.
  const normalized = await png(bytes);
  const result = meta.width === width ? normalized : await sharp(normalized).resize(width, height, { kernel: 'nearest' }).png().toBuffer();
  return { png: result, inputSha256: sha256(bytes), inputSize: [meta.width, meta.height], scale: factor, mode };
}

/** Match the approved v14 fitting geometry; optional standardArt avoids fractional grid fitting. */
export async function fitArtwork(portrait, row, kit, standardArt) {
  const source = await png(portrait);
  let layers;
  if (row.fit === 'standard') {
    const art = standardArt ?? await sharp(source).resize(592, 740, { kernel: 'nearest' }).png().toBuffer();
    const matte = await sharp({ create: { width: 800, height: 740, channels: 4, background: kit.data.palettes[row.rarity].matte } }).png().toBuffer();
    layers = [{ input: matte, left: 50, top: 190 }, { input: art, left: 154, top: 190 }];
  } else {
    const top = await sharp(source).extract({ left: 0, top: 0, width: 840, height: 1 }).resize(840, 140, { kernel: 'nearest' }).png().toBuffer();
    const bottom = await sharp(source).extract({ left: 0, top: 1049, width: 840, height: 1 }).resize(840, 70, { kernel: 'nearest' }).png().toBuffer();
    const side = async left => {
      const edge = await sharp(source).extract({ left: left ? 0 : 828, top: 0, width: 12, height: 1050 }).resize(10, 420, { kernel: 'lanczos3' }).png().toBuffer();
      return sharp(edge).resize(30, 1260, { kernel: 'nearest' }).png().toBuffer();
    };
    layers = [{ input: await side(true), left: 0, top: 0 }, { input: await side(false), left: 870, top: 0 }, { input: top, left: 30, top: 0 }, { input: bottom, left: 30, top: 1190 }, { input: source, left: 30, top: 140 }];
  }
  let result = await sharp({ create: { width: 900, height: 1260, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
  if (row.fit === 'legendary') result = await sharp(result).composite([{ input: Buffer.from('<svg width="900" height="1260"><rect width="900" height="1260" rx="42" fill="white"/></svg>'), blend: 'dest-in' }]).png().toBuffer();
  return result;
}

function frameBytes(kit, row, key) {
  const bytes = readFileSync(containedPath(kit.root, row[key]));
  need(sha256(bytes) === row.hashes[key].sha256, 'Approved frame changed: ' + row.id + '/' + key);
  return bytes;
}

async function composite(kit, row, fit, key) {
  return sharp(fit).composite([{ input: frameBytes(kit, row, key) }]).png().toBuffer();
}

async function writeImage(out, name, input, webp = true) {
  const path = cleanPath(name), file = containedPath(out, path);
  mkdirSync(dirname(file), { recursive: true });
  const raw = await rgba(input);
  const bytes = webp ? await sharp(input).webp({ lossless: true, exact: true, alphaQuality: 100, effort: 6 }).toBuffer() : await png(input);
  writeFileSync(file, bytes);
  const check = await rgba(readFileSync(file));
  need(check.data.equals(raw.data), 'Lossless readback mismatch: ' + path);
  return { path, sha256: sha256(bytes), rgbaSha256: sha256(raw.data), width: raw.info.width, height: raw.info.height, bytes: bytes.length };
}

async function verifyUncovered(fitted, overlay, final, id) {
  const [under, over, result] = await Promise.all([rgba(fitted), rgba(overlay), rgba(final)]);
  let checked = 0;
  for (let p = 0; p < under.data.length; p += 4) if (under.data[p + 3] === 255 && over.data[p + 3] === 0) {
    checked++;
    need(under.data.subarray(p, p + 4).equals(result.data.subarray(p, p + 4)), 'Uncovered illustration pixel changed: ' + id);
  }
  need(checked > 500000, 'Too little exposed artwork: ' + id);
  for (const p of [0, 899 * 4, 1259 * 900 * 4, (900 * 1260 - 1) * 4]) need(result.data[p + 3] === 0, 'Card outer corner must be transparent: ' + id);
  return checked;
}

export async function renderBatch({ items, out, root = kitRoot }) {
  const kit = loadKit(root);
  need(Array.isArray(items) && items.length > 0, 'A replacement batch needs at least one artwork');
  need(new Set(items.map(item => item.id)).size === items.length, 'Duplicate replacement IDs');
  const prepared = [];
  // Validate all artist inputs before creating output, including partial batches.
  for (const item of items) {
    const row = kit.data.assets.find(row => row.id === item.id);
    need(row, 'Unknown base card ID: ' + item.id + '; use list to select an immutable ID');
    need(item.art, 'Missing art path: ' + item.id);
    const art = await readArtwork(resolve(item.art), 840, 1050, item.mode ?? 'finished');
    const standard = item.standardArt ? await readArtwork(resolve(item.standardArt), 592, 740, item.mode ?? 'finished') : null;
    prepared.push({ row, art, standard });
  }
  out = resolve(out);
  need(!existsSync(out) || readdirSync(out).length === 0, 'Choose a new, empty output directory; existing artwork is never overwritten');
  mkdirSync(out, { recursive: true });
  const assets = [];
  for (const { row: base, art, standard } of prepared) {
    const portrait = await writeImage(out, 'webp/' + base.id + '-portrait.webp', art.png);
    const standardFile = standard ? await writeImage(out, 'sources/' + base.id + '-standard.png', standard.png, false) : null;
    const related = [base, ...kit.data.parentVariants.filter(variant => variant.variantOf === base.id)];
    for (const row of related) {
      const fitted = await fitArtwork(art.png, row, kit, standard?.png);
      const footerless = await composite(kit, row, fitted, 'footerlessFrame');
      const files = { footerless: await writeImage(out, 'webp/' + row.id + '-footerless.webp', footerless) };
      const checked = await verifyUncovered(fitted, frameBytes(kit, row, 'footerlessFrame'), footerless, row.id);
      await writeImage(out, 'png/' + row.id + '-footerless.png', footerless, false);
      await writeImage(out, 'png/' + row.id + '-fitted.png', fitted, false);
      if (!row.variantOf) {
        const full = await composite(kit, row, fitted, 'frame');
        const thumb = await sharp(full).resize(450, 630, { kernel: 'nearest' }).png().toBuffer();
        files.full = await writeImage(out, 'webp/' + row.id + '.webp', full);
        files.thumbnail = await writeImage(out, 'webp/' + row.id + '-thumb.webp', thumb);
        files.portrait = portrait;
        if (standardFile) files.standardArt = standardFile;
        await writeImage(out, 'png/' + row.id + '.png', full, false);
        await writeImage(out, 'png/' + row.id + '-portrait.png', art.png, false);
        // Keeps frame/type/icon nodes editable in an ordinary SVG editor.
        const overlay = readFileSync(containedPath(root, row.footerlessOverlaySvg), 'utf8');
        const image = `<g id="Artwork_fitted_bitmap"><image width="900" height="1260" image-rendering="pixelated" href="data:image/png;base64,${fitted.toString('base64')}"/></g>`;
        mkdirSync(resolve(out, 'editable'), { recursive: true });
        writeFileSync(resolve(out, 'editable', row.id + '.svg'), overlay.replace(/(<svg\b[^>]*>)/, '$1\n' + image));
      }
      assets.push({ id: row.id, ...(row.variantOf ? { variantOf: row.variantOf } : {}), artMode: art.mode, inputSha256: art.inputSha256, inputSize: art.inputSize, portraitSha256: portrait.sha256,
        ...(standard ? { standardArtSha256: standardFile.sha256, standardInputSha256: standard.inputSha256 } : {}),
        frameSha256: row.hashes.frame.sha256, footerlessFrameSha256: row.hashes.footerlessFrame.sha256,
        fit: { layout: row.fit, rect: row.artRect, sourceCropped: false, kernel: 'nearest', standardGridPreserved: row.fit === 'standard' ? Boolean(standard) : null, logicalEnlargement: art.scale,
          note: row.fit === 'standard' && !standard ? '840×1050 to 592×740 is fractional nearest fitting. Supply --standard-art for a separately finished, regular pixel grid.' : 'Main illustration uses native size or integer enlargement; legendary side atmosphere is separately extended.' },
        qa: { uncoveredPixelsChecked: checked, uncoveredPixelDifferences: 0, transparentOuterCorners: true, losslessRGBAReadback: true }, files });
    }
  }
  const manifest = { schemaVersion: 1, type: 'everfolk-card-art-replacement', kitId: kit.data.id, kitManifestSha256: kit.manifestSha256, createdAt: new Date().toISOString(), exampleSerialsAreIssuedCopies: false, assets };
  writeFileSync(resolve(out, 'replacement.json'), json(manifest));
  await writeBundleReview(out, manifest, kit);
  return { output: out, baseCards: prepared.length, runtimeVariants: assets.length - prepared.length, assets: assets.length, manifest: resolve(out, 'replacement.json') };
}

async function writeBundleReview(out, manifest, kit) {
  const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  mkdirSync(resolve(out, 'reference'), { recursive: true });
  const cards = manifest.assets.filter(row => !row.variantOf).map(entry => {
    const row = kit.rows.find(row => row.id === entry.id);
    const reference = 'reference/' + row.id + '.webp';
    writeFileSync(resolve(out, reference), readFileSync(containedPath(kit.root, row.preview)));
    return `<article><h2>${esc(row.title)}</h2><code>${esc(row.id)}</code><p>${esc(row.rarity)} · ${esc(row.gender)} · ${esc(row.subtitle)}</p><div class="pair"><figure><img src="${esc(reference)}"><figcaption>Approved reference</figcaption></figure><figure><img src="${esc(entry.files.full.path)}"><figcaption>Replacement · example serial only</figcaption></figure></div><p>${esc(entry.fit.note)}</p></article>`;
  }).join('');
  writeFileSync(resolve(out, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Everfolk replacement review</title><style>body{max-width:1100px;margin:40px auto;padding:20px;background:#101b18;color:#eee2c5;font:16px system-ui}article{border-top:1px solid #ae8e53;padding:20px 0}.pair{display:flex;gap:24px;flex-wrap:wrap}figure{margin:0;max-width:450px}img{width:100%;image-rendering:pixelated}figcaption{font-size:14px}code{overflow-wrap:anywhere}</style><h1>Replacement review</h1><p>${manifest.assets.length} renderings. Frame, symbols and copy are inherited from the approved kit. Serial numbers in these previews are examples; the game uses footerless art and live edition text.</p>${cards}</html>`);
}

/** Verify integrity AND recomposite independently, so a bundle cannot replace the frame or copy. */
export async function checkBundle({ bundle, root = kitRoot }) {
  bundle = resolve(bundle);
  const kit = loadKit(root), manifest = JSON.parse(readFileSync(resolve(bundle, 'replacement.json'), 'utf8'));
  need(manifest.schemaVersion === 1 && manifest.type === 'everfolk-card-art-replacement' && manifest.kitManifestSha256 === kit.manifestSha256, 'Replacement belongs to a different kit manifest');
  need(Array.isArray(manifest.assets) && manifest.assets.length > 0 && new Set(manifest.assets.map(row => row.id)).size === manifest.assets.length, 'Missing or duplicate replacement IDs');
  const bases = manifest.assets.filter(row => !row.variantOf);
  for (const entry of manifest.assets) {
    const row = kit.rows.find(row => row.id === entry.id);
    need(row && row.variantOf === entry.variantOf, 'Unknown or mismatched replacement ID: ' + entry.id);
    need(entry.frameSha256 === row.hashes.frame.sha256 && entry.footerlessFrameSha256 === row.hashes.footerlessFrame.sha256, 'Replacement frame fingerprint changed: ' + entry.id);
    for (const [kind, file] of Object.entries(entry.files)) {
      need(['full', 'footerless', 'thumbnail', 'portrait', 'standardArt'].includes(kind), 'Unexpected replacement file kind');
      const bytes = readFileSync(containedPath(bundle, file.path));
      need(sha256(bytes) === file.sha256, 'Replacement file hash mismatch: ' + file.path);
      const raw = await rgba(bytes);
      need(raw.info.width === file.width && raw.info.height === file.height && sha256(raw.data) === file.rgbaSha256, 'Replacement pixels or dimensions changed: ' + file.path);
    }
    const base = row.variantOf ? bases.find(base => base.id === row.variantOf) : entry;
    need(base?.files.portrait, 'Runtime variant is missing its base portrait');
    need(entry.portraitSha256 === base.files.portrait.sha256, 'Runtime variant uses a different parent portrait');
    const portrait = await png(readFileSync(containedPath(bundle, base.files.portrait.path)));
    const meta = await sharp(portrait).metadata();
    need(meta.width === 840 && meta.height === 1050, 'Portrait must be 840×1050');
    const portraitRaw = await rgba(portrait);
    for (let p = 3; p < portraitRaw.data.length; p += 4) need(portraitRaw.data[p] === 255, 'Replacement portrait must be opaque');
    const standard = base.files.standardArt ? await png(readFileSync(containedPath(bundle, base.files.standardArt.path))) : null;
    if (standard) {
      const size = await sharp(standard).metadata(); need(size.width === 592 && size.height === 740, 'Standard art must be 592×740');
      const raw = await rgba(standard);
      for (let p = 3; p < raw.data.length; p += 4) need(raw.data[p] === 255, 'Replacement standard artwork must be opaque');
    }
    const fitted = await fitArtwork(portrait, row, kit, standard);
    const expected = await composite(kit, row, fitted, 'footerlessFrame');
    need(entry.files.footerless, 'Missing footerless game artwork');
    need((await rgba(expected)).data.equals((await rgba(readFileSync(containedPath(bundle, entry.files.footerless.path)))).data), 'Artwork does not match the approved frame: ' + entry.id);
    if (!row.variantOf) {
      need(entry.files.full && entry.files.thumbnail, 'Missing full card or thumbnail');
      const full = await composite(kit, row, fitted, 'frame');
      need((await rgba(full)).data.equals((await rgba(readFileSync(containedPath(bundle, entry.files.full.path)))).data), 'Full preview frame differs: ' + entry.id);
      const thumb = await sharp(full).resize(450, 630, { kernel: 'nearest' }).png().toBuffer();
      need((await rgba(thumb)).data.equals((await rgba(readFileSync(containedPath(bundle, entry.files.thumbnail.path)))).data), 'Thumbnail differs: ' + entry.id);
      const expectedIds = kit.data.parentVariants.filter(row => row.variantOf === entry.id).map(row => row.id);
      for (const id of expectedIds) need(manifest.assets.some(row => row.id === id), 'Missing retained parent rarity variant: ' + id);
    }
  }
  return { passed: true, baseCards: bases.length, runtimeVariants: manifest.assets.length - bases.length, framePixelsVerified: true, assets: manifest.assets.length };
}

export async function verifyKit(root = kitRoot) {
  const kit = loadKit(root);
  let files = 0;
  for (const row of [...kit.rows, ...kit.data.blankFrames]) for (const [key, descriptor] of Object.entries(row.hashes)) {
    if (!row[key]) continue;
    const bytes = readFileSync(containedPath(root, row[key]));
    need(sha256(bytes) === descriptor.sha256, 'Kit source changed: ' + row[key]);
    files++;
  }
  return { passed: true, cards: kit.data.assets.length, variants: kit.data.parentVariants.length, blankFrames: kit.data.blankFrames.length, filesChecked: files };
}

function argumentsFor(args) {
  const [command, ...rest] = args, options = {};
  for (let i = 0; i < rest.length; i += 2) {
    need(rest[i].startsWith('--') && rest[i + 1] && !rest[i + 1].startsWith('--'), 'Options require a value: ' + rest[i]);
    const key = rest[i].slice(2);
    need(!Object.hasOwn(options, key), 'Duplicate option: ' + key);
    options[key] = rest[i + 1];
  }
  return { command, options };
}

async function main() {
  const { command, options } = argumentsFor(process.argv.slice(2));
  const allowed = { list: ['figure', 'kind', 'rarity', 'gender'], render: ['id', 'art', 'standard-art', 'mode', 'out'], batch: ['manifest', 'out'], check: ['bundle'], 'verify-kit': [] };
  if (!command || command === 'help' || command === '--help') {
    console.log('Everfolk card-art kit\n  list [--figure alexander] [--kind contribution] [--rarity common] [--gender female]\n  render --id ID --art portrait.png --out output/batch [--mode native-pixel] [--standard-art standard.png]\n  batch --manifest examples/replacements.json --out output/batch\n  check --bundle output/batch\n  verify-kit\nFinished portraits:840×1050; optional standard art:592×740. Native mode accepts exact integer divisors, scale1–8.');
    return;
  }
  need(allowed[command], 'Unknown command: ' + command);
  for (const key of Object.keys(options)) need(allowed[command].includes(key), 'Unknown option: --' + key);
  if (command === 'list') {
    const rows = loadKit().data.assets.filter(row => (!options.figure || row.figureId === options.figure) && ['kind', 'rarity', 'gender'].every(key => !options[key] || row[key] === options[key]));
    console.log(rows.map(row => `${row.id}\t${row.rarity}\t${row.gender}\t${row.title}\t${row.subtitle}`).join('\n'));
  } else if (command === 'render') {
    need(options.id && options.art && options.out, 'render requires --id, --art and --out');
    console.log(json(await renderBatch({ items: [{ id: options.id, art: options.art, standardArt: options['standard-art'], mode: options.mode }], out: options.out })));
  } else if (command === 'batch') {
    need(options.manifest && options.out, 'batch requires --manifest and --out');
    const file = resolve(options.manifest), manifest = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    need(manifest.schemaVersion === 1 && Array.isArray(manifest.art), 'Batch JSON must have schemaVersion:1 and art:[{id,art,mode?,standardArt?}]');
    const items = manifest.art.map(row => ({ ...row, art: resolve(dirname(file), row.art), ...(row.standardArt ? { standardArt: resolve(dirname(file), row.standardArt) } : {}) }));
    console.log(json(await renderBatch({ items, out: options.out })));
  } else if (command === 'check') {
    need(options.bundle, 'check requires --bundle');
    console.log(json(await checkBundle({ bundle: options.bundle })));
  } else console.log(json(await verifyKit()));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
