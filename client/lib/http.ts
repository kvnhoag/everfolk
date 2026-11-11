interface JsonRequestOptions {
  timeoutMs?: number;
  jsonHeaders?: boolean;
  tolerateInvalidJson?: boolean;
  includeMessage?: boolean;
  fallbackError?: string;
}

/** Shared browser transport; feature queries and mutations choose their API policy. */
export async function requestJson<T>(path: string, init?: RequestInit, {
  timeoutMs,
  jsonHeaders = true,
  tolerateInvalidJson = true,
  includeMessage = true,
  fallbackError,
}: JsonRequestOptions = {}): Promise<T> {
  const controller = timeoutMs === undefined ? undefined : new AbortController();
  const timeout = controller && setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init?.headers);
  if (jsonHeaders && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const signal = controller ? init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal : init?.signal;
  try {
    const response = await fetch(path, { credentials: "same-origin", ...init, headers, signal });
    const data: unknown = await (tolerateInvalidJson ? response.json().catch(() => ({})) : response.json());
    if (!response.ok) {
      const details = data && typeof data === "object" ? data as Record<string, unknown> : {};
      throw new Error(typeof details.error === "string" ? details.error
        : includeMessage && typeof details.message === "string" ? details.message
        : fallbackError ?? `The request could not be completed (${response.status}).`);
    }
    return data as T;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
