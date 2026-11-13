import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_RESEND_DELAY_MS, resendDelaySeconds, validEmail, validCode } from "../client/models/email-sign-in.ts";

test("email input accepts trimmed addresses and rejects malformed or oversized input", () => {
  assert.equal(validEmail("  player+story@example.com  "), "player+story@example.com");
  for (const address of ["", "player", "player@", "p @example.com", "p@example", `${"x".repeat(250)}@example.com`]) assert.equal(validEmail(address), null);
});

test("OTP accepts exactly six digits including leading zeroes and pasted spaces", () => {
  assert.equal(validCode("001234"), "001234");
  assert.equal(validCode("123 456"), "123456");
  for (const code of ["", "12345", "1234567", "12345a", "123-456", "１２３４５６"]) assert.equal(validCode(code), null);
});

test("resend delay rounds up, expires at the deadline and never becomes negative", () => {
  const sentAt = 100_000, retryAt = sentAt + EMAIL_RESEND_DELAY_MS;
  assert.equal(resendDelaySeconds(retryAt, sentAt), 30);
  assert.equal(resendDelaySeconds(retryAt, retryAt - 1), 1);
  assert.equal(resendDelaySeconds(retryAt, retryAt), 0);
  assert.equal(resendDelaySeconds(retryAt, retryAt + 60_000), 0);
});
