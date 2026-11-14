/** Exact bounded frames plus already-shipped paintings; no private source archive required. */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const retained = fileURLToPath(new URL('./card-art-kit/', import.meta.url));
const metadata = readFileSync(resolve(repo, 'assets/source/cards/handoff-v1/cards.json'));
const kit = JSON.parse(metadata);
export const sampleCardIds = Object.freeze(['alexander-parent', 'alexander-common-female', 'euclid-parent', 'demetrius-parent', 'zeno-parent', 'ptolemy-parent']);
const rows = [...kit.assets, ...kit.parentVariants].filter(row => sampleCardIds.includes(row.id) || sampleCardIds.includes(row.variantOf));
export const sampleKitIds = Object.freeze(rows.map(row => row.id));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let publicByHash;

function publicFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = resolve(directory, entry.name);
    return entry.isDirectory() ? publicFiles(file) : /\.(?:webp|png|svg)$/.test(entry.name) ? [file] : [];
  });
}

export function createCardKitFixture(root) {
  if (!publicByHash) publicByHash = new Map(publicFiles(resolve(repo, 'public/assets/cards/collection-v14')).map(file => [hash(readFileSync(file)), file]));
  mkdirSync(resolve(root, 'data'), { recursive: true });
  writeFileSync(resolve(root, 'data/cards.json'), metadata);
  for (const row of [...rows, ...kit.blankFrames]) for (const [key, descriptor] of Object.entries(row.hashes)) {
    if (!row[key]) continue;
    const frame = resolve(retained, row[key]);
    const source = existsSync(frame) ? frame : publicByHash.get(descriptor.sha256);
    if (!source || hash(readFileSync(source)) !== descriptor.sha256) throw new Error('Retained card fixture or public reference differs: ' + row.id + '/' + key);
    const destination = resolve(root, row[key]);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  return root;
}
