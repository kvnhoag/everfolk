import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../client/styles/gameplay-layout.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../client/screens/App.tsx", import.meta.url), "utf8");

test("the time bar stays pinned to the top, and scrolled-to sections stop below it", () => {
  assert.match(css, /\.everfolk-game \.page-shell \.life-session-bar\{position:sticky;top:0;z-index:35/);
  assert.match(css, /html:has\(\.everfolk-game \.life-session-bar\)\{scroll-padding-top:\d+px\}/);
});

test("closing a tip lets the clock carry on; the player never has to find Resume again", () => {
  assert.doesNotMatch(app, /tipWasShown/);
  assert.match(app, /isOverlayOpen: [^\n]*tipShown/, "the clock still waits while the tip is open");
});
