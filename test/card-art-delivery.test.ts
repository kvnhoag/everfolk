import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

interface CardArt {
  id: string;
  figureId: string;
  kind: "parent" | "contribution";
  tier: string | null;
  gender: "male" | "female";
  rarity: string;
  variantOf?: string;
  title: string;
  displayTitle: string;
  subtitle: string;
  bodyTitle: string;
  bodyText: string;
  editionLimit: number | null;
  exampleEdition: string;
  src: string;
  footerlessSrc: string;
  thumbnailSrc: string;
  portraitSrc: string;
  sha256: string;
  symbolSha256: string;
}
interface DeliveredFile { src: string; width: number; height: number; sha256: string; rgbaSha256: string; bytes: number }
interface Delivery { id: string; symbolSha256: string; editionRemovedPixels: number; outsideEditionChangedPixels: number; full: DeliveredFile; thumbnail: DeliveredFile; footerless: DeliveredFile; portrait: DeliveredFile }
interface VariantDelivery { id: string; variantOf: string; rarity: string; symbolSha256: string; uncoveredPixelDifferences: number; uncoveredPixelsChecked: number; footerless: DeliveredFile }
const registry = JSON.parse(readFileSync(new URL("../client/models/card-art-registry.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/manifest.json", import.meta.url), "utf8"));
const symbolCredits = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/icon-credits.json", import.meta.url), "utf8"));
const assets = registry.assets as CardArt[];
const variants = registry.parentVariants as CardArt[];
const deliveries = manifest.deliveries as Delivery[];
const variantDeliveries = manifest.parentVariantDeliveries as VariantDelivery[];
const ranks = ["common", "uncommon", "rare", "epic", "legendary"];
const caps: Record<string, number | null> = { common: null, uncommon: null, rare: 100, epic: 25, legendary: 10 };
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function losslessWebPSize(bytes: Buffer): [number, number] {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, "The complete RIFF image must be delivered");
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4), payload = offset + 8;
    assert.notEqual(type, "VP8 ", "Card pixels must use lossless encoding");
    if (type === "VP8L") {
      assert.equal(bytes[payload], 0x2f);
      const dimensions = bytes.readUInt32LE(payload + 1);
      return [(dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1];
    }
    offset = payload + size + (size & 1);
  }
  assert.fail("Missing lossless WebP image chunk");
}

test("the shipped card set covers every figure and all four male/female contribution tiers", () => {
  assert.equal(registry.libraryId, "everfolk-framed-collection-v14");
  assert.equal(assets.length, 117);
  assert.equal(new Set(assets.map(asset => asset.id)).size, 117);
  assert.equal(assets.filter(asset => asset.kind === "parent").length, 13);
  const figures = new Set(assets.map(asset => asset.figureId));
  assert.equal(figures.size, 13);
  for (const figureId of figures) for (const rarity of ranks.slice(0, 4)) {
    const pair = assets.filter(asset => asset.figureId === figureId && asset.kind === "contribution" && asset.tier === rarity);
    assert.equal(pair.length, 2, `${figureId}/${rarity}`);
    assert.deepEqual(pair.map(asset => asset.gender).sort(), ["female", "male"]);
    assert.equal(pair[0].bodyText, pair[1].bodyText, "The same profession has the same biography for both genders");
  }
  for (const asset of [...assets, ...variants]) {
    assert.ok(ranks.includes(asset.rarity));
    assert.equal(asset.editionLimit, caps[asset.rarity]);
    assert.equal(asset.exampleEdition, `001/${asset.editionLimit === null ? "∞" : String(asset.editionLimit).padStart(3, "0")}`);
    assert.ok(asset.displayTitle && asset.subtitle && asset.bodyTitle && asset.bodyText);
    assert.doesNotMatch(asset.subtitle, /^(?:historical figure|player contribution|art preview)$/i);
    assert.ok(asset.src.startsWith("/assets/cards/collection-v14/"));
  }
});

test("all 484 production images have intact hashes, lossless encoding and approved dimensions", () => {
  assert.equal(deliveries.length, 117);
  assert.equal(variantDeliveries.length, 16);
  assert.equal(manifest.sourceCatalogSha256, registry.sourceCatalogSha256);
  assert.equal(manifest.losslessRGBAReadbackVerified, true);
  const files = deliveries.flatMap(asset => [asset.full, asset.thumbnail, asset.footerless, asset.portrait]).concat(variantDeliveries.map(variant => variant.footerless));
  assert.equal(files.length, 484);
  assert.equal(new Set(files.map(file => file.src)).size, 484);
  assert.equal(readdirSync(new URL("../public/assets/cards/collection-v14/", import.meta.url)).filter(name => name.endsWith(".webp")).length, 484);
  for (const file of files) {
    const bytes = readFileSync(new URL("../public" + file.src, import.meta.url));
    assert.equal(bytes.length, file.bytes, file.src);
    assert.equal(sha(bytes), file.sha256, file.src);
    assert.match(file.rgbaSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(losslessWebPSize(bytes), [file.width, file.height], file.src);
  }
});

test("live edition surfaces remove only the example serial and retain the reviewed artwork", () => {
  assert.equal(manifest.outsideEditionChangedPixels, 0);
  for (const asset of assets) {
    const delivery = deliveries.find(delivery => delivery.id === asset.id)!;
    assert.ok(delivery, asset.id);
    assert.equal(asset.src, delivery.full.src);
    assert.equal(asset.sha256, delivery.full.sha256);
    assert.equal(asset.symbolSha256, symbolCredits.icons.find((icon: { figureId: string }) => icon.figureId === asset.figureId)?.sha256);
    assert.equal(delivery.symbolSha256, asset.symbolSha256);
    assert.equal(asset.footerlessSrc, delivery.footerless.src);
    assert.equal(asset.thumbnailSrc, delivery.thumbnail.src);
    assert.equal(asset.portraitSrc, delivery.portrait.src);
    assert.notEqual(asset.src, asset.footerlessSrc);
    assert.notEqual(delivery.full.rgbaSha256, delivery.footerless.rgbaSha256);
    assert.ok(delivery.editionRemovedPixels > 0);
    assert.equal(delivery.outsideEditionChangedPixels, 0);
    assert.deepEqual([delivery.full.width, delivery.full.height], [900, 1260]);
    assert.deepEqual([delivery.thumbnail.width, delivery.thumbnail.height], [450, 630]);
    assert.deepEqual([delivery.portrait.width, delivery.portrait.height], [840, 1050]);
  }
});

test("owned historical NFTs have a parent frame for their actual rarity", () => {
  assert.equal(variants.length, 16);
  for (const figureId of ["alexander", "aristotle", "euclid", "cleomenes"]) for (const rarity of ranks) {
    const candidates = [...assets, ...variants].filter(asset => asset.kind === "parent" && asset.figureId === figureId && asset.rarity === rarity);
    assert.equal(candidates.length, 1, `${figureId}/${rarity}`);
    const [asset] = candidates;
    assert.equal(asset.editionLimit, caps[rarity]);
    if (asset.variantOf) {
      const original = assets.find(original => original.id === asset.variantOf)!;
      assert.ok(original && original.figureId === asset.figureId);
      assert.equal(asset.portraitSrc, original.portraitSrc);
      const delivered = variantDeliveries.find(delivered => delivered.id === asset.id)!;
      assert.equal(delivered.footerless.src, asset.footerlessSrc);
      assert.equal(delivered.footerless.sha256, asset.sha256);
      assert.equal(delivered.symbolSha256, asset.symbolSha256);
      assert.equal(delivered.uncoveredPixelDifferences, 0);
      assert.ok(delivered.uncoveredPixelsChecked > 500000);
    }
  }
});
