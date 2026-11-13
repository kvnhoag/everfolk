'use strict';

// Offline collection browser. Rebuild after rendering to discover optional thumbnails.
// node source/build-review.cjs [--master-pattern=masters/{slug}.vectorcraft]
//                              [--source-pattern=source/cards/{slug}.svg]
const fs = require('node:fs');
const path = require('node:path');

const packDir = path.resolve(__dirname, '..');
const projectDir = path.resolve(packDir, '../../..');
const reviewDir = path.join(packDir, 'review');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'framing-map.json'), 'utf8'));
const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const match = /^--(master-pattern|source-pattern)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unknown argument: ${argument}`);
  return [match[1], match[2]];
}));
const masterPattern = options['master-pattern'] || 'masters/{slug}.vectorcraft';
const sourcePattern = options['source-pattern'] || 'source/cards/{slug}.svg';
const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const titleCase = value => value[0].toUpperCase() + value.slice(1);
const localHref = filename => path.relative(reviewDir, filename).split(path.sep).map(encodeURIComponent).join('/');
const resolvePattern = (pattern, asset) => {
  const expanded = pattern.replace(/\{(slug|figureId)\}/g, (_, key) => asset[key]);
  const resolved = path.resolve(packDir, expanded);
  if (!resolved.startsWith(packDir + path.sep)) throw new Error(`Pattern leaves collection directory: ${pattern}`);
  return localHref(resolved);
};

if (!Array.isArray(map.assets) || map.assets.length !== 83) throw new Error('Expected exactly 83 mapped artworks.');
const assets = [...map.assets].sort((a, b) => a.collectionIndex - b.collectionIndex);
const seen = new Set();
for (const asset of assets) {
  if (!/^[a-z0-9-]+$/.test(asset.slug) || !/^[a-z0-9-]+$/.test(asset.figureId)) throw new Error('Unsafe asset identifier.');
  if (seen.has(asset.slug)) throw new Error(`Duplicate artwork: ${asset.slug}`);
  seen.add(asset.slug);
}
const figures = new Map();
for (const asset of assets) {
  if (!figures.has(asset.figureId)) figures.set(asset.figureId, { id: asset.figureId, assets: [] });
  figures.get(asset.figureId).assets.push(asset);
}
for (const figure of figures.values()) {
  figure.parent = figure.assets.find(asset => asset.kind === 'parent');
  figure.name = figure.parent ? figure.parent.title : titleCase(figure.id);
}

function cardMarkup(asset) {
  const figure = figures.get(asset.figureId);
  const full = `../exports/${asset.slug}.png`;
  const thumbnailFile = path.join(packDir, 'assets', `${asset.slug}-thumb.png`);
  const thumbnail = fs.existsSync(thumbnailFile) ? localHref(thumbnailFile) : full;
  const variant = asset.kind === 'parent' ? 'Historical figure' : `${titleCase(asset.gender)} contributor`;
  const number = String(asset.collectionIndex).padStart(2, '0');
  const editorial = asset.gameplayRarity === null;
  return `
      <article class="card" data-figure="${esc(asset.figureId)}" data-kind="${esc(asset.kind)}" data-gender="${esc(asset.gender)}" data-rarity="${esc(asset.rarity)}" data-search="${esc(`${asset.title} ${figure.name} ${variant} ${asset.rarity}`.toLowerCase())}">
        <a class="card-image" href="${full}" aria-label="Open full size: ${esc(asset.title)}, ${esc(variant)}">
          <img src="${thumbnail}" width="450" height="630" loading="lazy" decoding="async" alt="${esc(asset.title)} — ${esc(variant)} framed card">
          <span class="image-action" aria-hidden="true">View full size <span>↗</span></span>
        </a>
        <div class="card-meta"><span class="variant">${esc(variant)}</span><span class="rarity">${esc(titleCase(asset.rarity))}${editorial ? '<span class="editorial" title="Epic frame styling is an editorial default; gameplay rarity is unspecified.">*</span>' : ''}</span></div>
        <h3>${esc(asset.title)}</h3>
        <div class="card-links"><span class="card-index">${number} / 83</span><a href="${resolvePattern(sourcePattern, asset)}" title="Editable card SVG">SVG</a><a href="${resolvePattern(masterPattern, asset)}" title="Editable native VectorCraft master">Master</a><a href="${localHref(path.resolve(projectDir, asset.sourceArt))}">Inner art</a></div>
      </article>`;
}

const figureMarkup = [...figures.values()].map((figure, index) => `
    <section class="figure-section" data-figure-section="${esc(figure.id)}" aria-labelledby="figure-${esc(figure.id)}">
      <div class="figure-heading"><div><span class="section-index">${String(index + 1).padStart(2, '0')}</span><h2 id="figure-${esc(figure.id)}">${esc(figure.name)}</h2><span class="figure-count">${figure.assets.length} cards</span></div><a class="master-link" href="${resolvePattern(masterPattern, figure.parent || figure.assets[0])}">Native master <span aria-hidden="true">↗</span></a></div>
      <div class="card-grid">${figure.assets.map(cardMarkup).join('')}
      </div>
    </section>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Everfolk · Framed collection</title>
  <style>
    :root{--bg:#0b1412;--surface:#11211d;--line:#2d443a;--jade:#a6c2af;--bronze:#bd9862;--text:#e8ebe1;--muted:#98aaa0;--ink:#0c1813;--radius:8px}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(ellipse at 85% 0,#173b2d55,transparent 48%),var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}a{color:inherit;text-underline-offset:4px}button,input,select{font:inherit}button,select{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--bronze);outline-offset:4px}.shell{width:min(1680px,calc(100% - 88px));margin:auto}.site-header{display:flex;justify-content:space-between;align-items:center;padding:28px 0;border-bottom:1px solid var(--line);gap:20px}.brand{font-family:Georgia,serif;font-size:23px;letter-spacing:.22em;text-decoration:none}.brand-mark{color:var(--bronze);padding-right:10px}.header-links{display:flex;gap:24px;color:var(--muted);font-size:12px;letter-spacing:.04em}.header-links a{text-decoration:none}.header-links a:hover{color:var(--text)}.hero{display:flex;justify-content:space-between;align-items:end;gap:40px;padding:65px 0 47px}.eyebrow{margin:0 0 15px;font-size:11px;font-weight:650;letter-spacing:.2em;text-transform:uppercase;color:var(--bronze)}h1{margin:0;font:clamp(36px,4.2vw,64px)/1.08 Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:-.025em}.intro{max-width:650px;color:var(--muted);margin:21px 0 0;font-size:15px}.stats{display:flex;gap:40px;padding-bottom:3px}.stat-value{display:block;font:34px/1.15 Georgia,serif;color:var(--jade)}.stat-label{display:block;color:var(--muted);font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-top:7px}.toolbar{position:sticky;top:0;z-index:3;background:#0b1412f5;backdrop-filter:blur(14px);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:19px 0}.toolbar-inner{display:flex;align-items:end;justify-content:space-between;gap:22px;flex-wrap:wrap}.variant-filter{display:flex;gap:4px;align-items:center;padding:4px;background:#07100e;border:1px solid #20392f;border-radius:var(--radius)}.filter-button{border:0;background:transparent;color:var(--muted);padding:8px 15px;border-radius:5px;font-size:12px;white-space:nowrap}.filter-button[aria-pressed="true"]{background:#294d3d;color:#eaf0e7}.filter-button:hover{color:var(--text)}.select-filters{display:flex;gap:13px;align-items:end;flex-wrap:wrap}label{display:flex;flex-direction:column;gap:5px;color:var(--muted);font-size:10px;letter-spacing:.11em;text-transform:uppercase}select,input{height:38px;border:1px solid var(--line);border-radius:5px;background:#11221c;color:var(--text);padding:0 12px;font-size:12px;letter-spacing:normal;text-transform:none}select{min-width:135px}input{width:205px}input::placeholder{color:#71877a}.result-bar{display:flex;align-items:center;justify-content:space-between;padding:22px 0 3px;color:var(--muted);font-size:12px;gap:16px}.reset-button{border:0;background:none;color:var(--jade);padding:0;text-decoration:underline;text-underline-offset:4px;font-size:12px}.figure-section{padding-top:34px;padding-bottom:29px}.figure-heading{display:flex;justify-content:space-between;align-items:center;gap:15px;border-bottom:1px solid var(--line);margin-bottom:24px;padding-bottom:17px}.figure-heading>div{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}.section-index{color:var(--bronze);font-size:11px;font-variant-numeric:tabular-nums}.figure-heading h2{margin:0;font:27px/1.2 Georgia,serif;font-weight:400}.figure-count{color:var(--muted);font-size:11px}.master-link{font-size:11px;color:var(--jade);text-decoration:none;white-space:nowrap}.master-link span{color:var(--bronze);padding-left:6px}.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:29px 22px;align-items:start}.card{min-width:0}.card-image{display:block;position:relative;aspect-ratio:5/7;border-radius:7px;overflow:hidden;background:#14231c;box-shadow:0 9px 25px #0005;border:1px solid #56704d55}.card-image img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto}.image-action{position:absolute;bottom:0;left:0;right:0;padding:18px 13px 10px;background:linear-gradient(transparent,#07140ff2);color:#f2f2e8;display:flex;justify-content:space-between;font-size:11px;opacity:0;transition:opacity .18s}.card-image:hover .image-action,.card-image:focus-visible .image-action{opacity:1}.card-image:hover{border-color:var(--bronze)}.card-meta{display:flex;justify-content:space-between;align-items:center;gap:5px;margin-top:13px;font-size:9px;letter-spacing:.065em;text-transform:uppercase}.variant{color:var(--muted)}.rarity{color:var(--bronze);white-space:nowrap}.editorial{padding-left:2px}h3{margin:7px 0 12px;font:18px/1.22 Georgia,serif;font-weight:400;min-height:44px;letter-spacing:-.01em}.card-links{display:flex;align-items:center;gap:11px;padding-top:10px;border-top:1px solid #223a2e;color:var(--muted);font-size:10px}.card-index{margin-right:auto;color:#788f80;font-variant-numeric:tabular-nums;font-size:9px}.card-links a{text-decoration:none}.card-links a:hover{color:var(--jade)}.empty-state{text-align:center;padding:90px 25px;color:var(--muted);border:1px solid var(--line);margin:35px 0;border-radius:var(--radius)}.empty-state strong{display:block;font:27px Georgia,serif;color:var(--text);margin-bottom:12px}footer{margin-top:30px;border-top:1px solid var(--line);padding:29px 0 36px;display:flex;justify-content:space-between;gap:28px;color:#81978a;font-size:11px}footer p{margin:0;max-width:780px}footer span{white-space:nowrap;color:var(--bronze)}[hidden]{display:none!important}
    @media(min-width:1500px){.card-grid{grid-template-columns:repeat(7,minmax(0,1fr))}}@media(max-width:1000px){.shell{width:calc(100% - 48px)}.hero{align-items:start;flex-direction:column;gap:30px;padding-top:46px}.stats{gap:34px}.toolbar{position:static}.toolbar-inner{align-items:start;flex-direction:column}.select-filters{width:100%}.card-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}.header-links{gap:16px}}@media(max-width:560px){.shell{width:calc(100% - 32px)}.site-header{padding:22px 0}.brand{font-size:19px}.header-links{font-size:10px;gap:12px}.header-links a:last-child{display:none}.hero{padding:38px 0 31px}.intro{font-size:13px}.stat-value{font-size:28px}.stats{width:100%;justify-content:space-between;gap:15px}.stat-label{font-size:9px}.filter-button{padding:8px 12px}.select-filters{gap:10px}label{flex:1;min-width:calc(50% - 10px)}label:last-child{min-width:100%}select,input{width:100%;min-width:0}.card-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:26px 14px}.figure-heading h2{font-size:23px}.figure-heading>div{gap:10px}.figure-count{display:none}.master-link{font-size:10px}h3{font-size:16px}.card-meta{font-size:8px;letter-spacing:0}.card-links{gap:9px;font-size:9px}.card-index{display:none}footer{flex-direction:column}.result-bar{font-size:11px}.image-action{display:none}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.image-action{transition:none}}
  </style>
</head>
<body>
<div class="shell">
  <header class="site-header"><a href="#" class="brand"><span class="brand-mark" aria-hidden="true">◇</span>EVERFOLK</a><nav class="header-links" aria-label="Collection resources"><a href="../source/framing-map.json">Framing map ↗</a><a href="../exports/">PNG exports ↗</a></nav></header>
  <main>
    <section class="hero" aria-labelledby="page-title"><div><p class="eyebrow">Historical Lives · Collection 13</p><h1 id="page-title">The framed collection.</h1><p class="intro">Historical figures and the people who contribute to their worlds. Browse the finished card art, compare both contributor variants, and open the editable sources.</p></div><div class="stats" aria-label="Collection totals"><div><span class="stat-value">83</span><span class="stat-label">Framed cards</span></div><div><span class="stat-value">13</span><span class="stat-label">Historical figures</span></div><div><span class="stat-value">70</span><span class="stat-label">Contributor cards</span></div></div></section>
    <div class="toolbar" aria-label="Card filters"><div class="toolbar-inner"><div class="variant-filter" role="group" aria-label="Card variant"><button type="button" class="filter-button" data-view="all" aria-pressed="true">All cards</button><button type="button" class="filter-button" data-view="parent" aria-pressed="false">Parents</button><button type="button" class="filter-button" data-view="male" aria-pressed="false">Male</button><button type="button" class="filter-button" data-view="female" aria-pressed="false">Female</button></div><div class="select-filters"><label>Rarity<select id="rarity-filter"><option value="all">All rarities</option value="legendary">Legendary</option><option value="epic">Epic</option><option value="rare">Rare</option><option value="uncommon">Uncommon</option></select></label><label>Figure<select id="figure-filter"><option value="all">All figures</option>${[...figures.values()].map(figure=>`<option value="${esc(figure.id)}">${esc(figure.name)}</option>`).join('')}</select></label><label>Search<input id="search-filter" type="search" placeholder="Find a title or figure" autocomplete="off"></label></div></div></div>
    <div class="result-bar"><span id="result-count" role="status" aria-live="polite">Showing all 83 cards across 13 figures</span><button type="button" class="reset-button" id="reset-filters">Reset filters</button></div>
    <div id="collection">${figureMarkup}
    </div>
    <div class="empty-state" id="empty-state" hidden><strong>No cards match these filters.</strong>Try another figure, rarity, or search.</div>
  </main>
  <footer><p>Art previews · 900 × 1260 px. Collection numbers identify designs, not issued copies. * Epic frame styling for Nearchus and Eumenes is an editorial default; gameplay rarity is unspecified. Parent ranks use current base policy.</p><span>Jade & bronze · v13</span></footer>
</div>
<script>
(() => {
  const buttons = [...document.querySelectorAll('[data-view]')];
  const cards = [...document.querySelectorAll('.card')];
  const sections = [...document.querySelectorAll('[data-figure-section]')];
  const rarity = document.getElementById('rarity-filter');
  const figure = document.getElementById('figure-filter');
  const search = document.getElementById('search-filter');
  let view = 'all';
  function update() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const variantMatch = view === 'all' || (view === 'parent' ? card.dataset.kind === 'parent' : card.dataset.kind !== 'parent' && card.dataset.gender === view);
      const matches = variantMatch && (rarity.value === 'all' || card.dataset.rarity === rarity.value) && (figure.value === 'all' || card.dataset.figure === figure.value) && (!query || card.dataset.search.includes(query));
      card.hidden = !matches;
      if (matches) visible++;
    }
    let figureCount = 0;
    for (const section of sections) {
      const count = [...section.querySelectorAll('.card')].filter(card => !card.hidden).length;
      section.hidden = count === 0;
      section.querySelector('.figure-count').textContent = count + (count === 1 ? ' card' : ' cards');
      if (count) figureCount++;
    }
    document.getElementById('result-count').textContent = 'Showing ' + visible + ' of 83 cards across ' + figureCount + (figureCount === 1 ? ' figure' : ' figures');
    document.getElementById('empty-state').hidden = visible !== 0;
  }
  for (const button of buttons) button.addEventListener('click', () => {
    view = button.dataset.view;
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    update();
  });
  for (const filter of [rarity, figure]) filter.addEventListener('change', update);
  search.addEventListener('input', update);
  document.getElementById('reset-filters').addEventListener('click', () => {
    view = 'all'; rarity.value = 'all'; figure.value = 'all'; search.value = '';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.view === 'all'));
    update();
  });
})();
</script>
</body>
</html>
`;
fs.mkdirSync(reviewDir, { recursive: true });
fs.writeFileSync(path.join(reviewDir, 'index.html'), html, 'utf8');
console.log(JSON.stringify({ output: path.join(reviewDir, 'index.html'), cards: assets.length, figures: figures.size, masterPattern, sourcePattern }));
