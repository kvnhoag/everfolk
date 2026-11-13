// Review-only museum-reference board. The Louvre photograph is the actual supplied
// full JPG, embedded unchanged and focused through a native clipping frame.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const master = path.join(ROOT, 'masters', 'Alexander-Portrait-Comparison.vectorcraft');
const png = path.join(ROOT, 'review', 'Alexander-Portrait-Comparison.png');
const panels = [
  { label: 'Ancient reference / Azara Herm', file: 'references/louvre-alexander-azara-full.jpg', x: 40, width: 1146, height: 1500, scale: 1, cropX: 330, cropY: 20, kind: 'Actual museum photograph / source unchanged' },
  { label: 'Revised painting', file: 'source/alexander-portrait-revised.png', x: 630, width: 1122, height: 1402, scale: 2, cropX: 330, cropY: 228, kind: 'Generated game-art interpretation' },
  { label: 'Pixel finish', file: 'assets/alexander-card-pixel.png', x: 1220, width: 840, height: 1050, scale: 2.5, cropX: 248, cropY: 171, kind: 'Finished game-art interpretation' },
];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const folder of ['masters', 'review', 'qa']) fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
for (const panel of panels) panel.sourceSha256 = sha(path.join(ROOT, panel.file));
const unwrap = result => { const text = result.content?.find(item => item.type === 'text'); return text ? JSON.parse(text.text) : result; };
const warnings = [];

async function main() {
  await withMcp('VectorCraft', { readRoot: ROOT, writeRoot: ROOT, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args = {}) => { const result = unwrap(await callTool(name, args)); if (result?.warning) warnings.push(result.warning); if (result?.warnings?.length) warnings.push(...result.warnings); return result; };
    const run = (command, params = {}) => call('run_command', { command, params });
    const text = async (value, x, top, size, font = 'Inter', color = '#24312c') => {
      const result = await run('text.create', { text: value, x, y: 0, font, size, style: 'Regular', color });
      const bounds = (await call('inspect_document', { ids: [result.id], depth: 0 })).nodes[0].bounds;
      await run('object.move', { ids: [result.id], dx: x - bounds.x, dy: top - bounds.y });
      return result.id;
    };
    await run('file.new', { name: 'Alexander / face and hair comparison / review only', width: 1810, height: 920, units: 'Pixels', backgroundContents: 'transparent', colorMode: 'rgb' });
    await run('layer.setProps', { name: '00 Review field / not game artwork' });
    await call('draw_shape', { shape: 'rectangle', name: 'Warm light museum-review background', x: 0, y: 0, width: 1810, height: 920, fill: '#f2efe7', stroke: 'none' });
    await run('layer.new', { name: '10 Heading and editable panel labels', top: true });
    await text('Alexander / face and hair study', 40, 30, 34, 'Source Serif 4');
    for (const panel of panels) await text(panel.label, panel.x, 98, 22);
    for (let index = 0; index < panels.length; index++) {
      const panel = panels[index];
      await run('layer.new', { name: `${20 + index} ${panel.label} / native clipping frame`, top: true });
      const result = await run('file.place', { path: path.join(ROOT, panel.file), link: false, rect: [panel.x - panel.cropX * panel.scale, 140 - panel.cropY * panel.scale, panel.width * panel.scale, panel.height * panel.scale] });
      const id = result.ids[0];
      await run('object.setProps', { id, name: panel.kind, data: { source: panel.file, source_sha256: panel.sourceSha256, role: panel.kind } });
      panel.nativeImage = await run('image.info', { id });
      const clip = await call('draw_shape', { shape: 'rectangle', name: 'Head-focused frame / original full image retained', x: panel.x, y: 140, width: 550, height: 620, fill: '#ffffff', stroke: 'none' });
      const group = await run('object.clippingMask.make', { ids: [id, clip.id] });
      await run('object.setProps', { id: group.id, name: `${panel.label} / editable view crop only` });
      await call('draw_shape', { shape: 'rectangle', name: 'Quiet panel outline', x: panel.x - .5, y: 139.5, width: 551, height: 621, fill: 'none', stroke: '#c9c6b9', strokeWidth: .8 });
    }
    await run('layer.new', { name: '40 Museum object note and exact photograph credit', top: true });
    await text('Louvre Ma 436 · Roman, 1–50 CE · After an earlier portrait · Nose restored', 40, 800, 17, 'Inter', '#48564b');
    await text('Photo: © GrandPalaisRmn (musée du Louvre) / Hervé Lewandowski', 40, 833, 16, 'Inter', '#48564b');
    await text('Review only. The photograph is unmodified; the painting and pixel finish are game-art interpretations.', 40, 874, 14, 'Inter', '#6a746a');
    const fonts = await run('text.fonts');
    if (fonts.some(font => font.status !== 'exact' || font.missingGlyphs)) throw new Error('Comparison-board font substitution');
    await call('save_file', { path: master, compress: true, preview: true });
    await call('export', { format: 'png', path: png, scale: 1 });
    await run('file.close');
  });
  const pngBytes = fs.readFileSync(png);
  if (pngBytes.readUInt32BE(16) !== 1810 || pngBytes.readUInt32BE(20) !== 920) throw new Error('Wrong board export dimensions');
  const inputsUnchanged = panels.every(panel => sha(path.join(ROOT, panel.file)) === panel.sourceSha256);
  if (!inputsUnchanged || warnings.length) throw new Error(JSON.stringify({ inputsUnchanged, warnings }));
  fs.writeFileSync(path.join(ROOT, 'qa', 'portrait-comparison.json'), JSON.stringify({ master, png, width: 1810, height: 920, reviewOnly: true, actualUnmodifiedPhotograph: panels[0].file, inputsUnchanged, panels, photoCredit: '© GrandPalaisRmn (musée du Louvre) / Hervé Lewandowski', warnings }, null, 2));
  console.log(JSON.stringify({ master, png, inputsUnchanged, actualUnmodifiedPhotograph: panels[0].file, warnings }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
