import assert from "node:assert/strict";
import test from "node:test";
import { adoptPopups, isWalletPopup, syncHost, WALLET_POPUP_CLASS } from "../client/chain/wallet-host.ts";

/** Minimal stand-ins for NEAR Connect popup roots and the host dialog. */
function popup(display: string, className = WALLET_POPUP_CLASS) {
  return { name: className, classList: { contains: (name: string) => className.split(" ").includes(name) }, style: { display } };
}

function host() {
  const self = {
    open: false, children: [] as unknown[], shows: 0, closes: 0,
    showModal() { self.open = true; self.shows += 1; },
    close() { self.open = false; self.closes += 1; },
    appendChild(node: never) { self.children.push(node); return node; },
  };
  return self;
}

test("recognises NEAR Connect popups by their class", () => {
  assert.equal(isWalletPopup(popup("none", `n123 ${WALLET_POPUP_CLASS}`)), true);
  assert.equal(isWalletPopup(popup("block", "chain-screen")), false);
  assert.equal(isWalletPopup(null), false);
  assert.equal(isWalletPopup({ nodeType: 3 }), false, "text nodes have no classList");
});

test("adopts only wallet popups into the host", () => {
  const dialog = host();
  const picker = popup("none"), other = popup("block", "game-root");
  adoptPopups(dialog, [picker, other]);
  assert.deepEqual(dialog.children, [picker]);
});

test("shows the host while a popup is visible and closes it afterwards", () => {
  const dialog = host();
  const picker = popup("none");
  dialog.appendChild(picker as never);
  syncHost(dialog);
  assert.equal(dialog.open, false, "hidden wallet iframes do not open the host");
  picker.style.display = "block";
  syncHost(dialog);
  syncHost(dialog);
  assert.equal(dialog.open, true);
  assert.equal(dialog.shows, 1, "opened once, above the ranked dialog");
  picker.style.display = "none";
  syncHost(dialog);
  assert.equal(dialog.open, false);
  assert.equal(dialog.closes, 1);
});

test("closes the host once its last popup is removed", () => {
  const dialog = host();
  dialog.appendChild(popup("block") as never);
  syncHost(dialog);
  dialog.children.length = 0;
  syncHost(dialog);
  assert.equal(dialog.open, false);
});

test("a host that cannot open does not throw", () => {
  const dialog = { ...host(), showModal() { throw new Error("InvalidStateError"); } };
  dialog.appendChild(popup("block") as never);
  const warn = console.warn;
  console.warn = () => {};
  try { assert.doesNotThrow(() => syncHost(dialog)); } finally { console.warn = warn; }
});
