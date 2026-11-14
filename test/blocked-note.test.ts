import assert from "node:assert/strict";
import test from "node:test";
import { BLOCKED_NOTE_MS, BLOCKED_NOTE_SIZE, BLOCKED_NOTE_TEXT, blockedNotePlacement, createBlockedNoteStore } from "../client/state/blocked-note.ts";
import { blockedByTipLock, setTipLock } from "../client/lib/tip-lock.ts";

const viewport = { width: 1200, height: 800 };

function fakeTimers() {
  let next = 1;
  const pending = new Map<number, { run: () => void; ms: number }>();
  return {
    timers: { set: (run: () => void, ms: number) => { const id = next++; pending.set(id, { run, ms }); return id; }, clear: (id: unknown) => { pending.delete(id as number); } },
    pending,
    flush() { for (const [id, { run }] of [...pending]) { pending.delete(id); run(); } },
  };
}

test("the note tells the player what to do", () => {
  assert.equal(BLOCKED_NOTE_TEXT, "Finish this tip first: press Got it");
  assert.equal(BLOCKED_NOTE_MS, 1500);
});

test("a blocked click shows the note at the click point for about 1.5 s", () => {
  const clock = fakeTimers();
  const store = createBlockedNoteStore(clock.timers);
  let changes = 0;
  store.subscribe(() => { changes += 1; });
  store.show({ x: 300, y: 200 }, viewport);
  assert.deepEqual(store.get(), { top: 212, left: 312, run: 1 });
  assert.equal([...clock.pending.values()][0].ms, BLOCKED_NOTE_MS);
  clock.flush();
  assert.equal(store.get(), null, "the note goes by itself");
  assert.equal(changes, 2);
});

test("a second blocked click moves the note and restarts its time", () => {
  const clock = fakeTimers();
  const store = createBlockedNoteStore(clock.timers);
  store.show({ x: 300, y: 200 }, viewport);
  store.show({ x: 500, y: 400 }, viewport);
  assert.equal(clock.pending.size, 1, "only one timer runs");
  assert.deepEqual(store.get(), { top: 412, left: 512, run: 2 });
  store.hide();
  assert.equal(store.get(), null);
  assert.equal(clock.pending.size, 0);
});

test("near the right and bottom edges the note flips to stay fully on screen", () => {
  const placed = blockedNotePlacement({ x: 1190, y: 790 }, viewport);
  assert.ok(placed.left + BLOCKED_NOTE_SIZE.width <= viewport.width);
  assert.ok(placed.top + BLOCKED_NOTE_SIZE.height <= viewport.height);
  assert.ok(placed.left < 1190 && placed.top < 790);
  const tiny = blockedNotePlacement({ x: 100, y: 10 }, { width: 200, height: 30 });
  assert.ok(tiny.left >= 0 && tiny.top >= 0);
});

test("only clicks outside the step's section, the card, the Tutorial switch and open popups are blocked", () => {
  const card = { contains: (node: unknown) => node === inCard };
  const element = (...within: string[]) => ({ closest: (selector: string) => within.includes(selector) ? {} : null });
  const inCard = element();
  setTipLock({ targets: [".yearly-focus"], card });
  try {
    assert.equal(blockedByTipLock(element(".life-record-panel")), true, "a click elsewhere gets the note");
    assert.equal(blockedByTipLock(element(".yearly-focus")), false);
    assert.equal(blockedByTipLock(inCard), false);
    assert.equal(blockedByTipLock(element("[data-tutorial-button]")), false);
    assert.equal(blockedByTipLock(element("dialog[open]")), false);
  } finally { setTipLock(null); }
  assert.equal(blockedByTipLock(element(".life-record-panel")), false, "nothing is blocked without a guided step");
});
