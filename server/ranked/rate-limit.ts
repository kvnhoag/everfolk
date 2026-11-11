/** Same shape as Cloudflare's Workers rate-limit binding. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Fixed-window fallback for when no binding is configured. It counts per isolate only, so it slows a single
 * abusive client rather than enforcing a global quota; configure the `RANKED_RATE_LIMITER` binding in production.
 */
export function createMemoryLimiter(options: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    async limit({ key }) {
      const time = now();
      const current = windows.get(key);
      if (!current || time - current.start >= options.windowMs) {
        if (windows.size >= maxKeys) windows.clear();
        windows.set(key, { start: time, count: 1 });
        return { success: true };
      }
      current.count += 1;
      return { success: current.count <= options.limit };
    },
  };
}

/** Verifying replays a whole life, so allow a handful per client per minute. */
export const defaultVerifyLimiter = createMemoryLimiter({ limit: 6, windowMs: 60_000 });

export function clientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
