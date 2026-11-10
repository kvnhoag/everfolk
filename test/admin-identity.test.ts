import assert from "node:assert/strict";
import test from "node:test";
import { requestIdentity } from "../server/identity.ts";

test("admin identity requires a complete nonblank trusted identity", () => {
  const env = { ADMIN_EMAIL: "admin@example.test" };
  for (const userId of ["", "   "]) {
    const headers = new Headers({ "oai-authenticated-user-id": userId, "oai-authenticated-user-email": env.ADMIN_EMAIL });
    assert.deepEqual(requestIdentity(headers, env), { authenticated: false, isAdmin: false });
  }
  for (const email of ["", "   "]) {
    const headers = new Headers({ "oai-authenticated-user-id": "test-user", "oai-authenticated-user-email": email });
    assert.deepEqual(requestIdentity(headers, env), { authenticated: false, isAdmin: false });
  }
});

test("page and API identity use the same explicit exact admin allowlist", () => {
  const env = { ADMIN_EMAIL: " Admin@example.test ", ADMIN_EMAILS: " second@example.test;third@example.test\nfourth@example.test " };
  for (const email of ["ADMIN@example.test", "second@example.test", "third@example.test", "fourth@example.test"]) {
    const headers = new Headers({ "oai-authenticated-user-id": "test-user", "oai-authenticated-user-email": email });
    assert.deepEqual(requestIdentity(headers, env), { authenticated: true, isAdmin: true });
    assert.deepEqual(requestIdentity(headers, {}), { authenticated: true, isAdmin: false });
  }
  for (const email of ["player@example.test", "admin@example.test.evil", "not-admin@example.test"]) {
    const headers = new Headers({ "oai-authenticated-user-id": "test-user", "oai-authenticated-user-email": email, "isAdmin": "true", "role": "admin" });
    assert.deepEqual(requestIdentity(headers, env), { authenticated: true, isAdmin: false });
  }
});
