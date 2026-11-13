// Apply only the verified native masters and header-bound reports to a mirror.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];
if (!args.includes('--repo') || !args.includes('--source')) throw Error('Use --repo TARGET --source STAGED_ROOT [--apply]');
const target = fs.realpathSync(option('--repo'));
const source = fs.realpathSync(option('--source'));
const apply = args.includes('--apply');
const own = 'artwork/cards/subtitle-spacing-v1';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const at = (root, rel) => {
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).some(part => part === '..')) throw Error('Unsafe path ' + rel);
  return path.join(root, rel);
};
const manifest = JSON.parse(fs.readFileSync(at(source, own + '/qa/native/sync-manifest.json')));
const plan = manifest.files.map(row => {
  const bytes = fs.readFileSync(at(source, row.path));
  if (sha(bytes) !== row.afterSha256 || bytes.length !== row.bytes) throw Error('Staged file differs: ' + row.path);
  const dest = at(target, row.path);
  const current = fs.existsSync(dest) ? sha(fs.readFileSync(dest)) : null;
  if (current !== row.beforeSha256 && current !== row.afterSha256) throw Error('Preserved conflicting mirror edit: ' + row.path);
  return { ...row, currentSha256: current, unchanged: current === row.afterSha256 };
});
if (apply) {
  for (const row of plan.filter(row => !row.unchanged)) {
    const dest = at(target, row.path);
    if (fs.existsSync(dest)) {
      const backup = at(target, own + '/backup/native-sync/' + row.path);
      if (fs.existsSync(backup)) throw Error('Backup already exists: ' + row.path);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(dest, backup, fs.constants.COPYFILE_EXCL);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(at(source, row.path), dest);
    if (sha(fs.readFileSync(dest)) !== row.afterSha256) throw Error('Copy verification failed: ' + row.path);
  }
}
const report = { applied: apply, files: plan.length, changed: plan.filter(row => !row.unchanged).length, filesVerified: true, plan };
const reportPath = at(target, own + '/qa/native-sync-' + (apply ? 'applied' : 'dry-run') + '.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ applied: apply, files: plan.length, changed: report.changed, filesVerified: true }));
