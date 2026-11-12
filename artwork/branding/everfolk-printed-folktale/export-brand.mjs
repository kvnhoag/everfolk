import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
let sharp;
try { sharp=require('sharp'); } catch { sharp=createRequire(require.resolve('next/package.json'))('sharp'); }
const assets=path.resolve(root,'../../../public/assets/branding');
for(const tone of ['cream','ink']){
  await sharp(path.join(assets,`everfolk-wordmark-${tone}.svg`),{density:144}).resize({width:2560}).png().toFile(path.join(assets,`everfolk-wordmark-${tone}@2x.png`));
}
const texture=await readFile(path.join(assets,'everfolk-parchment-grain.png'));
const wordmark=await sharp(path.join(assets,'everfolk-wordmark-cream.svg'),{density:144}).resize({width:1280}).png().toBuffer();
await sharp({create:{width:1450,height:450,channels:4,background:'#282d25'}})
  .composite([{input:texture,tile:true,blend:'over'},{input:wordmark,left:85,top:79}])
  .png().toFile(path.join(root,'approved-wordmark-proof.png'));
console.log('Exported 2560 px transparent PNGs and the dark parchment proof.');
