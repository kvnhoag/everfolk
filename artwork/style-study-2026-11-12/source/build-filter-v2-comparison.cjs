// ArtCraft comparison only: preserve every input pixel at 100%, integer translation.
// This file does not create or modify the pixel-art filter or its outputs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const root = path.resolve(__dirname, '..');
const review = path.join(root, 'review');
const master = path.join(root, 'masters', 'chiaroscuro-filter-v2-comparison.ecproj');
const output = path.join(review, 'filter-v2', 'chiaroscuro-filter-v2-comparison.png');
const entries = [
  { file: 'chiaroscuro-source.png', title: 'SOURCE', caption: 'Unfiltered painting', x: 28 },
  { file: 'chiaroscuro-pixel-fine.png', title: 'PREVIOUS MOSAIC', caption: 'Fine / approximately 3 px', x: 453 },
  { file: 'filter-v2/chiaroscuro-pixel-authored-detail.png', title: 'PIXEL / 128×256', caption: '24-color palette', x: 878 },
  { file: 'filter-v2/chiaroscuro-pixel-authored.png', title: 'PIXEL / 100×200', caption: 'Same palette', x: 1303 },
];
const width = 1728, height = 920, top = 104;
const unpack = result => JSON.parse(result.content.find(item => item.type === 'text').text);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Read-only PNG decoder for exact exported-panel pixel QA, RGB8 and RGBA8.
function decodePng(filename) {
  const bytes = fs.readFileSync(filename);
  const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
  const channels = bytes[25] === 2 ? 3 : bytes[25] === 6 ? 4 : 0;
  if (bytes[24] !== 8 || !channels || bytes[28] !== 0) throw new Error(`Unsupported QA PNG format: ${filename}`);
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = w * channels, decoded = Buffer.alloc(stride * h);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? decoded[i - channels] : 0;
      const b = y ? decoded[i - stride] : 0;
      const c = y && x >= channels ? decoded[i - stride - channels] : 0;
      const predicted = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      if (predicted === undefined) throw new Error(`Unsupported PNG row filter ${filter}`);
      decoded[i] = (raw[y * (stride + 1) + 1 + x] + predicted) & 255;
    }
  }
  return { width: w, height: h, channels, data: decoded };
}

function verifyPanels() {
  const board = decodePng(output);
  if (board.width !== width || board.height !== height) throw new Error('Unexpected board dimensions');
  return entries.map(entry => {
    const inputPath = path.join(review, entry.file);
    const source = decodePng(inputPath);
    let differentPixels = 0, maximumChannelDifference = 0;
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const sourceOffset = (y * source.width + x) * source.channels;
      if (source.channels === 4 && source.data[sourceOffset + 3] !== 255) throw new Error(`Input has transparency: ${entry.file}`);
      const boardOffset = ((y + top) * board.width + x + entry.x) * board.channels;
      let different = false;
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs(source.data[sourceOffset + channel] - board.data[boardOffset + channel]);
        if (difference) different = true;
        maximumChannelDifference = Math.max(maximumChannelDifference, difference);
      }
      if (different) differentPixels++;
    }
    const result = { input: entry.file, inputSha256: sha(inputPath), width: source.width, height: source.height, x: entry.x, y: top, differentPixels, maximumChannelDifference, exactMatch: differentPixels === 0 };
    if (!result.exactMatch) throw new Error(`Panel pixel mismatch: ${JSON.stringify(result)}`);
    return result;
  });
}

async function build() {
  const sourceHashes = entries.map(entry => sha(path.join(review, entry.file)));
  await withMcp('EffectCraft', { readRoot: review, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args) => unpack(await callTool(name, args));
    await call('open_project', { new: true });
    const composition = await call('execute_command', { command: 'comp.new', params: { name: 'Everfolk — deterministic pixel filter / exact-pixel comparison', width, height, frameRate: 1, duration: 1, background: '#111714' } });
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      const imported = await call('execute_command', { command: 'file.import', params: { paths: [path.join(review, entry.file)] } });
      if (imported.errors?.length) throw new Error(JSON.stringify(imported.errors));
      const added = await call('execute_command', { command: 'layer.addItem', params: { item: imported.items[0], position: [entry.x, top], anchor: [0, 0] } });
      await call('execute_command', { command: 'layer.rename', params: { layer: added.layer, name: `${index + 1} — ${entry.title} / native pixels, 100%, no effects` } });
      await call('set_property', { layer: added.layer, path: 'transform/scale', value: [100, 100, 100] });
      await call('execute_command', { command: 'layer.newText', params: { name: `${index + 1} — editable title`, text: entry.title, box: [entry.x, 25, 400, 30], font: 'Arial', size: 20, fill: '#e6dfd2', tracking: 25, justify: 'left', edit: false } });
      await call('execute_command', { command: 'layer.newText', params: { name: `${index + 1} — editable caption`, text: entry.caption, box: [entry.x, 57, 400, 28], font: 'Arial', size: 17, fill: '#b8b5a9', tracking: 5, justify: 'left', edit: false } });
    }
    await call('render_frame', { comp: composition.comp, path: output, max_side: 0, inline: false, time: 0 });
    await call('save_project', { path: master });
    await call('execute_command', { command: 'file.closeProject' });
  });
  const panels = verifyPanels();
  if (!entries.every((entry, index) => sha(path.join(review, entry.file)) === sourceHashes[index])) throw new Error('Input changed during comparison build');
  const initialHash = sha(output);
  await withMcp('EffectCraft', { readRoot: root, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    await callTool('open_project', { path: master });
    await callTool('render_frame', { path: output, max_side: 0, inline: false, time: 0 });
    await callTool('execute_command', { command: 'file.closeProject' });
  });
  if (sha(output) !== initialHash) throw new Error('Native reopen changed board render');
  verifyPanels();
  console.log(JSON.stringify({ output, master, width, height, panels, nativeReopenMatches: true, sourceInputsUnchanged: true, outputSha256: initialHash }));
}
build().catch(error => { console.error(error.stack); process.exitCode = 1; });
