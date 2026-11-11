// Export the same hand-authored vector composition used by the live homepage.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const hooks=registerHooks({load(url,context,next){
  if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{
    compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
    fileName:new URL(url).pathname,
  }).outputText};
  return next(url,context);
}});
const {default:Wordmark}=await import('../client/homepage/ClassicalWordmark.tsx');
hooks.deregister();
const target=new URL('../public/assets/brand/everfolk-wordmark.svg',import.meta.url);
await mkdir(new URL('.',target),{recursive:true});
const artwork=renderToStaticMarkup(createElement(Wordmark));
const svg=artwork.replace('aria-hidden="true"','role="img" aria-label="Everfolk"');
await writeFile(target,svg+'\n');
console.log(`Exported ${Buffer.byteLength(await readFile(target))} bytes of original vector artwork.`);
