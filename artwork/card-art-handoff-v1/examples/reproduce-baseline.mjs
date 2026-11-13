/** Check the artist workflow using existing approved art before commissioning new art. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { checkBundle, kitRoot, loadKit, renderBatch } from '../tools/card-art.mjs';
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch { sharp = createRequire(require.resolve('next/package.json'))('sharp'); }
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--out') throw Error('Usage: node examples/reproduce-baseline.mjs --out output/example-v1');
const temporary = mkdtempSync(resolve(tmpdir(), 'everfolk-baseline-example-'));
try {
  const kit = loadKit(), items = [];
  for (const id of ['alexander-common-female', 'euclid-parent']) {
    const row = kit.data.assets.find(row => row.id === id), art = resolve(temporary, id + '.png');
    await sharp(readFileSync(resolve(kitRoot, row.sourcePortrait))).png().toFile(art);
    items.push({ id, art });
  }
  console.log(JSON.stringify(await renderBatch({ items, out: args[1] }), null, 2));
  console.log(JSON.stringify(await checkBundle({ bundle: args[1] }), null, 2));
} finally { rmSync(temporary, { recursive: true, force: true }); }
