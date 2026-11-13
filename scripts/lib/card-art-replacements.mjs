/** Validate and stage artist bundles without changing card identity, copy or ranks. */
import { createHash, randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { checkBundle } from '../../artwork/card-art-handoff-v1/tools/card-art.mjs';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const sha = value => createHash('sha256').update(value).digest('hex');
const need = (condition, message) => { if (!condition) throw new Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
const load = path => JSON.parse(readFileSync(path, 'utf8'));
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const activeLocation = 'artwork/cards/replacements/active.json';
const allowedFiles = new Set(['full', 'footerless', 'thumbnail', 'portrait', 'standardArt']);
const fileSuffix = { full: '.webp', footerless: '-footerless.webp', thumbnail: '-thumb.webp', portrait: '-portrait.webp', standardArt: '-standard-art.png' };
const dimensions = { full: [900, 1260], footerless: [900, 1260], thumbnail: [450, 630], portrait: [840, 1050], standardArt: [592, 740] };

function safeRelative(value) {
  need(typeof value === 'string' && value.length > 0 && !isAbsolute(value) && !/[:\\\0]/.test(value), 'Asset path must be portable and relative');
  need(value.split('/').every(part => part && part !== '.' && part !== '..'), 'Asset path may not traverse directories');
  return value;
}

function beneath(root, path, existing = true) {
  const rootPath = realpathSync(root);
  safeRelative(path);
  if (!existing) {
    // Resolve every existing ancestor so a junction cannot redirect a fresh output.
    let parent = rootPath;
    for (const part of path.split('/')) {
      parent = resolve(parent, part);
      if (existsSync(parent)) {
        const resolved = realpathSync(parent), checked = relative(rootPath, resolved);
        need(checked && checked !== '..' && !checked.startsWith('..\\') && !checked.startsWith('../') && !isAbsolute(checked), 'Output path escapes its workspace');
      }
    }
  }
  const candidate = existing ? realpathSync(resolve(rootPath, path)) : resolve(rootPath, path);
  const rel = relative(rootPath, candidate);
  need(rel && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../') && !isAbsolute(rel), 'Asset path escapes its bundle');
  return candidate;
}

function atomicJSON(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = path + '.card-art-' + randomUUID() + '.tmp';
  writeFileSync(temporary, json(value));
  renameSync(temporary, path);
}

function rows(registry) { return [...registry.assets, ...registry.parentVariants]; }

function validateVersion(version) {
  need(typeof version === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(version) && version.length <= 64, 'Version must be a short lowercase name, such as pixel-v1');
  need(!['collection-v14', 'symbols', 'replacements'].includes(version), 'Choose a new replacement version; approved source assets stay untouched');
  return version;
}

function losslessWebP(bytes) {
  need(bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length, 'Replacement must be a complete lossless WebP');
  let lossless = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const tag = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
    need(tag !== 'VP8 ' && tag !== 'ANIM' && tag !== 'ANMF', 'Lossy or animated card artwork is not accepted');
    if (tag === 'VP8L') lossless = true;
    offset += 8 + size + (size & 1);
  }
  need(lossless, 'Missing lossless WebP pixels');
}

async function validateFile(bundle, descriptor, key, id) {
  need(descriptor && digest(descriptor.sha256) && digest(descriptor.rgbaSha256), `Missing file hashes: ${id}/${key}`);
  const source = beneath(bundle, descriptor.path);
  const bytes = readFileSync(source);
  need(sha(bytes) === descriptor.sha256 && bytes.length === descriptor.bytes, `Replacement file hash or size differs: ${id}/${key}`);
  if (key !== 'standardArt') losslessWebP(bytes);
  const image = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [width, height] = dimensions[key];
  need(image.info.width === width && image.info.height === height && descriptor.width === width && descriptor.height === height, `Unexpected replacement dimensions: ${id}/${key}`);
  need(sha(image.data) === descriptor.rgbaSha256, `Replacement decoded pixels differ: ${id}/${key}`);
  if (key === 'portrait' || key === 'standardArt') {
    for (let p = 3; p < image.data.length; p += 4) need(image.data[p] === 255, `Inner artwork must be opaque: ${id}/${key}`);
  } else if (key !== 'thumbnail') {
    for (const p of [0, width - 1, width * (height - 1), width * height - 1]) need(image.data[p * 4 + 3] === 0, `Card outer corners must be transparent: ${id}/${key}`);
  }
  return { source, bytes, data: image.data, descriptor };
}

async function verifyFrame(record, template, kitRoot, decoded) {
  for (const [key, field] of [['full', 'frame'], ['footerless', 'footerlessFrame']]) {
    if (!decoded[key]) continue;
    const frameBytes = readFileSync(beneath(kitRoot, template[field]));
    need(sha(frameBytes) === template.hashes[field].sha256, `Kit frame changed: ${record.id}/${field}`);
    const frame = await sharp(frameBytes).ensureAlpha().raw().toBuffer();
    const result = decoded[key].data;
    for (let p = 0; p < frame.length; p += 4) {
      if (frame[p + 3] === 255) need(frame.subarray(p, p + 4).equals(result.subarray(p, p + 4)), `Replacement changed the protected frame or copy: ${record.id}/${key}`);
    }
  }
  if (decoded.full) {
    let differences = 0;
    for (let p = 0; p < decoded.full.data.length; p += 4) {
      if (decoded.full.data.subarray(p, p + 4).equals(decoded.footerless.data.subarray(p, p + 4))) continue;
      const x = p / 4 % 900, y = Math.floor(p / 4 / 900);
      need(x >= 700 && x < 826 && y >= 1180 && y < 1224, `Full and live card differ outside the edition area: ${record.id}`);
      differences++;
    }
    need(differences > 0, `The example edition was not removed: ${record.id}`);
  }
}

/** Returns validated entries and in-memory bytes; no repository writes. */
export async function validateCardArtBundle({ repo, bundle, registry, kitRoot = resolve(repo, 'artwork/card-art-handoff-v1') }) {
  bundle = realpathSync(bundle);
  const manifestPath = beneath(bundle, 'replacement.json');
  const manifestBytes = readFileSync(manifestPath), manifest = JSON.parse(manifestBytes);
  const kitBytes = readFileSync(beneath(kitRoot, 'data/cards.json')), kit = JSON.parse(kitBytes);
  need(kit.id === 'everfolk-card-art-handoff-v1' && kit.schemaVersion === 1, 'Unsupported card-art kit');
  need(manifest.type === 'everfolk-card-art-replacement' && manifest.schemaVersion === 1, 'Unsupported replacement bundle');
  need(manifest.kitManifestSha256 === sha(kitBytes), 'Replacement bundle was made with a different kit manifest');
  need(Array.isArray(manifest.assets) && manifest.assets.length > 0, 'Replacement bundle contains no cards');
  const templateById = new Map([...kit.assets, ...kit.parentVariants].map(row => [row.id, row]));
  const registryById = new Map(rows(registry).map(row => [row.id, row]));
  const records = new Map();
  for (const record of manifest.assets) {
    need(record && !records.has(record.id), `Duplicate replacement card: ${record?.id}`);
    const current = registryById.get(record.id), template = templateById.get(record.id);
    need(current && template, `Unknown card ID: ${record.id}`);
    need((record.variantOf ?? null) === (current.variantOf ?? null), `Card variant identity changed: ${record.id}`);
    need(record.frameSha256 === template.hashes.frame.sha256 && record.footerlessFrameSha256 === template.hashes.footerlessFrame.sha256, `Replacement uses an unapproved frame: ${record.id}`);
    need(digest(record.portraitSha256) && digest(record.inputSha256), `Missing source provenance: ${record.id}`);
    need(['native-pixel', 'finished'].includes(record.artMode), `Unknown art preparation mode: ${record.id}`);
    need(record.files && Object.keys(record.files).every(key => allowedFiles.has(key)), `Unknown replacement file role: ${record.id}`);
    const required = current.variantOf ? ['footerless'] : ['full', 'footerless', 'thumbnail', 'portrait'];
    need(required.every(key => record.files[key]), `Incomplete replacement outputs: ${record.id}`);
    const decoded = {};
    for (const [key, descriptor] of Object.entries(record.files)) decoded[key] = await validateFile(bundle, descriptor, key, record.id);
    if (!current.variantOf) need(decoded.portrait.descriptor.sha256 === record.portraitSha256, `Portrait provenance differs: ${record.id}`);
    await verifyFrame(record, template, kitRoot, decoded);
    records.set(record.id, { record, decoded, current });
  }
  for (const { record, current } of records.values()) {
    if (current.variantOf) {
      const base = records.get(current.variantOf);
      need(base && base.record.portraitSha256 === record.portraitSha256, `Parent variant requires the matching base portrait: ${record.id}`);
    } else if (current.kind === 'parent') {
      for (const variant of registry.parentVariants.filter(row => row.variantOf === current.id)) need(records.has(variant.id), `Parent replacement is missing its runtime rarity frame: ${variant.id}`);
    }
  }
  // Independently recomposite the portrait and approved overlays, including
  // translucent pixels, optional standard-grid art and retained rarity variants.
  await checkBundle({ bundle, root: kitRoot });
  return { manifest, bundleSha256: sha(manifestBytes), records, kitManifestSha256: sha(kitBytes) };
}

function mergeRegistry(registry, active) {
  const byId = new Map(active.entries.map(entry => [entry.id, entry]));
  const update = row => {
    const replacement = byId.get(row.id);
    if (!replacement) return row;
    const files = replacement.files;
    const portrait = row.variantOf ? byId.get(row.variantOf)?.files.portrait : files.portrait;
    need(portrait, `Missing active parent portrait: ${row.id}`);
    return { ...row,
      src: (files.full ?? files.footerless).src,
      footerlessSrc: files.footerless.src,
      thumbnailSrc: (files.thumbnail ?? files.footerless).src,
      portraitSrc: portrait.src,
      sha256: (files.full ?? files.footerless).sha256,
      artworkVersion: replacement.version,
    };
  };
  return { ...registry, assets: registry.assets.map(update), parentVariants: registry.parentVariants.map(update), artReplacements: { schemaVersion: 1, activeManifest: activeLocation, count: active.entries.length } };
}

/** Restore active artwork URLs after a source-library rebuild; identity/copy remain untouched. */
export function mergeActiveCardArtReplacements({ repo, registry }) {
  const activePath = resolve(repo, activeLocation);
  if (!existsSync(activePath)) return registry;
  const active = load(activePath);
  need(active.schemaVersion === 1 && active.type === 'everfolk-active-card-art' && active.sourceCatalogSha256 === registry.sourceCatalogSha256, 'Active replacements do not match this source catalogue');
  need(Array.isArray(active.entries), 'Invalid active replacement entries');
  const currentById = new Map(rows(registry).map(row => [row.id, row]));
  const ids = new Set();
  const publicRoot = resolve(repo, 'public');
  for (const entry of active.entries) {
    const current = currentById.get(entry.id);
    need(current && !ids.has(entry.id), `Unknown or duplicate active card: ${entry.id}`);
    ids.add(entry.id);
    need((entry.variantOf ?? null) === (current.variantOf ?? null), `Active card identity changed: ${entry.id}`);
    validateVersion(entry.version);
    for (const file of Object.values(entry.files)) {
      need(typeof file.src === 'string' && file.src.startsWith(`/assets/cards/${entry.version}/`), 'Active asset URL is outside its version');
      const bytes = readFileSync(beneath(publicRoot, file.src.slice(1)));
      need(sha(bytes) === file.sha256 && bytes.length === file.bytes, `Active replacement asset changed: ${file.src}`);
    }
  }
  return mergeRegistry(registry, active);
}

/** Default is a reviewable staged import. --apply is the maintainer's explicit install step. */
export async function stageCardArtImport({ repo, bundle, version, apply = false, kitRoot }) {
  repo = realpathSync(repo);
  validateVersion(version);
  const registryPath = resolve(repo, 'client/models/card-art-registry.json');
  const registry = load(registryPath);
  mergeActiveCardArtReplacements({ repo, registry });
  const validated = await validateCardArtBundle({ repo, bundle, registry, kitRoot });
  const publicPrefix = `/assets/cards/${version}/`;
  const entries = [];
  const stageRelative = `artifacts/card-art-import/${version}-${validated.bundleSha256.slice(0, 12)}`;
  const stageRoot = beneath(repo, stageRelative, false);
  mkdirSync(stageRoot, { recursive: true });
  for (const { record, decoded } of validated.records.values()) {
    const files = {};
    for (const [key, image] of Object.entries(decoded)) {
      const filename = record.id + fileSuffix[key];
      const path = beneath(stageRoot, filename, false);
      writeFileSync(path, image.bytes);
      const { path: ignored, ...metadata } = image.descriptor;
      files[key] = { ...metadata, src: publicPrefix + filename };
    }
    const { files: ignored, ...metadata } = record;
    entries.push({ ...metadata, version, files, bundleSha256: validated.bundleSha256, kitManifestSha256: validated.kitManifestSha256 });
  }
  const activePath = resolve(repo, activeLocation);
  const previous = existsSync(activePath) ? load(activePath) : { schemaVersion: 1, type: 'everfolk-active-card-art', sourceCatalogSha256: registry.sourceCatalogSha256, entries: [] };
  need(previous.sourceCatalogSha256 === registry.sourceCatalogSha256, 'Existing overrides belong to a different source catalogue');
  const merged = new Map(previous.entries.map(entry => [entry.id, entry]));
  for (const entry of entries) merged.set(entry.id, entry);
  const order = new Map(rows(registry).map((row, index) => [row.id, index]));
  const active = { ...previous, entries: [...merged.values()].sort((a, b) => order.get(a.id) - order.get(b.id)) };
  const candidate = mergeRegistry(registry, active);
  const report = {
    schemaVersion: 1, version, bundleSha256: validated.bundleSha256, kitManifestSha256: validated.kitManifestSha256,
    cards: entries.map(entry => entry.id), installed: false, sourceLibraryUnchanged: true,
    identityCopyRanksAndEditionCapsUnchanged: true, liveEditionPreserved: true,
    changedFields: ['src', 'footerlessSrc', 'thumbnailSrc', 'portraitSrc', 'sha256', 'artworkVersion'],
    stagePath: stageRelative, publicPath: publicPrefix,
  };
  atomicJSON(resolve(stageRoot, 'registry.json'), candidate);
  atomicJSON(resolve(stageRoot, 'active.json'), active);
  atomicJSON(resolve(stageRoot, 'manifest.json'), { ...report, entries });
  if (apply) {
    const destination = beneath(repo, `public/assets/cards/${version}`, false);
    if (existsSync(destination)) {
      const existingManifest = resolve(destination, 'manifest.json');
      need(existsSync(existingManifest) && load(existingManifest).bundleSha256 === validated.bundleSha256, 'That artwork version already exists; choose a new version name');
    }
    mkdirSync(destination, { recursive: true });
    for (const entry of entries) for (const file of Object.values(entry.files)) {
      const filename = file.src.slice(publicPrefix.length);
      copyFileSync(beneath(stageRoot, filename), beneath(destination, filename, false));
    }
    atomicJSON(resolve(destination, 'manifest.json'), { ...report, installed: true, entries });
    atomicJSON(activePath, active);
    // Final write switches the app only after every versioned file and override descriptor exists.
    atomicJSON(registryPath, candidate);
    report.installed = true;
  }
  atomicJSON(resolve(stageRoot, 'review.json'), report);
  return report;
}
