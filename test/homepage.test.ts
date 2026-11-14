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

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export {};', shortCircuit: true };
  if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url),'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: MainMenu } = await import('../client/screens/MainMenu.tsx');
const { WeaveAccountDetails } = await import('../client/chain/WeaveMenu.tsx');
hooks.deregister();
const engine = createEngine(world);
const noop = () => {};
const life = engine.start('homepage-regression');
function render(overrides = {}) {
  return renderToStaticMarkup(createElement(MainMenu, { life,
    hasBegun: false, hasRevealedStats: false, onBegin: noop, onContinue: noop,
    ...overrides }));
}

test('homepage renders the historical world with live canvas and retains all menu destinations', () => {
  const before = structuredClone(life);
  const html = render();
  assert.match(html, /Everfolk/);
  assert.doesNotMatch(html, /Live another story/);
  assert.doesNotMatch(html, /A LIFE SIMULATOR/);
  assert.doesNotMatch(html, /Your story is saved in this browser/);
  assert.doesNotMatch(html, /Before Alexandria/);
  assert.match(html, /<canvas/);
  assert.match(html, /everfolk-wordmark-cream\.svg/);
  assert.doesNotMatch(html, /THE ANCIENT WORLD|350 BCE/);
  assert.doesNotMatch(html, /Cross the ages|Modern coast|meteor|ef-era-button|ef-classical-wordmark/);
  assert.match(html, /<header[^>]*>.*href="\/npc".*href="\/wiki".*<\/header>/);
  assert.match(html, /<header[^>]*>.*href="#market".*href="\/cards".*href="#mine".*<\/header>/);
  assert.match(html, /ef-home-ranked.*role="switch" aria-checked="true"/);
  assert.match(html, /Account details.*Connect with NEAR wallet.*ef-home-auth-divider.*Log in with email/);
  assert.doesNotMatch(html, /class="ef-home-auth-button ef-home-auth-email"[^>]*disabled/);
  assert.doesNotMatch(html, /Your Weave world|ef-home-weave-world|<span>Continue<\/span>/);
  assert.doesNotMatch(html, /Choose a world|Past lives|Explore for free/);
  assert.doesNotMatch(html, /medieval-europe|ottoman-constantinople|A STORY IN PROGRESS/);
  assert.deepEqual(life,before,'opening the menu cannot advance, reroll or replace the life');
});

test('guest choices preserve pending birth, continuing and ended-life states', () => {
  assert.match(render({weaveEnabled:false,hasRevealedStats:true}), /Start a new life<small>Without an account/);
  const continuing = render({weaveEnabled:false,hasBegun:true});
  assert.doesNotMatch(continuing,/Begin a different story/);
  assert.match(continuing, /<button class="ef-home-save" type="button">.*Continue your life.*ef-home-save-age.*<\/button>/);
  assert.equal(continuing.match(/Continue your life/g)?.length, 1, 'the save card is the single continue action');
  assert.match(continuing, /Start a new life<small>Without an account<\/small>/);
  const ranked = render({ hasBegun: true, rankedLife: true, weaveEnabled: true });
  assert.equal(ranked.match(/Continue your life/g)?.length, 1);
  assert.match(ranked, /Start a new life<small>Weave Mode<\/small>/);
  const ended = render({weaveEnabled:false,hasBegun:true,life:{...life,phase:'ended'}});
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

test('Weave toggle keeps life details and continue together, above the account details', () => {
  const chainBackend = { mode: 'live', accountId: 'reader.testnet', walletId: 'meteor-wallet', signin: { available: { email: true } } } as never;
  const html = render({ chainBackend, rankedLife: true, hasBegun: true });
  assert.match(html, /role="switch" aria-checked="true".*<button class="ef-home-save"[^>]*>.*Continue your life.*ef-home-save-age.*<\/button>.*Account details.*reader.testnet.*Start a new life/);
  assert.equal(html.match(/Continue your life/g)?.length, 1, 'the saved-life card remains the single continue action');
  assert.doesNotMatch(html, /Your Weave world|<span>Continue<\/span>/);

  const account = renderToStaticMarkup(createElement(WeaveAccountDetails, { backend: chainBackend }));
  assert.match(account, /Account details.*Testnet.*reader.testnet.*Meteor Wallet/);
  assert.match(account, /<button[^>]*disabled=""[^>]*>.*Finding your Weave life/);
  assert.doesNotMatch(account, /Begin a Weave life|Begin a new life/);

  const playing = renderToStaticMarkup(createElement(WeaveAccountDetails, { backend: chainBackend, life, onContinue: noop }));
  assert.match(playing, /<button class="ef-home-save" type="button">.*Continue your life.*Age 0.*<\/button>.*reader.testnet/);
  const signedOut = render({ hasBegun: true });
  assert.match(signedOut, /Account details.*Connect with NEAR wallet.*Start a new life<small>Weave Mode/);
  assert.doesNotMatch(signedOut, /ef-home-save|Without an account|or play without an account/);
});

test('account details offer wallet and email sign-in with a clear signed-out status', () => {
  const html = renderToStaticMarkup(createElement(WeaveAccountDetails, { backend: { mode: 'live', accountId: null, signin: { available: { email: true } } } as never }));
  assert.match(html, /Account details.*Not signed in.*Connect with NEAR wallet.*Log in with email/);
  assert.doesNotMatch(html, /<button[^>]*disabled/);
  const unavailable = renderToStaticMarkup(createElement(WeaveAccountDetails));
  assert.match(unavailable, /Weave Mode sign-in is unavailable right now/);
  assert.match(unavailable, /<button class="ef-home-auth-button" type="button" disabled/);
  assert.match(render({weaveEnabled:false}), /Start a new life<small>Without an account/);
});

test('new lives follow the selected mode and keep guest play behind the off toggle', () => {
  for (const rankedLife of [false, true]) {
    const weave = render({ weaveEnabled: true, rankedLife, hasBegun: true });
    assert.match(weave, /role="switch" aria-checked="true"/);
    assert.match(weave, /class="ef-home-primary is-weave"[^>]*>.*Start a new life<small>Weave Mode/);
    assert.doesNotMatch(weave, /Without an account|or play without an account|is-guest/);

    const guest = render({ weaveEnabled: false, rankedLife, hasBegun: true });
    assert.match(guest, /role="switch" aria-checked="false"/);
    assert.match(guest, /class="ef-home-primary is-guest"[^>]*>.*Start a new life<small>Without an account/);
    assert.doesNotMatch(guest, /Weave account details|Connect with NEAR wallet|is-weave/);
  }
});
