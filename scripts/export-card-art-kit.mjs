/** Rebuild the portable artist kit from reviewed artwork and native frame exports. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const library = resolve(repo, 'artwork/cards/framed-collection-v14');
const production = resolve(repo, 'public/assets/cards/collection-v14');
const destination = resolve(repo, 'artwork/card-art-handoff-v1');
const catalogBytes = readFileSync(resolve(library, 'catalog.json'));
const catalog = JSON.parse(catalogBytes);
const registryBytes = readFileSync(resolve(repo, 'client/models/card-art-registry.json'));
const registry = JSON.parse(registryBytes);
const design = require(resolve(library, 'source/frame-design.cjs'));
const proof = process.argv.includes('--proof');
const hash = value => createHash('sha256').update(value).digest('hex');
const need = (value, message) => { if (!value) throw Error(message); };
const output = path => resolve(destination, path);
const write = (path, value) => {
  const target = output(path);
  mkdirSync(dirname(target), { recursive: true });
  const bytes = typeof value === 'string' ? Buffer.from(value) : value;
  if (!existsSync(target) || !readFileSync(target).equals(bytes)) writeFileSync(target, bytes);
  return target;
};
const json = (path, value) => write(path, JSON.stringify(value, null, 2) + '\n');
const copy = (source, path) => write(path, readFileSync(source));
const metadata = async path => {
  const bytes = readFileSync(output(path));
  const m = await sharp(bytes).metadata();
  return { sha256: hash(bytes), bytes: bytes.length, width: m.width, height: m.height };
};
const rgba = input => sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const serialExpression = /<text\b[^>]*\bid="Edition_number_live"[^>]*>[\s\S]*?<\/text>/g;
const removeSerial = (svg, id) => {
  need((svg.match(serialExpression) ?? []).length === 1, 'Expected one live edition node: ' + id);
  return svg.replace(serialExpression, '');
};

// Stack-based element removal preserves all approved frame geometry, gradients and grouping.
function blankSvg(svg) {
  let result = '', cursor = 0;
  const stack = [];
  let hidden = 0;
  for (const token of svg.matchAll(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    if (!hidden) result += svg.slice(cursor, token.index);
    const tag = token[0];
    cursor = token.index + tag.length;
    if (/^<\?|^<!/.test(tag)) { if (!hidden) result += tag; continue; }
    const closing = /^<\//.test(tag);
    const name = tag.match(/^<\/?([\w:-]+)/)?.[1];
    const selfClosing = /\/>$/.test(tag);
    if (closing) {
      const entry = stack.pop();
      need(entry?.name === name, 'Invalid source SVG nesting');
      if (entry.suppressed) hidden--;
      if (!hidden && !entry.suppressed) result += tag;
    } else {
      const id = tag.match(/\bid="([^"]*)"/)?.[1] ?? '';
      const suppressed = name === 'text' || name === 'g' && (id === 'Card_text_live' || id.startsWith('Emblem_'));
      if (!hidden && !suppressed) result += tag;
      if (!selfClosing) {
        stack.push({ name, suppressed });
        if (suppressed) hidden++;
      }
    }
  }
  if (!hidden) result += svg.slice(cursor);
  need(stack.length === 0 && !/<text\b|id="Emblem_/.test(result), 'Blank frame still contains figure content');
  return result;
}

need(catalog.complete && catalog.assets.length === 117, 'Reviewed 117-card catalogue required');
need(registry.assets.length === 117 && registry.parentVariants.length === 16, 'Current production registry required');
need(hash(catalogBytes) === registry.sourceCatalogSha256, 'Production registry is not from the reviewed catalogue');
for (const directory of ['data', 'frames/cards', 'frames/svg', 'frames/blank', 'frames/masks', 'reference/portraits', 'reference/cards', 'reference/symbols', 'licenses/fonts']) mkdirSync(output(directory), { recursive: true });

const rect = (x, y, width, height) => ({ x, y, width, height });
const geometry = {
  canvas: { width: 900, height: 1260, outerCornerRadius: 42 },
  sourcePortrait: { width: 840, height: 1050, aspectRatio: '4:5' },
  standard: {
    portraitRect: rect(154, 190, 592, 740), apertureRect: rect(50, 190, 800, 740),
    aperturePath: design.aperture, biographyPanelPath: design.panel,
    portraitScaling: 'nearest', sourceCropped: false,
    inlay: { left: rect(50, 190, 104, 740), right: rect(746, 190, 104, 740), colorFrom: 'palettes[rarity].matte' },
    mask: 'frames/masks/standard-aperture.svg',
  },
  legendary: {
    portraitRect: rect(30, 140, 840, 1050), sourceCropped: false, portraitScaling: 'native',
    outerCornerRadius: 42, mask: 'frames/masks/legendary-card.svg',
    extension: {
      top: { sourceRow: 0, target: rect(30, 0, 840, 140), kernel: 'nearest' },
      bottom: { sourceRow: 1049, target: rect(30, 1190, 840, 70), kernel: 'nearest' },
      sides: { sourceEdgeWidth: 12, targetWidth: 30, targetHeight: 1260, reducedWidth: 10, reducedHeight: 420, firstKernel: 'lanczos3', finalKernel: 'nearest' },
    },
    fades: {
      top: { rect: rect(0, 0, 900, 240), gradientUnits: 'userSpaceOnUse', from: [0, 0], to: [0, 240], stops: [{ offset: 0, color: '#07110f', opacity: 0.7 }, { offset: 1, color: '#07110f', opacity: 0 }] },
      bottom: { rect: rect(0, 920, 900, 340), gradientUnits: 'userSpaceOnUse', from: [0, 920], to: [0, 1260], stops: [{ offset: 0, color: '#07110f', opacity: 0 }, { offset: 0.25, color: '#07110f', opacity: 0.78 }, { offset: 1, color: '#07110f', opacity: 0.96 }] },
      gold: { from: [0, 0], to: [0, 1], stops: [{ offset: 0, color: '#fff1bf' }, { offset: 0.5, color: '#d8ac57' }, { offset: 1, color: '#ffdf8a' }] },
      aura: { center: [450, 965], radius: [380, 64], stops: [{ offset: 0, color: '#ffd56d', opacity: 0.42 }, { offset: 0.58, color: '#dbab44', opacity: 0.13 }, { offset: 1, color: '#dbab44', opacity: 0 }] },
    },
  },
  edition: { right: 84, baseline: 1207.344, fontSize: 21, letterSpacing: 2.1, fontFamily: 'Inter', exampleOnly: true, removalBounds: { left: 700, top: 1180, width: 126, height: 44 } },
};
write('frames/masks/standard-aperture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1260" viewBox="0 0 900 1260"><path d="${design.aperture}" fill="white"/></svg>\n`);
write('frames/masks/legendary-card.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1260" viewBox="0 0 900 1260"><rect width="900" height="1260" rx="42" fill="white"/></svg>\n');
json('data/geometry.json', geometry);

const all = [];
for (const source of [...registry.assets, ...registry.parentVariants]) {
  const base = catalog.assets.find(card => card.slug === (source.variantOf ?? source.id));
  need(base, 'Unknown registry card: ' + source.id);
  const id = source.id;
  const row = { ...base, slug: id, rarity: source.rarity, bodyText: source.bodyText, editionLimit: source.editionLimit, frameLayout: source.frameLayout };
  const svg = source.variantOf ? (await design.build(row, row)).svg : readFileSync(resolve(library, base.overlaySvg), 'utf8');
  const paths = {
    frame: `frames/cards/${id}.png`, footerlessFrame: `frames/cards/${id}-footerless.png`,
    overlaySvg: `frames/svg/${id}.svg`, footerlessOverlaySvg: `frames/svg/${id}-footerless.svg`,
    sourcePortrait: `reference/portraits/${base.slug}.webp`, preview: `reference/cards/${base.slug}.webp`,
  };
  write(paths.overlaySvg, svg);
  write(paths.footerlessOverlaySvg, removeSerial(svg, id));
  if (!source.variantOf) {
    copy(resolve(production, `${base.slug}-portrait.webp`), paths.sourcePortrait);
    copy(resolve(production, `${base.slug}-thumb.webp`), paths.preview);
    copy(resolve(library, `qa/${id}-overlay.png`), paths.frame);
  }
  const fit = source.rarity === 'legendary' ? 'legendary' : 'standard';
  all.push({
    id, figureId: base.figureId, figureName: base.figureName, kind: base.kind,
    tier: base.kind === 'parent' ? null : base.tier, gender: base.gender, rarity: source.rarity,
    ...(source.variantOf ? { variantOf: source.variantOf } : {}),
    title: source.title, canonicalTitle: source.canonicalTitle, displayTitle: source.displayTitle,
    subtitle: source.subtitle, bodyTitle: source.bodyTitle, bodyText: source.bodyText,
    copy: { title: source.displayTitle || source.title, subtitle: source.subtitle, bodyTitle: source.bodyTitle, bodyText: source.bodyText },
    editionLimit: source.editionLimit, exampleEdition: source.exampleEdition, collectionIndex: base.collectionIndex,
    frameLayout: source.frameLayout, rarityCharacteristics: source.rarityCharacteristics,
    ...paths, fit, artRect: geometry[fit].portraitRect,
    symbol: `reference/symbols/${base.figureId}.svg`, historicalSources: base.sources ?? [],
    sourceArtworkSha256: base.sourceArtSha256,
  });
}

const blankFrames = [];
for (const rarity of Object.keys(design.PALETTE)) {
  const source = all.find(card => card.rarity === rarity && card.kind === (rarity === 'legendary' ? 'parent' : 'contribution'));
  const overlaySvg = `frames/blank/${rarity}.svg`;
  const frame = `frames/blank/${rarity}.png`;
  write(overlaySvg, blankSvg(readFileSync(output(source.overlaySvg), 'utf8')));
  blankFrames.push({ rarity, frame, overlaySvg, fit: rarity === 'legendary' ? 'legendary' : 'standard', artRect: source.artRect, matteColor: design.PALETTE[rarity].matte, characteristics: design.PALETTE[rarity].character });
}

const iconManifest = JSON.parse(readFileSync(resolve(production, 'icon-credits.json')));
const symbolCredits = iconManifest.icons.map(icon => {
  const source = resolve(production, 'symbols', `${icon.figureId}.svg`);
  need(hash(readFileSync(source)) === icon.sha256, 'Symbol source changed: ' + icon.figureId);
  const path = `reference/symbols/${icon.figureId}.svg`;
  copy(source, path);
  const { publicPath, ...portable } = icon;
  return { ...portable, path };
});
for (const name of ['CC-BY-3.0.txt', 'Apache-2.0.txt']) copy(resolve(production, 'symbols', name), `licenses/${name}`);
json('licenses/icon-credits.json', { ...iconManifest, icons: symbolCredits });
const creditsHtml = readFileSync(resolve(production, 'icon-credits.html'), 'utf8')
  .replaceAll('src="symbols/', 'src="../reference/symbols/')
  .replaceAll('href="symbols/CC-BY-3.0.txt"', 'href="CC-BY-3.0.txt"')
  .replaceAll('href="symbols/Apache-2.0.txt"', 'href="Apache-2.0.txt"')
  .replaceAll('href="symbols/', 'href="../reference/symbols/')
  .replace('href="/"', 'href="../index.html"');
write('licenses/icon-credits.html', creditsHtml);
copy(resolve(repo, 'public/fonts/inter-variable.woff2'), 'licenses/fonts/inter-variable.woff2');
copy(resolve(repo, 'public/fonts/inter-variable-OFL.txt'), 'licenses/fonts/Inter-OFL.txt');
json('licenses/fonts/Inter-source.json', { ...JSON.parse(readFileSync(resolve(repo, 'public/fonts/Inter-source.json'))), licenseFile: 'Inter-OFL.txt', additionalFormats: [] });
json('licenses/fonts/fonts.json', {
  rendering: 'All PNG overlays are already rendered and require no installed fonts.',
  svgEditing: 'Live-text SVGs use Source Serif 4 and Inter. Install the original fonts to edit and re-export without substitution.',
  families: [{ family: 'Inter', bundled: 'inter-variable.woff2', license: 'SIL Open Font License 1.1', licenseFile: 'Inter-OFL.txt' }, { family: 'Source Serif 4', bundled: false, license: 'SIL Open Font License 1.1', source: 'https://github.com/adobe-fonts/source-serif' }],
});

function unwrap(result) {
  need(!result.isError, JSON.stringify(result));
  const text = result.content?.find(item => item.type === 'text');
  return text ? JSON.parse(text.text) : result;
}
const selected = proof ? [all.find(card => card.fit === 'legendary'), all.find(card => card.fit === 'standard')] : all;
const helper = process.env.ARTCRAFT_MCP_HELPER ?? resolve(homedir(), '.codex/skills/artcraft-mcp/scripts/mcp.cjs');
need(existsSync(helper), 'Set ARTCRAFT_MCP_HELPER to the installed ArtCraft MCP helper');
const { withMcp } = require(helper);
await withMcp('VectorCraft', { readRoot: destination, writeRoot: destination, timeoutMs: 60000 }, async ({ listTools, callTool }) => {
  const tools = await listTools();
  for (const name of ['open_file', 'export', 'run_command', 'command_list']) need(tools.some(tool => tool.name === name), 'VectorCraft missing ' + name);
  const call = async (name, args) => {
    const result = unwrap(await callTool(name, args));
    need(!result?.warnings?.length, 'Native export warning: ' + JSON.stringify(result?.warnings));
    return result;
  };
  const commands = await call('command_list', { filter: 'file.close', brief: true });
  need((Array.isArray(commands) ? commands : commands.commands).some(command => command.id === 'file.close'), 'Missing file.close');
  const render = async (svg, png) => {
    await call('open_file', { path: output(svg) });
    await call('export', { format: 'png', path: output(png), artboard: 0, scale: 1, options: { background: 'transparent', includeArtboardFill: false } });
    await call('run_command', { command: 'file.close', params: {} });
    const dimensions = await sharp(readFileSync(output(png))).metadata();
    need(dimensions.width === 900 && dimensions.height === 1260 && dimensions.hasAlpha, 'Invalid frame dimensions or alpha: ' + png);
  };
  for (let i = 0; i < selected.length; i++) {
    const card = selected[i];
    if (card.variantOf) await render(card.overlaySvg, card.frame);
    await render(card.footerlessOverlaySvg, card.footerlessFrame);
    console.log(`Native frames ${i + 1}/${selected.length}: ${card.id}`);
  }
  if (!proof) for (const frame of blankFrames) await render(frame.overlaySvg, frame.frame);
});

// Verify native overlays against every approved full and footerless production raster.
const verification = [];
for (const card of selected) {
  const base = catalog.assets.find(row => row.slug === (card.variantOf ?? card.id));
  let fitted;
  if (!card.variantOf) fitted = readFileSync(resolve(library, base.fittedArt));
  else fitted = await fitPortrait(readFileSync(output(card.sourcePortrait)), card);
  const composites = ['frame', 'footerlessFrame'];
  const checks = {};
  for (const field of composites) {
    const composite = await sharp(fitted).composite([{ input: readFileSync(output(card[field])) }]).png().toBuffer();
    const productionName = field === 'footerlessFrame' ? `${card.id}-footerless.webp` : `${card.id}.webp`;
    if (existsSync(resolve(production, productionName))) {
      const [a, b] = await Promise.all([rgba(composite), rgba(readFileSync(resolve(production, productionName)))]);
      need(a.data.equals(b.data), `Native ${field} differs from approved production pixels: ${card.id}`);
      checks[field] = { exactProductionPixels: true, rgbaSha256: hash(a.data) };
    } else checks[field] = { nativeExport: true };
  }
  card.hashes = {};
  for (const field of ['frame', 'footerlessFrame', 'sourcePortrait', 'preview']) card.hashes[field] = await metadata(card[field]);
  for (const field of ['overlaySvg', 'footerlessOverlaySvg']) card.hashes[field] = { sha256: hash(readFileSync(output(card[field]))) };
  verification.push({ id: card.id, ...checks });
}

async function fitPortrait(input, card) {
  // Decode before resizing: WebP decoder shrink-on-load changes nearest sampling.
  input = await sharp(input).png().toBuffer();
  let layers;
  if (card.fit === 'standard') {
    const art = await sharp(input).resize(592, 740, { kernel: 'nearest' }).png().toBuffer();
    const matte = await sharp({ create: { width: 800, height: 740, channels: 4, background: design.PALETTE[card.rarity].matte } }).png().toBuffer();
    layers = [{ input: matte, left: 50, top: 190 }, { input: art, left: 154, top: 190 }];
  } else {
    const side = async left => {
      const field = await sharp(input).extract({ left: left ? 0 : 828, top: 0, width: 12, height: 1050 }).resize(10, 420, { kernel: 'lanczos3' }).png().toBuffer();
      return sharp(field).resize(30, 1260, { kernel: 'nearest' }).png().toBuffer();
    };
    const [left, right, top, bottom] = await Promise.all([
      side(true), side(false),
      sharp(input).extract({ left: 0, top: 0, width: 840, height: 1 }).resize(840, 140, { kernel: 'nearest' }).png().toBuffer(),
      sharp(input).extract({ left: 0, top: 1049, width: 840, height: 1 }).resize(840, 70, { kernel: 'nearest' }).png().toBuffer(),
    ]);
    layers = [{ input: left, left: 0, top: 0 }, { input: right, left: 870, top: 0 }, { input: top, left: 30, top: 0 }, { input: bottom, left: 30, top: 1190 }, { input, left: 30, top: 140 }];
  }
  let result = await sharp({ create: { width: 900, height: 1260, channels: 4, background: '#00000000' } }).composite(layers).png().toBuffer();
  if (card.fit === 'legendary') result = await sharp(result).composite([{ input: readFileSync(output('frames/masks/legendary-card.svg')), blend: 'dest-in' }]).png().toBuffer();
  return result;
}

if (proof) {
  json('data/proof-verification.json', { passed: true, count: selected.length, nativeRenderer: 'VectorCraft', results: verification });
  console.log(JSON.stringify({ proofPassed: true, count: selected.length }));
} else {
  for (const frame of blankFrames) frame.hashes = { frame: await metadata(frame.frame), overlaySvg: { sha256: hash(readFileSync(output(frame.overlaySvg))) } };
  const manifest = {
    schemaVersion: 1, id: 'everfolk-card-art-handoff-v1', sourceLibraryId: catalog.libraryId,
    complete: true, canvas: geometry.canvas, portrait: geometry.sourcePortrait, geometry,
    palettes: design.PALETTE, typography: { titleAndBiography: 'Source Serif 4', labelsAndEdition: 'Inter', fonts: 'licenses/fonts/fonts.json', pngNeedsFonts: false },
    sourceCatalogSha256: hash(catalogBytes), sourceRegistrySha256: hash(registryBytes),
    defaultOverlay: 'footerlessFrame', exampleSerialsAreIssuedCopies: false,
    assets: all.filter(card => !card.variantOf), parentVariants: all.filter(card => card.variantOf), blankFrames,
    symbolCredits, iconCredits: 'licenses/icon-credits.html',
    originalArtwork: 'Approved existing artwork is included as visual reference. Replacing a portrait never requires regenerating the frame, symbols or biography.',
  };
  json('data/cards.json', manifest);
  json('data/verification.json', { passed: true, count: all.length, baseCards: 117, runtimeParentVariants: 16, blankFrames: 5, nativeRenderer: 'VectorCraft', nativeWorkerClosed: true, results: verification });
  console.log(JSON.stringify({ exported: all.length, baseCards: 117, runtimeParentVariants: 16, blankFrames: 5, verified: true }));
}
