import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import test from "node:test";
import { base58 } from "../chain/base58.ts";
import { createEvidenceSigner } from "../server/ranked/signer.ts";
import { viewLife } from "../server/ranked/near-view.ts";

const SECRET = "07".repeat(32);
const PKCS8_ED25519 = "302e020100300506032b657004220420";

test("base58 matches the Bitcoin alphabet vectors", () => {
  assert.equal(base58(new Uint8Array([0, 0, 1])), "112");
  assert.equal(base58(new TextEncoder().encode("hello world")), "StV1DL6CwTryKyV");
});

test("signs evidence that verifies with the published key", async () => {
  const signer = await createEvidenceSigner(SECRET);
  const evidence = '{"v":1}';
  const signature = await signer.sign(evidence);
  assert.equal(signature.length, 128);
  const publicKey = createPublicKey(createPrivateKey({ key: Buffer.from(PKCS8_ED25519 + SECRET, "hex"), format: "der", type: "pkcs8" }));
  assert.ok(verify(null, Buffer.from(evidence), publicKey, Buffer.from(signature, "hex")));
});

test("publishes the NEAR-format public key for its secret", async () => {
  const signer = await createEvidenceSigner(SECRET);
  const jwk = createPublicKey(createPrivateKey({ key: Buffer.from(PKCS8_ED25519 + SECRET, "hex"), format: "der", type: "pkcs8" })).export({ format: "jwk" });
  assert.equal(signer.publicKey, `ed25519:${base58(Buffer.from(jwk.x ?? "", "base64url"))}`);
});

test("rejects a secret that is not 32 bytes of hex", async () => {
  await assert.rejects(createEvidenceSigner("abc"), /32-byte hex/);
});

function rpc(result: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(result))) as typeof fetch;
}

const bytes = (value: unknown) => [...new TextEncoder().encode(JSON.stringify(value))];

test("viewLife parses a JSON-RPC call_function result", async () => {
  const life = { life_id: "7", seed: "ab", status: "alive" };
  const result = await viewLife("https://rpc.test", "lives.testnet", "7", rpc({ jsonrpc: "2.0", id: 1, result: { result: bytes(life) } }));
  assert.deepEqual(result, life);
});

test("viewLife returns null for a missing life", async () => {
  assert.equal(await viewLife("https://rpc.test", "lives.testnet", "8", rpc({ jsonrpc: "2.0", id: 1, result: { result: bytes(null) } })), null);
});

test("viewLife surfaces RPC errors", async () => {
  await assert.rejects(
    viewLife("https://rpc.test", "lives.testnet", "8", rpc({ jsonrpc: "2.0", id: 1, error: { message: "Server error", data: "account does not exist" } })),
    /could not read the life from NEAR/,
  );
});
