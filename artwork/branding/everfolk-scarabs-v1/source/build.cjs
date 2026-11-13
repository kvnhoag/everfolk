const fs = require('node:fs');
const path = require('node:path');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');

const ROOT = path.resolve(__dirname, '..');
const C = {
  olive: '#292c25', card: '#33372e', paper: '#f1ead8', cream: '#e7e0c9',
  ink: '#284744', clay: '#db9c78', clayInk: '#9b553e', muted: '#b4b59e',
  rule: '#505548', darkMuted: '#6b7566', lightCard: '#e8e2d2',
};
const sourceFiles = ['concepts-01-04.cjs', 'concepts-05-07.cjs', 'concepts-08-10.cjs'];
const concepts = sourceFiles.flatMap(file => require('./' + file)).sort((a, b) => a.number - b.number);
if (concepts.length !== 10 || new Set(concepts.map(c => c.number)).size !== 10) throw Error('Expected ten distinct concepts');
const cleanWordmark = fs.readFileSync(path.join(__dirname, 'approved-wordmark.svg'), 'utf8');
const glyphs = [...cleanWordmark.matchAll(/<path\s+fill="([^"]+)"\s+transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(1 -1\)"\s+d="([^"]+)"\s*\/>/g)]
  .map((m, index) => ({ name: `Eczar 600 / ${'Everfolk.'[index]}`, d: m[4], matrix: [1, 0, 0, -1, +m[2], +m[3]], accent: index === 8 }));
if (glyphs.length !== 9) throw Error('Approved wordmark parsing failed');
for (const dir of ['masters', 'svg', 'png', 'review', 'qa']) fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
const warnings = [];
const unwrap = result => {
  const text = result.content?.find(item => item.type === 'text');
  return text ? JSON.parse(text.text) : result;
};
const slug = c => `${String(c.number).padStart(2, '0')}-${c.slug}`;
function wrap(text, max = 44) {
  const lines = []; let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) { lines.push(line); line = word; }
    else line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
}

withMcp('VectorCraft', { readRoot: ROOT, writeRoot: ROOT, timeoutMs: 120000 }, async ({ listTools, callTool }) => {
  const tools = await listTools();
  for (const name of ['draw_path', 'command_batch', 'save_file', 'export', 'inspect_document']) {
    if (!tools.some(t => t.name === name)) throw Error('Missing VectorCraft tool: ' + name);
  }
  const catalog = unwrap(await callTool('list_commands', {}));
  for (const id of ['file.new', 'file.close', 'artboard.new', 'object.group', 'object.transform', 'text.create']) {
    if (!catalog.commands.some(c => c.id === id)) throw Error('Missing VectorCraft command: ' + id);
  }
  const call = async (name, args = {}) => {
    const r = unwrap(await callTool(name, args));
    if (r?.warning) warnings.push(r.warning);
    if (r?.warnings?.length) warnings.push(...r.warnings);
    return r;
  };
  const run = (command, params = {}) => call('run_command', { command, params });
  const batch = async (steps, label) => {
    const r = await call('command_batch', { steps, atomic: true, label });
    if (r.failed || r.completed !== steps.length) throw Error('Incomplete batch: ' + JSON.stringify(r));
    return r;
  };
  const transform = (id, matrix) => run('object.transform', { ids: [id], matrix, strokes: true });
  const group = async (ids, name) => {
    const g = await run('object.group', { ids });
    await run('object.setProps', { id: g.id, name });
    return g.id;
  };
  const layer = name => run('layer.new', { name, top: true });
  const newDoc = (name, width, height) => run('file.new', { name, width, height, units: 'Pixels', backgroundContents: 'transparent', colorMode: 'rgb', created: 1794434400 });
  const rect = (x, y, width, height, fill, name = 'Presentation field') => call('draw_path', { d: `M${x} ${y}h${width}v${height}h${-width}Z`, fill, stroke: 'none', name });
  const text = (value, x, y, size, color = C.cream, extra = {}) => run('text.create', { text: value, x, y, size, color, font: 'Inter', style: 'Regular', ...extra });
  const lines = async (value, x, y, size, color, max, leading = size * 1.5) => {
    for (const [i, line] of wrap(value, max).entries()) await text(line, x, y + i * leading, size, color);
  };
  const exportFile = (format, relative, extra = {}) => call('export', { format, path: path.join(ROOT, relative), outlineText: true, ...extra });
  async function shapes(items, color, name, accent = color) {
    const r = await batch(items.map(shape => ({ id: 'draw_path', params: { d: shape.d, fill: shape.accent ? accent : color, stroke: 'none', name: shape.name } })), name);
    const transforms = items.flatMap((shape, i) => shape.matrix ? [{ id: 'object.transform', params: { ids: [r.created[i]], matrix: shape.matrix, strokes: true } }] : []);
    if (transforms.length) await batch(transforms, name + ' / local transforms');
    return group(r.created, name);
  }
  async function symbol(c, x, y, size, color = C.ink) {
    const id = await shapes(c.shapes, color, `${String(c.number).padStart(2, '0')} ${c.name} / standalone scarab`);
    if (!c.inkBounds) {
      const inspected = await call('inspect_document', { ids: [id], depth: 0 });
      const b = inspected.nodes?.[0]?.bounds;
      if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) throw Error('Missing symbol bounds: ' + JSON.stringify(inspected));
      c.inkBounds = b;
    }
    const b = c.inkBounds;
    const s = size / Math.max(b.width, b.height);
    await transform(id, [s, 0, 0, s, x + (size - b.width * s) / 2 - b.x * s, y + (size - b.height * s) / 2 - b.y * s]);
    return id;
  }
  async function wordmark(x, y, width, tone = 'ink', monochrome = false) {
    const color = tone === 'cream' ? C.cream : C.ink;
    const accent = monochrome ? color : tone === 'cream' ? C.clay : C.clayInk;
    const id = await shapes(glyphs, color, 'Everfolk. / independent approved Eczar wordmark', accent);
    const s = width / 3959;
    await transform(id, [s, 0, 0, s, x, y]);
    return id;
  }
  async function stacked(c, x, y, tone = 'ink', scale = 1) {
    const color = tone === 'cream' ? C.cream : C.ink;
    const ids = [await symbol(c, 420, 92, 360, color), await wordmark(180, 530, 840, tone)];
    const id = await group(ids, `${c.name} / stacked signature`);
    await transform(id, [scale, 0, 0, scale, x, y]);
    return id;
  }
  async function horizontal(c, x, y, tone = 'ink', scale = 1) {
    const color = tone === 'cream' ? C.cream : C.ink;
    const ids = [await symbol(c, 60, 60, 260, color), await wordmark(390, 85, 940, tone)];
    const id = await group(ids, `${c.name} / horizontal signature`);
    await transform(id, [scale, 0, 0, scale, x, y]);
    return id;
  }
  async function saveNative(relative) { await call('save_file', { path: path.join(ROOT, relative), compress: true, preview: true }); }
  async function verifyFonts() {
    const fonts = await run('text.fonts');
    if (fonts.some(f => f.status !== 'exact' || f.missingGlyphs)) throw Error('Font resolution problem: ' + JSON.stringify(fonts));
  }
  async function reopen(relative, expectedBoards, proofRelative, artboard = 0, scale = 1) {
    await call('open_file', { path: path.join(ROOT, relative) });
    const inspected = await call('inspect_document', { depth: 1, childLimit: 4 });
    if (inspected.artboards.length !== expectedBoards) throw Error(`Lost artboards reopening ${relative}`);
    const raster = await call('inspect_document', { kind: 'Image', limit: 0 });
    if (raster.total > 0) throw Error('Unexpected raster image in native vector master');
    fs.writeFileSync(path.join(ROOT, 'qa', path.basename(relative, '.vectorcraft') + '-reopened.json'), JSON.stringify({ ...inspected, rasterImages: raster.total ?? 0 }, null, 2));
    if (proofRelative) await exportFile('png', proofRelative, { artboard, scale });
    await run('file.close');
  }

  // Review the symbol and the full name as independently sufficient identifiers.
  await newDoc('Everfolk / ten scarab directions', 2500, 1520);
  await rect(0, 0, 2500, 1520, C.olive, 'Olive presentation background');
  await wordmark(73, 39, 660, 'cream');
  await text('TEN SCARAB DIRECTIONS', 2420, 93, 24, C.cream, { justify: 'right', style: 'Medium' });
  await text('An emblem in its own right. A name in its own right.', 2420, 132, 18, C.muted, { justify: 'right' });
  await rect(80, 204, 2340, 1, C.rule, 'Header divider');
  for (const [i, c] of concepts.entries()) {
    const x = 80 + (i % 5) * 472;
    const y = 239 + Math.floor(i / 5) * 610;
    await layer(`${String(c.number).padStart(2, '0')} ${c.name}`);
    await rect(x, y, 452, 580, C.card, 'Direction field');
    await text(String(c.number).padStart(2, '0'), x + 25, y + 39, 17, C.clay, { style: 'Medium' });
    await symbol(c, x + 111, y + 61, 230, C.cream);
    await wordmark(x + 48, y + 326, 356, 'cream');
    await rect(x + 25, y + 430, 402, 1, C.rule, 'Card divider');
    await text(c.name, x + 25, y + 468, 22, C.cream, { style: 'Medium' });
    await lines(c.meaning, x + 25, y + 502, 14, C.muted, 47, 21);
    await text('STANDALONE / 32 PX', x + 25, y + 558, 10, C.muted);
    await symbol(c, x + 389, y + 535, 32, C.cream);
  }
  await text('Symbol: becoming, possibility and another beginning.  /  Lettering: the approved Printed Folktale wordmark.', 80, 1483, 14, C.muted);
  await verifyFonts();
  await saveNative('review/Everfolk-10-Scarab-Directions.vectorcraft');
  await exportFile('png', 'review/Everfolk-10-Scarab-Directions.png');
  await exportFile('svg', 'review/Everfolk-10-Scarab-Directions.svg');
  fs.writeFileSync(path.join(ROOT, 'qa/geometry-bounds.json'), JSON.stringify(concepts.map(c => ({ number: c.number, name: c.name, bounds: c.inkBounds })), null, 2));
  await run('file.close');
  console.log('Saved native ten-direction review sheet.');
  if (process.argv.includes('--review-only')) return;

  // Four transparent artboards per direction: two emblem tones and two lockups.
  for (const c of concepts) {
    const base = slug(c);
    await newDoc(`Everfolk / ${String(c.number).padStart(2, '0')} ${c.name}`, 512, 512);
    await run('artboard.setProps', { index: 0, name: '01 Standalone emblem / ink' });
    await run('artboard.new', { x: 620, y: 0, width: 512, height: 512, name: '02 Standalone emblem / cream' });
    await run('artboard.new', { x: 0, y: 640, width: 1200, height: 820, name: '03 Stacked signature / cream' });
    await run('artboard.new', { x: 0, y: 1600, width: 1400, height: 380, name: '04 Horizontal signature / ink' });
    await layer('01 Standalone scarab / ink'); await symbol(c, 48, 48, 416, C.ink);
    await layer('02 Standalone scarab / cream'); await symbol(c, 668, 48, 416, C.cream);
    await layer('03 Scarab and name / cream'); await stacked(c, 0, 640, 'cream');
    await layer('04 Scarab beside name / ink'); await horizontal(c, 0, 1600, 'ink');
    await saveNative(`masters/${base}.vectorcraft`);
    const variants = ['emblem-ink', 'emblem-cream', 'stacked-cream', 'horizontal-ink'];
    for (const [artboard, variant] of variants.entries()) {
      await exportFile('svg', `svg/${base}-${variant}.svg`, { artboard });
      await exportFile('png', `png/${base}-${variant}.png`, { artboard, scale: artboard < 2 ? 2 : 1 });
    }
    for (const size of [16, 24, 32, 48, 64, 128]) await exportFile('png', `png/${base}-icon-${size}.png`, { artboard: 0, scale: size / 512 });
    await run('file.close');
    await reopen(`masters/${base}.vectorcraft`, 4, `qa/${base}-reopened.png`, 0, 1);

    // A dedicated proof shows both independent identifiers and the combined logo.
    await newDoc(`Everfolk / ${c.name} proof`, 1600, 1200);
    await rect(0, 0, 1600, 1200, C.paper, 'Paper presentation background');
    await text(`${String(c.number).padStart(2, '0')}  ${c.name}`, 70, 90, 34, C.ink, { style: 'Medium' });
    await text(c.meaning, 70, 131, 20, C.darkMuted);
    await rect(60, 180, 700, 650, C.olive, 'Dark emblem field');
    await text('THE SCARAB / STANDALONE', 95, 225, 13, C.muted);
    await symbol(c, 198, 290, 424, C.cream);
    await rect(790, 180, 750, 650, C.lightCard, 'Light lockup field');
    await text('THE EMBLEM WITH THE NAME', 825, 225, 13, C.darkMuted);
    await stacked(c, 790, 240, 'ink', .625);
    await text('THE NAME / STANDALONE', 90, 895, 13, C.darkMuted);
    await wordmark(85, 919, 820, 'ink');
    await text('SMALL-SIZE PROOF', 1070, 895, 13, C.darkMuted);
    for (const [i, size] of [64, 48, 32, 24].entries()) {
      const xx = 1070 + i * 116;
      await symbol(c, xx, 946 + (64 - size) / 2, size, C.ink);
      await text(`${size} px`, xx + size / 2, 1044, 13, C.darkMuted, { justify: 'center' });
    }
    await rect(70, 1131, 1460, 1, '#c5c9b8', 'Footer divider');
    await text('Printed Folktale / Eczar 600   •   Symbol and wordmark may each be used independently.', 70, 1169, 15, C.darkMuted);
    await verifyFonts();
    await saveNative(`review/${base}-proof.vectorcraft`);
    await exportFile('png', `review/${base}-proof.png`);
    await exportFile('svg', `review/${base}-proof.svg`);
    await run('file.close');
    console.log(`Saved and reopened ${base}.`);
  }

  // The approved name remains its own complete identity, with no emblem required.
  await newDoc('Everfolk / independent wordmark', 1200, 300);
  await run('artboard.setProps', { index: 0, name: '01 Independent name / ink' });
  await run('artboard.new', { x: 0, y: 420, width: 1200, height: 300, name: '02 Independent name / cream' });
  await wordmark(80, 32, 1040, 'ink');
  await wordmark(80, 452, 1040, 'cream');
  await saveNative('masters/everfolk-independent-wordmark.vectorcraft');
  for (const [artboard, tone] of ['ink', 'cream'].entries()) {
    await exportFile('svg', `svg/everfolk-wordmark-${tone}.svg`, { artboard });
    await exportFile('png', `png/everfolk-wordmark-${tone}.png`, { artboard, scale: 2 });
  }
  await run('file.close');
  await reopen('masters/everfolk-independent-wordmark.vectorcraft', 2);
  await reopen('review/Everfolk-10-Scarab-Directions.vectorcraft', 1, 'qa/review-reopened.png', 0, .5);

  const manifest = {
    name: 'Everfolk / ten scarab logo directions', date: '2026-11-11',
    identity: 'An independent scarab emblem and independent Everfolk. wordmark; optional stacked and horizontal signatures.',
    wordmark: { font: 'Eczar', weight: 600, trackingEm: -.025, source: '../everfolk-printed-folktale', artwork: 'Original approved outlines, clean small-size treatment, clay terminal period.' },
    palette: C,
    references: [
      { url: 'https://www.metmuseum.org/art/collection/search/549272', role: 'Historical basis for becoming and coming into existence; geometry is original.' },
      { url: 'https://www.ubisoft.com/en-us/game/assassins-creed', role: 'Requested identity architecture: independently sufficient emblem and name. No Ubisoft artwork or lettering used.' },
    ],
    review: 'review/Everfolk-10-Scarab-Directions.png',
    concepts: concepts.map(c => ({ number: c.number, name: c.name, slug: c.slug, meaning: c.meaning, designNotes: c.notes, inkBounds: c.inkBounds, master: `masters/${slug(c)}.vectorcraft`, proof: `review/${slug(c)}-proof.png`, variants: ['emblem-ink', 'emblem-cream', 'stacked-cream', 'horizontal-ink'].map(v => ({ svg: `svg/${slug(c)}-${v}.svg`, png: `png/${slug(c)}-${v}.png` })) })),
    warnings,
  };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  if (warnings.length) throw Error('Review export warnings: ' + JSON.stringify(warnings));
  console.log('Completed all ten native identities and proofs. No warnings.');
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
