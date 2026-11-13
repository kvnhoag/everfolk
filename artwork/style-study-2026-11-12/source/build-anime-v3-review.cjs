// ArtCraft review master for the clean anime source and already-filtered outputs.
// No filtering or resampling: all images are retained at 100%, on integer anchors.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const root = path.resolve(__dirname, '..');
const review = path.join(root, 'review', 'anime-v3');
const master = path.join(root, 'masters', 'anime-pixel-v3-review.ecproj');
const before = path.join(root, 'source', 'alexander-anime-before-v3.png');
const entries = [
  { file: before, name: 'BEFORE — clean anime / native 1672×941, centred at 100%', key: 'before', x: 124, y: 70, cropX: 600, cropY: 0, label: 'BEFORE / native pixels' },
  { file: path.join(review, 'alexander-anime-pixel-fine.png'), name: 'AFTER — fine PixelOE / 640×360 grid, exact 3×', key: 'fine', x: 0, y: 0, cropX: 700, cropY: 0, label: 'AFTER / fine 3×' },
  { file: path.join(review, 'alexander-anime-pixel-strong.png'), name: 'AFTER — strong PixelOE / 480×270 grid, exact 4×', key: 'strong', x: 0, y: 0, cropX: 700, cropY: 0, label: 'AFTER / strong 4×' },
];
const unpack = result => JSON.parse(result.content.find(item => item.type === 'text').text);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function decodePng(file) {
  const bytes = fs.readFileSync(file), width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const channels = bytes[25] === 2 ? 3 : bytes[25] === 6 ? 4 : 0;
  if (bytes[24] !== 8 || !channels || bytes[28] !== 0) throw new Error(`Unsupported QA PNG format: ${file}`);
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
    if (predict === undefined) throw new Error(`Unsupported PNG filter ${filter}`);
    data[i] = (raw[y * (stride + 1) + 1 + x] + predict) & 255;
  }
  return { width, height, channels, data };
}

function assertPixels(sourceFile, outputFile, box) {
  const input = decodePng(sourceFile), output = decodePng(outputFile);
  const { sourceX = 0, sourceY = 0, destinationX = 0, destinationY = 0, width = input.width, height = input.height } = box;
  let differingPixels = 0, maximumChannelDifference = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = ((y + sourceY) * input.width + x + sourceX) * input.channels;
    const b = ((y + destinationY) * output.width + x + destinationX) * output.channels;
    if (input.channels === 4 && input.data[a + 3] !== 255) throw new Error('Unexpected input transparency');
    let different = false;
    for (let c = 0; c < 3; c++) {
      const difference = Math.abs(input.data[a + c] - output.data[b + c]);
      maximumChannelDifference = Math.max(maximumChannelDifference, difference);
      if (difference) different = true;
    }
    if (different) differingPixels++;
  }
  const result = { sourceFile, outputFile, ...box, differingPixels, maximumChannelDifference };
  if (differingPixels) throw new Error(`ArtCraft output changed input pixels: ${JSON.stringify(result)}`);
  return result;
}

async function build() {
  for (const entry of entries) {
    if (!fs.existsSync(entry.file)) throw new Error(`Missing final input: ${entry.file}`);
    entry.sha256 = sha(entry.file);
    const image = decodePng(entry.file);
    entry.width = image.width; entry.height = image.height;
    if (entry.key !== 'before' && (image.width !== 1920 || image.height !== 1080)) throw new Error('After image must already be 1920×1080');
  }
  const qa = { master, inputs: entries, checks: [] };
  await withMcp('EffectCraft', { readRoot: root, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args) => unpack(await callTool(name, args));
    await call('open_project', { new: true });
    const stage = await call('execute_command', { command: 'comp.new', params: { name: '01 — ANIME REVIEW STAGE / 1920×1080 / toggle named image layers', width: 1920, height: 1080, frameRate: 1, duration: 1, background: '#111714' } });
    const add = async (item, x, y, name) => {
      const result = await call('execute_command', { command: 'layer.addItem', params: { item, position: [x, y], anchor: [0, 0] } });
      await call('execute_command', { command: 'layer.rename', params: { layer: result.layer, name } });
      await call('set_property', { layer: result.layer, path: 'transform/scale', value: [100, 100, 100] });
      return result.layer;
    };
    for (const entry of entries) {
      const imported = await call('execute_command', { command: 'file.import', params: { paths: [entry.file] } });
      if (imported.errors?.length) throw new Error(JSON.stringify(imported.errors));
      entry.item = imported.items[0];
      entry.stageLayer = await add(entry.item, entry.x, entry.y, entry.name);
    }
    const setVisible = async selected => {
      for (const entry of entries) await call('execute_command', { command: 'layer.setSwitch', params: { layers: [entry.stageLayer], switch: 'video', value: entry.key === selected } });
    };
    for (const entry of entries) {
      await setVisible(entry.key);
      const output = path.join(review, `anime-${entry.key}-stage.png`);
      await call('render_frame', { comp: stage.comp, path: output, max_side: 0, inline: false, time: 0 });
      qa.checks.push(assertPixels(entry.file, output, { destinationX: entry.x, destinationY: entry.y }));
    }
    for (const entry of entries) {
      const crop = await call('execute_command', { command: 'comp.new', params: { name: `FACE CROP — ${entry.key} / native-pixel window`, width: 500, height: 600, frameRate: 1, duration: 1 } });
      await add(entry.item, -entry.cropX, -entry.cropY, `Native ${entry.key} image / cropped by composition, no scaling`);
      entry.cropComp = crop.comp;
    }
    const face = await call('execute_command', { command: 'comp.new', params: { name: '02 — FACE COMPARISON / native pixels / no extra enlargement', width: 1580, height: 690, frameRate: 1, duration: 1, background: '#111714' } });
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index], x = 20 + index * 520;
      await add(entry.cropComp, x, 70, `${entry.name} / native-pixel face crop`);
      await call('execute_command', { command: 'layer.newText', params: { name: `${entry.key} editable review label`, text: entry.label, box: [x, 23, 500, 34], font: 'Arial', size: 21, fill: '#e6dfd2', tracking: 15, justify: 'left', edit: false } });
    }
    const faceOutput = path.join(review, 'anime-face-comparison.png');
    await call('render_frame', { comp: face.comp, path: faceOutput, max_side: 0, inline: false, time: 0 });
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      qa.checks.push(assertPixels(entry.file, faceOutput, { sourceX: entry.cropX, sourceY: entry.cropY, destinationX: 20 + index * 520, destinationY: 70, width: 500, height: 600 }));
    }
    await call('execute_command', { command: 'comp.open', params: { comp: stage.comp } });
    await setVisible('fine');
    await call('save_project', { path: master });
    qa.stageComp = await call('get_comp', {});
    qa.faceComp = face.comp;
    await call('execute_command', { command: 'file.closeProject' });
  });
  const fineStage = path.join(review, 'anime-fine-stage.png'), expectedHash = sha(fineStage);
  await withMcp('EffectCraft', { readRoot: root, writeRoot: root, timeoutMs: 60000 }, async ({ callTool }) => {
    await callTool('open_project', { path: master });
    await callTool('render_frame', { path: fineStage, max_side: 0, inline: false, time: 0 });
    await callTool('execute_command', { command: 'file.closeProject' });
  });
  if (sha(fineStage) !== expectedHash) throw new Error('Native reopen changed fine stage');
  qa.nativeReopenMatches = true;
  qa.inputsUnchanged = entries.every(entry => sha(entry.file) === entry.sha256);
  if (!qa.inputsUnchanged) throw new Error('Input changed during master build');
  fs.writeFileSync(path.join(root, 'qa', 'anime-v3-review.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify({ master, review, inputPixelsPreserved: true, nativeReopenMatches: true, inputsUnchanged: true, checks: qa.checks }));
}
build().catch(error => { console.error(error.stack); process.exitCode = 1; });
