/** Verifies Privy access tokens (ES256 JWTs) with WebCrypto against the app's published JWKS. */

const PRIVY_ISSUER = "privy.io";
const JWKS_TTL_MS = 10 * 60_000;
/** An unknown `kid` refetches the JWKS (key rotation), but no more often than this. */
const JWKS_REFRESH_MIN_MS = 60_000;
const CLOCK_SKEW_SECONDS = 60;
const MAX_TOKEN_LENGTH = 8_192;
const MAX_SUBJECT_LENGTH = 256;

export const privyJwksUrl = (appId: string) => `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`;

/** The token is missing, malformed, forged or expired. */
export class InvalidTokenError extends Error {}
/** Privy's signing keys could not be loaded; the token may well be valid. */
export class TokenServiceError extends Error {}

interface Jwk { kty?: string; crv?: string; kid?: string; alg?: string; x?: string; y?: string }
interface CachedKeys { fetchedAt: number; keys: Jwk[] }
interface TokenHeader { alg?: unknown; kid?: unknown }
interface TokenClaims { iss?: unknown; aud?: unknown; sub?: unknown; exp?: unknown; nbf?: unknown; iat?: unknown }

export type VerifyToken = (token: string, appId: string) => Promise<{ userId: string }>;

function decodeSegment(segment: string): Uint8Array {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) throw new InvalidTokenError("Malformed token.");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  try { return Uint8Array.from(atob(base64), char => char.charCodeAt(0)); } catch { throw new InvalidTokenError("Malformed token."); }
}

function decodeJson<T>(segment: string): T {
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeSegment(segment)));
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as T;
  } catch (error) {
    if (error instanceof InvalidTokenError) throw error;
    throw new InvalidTokenError("Malformed token.");
  }
}

function checkClaims(claims: TokenClaims, appId: string, nowSeconds: number): string {
  if (claims.iss !== PRIVY_ISSUER) throw new InvalidTokenError("Token issuer is not Privy.");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(appId)) throw new InvalidTokenError("Token is for another app.");
  if (typeof claims.exp !== "number" || !(claims.exp > nowSeconds)) throw new InvalidTokenError("Token has expired.");
  for (const early of [claims.nbf, claims.iat]) {
    if (early === undefined) continue;
    if (typeof early !== "number" || early > nowSeconds + CLOCK_SKEW_SECONDS) throw new InvalidTokenError("Token is not valid yet.");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > MAX_SUBJECT_LENGTH) {
    throw new InvalidTokenError("Token has no user.");
  }
  return claims.sub;
}

async function verifyWith(jwk: Jwk, signed: Uint8Array, signature: Uint8Array): Promise<boolean> {
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || (jwk.alg !== undefined && jwk.alg !== "ES256")) return false;
  try {
    const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    // JWS ES256 signatures are raw r||s, which is exactly what WebCrypto expects.
    return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature as BufferSource, signed as BufferSource);
  } catch {
    return false;
  }
}

export function createPrivyTokenVerifier(options: { fetch?: typeof fetch; now?: () => Date } = {}): VerifyToken {
  const cache = new Map<string, CachedKeys>();
  const clock = () => (options.now ?? (() => new Date()))().getTime();

  async function loadKeys(appId: string): Promise<Jwk[]> {
    let response: Response;
    try { response = await (options.fetch ?? fetch)(privyJwksUrl(appId), { headers: { accept: "application/json" } }); } catch {
      throw new TokenServiceError("Privy signing keys are unreachable.");
    }
    if (!response.ok) throw new TokenServiceError(`Privy signing keys returned ${response.status}.`);
    const body = (await response.json().catch(() => null)) as { keys?: unknown } | null;
    if (!body || !Array.isArray(body.keys)) throw new TokenServiceError("Privy signing keys are malformed.");
    const keys = body.keys.filter((key): key is Jwk => key !== null && typeof key === "object");
    cache.set(appId, { fetchedAt: clock(), keys });
    return keys;
  }

  async function keysFor(appId: string, kid: string | undefined): Promise<Jwk[]> {
    const cached = cache.get(appId);
    const age = cached ? clock() - cached.fetchedAt : Infinity;
    const known = cached && (kid === undefined || cached.keys.some(key => key.kid === kid));
    const keys = cached && age < JWKS_TTL_MS && (known || age < JWKS_REFRESH_MIN_MS) ? cached.keys : await loadKeys(appId);
    return kid === undefined ? keys : keys.filter(key => key.kid === kid);
  }

  return async function verifyToken(token: string, appId: string) {
    if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) throw new InvalidTokenError("Malformed token.");
    const parts = token.split(".");
    if (parts.length !== 3) throw new InvalidTokenError("Malformed token.");
    const header = decodeJson<TokenHeader>(parts[0]);
    const claims = decodeJson<TokenClaims>(parts[1]);
    const signature = decodeSegment(parts[2]);
    if (header.alg !== "ES256") throw new InvalidTokenError("Token is not ES256.");
    if (header.kid !== undefined && typeof header.kid !== "string") throw new InvalidTokenError("Malformed token.");
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const candidates = await keysFor(appId, header.kid);
    let valid = false;
    for (const jwk of candidates) {
      if (await verifyWith(jwk, signed, signature)) { valid = true; break; }
    }
    if (!valid) throw new InvalidTokenError("Token signature is invalid.");
    return { userId: checkClaims(claims, appId, Math.floor(clock() / 1000)) };
  };
}

/** One verifier (and JWKS cache) per isolate. */
export const verifyPrivyToken: VerifyToken = createPrivyTokenVerifier();
