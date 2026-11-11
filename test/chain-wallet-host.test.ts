import assert from "node:assert/strict";
import test from "node:test";
import { hostInTopLayer } from "../client/chain/wallet-host.ts";

/** Minimal stand-ins for the DOM nodes involved. */
function node(name: string) {
  const self = {
    name, parentElement: null as ReturnType<typeof node> | null, children: [] as ReturnType<typeof node>[],
    appendChild(child: ReturnType<typeof node>) {
      child.parentElement?.children.splice(child.parentElement.children.indexOf(child), 1);
      child.parentElement = self; self.children.push(child); return child;
    },
  };
  return self;
}

test("moves the wallet picker into the open modal dialog and back again", () => {
  const body = node("body"), dialog = node("dialog"), picker = node("picker");
  body.appendChild(dialog); body.appendChild(picker);
  const doc = { body, getElementById: (id: string) => (id === "near-wallet-selector-modal" ? picker : null), querySelector: (q: string) => (q.includes("chain-screen") ? dialog : null), querySelectorAll: () => [dialog] };
  const restore = hostInTopLayer(doc as never);
  assert.equal(picker.parentElement, dialog, "inside the top-layer dialog, so it is visible and clickable");
  restore();
  assert.equal(picker.parentElement, body);
});

test("does nothing when no modal dialog is open or the picker is not mounted", () => {
  const body = node("body"), picker = node("picker");
  body.appendChild(picker);
  const restore = hostInTopLayer({ body, getElementById: () => picker, querySelector: () => null, querySelectorAll: () => [] } as never);
  assert.equal(picker.parentElement, body);
  restore();
  assert.doesNotThrow(() => hostInTopLayer({ body, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] } as never)());
});

test("prefers the ranked screen over other open dialogs behind it", () => {
  const body = node("body"), birth = node("birth dialog"), ranked = node("ranked dialog"), picker = node("picker");
  body.appendChild(birth); body.appendChild(ranked); body.appendChild(picker);
  const doc = { body, getElementById: () => picker, querySelector: (q: string) => (q.includes("chain-screen") ? ranked : birth), querySelectorAll: () => [birth, ranked] };
  hostInTopLayer(doc as never);
  assert.equal(picker.parentElement, ranked);
});

test("without the ranked screen, uses the most recently opened modal dialog", () => {
  const body = node("body"), first = node("first"), last = node("last"), picker = node("picker");
  body.appendChild(first); body.appendChild(last); body.appendChild(picker);
  hostInTopLayer({ body, getElementById: () => picker, querySelector: () => null, querySelectorAll: () => [first, last] } as never);
  assert.equal(picker.parentElement, last);
});
