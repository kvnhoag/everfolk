import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { artworkImageSources } from "../client/lib/artwork-delivery.ts";
import { sceneArtworkBaseUrl } from "../client/lib/scene-artwork.ts";
import media from "../assets/storage/scene-media-lock.json" with { type: "json" };
import manifest from "../public/assets/pixel/banners-concept1/manifest.json" with { type: "json" };

test("every high-bit scene and actor resolves in its reviewed release despite an older app-wide media pin", () => {
  const appBase = "https://everfolk.life/releases/media-20261114-v1/payload/";
  const sceneBase = sceneArtworkBaseUrl(appBase);
  assert.notEqual(sceneBase, appBase);
  assert.equal(manifest.scenes.length, media.scenes);
  assert.equal(manifest.actors.length, media.actors);
  const bytes = readFileSync(new URL("../public/assets/pixel/banners-concept1/manifest.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), media.sceneManifestSha256);
  for (const source of [...manifest.scenes.map(item => item.src), ...manifest.actors.map(item => item.asset)]) {
    const sources = artworkImageSources(source, sceneBase);
    assert.equal(sources.primary, `${media.baseUrl}${source.slice(1)}`);
    assert.equal(sources.fallback, source);
  }
  assert.equal(artworkImageSources("/assets/portraits/concept1-v4/infant-c1.png", appBase).primary,
    appBase + "assets/portraits/concept1-v4/infant-c1.png");
});

test("local scene development stays local when CDN delivery is disabled or invalid", () => {
  for (const base of ["", " ", "http://untrusted.invalid/", "https://example.com/not-a-release/"]) {
    assert.equal(sceneArtworkBaseUrl(base), undefined);
  }
});
