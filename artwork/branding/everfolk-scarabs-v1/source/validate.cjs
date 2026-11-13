const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
let sharp;
try { sharp = require('sharp'); }
catch { sharp = createRequire(require.resolve('next/package.json')).call(null, 'sharp'); }

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const concepts = ['concepts-01-04.cjs', 'concepts-05-07.cjs', 'concepts-08-10.cjs'].flatMap(file => require('./' + file));
  const hashes = concepts.map(c => crypto.createHash('sha256').update(JSON.stringify(c.shapes.map(s => [s.d, s.matrix]))).digest('hex'));
  if (new Set(hashes).size !== 10) throw Error('Repeated symbol geometry');
  const svgFiles = fs.readdirSync(path.join(root, 'svg')).filter(f => f.endsWith('.svg'));
  if (svgFiles.length !== 42) throw Error('Expected 42 SVG production exports');
  for (const file of svgFiles) {
    const svg = fs.readFileSync(path.join(root, 'svg', file), 'utf8');
    if (/<(?:image|text)\b/i.test(svg) || !/<path\b/.test(svg)) throw Error('Non-vector or live-text SVG: ' + file);
  }
  const pngChecks = [];
  for (const c of manifest.concepts) {
    const reopened = JSON.parse(fs.readFileSync(path.join(root, 'qa', path.basename(c.master, '.vectorcraft') + '-reopened.json'), 'utf8'));
    if (reopened.artboards.length !== 4 || reopened.rasterImages !== 0 || reopened.dirty) throw Error('Native reopening failed: ' + c.name);
    for (const variant of c.variants) {
      const expected = variant.png.includes('emblem-') ? [1024, 1024] : variant.png.includes('stacked-') ? [1200, 820] : [1400, 380];
      const filename = path.join(root, variant.png);
      const metadata = await sharp(filename).metadata();
      const stats = await sharp(filename).stats();
      if (metadata.width !== expected[0] || metadata.height !== expected[1] || !metadata.hasAlpha) throw Error('PNG dimensions/transparency: ' + variant.png);
      const alpha = stats.channels.at(-1);
      if (alpha.min !== 0 || alpha.max < 250) throw Error('PNG empty or opaque background: ' + variant.png);
      pngChecks.push({ file: variant.png, width: metadata.width, height: metadata.height, transparent: true });
    }
  }
  const wordmarkReopened = JSON.parse(fs.readFileSync(path.join(root, 'qa/everfolk-independent-wordmark-reopened.json'), 'utf8'));
  if (wordmarkReopened.artboards.length !== 2 || wordmarkReopened.rasterImages !== 0) throw Error('Wordmark reopening failed');
  if (manifest.warnings.length) throw Error('Unexpected export warnings');
  const result = { passed: true, distinctScarabs: 10, productionNativeMasters: 11, svgExports: 42, allSvgPathsOnly: true, nativeReopeningsPassed: true, exportWarnings: [], pngChecks };
  fs.writeFileSync(path.join(root, 'qa/delivery-validation.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, distinctScarabs: 10, masters: 11, svgExports: 42, pngsChecked: pngChecks.length, transparent: true, exportWarnings: 0 }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
