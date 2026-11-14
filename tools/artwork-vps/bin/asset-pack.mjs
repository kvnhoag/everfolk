#!/usr/bin/env node
/** Byte-preserving, offline release packing. Node.js 24+, no dependencies. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RELEASE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const PUBLIC_EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".avif", ".gif", ".ico", ".woff", ".woff2", ".mp3", ".ogg", ".wav", ".ttf", ".otf", ".svg", ".css", ".json", ".txt", ".md", ".html"]);
const TEXT_EXPORT_EXTENSIONS = new Set([".svg", ".css", ".json", ".txt", ".md", ".html"]);
const MAX_PUBLIC_FILE_BYTES = 25 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;
const BLOCKED_DIRS = new Set([".git", ".ssh", ".aws", ".azure", ".codex", ".agents", "node_modules", "__pycache__", ".cache", ".venv", "venv"]);
const SECRET_NAMES = /^(?:\.env(?:[.-].*)?|\.npmrc|\.pypirc|\.netrc|id_rsa(?:\.pub)?|id_ed25519(?:\.pub)?|credentials(?:\.[^.]+)?|secrets?(?:\.[^.]+)?)$/i;
const KEY_EXTENSIONS = /\.(?:pem|p12|pfx|key|keystore)$/i;
const need = (condition, message) => { if (!condition) throw new Error(message); };
const comparePaths = (a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));

export function validateRelativePath(value, kind) {
  need(typeof value === "string" && value.length > 0 && value.length <= 4096, "Invalid payload path");
  need(value.normalize("NFC") === value, `Path must use NFC Unicode: ${value}`);
  need(!/[\uD800-\uDFFF]/u.test(value), "Payload paths cannot contain unpaired Unicode surrogates");
  need(!value.includes("\\") && !value.startsWith("/") && !/[\x00-\x1f\x7f<>:"|?*]/u.test(value), `Unsafe payload path: ${value}`);
  const segments = value.split("/");
  for (const part of segments) {
    need(part && part !== "." && part !== ".." && !/[. ]$/u.test(part), `Unsafe path segment: ${value}`);
    need(!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part), `Non-portable path: ${value}`);
    need(!BLOCKED_DIRS.has(part.toLowerCase()) && !SECRET_NAMES.test(part) && !KEY_EXTENSIONS.test(part), `Secret or local-only path rejected: ${value}`);
    if (kind === "public") need(!part.startsWith("."), `Hidden public path rejected: ${value}`);
  }
  if (kind === "public") {
    need(segments.every(part => /^[A-Za-z0-9_-][A-Za-z0-9_.@-]*$/.test(part)), `Public paths must use safe ASCII with no leading dots or @: ${value}`);
    need(PUBLIC_EXTENSIONS.has(path.posix.extname(value).toLowerCase()), `Unsupported public file type: ${value}`);
  }
  return value;
}

function rejectSymlinkAncestors(absolute) {
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) break;
    need(!fs.lstatSync(cursor).isSymbolicLink(), `Symlink/junction is not allowed: ${cursor}`);
  }
}

function inventory(root, kind, selectPublic = false) {
  const files = [];
  const excluded = [];
  const collisionKeys = new Set();
  const directoryKeys = new Map();
  function visit(directory, relative = "") {
    for (const name of fs.readdirSync(directory).sort()) {
      const rel = relative ? `${relative}/${name}` : name;
      const absolute = path.join(directory, name);
      const info = fs.lstatSync(absolute);
      need(!info.isSymbolicLink(), `Symlink/junction is not allowed: ${rel}`);
      need(info.isFile() || info.isDirectory(), `Special file is not allowed: ${rel}`);
      if (info.isDirectory()) {
        // Validate directory names independently of a public filename extension.
        validateRelativePath(`${rel}/placeholder.png`, kind);
        const directoryKey = rel.toLowerCase();
        need(!directoryKeys.has(directoryKey) || directoryKeys.get(directoryKey) === rel, `Case-insensitive directory collision: ${rel}`);
        directoryKeys.set(directoryKey, rel);
        visit(absolute, rel);
      } else {
        if (kind === "public" && selectPublic && !PUBLIC_EXTENSIONS.has(path.extname(name).toLowerCase())) {
          // Explicit opt-in selection only; report all excluded names to the operator.
          excluded.push({ path: rel, bytes: info.size });
          continue;
        }
        validateRelativePath(rel, kind);
        need(Number.isSafeInteger(info.size) && info.size >= 0, `Unsupported file size: ${rel}`);
        if (kind === "public") need(info.size <= MAX_PUBLIC_FILE_BYTES, `Public file exceeds 25 MiB: ${rel}`);
        const key = rel.toLowerCase();
        need(!collisionKeys.has(key), `Case-insensitive path collision: ${rel}`);
        collisionKeys.add(key);
        files.push({ path: rel, absolute, bytes: info.size });
      }
    }
  }
  visit(root);
  files.sort((a, b) => comparePaths(a.path, b.path));
  return { files, excluded };
}

function streamHash(file, outputFile) {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0);
  const input = fs.openSync(file, flags);
  let output;
  try {
    const before = fs.fstatSync(input, { bigint: true });
    need(before.isFile(), `Not a regular file: ${file}`);
    if (outputFile) output = fs.openSync(outputFile, "wx", 0o600);
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let bytes = 0;
    for (;;) {
      const count = fs.readSync(input, buffer, 0, buffer.length, null);
      if (!count) break;
      hash.update(buffer.subarray(0, count));
      if (output !== undefined) {
        let written = 0;
        while (written < count) written += fs.writeSync(output, buffer, written, count - written);
      }
      bytes += count;
    }
    const after = fs.fstatSync(input, { bigint: true });
    need(before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs && BigInt(bytes) === after.size, `Source changed while reading: ${file}`);
    if (output !== undefined) fs.fsyncSync(output);
    return { bytes, sha256: hash.digest("hex") };
  } finally {
    fs.closeSync(input);
    if (output !== undefined) fs.closeSync(output);
  }
}

export function buildRelease({ kind, source, out, release, selectPublic = false }) {
  need(kind === "public" || kind === "private", "--kind must be public or private");
  need(RELEASE_ID.test(release ?? ""), "--release must match [a-z0-9][a-z0-9-]{0,63}");
  need(!selectPublic || kind === "public", "--select-public is only valid with --kind public");
  need(typeof source === "string" && typeof out === "string", "--source and --out are required");
  const sourceRoot = path.resolve(source);
  const outputRoot = path.resolve(out);
  rejectSymlinkAncestors(sourceRoot);
  rejectSymlinkAncestors(outputRoot);
  need(fs.lstatSync(sourceRoot).isDirectory(), "Source must be a regular directory");
  const destination = path.join(outputRoot, release);
  const relativeOutput = path.relative(sourceRoot, destination);
  need(relativeOutput.startsWith(`..${path.sep}`) || relativeOutput === ".." || path.isAbsolute(relativeOutput), "Output must be outside source");
  need(!fs.existsSync(destination), `Release already exists: ${destination}`);
  const { files, excluded } = inventory(sourceRoot, kind, selectPublic);
  need(files.length > 0, "Release contains no eligible files");
  const manifest = { schemaVersion: 1, kind, releaseId: release, createdAt: new Date().toISOString(), files: [], totals: { files: files.length, bytes: 0 } };
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(destination, { mode: 0o700 });
  // Failed builds are retained for diagnosis and must never be published.
  fs.writeFileSync(path.join(destination, ".incomplete"), "Build is incomplete. Do not upload or publish.\n", { flag: "wx", mode: 0o600 });
  const payload = path.join(destination, "payload");
  fs.mkdirSync(payload, { mode: 0o700 });
  for (const item of files) {
    rejectSymlinkAncestors(item.absolute);
    const target = path.join(payload, ...item.path.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const record = streamHash(item.absolute, target);
    need(record.bytes === item.bytes, `Source size changed: ${item.path}`);
    manifest.files.push({ path: item.path, ...record });
    manifest.totals.bytes += record.bytes;
    need(Number.isSafeInteger(manifest.totals.bytes), "Release total exceeds safe integer range");
  }
  fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  fs.unlinkSync(path.join(destination, ".incomplete"));
  const receipt = verifyRelease(destination);
  return { ...receipt, directory: destination, excluded: { files: excluded.length, bytes: excluded.reduce((n, f) => n + f.bytes, 0), paths: excluded.map(f => f.path) } };
}

export function verifyRelease(directory, { expectedManifestSha256 } = {}) {
  const root = path.resolve(directory);
  rejectSymlinkAncestors(root);
  need(fs.lstatSync(root).isDirectory(), "Release must be a directory");
  const rootNames = fs.readdirSync(root).sort();
  need(JSON.stringify(rootNames) === JSON.stringify(["manifest.json", "payload"]), "Release root must contain only manifest.json and payload/");
  const manifestPath = path.join(root, "manifest.json");
  const manifestInfo = fs.lstatSync(manifestPath);
  need(manifestInfo.isFile() && !manifestInfo.isSymbolicLink() && manifestInfo.size <= MAX_MANIFEST_BYTES, "Invalid manifest file");
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
  if (expectedManifestSha256 !== undefined) {
    need(/^[0-9a-f]{64}$/.test(expectedManifestSha256), "Invalid expected manifest SHA-256");
    need(manifestSha256 === expectedManifestSha256, "Manifest SHA-256 does not match the pinned revision");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  need(manifest && manifest.schemaVersion === 1 && (manifest.kind === "public" || manifest.kind === "private"), "Unsupported manifest schema/kind");
  need(RELEASE_ID.test(manifest.releaseId ?? ""), "Invalid release ID");
  need(typeof manifest.createdAt === "string" && Number.isFinite(Date.parse(manifest.createdAt)), "Invalid createdAt");
  need(Array.isArray(manifest.files) && manifest.files.length > 0, "Manifest must contain files");
  const payload = path.join(root, "payload");
  need(fs.lstatSync(payload).isDirectory() && !fs.lstatSync(payload).isSymbolicLink(), "Invalid payload directory");
  const actual = inventory(payload, manifest.kind).files;
  if (manifest.kind === "public" && actual.some(file => TEXT_EXPORT_EXTENSIONS.has(path.extname(file.path).toLowerCase()))) {
    const validator = fileURLToPath(new URL("./verify-release.py", import.meta.url));
    const checked = spawnSync(process.env.ARTWORK_PYTHON || "python3", [validator, "validate-public", "--dir", payload], { encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024 });
    need(!checked.error && checked.status === 0, `Public web export validation failed: ${checked.error?.message || checked.stderr?.trim() || "Python 3.10+ is required"}`);
  }
  need(actual.length === manifest.files.length, "Payload file count differs from manifest");
  let previous = "";
  let total = 0;
  for (let index = 0; index < manifest.files.length; index++) {
    const record = manifest.files[index];
    need(record && typeof record === "object", "Invalid manifest record");
    validateRelativePath(record.path, manifest.kind);
    need(comparePaths(record.path, previous) > 0, "Manifest file paths must be unique and sorted by UTF-8 bytes");
    previous = record.path;
    need(Number.isSafeInteger(record.bytes) && record.bytes >= 0 && /^[0-9a-f]{64}$/.test(record.sha256 ?? ""), `Invalid size/hash: ${record.path}`);
    need(actual[index].path === record.path, `Unexpected or missing file: ${record.path}`);
    const checked = streamHash(actual[index].absolute);
    need(checked.bytes === record.bytes && checked.sha256 === record.sha256, `Integrity mismatch: ${record.path}`);
    total += checked.bytes;
    need(Number.isSafeInteger(total), "Release total exceeds safe integer range");
  }
  need(manifest.totals?.files === actual.length && manifest.totals?.bytes === total, "Manifest totals do not match");
  return { passed: true, kind: manifest.kind, releaseId: manifest.releaseId, files: actual.length, bytes: total, manifestSha256 };
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    need(["--kind", "--source", "--out", "--release", "--dir", "--select-public", "--manifest-sha256"].includes(key), `Unknown option: ${key}`);
    need(!(key in values), `Duplicate option: ${key}`);
    if (key === "--select-public") values[key] = true;
    else {
      need(args[index + 1] && !args[index + 1].startsWith("--"), `Missing value: ${key}`);
      values[key] = args[++index];
    }
  }
  return values;
}

export function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args;
  if (command === "--help" || command === "help" || !command) {
    console.log("Build: node asset-pack.mjs build --kind public|private --source DIR --out DIR --release ID [--select-public]\nVerify: node asset-pack.mjs verify --dir DIR [--manifest-sha256 SHA256]\nPublic selection explicitly omits unsupported extensions and reports them; default builds reject them. No images are transformed.");
    return;
  }
  const options = parseArguments(rest);
  let result;
  if (command === "build") {
    need(!options["--dir"] && !options["--manifest-sha256"], "--dir and --manifest-sha256 are only valid for verify");
    result = buildRelease({ kind: options["--kind"], source: options["--source"], out: options["--out"], release: options["--release"], selectPublic: options["--select-public"] ?? false });
  } else if (command === "verify") {
    need(Object.keys(options).every(key => ["--dir", "--manifest-sha256"].includes(key)) && typeof options["--dir"] === "string", "verify requires --dir DIR and optional --manifest-sha256 SHA256");
    result = verifyRelease(options["--dir"], { expectedManifestSha256: options["--manifest-sha256"] });
  } else throw new Error(`Unknown command: ${command}`);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`asset-pack: ${error.message}`); process.exitCode = 1; }
}
