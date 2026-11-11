import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createEngine } from '../src/engine.ts';
import world from '../worlds/alexandria-sample.json' with { type: 'json' };
import sprites from '../client/homepage/scene-assets.json' with { type: 'json' };
import type { WorldPack } from '../src/types.ts';

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
  if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url),'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: MainMenu } = await import('../client/MainMenu.tsx');
hooks.deregister();
const engine = createEngine(world);
const noop = () => {};
const life = engine.start('homepage-regression');
function render(overrides = {}) {
  return renderToStaticMarkup(createElement(MainMenu, { world: world as WorldPack, life,
    hasBegun: false, hasRevealedStats: false, onBegin: noop, onContinue: noop,
    onWorlds: noop, onPastLives: noop, onLegacy: noop, onSources: noop, ...overrides }));
}

test('homepage renders the historical world with live canvas and retains all menu destinations', () => {
  const before = structuredClone(life);
  const html = render();
  assert.match(html, /350 BCE/);
  assert.match(html, /Before Alexandria, there was Rhakotis/);
  assert.match(html, /<canvas/);
  assert.match(html, /ef-classical-wordmark/);
  assert.match(html, /THE ANCIENT WORLD/);
  assert.doesNotMatch(html, /Cross the ages|Modern coast|meteor|ef-era-button|ef-pixel-wordmark/);
  for (const label of ['Begin your life','Choose a world','Past lives','Legacy gallery','History &amp; sources','Ranked life']) assert.ok(html.includes(label),label);
  assert.doesNotMatch(html, /medieval-europe|ottoman-constantinople|A STORY IN PROGRESS/);
  assert.deepEqual(life,before,'opening the menu cannot advance, reroll or replace the life');
});

test('homepage preserves pending birth, continuing and ended-life states', () => {
  assert.match(render({hasRevealedStats:true}), /Begin your life/);
  const continuing = render({hasBegun:true});
  assert.match(continuing,/Continue your life/);
  assert.match(continuing,/Begin a different story/);
  assert.match(continuing,/A STORY IN PROGRESS/);
  const ended = render({hasBegun:true,life:{...life,phase:'ended'}});
  assert.match(ended,/Begin a new life/);
  assert.match(ended,/Revisit your last life/);
  assert.match(ended,/YOUR LAST STORY/);
});

test('coastal sprites have fixed pivots, distinct animation frames and bounded integer pixel geometry', () => {
  assert.equal('rug' in sprites.festival,false,'the stretched brown rug is no longer a homepage asset');
  for (const frames of [sprites.shipFrames,...sprites.actors.map(actor=>actor.frames)]) {
    assert.equal(frames.length,4);
    assert.equal(new Set(frames.map(frame=>`${frame.width}x${frame.height}`)).size,1,'frame boxes cannot shift an entity pivot');
    assert.ok(new Set(frames.map(frame=>JSON.stringify(frame.pixels))).size>1,'animation changes actual sprite pixels');
    for (const frame of frames) for (const [x,y,w,h] of frame.pixels) {
      for (const value of [x,y,w,h]) assert.ok(Number.isInteger(value));
      assert.ok(Number(x)>=0 && Number(y)>=0 && Number(x)+Number(w)<=frame.width && Number(y)+Number(h)<=frame.height);
    }
  }
});
