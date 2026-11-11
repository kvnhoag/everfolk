/** Public sign-in settings from `/api/signin/config`. The Privy App ID is served at runtime, never built in. */

export interface SignInConfig { privyAppId: string | null }

const CONFIG_PATH = "/api/signin/config";
const APP_ID = /^[A-Za-z0-9_-]{1,128}$/;
const NO_EMAIL: SignInConfig = { privyAppId: null };

/** Anything malformed means "no email sign-in", never an error. */
export function parseSignInConfig(value: unknown): SignInConfig {
  if (typeof value !== "object" || value === null) return NO_EMAIL;
  const raw = (value as { privyAppId?: unknown }).privyAppId;
  const appId = typeof raw === "string" ? raw.trim() : "";
  return APP_ID.test(appId) && (value as { funding?: unknown }).funding === true ? { privyAppId: appId } : NO_EMAIL;
}

let request: Promise<SignInConfig> | null = null;

/** Fetched once per page. */
export function loadSignInConfig(fetchFn: typeof fetch = (input, init) => fetch(input, init)): Promise<SignInConfig> {
  request ??= fetchFn(CONFIG_PATH, { credentials: "same-origin", cache: "no-store" })
    .then(response => (response.ok ? response.json() : null))
    .then(parseSignInConfig)
    .catch(() => NO_EMAIL);
  return request;
}
