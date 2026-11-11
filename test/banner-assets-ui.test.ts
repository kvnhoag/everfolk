import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine, yearAtAge } from "../src/index.ts";
import { BANNER_SITUATION_IDS, resolveLifeBanner } from "../client/models/banner-state.ts";
import { bannerActorSource } from "../client/models/banner-actor.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import manifest from "../public/assets/pixel/banners/manifest.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export {};" };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return next(url, context);
} });
const { default: PaperScene } = await import("../client/components/PaperScene.tsx");
hooks.deregister();

test("every banner and pose has a real web export and a native master with editable vector layers", () => {
  assert.equal(manifest.scenes.length, 24); assert.equal(manifest.actors.length, 864);
  assert.equal(manifest.actors.filter(actor => actor.originId !== null).length, 768);
  assert.deepEqual(manifest.scenes.map(scene => scene.id), [...BANNER_SITUATION_IDS]);
  const hashes = new Set<string>();
  for (const record of [...manifest.scenes, ...manifest.actors]) {
    const svg = readFileSync(new URL(`../public${record.asset}`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 240 112"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(svg, /<image\b|<script\b|<foreignObject\b|https?:\/\/(?!www\.w3\.org)/);
    if (record.kind === "scene") hashes.add(createHash("sha256").update(svg).digest("hex"));
    const native = JSON.parse(gunzipSync(readFileSync(new URL(`../${record.source}`, import.meta.url))).toString("utf8"));
    assert.equal(native.format, "vectorcraft");
    const layers = native.document.layers.filter((layer: { kind: { children?: unknown[] } }) => layer.kind.children?.length);
    assert.equal(layers.length, record.layers.length, record.id);
    assert.deepEqual(layers.map((layer: { name: string }) => layer.name), record.layers, record.id);
    assert.equal(Object.keys(native.document.images).length, 0, "art is native paths rather than a flattened placed image");
  }
  assert.equal(hashes.size, 24, "each situation has its own authored composition");
});

function lifeAt(age: number) {
  const life = structuredClone(createEngine(pack).start("banner-ui"));
  life.age = age; life.year = yearAtAge(pack.startYear, age); life.phase = "ready"; life.pendingEventId = null;
  life.journal = []; life.health!.conditions = [];
  life.character!.jobId = null; life.character!.sex = "female"; life.character!.avatarVariant = 2;
  return life;
}

test("all six real life stages and selected identities resolve to shipped actor poses", () => {
  const actorAssets = new Set(manifest.actors.map(actor => actor.asset));
  for (const age of [0, 3, 13, 18, 40, 60]) for (const sex of ["female", "male"] as const) for (let variant = 0; variant < 3; variant++) {
    const life = lifeAt(age); life.character!.sex = sex; life.character!.avatarVariant = variant;
    const banner = resolveLifeBanner(life, pack);
    for (const pose of age < 3 ? ["cradle"] as const : ["standing", "seated", "reclined"] as const) {
      const src = bannerActorSource(life, { ...banner, actorPose: pose })!;
      assert.ok(actorAssets.has(src), `Missing ${age}/${sex}/${variant}/${pose}: ${src}`);
    }
  }
});

test("the dashboard banner shows the phase and current description, with separate selected-identity art", () => {
  const life = lifeAt(13), before = structuredClone(life);
  const html = renderToStaticMarkup(createElement(PaperScene, { life, world: pack, compact: true, dashboard: true }));
  assert.match(html, /data-life-stage="youth"/);
  assert.match(html, /<h2>Youth<\/h2>/);
  assert.match(html, /life-banner-situation/);
  assert.match(html, /paper-event-caption/);
  assert.ok(html.includes(`banners/actors/${life.originId}/female/youth-2-seated.svg`));
  assert.doesNotMatch(html, /\/assets\/pixel\/scenes\//);
  assert.deepEqual(life, before);
});

test("illness uses a reclining character while death removes the actor and stops motion", () => {
  const life = lifeAt(60);
  life.health!.conditions = [{ id: "pneumonia", sinceAge: 60, severity: "mild" } as typeof life.health.conditions[number]];
  const illness = renderToStaticMarkup(createElement(PaperScene, { life, world: pack, compact: true, dashboard: true }));
  assert.match(illness, /data-situation="illness"/);
  assert.ok(illness.includes(`banners/actors/${life.originId}/female/elder-2-reclined.svg`));
  life.phase = "ended"; life.endingId = pack.endings.find(ending => ending.kind === "death")!.id;
  const ended = renderToStaticMarkup(createElement(PaperScene, { life, world: pack, compact: true, dashboard: true }));
  assert.match(ended, /data-situation="memorial"/);
  assert.match(ended, /data-motion="still"/);
  assert.match(ended, /<h2>Life ended<\/h2>/);
  assert.doesNotMatch(ended, /banners\/actors\//);
});
