import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewLedger, PREVIEW_ACCOUNT } from "../client/chain/preview-ledger.ts";

test("preview ledger has a minted life, earnings to claim and two listings", async () => {
  const ledger = await createPreviewLedger();
  assert.equal(ledger.accountId, PREVIEW_ACCOUNT);
  const listings = await ledger.listings();
  assert.equal(listings.length, 2);
  const euclid = await ledger.token("1");
  assert.equal(euclid?.owner_id, PREVIEW_ACCOUNT);
  const stats = await ledger.tokenStats("1");
  assert.equal(stats.lives_influenced, 1);
  assert.ok(BigInt(stats.earned) > 0n);
  assert.ok(BigInt(await ledger.balanceOf(PREVIEW_ACCOUNT)) > 0n);
  assert.equal((await ledger.childrenOf("1")).length, 1);
});
