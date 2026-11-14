import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artworkRoot } from "../../scripts/lib/artwork-source.mjs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createEngine, yearAtAge } from "../../src/index.ts";
import { BANNER_SITUATION_IDS, resolveLifeBanner } from "../../client/models/banner-state.ts";
import { bannerActorFallbackSource, bannerActorSource } from "../../client/models/banner-actor.ts";
import pack from "../../worlds/alexandria-sample.json" with { type: "json" };
import manifest from "../../public/assets/pixel/banners/manifest.json" with { type: "json" };
import concept1Manifest from "../../public/assets/pixel/banners-concept1/manifest.json" with { type: "json" };
import nativeProvenance from "../../assets/source/banners/native-provenance.json" with { type: "json" };

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export {};" };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return next(url, context);
} });
const { default: PaperScene } = await import("../../client/components/PaperScene.tsx");
hooks.deregister();

test("every banner and pose matches its web export and recorded editable-layer provenance", () => {
  assert.equal(manifest.scenes.length, 24); assert.equal(manifest.actors.length, 864);
  assert.equal(manifest.actors.filter(actor => actor.originId !== null).length, 768);
  assert.deepEqual(manifest.scenes.map(scene => scene.id), [...BANNER_SITUATION_IDS]);
  assert.equal(nativeProvenance.verificationKind, "machine-verified-native-structure");
  assert.equal(nativeProvenance.humanApproval, "not asserted by this record");
  assert.equal(nativeProvenance.nativeFormat, "vectorcraft");
  assert.equal(nativeProvenance.deliveryManifestSha256, createHash("sha256").update(readFileSync(new URL("../../public/assets/pixel/banners/manifest.json", import.meta.url))).digest("hex"));
  const lock = JSON.parse(readFileSync(new URL("../../assets/storage/media-lock.json", import.meta.url), "utf8"));
  assert.equal(nativeProvenance.sourceArchiveReleaseId, lock.privateSource.releaseId);
  assert.equal(nativeProvenance.sourceArchiveManifestSha256, lock.privateSource.manifestSha256);
  assert.equal(nativeProvenance.records.length, manifest.scenes.length + manifest.actors.length);
  const evidenceByAsset = new Map(nativeProvenance.records.map(record => [record.asset, record]));
  assert.equal(evidenceByAsset.size, nativeProvenance.records.length);
  const sourceRoot = artworkRoot(fileURLToPath(new URL("../../", import.meta.url)));
  const hashes = new Set<string>();
  for (const record of [...manifest.scenes, ...manifest.actors]) {
    const svg = readFileSync(new URL(`../../public${record.asset}`, import.meta.url), "utf8");
    assert.match(svg, /viewBox="0 0 240 112"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(svg, /<image\b|<script\b|<foreignObject\b|https?:\/\/(?!www\.w3\.org)/);
    if (record.kind === "scene") hashes.add(createHash("sha256").update(svg).digest("hex"));
    const evidence = evidenceByAsset.get(record.asset);
    assert.ok(evidence, `Missing native provenance: ${record.asset}`);
    assert.equal(evidence.source, record.source);
    assert.match(evidence.nativeSha256, /^[0-9a-f]{64}$/);
    assert.equal(createHash("sha256").update(svg).digest("hex"), evidence.deliverySha256, record.id);
    assert.deepEqual(evidence.editableLayers, record.layers, record.id);
    assert.equal(evidence.embeddedImageCount, 0, "recorded master uses native paths rather than a flattened image");
    const nativePath = resolve(sourceRoot, record.source.replace(/^artwork\//, ""));
    if (process.env.EVERFOLK_ARTWORK_DIR || existsSync(nativePath)) {
      assert.ok(existsSync(nativePath), `Restore the complete private banner source library: ${nativePath}`);
      const nativeBytes = readFileSync(nativePath);
      assert.equal(createHash("sha256").update(nativeBytes).digest("hex"), evidence.nativeSha256, record.id);
      const native = JSON.parse(gunzipSync(nativeBytes).toString("utf8"));
      assert.equal(native.format, nativeProvenance.nativeFormat);
      const layers = native.document.layers.filter((layer: { kind: { children?: unknown[] } }) => layer.kind.children?.length);
      assert.deepEqual(layers.map((layer: { name: string }) => layer.name), evidence.editableLayers, record.id);
      assert.equal(Object.keys(native.document.images).length, evidence.embeddedImageCount);
    }
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
  const actorAssets = new Set(concept1Manifest.actors.map(actor => actor.asset));
  const legacyActorAssets = new Set(manifest.actors.map(actor => actor.asset));
  for (const age of [0, 3, 13, 18, 40, 60]) for (const sex of ["female", "male"] as const) for (let variant = 0; variant < 3; variant++) {
    const life = lifeAt(age); life.character!.sex = sex; life.character!.avatarVariant = variant;
    const banner = resolveLifeBanner(life, pack);
    for (const pose of age < 3 ? ["cradle"] as const : ["standing", "seated", "reclined"] as const) {
      const src = bannerActorSource(life, { ...banner, actorPose: pose })!;
      assert.ok(actorAssets.has(src), `Missing ${age}/${sex}/${variant}/${pose}: ${src}`);
      const fallbackSrc = bannerActorFallbackSource(life, { ...banner, actorPose: pose })!;
      assert.ok(legacyActorAssets.has(fallbackSrc), `Missing legacy ${age}/${sex}/${variant}/${pose}: ${fallbackSrc}`);
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
  assert.ok(html.includes(`banners-concept1/actors/${life.originId}/female/youth-2-seated.png`));
  assert.doesNotMatch(html, /\/assets\/pixel\/scenes\//);
  assert.deepEqual(life, before);
});

test("illness uses a reclining character while death removes the actor and stops motion", () => {
  const life = lifeAt(60);
  life.health!.conditions = [{ id: "pneumonia", sinceAge: 60, severity: "mild" } as typeof life.health.conditions[number]];
  const illness = renderToStaticMarkup(createElement(PaperScene, { life, world: pack, compact: true, dashboard: true }));
  assert.match(illness, /data-situation="illness"/);
  assert.ok(illness.includes("bg_rest_chamber_480x224.png"));
  assert.ok(illness.includes(`banners-concept1/actors/${life.originId}/female/elder-2-reclined.png`));
  life.phase = "ended"; life.endingId = pack.endings.find(ending => ending.kind === "death")!.id;
  const ended = renderToStaticMarkup(createElement(PaperScene, { life, world: pack, compact: true, dashboard: true }));
  assert.match(ended, /data-situation="memorial"/);
  assert.match(ended, /data-motion="still"/);
  assert.match(ended, /<h2>Life ended<\/h2>/);
  assert.doesNotMatch(ended, /banners(?:-concept1)?\/actors\//);
});
