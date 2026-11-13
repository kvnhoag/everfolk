import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { enlargeNearest, parsePalette, pixelArt, sampleCells } from "../scripts/lib/pixel-art-filter.mjs";

type RGBA = [number, number, number, number];

function image(width: number, height: number, pixel: (x: number, y: number) => RGBA) {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rgba.set(pixel(x, y), (y * width + x) * 4);
  return rgba;
}

function hex(rgba: Uint8Array, offset: number) {
  return "#" + [...rgba.subarray(offset, offset + 3)].map(value => value.toString(16).padStart(2, "0")).join("");
}

test("pixel filter confines every visible output pixel to its fitted palette", () => {
  const source = image(16, 16, (x, y) => [x * 16, y * 16, (x + y) * 8, 255]);
  for (const dither of [0, 1]) {
    const result = pixelArt(source, 16, 16, { width: 8, height: 8, colors: 8, scale: 3, dither });
    const palette = new Set(result.palette);
    assert.ok(palette.size <= 8);
    assert.ok(palette.size >= 2);
    const used = new Set();
    for (let offset = 0; offset < result.data.length; offset += 4) {
      assert.equal(result.data[offset + 3], 255);
      assert.ok(palette.has(hex(result.data, offset)));
      used.add(hex(result.data, offset));
    }
    assert.equal(result.stats.coloursUsed, used.size);
  }
});

test("nearest enlargement copies exact integer blocks without invented colours", () => {
  const logical = image(3, 2, (x, y) => [x * 90, y * 150, 40, x === 2 && y === 1 ? 0 : 255]);
  const scale = 4, enlarged = enlargeNearest(logical, 3, 2, scale);
  assert.equal(enlarged.length, 3 * 2 * scale * scale * 4);
  for (let y = 0; y < 2 * scale; y++) for (let x = 0; x < 3 * scale; x++) {
    const expected = (Math.floor(y / scale) * 3 + Math.floor(x / scale)) * 4;
    const actual = (y * 3 * scale + x) * 4;
    assert.deepEqual(enlarged.slice(actual, actual + 4), logical.slice(expected, expected + 4));
  }
});

test("filter is deterministic and leaves source and supplied palette unchanged", () => {
  const source = image(12, 12, (x, y) => [(x * 27) % 256, (y * 37) % 256, (x * y * 11) % 256, 255]);
  const original = source.slice();
  const first = pixelArt(source, 12, 12, { width: 6, height: 6, colors: 7, scale: 2, dither: 0.7 });
  const second = pixelArt(source, 12, 12, { width: 6, height: 6, colors: 7, scale: 2, dither: 0.7 });
  assert.deepEqual(first, second);
  const palette = [...first.palette], originalPalette = [...palette];
  pixelArt(source, 12, 12, { width: 6, height: 6, palette, scale: 1 });
  assert.deepEqual(source, original);
  assert.deepEqual(palette, originalPalette);
});

test("hidden RGB cannot train the palette or produce a dark transparent-edge fringe", () => {
  const source = (poison: number) => image(4, 2, (x, y) => x < 2 && y === 0 ? [224, 64, 32, 255] : [poison, 255 - poison, poison, 0]);
  const options = { width: 2, height: 1, colors: 4, scale: 3, alphaMode: "coverage" };
  const first = pixelArt(source(0), 4, 2, options);
  const second = pixelArt(source(255), 4, 2, options);
  assert.deepEqual(first, second);
  assert.deepEqual(first.palette, ["#e04020"]);
  assert.deepEqual([...first.logical], [224, 64, 32, 128, 0, 0, 0, 0]);
  const hardEdges = pixelArt(source(0), 4, 2, { ...options, alphaMode: "binary" });
  assert.deepEqual([...hardEdges.logical], [224, 64, 32, 255, 0, 0, 0, 0]);
});

test("fully transparent artwork remains transparent with canonical invisible RGB", () => {
  const source = image(4, 4, (x, y) => [x * 70, y * 70, 255, 0]);
  const result = pixelArt(source, 4, 4, { width: 2, height: 2, scale: 2 });
  assert.ok(result.data.every(value => value === 0));
  assert.equal(result.stats.coloursUsed, 0);
});

test("coarse reduction measures alpha coverage without skipping thin opaque rows", () => {
  for (const opaqueParity of [0, 1]) {
    const source = image(24, 24, (_x, y) => [224, 64, 32, y % 2 === opaqueParity ? 255 : 0]);
    const coverage = pixelArt(source, 24, 24, { width: 1, height: 1, scale: 1, alphaMode: "coverage" });
    assert.deepEqual([...coverage.logical], [224, 64, 32, 128]);
    const binary = pixelArt(source, 24, 24, { width: 1, height: 1, scale: 1, alphaMode: "binary" });
    assert.deepEqual([...binary.logical], [224, 64, 32, 255]);
  }
});

test("a sharp synthetic two-colour edge remains sharp through sampling and quantization", () => {
  const source = image(8, 4, (x) => x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]);
  const result = pixelArt(source, 8, 4, { width: 4, height: 2, scale: 3, palette: ["#000000", "#ffffff"] });
  for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
    const offset = (y * result.width + x) * 4, value = x < result.width / 2 ? 0 : 255;
    assert.deepEqual([...result.data.subarray(offset, offset + 4)], [value, value, value, 255]);
  }
  const boundaryCell = sampleCells(image(2, 1, (x) => x ? [255, 255, 255, 255] : [0, 0, 0, 255]), 2, 1, 1, 1);
  assert.ok(boundaryCell[0].rgb.every((value: number) => value === 0) || boundaryCell[0].rgb.every((value: number) => value === 255));
});

test("cluster cleanup removes quiet speckle while retaining a high-contrast eye glint", () => {
  const palette = ["#777777", "#787878", "#ffffff"];
  const options = { width: 5, height: 5, scale: 1, palette, contrast: 0, cleanup: 2 };
  const quiet = pixelArt(image(5, 5, (x, y) => x === 2 && y === 2 ? [120, 120, 120, 255] : [119, 119, 119, 255]), 5, 5, options);
  const glint = pixelArt(image(5, 5, (x, y) => x === 2 && y === 2 ? [255, 255, 255, 255] : [119, 119, 119, 255]), 5, 5, options);
  const centre = (2 * 5 + 2) * 4;
  assert.deepEqual([...quiet.logical.subarray(centre, centre + 4)], [119, 119, 119, 255]);
  assert.ok(quiet.stats.removedSpeckles > 0);
  assert.deepEqual([...glint.logical.subarray(centre, centre + 4)], [255, 255, 255, 255]);
});

test("a saved palette can be reused across layers without fitting a new colour language", () => {
  const first = pixelArt(image(8, 8, (x, y) => [x * 30, y * 24, 35, 255]), 8, 8, { width: 4, height: 4, colors: 6, scale: 1 });
  const palette = first.palette;
  const second = pixelArt(image(8, 8, (x, y) => [x * 12, y * 31, 210, x < 2 ? 0 : 255]), 8, 8, { width: 4, height: 4, palette, scale: 2 });
  assert.deepEqual(second.palette, palette);
  for (let offset = 0; offset < second.data.length; offset += 4) if (second.data[offset + 3]) assert.ok(palette.includes(hex(second.data, offset)));
});

test("one-colour palettes exported from uniform layers can be reused", () => {
  const uniform = image(4, 4, () => [32, 64, 96, 255]);
  const first = pixelArt(uniform, 4, 4, { width: 2, height: 2, colors: 8, scale: 1 });
  assert.deepEqual(first.palette, ["#204060"]);
  const replayed = pixelArt(uniform, 4, 4, { width: 2, height: 2, palette: first.palette, scale: 1 });
  assert.deepEqual(replayed.logical, first.logical);
  assert.deepEqual(replayed.palette, first.palette);
});

test("filter rejects invalid grids, buffer sizes, palettes and tuning parameters", () => {
  const source = image(4, 4, () => [100, 80, 60, 255]);
  const base = { width: 2, height: 2, scale: 1 };
  for (const option of [
    { width: 0 }, { width: 5 }, { height: 1.5 }, { scale: 0 }, { scale: 1.5 }, { scale: 17 },
    { colors: 1 }, { colors: 257 }, { contrast: -0.1 }, { contrast: NaN }, { cleanup: 0.5 }, { cleanup: 6 },
    { dither: Infinity }, { dither: -1 }, { alphaMode: "unknown" }, { palette: [] }, { palette: ["red", "#ffffff"] },
  ]) assert.throws(() => pixelArt(source, 4, 4, { ...base, ...option }), JSON.stringify(option));
  assert.throws(() => pixelArt(source.subarray(0, 20), 4, 4, base), /RGBA/);
  assert.throws(() => pixelArt(source, -4, 4, base), /RGBA/);
  assert.throws(() => parsePalette(null));
});

test("CLI applies the authored preset and refuses to overwrite inputs or existing files", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "everfolk-pixel-filter-test-"));
  context.after(async () => {
    // This exact path was allocated by mkdtemp above and contains only this test's fixtures.
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const require = createRequire(import.meta.url);
  let sharp;
  try { sharp = require("sharp"); } catch { sharp = createRequire(require.resolve("next/package.json"))("sharp"); }
  const sourcePath = path.join(directory, "input.png"), outputPath = path.join(directory, "result.png");
  const source = await sharp(image(8, 8, (x, y) => [x * 30, y * 30, 64, 255]), { raw: { width: 8, height: 8, channels: 4 } }).png().toBuffer();
  await writeFile(sourcePath, source);
  const cli = fileURLToPath(new URL("../scripts/pixel-art-filter.mjs", import.meta.url));
  const flags = ["--preset", "chiaroscuro", "--width", "4", "--height", "4", "--scale", "2"];
  const run = (...args: string[]) => execFileSync(process.execPath, [cli, ...args], { encoding: "utf8", stdio: "pipe", timeout: 10000 });
  run(sourcePath, outputPath, ...flags);
  const preset = JSON.parse(await readFile(new URL("../scripts/pixel-art-presets/chiaroscuro.json", import.meta.url), "utf8"));
  const saved = JSON.parse(await readFile(path.join(directory, "result.palette.json"), "utf8"));
  assert.deepEqual(saved.colors, preset.palette);
  const output = await readFile(outputPath), decoded = await sharp(output).ensureAlpha().raw().toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 8);
  assert.equal(metadata.height, 8);
  for (let offset = 0; offset < decoded.length; offset += 4) assert.ok(saved.colors.includes(hex(decoded, offset)));
  assert.throws(() => run(sourcePath, sourcePath, ...flags, "--overwrite"));
  assert.throws(() => run(sourcePath, outputPath, ...flags));
  assert.deepEqual(await readFile(sourcePath), source);
  assert.deepEqual(await readFile(outputPath), output);

  // A sidecar collision must roll back newly reserved files, preserving the collision file.
  const sentinel = "keep this existing palette";
  await writeFile(path.join(directory, "blocked.palette.json"), sentinel);
  assert.throws(() => run(sourcePath, path.join(directory, "blocked.png"), ...flags));
  assert.equal(await readFile(path.join(directory, "blocked.palette.json"), "utf8"), sentinel);
  assert.ok(!(await readdir(directory)).includes("blocked.png"));
  assert.ok(!(await readdir(directory)).includes("blocked.logical.png"));
});
