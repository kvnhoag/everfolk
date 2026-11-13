// Derive this focused two-card pipeline from the previously reviewed role migration.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const previous = path.resolve(root, '../role-progression-v1/source');
for (const name of ['prepare-migration.cjs', 'render-derivatives.cjs', 'finalize-migration.cjs', 'build-portable-release.cjs', 'apply-portable-migration.cjs']) {
  const output = path.join(__dirname, name);
  if (fs.existsSync(output)) throw Error('Refusing to replace staged script ' + name);
  let source = fs.readFileSync(path.join(previous, name), 'utf8').replaceAll('role-progression-v1', 'ptolemy-common-official-v1').replaceAll('fourteen', 'two');
  if (name === 'prepare-migration.cjs') {
    source = source.replace("const target=copy.figures.find(f=>f.figureId===edit.figureId).roles[edit.tier];", "const target=copy.figures.find(f=>f.figureId===edit.figureId).roles[edit.tier];target.sourceArtRoot='artwork/cards/ptolemy-common-official-v1/assets';target.newArt=true;target.editorialRoleRevision='ptolemy-common-official-v1';");
    source = source.replace("'artwork/card-art-handoff-v1/package-manifest.json'", "'artwork/card-art-handoff-v1/package-manifest.json','artwork/card-art-handoff-v1/data/verification.json','artwork/card-art-handoff-v1/package-checksums.sha256','artwork/card-art-handoff-v1/data/cards.csv','artwork/card-art-handoff-v1/reference/index.html'");
    source = source.replace("for(const id of ids){", "for(const id of ids){files.add('artwork/card-art-handoff-v1/briefs/'+id+'.md');");
  }
  if (name === 'build-portable-release.cjs') {
    source = source.replace("const originalKit=fs.readFileSync(path.join(BACKUP,'bundle-kit-6531a7f407d7/data/cards.json'));", '');
    source = source.replace('acceptedOldKitManifestSha256:[migration.oldKitManifestSha256,hash(originalKit)]', 'acceptedOldKitManifestSha256:[migration.oldKitManifestSha256]');
    source = source.replace("for(const p of [LIB+'/source/card-copy.json'", "for(const p of ['chain/catalog/figure-contribution-copy.ts','test/figure-contribution-requirements.test.ts',LIB+'/source/card-copy.json'");
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, source);
}
console.log('Staged two-card migration scripts.');
