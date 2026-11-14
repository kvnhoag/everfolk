#!/usr/bin/env node
/** Assumption-driven workload arithmetic. Outputs are estimates, never benchmarks. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const need = (condition, message) => { if (!condition) throw new Error(message); };
function number(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, exclusiveMin = false } = {}) {
  need(typeof value === "number" && Number.isFinite(value) && (exclusiveMin ? value > min : value >= min) && value <= max, `Invalid ${name}`);
  return value;
}

export function modelCapacity(config) {
  need(config?.schemaVersion === 1, "Expected schemaVersion 1");
  const days = number(config.daysPerMonth ?? 30, "daysPerMonth", { min: 1, max: 366 });
  const linkMbps = number(config.linkMbps, "linkMbps", { min: 0, exclusiveMin: true });
  const usable = number(config.usableLinkFraction ?? 0.7, "usableLinkFraction", { min: 0, max: 1, exclusiveMin: true });
  const budget = config.monthlyTransferAllowanceGB === undefined ? null : number(config.monthlyTransferAllowanceGB, "monthlyTransferAllowanceGB", { min: 0, exclusiveMin: true });
  const otherGB = number(config.otherOriginTransferGB ?? 0, "otherOriginTransferGB");
  need(Array.isArray(config.scenarios) && config.scenarios.length > 0, "At least one scenario is required");
  const names = new Set();
  const scenarios = config.scenarios.map(scenario => {
    need(typeof scenario.name === "string" && scenario.name.trim() && !names.has(scenario.name), "Scenario names must be non-empty and unique");
    names.add(scenario.name);
    const get = key => scenario[key] ?? config[key];
    const dailySessions = number(get("dailySessions"), "dailySessions");
    const requestsPerSession = number(get("requestsPerSession"), "requestsPerSession");
    const responseBytes = number(get("averageResponseBytes"), "averageResponseBytes", { min: 0, exclusiveMin: true });
    const peakFactor = number(get("peakFactor") ?? 10, "peakFactor", { min: 1 });
    const requestHitRate = number(get("requestHitRate"), "requestHitRate", { min: 0, max: 1 });
    const byteHitRate = number(get("byteHitRate"), "byteHitRate", { min: 0, max: 1 });
    need(requestHitRate < 1 || byteHitRate === 1, "100% request hits cannot have origin payload misses in this model");
    const requests = dailySessions * requestsPerSession * days;
    const bytes = requests * responseBytes;
    const averageRps = dailySessions * requestsPerSession / 86400;
    const originAverageRps = averageRps * (1 - requestHitRate);
    const originAverageMbps = averageRps * responseBytes * 8 * (1 - byteHitRate) / 1e6;
    const originGB = bytes * (1 - byteHitRate) / 1e9;
    const capacityMbps = linkMbps * usable;
    const coldPeakRps = averageRps * peakFactor;
    const coldPeakMbps = coldPeakRps * responseBytes * 8 / 1e6;
    const totalTransferGB = originGB + otherGB;
    const calculated = { requests, bytes, originAverageRps, originAverageMbps, originGB, coldPeakRps, coldPeakMbps, totalTransferGB };
    need(Object.values(calculated).every(Number.isFinite), `Scenario overflows numeric range: ${scenario.name}`);
    return {
      name: scenario.name,
      assumptions: { dailySessions, requestsPerSession, averageResponseBytes: responseBytes, peakFactor, requestHitRate, byteHitRate },
      monthly: { clientRequests: requests, clientPayloadGB: bytes / 1e9, originRequests: requests * (1 - requestHitRate), originPayloadGB: originGB, otherOriginTransferGB: otherGB, totalModeledOriginTransferGB: totalTransferGB, transferAllowanceUtilization: budget === null ? null : totalTransferGB / budget },
      steadyState: { clientAverageRps: averageRps, originAverageRps, originPeakRps: originAverageRps * peakFactor, originAverageMbps, originPeakMbps: originAverageMbps * peakFactor, peakLinkUtilization: originAverageMbps * peakFactor / capacityMbps },
      coldCache: { peakOriginRps: coldPeakRps, peakOriginMbps: coldPeakMbps, peakLinkUtilization: coldPeakMbps / capacityMbps },
      linkOnlyCeiling: { usableMbps: capacityMbps, uncachedResponsesPerSecond: capacityMbps * 1e6 / (responseBytes * 8), warning: "Network arithmetic only; CPU, disk, TLS/tunnel, request overhead, sharing and client latency can lower capacity." },
    };
  });
  return { schemaVersion: 1, estimateOnly: true, units: "Decimal GB and Mbps; payload bytes exclude HTTP/TLS/tunnel overhead.", assumptions: { daysPerMonth: days, linkMbps, usableLinkFraction: usable, monthlyTransferAllowanceGB: budget, otherOriginTransferGB: otherGB }, limitations: ["requestsPerSession means requests reaching the CDN after browser-cache reuse, not visual renders.", "Request and byte hit rates describe the complete cache hierarchy before origin. Regional cold fills, eviction and purges lower them.", "Peak factor is assumed; deployment benchmarks and observed logs must replace it before a capacity commitment.", "Image decoding/rendering on client devices, uploads, revalidation headers, backups and retries are excluded unless separately budgeted in otherOriginTransferGB.", "CPU/RAM capacity and availability cannot be inferred from link speed."], scenarios };
}

export function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === "--help") { console.log("node capacity-model.mjs --config workload.json"); return; }
  need(args.length === 2 && args[0] === "--config", "Usage: node capacity-model.mjs --config workload.json");
  console.log(JSON.stringify(modelCapacity(JSON.parse(readFileSync(args[1], "utf8"))), null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(`capacity-model: ${error.message}`); process.exitCode = 1; }
}
