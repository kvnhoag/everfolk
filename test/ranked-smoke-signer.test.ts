import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import test from "node:test";
import { base58, nearPublicKey, newSigningKey, signEvidence, smokeEvidence } from "../scripts/ranked/smoke-signer.ts";

test("base58 matches the Bitcoin alphabet vectors", () => {
  assert.equal(base58(new Uint8Array([0, 0, 1])), "112");
  assert.equal(base58(new TextEncoder().encode("hello world")), "StV1DL6CwTryKyV");
});

test("near public key is ed25519 plus 32 base58-encoded bytes", () => {
  const key = newSigningKey();
  assert.match(nearPublicKey(key), /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/);
});

test("signature verifies over the exact evidence JSON", () => {
  const key = newSigningKey();
  const evidence = smokeEvidence({ lifeId: "3", seed: "ab".repeat(32), accountId: "smoke-a.testnet", matchedFigures: ["euclid"] });
  const signed = signEvidence(key, evidence);
  assert.equal(signed.evidence_json, evidence);
  assert.equal(signed.signature.length, 128);
  assert.ok(verify(null, Buffer.from(evidence), createPublicKey(key), Buffer.from(signed.signature, "hex")));
});

test("smoke evidence is canonical and carries the contract's required fields", () => {
  const parsed = JSON.parse(smokeEvidence({ lifeId: "3", seed: "ab".repeat(32), accountId: "a.testnet", matchedFigures: [] }));
  assert.equal(parsed.v, 1);
  assert.equal(parsed.life_id, "3");
  assert.equal(parsed.seed, "ab".repeat(32), "evidence is bound to the life's on-chain seed");
  assert.equal(parsed.world_version, "alexandria-ranked-1");
  assert.equal(parsed.career_group, "letters");
  assert.deepEqual(parsed.sources, []);
  assert.deepEqual(Object.keys(parsed), [...Object.keys(parsed)].sort());
});
