#!/usr/bin/env node
/** Stage, review, then install a portable artist's card-art bundle. */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageCardArtImport } from './lib/card-art-replacements.mjs';

const args = process.argv.slice(2);
const help = `Usage: node scripts/import-card-art.mjs --bundle DIR --version pixel-v1 [--apply]\n\nWithout --apply, creates a candidate registry, files and review report under\nartifacts/card-art-import/. --apply installs a fresh version and updates active\nartwork URLs. Approved art, card copy, ranks and live edition data stay intact.\n`;
if (args.includes('--help') || args.includes('-h')) {
  console.log(help);
} else {
  try {
    const options = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--apply') options.apply = true;
      else if (['--bundle', '--version'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg.slice(2)] = args[++i];
      else throw new Error('Unknown or incomplete argument: ' + arg);
    }
    if (!options.bundle || !options.version) throw new Error(help);
    const repo = fileURLToPath(new URL('../', import.meta.url));
    console.log(JSON.stringify(await stageCardArtImport({ repo, ...options, bundle: resolve(options.bundle) }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
