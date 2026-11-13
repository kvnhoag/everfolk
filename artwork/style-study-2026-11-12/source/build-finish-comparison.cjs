// Compose the existing ArtCraft portrait exports at identical scale.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const root = path.resolve(__dirname, '..');
const review = path.join(root, 'review');
const master = path.join(root, 'masters', 'chiaroscuro-finish-comparison.ecproj');
const output = path.join(review, 'chiaroscuro-finish-comparison.png');
const entries = [
  ['chiaroscuro-source.png', 'SOURCE'],
  ['chiaroscuro-pixel-fine.png', 'FINE / ~3 px'],
  ['chiaroscuro-pixel-medium.png', 'MEDIUM / ~6 px'],
  ['chiaroscuro-pixel-coarse.png', 'COARSE / ~10 px'],
];
const width = 1728, height = 900, portraitWidth = 397, portraitHeight = 793, gap = 28, top = 78;
const unpack = result => JSON.parse(result.content.find(item => item.type === 'text').text);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function build() {
  const qa = { width, height, portraitWidth, portraitHeight, gap, top, entries, master, output };
  await withMcp('EffectCraft', { readRoot: review, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args) => unpack(await callTool(name, args));
    await call('open_project', { new: true });
    const composition = await call('execute_command', { command: 'comp.new', params: { name: 'Everfolk — Chiaroscuro finish comparison', width, height, frameRate: 1, duration: 1, background: '#111714' } });
    for (let index = 0; index < entries.length; index++) {
      const [filename, label] = entries[index];
      const x = gap + index * (portraitWidth + gap);
      const imported = await call('execute_command', { command: 'file.import', params: { paths: [path.join(review, filename)] } });
      if (imported.errors?.length) throw new Error(JSON.stringify(imported.errors));
      const added = await call('execute_command', { command: 'layer.addItem', params: { item: imported.items[0], position: [x + portraitWidth / 2, top + portraitHeight / 2] } });
      await call('execute_command', { command: 'layer.rename', params: { layer: added.layer, name: `${index + 1} — ${label} / portrait at 100%` } });
      await call('execute_command', { command: 'layer.newText', params: { name: `${index + 1} — editable label`, text: label, box: [x, 28, portraitWidth, 36], font: 'Arial', size: 20, fill: '#e6dfd2', tracking: 25, justify: 'left', edit: false } });
    }
    qa.comp = await call('get_comp', {});
    qa.render = await call('render_frame', { comp: composition.comp, path: output, max_side: 0, inline: false, time: 0 });
    await call('save_project', { path: master });
    await call('execute_command', { command: 'file.closeProject' });
  });
  const png = fs.readFileSync(output);
  qa.exported = { width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: png.length, sha256: sha(output) };
  if (qa.exported.width !== width || qa.exported.height !== height || png.length < 10000) throw new Error('Unexpected comparison export');
  fs.writeFileSync(path.join(root, 'qa', 'chiaroscuro-finish-comparison.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify({ output, master, ...qa.exported }));
}
build().catch(error => { console.error(error.stack); process.exitCode = 1; });
