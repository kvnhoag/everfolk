/** Deliver the reviewed v14 collection without flattening live token edition data. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeActiveCardArtReplacements } from "./lib/card-art-replacements.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const library = resolve(repo, "artwork/cards/framed-collection-v14");
const catalogPath = resolve(library, "catalog.json");
const destination = resolve(repo, "public/assets/cards/collection-v14");
const registryPath = resolve(repo, "client/models/card-art-registry.json");
const temporary = resolve(repo, "artifacts/card-assets-v14");
const prefix = "/assets/cards/collection-v14/";
const catalogBytes = readFileSync(catalogPath);
const catalog = JSON.parse(catalogBytes.toString("utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (value, message) => { if (!value) throw Error(message); };
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const writeChanged = (file, bytes) => {
  if (existsSync(file) && readFileSync(file).equals(bytes)) return false;
  writeFileSync(file, bytes);
  return true;
};

need(catalog.complete && catalog.expected === 117 && catalog.assets.length === 117, "The reviewed 117-card catalogue is required");
const sourceQA = JSON.parse(readFileSync(resolve(library, "qa/collection-verification.json"), "utf8"));
const editorial = JSON.parse(readFileSync(resolve(library, "qa/editorial-review.json"), "utf8"));
need(sourceQA.passed && sourceQA.counts.total === 117 && editorial.passed, "Card artwork and copy must pass collection and editorial review");
const sourceCatalogSha256 = hash(catalogBytes);
const symbolManifestBytes = readFileSync(resolve(library, "source/icon-sources.json"));
const symbolManifest = JSON.parse(symbolManifestBytes.toString("utf8"));
need(symbolManifest.icons?.length === 13, "All 13 professionally sourced symbols are required");
const symbolByFigure = new Map(symbolManifest.icons.map(icon => [icon.figureId, icon]));
need(symbolByFigure.size === 13, "Figure symbols must be unique");
const assets = catalog.assets.map(card => ({
  id: card.slug,
  slug: card.slug,
  figureId: card.figureId,
  figureName: card.figureName,
  kind: card.kind,
  tier: card.kind === "parent" ? null : card.tier,
  gender: card.gender,
  title: card.title,
  canonicalTitle: card.canonicalTitle ?? card.title,
  displayTitle: card.displayTitle ?? card.title,
  subtitle: card.subtitle,
  bodyTitle: card.bodyTitle,
  bodyText: card.bodyText,
  rarity: card.rarity,
  frameLayout: card.frameLayout,
  rarityCharacteristics: card.rarityCharacteristics,
  editionLimit: card.editionLimit,
  exampleEdition: card.editionText,
  collectionIndex: card.collectionIndex,
  src: prefix + card.slug + ".webp",
  footerlessSrc: prefix + card.slug + "-footerless.webp",
  thumbnailSrc: prefix + card.slug + "-thumb.webp",
  portraitSrc: prefix + card.slug + "-portrait.webp",
  symbolSha256: symbolByFigure.get(card.figureId).sha256,
  sha256: existsSync(resolve(destination, card.slug + ".webp")) ? hash(readFileSync(resolve(destination, card.slug + ".webp"))) : "",
  width: 900,
  height: 1260,
}));
need(new Set(assets.map(a => a.id)).size === 117, "Card IDs must be unique");
const ranks = ["common", "uncommon", "rare", "epic", "legendary"];
const limits = { common: null, uncommon: null, rare: 100, epic: 25, legendary: 10 };
const chainFigures = new Set(["alexander", "aristotle", "euclid", "cleomenes"]);
const promotedFigures = new Set(["demetrius", "zeno", "ptolemy"]);
const parentVariants = assets.filter(asset => asset.kind === "parent" && (chainFigures.has(asset.figureId) || promotedFigures.has(asset.figureId))).flatMap(base =>
  (chainFigures.has(base.figureId) ? ranks : ["legendary"]).filter(rarity => rarity !== base.rarity).map(rarity => {
    const id = base.id + "-" + rarity;
    return { ...base, ...(base.figureId === "cleomenes" && rarity === "legendary" ? { bodyText: "Appointed by Alexander to administer Egyptian revenue, Cleomenes became a powerful financial official. His control of grain and taxation amassed wealth, alongside ancient accusations of exploitation and profiteering." } : {}), id, slug: id, variantOf: base.id, rarity, rarityCharacteristics: require(resolve(library, "source/frame-design.cjs")).PALETTE[rarity].character, editionLimit: limits[rarity], exampleEdition: `001/${limits[rarity] === null ? "∞" : String(limits[rarity]).padStart(3, "0")}`, frameLayout: rarity === "legendary" ? "full-art" : "standard", src: prefix + id + "-footerless.webp", footerlessSrc: prefix + id + "-footerless.webp", thumbnailSrc: prefix + id + "-footerless.webp", sha256: existsSync(resolve(destination, id + "-footerless.webp")) ? hash(readFileSync(resolve(destination, id + "-footerless.webp"))) : "" };
  })
);
need(parentVariants.length === 19, "Expected 16 live-token variants and three Legendary promotions");
const common = {
  schemaVersion: 1,
  libraryId: catalog.libraryId,
  assetVersion: "v14",
  sourceCatalogSha256,
  dimensions: { width: 900, height: 1260 },
  thumbnailDimensions: { width: 450, height: 630 },
  portraitDimensions: { width: 840, height: 1050 },
  editionPlacement: { right: 84, baseline: 1207.344, fontSize: 21, letterSpacing: 2.1 },
  editionRemovalBounds: { left: 700, top: 1180, width: 126, height: 44 },
  sourceReviewed: true,
  exampleSerialsAreIssuedCopies: false,
  symbolLibraryId: symbolManifest.libraryId,
  sourceSymbolManifestSha256: hash(symbolManifestBytes),
  symbolCreditsSrc: prefix + "icon-credits.html",
  symbolSources: symbolManifest.icons.map(({ figureId, iconName, author, pageUrl, downloadUrl, license, licenseUrl, publicPath, sha256 }) => ({ figureId, iconName, author, pageUrl, downloadUrl, license, licenseUrl, publicPath, sha256 })),
  assets,
  parentVariants,
};
mkdirSync(destination, { recursive: true });
writeChanged(registryPath, json(common));
if (process.argv.includes("--registry-only")) {
  const manifestPath = resolve(destination, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeChanged(manifestPath, json({ ...manifest, ...common }));
  }
  console.log(JSON.stringify({ registry: relative(repo, registryPath), cards: assets.length, registryOnly: true }));
} else if (process.argv.includes("--variants-only")) {
  await syncParentVariants();
} else {
  await main();
  await syncParentVariants();
}
// A reviewed pixel-art import remains active when the original library is rebuilt.
const activeRegistry = mergeActiveCardArtReplacements({ repo, registry: common });
if (activeRegistry !== common) writeChanged(registryPath, json(activeRegistry));

function beneath(root, file) {
  const rel = relative(realpathSync(root), realpathSync(file));
  need(rel && !rel.startsWith("..") && !isAbsolute(rel), "Asset path escapes source library: " + file);
  return file;
}
async function rgba(input) { return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
function verifySymbol(figureId, overlay) {
  const icon = symbolByFigure.get(figureId);
  need(icon && icon.path.startsWith("icons/"), "Missing sourced symbol: " + figureId);
  const bytes = readFileSync(resolve(library, "source", icon.path));
  need(hash(bytes) === icon.sha256, "Original symbol source changed: " + figureId);
  need(bytes.equals(readFileSync(resolve(repo, "public" + icon.publicPath))), "Public original symbol differs: " + figureId);
  const paths = [...bytes.toString("utf8").matchAll(/<path\b[^>]*\bd\s*=\s*(["'])([^"']+)\1/gi)].map(match => match[2]).filter(d => !/^m00h512v512h0z$/i.test(d.replace(/[\s,]/g, "")));
  need(paths.length > 0, "Symbol has no original geometry: " + figureId);
  for (const d of paths) need(overlay.includes(`d="${d}"`) || overlay.includes(`d='${d}'`), "Card overlay does not contain the original sourced symbol geometry: " + figureId);
  return icon;
}
function unwrap(result) {
  if (result.isError) throw Error(JSON.stringify(result));
  const text = result.content?.find(content => content.type === "text");
  return text ? JSON.parse(text.text) : result;
}
async function encode(input, filename, width, height) {
  const raw = await rgba(input);
  need(raw.info.width === width && raw.info.height === height, "Unexpected raster size: " + filename);
  const target = resolve(destination, filename);
  let reuse = false;
  if (existsSync(target)) {
    // Buffer reads avoid retaining Windows file handles when replacing a prior build.
    try {
      const existing = await rgba(readFileSync(target));
      reuse = existing.info.width === width && existing.info.height === height && existing.data.equals(raw.data);
    } catch { reuse = false; }
  }
  if (!reuse) await sharp(input).webp({ lossless: true, exact: true, alphaQuality: 100, effort: 6 }).toFile(target);
  const delivered = await rgba(readFileSync(target));
  need(delivered.data.equals(raw.data), "Lossless WebP pixels differ: " + filename);
  const bytes = readFileSync(target);
  return { src: prefix + filename, width, height, sha256: hash(bytes), rgbaSha256: hash(raw.data), bytes: bytes.length, reused: reuse };
}
async function main() {
  mkdirSync(temporary, { recursive: true });
  const helper = process.env.ARTCRAFT_MCP_HELPER ?? resolve(homedir(), ".codex/skills/artcraft-mcp/scripts/mcp.cjs");
  need(existsSync(helper), "VectorCraft MCP helper is required; set ARTCRAFT_MCP_HELPER to its installed path");
  const { withMcp } = require(helper);
  const delivered = [];
  await withMcp("VectorCraft", { readRoot: temporary, writeRoot: temporary, timeoutMs: 60000 }, async ({ listTools, callTool }) => {
    const tools = await listTools();
    for (const name of ["open_file", "export", "run_command", "command_list"]) need(tools.some(tool => tool.name === name), "Missing VectorCraft tool: " + name);
    const call = async (name, args) => {
      const result = unwrap(await callTool(name, args));
      need(!result?.warnings?.length, "Unexpected import/export warning: " + JSON.stringify(result?.warnings));
      return result;
    };
    const catalog = await call("command_list", { brief: true });
    const commands = Array.isArray(catalog) ? catalog : catalog.commands;
    need(commands.some(command => command.id === "file.close"), "VectorCraft file.close command unavailable");
    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index], original = catalogSource(asset.id);
      const source = beneath(library, resolve(library, original.export));
      const thumbnail = beneath(library, resolve(library, original.thumbnail));
      const portrait = resolve(repo, original.sourceArt);
      need(hash(readFileSync(source)) === original.exportSha256, "Approved PNG changed: " + asset.id);
      need(hash(readFileSync(portrait)) === original.sourceArtSha256, "Approved portrait changed: " + asset.id);
      const overlayFile = resolve(library, original.overlaySvg);
      const overlay = readFileSync(overlayFile, "utf8");
      const symbol = verifySymbol(asset.figureId, overlay);
      const expression = /<text\b[^>]*\bid="Edition_number_live"[^>]*>[\s\S]*?<\/text>/g;
      need((overlay.match(expression) ?? []).length === 1, "Expected exactly one edition text node: " + asset.id);
      const footerlessSVG = overlay.replace(expression, "");
      const svgPath = resolve(temporary, asset.id + "-overlay.svg");
      const pngPath = resolve(temporary, asset.id + "-overlay.png");
      writeFileSync(svgPath, footerlessSVG);
      await call("open_file", { path: svgPath });
      await call("export", { format: "png", path: pngPath, artboard: 0, scale: 1, options: { background: "transparent", includeArtboardFill: false } });
      await call("run_command", { command: "file.close", params: {} });
      const footerless = await sharp(resolve(library, original.fittedArt)).composite([{ input: pngPath }]).png().toBuffer();
      const [approvedPixels, footerlessPixels] = await Promise.all([rgba(source), rgba(footerless)]);
      let changed = 0;
      for (let p = 0; p < approvedPixels.data.length; p += 4) {
        const x = (p / 4) % 900, y = Math.floor(p / 4 / 900);
        const same = approvedPixels.data[p] === footerlessPixels.data[p] && approvedPixels.data[p + 1] === footerlessPixels.data[p + 1] && approvedPixels.data[p + 2] === footerlessPixels.data[p + 2] && approvedPixels.data[p + 3] === footerlessPixels.data[p + 3];
        if (!same) {
          changed++;
          need(x >= 700 && x < 826 && y >= 1180 && y < 1224, "Footerless derivative changes artwork outside edition number: " + asset.id + " at " + x + "," + y);
        }
      }
      need(changed > 0, "Edition number was not removed: " + asset.id);
      const [full, thumb, clean, inner] = await Promise.all([
        encode(source, asset.id + ".webp", 900, 1260),
        encode(thumbnail, asset.id + "-thumb.webp", 450, 630),
        encode(footerless, asset.id + "-footerless.webp", 900, 1260),
        encode(portrait, asset.id + "-portrait.webp", 840, 1050),
      ]);
      delivered.push({ id: asset.id, sourcePNG: original.export, sourceSha256: original.exportSha256, portraitSourceSha256: original.sourceArtSha256, symbolSha256: symbol.sha256, editionRemovedPixels: changed, outsideEditionChangedPixels: 0, full, thumbnail: thumb, footerless: clean, portrait: inner });
      asset.sha256 = full.sha256;
      if ((index + 1) % 10 === 0 || index + 1 === assets.length) console.log(JSON.stringify({ delivered: index + 1, expected: assets.length }));
    }
  });
  const filenames = new Set(assets.flatMap(a => [a.id + ".webp", a.id + "-thumb.webp", a.id + "-footerless.webp", a.id + "-portrait.webp"]));
  const variantFiles = new Set(parentVariants.map(a => a.id + "-footerless.webp"));
  for (const file of readdirSync(destination)) if (file.endsWith(".webp")) need(filenames.has(file) || variantFiles.has(file), "Unexpected delivered card asset: " + file);
  const files = delivered.flatMap(asset => [asset.full, asset.thumbnail, asset.footerless, asset.portrait]);
  need(files.length === 468 && readdirSync(destination).filter(file => filenames.has(file)).length === 468, "Expected exactly 468 base collection WebP files");
  const manifest = { ...common, runtimeIntegrated: true, losslessRGBAReadbackVerified: true, outsideEditionChangedPixels: 0, totalBytes: files.reduce((total, file) => total + file.bytes, 0), deliveries: delivered };
  writeChanged(resolve(destination, "manifest.json"), json(manifest));
  // The temporary native session has ended; remove only this task-owned workspace.
  need(relative(resolve(repo, "artifacts"), temporary) === "card-assets-v14", "Unexpected cleanup target");
  rmSync(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ cards: assets.length, files: files.length, bytes: manifest.totalBytes, losslessRGBAReadbackVerified: true, outsideEditionChangedPixels: 0, registry: relative(repo, registryPath).replaceAll("\\", "/") }));
}
function catalogSource(id) { const card = catalog.assets.find(asset => asset.slug === id); need(card, "Unknown card: " + id); return card; }

async function fittedParent(source, rarity, design) {
  const input = resolve(repo, source.sourceArt);
  let layers;
  if (rarity !== "legendary") {
    const art = await sharp(input).resize(592, 740, { kernel: "nearest" }).png().toBuffer();
    const matte = await sharp({ create: { width: 800, height: 740, channels: 4, background: design.PALETTE[rarity].matte } }).png().toBuffer();
    layers = [{ input: matte, left: 50, top: 190 }, { input: art, left: 154, top: 190 }];
  } else {
    const top = await sharp(input).extract({ left: 0, top: 0, width: 840, height: 1 }).resize(840, 140, { kernel: "nearest" }).png().toBuffer();
    const bottom = await sharp(input).extract({ left: 0, top: 1049, width: 840, height: 1 }).resize(840, 70, { kernel: "nearest" }).png().toBuffer();
    const side = async left => {
      const edge = await sharp(input).extract({ left: left ? 0 : 828, top: 0, width: 12, height: 1050 }).resize(10, 420, { kernel: "lanczos3" }).png().toBuffer();
      return sharp(edge).resize(30, 1260, { kernel: "nearest" }).png().toBuffer();
    };
    layers = [{ input: await side(true), left: 0, top: 0 }, { input: await side(false), left: 870, top: 0 }, { input: top, left: 30, top: 0 }, { input: bottom, left: 30, top: 1190 }, { input, left: 30, top: 140 }];
  }
  let fit = await sharp({ create: { width: 900, height: 1260, channels: 4, background: "#00000000" } }).composite(layers).png().toBuffer();
  if (rarity === "legendary") fit = await sharp(fit).composite([{ input: Buffer.from('<svg width="900" height="1260"><rect width="900" height="1260" rx="42" fill="white"/></svg>'), blend: "dest-in" }]).png().toBuffer();
  return fit;
}

async function syncParentVariants() {
  const manifestFile = resolve(destination, "manifest.json");
  need(existsSync(manifestFile), "Deliver the base collection before its parent rarity variants");
  const existing = JSON.parse(readFileSync(manifestFile, "utf8"));
  need(existing.deliveries?.length === 117, "The base delivery manifest is incomplete");
  const design = require(resolve(library, "source/frame-design.cjs"));
  const helper = process.env.ARTCRAFT_MCP_HELPER ?? resolve(homedir(), ".codex/skills/artcraft-mcp/scripts/mcp.cjs");
  const { withMcp } = require(helper);
  mkdirSync(temporary, { recursive: true });
  const variantDeliveries = [];
  await withMcp("VectorCraft", { readRoot: temporary, writeRoot: temporary, timeoutMs: 60000 }, async ({ listTools, callTool }) => {
    const tools = await listTools();
    for (const name of ["open_file", "export", "run_command", "command_list"]) need(tools.some(tool => tool.name === name), "Missing VectorCraft tool: " + name);
    const call = async (name, args) => { const result = unwrap(await callTool(name, args)); need(!result?.warnings?.length, "Variant render warning"); return result; };
    const commands = await call("command_list", { brief: true });
    need((Array.isArray(commands) ? commands : commands.commands).some(command => command.id === "file.close"), "VectorCraft file.close is required");
    for (const variant of parentVariants) {
      const base = catalogSource(variant.variantOf);
      const row = { ...base, slug: variant.id, bodyText: variant.bodyText, rarity: variant.rarity, editionLimit: variant.editionLimit, frameLayout: variant.frameLayout };
      const designed = await design.build(row, row);
      const svg = designed.svg.replace(/<text\b[^>]*\bid="Edition_number_live"[^>]*>[\s\S]*?<\/text>/g, "");
      const symbol = verifySymbol(variant.figureId, svg);
      need(!svg.includes('id="Edition_number_live"'), "Variant contains baked edition");
      const svgPath = resolve(temporary, variant.id + "-overlay.svg"), pngPath = resolve(temporary, variant.id + "-overlay.png");
      writeFileSync(svgPath, svg);
      await call("open_file", { path: svgPath });
      await call("export", { format: "png", path: pngPath, artboard: 0, scale: 1, options: { background: "transparent", includeArtboardFill: false } });
      await call("run_command", { command: "file.close", params: {} });
      const fitted = await fittedParent(base, variant.rarity, design);
      const result = await sharp(fitted).composite([{ input: pngPath }]).png().toBuffer();
      const [fitPixels, finalPixels, overlayPixels] = await Promise.all([rgba(fitted), rgba(result), rgba(pngPath)]);
      let checked = 0;
      for (let p = 0; p < fitPixels.data.length; p += 4) if (fitPixels.data[p + 3] === 255 && overlayPixels.data[p + 3] === 0) {
        checked++;
        need(fitPixels.data.subarray(p, p + 4).equals(finalPixels.data.subarray(p, p + 4)), "Variant changes uncovered fitted portrait pixels: " + variant.id);
      }
      need(checked > 500000, "Variant has too little uncovered artwork: " + variant.id);
      const delivered = await encode(result, variant.id + "-footerless.webp", 900, 1260);
      variant.sha256 = delivered.sha256;
      variant.rarityCharacteristics = designed.palette.character;
      variantDeliveries.push({ id: variant.id, variantOf: variant.variantOf, rarity: variant.rarity, portraitSourceSha256: base.sourceArtSha256, symbolSha256: symbol.sha256, uncoveredPixelsChecked: checked, uncoveredPixelDifferences: 0, footerless: delivered });
    }
  });
  const manifest = { ...existing, ...common, parentVariants, parentVariantDeliveries: variantDeliveries, totalBytes: existing.deliveries.reduce((total, asset) => total + asset.full.bytes + asset.thumbnail.bytes + asset.footerless.bytes + asset.portrait.bytes, 0) + variantDeliveries.reduce((total, variant) => total + variant.footerless.bytes, 0) };
  need(readdirSync(destination).filter(file => file.endsWith(".webp")).length === 487, "Expected 487 base and parent-variant WebPs");
  writeChanged(registryPath, json(common));
  writeChanged(manifestFile, json(manifest));
  need(relative(resolve(repo, "artifacts"), temporary) === "card-assets-v14", "Unexpected variant cleanup target");
  rmSync(temporary, { recursive: true, force: true });
  console.log(JSON.stringify({ parentVariants: variantDeliveries.length, totalWebPFiles: 487, bytes: manifest.totalBytes, allLosslessRGBAExact: true }));
}
