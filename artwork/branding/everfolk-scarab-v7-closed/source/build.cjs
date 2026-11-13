const fs = require('node:fs');
const path = require('node:path');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const body = require('./body.cjs');
const C = { olive: '#292c25', field: '#33372e', cream: '#e7e0c9', paper: '#f1ead8', ink: '#203f3b', clay: '#db9c78', clayInk: '#9b553e', muted: '#b4b59e', darkMuted: '#6b7566', light: '#e8e2d2' };
const PALETTE = { limb: '#d8bc7b', core: '#214942', crown: '#dfad79', thorax: '#4e7c67', shell: '#ddc383', shellShade: '#b89c64', detail: '#214942' };
const glyphs = [...fs.readFileSync(path.join(__dirname, 'approved-wordmark.svg'), 'utf8').matchAll(/<path\s+fill="([^"]+)"\s+transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(1 -1\)"\s+d="([^"]+)"\s*\/>/g)].map((m, i) => ({ name: `Eczar 600 / ${'Everfolk.'[i]}`, d: m[4], matrix: [1, 0, 0, -1, +m[2], +m[3]], accent: i === 8 }));
if (glyphs.length !== 9 || !Array.isArray(body)) throw Error('Source artwork missing');
const current = { name: 'Everfolk / crowned scarab at rest', shapes: body };
const unwrap = r => { const t = r.content?.find(c => c.type === 'text'); return t ? JSON.parse(t.text) : r; };
const warnings = [];

withMcp('VectorCraft', { readRoot: ROOT, writeRoot: ROOT, timeoutMs: 120000 }, async ({ listTools, callTool }) => {
  const tools = await listTools();
  for (const n of ['draw_path', 'command_batch', 'save_file', 'export', 'inspect_document']) if (!tools.some(t => t.name === n)) throw Error('Missing tool ' + n);
  const commands = unwrap(await callTool('list_commands', {}));
  for (const id of ['file.new', 'file.close', 'artboard.new', 'object.group', 'object.transform', 'text.create']) if (!commands.commands.some(c => c.id === id)) throw Error('Missing command ' + id);
  const call = async (name, args = {}) => { const r = unwrap(await callTool(name, args)); if (r?.warning) warnings.push(r.warning); if (r?.warnings?.length) warnings.push(...r.warnings); return r; };
  const run = (command, params = {}) => call('run_command', { command, params });
  const transform = (id, matrix) => run('object.transform', { ids: [id], matrix, strokes: true });
  const batch = async (steps, label) => { const r = await call('command_batch', { steps, label, atomic: true }); if (r.failed || r.completed !== steps.length) throw Error(JSON.stringify(r)); return r; };
  async function group(ids, name) { const g = await run('object.group', { ids }); await run('object.setProps', { id: g.id, name }); return g.id; }
  async function draw(items, options = {}) {
    const results = await batch(items.map(s => {
      let fill = options.color || PALETTE[s.role] || C.cream;
      if (options.word) fill = s.accent ? options.accent : options.color;
      const decorated = s.role && !['feather', 'featherShade', 'detail'].includes(s.role);
      return { id: 'draw_path', params: { name: s.name, d: s.d, fill, stroke: decorated ? C.ink : 'none', strokeWidth: decorated ? (s.role === 'core' ? 1.8 : 1.3) : 0, cap: 'round', join: s.role === 'crown' || s.role === 'wing' ? 'miter' : 'round' } };
    }), 'Native original vector geometry');
    const transforms = items.flatMap((s, i) => s.matrix ? [{ id: 'object.transform', params: { ids: [results.created[i]], matrix: s.matrix, strokes: true } }] : []);
    if (transforms.length) await batch(transforms, 'Reflections and glyph positioning');
    return results.created;
  }
  async function mark(design, x, y, size, compact = false) {
    const items = compact && design === current ? design.shapes.filter(s => !['feather', 'featherShade', 'detail'].includes(s.role)) : design.shapes;
    const id = await group(await draw(items, design === current ? {} : { color: C.cream }), design.name || 'Previous scarab');
    const key = compact ? 'compactBounds' : 'bounds';
    if (!design[key]) { const r = await call('inspect_document', { ids: [id], depth: 0 }); design[key] = r.nodes[0].bounds; }
    const b = design[key], s = size / Math.max(b.width, b.height);
    await transform(id, [s, 0, 0, s, x + (size - b.width * s) / 2 - b.x * s, y + (size - b.height * s) / 2 - b.y * s]);
    return id;
  }
  async function word(x, y, width, tone = 'ink') {
    const id = await group(await draw(glyphs, { word: true, color: C[tone], accent: tone === 'cream' ? C.clay : C.clayInk }), 'Independent Everfolk. / approved Eczar 600');
    const s = width / 3959; await transform(id, [s, 0, 0, s, x, y]); return id;
  }
  const newDoc = (name, width, height) => run('file.new', { name, width, height, units: 'Pixels', backgroundContents: 'transparent', colorMode: 'rgb' });
  const rect = (x, y, w, h, fill) => call('draw_path', { name: 'Presentation field', d: `M${x} ${y}h${w}v${h}h${-w}Z`, fill, stroke: 'none' });
  const text = (text, x, y, size, color, extra = {}) => run('text.create', { text, x, y, size, color, font: 'Inter', style: 'Regular', ...extra });
  const ex = (format, file, extra = {}) => call('export', { format, path: path.join(ROOT, file), outlineText: true, ...extra });
  const save = file => call('save_file', { path: path.join(ROOT, file), compress: true, preview: true });
  async function stacked(x, y, tone) { await mark(current, x + 420, y + 80, 360); await word(x + 180, y + 510, 840, tone); }
  async function horizontal(x, y, tone) { await mark(current, x + 60, y + 60, 260); await word(x + 390, y + 85, 940, tone); }
  async function fonts() { const f = await run('text.fonts'); if (f.some(x => x.status !== 'exact' || x.missingGlyphs)) throw Error('Font substitution'); }

  await newDoc('Everfolk / crowned scarab with closed wing cases', 512, 512);
  await run('artboard.setProps', { index: 0, name: '01 Primary colour emblem' });
  for (const b of [
    { x: 650, y: 0, width: 256, height: 256, name: '02 Compact colour emblem' },
    { x: 0, y: 650, width: 1200, height: 800, name: '03 Stacked / light surfaces' },
    { x: 1350, y: 650, width: 1200, height: 800, name: '04 Stacked / dark surfaces' },
    { x: 0, y: 1600, width: 1400, height: 380, name: '05 Horizontal / light surfaces' },
    { x: 1550, y: 1600, width: 1400, height: 380, name: '06 Horizontal / dark surfaces' },
    { x: 0, y: 2130, width: 1200, height: 300, name: '07 Name alone / ink' },
    { x: 1350, y: 2130, width: 1200, height: 300, name: '08 Name alone / cream' },
  ]) await run('artboard.new', b);
  await mark(current, 48, 48, 416); await mark(current, 674, 24, 208, true);
  await stacked(0, 650, 'ink'); await stacked(1350, 650, 'cream'); await horizontal(0, 1600, 'ink'); await horizontal(1550, 1600, 'cream');
  await word(80, 2162, 1040, 'ink'); await word(1430, 2162, 1040, 'cream');
  await save('masters/Everfolk-Crowned-Scarab-Closed.vectorcraft');
  const names = ['emblem-color', 'emblem-compact-color', 'stacked-light', 'stacked-dark', 'horizontal-light', 'horizontal-dark', 'wordmark-ink', 'wordmark-cream'];
  for (const [artboard, name] of names.entries()) { await ex('svg', `svg/dawnwing-${name}.svg`, { artboard }); await ex('png', `png/dawnwing-${name}.png`, { artboard, scale: artboard < 2 ? 2 : 1 }); }
  for (const size of [16, 24, 32, 48, 64, 128, 256]) await ex('png', `png/dawnwing-icon-${size}.png`, { artboard: 1, scale: size / 256 });
  await run('file.close');

  await newDoc('Everfolk / crowned scarab at rest', 1200, 1120);
  await rect(0, 0, 1200, 1120, C.olive);
  await text('CROWNED SCARAB / CLOSED WING CASES', 600, 82, 17, C.muted, { justify: 'center' });
  await mark(current, 320, 158, 560);
  await word(165, 820, 870, 'cream');
  await text('A compact beetle at rest.', 600, 1070, 20, C.muted, { justify: 'center' });
  await fonts(); await save('review/Everfolk-Crowned-Scarab-Closed.vectorcraft'); await ex('png', 'review/Everfolk-Crowned-Scarab-Closed.png'); await ex('svg', 'review/Everfolk-Crowned-Scarab-Closed.svg'); await run('file.close');

  await newDoc('Everfolk / closed-wing scarab identity', 1600, 1200);
  await rect(0, 0, 1600, 1200, C.paper); await text('Everfolk / crowned scarab at rest', 70, 90, 34, C.ink, { style: 'Medium' }); await text('Closed golden wing cases, a crowned head and three close-set pairs of legs.', 70, 132, 20, C.darkMuted);
  await rect(60, 180, 700, 650, C.olive); await text('THE SCARAB / STANDALONE', 95, 225, 13, C.muted); await mark(current, 198, 290, 424);
  await rect(790, 180, 750, 650, C.light); await text('THE EMBLEM WITH THE NAME', 825, 225, 13, C.darkMuted); await mark(current, 1052, 295, 225); await word(902, 575, 525, 'ink');
  await text('THE NAME / STANDALONE', 90, 895, 13, C.darkMuted); await word(85, 919, 820, 'ink'); await text('COMPACT COLOUR ICON', 1070, 895, 13, C.darkMuted);
  for (const [i, size] of [64, 48, 32, 24].entries()) { const x = 1070 + i * 116; await mark(current, x, 946 + (64 - size) / 2, size, true); await text(`${size} px`, x + size / 2, 1044, 13, C.darkMuted, { justify: 'center' }); }
  await text('Printed Folktale / Eczar 600  •  A standalone emblem and an independent name.', 70, 1169, 15, C.darkMuted);
  await fonts(); await save('review/Dawnwing-Identity-Proof.vectorcraft'); await ex('png', 'review/Dawnwing-Identity-Proof.png'); await ex('svg', 'review/Dawnwing-Identity-Proof.svg'); await run('file.close');

  await call('open_file', { path: path.join(ROOT, 'masters/Everfolk-Crowned-Scarab-Closed.vectorcraft') });
  const r = await call('inspect_document', { depth: 1, childLimit: 2 }); const images = await call('inspect_document', { kind: 'Image', limit: 0 });
  if (r.artboards.length !== 8 || images.total > 0) throw Error('Native reopening failed');
  fs.writeFileSync(path.join(ROOT, 'qa/master-reopened.json'), JSON.stringify({ ...r, rasterImages: images.total ?? 0 }, null, 2));
  await ex('png', 'qa/emblem-reopened.png', { artboard: 0 }); await run('file.close');
  if (warnings.length) throw Error('Export warning: ' + JSON.stringify(warnings));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify({ name: current.name, parent: '../everfolk-dawnwing-v6-unified', master: 'masters/Everfolk-Crowned-Scarab-Closed.vectorcraft', pose: 'At rest: closed paired elytra; no spread flight wings', crownRetained: true, artboards: 8, exports: names, palette: PALETTE, warnings }, null, 2));
  console.log('Saved crowned scarab at rest, eight native artboards and eight production variants; reopened master passed with no warnings.');
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
