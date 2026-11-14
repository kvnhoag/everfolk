/** Public image delivery keeps authored paths stable while optionally preferring a CDN. */
export interface ArtworkImageSources {
  readonly primary: string;
  readonly fallback?: string;
  readonly localPath?: string;
}

export const ARTWORK_CDN_TIMEOUT_MS = 8_000;

export function normalizeArtworkBaseUrl(value?: string): string | undefined {
  const supplied = value?.trim();
  if (!supplied) return undefined;
  const base = new URL(supplied);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((base.protocol !== "https:" && !(base.protocol === "http:" && loopback)) ||
      base.username || base.password || base.search || base.hash) {
    throw new Error("Artwork delivery requires an HTTPS release URL without credentials, query or fragment.");
  }
  base.pathname = base.pathname.replace(/\/*$/, "/");
  if (!/^\/releases\/[a-z0-9][a-z0-9-]{0,63}\/payload\/$/.test(base.pathname)) {
    throw new Error("Artwork delivery must use /releases/<release-id>/payload/.");
  }
  return base.href;
}

export function configuredArtworkBaseUrl(): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_EVERFOLK_ASSET_BASE_URL;
}

function authoredImagePath(source: string): URL | undefined {
  if (!source.startsWith("/assets/") || source.includes("\\")) return undefined;
  try {
    const parsed = new URL(source, "https://local-artwork.invalid");
    const decoded = decodeURIComponent(parsed.pathname);
    if (!parsed.pathname.startsWith("/assets/") || /[\u0000-\u001f\u007f\\]/.test(decoded) ||
        decoded.split("/").slice(1).some(part => !part || part === "." || part === "..")) return undefined;
    return parsed;
  } catch { return undefined; }
}

/** External, data and blob media are left alone. An invalid/unset CDN keeps local delivery. */
export function artworkImageSources(source: string, baseUrl = configuredArtworkBaseUrl()): ArtworkImageSources {
  let base: string | undefined;
  try { base = normalizeArtworkBaseUrl(baseUrl); }
  catch { return { primary: source }; }
  if (!base) return { primary: source };
  let original = source;
  // A URL already retrieved from this pinned release still has its original local fallback.
  if (source.startsWith(base)) original = "/" + source.slice(base.length);
  const parsed = authoredImagePath(original);
  if (!parsed) return { primary: source };
  const target = new URL(parsed.pathname.slice(1), base);
  target.hash = parsed.hash;
  if (target.href === original) return { primary: original };
  return { primary: target.href, fallback: original, localPath: parsed.pathname };
}

export function artworkImageTimeout(value?: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= 60_000
    ? value : ARTWORK_CDN_TIMEOUT_MS;
}

/** Canvas/WebGL reads use anonymous CORS for every attempt and never resolve a failed CDN image. */
export function loadArtworkImage(
  ImageConstructor: new () => HTMLImageElement,
  source: string,
  options: { baseUrl?: string; timeoutMs?: number } = {},
): Promise<HTMLImageElement> {
  const sources = artworkImageSources(source, options.baseUrl);
  const attempts = sources.fallback ? [sources.primary, sources.fallback] : [sources.primary];
  const timeoutMs = artworkImageTimeout(options.timeoutMs);
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const begin = () => {
      const image = new ImageConstructor();
      let finished = false;
      let timer: ReturnType<typeof setTimeout>;
      const detach = () => { clearTimeout(timer); image.onload = null; image.onerror = null; };
      const fail = () => {
        if (finished) return;
        finished = true; detach();
        // Cancel an abandoned request without fetching an empty relative URL.
        image.src = "data:,";
        attempt++;
        if (attempt < attempts.length) begin();
        else reject(Error("Artwork could not be loaded."));
      };
      image.crossOrigin = "anonymous";
      image.onload = () => { if (!finished) { finished = true; detach(); resolve(image); } };
      image.onerror = fail;
      timer = setTimeout(fail, timeoutMs);
      image.src = attempts[attempt];
    };
    begin();
  });
}
