const fs = require('node:fs'), path = require('node:path');
const repo = path.resolve(__dirname, '../../../..');
const file = path.join(repo, 'artwork/cards/framed-collection-v14/review/index.html');
let text = fs.readFileSync(file, 'utf8');
for (const gender of ['male', 'female']) {
  const id = 'ptolemy-common-' + gender;
  const re = new RegExp('<article\\b[^>]*data-figure="ptolemy"[^>]*data-gender="' + gender + '"[^>]*data-rarity="common"[\\s\\S]*?<\\/article>');
  const match = text.match(re);
  if (!match) throw Error('Missing review article ' + id);
  const replacement = match[0].replaceAll('Court Records Apprentice', 'Junior Court Official').replaceAll('court records apprentice', 'junior court official').replace('../../figure-inner-art-v14/assets/' + id + '-pixel.png', '../../ptolemy-common-official-v1/assets/' + id + '-pixel.png');
  text = text.replace(re, replacement);
}
fs.writeFileSync(file, text);
