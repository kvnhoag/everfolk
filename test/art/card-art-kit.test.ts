import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkBundle, kitRoot, loadKit, renderBatch, sha256, verifyKit } from "../../artwork/card-art-handoff-v1/tools/card-art.mjs";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const repo = fileURLToPath(new URL("../../", import.meta.url));
const artifacts = resolve(repo, "artifacts");
const rgba = async (input: Buffer) => sharp(input).ensureAlpha().raw().toBuffer();
const load = (file: string) => JSON.parse(readFileSync(file, "utf8"));

/**
 * Composited cards are compared with the committed production files. libvips rounds alpha blending by at most
 * one level differently across CPU architectures, so a channel may differ by 1; anything larger is a real change.
 * Compared by hand: assert.deepEqual's diff of two 4.5 MB buffers takes minutes and times the test out.
 */
function assertSamePixels(actual: Buffer, expected: Buffer, label: string) {
  assert.equal(actual.length, expected.length, `${label}: dimensions differ`);
  let worst = 0, changed = 0;
  for (let i = 0; i < actual.length; i++) {
    const delta = Math.abs(actual[i] - expected[i]);
    if (delta) { changed++; if (delta > worst) worst = delta; }
  }
  assert.ok(worst <= 1, `${label}: ${changed} channel values differ, by up to ${worst}`);
}

function workspace() {
  mkdirSync(artifacts, { recursive: true });
  return mkdtempSync(resolve(artifacts, "card-kit-test-"));
}

test("the portable kit contains every approved frame and reference without private paths", async () => {
  const result = await verifyKit();
  assert.equal(result.passed, true);
  assert.equal(result.cards, 117);
  assert.equal(result.variants, 19);
  assert.equal(result.blankFrames, 5);
  assert.ok(result.filesChecked >= 800);
  const bytes = readFileSync(resolve(kitRoot, "data/cards.json"), "utf8");
  assert.doesNotMatch(bytes, /[A-Z]:[\\/]|Users[\\/]Legion/);
});

test("portable fitting reproduces approved parents, contributors and all three Legendary promotions", { timeout: 120000 }, async () => {
  const temp = workspace();
  try {
    const kit = loadKit();
    const ids = ["alexander-parent", "alexander-common-female", "euclid-parent", "demetrius-parent", "zeno-parent", "ptolemy-parent"];
    const items = [];
    for (const id of ids) {
      const row = kit.data.assets.find((row: { id: string }) => row.id === id);
      const art = resolve(temp, id + ".png");
      await sharp(readFileSync(resolve(kitRoot, row.sourcePortrait))).png().toFile(art);
      items.push({ id, art });
    }
    const out = resolve(temp, "rendered");
    const result = await renderBatch({ items, out });
    assert.equal(result.baseCards, 6);
    assert.equal(result.runtimeVariants, 11);
    const manifest = load(resolve(out, "replacement.json"));
    const registry = load(resolve(repo, "public/assets/cards/collection-v14/manifest.json"));
    const production = [...registry.assets, ...registry.parentVariants];
    for (const row of manifest.assets) {
      const current = production.find((card: { id: string }) => card.id === row.id);
      const pairs = row.variantOf ? [["footerless", "footerlessSrc"]] : [["full", "src"], ["footerless", "footerlessSrc"], ["thumbnail", "thumbnailSrc"], ["portrait", "portraitSrc"]];
      for (const [file, field] of pairs) {
        assertSamePixels(await rgba(readFileSync(resolve(out, row.files[file].path))), await rgba(readFileSync(resolve(repo, "public" + current[field]))), `${row.id}/${file}`);
      }
    }
    assert.equal((await checkBundle({ bundle: out })).framePixelsVerified, true);
    assert.match(readFileSync(resolve(out, "editable/alexander-common-female.svg"), "utf8"), /Artwork_fitted_bitmap/);
    await assert.rejects(renderBatch({ items, out }), /new, empty output directory/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("native logical artwork and separate standard fit preserve whole pixel blocks", { timeout: 60000 }, async () => {
  const temp = workspace();
  try {
    // Deliberately synthetic test pixels make accidental smoothing or fractional fitting visible.
    const pattern = (width: number, height: number) => {
      const data = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 3;
        data[p] = x % 2 ? 240 : 10; data[p + 1] = y % 2 ? 220 : 20; data[p + 2] = (x + y) % 3 ? 30 : 200;
      }
      return sharp(data, { raw: { width, height, channels: 3 } });
    };
    const art = resolve(temp, "native.png"), standardArt = resolve(temp, "standard.png");
    await pattern(420, 525).png().toFile(art);
    await pattern(148, 185).png().toFile(standardArt);
    const out = resolve(temp, "native-render");
    await renderBatch({ items: [{ id: "alexander-common-female", art, standardArt, mode: "native-pixel" }], out });
    const manifest = load(resolve(out, "replacement.json")), row = manifest.assets[0];
    assert.equal(row.fit.standardGridPreserved, true);
    assert.equal(row.fit.logicalEnlargement, 2);
    const fitted = readFileSync(resolve(out, "png/alexander-common-female-fitted.png"));
    const actualStandard = await sharp(fitted).extract({ left: 154, top: 190, width: 592, height: 740 }).ensureAlpha().raw().toBuffer();
    const expectedStandard = await sharp(readFileSync(standardArt)).resize(592, 740, { kernel: "nearest" }).ensureAlpha().raw().toBuffer();
    assert.deepEqual(actualStandard, expectedStandard);
    const actualPortrait = await rgba(readFileSync(resolve(out, row.files.portrait.path)));
    const expectedPortrait = await sharp(readFileSync(art)).resize(840, 1050, { kernel: "nearest" }).ensureAlpha().raw().toBuffer();
    assert.deepEqual(actualPortrait, expectedPortrait);
    assert.equal((await checkBundle({ bundle: out })).passed, true);

    // Re-hash a tampered frame so verification must compare the composition, not just the manifest.
    const descriptor = row.files.footerless, path = resolve(out, descriptor.path);
    const changed = await sharp(readFileSync(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const offset = (50 * changed.info.width + 450) * 4;
    changed.data[offset] ^= 255;
    const encoded = await sharp(changed.data, { raw: { width: 900, height: 1260, channels: 4 } }).webp({ lossless: true, exact: true }).toBuffer();
    writeFileSync(path, encoded);
    Object.assign(descriptor, { sha256: sha256(encoded), rgbaSha256: sha256(changed.data), bytes: encoded.length });
    writeFileSync(resolve(out, "replacement.json"), JSON.stringify(manifest));
    await assert.rejects(checkBundle({ bundle: out }), /approved frame/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("invalid art and identifiers fail before creating an output batch", async () => {
  const temp = workspace();
  try {
    const row = loadKit().data.assets[0];
    const ready = resolve(temp, "ready.png");
    await sharp(readFileSync(resolve(kitRoot, row.sourcePortrait))).png().toFile(ready);
    const wrongRatio = resolve(temp, "wrong-ratio.png"), translucent = resolve(temp, "alpha.png"), wrongSize = resolve(temp, "wrong-size.png");
    await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toFile(wrongRatio);
    await sharp({ create: { width: 840, height: 1050, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toFile(translucent);
    await sharp({ create: { width: 400, height: 500, channels: 3, background: "white" } }).png().toFile(wrongSize);
    const out = resolve(temp, "must-not-exist");
    await assert.rejects(renderBatch({ items: [{ id: "invented-card", art: ready }], out }), /Unknown base card/);
    await assert.rejects(renderBatch({ items: [{ id: row.id, art: ready }, { id: row.id, art: ready }], out }), /Duplicate replacement/);
    await assert.rejects(renderBatch({ items: [{ id: row.id, art: wrongRatio }], out }), /aspect ratio/);
    await assert.rejects(renderBatch({ items: [{ id: row.id, art: translucent }], out }), /opaque/);
    await assert.rejects(renderBatch({ items: [{ id: row.id, art: wrongSize, mode: "native-pixel" }], out }), /integer divisor/);
    assert.equal(existsSync(out), false);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
