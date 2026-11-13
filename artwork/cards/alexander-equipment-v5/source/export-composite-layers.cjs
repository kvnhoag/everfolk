// Export native vector/UI layers separately so the portrait can be composited at exact pixels.
// Restores original layer visibility and footer ownership before saving the same master.
const fs = require('node:fs');
const path = require('node:path');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const master = path.join(ROOT, 'masters', 'Alexander-The-Great.vectorcraft');
const overlay = path.join(ROOT, 'qa', 'card-overlay.png');
const base = path.join(ROOT, 'qa', 'card-base.png');
const unwrap = result => JSON.parse(result.content.find(item => item.type === 'text').text);
withMcp('VectorCraft', { readRoot: ROOT, writeRoot: ROOT, timeoutMs: 60000 }, async ({ callTool }) => {
  const call = async (name, args = {}) => unwrap(await callTool(name, args));
  const run = (command, params = {}) => call('run_command', { command, params });
  await call('open_file', { path: master });
  const document = await call('inspect_document', { depth: 0 });
  const layers = document.layers.map(({ id, name, visible }) => ({ id, name, visible }));
  if (!layers.some(layer => layer.id === 1 && layer.name.startsWith('00 Card Body')) || !layers.some(layer => layer.id === 4 && layer.name.startsWith('10 Portrait'))) throw new Error('Unexpected card layer IDs');
  try {
    // Footer field is body child #3. Temporarily move it to header layer #8 for the overlay.
    await run('layer.move', { id: 3, target: 8, place: 'inside' });
    await run('layer.setProps', { ids: [1, 4], visible: false });
    await call('export', { format: 'png', path: overlay, scale: 1, options: { background: 'transparent', includeArtboardFill: false } });
    await run('layer.move', { id: 3, target: 1, place: 'inside' });
    for (const layer of layers) await run('layer.setProps', { id: layer.id, visible: layer.id === 1 });
    await call('export', { format: 'png', path: base, scale: 1, options: { background: 'transparent', includeArtboardFill: false } });
  } finally {
    // Both the original child ownership and original visibility are restored.
    await run('layer.move', { id: 3, target: 1, place: 'inside' });
    for (const layer of layers) await run('layer.setProps', { id: layer.id, visible: layer.visible });
    await call('save_file', { path: master, compress: true, preview: true });
    await run('file.close');
  }
  console.log(JSON.stringify({ overlay, base, layers, footerFieldId: 3, portraitImageId: 5, portraitClipGroupId: 7, portraitClip: { x: 30, y: 30, width: 840, height: 1050, radius: 10 }, sourceRestored: true }));
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
