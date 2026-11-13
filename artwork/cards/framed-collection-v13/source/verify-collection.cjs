// Read-only validation of the completed collection; writes only this run's QA
// summary and the optional parent contact sheet. Never re-renders a card.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.resolve(ROOT, '../../..');
const req = createRequire(path.join(PROJECT, 'package.json'));
const sharp = createRequire(req.resolve('next/package.json'))('sharp');
const W = 900, H = 1260;
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const at = p => path.resolve(ROOT, p);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); return !!condition; };

async function rgba(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
function pixelDifferences(a, b) {
  if (a.length !== b.length) return Math.max(a.length, b.length) / 4;
  let difference = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) difference++;
  }
  return difference;
}
function inside(b, inset = 0) {
  return b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0 &&
    b.x >= inset && b.y >= inset && b.x + b.width <= W - inset && b.y + b.height <= H - inset;
}

async function contactSheet(rows) {
  const parents = rows.filter(r => r.kind === 'parent');
  const cols = 5, cellW = 470, cellH = 666, margin = 20;
  const layers = [];
  for (let i = 0; i < parents.length; i++) {
    const row = parents[i], x = margin + i % cols * cellW, y = margin + Math.floor(i / cols) * cellH;
    const thumb = await sharp(at(row.thumbnail)).resize(450, 630, { kernel: 'nearest' }).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="450" height="30"><text x="225" y="20" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="14" fill="#eee4ce">${esc(row.slug)}.png</text></svg>`);
    layers.push({ input: thumb, left: x, top: y }, { input: label, left: x, top: y + 634 });
  }
  const file = at('review/parents.png');
  await sharp({ create: { width: cols * cellW + margin * 2, height: Math.ceil(parents.length / cols) * cellH + margin * 2, channels: 4, background: '#0b2523' } })
    .composite(layers).png().toFile(file);
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

async function main() {
  const catalog = json(at('catalog.json'));
  if (catalog.complete !== true) throw Error('Catalogue is not complete; run validation only after catalog.complete=true.');
  const sourceRoot = path.resolve(ROOT, '../figure-inner-art-v12');
  const inner = json(path.join(sourceRoot, 'catalog.json'));
  const originals = new Map(inner.assets.map(r => [r.slug, r]));
  const rows = catalog.assets;
  const parents = rows.filter(r => r.kind === 'parent');
  const subcards = rows.filter(r => r.kind !== 'parent');
  const male = subcards.filter(r => r.gender === 'male');
  const female = subcards.filter(r => r.gender === 'female');
  check(catalog.expected === 83 && rows.length === 83, `Expected83 cards; found${rows.length}.`);
  check(new Set(rows.map(r => r.slug)).size === 83, 'Collection slugs must be unique.');
  check(parents.length === 13, `Expected13 parents; found${parents.length}.`);
  check(male.length === 35 && female.length === 35 && subcards.length === 70, `Expected35 male/35 female subcards; found${male.length}/${female.length}.`);
  check(catalog.canvas?.[0] === W && catalog.canvas?.[1] === H, 'Catalogue canvas is not900x1260.');
  const rolePairs = new Map();
  for (const row of subcards) {
    const role = originals.get(row.slug)?.roleId;
    check(!!role, `Missing v12 roleId: ${row.slug}`);
    if (!rolePairs.has(role)) rolePairs.set(role, []);
    rolePairs.get(role).push(row);
  }
  check(rolePairs.size === 35, `Expected35 paired roles; found${rolePairs.size}.`);
  for (const [role, pair] of rolePairs) {
    check(pair.length === 2 && new Set(pair.map(r => r.gender)).size === 2, `Incomplete gender pair: ${role}`);
    check(new Set(pair.map(r => r.title)).size === 1 && new Set(pair.map(r => r.rarity)).size === 1, `Gender pair title/rarity mismatch: ${role}`);
  }
  const results = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], before = failures.length, original = originals.get(row.slug);
    const sourceFile = path.resolve(PROJECT, row.sourceArt);
    check(!!original, `No v12 catalogue record: ${row.slug}`);
    if (original) {
      check(sourceFile === path.resolve(sourceRoot, original.final), `Source catalogue path differs: ${row.slug}`);
      check(original.kind === row.kind && original.gender === row.gender && original.title === row.title, `Source catalogue identity differs: ${row.slug}`);
    }
    const sourceHash = sha(sourceFile);
    check(sourceHash === row.sourceArtSha256, `Source art SHA256 changed: ${row.slug}`);
    const exportFile = at(row.export);
    const exportHash = sha(exportFile);
    check(exportHash === row.exportSha256, `Export SHA256 differs from catalogue: ${row.slug}`);
    check(fs.existsSync(at(row.master)), `Missing native master: ${row.slug}`);
    const nativeJson = json(at(`qa/${row.slug}-native.json`));
    const nodes = nativeJson.type?.nodes || [];
    check(nodes.length >= 7, `Fewer than7 native editable text nodes: ${row.slug}`);
    for (const node of nodes) check(inside(node.bounds), `Native text outside900x1260 card: ${row.slug}/${node.name}`);
    const title = nodes.find(n => n.name === 'Card title live');
    check(title?.text === row.title && inside(title?.bounds), `Missing, mismatched or overflowing native title: ${row.slug}`);
    const board = nativeJson.type?.artboards?.[0];
    check(board?.width === W && board?.height === H, `Native artboard size differs: ${row.slug}`);
    check((nativeJson.art?.nodes || []).some(n => n.kind === 'Image'), `Missing editable fitted bitmap node: ${row.slug}`);
    const [exportData, native, reopened, under, over] = await Promise.all([
      rgba(exportFile), rgba(at(`qa/${row.slug}-native.png`)), rgba(at(`qa/${row.slug}-reopened.png`)),
      rgba(at(row.fittedArt)), rgba(at(`qa/${row.slug}-overlay.png`))
    ]);
    for (const [label, value] of [['export', exportData], ['native', native], ['reopened', reopened], ['fitted', under], ['overlay', over]]) {
      check(value.info.width === W && value.info.height === H && value.info.channels === 4, `${label} dimensions differ: ${row.slug}`);
    }
    const reopenDifferences = pixelDifferences(native.data, reopened.data);
    check(reopenDifferences === 0 && row.qa?.nativeReopenIdentical === true, `Native save/reopen pixel mismatch: ${row.slug}`);
    const transparentOuterCorners = [0, W - 1, (H - 1) * W, W * H - 1].every(p => exportData.data[p * 4 + 3] === 0);
    check(transparentOuterCorners && row.qa?.transparentOuterCorners === true, `Opaque outer corner: ${row.slug}`);
    let checked = 0, uncoveredRgbDifferences = 0;
    for (let p = 0; p < exportData.data.length; p += 4) {
      if (under.data[p + 3] === 255 && over.data[p + 3] === 0) {
        checked++;
        if (exportData.data[p] !== under.data[p] || exportData.data[p + 1] !== under.data[p + 1] || exportData.data[p + 2] !== under.data[p + 2]) uncoveredRgbDifferences++;
      }
    }
    check(checked >= 500000 && uncoveredRgbDifferences === 0, `Fitted pixel compositing mismatch: ${row.slug} ${uncoveredRgbDifferences}/${checked}`);
    check(row.qa?.uncoveredRgbDifferences === 0 && row.qa?.uncoveredPixelsChecked === checked && row.qa?.editableText === true, `Stored pixel/native QA differs: ${row.slug}`);
    const rect = row.frameLayout === 'standard' ? [154, 190, 592, 740] : [30, 140, 840, 1050];
    check(JSON.stringify(row.fit?.rect) === JSON.stringify(rect) && row.fit?.sourceCropped === false, `Fit rectangle or crop flag differs: ${row.slug}`);
    const source = sharp(sourceFile);
    const expectedFit = row.frameLayout === 'standard' ? source.resize(592, 740, { kernel: 'nearest' }) : source;
    const actualFit = await sharp(at(row.fittedArt)).extract({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }).ensureAlpha().raw().toBuffer();
    const sourceFitDifferences = pixelDifferences(actualFit, await expectedFit.ensureAlpha().raw().toBuffer());
    check(sourceFitDifferences === 0, `Source fit pixels differ: ${row.slug}`);
    const thumb = await sharp(at(row.thumbnail)).metadata();
    check(thumb.width === 450 && thumb.height === 630, `Thumbnail size differs: ${row.slug}`);
    results.push({ slug: row.slug, passed: before === failures.length, exportSize: [exportData.info.width, exportData.info.height], sourceArtSha256: sourceHash, exportSha256: exportHash, nativeTextNodes: nodes.length, titleBounds: title?.bounds, nativeReopenPixelDifferences: reopenDifferences, sourceFitPixelDifferences: sourceFitDifferences, uncoveredPixelsChecked: checked, uncoveredRgbDifferences, transparentOuterCorners });
    if ((index + 1) % 20 === 0 || index === rows.length - 1) console.log(`Verified${index + 1}/${rows.length}`);
  }
  let parentContactSheet = null;
  if (!failures.length && process.argv.includes('--parents')) parentContactSheet = await contactSheet(rows);
  const summary = { verifiedAt: new Date().toISOString(), libraryId: catalog.libraryId, catalogComplete: catalog.complete, passed: failures.length === 0, counts: { total: rows.length, parents: parents.length, maleSubcards: male.length, femaleSubcards: female.length, pairedRoles: rolePairs.size }, canvas: [W, H], sourceArtHashesMatch: results.every(r => r.sourceArtSha256 === rows.find(x => x.slug === r.slug).sourceArtSha256), allNativeReopenPixelIdentical: results.every(r => r.nativeReopenPixelDifferences === 0), allFittedSourcePixelsMatch: results.every(r => r.sourceFitPixelDifferences === 0), uncoveredPixelRgbDifferences: results.reduce((n, r) => n + r.uncoveredRgbDifferences, 0), allTransparentOuterCorners: results.every(r => r.transparentOuterCorners), parentContactSheet, failures, assets: results };
  fs.writeFileSync(at('qa/collection-verification.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ passed: summary.passed, counts: summary.counts, failures, parentContactSheet }));
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
