// ArtCraft review of the native hybrid anime/Chiaroscuro source and filtered outputs.
// Preserves native RGB pixels: no effects, resizing or interpolation is applied.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const root = path.resolve(__dirname, '..');
const review = path.join(root, 'review', 'hybrid-v5');
const master = path.join(root, 'masters', 'anime-chiaroscuro-v5-review.ecproj');
const output = path.join(review, 'hybrid-aura-face-comparison.png');
const entries = [
  { file: path.join(root, 'review', 'anime-v4', 'alexander-anime-pixel-bold.png'), key: 'previous', name: 'PREVIOUS ANIME — 320×180 / exact 6×', label: 'ANIME / 320×180 / 6×' },
  { file: path.join(review, 'alexander-hybrid-pixel-bold.png'), key: 'bold', name: 'HYBRID BOLD — 320×180 / exact 6×', label: 'HYBRID BOLD / 320×180 / 6×' },
  { file: path.join(review, 'alexander-hybrid-pixel-chunky.png'), key: 'chunky', name: 'HYBRID CHUNKY — 240×135 / exact 8×', label: 'HYBRID CHUNKY / 240×135 / 8×' },
];
const before = { file: path.join(root, 'source', 'alexander-anime-chiaroscuro-before-v5.png'), key: 'before', name: 'BEFORE — hybrid clean painting / native 1672×941, centered at 100%', x: 124, y: 70 };
const stageEntries = [before, ...entries];
const unpack = result => JSON.parse(result.content.find(item => item.type === 'text').text);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function decodePng(input) {
  const bytes = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const channels = bytes[25] === 2 ? 3 : bytes[25] === 6 ? 4 : 0;
  if (bytes[24] !== 8 || !channels || bytes[28]) throw new Error('Unsupported readback PNG format');
  const chunks = [];
  for (let i = 8; i < bytes.length;) {
    const length = bytes.readUInt32BE(i);
    if (bytes.toString('ascii', i + 4, i + 8) === 'IDAT') chunks.push(bytes.subarray(i + 8, i + 8 + length));
    i += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * channels, data = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) for (let x = 0; x < stride; x++) {
    const i = y * stride + x, filter = raw[y * (stride + 1)];
    const a = x >= channels ? data[i - channels] : 0, b = y ? data[i - stride] : 0, c = y && x >= channels ? data[i - stride - channels] : 0;
    const predict = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
    if (predict === undefined) throw new Error('Unsupported readback PNG row filter');
    data[i] = (raw[y * (stride + 1) + 1 + x] + predict) & 255;
  }
  return { width, height, channels, data };
}

function assertPixels(sourceFile, rendered, box = {}) {
  const input = decodePng(sourceFile), outputImage = decodePng(rendered);
  const { sourceX = 0, sourceY = 0, destinationX = 0, destinationY = 0, width = input.width, height = input.height } = box;
  let differingPixels = 0, maximumChannelDifference = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = ((y + sourceY) * input.width + x + sourceX) * input.channels;
    const b = ((y + destinationY) * outputImage.width + x + destinationX) * outputImage.channels;
    if (input.channels === 4 && input.data[a + 3] !== 255) throw new Error('Unexpected input transparency');
    let different = false;
    for (let c = 0; c < 3; c++) {
      const difference = Math.abs(input.data[a + c] - outputImage.data[b + c]);
      maximumChannelDifference = Math.max(maximumChannelDifference, difference);
      if (difference) different = true;
    }
    if (different) differingPixels++;
  }
  const result = { sourceFile, ...box, differingPixels, maximumChannelDifference };
  if (differingPixels) throw new Error(`Changed input pixels: ${JSON.stringify(result)}`);
  return result;
}

async function build() {
  for (const entry of stageEntries) {
    entry.sha256 = sha(entry.file);
    const image = decodePng(entry.file);
    if (entry.key !== 'before' && (image.width !== 1920 || image.height !== 1080)) throw new Error(`Input must already be 1920×1080: ${entry.file}`);
  }
  const qa = { master, output, inputs: stageEntries, fullStageChecks: [], faceChecks: [] };
  await withMcp('EffectCraft', { readRoot: root, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args) => unpack(await callTool(name, args));
    await call('open_project', { new: true });
    const stage = await call('execute_command', { command: 'comp.new', params: { name: '01 — HYBRID ANIME + CHIAROSCURO / 1920×1080 / toggle named layers', width: 1920, height: 1080, frameRate: 1, duration: 1, background: '#111714' } });
    const add = async (item, x, y, name) => {
      const result = await call('execute_command', { command: 'layer.addItem', params: { item, position: [x, y], anchor: [0, 0] } });
      await call('execute_command', { command: 'layer.rename', params: { layer: result.layer, name } });
      await call('set_property', { layer: result.layer, path: 'transform/scale', value: [100, 100, 100] });
      return result.layer;
    };
    for (const entry of stageEntries) {
      const imported = await call('execute_command', { command: 'file.import', params: { paths: [entry.file] } });
      if (imported.errors?.length) throw new Error(JSON.stringify(imported.errors));
      entry.item = imported.items[0];
      entry.stageLayer = await add(entry.item, entry.x || 0, entry.y || 0, `${entry.name} / 100%, no additional effects`);
    }
    const setVisible = async selected => {
      for (const entry of stageEntries) await call('execute_command', { command: 'layer.setSwitch', params: { layers: [entry.stageLayer], switch: 'video', value: entry.key === selected } });
    };
    // Verify full-stage RGB in memory; no redundant full-stage PNGs are written.
    for (const entry of stageEntries) {
      await setVisible(entry.key);
      const rendered = await callTool('render_frame', { comp: stage.comp, max_side: 0, inline: true, time: 0 });
      const image = rendered.content.find(item => item.type === 'image');
      if (!image) throw new Error('Missing full-stage readback image');
      qa.fullStageChecks.push(assertPixels(entry.file, Buffer.from(image.data, 'base64'), { destinationX: entry.x || 0, destinationY: entry.y || 0 }));
    }
    for (const entry of entries) {
      const crop = await call('execute_command', { command: 'comp.new', params: { name: `FACE CROP — ${entry.key} / identical window`, width: 500, height: 600, frameRate: 1, duration: 1 } });
      await add(entry.item, -700, 0, `${entry.name} / crop only, no scaling`);
      entry.cropComp = crop.comp;
    }
    const face = await call('execute_command', { command: 'comp.new', params: { name: '02 — AURA COMPARISON / same framing, native pixels', width: 1580, height: 690, frameRate: 1, duration: 1, background: '#111714' } });
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index], x = 20 + index * 520;
      await add(entry.cropComp, x, 70, `${entry.name} / same-framing face crop`);
      await call('execute_command', { command: 'layer.newText', params: { name: `${entry.key} editable review label`, text: entry.label, box: [x, 23, 500, 34], font: 'Arial', size: 21, fill: '#e6dfd2', tracking: 10, justify: 'left', edit: false } });
    }
    await call('render_frame', { comp: face.comp, path: output, max_side: 0, inline: false, time: 0 });
    for (let index = 0; index < entries.length; index++) qa.faceChecks.push(assertPixels(entries[index].file, output, { sourceX: 700, sourceY: 0, destinationX: 20 + index * 520, destinationY: 70, width: 500, height: 600 }));
    await call('execute_command', { command: 'comp.open', params: { comp: stage.comp } });
    await setVisible('bold');
    await call('save_project', { path: master });
    qa.stageComp = await call('get_comp', {});
    qa.faceComp = face.comp;
    await call('execute_command', { command: 'file.closeProject' });
  });
  const expectedHash = sha(output);
  await withMcp('EffectCraft', { readRoot: root, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    await callTool('open_project', { path: master });
    await callTool('render_frame', { comp: qa.faceComp, path: output, max_side: 0, inline: false, time: 0 });
    await callTool('execute_command', { command: 'file.closeProject' });
  });
  if (sha(output) !== expectedHash) throw new Error('Native reopen changed face comparison');
  qa.nativeReopenMatches = true;
  qa.inputsUnchanged = stageEntries.every(entry => sha(entry.file) === entry.sha256);
  if (!qa.inputsUnchanged) throw new Error('Input changed during review build');
  fs.writeFileSync(path.join(root, 'qa', 'hybrid-v5-review.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify({ master, output, inputPixelsPreserved: true, nativeReopenMatches: true, inputsUnchanged: true, fullStageChecks: qa.fullStageChecks, faceChecks: qa.faceChecks }));
}
build().catch(error => { console.error(error.stack); process.exitCode = 1; });
