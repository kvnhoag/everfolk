// Preserve the real kit fingerprint used by the prior immutable active bundle.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), repo = path.resolve(root, '../../..');
const kitRoot = path.join(repo, 'artwork/card-art-handoff-v1');
const manifestBytes = fs.readFileSync(path.join(kitRoot, 'data/cards.json'));
const kit = JSON.parse(manifestBytes), active = JSON.parse(fs.readFileSync(path.join(repo, 'artwork/cards/replacements/active.json')));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const kitHash = hash(manifestBytes), dest = path.join(root, 'backup/bundle-kit-' + kitHash.slice(0, 12));
if (fs.existsSync(dest)) throw Error('Kit archive already exists');
const files = new Set(['data/cards.json']);
for (const entry of active.entries) {
  if (entry.kitManifestSha256 !== kitHash) throw Error('Active bundle does not use the reviewed kit');
  const row = [...kit.assets, ...kit.parentVariants].find(row => row.id === entry.id);
  for (const key of ['frame', 'footerlessFrame', 'overlaySvg', 'footerlessOverlaySvg']) files.add(row[key]);
}
const records = [];
for (const file of files) {
  const source = path.join(kitRoot, file), target = path.join(dest, file), bytes = fs.readFileSync(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  records.push({ path: file, sha256: hash(bytes), bytes: bytes.length });
}
fs.writeFileSync(path.join(dest, 'archive.json'), JSON.stringify({ kitManifestSha256: kitHash, activeIds: active.entries.map(row => row.id), files: records }, null, 2) + '\n');
console.log(JSON.stringify({ archivedKit: path.relative(repo, dest), kitManifestSha256: kitHash, files: records.length }));
