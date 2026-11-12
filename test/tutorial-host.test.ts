import assert from "node:assert/strict";
import test from "node:test";
import { nextHostStack, topTutorialHost } from "../client/models/tutorial-host.ts";

const a = { id: "a" }, b = { id: "b" }, wallet = { id: "wallet" };

test("the tour joins the most recently opened modal window, so it stays clickable without freezing the game", () => {
  let stack = nextHostStack([], a, true);
  stack = nextHostStack(stack, b, true);
  assert.equal(topTutorialHost(stack), b);
  stack = nextHostStack(stack, b, false);
  assert.equal(topTutorialHost(stack), a);
  stack = nextHostStack(stack, a, false);
  assert.equal(topTutorialHost(stack), null, "With no window open the tour floats over the page.");
});

test("reopening a window moves it to the top once", () => {
  const stack = nextHostStack(nextHostStack(nextHostStack([], a, true), b, true), a, true);
  assert.deepEqual(stack, [b, a]);
});

test("excluded windows (wallet and payment prompts) never host the tour", () => {
  assert.deepEqual(nextHostStack([a], wallet, true, false), [a]);
});
