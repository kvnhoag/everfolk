// Rebuild the first-round ArtCraft pixel-finish study without changing its source.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');

const root = path.resolve(__dirname, '..');
const source = path.join(__dirname, 'five-style-alexander-base.png');
const master = path.join(root, 'masters', 'chiaroscuro-pixel-finish.ecproj');
const review = path.join(root, 'review');
const qaDir = path.join(root, 'qa');
for (const directory of [path.dirname(master), review, qaDir]) fs.mkdirSync(directory, { recursive: true });
const bytes = fs.readFileSync(source);
const sourceWidth = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
const width = Math.round(sourceWidth / 5);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceHash = sha(source);
const presets = [
  { name: 'fine', blockPx: 3 },
  { name: 'medium', blockPx: 6 },
  { name: 'coarse', blockPx: 10 },
].map(preset => ({ ...preset, horizontal: Math.round(width / preset.blockPx), vertical: Math.round(height / preset.blockPx) }));
const unpack = result => {
  const text = result.content?.find(item => item.type === 'text')?.text;
  return text ? JSON.parse(text) : result;
};
const qa = { source, sourceHash, sourceWidth, crop: { x: (sourceWidth - width) / 2, y: 0, width, height }, width, height, engine: 'ArtCraft EffectCraft', finish: 'Mosaic with sharpColors:true; no posterize', presets, exports: [], reopened: null };

async function build() {
  await withMcp('EffectCraft', { readRoot: __dirname, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args) => unpack(await callTool(name, args));
    await call('open_project', { new: true });
    const composition = await call('execute_command', { command: 'comp.new', params: { name: 'Everfolk — chosen style 03 Chiaroscuro / editable crop and pixel finish', width, height, frameRate: 1, duration: 1 } });
    await call('execute_command', { command: 'file.import', params: { paths: [source], addToComp: true } });
    let comp = await call('get_comp', {});
    const artLayer = comp.layers[0].id;
    await call('execute_command', { command: 'layer.rename', params: { layer: artLayer, name: 'SOURCE — Chiaroscuro centre crop / full flattened concept sheet retained' } });
    const cropPath = path.join(review, 'chiaroscuro-source.png');
    await call('render_frame', { comp: composition.comp, path: cropPath, max_side: 0, inline: false, transparent: true, time: 0 });
    qa.sourceCrop = { output: cropPath, sha256: sha(cropPath) };
    const adjustment = await call('execute_command', { command: 'layer.newAdjustment', params: { name: 'FINISH — shared pixel grid (editable Mosaic)' } });
    const finishLayer = adjustment.layer;
    const fine = presets[0];
    const effect = await call('add_effect', { layer: finishLayer, effect: 'ec.stylize.mosaic', values: { horizontal: fine.horizontal, vertical: fine.vertical, sharpColors: true } });
    const setGrid = async preset => {
      await call('set_property', { layer: finishLayer, path: `${effect.path}/horizontal`, value: preset.horizontal });
      await call('set_property', { layer: finishLayer, path: `${effect.path}/vertical`, value: preset.vertical });
    };
    for (const preset of presets) {
      await setGrid(preset);
      const output = path.join(review, `chiaroscuro-pixel-${preset.name}.png`);
      const result = await call('render_frame', { comp: composition.comp, path: output, max_side: 0, inline: false, transparent: true, time: 0 });
      const png = fs.readFileSync(output);
      const dimensions = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      if (dimensions.width !== width || dimensions.height !== height) throw new Error(`Unexpected export dimensions for ${preset.name}`);
      qa.exports.push({ preset: preset.name, output, bytes: png.length, sha256: sha(output), ...dimensions, result });
      console.log(`Rendered ${preset.name}: ${dimensions.width} x ${dimensions.height}, ${png.length} bytes`);
    }
    await setGrid(presets[1]);
    await call('save_project', { path: master });
    qa.savedProject = master;
    qa.savedComp = await call('get_comp', {});
    qa.savedFinishProperties = await call('get_layer', { layer: finishLayer, flat: true });
    await call('execute_command', { command: 'file.closeProject' });
  });
  await withMcp('EffectCraft', { readRoot: root, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    const project = unpack(await callTool('open_project', { path: master }));
    const comp = unpack(await callTool('get_comp', {}));
    const missing = unpack(await callTool('execute_command', { command: 'footage.missing' }));
    const output = path.join(qaDir, 'chiaroscuro-reopened-medium.png');
    const render = unpack(await callTool('render_frame', { path: output, max_side: 0, inline: false, transparent: true, time: 0 }));
    qa.reopened = { project, comp, missing, render, sha256: sha(output), matchesMedium: sha(output) === qa.exports.find(item => item.preset === 'medium').sha256 };
    if (!qa.reopened.matchesMedium) throw new Error('Reopened native project render differs from saved medium export');
    await callTool('execute_command', { command: 'file.closeProject' });
  });
  qa.sourceUnchanged = sha(source) === sourceHash;
  if (!qa.sourceUnchanged) throw new Error('Source changed');
  fs.writeFileSync(path.join(qaDir, 'chiaroscuro-pixel-study.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify({ master, sourceUnchanged: qa.sourceUnchanged, reopenedMatchesMedium: qa.reopened.matchesMedium }));
}
build().catch(error => { console.error(error.stack); process.exitCode = 1; });
