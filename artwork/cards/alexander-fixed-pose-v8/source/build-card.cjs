// Rebuild the exploratory Alexander card in VectorCraft.
// Reference-grounded portrait and approved brand PNGs are embedded; frame, fields, accents and type are native.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withMcp } = require('C:/Users/Legion/.codex/skills/artcraft-mcp/scripts/mcp.cjs');
const ROOT = path.resolve(__dirname, '..');
const files = {
  portrait: path.join(ROOT, 'assets', 'alexander-card-pixel.png'),
  scarab: path.join(ROOT, 'assets', 'everfolk-scarab.png'),
  wordmark: path.join(ROOT, 'assets', 'everfolk-wordmark-cream.png'),
  master: path.join(ROOT, 'masters', 'Alexander-The-Great.vectorcraft'),
  png: path.join(ROOT, 'review', 'Alexander-The-Great-card.png'),
  thumbnail: path.join(ROOT, 'review', 'Alexander-The-Great-card-450.png'),
};
for (const directory of ['masters', 'review', 'qa']) fs.mkdirSync(path.join(ROOT, directory), { recursive: true });
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes = Object.fromEntries(['portrait', 'scarab', 'wordmark'].map(key => [key, hash(files[key])]));
const portraitBytes = fs.readFileSync(files.portrait);
if (portraitBytes.readUInt32BE(16) !== 840 || portraitBytes.readUInt32BE(20) !== 1050) throw new Error('Portrait must already be exactly 840×1050');
const unwrap = result => { const text = result.content?.find(item => item.type === 'text'); return text ? JSON.parse(text.text) : result; };
const C = { jade: '#101d1c', deep: '#0e1817', bronze: '#96754c', paleBronze: '#d4b47c', ivory: '#eee4cf', muted: '#b7bba9' };
const qa = { files, inputHashes: hashes, concept: 'Exploratory legendary treatment; rarity is not a locked game specification.', text: [], warnings: [] };

async function build() {
  await withMcp('VectorCraft', { readRoot: path.join(ROOT, 'assets'), writeRoot: ROOT, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args = {}) => {
      const result = unwrap(await callTool(name, args));
      if (result?.warning) qa.warnings.push(result.warning);
      if (result?.warnings?.length) qa.warnings.push(...result.warnings);
      return result;
    };
    const run = (command, params = {}) => call('run_command', { command, params });
    const layer = name => run('layer.new', { name, top: true });
    const shape = (name, x, y, width, height, fill, stroke = 'none', strokeWidth = 0, radius = 0) => call('draw_shape', { shape: 'rectangle', name, x, y, width, height, radius, fill, stroke, strokeWidth });
    const line = (name, x1, y1, x2, y2, stroke, strokeWidth = 1) => call('draw_path', { name, points: [[x1, y1], [x2, y2]], closed: false, fill: 'none', stroke, strokeWidth, cap: 'butt' });
    const rename = (id, name) => run('object.setProps', { id, name });
    const bounds = async id => (await call('inspect_document', { ids: [id], depth: 0 })).nodes[0].bounds;
    const text = async (name, value, x, top, size, font, color, options = {}) => {
      const created = await run('text.create', { x, y: 0, text: value, size, font, style: options.style || 'Regular', color, justify: options.justify || 'left' });
      if (created.overflow?.length) throw new Error(`Text overflow: ${name}`);
      if (options.tracking !== undefined) await run('text.setStyle', { id: created.id, tracking: options.tracking });
      const before = await bounds(created.id);
      const dx = options.justify === 'center' ? x - before.x - before.width / 2 : options.justify === 'right' ? x - before.x - before.width : x - before.x;
      await run('object.move', { ids: [created.id], dx, dy: top - before.y });
      await rename(created.id, name);
      const final = await bounds(created.id);
      qa.text.push({ name, value, id: created.id, font, size, ...options, bounds: final });
      if (final.x < 29 || final.y < 29 || final.x + final.width > 871 || final.y + final.height > 1232) throw new Error(`Text outside safe area: ${name}`);
      return created.id;
    };
    const place = async (filename, rect, name) => {
      const result = await run('file.place', { path: filename, link: false, rect });
      if (result.ids.length !== 1) throw new Error(`Unexpected image placement: ${name}`);
      await rename(result.ids[0], name);
      return result.ids[0];
    };
    await run('file.new', { name: 'Alexander the Great — reference-grounded commander card concept', width: 900, height: 1260, units: 'Pixels', backgroundContents: 'transparent', colorMode: 'rgb' });
    await run('artboard.setProps', { index: 0, name: 'Alexander the Great / front / 900×1260' });
    await run('layer.setProps', { name: '00 Card Body / rounded jade field and footer' });
    await shape('Rounded card body / transparent outer corners', 0, 0, 900, 1260, C.jade, 'none', 0, 32);
    await shape('Footer field / independent from portrait', 30, 1080, 840, 150, C.deep);

    await layer('10 Portrait / replaceable embedded pixel art');
    const portrait = await place(files.portrait, [30, 30, 840, 1050], 'Alexander / approved raised pose, blade-only correction / 280×350 logical pixels, exact 3×');
    qa.portraitImage = await run('image.info', { id: portrait });
    const mask = await shape('Portrait window / native rounded clipping path', 30, 30, 840, 1050, '#ffffff', 'none', 0, 10);
    const clipped = await run('object.clippingMask.make', { ids: [portrait, mask.id] });
    await rename(clipped.id, 'Portrait window / replace image inside native clip');

    await layer('15 Header / optional translucent readability field');
    await call('draw_path', {
      name: 'Subdued jade fade / title readability',
      d: 'M40 30H860Q870 30 870 40V168H30V40Q30 30 40 30Z',
      fill: { gradient: { kind: 'linear', start: [30, 30], end: [30, 168], stops: [{ offset: 0, color: C.deep, opacity: 0.5 }, { offset: 1, color: C.deep, opacity: 0 }] } },
      stroke: 'none',
    });

    await layer('20 Frame / bronze borders and native corner accents');
    await shape('Outer bronze border / editable 3 px stroke', 12, 12, 876, 1236, 'none', C.bronze, 3, 20);
    await shape('Inner pale bronze rule / editable 1.2 px stroke', 23, 23, 854, 1214, 'none', C.paleBronze, 1.2, 10);
    for (const [name, d] of [
      ['Top left accent', 'M18 54V34Q18 18 34 18H54'],
      ['Top right accent', 'M846 18H866Q882 18 882 34V54'],
      ['Bottom left accent', 'M18 1206V1226Q18 1242 34 1242H54'],
      ['Bottom right accent', 'M846 1242H866Q882 1242 882 1226V1206'],
    ]) await call('draw_path', { name, d, fill: 'none', stroke: C.paleBronze, strokeWidth: 0.9, cap: 'butt' });
    for (const y of [18, 1242]) await call('draw_path', { name: 'Small centred frame lozenge', points: [[446, y], [450, y - 4], [454, y], [450, y + 4]], closed: true, fill: C.jade, stroke: C.paleBronze, strokeWidth: 0.8 });
    await line('Portrait / footer bronze divider', 48, 1080, 852, 1080, C.bronze, 1.4);

    await layer('30 Title / editable Source Serif 4 and Inter');
    await text('Alexander / live title', 'Alexander', 68, 44, 64, 'Source Serif 4', C.ivory);
    await text('The Great / live subtitle', 'THE GREAT', 72, 118, 18, 'Inter', C.paleBronze, { tracking: 220, style: 'Medium' });

    await layer('40 Emblem / approved crowned scarab');
    await place(files.scarab, [765, 112, 58, 58], 'Everfolk / approved crowned scarab, independent image');

    await layer('50 Rarity and Type / exploratory legendary treatment');
    await text('Rarity / replaceable legendary label', 'LEGENDARY', 64, 1100, 15, 'Inter', C.paleBronze, { tracking: 160, style: 'SemiBold' });
    await text('Historical role / live type', 'MACEDONIAN KING', 834, 1100, 15, 'Inter', C.ivory, { tracking: 100, justify: 'right', style: 'Medium' });

    await layer('60 Flavour / original authored line and divider');
    await text('Original flavour line / not a historical quotation', 'A legacy beyond the horizon.', 64, 1137, 27, 'Source Serif 4', C.ivory);
    await line('Footer fine bronze rule', 64, 1184, 836, 1184, C.bronze, 0.8);

    await layer('70 Brand Date Catalogue / independent components');
    await place(files.wordmark, [64, 1188, 150, 37.5], 'Everfolk / approved cream wordmark, independent image');
    await text('Historical life dates / live text', '356–323 BCE', 450, 1204, 14, 'Inter', C.muted, { justify: 'center', tracking: 30 });
    await text('Catalogue / concept series and card number', 'ALEXANDRIA / 001', 834, 1204, 12, 'Inter', C.muted, { justify: 'right', tracking: 80 });

    qa.fonts = await run('text.fonts');
    if (qa.fonts.some(font => font.status !== 'exact' || font.missingGlyphs)) throw new Error('A live font was substituted or lacks glyphs');
    qa.document = await call('inspect_document', { depth: 2, childLimit: 20 });
    await call('save_file', { path: files.master, compress: true, preview: true });
    qa.export = await call('export', { format: 'png', path: files.png, scale: 1, options: { background: 'transparent', includeArtboardFill: false } });
    qa.thumbnailExport = await call('export', { format: 'png', path: files.thumbnail, scale: 0.5, options: { background: 'transparent', includeArtboardFill: false } });
    await run('file.close');
  });
  const expectedHash = hash(files.png);
  await withMcp('VectorCraft', { readRoot: ROOT, writeRoot: ROOT, timeoutMs: 60000 }, async ({ callTool }) => {
    const call = async (name, args = {}) => unwrap(await callTool(name, args));
    await call('open_file', { path: files.master });
    qa.reopenedDocument = await call('inspect_document', { depth: 1, childLimit: 20 });
    qa.reopenedFonts = await call('run_command', { command: 'text.fonts', params: {} });
    if (qa.reopenedFonts.some(font => font.status !== 'exact' || font.missingGlyphs)) throw new Error('Reopened fonts failed');
    qa.reopenedExport = await call('export', { format: 'png', path: path.join(ROOT, 'qa', 'Alexander-The-Great-reopened.png'), scale: 1, options: { background: 'transparent', includeArtboardFill: false } });
    await call('run_command', { command: 'file.close', params: {} });
  });
  qa.nativeReopenIdentical = hash(path.join(ROOT, 'qa', 'Alexander-The-Great-reopened.png')) === expectedHash;
  if (!qa.nativeReopenIdentical) throw new Error('Native reopening changed the exported card');
  qa.inputsUnchanged = Object.keys(hashes).every(key => hash(files[key]) === hashes[key]);
  if (!qa.inputsUnchanged) throw new Error('Input asset changed during card build');
  if (qa.warnings.length) throw new Error(`Warnings require review: ${JSON.stringify(qa.warnings)}`);
  fs.writeFileSync(path.join(ROOT, 'qa', 'card-build.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify({ master: files.master, png: files.png, thumbnail: files.thumbnail, nativeReopenIdentical: qa.nativeReopenIdentical, fonts: qa.fonts, inputsUnchanged: qa.inputsUnchanged, text: qa.text }));
}
build().catch(error => { console.error(error.stack); process.exitCode = 1; });
