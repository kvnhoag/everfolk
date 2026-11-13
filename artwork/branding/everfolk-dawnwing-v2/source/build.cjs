const fs = require('node:fs');
const path = require('node:path');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const design = require('./dawnwing.cjs');
const oldDesign = require('./original-dawnwing.cjs');
const C = { olive: '#292c25', card: '#33372e', cream: '#e7e0c9', ink: '#284744', clay: '#db9c78', clayInk: '#9b553e', paper: '#f1ead8', muted: '#b4b59e', darkMuted: '#6b7566', light: '#e8e2d2' };
const svg = fs.readFileSync(path.join(__dirname, 'approved-wordmark.svg'), 'utf8');
const glyphs = [...svg.matchAll(/<path\s+fill="([^"]+)"\s+transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(1 -1\)"\s+d="([^"]+)"\s*\/>/g)].map((m, i) => ({ name: `Eczar 600 / ${'Everfolk.'[i]}`, d: m[4], matrix: [1, 0, 0, -1, +m[2], +m[3]], accent: i === 8 }));
if (glyphs.length !== 9) throw Error('Approved wordmark outlines missing');
const unwrap = r => { const t = r.content?.find(c => c.type === 'text'); return t ? JSON.parse(t.text) : r; };
const warnings = [];
withMcp('VectorCraft', { readRoot: ROOT, writeRoot: ROOT, timeoutMs: 120000 }, async ({ listTools, callTool }) => {
  const available = await listTools();
  for (const name of ['draw_path', 'command_batch', 'export', 'save_file', 'inspect_document']) if (!available.some(t => t.name === name)) throw Error('Missing ' + name);
  const catalog = unwrap(await callTool('list_commands', {}));
  for (const id of ['file.new', 'file.close', 'object.transform', 'object.group', 'object.pathfinder.unite', 'artboard.new']) if (!catalog.commands.some(c => c.id === id)) throw Error('Missing command ' + id);
  const call = async (name, args = {}) => {
    const r = unwrap(await callTool(name, args));
    if (r?.warning) warnings.push(r.warning);
    if (r?.warnings?.length) warnings.push(...r.warnings);
    return r;
  };
  const run = (command, params = {}) => call('run_command', { command, params });
  const batch = async (steps, label) => { const r = await call('command_batch', { steps, label, atomic: true }); if (r.failed || r.completed !== steps.length) throw Error(JSON.stringify(r)); return r; };
  const transform = (id, matrix) => run('object.transform', { ids: [id], matrix, strokes: true });
  async function group(ids, name) { const r = await run('object.group', { ids }); await run('object.setProps', { id: r.id, name }); return r.id; }
  async function drawParts(parts, color, accent = color) {
    const r = await batch(parts.map(s => ({ id: 'draw_path', params: { name: s.name, d: s.d, fill: s.accent ? accent : color, stroke: 'none' } })), 'Editable filled paths');
    const transforms = parts.flatMap((s, i) => s.matrix ? [{ id: 'object.transform', params: { ids: [r.created[i]], matrix: s.matrix, strokes: true } }] : []);
    if (transforms.length) await batch(transforms, 'Local path transforms');
    return r.created;
  }
  async function mark(d, x, y, size, color) {
    let ids = await drawParts(d.shapes, color);
    if (d === design) {
      const united = await run('object.pathfinder.unite', { ids, precision: .001, removeRedundantPoints: false });
      if (!united.ids?.length) throw Error('Continuous silhouette union failed');
      ids = united.ids;
    }
    const id = await group(ids, d.name + ' / independent emblem');
    if (!d.bounds) { const r = await call('inspect_document', { ids: [id], depth: 0 }); d.bounds = r.nodes[0].bounds; }
    const b = d.bounds; const s = size / Math.max(b.width, b.height);
    await transform(id, [s, 0, 0, s, x + (size - b.width * s) / 2 - b.x * s, y + (size - b.height * s) / 2 - b.y * s]);
    return id;
  }
  async function word(x, y, width, tone = 'ink') {
    const id = await group(await drawParts(glyphs, C[tone], tone === 'cream' ? C.clay : C.clayInk), 'Everfolk. / independent approved wordmark');
    const s = width / 3959; await transform(id, [s, 0, 0, s, x, y]); return id;
  }
  const rect = (x, y, w, h, fill) => call('draw_path', { name: 'Presentation field', d: `M${x} ${y}h${w}v${h}h${-w}Z`, fill, stroke: 'none' });
  const text = (text, x, y, size, color, extra = {}) => run('text.create', { text, x, y, size, color, font: 'Inter', style: 'Regular', ...extra });
  const newDoc = (name, width, height) => run('file.new', { name, width, height, units: 'Pixels', backgroundContents: 'transparent', colorMode: 'rgb' });
  const ex = (format, file, extra = {}) => call('export', { format, path: path.join(ROOT, file), outlineText: true, ...extra });
  const save = file => call('save_file', { path: path.join(ROOT, file), compress: true, preview: true });
  async function stacked(x, y, tone) { await mark(design, x + 420, y + 80, 360, C[tone]); await word(x + 180, y + 510, 840, tone); }
  async function horizontal(x, y, tone) { await mark(design, x + 60, y + 60, 260, C[tone]); await word(x + 390, y + 85, 940, tone); }
  async function verifyFonts() { const fonts = await run('text.fonts'); if (fonts.some(f => f.status !== 'exact' || f.missingGlyphs)) throw Error('Font resolution: ' + JSON.stringify(fonts)); }

  await newDoc('Everfolk / Dawnwing refined', 512, 512);
  await run('artboard.setProps', { index: 0, name: '01 Standalone scarab / ink' });
  const boards = [
    { x: 620, y: 0, width: 512, height: 512, name: '02 Standalone scarab / cream' },
    { x: 0, y: 650, width: 1200, height: 800, name: '03 Stacked / ink' },
    { x: 1350, y: 650, width: 1200, height: 800, name: '04 Stacked / cream' },
    { x: 0, y: 1600, width: 1400, height: 380, name: '05 Horizontal / ink' },
    { x: 1550, y: 1600, width: 1400, height: 380, name: '06 Horizontal / cream' },
    { x: 0, y: 2130, width: 1200, height: 300, name: '07 Independent name / ink' },
    { x: 1350, y: 2130, width: 1200, height: 300, name: '08 Independent name / cream' },
  ];
  for (const b of boards) await run('artboard.new', b);
  await mark(design, 48, 48, 416, C.ink); await mark(design, 668, 48, 416, C.cream);
  await stacked(0, 650, 'ink'); await stacked(1350, 650, 'cream');
  await horizontal(0, 1600, 'ink'); await horizontal(1550, 1600, 'cream');
  await word(80, 2162, 1040, 'ink'); await word(1430, 2162, 1040, 'cream');
  await save('masters/Everfolk-Dawnwing-Refined.vectorcraft');
  const names = ['emblem-ink', 'emblem-cream', 'stacked-ink', 'stacked-cream', 'horizontal-ink', 'horizontal-cream', 'wordmark-ink', 'wordmark-cream'];
  for (const [artboard, name] of names.entries()) { await ex('svg', `svg/dawnwing-${name}.svg`, { artboard }); await ex('png', `png/dawnwing-${name}.png`, { artboard, scale: artboard < 2 ? 2 : 1 }); }
  for (const size of [16, 24, 32, 48, 64, 128, 256]) await ex('png', `png/dawnwing-icon-${size}.png`, { artboard: 0, scale: size / 512 });
  await run('file.close');

  await newDoc('Dawnwing / original and smoother refinement', 1800, 1100);
  await rect(0, 0, 1800, 1100, C.olive);
  await text('Dawnwing / smoother flow', 70, 92, 40, C.cream, { style: 'Medium' });
  await text('Continuous contours inside. Pointed outer wing tips.', 70, 137, 21, C.muted);
  await rect(70, 190, 810, 625, C.card); await rect(920, 190, 810, 625, C.card);
  await text('ORIGINAL 05', 105, 238, 15, C.muted); await text('REFINED 05', 955, 238, 15, C.clay);
  await mark(oldDesign, 225, 285, 500, C.cream); await mark(design, 1075, 285, 500, C.cream);
  await word(70, 870, 720, 'cream');
  await text('Rounded wing roots and curved channel ends.', 955, 925, 22, C.cream);
  await text('Softer head, leg bends and lower body.', 955, 965, 22, C.muted);
  await text('The scarab and the name each stand on their own.', 955, 1005, 19, C.muted);
  await verifyFonts(); await save('review/Dawnwing-Before-and-After.vectorcraft'); await ex('png', 'review/Dawnwing-Before-and-After.png'); await ex('svg', 'review/Dawnwing-Before-and-After.svg'); await run('file.close');

  await newDoc('Everfolk / refined Dawnwing identity', 1600, 1200);
  await rect(0, 0, 1600, 1200, C.paper); await text('05 Dawnwing / refined', 70, 90, 34, C.ink, { style: 'Medium' }); await text(design.meaning, 70, 132, 20, C.darkMuted);
  await rect(60, 180, 700, 650, C.olive); await text('THE SCARAB / STANDALONE', 95, 225, 13, C.muted); await mark(design, 198, 290, 424, C.cream);
  await rect(790, 180, 750, 650, C.light); await text('THE EMBLEM WITH THE NAME', 825, 225, 13, C.darkMuted); await mark(design, 1052, 295, 225, C.ink); await word(902, 575, 525, 'ink');
  await text('THE NAME / STANDALONE', 90, 895, 13, C.darkMuted); await word(85, 919, 820, 'ink'); await text('SMALL-SIZE PROOF', 1070, 895, 13, C.darkMuted);
  for (const [i, size] of [64, 48, 32, 24].entries()) { const x = 1070 + i * 116; await mark(design, x, 946 + (64 - size) / 2, size, C.ink); await text(`${size} px`, x + size / 2, 1044, 13, C.darkMuted, { justify: 'center' }); }
  await text('Printed Folktale / Eczar 600  •  A standalone emblem and an independent name.', 70, 1169, 15, C.darkMuted);
  await verifyFonts(); await save('review/Dawnwing-Identity-Proof.vectorcraft'); await ex('png', 'review/Dawnwing-Identity-Proof.png'); await ex('svg', 'review/Dawnwing-Identity-Proof.svg'); await run('file.close');

  await call('open_file', { path: path.join(ROOT, 'masters/Everfolk-Dawnwing-Refined.vectorcraft') });
  const reopened = await call('inspect_document', { depth: 1, childLimit: 2 });
  const images = await call('inspect_document', { kind: 'Image', limit: 0 });
  if (reopened.artboards.length !== 8 || images.total > 0) throw Error('Native master verification failed');
  fs.writeFileSync(path.join(ROOT, 'qa/master-reopened.json'), JSON.stringify({ ...reopened, rasterImages: images.total ?? 0 }, null, 2));
  await ex('png', 'qa/emblem-reopened.png', { artboard: 0 }); await run('file.close');
  if (warnings.length) throw Error('Warnings: ' + JSON.stringify(warnings));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({ name: design.name, parent: '../everfolk-scarabs-v1/05-dawnwing', changes: design.changes, master: 'masters/Everfolk-Dawnwing-Refined.vectorcraft', artboards: 8, exports: names, palette: C, warnings }, null, 2));
  console.log('Saved refined Dawnwing, eight native artboards, eight SVG/PNG variants, icon sizes, comparison and identity proofs. Reopened master passed; no warnings.');
}).catch(e => { console.error(e.stack); process.exitCode = 1; });
