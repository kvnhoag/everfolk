import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootEntries = new Set(["client/GameClient.tsx", "client/AdminClient.tsx"]);
const clientLayers = new Set(["screens", "components", "hooks", "queries", "mutations", "models", "lib", "state", "storage", "styles", "types"]);
const featureLayers = new Set(["chain", "demo", "homepage"]);
const featureHttpAdapters = new Set(["chain-backend.ts", "contract.ts", "email-funding.ts", "email-opener.ts", "near-connect-session.ts", "sign-in-config.ts"].map(name => `client/chain/${name}`));
const sourceDirectories = ["app", "client", "db", "server", "src", "worker"];
const codeExtension = /\.(?:ts|tsx|mjs)$/;
const browserGlobals = new Set(["window", "document", "localStorage", "sessionStorage"]);

/** Check source-level boundaries without loading application code or world packs. */
export function inspectModule(relativePath, source) {
  const errors = [];
  const client = relativePath.startsWith("client/");
  const layer = relativePath.split("/")[1];
  const core = relativePath.startsWith("src/");
  const query = relativePath.startsWith("server/queries/") || client && layer === "queries";
  const pureModel = client && layer === "models";
  const reactFree = client && ["queries", "mutations", "models", "lib", "storage", "types"].includes(layer);
  const fail = message => errors.push(`${relativePath}: ${message}`);
  if (client && relativePath.split("/").length === 2 && !rootEntries.has(relativePath)) fail("place code in its responsibility folder; only client entry points belong at the root");
  if (client && relativePath.split("/").length > 2 && !clientLayers.has(layer) && !featureLayers.has(layer)) fail("use a documented responsibility folder under client/");
  if (client && relativePath.endsWith(".tsx") && !["components", "screens"].includes(layer) && !featureLayers.has(layer) && !rootEntries.has(relativePath)) fail("React views belong in components/ or screens/");
  if (client && layer === "hooks" && !/^use[A-Z]/.test(path.posix.basename(relativePath))) fail("hook modules must use a useName filename");

  const ast = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  function dependency(specifier, typeOnly) {
    if (reactFree && /^(?:react|react-dom)(?:\/|$)/.test(specifier)) fail("React belongs in hooks and views");
    if (!specifier.startsWith(".")) return;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), specifier));
    if (core && /^(?:client|server|app|db|worker)\//.test(target)) fail("the simulation must not depend on application layers");
    if (query && /(?:^|\/)mutations\//.test(target)) fail("queries must not depend on mutations");
    if (reactFree && /client\/(?:hooks|components|screens)\//.test(target)) fail("data and model layers must not depend on React orchestration or views");
    if (pureModel && !typeOnly && /^client\/(?:queries|mutations|state|storage|lib)\//.test(target)) fail("models must remain pure; use a hook to orchestrate data access");
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const elements = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
      const typeOnly = clause?.isTypeOnly || !clause?.name && elements.length > 0 && elements.every(element => element.isTypeOnly);
      dependency(node.moduleSpecifier.text, typeOnly);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependency(node.moduleSpecifier.text, node.isTypeOnly);
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) dependency(node.arguments[0].text, false);
      if (client && relativePath !== "client/lib/http.ts" && !featureHttpAdapters.has(relativePath) && (ts.isIdentifier(callee) && callee.text === "fetch" || ts.isPropertyAccessExpression(callee) && callee.name.text === "fetch")) fail("HTTP transport belongs in client/lib/http.ts; expose reads in queries and writes in mutations");
      if (query && ts.isPropertyAccessExpression(callee) && ["setItem", "removeItem", "clear", "run", "batch"].includes(callee.name.text)) fail("queries must not write storage or execute database mutations");
    }
    if ((pureModel || core) && ts.isIdentifier(node) && browserGlobals.has(node.text) &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node)) fail("keep browser access outside deterministic models and simulation");
    if (query && ts.isStringLiteralLike(node) && /^\s*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(node.text)) fail("write SQL belongs in server/mutations/");
    if (query && ts.isPropertyAssignment(node) && node.name.getText(ast).replace(/["']/g, "") === "method" && ts.isStringLiteral(node.initializer) && !["GET", "HEAD"].includes(node.initializer.text.toUpperCase())) fail("HTTP writes belong in client/mutations/");
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...new Set(errors)];
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(filename) : [filename];
  });
}

export function checkStructure(root) {
  const errors = [];
  for (const filename of sourceDirectories.flatMap(name => filesIn(path.join(root, name)))) {
    const relativePath = path.relative(root, filename).split(path.sep).join("/");
    if (relativePath.startsWith("client/") && filename.endsWith(".css") && !relativePath.startsWith("client/styles/") && !featureLayers.has(relativePath.split("/")[1])) errors.push(`${relativePath}: styles belong in client/styles/`);
    if (!codeExtension.test(filename)) continue;
    const source = readFileSync(filename, "utf8");
    errors.push(...inspectModule(relativePath, source));
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
    function checkImport(node) {
      const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), specifier.text);
        if (![target, ...[".ts", ".tsx", ".json", "/index.ts", "/index.tsx"].map(ext => target + ext)].some(candidate => existsSync(candidate))) errors.push(`${relativePath}: unresolved module ${specifier.text}`);
      }
      ts.forEachChild(node, checkImport);
    }
    checkImport(ast);
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const errors = checkStructure(root);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else console.log("Folder structure and dependency boundaries passed.");
}
