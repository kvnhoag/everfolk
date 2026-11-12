import { readFile } from 'node:fs/promises';
import { auditEvents } from '../../src/paths/audit.ts';
const world = JSON.parse(await readFile(new URL('../../worlds/demo/alexandria-lives-7.json', import.meta.url), 'utf8'));
const items = auditEvents(world);
const verbose = process.argv.includes('--list');
for (const rule of [2, 3, 4, 5]) {
  const found = items.filter(item => item.rule === rule);
  console.log(`rule ${rule}: ${found.length}`);
  if (verbose) for (const item of found) console.log(`  ${item.eventId}: ${item.message}`);
}
