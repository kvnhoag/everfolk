import { readFile, writeFile } from 'node:fs/promises';
import { buildLifeStageWorld } from '../../src/vocations/life-stage-world.ts';
import { buildLivesWorld } from '../../src/vocations/lives-world.ts';
import { validateWorld } from '../../src/validate.ts';
const base = JSON.parse(await readFile(new URL('../../worlds/demo/alexandria-demo-2.json', import.meta.url), 'utf8'));
const write = async (world) => writeFile(new URL(`../../worlds/demo/${world.version}.json`, import.meta.url), JSON.stringify(world, null, 2) + '\n');
// The rules-only life-stage revision (alexandria-lives-7) stays published so its saves replay.
const rules = buildLifeStageWorld(base);
validateWorld(rules);
await write(rules);
console.log(`Built ${rules.version}: ${Object.keys(rules.vocations.recipes).length} recipes, ${Object.keys(rules.vocations.actions).length} vocation actions, ${rules.capabilities.nodes.length} skill nodes, ${rules.lifeStages.stages.length} life stages`);
// Current births (alexandria-lives-8): the same rules with the historical figure paths added.
const world = buildLivesWorld(rules);
validateWorld(world);
await write(world);
console.log(`Built ${world.version}: ${world.figurePaths.length} figure paths on ${rules.version}`);
