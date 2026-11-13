import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { avatarArtworkOrigin, avatarOptions, avatarStage, AVATAR_ORIGIN_IDS, AVATAR_ORIGIN_ALIASES, AVATAR_STAGES, portraitSource, portraitVariant } from "../client/models/life-background.ts";
import { getAvatarAppearance } from "../client/models/avatar-appearance.ts";
import type { AvatarSex, AvatarStage } from "../client/models/life-background.ts";
import world from "../worlds/alexandria-sample.json" with { type: "json" };

interface Asset { path: string; sex: AvatarSex; originId: string; variant: number; stage: AvatarStage; width: number; height: number }
const base = new URL("../public/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("../public/assets/pixel/avatar-manifest.json", import.meta.url), "utf8")) as { assets: Asset[] };
const assets = manifest.assets;

function bitmap(asset: Asset): string[][] {
  const xml = readFileSync(new URL(`.${asset.path}`, base), "utf8");
  assert.match(xml, /viewBox="0 0 32 40"/);
  assert.match(xml, /shape-rendering="crispEdges"/);
  assert.doesNotMatch(xml, /<(?:image|path|circle|ellipse|filter|linearGradient|script|foreignObject)\b/);
  const grid = Array.from({ length: 40 }, () => Array<string>(32));
  let written = 0;
  for (const group of xml.matchAll(/<g fill="(#[a-f0-9]{6})">(.*?)<\/g>/g)) for (const cell of group[2].matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g)) {
    const [x, y, width, height] = cell.slice(1).map(Number);
    assert.ok(width > 0 && height > 0 && x >= 0 && y >= 0 && x + width <= 32 && y + height <= 40, asset.path);
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) { assert.equal(grid[yy][xx], undefined, "delivery geometry must not overlap"); grid[yy][xx] = group[1]; written++; }
  }
  assert.equal(written, 32 * 40, asset.path);
  return grid;
}

function pixelDigest(asset: Asset): string {
  return createHash("sha256").update(bitmap(asset).flat().join("")).digest("hex");
}

test("eight physical artwork families cover every household with complete avatar lifetimes", () => {
  assert.deepEqual(new Set(AVATAR_ORIGIN_IDS), new Set(world.origins.map(origin => avatarArtworkOrigin(origin.id))));
  assert.equal(assets.length, 8 * 2 * 3 * 6);
  assert.equal(new Set(assets.map(asset => asset.path)).size, assets.length);
  for (const originId of AVATAR_ORIGIN_IDS) for (const sex of ["male", "female"] as const) for (const stage of AVATAR_STAGES) {
    const options = avatarOptions(originId, sex, stage);
    assert.deepEqual(options.map(option => option.variant), [0, 1, 2]);
    for (const option of options) {
      const asset = assets.find(asset => asset.path === option.src)!;
      assert.ok(asset, option.src);
      assert.equal(asset.originId, originId); assert.equal(asset.sex, sex); assert.equal(asset.stage, stage);
      assert.equal(asset.width, 32); assert.equal(asset.height, 40);
      bitmap(asset);
    }
  }
});

test("expanded household origins use matching shipped avatar choices and appearance data", () => {
  for (const [originId, artworkOrigin] of Object.entries(AVATAR_ORIGIN_ALIASES)) {
    assert.equal(avatarArtworkOrigin(originId), artworkOrigin);
    for (const sex of ["male", "female"] as const) for (const stage of AVATAR_STAGES) {
      const options = avatarOptions(originId, sex, stage);
      assert.deepEqual(options, avatarOptions(artworkOrigin, sex, stage));
      assert.equal(options.length, 3);
      for (const { variant, src } of options) {
        assert.ok(assets.some(asset => asset.path === src), src);
        assert.deepEqual(getAvatarAppearance({ originId, sex, stage, variant }), getAvatarAppearance({ originId: artworkOrigin, sex, stage, variant }));
        assert.equal(portraitSource({ age: stage === "infant" ? 0 : stage === "child" ? 5 : stage === "youth" ? 15 : stage === "adult" ? 25 : stage === "middle" ? 45 : 65, originId, sex, avatarVariant: variant }), src);
      }
    }
  }
});

test("avatars stay visually distinct and retain skin identity while aging", () => {
  const expectedSkin = ["#bf8b62", "#d9a579", "#91644c"];
  for (const originId of AVATAR_ORIGIN_IDS) for (const sex of ["male", "female"] as const) {
    for (const stage of AVATAR_STAGES) {
      const hashes = avatarOptions(originId, sex, stage).map(option => pixelDigest(assets.find(asset => asset.path === option.src)!));
      assert.equal(new Set(hashes).size, 3);
    }
    for (let variant = 0; variant < 3; variant++) {
      const lifetime = assets.filter(asset => asset.originId === originId && asset.sex === sex && asset.variant === variant);
      const hashes = lifetime.map(pixelDigest);
      assert.equal(new Set(hashes).size, 6, "aging must change the actual artwork");
      for (const asset of lifetime) {
        const pixels = bitmap(asset);
        // Cheek position is independent of hair, facial hair and origin backdrop.
        const cheekY = asset.stage === "infant" ? 19 : asset.stage === "child" ? 20 : asset.stage === "elder" || asset.stage === "youth" ? 17 : 15;
        assert.equal(pixels[cheekY][13], expectedSkin[variant], `${asset.path} changes skin identity`);
      }
      const elder = bitmap(lifetime.find(asset => asset.stage === "elder")!);
      assert.ok(elder.slice(3, 15).some(row => row.includes("#adb4a6")), "later-life hair visibly ages");
      if (sex === "female") assert.equal(elder[20][13], expectedSkin[variant], "female aging must not add the old generic beard");
    }
  }
  for (const stage of AVATAR_STAGES) {
    const hashes = AVATAR_ORIGIN_IDS.map(originId => pixelDigest(assets.find(asset => asset.path === avatarOptions(originId, "female", stage)[0].src)!));
    assert.equal(new Set(hashes).size, 8, "birth origins have distinct visible settings");
  }
});

test("portrait stages change at the real age boundaries without changing selected identity", () => {
  const cases = [[0, "infant"], [2, "infant"], [3, "child"], [12, "child"], [13, "youth"], [17, "youth"], [18, "adult"], [39, "adult"], [40, "middle"], [59, "middle"], [60, "elder"], [100, "elder"]] as const;
  for (const [age, stage] of cases) {
    assert.equal(avatarStage(age), stage);
    assert.equal(portraitSource({ age, seed: "same-life", originId: "fishing-household", sex: "female", avatarVariant: 2 }), `/assets/pixel/portraits/fishing-household/female/${stage}-2.svg`);
  }
  const options = avatarOptions("clerk-household", "male");
  options[0].src = "changed";
  assert.notEqual(avatarOptions("clerk-household", "male")[0].src, "changed");
});

test("retained and unsupported lives preserve their original portrait selection", () => {
  for (const age of [0, 5, 15, 25, 45, 75]) for (const seed of ["old-life", "another-life"]) {
    const expected = `/assets/pixel/portraits/${avatarStage(age)}-${portraitVariant(seed)}.svg`;
    assert.equal(portraitSource({ age, seed }), expected);
    assert.equal(portraitSource({ age, seed, originId: "unknown-household", sex: "female", avatarVariant: 1 }), expected);
  }
  assert.deepEqual(avatarOptions("unknown-household", "female"), []);
  assert.deepEqual(avatarOptions("clerk-household", "other" as AvatarSex), []);
  for (const variant of [-1, .5, 3, Infinity, NaN]) assert.equal(portraitSource({ age: 22, seed: "fallback", originId: "clerk-household", sex: "male", avatarVariant: variant }), avatarOptions("clerk-household", "male")[portraitVariant("fallback")].src);
});

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname }).outputText };
  return nextLoad(url, context);
} });
const { default: PixelPortrait } = await import("../client/components/PixelPortrait.tsx");
hooks.deregister();

test("the actual portrait component renders the selected lifetime and retains accessible stage text", () => {
  const female = renderToStaticMarkup(createElement(PixelPortrait, { age: 62, name: "Isidora", seed: "stable", originId: "weaver-household", sex: "female", avatarVariant: 1 }));
  assert.match(female, /src="\/assets\/portraits\/ordinary-v3\/ef-p-f02-elder-everyday-v3.png"/);
  assert.match(female, /Pixel portrait of Isidora, in later life/);
  assert.match(female, /width="384" height="480"/);
  const legacy = renderToStaticMarkup(createElement(PixelPortrait, { age: 6, name: "Legacy", seed: "old-life" }));
  assert.match(legacy, /src="\/assets\/portraits\/ordinary-v3\/ef-p-[mf]0[123]-child-child-v3.png"/);
  assert.match(legacy, /Pixel portrait of Legacy, a child/);
  assert.equal(legacy, renderToStaticMarkup(createElement(PixelPortrait, { age: 6, name: "Legacy", seed: "old-life" })), "Missing recorded appearance must remain deterministic.");
});
