import { mkdir, writeFile } from 'node:fs/promises';
import { buildCapabilityLayout } from '../../client/models/capability-layout.ts';

const layout = buildCapabilityLayout();
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const labelLines = title => { const rows = ['']; for (const word of title.split(' ')) { const last = rows.length - 1; if (rows[last] && rows[last].length + word.length > 19) rows.push(word); else rows[last] += (rows[last] ? ' ' : '') + word; } return rows.map((line,i)=>`<tspan x="0" dy="${i ? 14 : 0}">${escape(line)}</tspan>`).join(''); };
const ink = { Farming:'#536951', Artisan:'#9b583d', Philosophy:'#4d6d80', Trade:'#8f732d' };
const shapes = {
  Farming:'<path d="M0 12V-11M0 4Q-13 3-12-5Q-2-5 0 4M0-3Q12-4 11-12Q1-11 0-3"/>',
  Artisan:'<path d="M-12-10H6L10-5L4 1H-12ZM-2 1V13H3V1"/>',
  Philosophy:'<path d="M-13-9Q-4-12 0-7Q5-12 13-9V10Q5 7 0 12Q-5 7-13 10ZM0-7V12"/>',
  Trade:'<path d="M-12-10H12V11H-12ZM-8-4H8M-8 2H8M-8 8H2"/>',
};
const body = layout.bands.map(b=>`<path d="M28 ${b.bottom+18}H1450" stroke="#d7c9a9"/><text x="28" y="${b.titleY+10}" font-size="19" font-weight="600" fill="${ink[b.branch]}">${b.branch}</text>`).join('')
+ layout.links.map(l=>`<path d="${l.path}" fill="none" stroke="#a89c80" stroke-width="1.7"/>`).join('')
+ layout.nodes.map(({node,x,y})=>`<g transform="translate(${x} ${y})"><circle r="27" fill="#f8f1df" stroke="${ink[node.branch]}" stroke-width="2"/><g stroke="${ink[node.branch]}" stroke-width="1.8" fill="none" stroke-linejoin="round">${shapes[node.branch]}</g><text y="44" text-anchor="middle" font-size="11" fill="#746a55">${node.id}</text><text y="61" text-anchor="middle" font-size="12" fill="#2e3028">${labelLines(node.title)}</text></g>`).join('');
const depth=Array.from({length:10},(_,i)=>`<text x="${100+i*142}" y="29" text-anchor="middle" font-size="12" fill="#746a55">DEPTH ${i+1}</text>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height+110}" role="img" aria-labelledby="title desc"><title id="title">Everfolk — Paths of a life</title><desc id="desc">65 skill nodes across Farming, Artisan, Philosophy and Trade, flowing left to right through ten depths. Play the interactive atlas at /skills.</desc><defs><pattern id="paper" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M1 2h1M9 8h1M5 13h1" stroke="#aa9574" stroke-opacity=".12"/></pattern></defs><rect width="100%" height="100%" fill="#f3ecd9"/><rect width="100%" height="100%" fill="url(#paper)"/><g font-family="Georgia,serif"><text x="28" y="39" font-size="28" fill="#2e3028">Paths of a life</text><text x="28" y="66" font-size="15" fill="#746a55">Everfolk · 65 skills · 4 branches · 10 depths</text><g transform="translate(0 95)">${depth}${body}</g></g></svg>\n`;
await mkdir(new URL('../../public/assets/skills/',import.meta.url),{recursive:true});
await writeFile(new URL('../../public/assets/skills/skill-atlas.svg',import.meta.url),svg);
console.log(`Built atlas: ${layout.nodes.length} nodes, ${layout.links.length} prerequisite connections`);
