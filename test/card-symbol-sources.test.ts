import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

interface SymbolSource {
  figureId: string;
  iconName: string;
  author: string;
  authorUrl: string;
  pageUrl: string;
  downloadUrl: string;
  license: string;
  licenseUrl: string;
  path: string;
  publicPath: string;
  sha256: string;
  viewBox: number[];
  originalPreserved: boolean;
}
const credits = JSON.parse(readFileSync(new URL("../public/assets/cards/collection-v14/icon-credits.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../client/models/card-art-registry.json", import.meta.url), "utf8"));
const icons = credits.icons as SymbolSource[];
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("all thirteen figure symbols have professional immutable sources and author licences", () => {
  assert.equal(icons.length, 13);
  assert.deepEqual(icons.map(icon => icon.figureId).sort(), registry.assets.filter((asset: { kind: string }) => asset.kind === "parent").map((asset: { figureId: string }) => asset.figureId).sort());
  for (const icon of icons) {
    assert.ok(icon.iconName && icon.author && icon.authorUrl && icon.pageUrl && icon.licenseUrl);
    assert.equal(icon.originalPreserved, true);
    const download = new URL(icon.downloadUrl);
    assert.equal(download.hostname, "raw.githubusercontent.com");
    if (icon.figureId === "euclid") {
      assert.equal(icon.author, "Google");
      assert.equal(icon.license, "Apache-2.0");
      assert.match(download.pathname, /^\/google\/material-design-icons\/[a-f0-9]{40}\/src\/social\/architecture\/materialicons\/24px\.svg$/);
      assert.match(icon.iconName, /drafting compass/);
    } else {
      assert.ok(["Lorc", "Delapouite"].includes(icon.author));
      assert.equal(icon.license, "CC BY 3.0");
      assert.match(download.pathname, /^\/game-icons\/icons\/[a-f0-9]{40}\/(?:lorc|delapouite)\/[a-z-]+\.svg$/);
      assert.equal(new URL(icon.pageUrl).hostname, "game-icons.net");
    }
  }
});

test("published original SVGs retain their downloaded hashes and contain no active content", () => {
  for (const icon of icons) {
    assert.equal(icon.publicPath, `/assets/cards/collection-v14/symbols/${icon.figureId}.svg`);
    const bytes = readFileSync(new URL("../public" + icon.publicPath, import.meta.url));
    assert.equal(sha(bytes), icon.sha256, icon.figureId);
    const svg = bytes.toString("utf8");
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<path\b/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|<image\b|\bon\w+\s*=/i);
    const view = svg.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
    assert.deepEqual(view, icon.viewBox);
  }
});

test("the human credits page exposes every symbol's creator, original source and licence", () => {
  const html = readFileSync(new URL("../public/assets/cards/collection-v14/icon-credits.html", import.meta.url), "utf8");
  assert.match(html, /Card symbols &amp; credits/);
  assert.equal((html.match(/<article>/g) ?? []).length, 13);
  for (const icon of icons) {
    assert.ok(html.includes(`src="symbols/${icon.figureId}.svg"`));
    assert.ok(html.includes(`href="${icon.authorUrl}"`));
    assert.ok(html.includes(`href="${icon.pageUrl}"`));
    assert.ok(html.includes(`href="${icon.licenseUrl}"`));
  }
  assert.ok(readFileSync(new URL("../public/assets/cards/collection-v14/symbols/CC-BY-3.0.txt", import.meta.url), "utf8").includes("Lorc"));
  assert.ok(readFileSync(new URL("../public/assets/cards/collection-v14/symbols/Apache-2.0.txt", import.meta.url), "utf8").includes("Apache License"));
});
