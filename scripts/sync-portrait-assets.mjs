/** Deliver the reviewed ordinary-v3 PNGs and its compact runtime lookup data. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const libraryRoot = resolve(repo, "artwork/portraits/ordinary-v3");
const sourceManifest = resolve(libraryRoot, "manifest.json");
const destination = resolve(repo, "public/assets/portraits/ordinary-v3");
const registryPath = resolve(repo, "client/models/portrait-asset-registry.json");
const publicPrefix = "/assets/portraits/ordinary-v3/";
const expectedLibrary = "everfolk-ordinary-portraits-v3";
const expectedCount = 240;
const dimensions = { width: 384, height: 480 };
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const defaults = { infant: "infant", child: "child", youth: "youth", adult: "everyday", middle: "everyday", elder: "everyday" };

function need(value, message) { if (!value) throw new Error(message); }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + "\n"); }
function writeChanged(path, bytes) {
  if (existsSync(path) && readFileSync(path).equals(bytes)) return false;
  writeFileSync(path, bytes);
  return true;
}

const sourceBytes = readFileSync(sourceManifest);
const sourceManifestSha256 = digest(sourceBytes);
const manifest = JSON.parse(sourceBytes.toString("utf8"));
const audit = readJson(resolve(libraryRoot, "qa/library-audit.json"));
const visual = readJson(resolve(libraryRoot, "qa/anatomy-visual-review.json"));
const versions = readJson(resolve(repo, "artwork/portraits/libraries.json"));
need(versions.currentAuthoringLibraryId === expectedLibrary && manifest.libraryId === expectedLibrary, "ordinary-v3 must be the current authoring library");
need(manifest.expectedPortraitCount === expectedCount && manifest.portraits.length === expectedCount, "The complete 240-image source manifest is required");
need(audit.status === "passed" && audit.portraits === expectedCount, "The source library must pass its readback audit");
need(visual.status === "reviewed" && visual.finalPortraitsReviewed === expectedCount && visual.manifestSha256 === sourceManifestSha256, "The source manifest must match the completed visual review");
need(manifest.pixelProfile.coarseScale === 3 && manifest.pixelProfile.fineScale === 2 && manifest.pixelProfile.commonCell === 6, "The agreed PixelOE finish must be retained");

const identities = manifest.identities.map(({ id, sex, avatarVariant }) => ({ id, sex, avatarVariant }));
const identityMap = new Map(identities.map(identity => [identity.id, identity]));
const ids = new Set();
const combinations = new Set();
const sourceRoot = realpathSync(libraryRoot);
const assets = [...manifest.portraits].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(portrait => {
  const { id, identityId, sex, stage, wardrobeId, sha256 } = portrait;
  need(id === `ef-p-${identityId}-${stage}-${wardrobeId}-v3`, "Unexpected portrait convention: " + id);
  need(!ids.has(id), "Duplicate portrait ID: " + id);
  ids.add(id);
  need(identityMap.get(identityId)?.sex === sex, "Portrait identity/sex mismatch: " + id);
  need(manifest.stageWardrobes[stage]?.includes(wardrobeId), "Unregistered stage/clothing combination: " + id);
  const combination = `${identityId}:${stage}:${wardrobeId}`;
  need(!combinations.has(combination), "Duplicate portrait combination: " + combination);
  combinations.add(combination);
  const source = realpathSync(resolve(libraryRoot, portrait.path));
  const relativeSource = relative(sourceRoot, source);
  need(relativeSource && !relativeSource.startsWith("..") && !isAbsolute(relativeSource), "Portrait source escapes its library: " + id);
  need(basename(source) === id + ".png", "Portrait filename does not match its ID: " + id);
  const bytes = readFileSync(source);
  need(digest(bytes) === sha256, "Portrait source SHA mismatch: " + id);
  need(bytes.subarray(0, 8).equals(signature) && bytes.toString("ascii", 12, 16) === "IHDR", "Invalid PNG: " + id);
  need(bytes.readUInt32BE(16) === dimensions.width && bytes.readUInt32BE(20) === dimensions.height && bytes[24] === 8 && bytes[25] === 2, "Portrait must remain an unmodified 384x480 RGB PNG: " + id);
  return { id, identityId, sex, stage, wardrobeId, src: publicPrefix + id + ".png", sha256, bytes };
});

for (const identity of identities) for (const [stage, wardrobes] of Object.entries(manifest.stageWardrobes)) {
  need(wardrobes.includes(defaults[stage]), "Stage is missing its default clothing: " + stage);
  for (const wardrobe of wardrobes) need(combinations.has(`${identity.id}:${stage}:${wardrobe}`), "Missing portrait combination");
}
if (existsSync(destination)) {
  const expectedNames = new Set(assets.map(asset => asset.id + ".png"));
  for (const name of readdirSync(destination)) if (name.endsWith(".png")) need(expectedNames.has(name), "Unexpected delivered portrait PNG: " + name);
}

const common = {
  schemaVersion: 1,
  libraryId: expectedLibrary,
  assetVersion: "v3",
  sourceManifestSha256,
  dimensions,
  identities,
  defaultWardrobes: defaults,
  stageWardrobes: manifest.stageWardrobes,
  jobs: manifest.jobWardrobeBindings.map(({ id, title, wardrobeId, minAge }) => ({ id, title, wardrobeId, minAge })),
  encounters: manifest.encounterWardrobeBindings.map(({ id, title, jobId, wardrobeId }) => ({ id, title, jobId, wardrobeId })),
  roles: manifest.roleWardrobeBindings.map(({ roleAlias, wardrobeId, minAge }) => ({ roleAlias, wardrobeId, ...(minAge === undefined ? {} : { minAge }) })),
};
const runtimeRegistry = { ...common, assets: assets.map(({ sha256, bytes, ...asset }) => asset) };
const deliveryManifest = { ...common, runtimeIntegrated: true, sourceReviewed: true, assets: assets.map(({ bytes, ...asset }) => asset) };
mkdirSync(destination, { recursive: true });
let copied = 0;
for (const asset of assets) {
  const target = resolve(destination, asset.id + ".png");
  copied += Number(writeChanged(target, asset.bytes));
  need(digest(readFileSync(target)) === asset.sha256, "Delivered PNG differs from source: " + asset.id);
}
const manifestChanged = writeChanged(resolve(destination, "manifest.json"), jsonBytes(deliveryManifest));
const registryChanged = writeChanged(registryPath, jsonBytes(runtimeRegistry));
need(readdirSync(destination).filter(name => name.endsWith(".png")).length === expectedCount, "Delivered portrait count differs");
console.log(JSON.stringify({ portraits: assets.length, copied, manifestChanged, registryChanged, registry: relative(repo, registryPath).replaceAll("\\", "/"), destination: relative(repo, destination).replaceAll("\\", "/"), sourceManifestSha256 }));
