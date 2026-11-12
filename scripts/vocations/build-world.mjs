import { readFile, writeFile } from 'node:fs/promises';
import { buildCrossoverWorld } from '../../src/vocations/crossover-world.ts';
import { validateWorld } from '../../src/validate.ts';
const base = JSON.parse(await readFile(new URL('../../worlds/demo/alexandria-demo-2.json', import.meta.url), 'utf8'));
const world = buildCrossoverWorld(base);
validateWorld(world);
await writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + '\n');
console.log(`Built ${world.version}: ${Object.keys(world.vocations.recipes).length} recipes, ${Object.keys(world.vocations.actions).length} vocation actions, ${world.capabilities.nodes.length} skill nodes`);
