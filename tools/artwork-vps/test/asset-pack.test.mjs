import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildRelease, verifyRelease } from "../bin/asset-pack.mjs";

const verifier = fileURLToPath(new URL("../bin/verify-release.py", import.meta.url));
const python = process.env.ARTWORK_PYTHON || "python3";
const pythonProbe = spawnSync(python, ["--version"], { encoding: "utf8" });
const pythonAvailable = !pythonProbe.error && pythonProbe.status === 0;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "everfolk-art-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const out = path.join(root, "out");
  fs.mkdirSync(source);
  return { root, source, out, release: "fixture-v1" };
}
function write(root, relative, content = "fixture image bytes\n") {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function loadManifest(directory) { return JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8")); }
function alterManifest(directory, change) {
  const value = loadManifest(directory);
  change(value);
  fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(value));
}
function pythonVerify(directory) { return spawnSync(python, [verifier, "verify", "--dir", directory], { encoding: "utf8" }); }

test("explicit public selection preserves bytes and reports omitted formats", t => {
  const input = fixture(t);
  const bytes = Buffer.from([0, 255, 100, 13, 10, 42]);
  write(input.source, "cards/a.webp", bytes);
  write(input.source, "cards/master.vectorcraft", "editable native source");
  write(input.source, "script.js", "executable source stays private");
  const result = buildRelease({ ...input, kind: "public", selectPublic: true });
  assert.equal(result.files, 1);
  assert.equal(result.bytes, bytes.length);
  assert.equal(result.excluded.files, 2);
  assert.deepEqual(result.excluded.paths, ["cards/master.vectorcraft", "script.js"]);
  assert.deepEqual(fs.readFileSync(path.join(result.directory, "payload/cards/a.webp")), bytes);
  assert.deepEqual(fs.readFileSync(path.join(input.source, "cards/a.webp")), bytes);
  assert.equal(loadManifest(result.directory).files[0].sha256, createHash("sha256").update(bytes).digest("hex"));
});

test("public builds reject unsupported content unless explicitly selecting", t => {
  const input = fixture(t);
  write(input.source, "script.js", "alert(1)");
  assert.throws(() => buildRelease({ ...input, kind: "public" }), /Unsupported public file type/);
  assert.equal(fs.existsSync(path.join(input.out, input.release)), false);
});

test("public releases support existing @2x filenames and uppercase media extensions", t => {
  const input = fixture(t);
  write(input.source, "branding/everfolk-wordmark-cream@2x.png", "actual path fixture");
  write(input.source, "branding/alternate@2x.PNG", "uppercase extension fixture");
  const result = buildRelease({ ...input, kind: "public" });
  assert.equal(result.files, 2);
  assert.equal(verifyRelease(result.directory).passed, true);
  if (pythonAvailable) {
    const checked = pythonVerify(result.directory);
    assert.equal(checked.status, 0, checked.stderr);
    assert.deepEqual(JSON.parse(checked.stdout), verifyRelease(result.directory));
  }
});

test("@ is rejected at the start of any public path segment", t => {
  const input = fixture(t);
  write(input.source, "branding/@2x.png");
  assert.throws(() => buildRelease({ ...input, kind: "public" }), /safe ASCII/);
});

test("private releases preserve source code, Unicode paths, spaces and provenance", t => {
  const input = fixture(t);
  write(input.source, "Source art/élan.cjs", "module.exports = 'editable source';\n");
  write(input.source, "Source art/provenance.json", '{"status":"awaiting review"}');
  write(input.source, "Source art/😀.png", "unicode path bytes");
  const result = buildRelease({ ...input, kind: "private" });
  assert.equal(result.files, 3);
  assert.equal(verifyRelease(result.directory).passed, true);
});

test("private packing rejects credential material and local dependency trees", t => {
  for (const relative of [".env.production", "work/id_ed25519", "work/certificate.key", "node_modules/pkg/a.png", "work/.aws/config"]) {
    const sub = fs.mkdtempSync(path.join(os.tmpdir(), "everfolk-secret-test-"));
    t.after(() => fs.rmSync(sub, { recursive: true, force: true }));
    const source = path.join(sub, "source");
    fs.mkdirSync(source);
    write(source, relative);
    assert.throws(() => buildRelease({ kind: "private", source, out: path.join(sub, "out"), release: "test-v1" }), /Secret or local-only/);
  }
});

test("release identifiers and nested output paths cannot escape the chosen root", t => {
  const input = fixture(t);
  write(input.source, "a.png");
  assert.throws(() => buildRelease({ ...input, kind: "public", release: "../escape" }), /--release/);
  assert.throws(() => buildRelease({ ...input, kind: "public", out: path.join(input.source, "output") }), /outside source/);
});

test("an existing release is immutable", t => {
  const input = fixture(t);
  write(input.source, "a.png", "first bytes");
  const result = buildRelease({ ...input, kind: "public" });
  write(input.source, "a.png", "replacement bytes");
  assert.throws(() => buildRelease({ ...input, kind: "public" }), /already exists/);
  assert.equal(fs.readFileSync(path.join(result.directory, "payload/a.png"), "utf8"), "first bytes");
});

test("verification can pin the trusted manifest hash independently of its contents", t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  assert.equal(verifyRelease(result.directory, { expectedManifestSha256: result.manifestSha256 }).passed, true);
  assert.throws(() => verifyRelease(result.directory, { expectedManifestSha256: "0".repeat(64) }), /pinned revision/);
});

test("tampering, missing files, extra files and incomplete builds fail verification", t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  const image = path.join(result.directory, "payload/a.png");
  const original = fs.readFileSync(image);
  fs.writeFileSync(image, "altered");
  assert.throws(() => verifyRelease(result.directory), /Integrity mismatch/);
  fs.writeFileSync(image, original);
  write(result.directory, "payload/extra.png");
  assert.throws(() => verifyRelease(result.directory), /file count/);
  fs.unlinkSync(path.join(result.directory, "payload/extra.png"));
  fs.unlinkSync(image);
  assert.throws(() => verifyRelease(result.directory), /file count/);
  fs.writeFileSync(image, original);
  write(result.directory, ".incomplete");
  assert.throws(() => verifyRelease(result.directory), /only manifest/);
});

test("untrusted manifest traversal and invalid hashes are rejected", t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  const original = loadManifest(result.directory);
  alterManifest(result.directory, manifest => { manifest.files[0].path = "../outside.png"; });
  assert.throws(() => verifyRelease(result.directory), /Unsafe/);
  fs.writeFileSync(path.join(result.directory, "manifest.json"), JSON.stringify(original));
  alterManifest(result.directory, manifest => { manifest.files[0].sha256 = "not-a-hash"; });
  assert.throws(() => verifyRelease(result.directory), /size\/hash/);
});

test("public files larger than the initial 25 MiB policy are rejected", t => {
  const input = fixture(t);
  const target = write(input.source, "large.png", "");
  fs.truncateSync(target, 25 * 1024 * 1024 + 1);
  assert.throws(() => buildRelease({ ...input, kind: "public" }), /25 MiB/);
});

test("a symlink/junction source cannot smuggle files into a release", t => {
  const input = fixture(t);
  const external = path.join(input.root, "external");
  fs.mkdirSync(external);
  write(external, "a.png");
  try { fs.symlinkSync(external, path.join(input.source, "linked"), process.platform === "win32" ? "junction" : "dir"); }
  catch (error) { if (error.code === "EPERM" || error.code === "ENOSYS") { t.skip("OS does not permit test symlinks"); return; } throw error; }
  assert.throws(() => buildRelease({ ...input, kind: "public" }), /Symlink\/junction/);
});

test("case-colliding directories are rejected on case-sensitive filesystems", t => {
  const input = fixture(t);
  write(input.source, "A/x.png");
  write(input.source, "a/y.png");
  if (fs.readdirSync(input.source).length !== 2) { t.skip("Case-insensitive test filesystem"); return; }
  assert.throws(() => buildRelease({ ...input, kind: "public" }), /directory collision/);
});

test("Python accepts a Node-generated Unicode private release", { skip: !pythonAvailable && "Set ARTWORK_PYTHON to Python 3.10+" }, t => {
  const input = fixture(t);
  write(input.source, "source/é.png");
  write(input.source, "source/😀.png");
  write(input.source, "source/\ue000.png");
  const result = buildRelease({ ...input, kind: "private" });
  const checked = pythonVerify(result.directory);
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout), verifyRelease(result.directory));
});

test("Python rejects unsafe manifest paths, corruption and extra payload files", { skip: !pythonAvailable && "Set ARTWORK_PYTHON to Python 3.10+" }, t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  const original = loadManifest(result.directory);
  alterManifest(result.directory, manifest => { manifest.files[0].path = "../outside.png"; });
  assert.notEqual(pythonVerify(result.directory).status, 0);
  fs.writeFileSync(path.join(result.directory, "manifest.json"), JSON.stringify(original));
  write(result.directory, "payload/a.png", "corrupt");
  assert.notEqual(pythonVerify(result.directory).status, 0);
  write(result.directory, "payload/extra.png");
  assert.notEqual(pythonVerify(result.directory).status, 0);
});

test("Python enforces expected kind and immutable release ID before promotion", { skip: !pythonAvailable && "Set ARTWORK_PYTHON to Python 3.10+" }, t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  for (const options of [["--kind", "private"], ["--release", "other-v1"]]) {
    const checked = spawnSync(python, [verifier, "verify", "--dir", result.directory, ...options], { encoding: "utf8" });
    assert.notEqual(checked.status, 0);
    assert.match(checked.stderr, /does not match/);
  }
});

test("server publishing requires the trusted local manifest hash in its CLI", { skip: !pythonAvailable && "Set ARTWORK_PYTHON to Python 3.10+" }, () => {
  const response = spawnSync(python, [verifier, "publish", "--kind", "public", "--release", "test-v1", "--incoming", "/untrusted/upload"], { encoding: "utf8" });
  assert.notEqual(response.status, 0);
  assert.match(response.stderr, /required.*--manifest-sha256/);
});

test("Python verifies a pinned manifest hash and rejects a substituted manifest", { skip: !pythonAvailable && "Set ARTWORK_PYTHON to Python 3.10+" }, t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  let response = spawnSync(python, [verifier, "verify", "--dir", result.directory, "--manifest-sha256", result.manifestSha256], { encoding: "utf8" });
  assert.equal(response.status, 0, response.stderr);
  alterManifest(result.directory, manifest => { manifest.createdAt = "2026-01-01T00:00:00.000Z"; });
  response = spawnSync(python, [verifier, "verify", "--dir", result.directory, "--manifest-sha256", result.manifestSha256], { encoding: "utf8" });
  assert.notEqual(response.status, 0);
  assert.match(response.stderr, /pinned revision/);
});

test("Linux root publisher promotes atomically, preserves incoming and refuses overwrite", { skip: process.platform !== "linux" || process.getuid?.() !== 0 || !pythonAvailable }, t => {
  const input = fixture(t);
  write(input.source, "a.png");
  const result = buildRelease({ ...input, kind: "public" });
  // Publisher intentionally requires a protected ancestor chain, so use /root.
  const data = fs.mkdtempSync("/root/everfolk-art-publish-test-");
  t.after(() => fs.rmSync(data, { recursive: true, force: true }));
  fs.chmodSync(data, 0o711);
  write(data, ".everfolk-art-data-v1", ".everfolk-art-data-v1\n");
  const args = [verifier, "publish", "--data-root", data, "--incoming", result.directory, "--kind", "public", "--release", input.release, "--reserve-bytes", "0", "--manifest-sha256", result.manifestSha256];
  const wrongHashArgs = [...args.slice(0, -1), "0".repeat(64)];
  const refused = spawnSync(python, wrongHashArgs, { encoding: "utf8" });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /pinned revision/);
  assert.equal(fs.existsSync(path.join(data, "public/releases", input.release)), false);
  let response = spawnSync(python, args, { encoding: "utf8" });
  assert.equal(response.status, 0, response.stderr);
  const published = path.join(data, "public/releases", input.release);
  assert.equal(verifyRelease(published).passed, true);
  assert.equal(fs.existsSync(result.directory), true);
  response = spawnSync(python, args, { encoding: "utf8" });
  assert.notEqual(response.status, 0);
  assert.match(response.stderr, /already exists/);
});


test("trusted web exports preserve SVG, CSS, JSON, HTML and license bytes", { skip: !pythonAvailable }, t => {
  const input = fixture(t);
  const exports = {
    "assets/banner.svg": '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gold"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#gold)"/></svg>',
    "fonts/type.css": '@font-face{font-family:Demo;src:url("./demo.woff2")}body{color:#123}',
    "fonts/demo.ttf": "trusted font fixture",
    "assets/manifest.json": '{"approved":true,"files":["banner.svg"]}',
    "assets/credits.html": '<!doctype html><html><head><style>body{color:#123}</style></head><body><img src="banner.svg"><a href="https://example.com/license">License</a></body></html>',
    "assets/ATTRIBUTION.md": "# Attribution\nOriginal source and license preserved.\n",
    "fonts/OFL.txt": "Original license\n"
  };
  for (const [relative, bytes] of Object.entries(exports)) write(input.source, relative, bytes);
  const result = buildRelease({ ...input, kind: "public" });
  assert.equal(result.files, Object.keys(exports).length);
  for (const [relative, bytes] of Object.entries(exports)) assert.equal(fs.readFileSync(path.join(result.directory, "payload", relative), "utf8"), bytes);
  const checked = pythonVerify(result.directory);
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout), verifyRelease(result.directory));
});

test("active web exports are rejected before publication", { skip: !pythonAvailable }, t => {
  const unsafe = [
    ["bad.svg", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["bad.svg", '<?xml-stylesheet href="https://evil.test/style.css"?><svg/>'],
    ["bad.svg", '<!DOCTYPE svg [<!ENTITY x "payload">]><svg><title>&x;</title></svg>'],
    ["bad.svg", '<svg onload="alert(1)"/>'],
    ["bad.svg", '<svg xml:base="https://evil.test/"><rect/></svg>'],
    ["bad.svg", '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>'],
    ["bad.svg", '<svg><rect fill="url(https://evil.test/image)"/></svg>'],
    ["bad.css", 'body{background:u\\72l(javascript:alert(1))}'],
    ["bad.css", '@import "https://evil.test/style.css";'],
    ["bad.css", 'body{background:url(javascript:alert(1))}'],
    ["bad.html", '<html><script>alert(1)</script></html>'],
    ["bad.html", '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
    ["bad.html", '<a href="java&#x0a;script:alert(1)">click</a>'],
    ["bad.html", '<img src="ok.png" onerror="alert(1)">'],
    ["bad.html", '<base href="https://evil.test/">'],
    ["bad.json", '{"a":1,"a":2}'],
    ["bad.json", '{"x":NaN}']
  ];
  for (const [relative, bytes] of unsafe) {
    const input = fixture(t);
    write(input.source, relative, bytes);
    const direct = spawnSync(python, [verifier, "validate-public", "--dir", input.source], { encoding: "utf8" });
    assert.notEqual(direct.status, 0, relative + " unexpectedly passed Python policy");
    assert.throws(() => buildRelease({ ...input, kind: "public" }), /Public web export validation failed/);
  }
});
