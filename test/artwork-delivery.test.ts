import assert from "node:assert/strict";
import test from "node:test";
import { artworkImageSources, normalizeArtworkBaseUrl, loadArtworkImage } from "../client/lib/artwork-delivery.ts";

const base = "https://cdn.example/releases/test/payload/";
const source = "/assets/branding/logo@2x.png?v=1#preview";

test("an unset/invalid CDN keeps the original repo URL and external media unchanged", () => {
  for (const value of [undefined, "", "http://cdn.example/releases/test/payload/", "https://user:secret@cdn.example/releases/test/payload/", "https://cdn.example/latest/"]) {
    assert.deepEqual(artworkImageSources(source, value), { primary: source });
  }
  for (const value of ["https://nft.example/portrait.png", "data:image/png;base64,AAAA", "blob:http://localhost/token", "/api/portrait"]) {
    assert.deepEqual(artworkImageSources(value, base), { primary: value });
  }
  assert.throws(() => normalizeArtworkBaseUrl(base + "?token=secret"));
});

test("a CDN image plan pins the release and retains its precise local fallback", () => {
  assert.deepEqual(artworkImageSources(source, base), {
    primary: base + "assets/branding/logo@2x.png#preview", fallback: source, localPath: "/assets/branding/logo@2x.png",
  });
  assert.deepEqual(artworkImageSources(base + "assets/card.webp", base), {
    primary: base + "assets/card.webp", fallback: "/assets/card.webp", localPath: "/assets/card.webp",
  });
  for (const value of ["/assets/../private.png", "/assets/%2e%2e/private.png", "/assets/a%2f..%2fprivate.png", "/assets/%00.png", "/assets/a\\private.png"]) {
    assert.deepEqual(artworkImageSources(value, base), { primary: value });
  }
});

function fakeImages(outcome: (src: string) => "load" | "error" | "hang") {
  const requests: { src: string; crossOrigin: string | null }[] = [];
  const instances: FakeImage[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string | null = null;
    current = "";
    constructor() { instances.push(this); }
    get src() { return this.current; }
    set src(value: string) {
      this.current = value;
      if (value === "data:,") return;
      requests.push({ src: value, crossOrigin: this.crossOrigin });
      const result = outcome(value);
      queueMicrotask(() => { if (result === "load") this.onload?.(); else if (result === "error") this.onerror?.(); });
    }
  }
  return { Image: FakeImage as unknown as new () => HTMLImageElement, requests, instances };
}

test("CDN 404 or network failure retries the local image once with anonymous CORS", async () => {
  for (const failure of ["404", "network"]) {
    const fixture = fakeImages(url => url.startsWith(base) ? "error" : "load");
    const image = await loadArtworkImage(fixture.Image, "/assets/card.webp", { baseUrl: base, timeoutMs: 100 });
    assert.deepEqual(fixture.requests, [
      { src: base + "assets/card.webp", crossOrigin: "anonymous" },
      { src: "/assets/card.webp", crossOrigin: "anonymous" },
    ], failure);
    assert.equal(image.src, "/assets/card.webp");
  }
});

test("a stalled CDN request falls back after a bound and cannot later replace the local image", async () => {
  const fixture = fakeImages(url => url.startsWith(base) ? "hang" : "load");
  const image = await loadArtworkImage(fixture.Image, "/assets/card.webp", { baseUrl: base, timeoutMs: 10 });
  assert.equal(image.src, "/assets/card.webp");
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.instances[0].onload, null);
  assert.equal(fixture.instances[0].onerror, null);
  assert.equal(fixture.instances[0].src, "data:,");
});

test("a failed local fallback ends the attempt sequence instead of retrying indefinitely", async () => {
  const fixture = fakeImages(() => "error");
  await assert.rejects(loadArtworkImage(fixture.Image, "/assets/missing.webp", { baseUrl: base, timeoutMs: 100 }), /could not be loaded/);
  assert.equal(fixture.requests.length, 2);
  const local = fakeImages(() => "error");
  await assert.rejects(loadArtworkImage(local.Image, "/assets/missing.webp", { baseUrl: "", timeoutMs: 100 }), /could not be loaded/);
  assert.deepEqual(local.requests, [{ src: "/assets/missing.webp", crossOrigin: "anonymous" }]);
});

test("a successful CDN image resolves directly without requesting the repo fallback", async () => {
  const fixture = fakeImages(() => "load");
  const image = await loadArtworkImage(fixture.Image, "/assets/card.webp", { baseUrl: base, timeoutMs: 100 });
  assert.equal(image.src, base + "assets/card.webp");
  assert.equal(fixture.requests.length, 1);
});
