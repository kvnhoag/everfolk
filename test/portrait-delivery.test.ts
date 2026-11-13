import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

interface PortraitAsset { id: string; identityId: string; sex: "male" | "female"; stage: string; wardrobeId: string; src: string; sha256: string }
const runtime = JSON.parse(readFileSync(new URL("../client/models/portrait-asset-registry.json", import.meta.url), "utf8"));
const delivery = JSON.parse(readFileSync(new URL("../public/assets/portraits/ordinary-v3/manifest.json", import.meta.url), "utf8"));
const sourceBytes = readFileSync(new URL("../artwork/portraits/ordinary-v3/manifest.json", import.meta.url));
const source = JSON.parse(sourceBytes.toString("utf8"));
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("all 240 delivered PNGs remain byte-identical to the reviewed source portraits", () => {
  assert.equal(runtime.libraryId, "everfolk-ordinary-portraits-v3");
  assert.equal(runtime.sourceManifestSha256, sha(sourceBytes));
  assert.equal(delivery.sourceManifestSha256, runtime.sourceManifestSha256);
  assert.equal(runtime.assets.length, 240);
  assert.equal(delivery.assets.length, 240);
  assert.equal(readdirSync(new URL("../public/assets/portraits/ordinary-v3/", import.meta.url)).filter(name => name.endsWith(".png")).length, 240);
  const originals = new Map(source.portraits.map((portrait: { id: string; sha256: string }) => [portrait.id, portrait.sha256]));
  for (const asset of delivery.assets as PortraitAsset[]) {
    const bytes = readFileSync(new URL("../public" + asset.src, import.meta.url));
    assert.equal(sha(bytes), asset.sha256, asset.id);
    assert.equal(asset.sha256, originals.get(asset.id), asset.id);
    assert.equal(bytes.readUInt32BE(16), 384, asset.id);
    assert.equal(bytes.readUInt32BE(20), 480, asset.id);
    assert.equal(bytes[25], 2, "RGB portrait delivery must preserve the finished source pixels");
  }
});

test("the runtime lookup covers every identity, age and authored clothing combination", () => {
  assert.equal(runtime.identities.length, 6);
  const assets = runtime.assets as PortraitAsset[];
  const keys = new Set(assets.map(asset => `${asset.identityId}:${asset.stage}:${asset.wardrobeId}`));
  assert.equal(keys.size, 240);
  for (const identity of runtime.identities) for (const [stage, wardrobes] of Object.entries(runtime.stageWardrobes) as [string, string[]][]) {
    assert.ok(wardrobes.includes(runtime.defaultWardrobes[stage]));
    for (const wardrobe of wardrobes) {
      assert.ok(keys.has(`${identity.id}:${stage}:${wardrobe}`));
      const asset = assets.find(asset => asset.identityId === identity.id && asset.stage === stage && asset.wardrobeId === wardrobe)!;
      assert.equal(asset.sex, identity.sex);
      assert.equal(asset.id, `ef-p-${identity.id}-${stage}-${wardrobe}-v3`);
      assert.equal(asset.src, `/assets/portraits/ordinary-v3/${asset.id}.png`);
    }
  }
  assert.equal(runtime.jobs.length, 33);
  assert.equal(runtime.encounters.length, 16);
  assert.deepEqual(runtime.roles.map((role: { roleAlias: string; wardrobeId: string }) => [role.roleAlias, role.wardrobeId]), [["scholar", "scholarly"], ["warrior", "military"], ["aristocrat", "aristocrat"], ["royalty", "royalty"]]);
  for (const role of runtime.roles.filter((role: { roleAlias: string }) => ["royalty", "aristocrat"].includes(role.roleAlias))) {
    assert.equal(role.minAge, 16);
    assert.ok(runtime.stageWardrobes.youth.includes(role.wardrobeId));
  }
});
