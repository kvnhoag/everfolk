import http from "node:http";
import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// A local browser build of the actual game and its test screens. This avoids
// requiring Cloudflare services merely to try browser-local life simulation.
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const previewRoot = path.join(projectRoot, ".sites-runtime", "lives-preview");
const sourceRoot = path.join(previewRoot, "source");
const outputRoot = path.join(previewRoot, "dist");
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex < 0 ? 5175 : Number(args[portIndex + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose a local preview port between 1024 and 65535.");
const packIndex = args.indexOf("--world-pack");
const packPath = packIndex < 0 ? undefined : path.resolve(projectRoot, args[packIndex + 1] ?? "");
const noBuild = args.includes("--no-build");
const buildOnly = args.includes("--build-only");
const valueArguments = new Set([...(portIndex >= 0 ? [portIndex, portIndex + 1] : []), ...(packIndex >= 0 ? [packIndex, packIndex + 1] : [])]);
const known = args.filter((_, index) => !valueArguments.has(index));
if (known.some(arg => !["--no-build", "--build-only"].includes(arg))) throw new Error("Options: --port NUMBER, --world-pack FILE, --no-build, --build-only.");
const { validateWorld } = await import("../src/validate.ts");
const selectedPack = JSON.parse(await readFile(packPath ?? path.join(projectRoot, "worlds", "alexandria-sample.json"), "utf8"));
validateWorld(selectedPack);

const entryNames = ["game", "royalty", "aristocrat"];
const entryFiles = Object.fromEntries(entryNames.map(name => [name, path.join(sourceRoot, `${name}.html`)]));

async function prepareBuild() {
  await mkdir(sourceRoot, { recursive: true });
  for (const name of entryNames) {
    const title = name === "game" ? "Everfolk" : name === "royalty" ? "Royal council test · Everfolk" : "Aristocratic estate test · Everfolk";
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><div id="root"></div><script type="module" src="./${name}.tsx"></script></body></html>\n`;
    const component = name === "game" ? "GameClient" : "RoyaltyTestScreen";
    const componentPath = name === "game" ? "../../../client/GameClient.tsx" : "../../../client/screens/RoyaltyTestScreen.tsx";
    const attributes = name === "aristocrat" ? ' initialPreset="aristocrat-comfortable"' : "";
    const source = `import React from "react";\nimport { createRoot } from "react-dom/client";\nimport ${component} from "${componentPath}";\nimport "../../../client/styles/styles.css";\ncreateRoot(document.getElementById("root")).render(<${component}${attributes} />);\n`;
    await writeFile(entryFiles[name], html);
    await writeFile(path.join(sourceRoot, `${name}.tsx`), source);
  }
  const [{ build }, { default: react }] = await Promise.all([import("vite"), import("@vitejs/plugin-react")]);
  await build({
    configFile: false,
    root: projectRoot,
    plugins: [
      ...(packPath ? [{ name: "local-preview-world", enforce: "pre", resolveId(source) {
        if (/[/\\]worlds[/\\]alexandria-sample\.json$/.test(source)) return packPath;
      } }] : []),
      react(),
    ],
    publicDir: path.join(projectRoot, "public"),
    build: { outDir: outputRoot, emptyOutDir: true, rollupOptions: { input: entryFiles } },
  });
}

if (!noBuild) await prepareBuild();
if (buildOnly) process.exit(0);

const { getBuiltinCatalog, getArchivedBuiltinWorld, worldSummary } = await import("../server/content.ts");
const { contentFingerprint } = await import("../src/random.ts");
const selected = getBuiltinCatalog(selectedPack).worlds[0];
const builtin = { id: selected.id, revisionId: `pack-${contentFingerprint(selected.pack)}`, pack: selected.pack, routes: selected.routes };
const publication = { revision: 0, publicationId: `local-${builtin.revisionId}`, publishedAt: null, worlds: [worldSummary(builtin)] };
const pageFiles = new Map([
  ["/", "game"], ["/test-royalty", "royalty"], ["/test-royalty/", "royalty"],
  ["/test-aristocrat", "aristocrat"], ["/test-aristocrat/", "aristocrat"],
]);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ico": "image/x-icon" };

function json(request, response, value, status = 200) {
  const data = JSON.stringify(value);
  response.writeHead(status, { "content-type": types[".json"], "content-length": Buffer.byteLength(data), "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(request.method === "HEAD" ? undefined : data);
}

async function handle(request, response) {
  try {
    if (!["GET", "HEAD"].includes(request.method ?? "")) return json(request, response, { error: "This local preview provides read-only content APIs." }, 405);
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    if (pathname === "/api/session") return json(request, response, { authenticated: false, isAdmin: false });
    if (pathname === "/api/worlds") return json(request, response, publication);
    if (pathname === `/api/worlds/${builtin.id}`) return json(request, response, builtin);
    if (pathname.startsWith("/api/revisions/")) {
      const id = pathname.slice("/api/revisions/".length);
      const world = id === builtin.revisionId ? builtin : getArchivedBuiltinWorld(id);
      return json(request, response, world ?? { error: "This world revision was not found." }, world ? 200 : 404);
    }
    if (pathname.startsWith("/api/")) return json(request, response, { error: "This API is not available in the local play preview." }, 404);
    const entry = pageFiles.get(pathname);
    const file = entry ? path.join(outputRoot, path.relative(projectRoot, entryFiles[entry])) : path.resolve(outputRoot, `.${pathname}`);
    const withinRoot = file.startsWith(`${outputRoot}${path.sep}`);
    if (!withinRoot) { response.writeHead(403).end("Forbidden"); return; }
    const info = await stat(file);
    if (!info.isFile()) { response.writeHead(404).end("Not found"); return; }
    const data = await readFile(file);
    response.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "content-length": data.length, "cache-control": "no-store", "x-content-type-options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch (error) {
    const status = error instanceof URIError ? 400 : error?.code === "ENOENT" ? 404 : 500;
    response.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(status === 404 ? "Preview file not found." : "The local preview could not complete this request.");
  }
}

const servers = [];
try {
  for (const host of ["127.0.0.1", "::1"]) {
    const server = http.createServer(handle);
    servers.push(server);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port, host, ipv6Only: host === "::1" }, resolve);
    });
  }
} catch (error) {
  for (const server of servers) server.close();
  throw error;
}
for (const event of ["SIGINT", "SIGTERM"]) process.once(event, () => {
  for (const server of servers) server.close();
});
console.log(`Everfolk ${builtin.pack.version}: http://localhost:${port}/`);
console.log(`Royal test: http://localhost:${port}/test-royalty`);
console.log(`Aristocrat test: http://localhost:${port}/test-aristocrat`);
