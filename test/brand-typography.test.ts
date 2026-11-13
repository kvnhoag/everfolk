import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const TOKEN_FILE = "client/styles/typography.css";
/** Stylesheets that keep their own font stacks: the admin studio. */
const ALLOWLIST = new Set(["client/styles/admin.css"]);
const FAMILY_NAMES = /"[^"]+"|'[^']+'|\b(Georgia|Arial|Consolas|Courier|Eczar|monospace|serif|sans-serif|system-ui)\b/;

function cssFiles(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const sheets = [...cssFiles("client"), ...cssFiles("app")].map(file => ({ file: relative(".", file).replaceAll("\\", "/"), css: readFileSync(join(root, file), "utf8") }));

/** Every `font-family` / `font` declaration outside @font-face blocks, with its file. */
function fontDeclarations(css: string) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@font-face\s*\{[^}]*\}/g, "");
  return [...body.matchAll(/(?<![-\w])(font-family|font)\s*:\s*([^;}]*)/g)].map(match => ({ property: match[1], value: match[2].replace(/\s*!important\s*$/, "").trim() }));
}

/** The family part of a declaration: the whole value for font-family, the tail after size[/line-height] for the shorthand. */
function familyOf({ property, value }: { property: string; value: string }) {
  if (property === "font-family" || value === "inherit") return value;
  const index = value.search(/var\(--|["']|\b(Georgia|Arial|Consolas|Courier|Eczar|monospace|serif|sans-serif|inherit)\b/);
  return index < 0 ? "" : value.slice(index).trim();
}

test("every stylesheet names fonts only through the shared --ef-font-* tokens", () => {
  const offenders: string[] = [];
  for (const { file, css } of sheets) {
    if (file === TOKEN_FILE || ALLOWLIST.has(file)) continue;
    for (const declaration of fontDeclarations(css)) {
      const family = familyOf(declaration);
      if (family === "inherit" || /^var\(--ef-font-(display|body|numeric|wordmark)\)$/.test(family)) continue;
      offenders.push(`${file}: ${declaration.property}: ${declaration.value}`);
    }
  }
  assert.deepEqual(offenders, [], "use var(--ef-font-display|body|numeric|wordmark) from typography.css");
});

test("fonts are self-hosted and declared once, in the typography stylesheet", () => {
  for (const { file, css } of sheets) {
    if (file === TOKEN_FILE || ALLOWLIST.has(file)) continue;
    assert.doesNotMatch(css, /@font-face/, `${file} declares its own @font-face`);
    const customFonts = [...css.matchAll(/--[\w-]+\s*:\s*([^;}]*)/g)].map(match => match[1]).filter(value => FAMILY_NAMES.test(value) && /sans|serif|mono|Caslon|Eczar|DM |Garamond|Vietnam/.test(value));
    assert.deepEqual(customFonts, [], `${file} defines a font stack outside typography.css`);
  }
  const tokens = readFileSync(join(root, TOKEN_FILE), "utf8");
  for (const name of ["--ef-font-display", "--ef-font-body", "--ef-font-numeric", "--ef-font-wordmark"]) assert.match(tokens, new RegExp(`${name}:`));
  const sources = [...tokens.matchAll(/url\("([^"]+)"\)/g)].map(match => match[1]);
  assert.ok(sources.length >= 4);
  for (const source of sources) {
    assert.match(source, /^\/fonts\/[\w-]+\.woff2$/, `${source} must be served from /fonts`);
    assert.ok(existsSync(join(root, "public", source)), `${source} is missing from public/fonts`);
  }
  for (const { file, css } of sheets) assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*["']?https?:/, `${file} loads a font from a CDN`);
  assert.match(readFileSync(join(root, "app/layout.tsx"), "utf8"), /import "\.\.\/client\/styles\/typography\.css";/);
});

const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
    }).outputText };
    return nextLoad(url, context);
  },
});
const { default: Web3Navigation } = await import("../client/chain/Web3Navigation.tsx");
const { default: LoadingScreen } = await import("../client/screens/LoadingScreen.tsx");
hooks.deregister();

test("the Weave, Market, Figures and My lives header shows the Everfolk wordmark lockup", () => {
  const html = renderToStaticMarkup(createElement(Web3Navigation, { backend: null }));
  assert.match(html, /class="web3-brand ef-web3-brand"[^>]*aria-label="Everfolk home"/);
  assert.match(html, /<span class="everfolk-brand" data-tone="cream"><span class="everfolk-wordmark" data-tone="cream"><span class="everfolk-wordmark-letters">Everfolk<\/span><span class="everfolk-wordmark-stop">\.<\/span><\/span><span class="everfolk-brand-tagline">Weaving fates<\/span><\/span>/);
  assert.doesNotMatch(html, /storybook-mark|ef-web3-brand-text|Weaving fates · NEAR/);
});

test("the loading screen pairs the wordmark with the same tagline", () => {
  const html = renderToStaticMarkup(createElement(LoadingScreen, { preview: true }));
  assert.match(html, /everfolk-wordmark-cream\.svg/);
  assert.match(html, /class="everfolk-brand-tagline"[^>]*>Weaving fates</);
});
