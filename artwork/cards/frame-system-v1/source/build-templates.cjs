// Reusable code-authored vector templates derived from the generated layout study.
// Rebuild: node artwork/cards/frame-system-v1/source/build-templates.cjs
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const project = path.resolve(root, '../../..');
const projectRequire = createRequire(path.join(project, 'package.json'));
const sharp = createRequire(projectRequire.resolve('next/package.json'))('sharp');
const W = 900, H = 1260;
const C = { jade: '#0c2421', deep: '#091b19', bronze: '#a9844f', gold: '#d8b67d', ivory: '#eee4cb', ink: '#18302c', muted: '#bbc0ae' };
const brand = path.join(project, 'artwork/branding/everfolk-scarab-v7-closed/svg');
const escapeXML = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

// Embed the existing logo geometry, with prefixed IDs to keep each SVG standalone.
function vector(filename, prefix, x, y, width, height) {
  const svg = fs.readFileSync(path.join(brand, filename), 'utf8');
  let body = svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  body = body.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}-${id}"`);
  body = body.replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}-${id})`);
  const viewBox = filename.includes('wordmark') ? '0 0 1200 300' : '0 0 512 512';
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" aria-label="Approved Everfolk ${filename.includes('wordmark') ? 'wordmark' : 'crowned scarab'}">${body}</svg>`;
}

function fontCSS() {
  const eczar = fs.readFileSync(path.join(project, 'public/fonts/eczar-latin-variable.woff2')).toString('base64');
  const dmSans = fs.readFileSync(path.join(project, 'public/fonts/dm-sans-latin-variable.woff2')).toString('base64');
  return `<style>
    @font-face { font-family: Eczar; src:url(data:font/woff2;base64,${eczar}) format('woff2'); font-weight:100 900; }
    @font-face { font-family:'DM Sans'; src:url(data:font/woff2;base64,${dmSans}) format('woff2'); font-weight:100 1000; }
    .serif { font-family:Eczar,Georgia,serif; font-weight:400; }
    .sans { font-family:'DM Sans',Arial,sans-serif; font-weight:500; }
  </style>`;
}

function laurel(id, x, y, rotate = 0, scale = 1) {
  return `<g id="${id}" transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})" fill="${C.gold}">
    <path d="M0 44 C0 26 9 10 30 0" fill="none" stroke="${C.gold}" stroke-width="1.7"/>
    <path d="M2 35 C-6 31 -5 23 -3 19 C3 23 5 29 2 35Z M5 25 C-1 18 1 11 5 8 C10 14 10 20 5 25Z M12 15 C10 6 14 1 19 0 C21 7 18 12 12 15Z M21 6 C23 -1 28 -3 33 -2 C31 3 27 6 21 6Z M1 40 C8 39 14 34 15 29 C7 29 2 32 1 40Z M6 29 C14 28 19 24 21 19 C13 18 8 22 6 29Z M13 18 C21 17 26 13 28 8 C21 8 16 11 13 18Z"/>
  </g>`;
}

function text(id, content, x, y, size, cls, fill, extra = '') {
  return `<text id="${id}" x="${x}" y="${y}" font-size="${size}" class="${cls}" fill="${fill}" ${extra}>${escapeXML(content)}</text>`;
}

function standard(includeText) {
  const artPath = 'M74 190H826L850 214V906L826 930H74L50 906V214Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">Everfolk standard ${includeText ? 'editable layout' : 'transparent card frame'}</title>
  <desc id="desc">A deep jade and bronze frame with a transparent 800 by 740 artwork window and a separate ivory information panel. No artwork is embedded.</desc>
  <defs>
    <clipPath id="card-clip"><rect width="900" height="1260" rx="34"/></clipPath>
    <mask id="art-knockout"><rect width="900" height="1260" fill="white"/><path d="${artPath}" fill="black"/></mask>
    <linearGradient id="jade-finish" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${C.jade}"/><stop offset=".5" stop-color="${C.deep}"/><stop offset="1" stop-color="${C.jade}"/></linearGradient>
    ${includeText ? fontCSS() : ''}
  </defs>
  <g clip-path="url(#card-clip)">
    <g id="frame" data-name="Frame / jade body, bronze rules and corner ornament">
      <rect width="900" height="1260" fill="url(#jade-finish)" mask="url(#art-knockout)"/>
      <rect x="18" y="18" width="864" height="1224" rx="24" fill="none" stroke="${C.bronze}" stroke-width="3"/>
      <rect x="28" y="28" width="844" height="1204" rx="17" fill="none" stroke="${C.gold}" stroke-width="1.2"/>
      <path id="art-window-outline" d="${artPath}" fill="none" stroke="${C.gold}" stroke-width="2"/>
      ${laurel('top-left-laurel', 43, 47, 0, .8)}
      ${laurel('top-right-laurel', 857, 47, 90, .8)}
      ${laurel('bottom-right-laurel', 857, 1213, 180, .8)}
      ${laurel('bottom-left-laurel', 43, 1213, 270, .8)}
    </g>
    <g id="readability" data-name="Readability / independent ivory information panel">
      <path d="M64 952H836L850 966V1146L836 1160H64L50 1146V966Z" fill="${C.ivory}"/>
      <path d="M88 1015H812" fill="none" stroke="${C.bronze}" stroke-width="1"/>
    </g>
    <g id="emblem" data-name="Emblem / approved crowned scarab vector geometry">
      ${vector('dawnwing-emblem-color.svg', 'standard-scarab', 775, 103, 53, 53)}
    </g>
    <g id="type" data-name="Type / editable card name, role and information">
      ${includeText ? [
        text('card-name', 'Card name', 450, 118, 67, 'serif', C.ivory, 'text-anchor="middle"'),
        text('card-role', 'TITLE / ROLE', 450, 163, 21, 'sans', C.gold, 'text-anchor="middle" letter-spacing="5"'),
        text('card-type', 'CARD TYPE', 88, 994, 20, 'sans', C.ink, 'letter-spacing="3"'),
        text('card-description', 'A story worth remembering.', 88, 1078, 36, 'serif', C.ink)
      ].join('\n') : ''}
    </g>
    <g id="footer" data-name="Footer / independent Everfolk vector wordmark and number">
      <path d="M300 1198H720" fill="none" stroke="${C.bronze}" stroke-width="1.2"/>
      ${includeText ? vector('dawnwing-wordmark-cream.svg', 'standard-wordmark', 76, 1167, 205, 51.25) : ''}
      ${includeText ? text('card-number', '001', 810, 1205, 20, 'sans', C.ivory, 'text-anchor="end" letter-spacing="3"') : ''}
    </g>
  </g>
</svg>`;
}

function legendary(includeText) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">Everfolk legendary full-art ${includeText ? 'editable layout' : 'transparent overlay'}</title>
  <desc id="desc">Full-card artwork underlay with a thin gold rule, small corner laurels and transparent jade readability gradients. No opaque border mat, title rail, information panel or artwork.</desc>
  <defs>
    <clipPath id="card-clip"><rect width="900" height="1260" rx="34"/></clipPath>
    <linearGradient id="top-readability" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${C.deep}" stop-opacity=".74"/><stop offset=".5" stop-color="${C.deep}" stop-opacity=".40"/><stop offset="1" stop-color="${C.deep}" stop-opacity="0"/></linearGradient>
    <linearGradient id="bottom-readability" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${C.deep}" stop-opacity="0"/><stop offset=".48" stop-color="${C.deep}" stop-opacity=".60"/><stop offset="1" stop-color="${C.deep}" stop-opacity=".88"/></linearGradient>
    ${includeText ? fontCSS() : ''}
  </defs>
  <g clip-path="url(#card-clip)">
    <g id="readability" data-name="Readability / transparent jade fades over full-card art">
      <rect width="900" height="250" fill="url(#top-readability)"/>
      <rect y="950" width="900" height="310" fill="url(#bottom-readability)"/>
    </g>
    <g id="frame" data-name="Frame / fine gold rule and minimal corner ornament">
      <rect x="18" y="18" width="864" height="1224" rx="25" fill="none" stroke="${C.gold}" stroke-width="1.7"/>
      ${laurel('top-left-laurel', 38, 39, 0, .7)}
      ${laurel('top-right-laurel', 862, 39, 90, .7)}
      ${laurel('bottom-right-laurel', 862, 1221, 180, .7)}
      ${laurel('bottom-left-laurel', 38, 1221, 270, .7)}
    </g>
    <g id="emblem" data-name="Emblem / approved crowned scarab vector geometry">
      ${vector('dawnwing-emblem-color.svg', 'legendary-scarab', 775, 90, 63, 63)}
    </g>
    <g id="type" data-name="Type / editable floating name, role and legendary label">
      ${includeText ? [
        text('card-name', 'Card name', 78, 124, 67, 'serif', C.ivory),
        text('card-role', 'TITLE / ROLE', 82, 169, 21, 'sans', C.gold, 'letter-spacing="5"'),
        text('card-type', 'LEGENDARY', 78, 1056, 20, 'sans', C.gold, 'letter-spacing="4"'),
        text('card-description', 'A story worth remembering.', 78, 1121, 36, 'serif', C.ivory)
      ].join('\n') : ''}
      <path d="M78 1078H822" fill="none" stroke="${C.gold}" stroke-opacity=".6" stroke-width="1"/>
    </g>
    <g id="footer" data-name="Footer / floating Everfolk vector wordmark and number">
      <path d="M300 1198H720" fill="none" stroke="${C.gold}" stroke-opacity=".7" stroke-width="1"/>
      ${includeText ? vector('dawnwing-wordmark-cream.svg', 'legendary-wordmark', 66, 1167, 205, 51.25) : ''}
      ${includeText ? text('card-number', '001', 822, 1205, 20, 'sans', C.ivory, 'text-anchor="end" letter-spacing="3"') : ''}
    </g>
  </g>
</svg>`;
}

async function main() {
  for (const dir of ['templates', 'exports']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const records = [];
  for (const [kind, make] of [['standard', standard], ['legendary-full-art', legendary]]) {
    for (const includeText of [false, true]) {
      const name = `${kind}-${includeText ? 'layout' : 'frame-only'}`;
      const svg = make(includeText);
      fs.writeFileSync(path.join(root, 'templates', `${name}.svg`), svg);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      fs.writeFileSync(path.join(root, 'exports', `${name}.png`), png);
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alpha = (x, y) => data[(y * W + x) * 4 + 3];
      const cornerAlpha = [[0,0], [899,0], [0,1259], [899,1259]].map(([x,y]) => alpha(x,y));
      if (info.width !== W || info.height !== H || cornerAlpha.some(Boolean)) throw new Error(`${name}: wrong geometry or opaque corners`);
      let transparentArtPixels = 0;
      const window = kind === 'standard' ? [76,216,824,904] : [60,270,840,930];
      for (let y = window[1]; y < window[3]; y++) for (let x = window[0]; x < window[2]; x++) {
        if (alpha(x,y) !== 0) throw new Error(`${name}: art field obscured at ${x},${y}`);
        transparentArtPixels++;
      }
      if (!includeText && /<text\b/.test(svg)) throw new Error(`${name}: unexpected live text`);
      if (/<image\b/.test(svg)) throw new Error(`${name}: raster artwork unexpectedly embedded`);
      records.push({ name, width: info.width, height: info.height, hasAlpha: true, cornerAlpha, transparentArtPixels, transparentCheckRegion: window, centerAlpha: alpha(450,630), sha256: sha(png), liveText: includeText, rasterImages: 0 });
    }
  }
  // Checkerboard is only a review background, never part of an exported frame.
  const proofSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1060" height="760"><defs><pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#c8cec8"/><path d="M0 0H12V12H0ZM12 12H24V24H12Z" fill="#e5e7df"/></pattern></defs><rect width="1060" height="760" fill="#232b28"/><g font-family="Arial,sans-serif" fill="#eee4cb" font-size="20" letter-spacing="3"><text x="54" y="43">STANDARD</text><text x="554" y="43">LEGENDARY / FULL ART</text></g><rect x="55" y="70" width="450" height="630" fill="url(#checker)"/><rect x="555" y="70" width="450" height="630" fill="url(#checker)"/><text x="55" y="735" font-family="Arial,sans-serif" font-size="14" fill="#c8cec8">Checkerboard indicates transparent artwork fields. 450 × 630 display-size proof.</text></svg>`;
  const proofBase = await sharp(Buffer.from(proofSVG)).png().toBuffer();
  const standardPreview = await sharp(path.join(root, 'exports/standard-layout.png')).resize(450,630).png().toBuffer();
  const legendaryPreview = await sharp(path.join(root, 'exports/legendary-full-art-layout.png')).resize(450,630).png().toBuffer();
  await sharp(proofBase).composite([{ input:standardPreview,left:55,top:70 }, { input:legendaryPreview,left:555,top:70 }]).png().toFile(path.join(root, 'exports/templates-checkerboard-proof.png'));
  const qa = { dimensions: [W,H], method: 'Code-authored SVG geometry with live editable placeholder text; native existing logo vector paths; sharp PNG export.', fontPolicy: 'SVG embeds the existing Eczar and DM Sans WOFF2 assets for supporting browsers. Raster export uses installed Georgia/Arial fallbacks because sharp/librsvg does not load CSS webfonts and Eczar/DM Sans are not system-installed. The exact approved Eczar wordmark is vector geometry in every layout.', records };
  fs.writeFileSync(path.join(root, 'source/template-export-qa.json'), JSON.stringify(qa, null, 2));
  console.log(JSON.stringify(qa, null, 2));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
