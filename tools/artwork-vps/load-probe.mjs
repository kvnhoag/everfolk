#!/usr/bin/env node
/** Bounded image GET probe. Run against your own future origin/CDN, not arbitrary hosts. */
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

export function parseArgs(argv) {
  const options = { seconds: 15, rps: 5, concurrency: 4, timeoutMs: 5000 };
  const names = new Map([["--url", "url"], ["--seconds", "seconds"], ["--rps", "rps"], ["--concurrency", "concurrency"], ["--timeout-ms", "timeoutMs"]]);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help") return { help: true };
    const name = names.get(argv[i]);
    if (!name || i + 1 >= argv.length) throw new Error("Use --url URL [--seconds 15] [--rps 5] [--concurrency 4] [--timeout-ms 5000].");
    options[name] = name === "url" ? argv[++i] : Number(argv[++i]);
  }
  const url = new URL(options.url);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) throw new Error("Use an HTTP(S) URL without embedded credentials or a fragment.");
  for (const [name, min, max] of [["seconds", 1, 60], ["rps", 1, 100], ["concurrency", 1, 32], ["timeoutMs", 100, 15000]]) {
    if (!Number.isInteger(options[name]) || options[name] < min || options[name] > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
  }
  return options;
}

export async function probe(options) {
  const started = performance.now();
  const deadline = started + options.seconds * 1000;
  const limit = options.seconds * options.rps;
  const latencies = [];
  const successfulLatencies = [];
  const statusCodes = {};
  const cacheStatuses = {};
  let next = 0;
  let bytes = 0;
  let completed = 0;
  let failures = 0;
  async function worker() {
    while (next < limit && performance.now() < deadline) {
      const ticket = next++;
      const scheduled = started + ticket * 1000 / options.rps;
      const wait = scheduled - performance.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      if (performance.now() >= deadline) break;
      const requestStart = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        // Preserve the exact URL/cache key; no cache-busting query parameters.
        const response = await fetch(options.url, { signal: controller.signal, redirect: "error" });
        statusCodes[response.status] = (statusCodes[response.status] || 0) + 1;
        const cache = response.headers.get("cf-cache-status") || "unreported";
        cacheStatuses[cache] = (cacheStatuses[cache] || 0) + 1;
        const reader = response.body?.getReader();
        let received = 0;
        if (reader) {
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              received += chunk.value.byteLength;
              bytes += chunk.value.byteLength;
              if (received > 25 * 1024 * 1024) {
                controller.abort();
                throw new Error("Response exceeds probe's 25 MiB bound.");
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
        if (response.status !== 200) failures++;
        else successfulLatencies.push(performance.now() - requestStart);
      } catch {
        failures++;
      } finally {
        clearTimeout(timeout);
        completed++;
        latencies.push(performance.now() - requestStart);
      }
    }
  }
  await Promise.all(Array.from({ length: options.concurrency }, worker));
  const elapsedSeconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  successfulLatencies.sort((a, b) => a - b);
  const percentile = (values, fraction) => values.length ? values[Math.max(0, Math.ceil(values.length * fraction) - 1)] : null;
  return {
    target: options.url,
    requestedRps: options.rps,
    concurrency: options.concurrency,
    elapsedSeconds,
    completed,
    failures,
    errorRate: completed ? failures / completed : null,
    achievedRps: completed / elapsedSeconds,
    receivedBytes: bytes,
    receivedMbps: bytes * 8 / elapsedSeconds / 1e6,
    allResponseP50Ms: percentile(latencies, 0.5),
    allResponseP95Ms: percentile(latencies, 0.95),
    successfulResponseP95Ms: percentile(successfulLatencies, 0.95),
    statusCodes,
    cacheStatuses,
    note: "A single URL and this generator do not establish production capacity. HTTP payload bytes exclude protocol overhead; CDN results do not measure origin capacity."
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log("node load-probe.mjs --url URL [--seconds 15] [--rps 5] [--concurrency 4] [--timeout-ms 5000]");
    else {
      const result = await probe(options);
      console.log(JSON.stringify(result, null, 2));
      if (result.failures || !result.completed) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
