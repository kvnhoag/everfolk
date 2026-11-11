import assert from "node:assert/strict";
import test from "node:test";
import { keepFreePlayOnRankedStart } from "../client/ranked-return.ts";

test("starting a ranked life clears a pending fresh start so free play resumes its save afterwards", () => {
  const previousLife = { seed: "x" } as never;
  const active = { world: { id: "w" } as never, key: 3, fresh: true, previousLife };
  assert.deepEqual(keepFreePlayOnRankedStart(active), { world: active.world, key: 3, fresh: false });
});

test("nothing to clear when free play was already resuming", () => {
  const active = { world: { id: "w" } as never, key: 1, fresh: false };
  assert.equal(keepFreePlayOnRankedStart(active), active);
  assert.equal(keepFreePlayOnRankedStart(null), null);
});
