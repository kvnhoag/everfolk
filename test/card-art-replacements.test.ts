import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { mergeActiveCardArtReplacements, stageCardArtImport, validateCardArtBundle } from '../scripts/lib/card-art-replacements.mjs';
import { fitArtwork } from '../artwork/card-art-handoff-v1/tools/card-art.mjs';

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const save = (path: string, value: unknown) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); };
const load = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

async function fixture() {
  const directory = mkdtempSync(resolve(tmpdir(), 'everfolk-card-import-'));
  const repo = resolve(directory, 'repo'), bundle = resolve(directory, 'bundle'), kitRoot = resolve(repo, 'artwork/card-art-handoff-v1');
  for (const path of [repo, bundle, kitRoot, resolve(repo, 'public/assets/cards'), resolve(repo, 'client/models'), resolve(kitRoot, 'frames')]) mkdirSync(path, { recursive: true });
  const svg = (serial: boolean) => Buffer.from(`<svg width="900" height="1260"><rect x="50" y="35" width="800" height="95" fill="#c09050"/><rect x="50" y="1180" width="620" height="40" fill="#203020"/>${serial ? '<rect x="710" y="1195" width="70" height="12" fill="#ffffff"/>' : ''}</svg>`);
  const frames = { frame: await sharp(svg(true)).png().toBuffer(), footerlessFrame: await sharp(svg(false)).png().toBuffer() };
  for (const [field, bytes] of Object.entries(frames)) writeFileSync(resolve(kitRoot, `frames/${field}.png`), bytes);
  const portraitPNG = await sharp({ create: { width: 840, height: 1050, channels: 3, background: '#345678' } }).png().toBuffer();
  const portrait = await sharp(portraitPNG).webp({ lossless: true, exact: true }).toBuffer();
  const fitted = await fitArtwork(portraitPNG, { fit: 'legendary' }, { data: {} });
  const fullPNG = await sharp(fitted).composite([{ input: frames.frame }]).png().toBuffer();
  const cleanPNG = await sharp(fitted).composite([{ input: frames.footerlessFrame }]).png().toBuffer();
  const full = await sharp(fullPNG).webp({ lossless: true, exact: true }).toBuffer();
  const footerless = await sharp(cleanPNG).webp({ lossless: true, exact: true }).toBuffer();
  const thumbnail = await sharp(fullPNG).resize(450, 630, { kernel: 'nearest' }).webp({ lossless: true, exact: true }).toBuffer();
  const buffers = { full, footerless, thumbnail, portrait };
  const base = { id: 'euclid-parent', kind: 'parent', figureId: 'euclid', rarity: 'legendary', editionLimit: 10, title: 'Euclid', subtitle: 'Geometer', bodyTitle: 'Proof Endures', bodyText: 'A precise biography.', src: '/assets/cards/collection-v14/euclid-parent.webp', footerlessSrc: '/assets/cards/collection-v14/euclid-parent-footerless.webp', thumbnailSrc: '/assets/cards/collection-v14/euclid-parent-thumb.webp', portraitSrc: '/assets/cards/collection-v14/euclid-parent-portrait.webp', sha256: hash(full) };
  const variant = { ...base, id: 'euclid-parent-common', variantOf: base.id, rarity: 'common', editionLimit: null };
  const contributor = { ...base, id: 'euclid-common-female', kind: 'contribution', rarity: 'common', editionLimit: null, gender: 'female', title: 'Geometry Student', subtitle: 'Student of Euclid' };
  const registry = { schemaVersion: 1, libraryId: 'everfolk-framed-collection-v14', sourceCatalogSha256: 'c'.repeat(64), assets: [base, contributor], parentVariants: [variant] };
  const template = (row: typeof base) => ({ ...row, fit: 'legendary', frame: 'frames/frame.png', footerlessFrame: 'frames/footerlessFrame.png', hashes: { frame: { sha256: hash(frames.frame) }, footerlessFrame: { sha256: hash(frames.footerlessFrame) } } });
  // Retain the real kit's complete-count contract while this fixture exercises
  // only one parent cohort and one independent contribution replacement.
  const kit = { schemaVersion: 1, id: 'everfolk-card-art-handoff-v1', complete: true,
    assets: [template(base), template(contributor), ...Array.from({ length: 115 }, (_, index) => template({ ...base, id: `unselected-${index}` }))],
    parentVariants: [template(variant), ...Array.from({ length: 15 }, (_, index) => ({ ...template(base), id: `unselected-variant-${index}`, variantOf: `unselected-${index}` }))],
  };
  save(resolve(kitRoot, 'data/cards.json'), kit);
  save(resolve(repo, 'client/models/card-art-registry.json'), registry);
  const records = [];
  for (const row of [base, variant, contributor]) {
    const files: Record<string, unknown> = {};
    for (const [key, bytes] of Object.entries(buffers)) {
      if ('variantOf' in row && key !== 'footerless') continue;
      const path = `${row.id}-${key}.webp`;
      writeFileSync(resolve(bundle, path), bytes);
      const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      files[key] = { path, sha256: hash(bytes), rgbaSha256: hash(pixels.data), width: pixels.info.width, height: pixels.info.height, bytes: bytes.length };
    }
    records.push({ id: row.id, ...('variantOf' in row ? { variantOf: row.variantOf } : {}), inputSha256: hash(portraitPNG), portraitSha256: hash(portrait), frameSha256: hash(frames.frame), footerlessFrameSha256: hash(frames.footerlessFrame), artMode: 'finished', fit: 'legendary', files });
  }
  const manifest = { schemaVersion: 1, type: 'everfolk-card-art-replacement', kitManifestSha256: hash(readFileSync(resolve(kitRoot, 'data/cards.json'))), assets: records.slice(0, 2) };
  save(resolve(bundle, 'replacement.json'), manifest);
  return { directory, repo, bundle, kitRoot, registry, manifest, records, buffers };
}

async function withFixture(run: (context: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  const context = await fixture();
  try { await run(context); } finally {
    assert.ok(context.directory.startsWith(resolve(tmpdir(), 'everfolk-card-import-')));
    rmSync(context.directory, { recursive: true, force: true });
  }
}

test('artist bundles stage without switching live registry, then apply all parent rarity frames together', async () => withFixture(async context => {
  const { repo, bundle, registry } = context;
  const before = readFileSync(resolve(repo, 'client/models/card-art-registry.json'));
  const staged = await stageCardArtImport({ repo, bundle, version: 'pixel-v1' });
  assert.equal(staged.installed, false);
  assert.equal(staged.cards.length, 2);
  assert.deepEqual(readFileSync(resolve(repo, 'client/models/card-art-registry.json')), before);
  assert.equal(existsSync(resolve(repo, 'artwork/cards/replacements/active.json')), false);
  const installed = await stageCardArtImport({ repo, bundle, version: 'pixel-v1', apply: true });
  assert.equal(installed.installed, true);
  const current = load(resolve(repo, 'client/models/card-art-registry.json'));
  assert.equal(current.assets[0].src, '/assets/cards/pixel-v1/euclid-parent.webp');
  assert.equal(current.parentVariants[0].footerlessSrc, '/assets/cards/pixel-v1/euclid-parent-common-footerless.webp');
  assert.equal(current.parentVariants[0].portraitSrc, current.assets[0].portraitSrc);
  for (const [index, row] of current.assets.entries()) for (const field of ['kind', 'rarity', 'editionLimit', 'title', 'subtitle', 'bodyTitle', 'bodyText']) assert.equal(row[field], registry.assets[index][field]);
  assert.deepEqual(mergeActiveCardArtReplacements({ repo, registry }), current, 'a later baseline rebuild restores installed URLs');
}));

test('a later partial replacement preserves previously installed cards and their runtime variants', async () => withFixture(async context => {
  const { repo, bundle, manifest, records } = context;
  await stageCardArtImport({ repo, bundle, version: 'pixel-v1', apply: true });
  save(resolve(bundle, 'replacement.json'), { ...manifest, assets: records.slice(2) });
  await stageCardArtImport({ repo, bundle, version: 'pixel-v2', apply: true });
  const current = load(resolve(repo, 'client/models/card-art-registry.json'));
  assert.equal(current.assets[0].artworkVersion, 'pixel-v1');
  assert.equal(current.assets[1].artworkVersion, 'pixel-v2');
  assert.equal(current.parentVariants[0].artworkVersion, 'pixel-v1');
  assert.equal(current.artReplacements.count, 3);
}));

test('a parent replacement missing a runtime rarity frame is rejected before staging', async () => withFixture(async context => {
  const { repo, bundle, registry, manifest } = context;
  save(resolve(bundle, 'replacement.json'), { ...manifest, assets: manifest.assets.slice(0, 1) });
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /missing its runtime rarity frame/);
  assert.equal(existsSync(resolve(repo, 'artifacts')), false);
}));

test('path traversal and changed image bytes fail bundle verification', async () => withFixture(async context => {
  const { repo, bundle, registry, manifest } = context;
  manifest.assets[0].files.full.path = '../outside.webp';
  save(resolve(bundle, 'replacement.json'), manifest);
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /traverse/);
  manifest.assets[0].files.full.path = 'euclid-parent-full.webp';
  save(resolve(bundle, 'replacement.json'), manifest);
  writeFileSync(resolve(bundle, manifest.assets[0].files.full.path), Buffer.from('changed'));
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /hash or size/);
}));

test('a replacement cannot change kit identity, duplicate card IDs or target an approved source version', async () => withFixture(async context => {
  const { repo, bundle, registry, manifest } = context;
  await assert.rejects(stageCardArtImport({ repo, bundle, version: 'collection-v14' }), /approved source assets/);
  save(resolve(bundle, 'replacement.json'), { ...manifest, kitManifestSha256: '0'.repeat(64) });
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /different kit manifest/);
  save(resolve(bundle, 'replacement.json'), { ...manifest, assets: [manifest.assets[0], manifest.assets[0]] });
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /Duplicate replacement/);
}));

test('altering protected frame pixels is rejected even when replacement hashes are recomputed', async () => withFixture(async context => {
  const { repo, bundle, registry, manifest, buffers } = context;
  const modified = await sharp(buffers.full).composite([{ input: Buffer.from('<svg width="900" height="1260"><rect x="100" y="50" width="20" height="20" fill="red"/></svg>') }]).webp({ lossless: true, exact: true }).toBuffer();
  const path = manifest.assets[0].files.full.path;
  writeFileSync(resolve(bundle, path), modified);
  const pixels = await sharp(modified).ensureAlpha().raw().toBuffer();
  Object.assign(manifest.assets[0].files.full, { sha256: hash(modified), rgbaSha256: hash(pixels), bytes: modified.length });
  save(resolve(bundle, 'replacement.json'), manifest);
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /protected frame or copy/);
}));

test('uncovered artwork must correspond to the supplied portrait, even with valid replacement hashes', async () => withFixture(async context => {
  const { repo, bundle, registry, manifest, buffers } = context;
  const patch = Buffer.from('<svg width="900" height="1260"><rect x="200" y="300" width="20" height="20" fill="red"/></svg>');
  const changed: Record<string, Buffer> = {};
  for (const key of ['full', 'footerless']) changed[key] = await sharp(buffers[key]).composite([{ input: patch }]).webp({ lossless: true, exact: true }).toBuffer();
  changed.thumbnail = await sharp(changed.full).resize(450, 630, { kernel: 'nearest' }).webp({ lossless: true, exact: true }).toBuffer();
  for (const [key, bytes] of Object.entries(changed)) {
    const file = manifest.assets[0].files[key];
    writeFileSync(resolve(bundle, file.path), bytes);
    const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
    Object.assign(file, { sha256: hash(bytes), rgbaSha256: hash(pixels), bytes: bytes.length });
  }
  save(resolve(bundle, 'replacement.json'), manifest);
  await assert.rejects(validateCardArtBundle({ repo, bundle, registry }), /does not match the approved frame/);
}));
