import assert from "node:assert/strict";
import test from "node:test";
import { modelCapacity } from "../bin/capacity-model.mjs";

const configuration = () => ({ schemaVersion: 1, daysPerMonth: 30, averageResponseBytes: 200000, requestsPerSession: 30, peakFactor: 10, linkMbps: 100, usableLinkFraction: 0.7, monthlyTransferAllowanceGB: 1000, scenarios: [{ name: "Launch", dailySessions: 1000, requestHitRate: 0.95, byteHitRate: 0.99 }] });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("known workload separates monthly request misses from byte misses", () => {
  const result = modelCapacity(configuration());
  assert.equal(result.estimateOnly, true);
  const scenario = result.scenarios[0];
  assert.equal(scenario.monthly.clientRequests, 900000);
  close(scenario.monthly.originRequests, 45000);
  assert.equal(scenario.monthly.clientPayloadGB, 180);
  close(scenario.monthly.originPayloadGB, 1.8);
  close(scenario.steadyState.originPeakRps, 0.1736111111111111);
  close(scenario.steadyState.originPeakMbps, 0.05555555555555555);
  assert.equal(scenario.linkOnlyCeiling.usableMbps, 70);
  assert.equal(scenario.linkOnlyCeiling.uncachedResponsesPerSecond, 43.75);
});

test("a warm-cache workload can exceed link capacity during a cold-cache burst", () => {
  const config = configuration();
  config.scenarios[0].dailySessions = 100000;
  const result = modelCapacity(config).scenarios[0];
  assert.ok(result.steadyState.peakLinkUtilization < 1);
  assert.ok(result.coldCache.peakLinkUtilization > 1);
  close(result.coldCache.peakOriginMbps, 555.5555555555555);
});

test("100% cache misses charge every modeled payload byte to origin", () => {
  const config = configuration();
  config.scenarios[0].requestHitRate = 0;
  config.scenarios[0].byteHitRate = 0;
  config.otherOriginTransferGB = 50;
  const result = modelCapacity(config).scenarios[0];
  assert.equal(result.monthly.originRequests, result.monthly.clientRequests);
  assert.equal(result.monthly.originPayloadGB, result.monthly.clientPayloadGB);
  assert.equal(result.monthly.totalModeledOriginTransferGB, 230);
  assert.equal(result.monthly.transferAllowanceUtilization, 0.23);
});

test("invalid and physically inconsistent assumptions are rejected", () => {
  for (const mutate of [config => { config.linkMbps = 0; }, config => { config.usableLinkFraction = 2; }, config => { config.scenarios[0].requestHitRate = 95; }, config => { config.scenarios[0].byteHitRate = -0.1; }, config => { config.scenarios[0].requestHitRate = 1; }, config => { config.scenarios[0].dailySessions = "1000"; }]) {
    const config = configuration();
    mutate(config);
    assert.throws(() => modelCapacity(config));
  }
});

test("unknown bandwidth allowance remains unknown instead of implying free capacity", () => {
  const config = configuration();
  delete config.monthlyTransferAllowanceGB;
  assert.equal(modelCapacity(config).scenarios[0].monthly.transferAllowanceUtilization, null);
});
