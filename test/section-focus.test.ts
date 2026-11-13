import assert from "node:assert/strict";
import test from "node:test";

/** A tiny page: sections found by selector, each able to glow, scroll and be locked. */
class FakeElement {
  classes = new Set<string>();
  scrolled = 0;
  style = { setProperty() {} };
  name: string;
  locked: boolean;
  top: number;
  constructor(name: string, locked = false, top = 100) { this.name = name; this.locked = locked; this.top = top; }
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
  get offsetWidth() { return 10; }
  closest(selector: string) { return this.locked && selector.includes(".locked-area") ? this : null; }
  querySelector() { return null; }
  contains() { return false; }
  getBoundingClientRect() { return { top: this.top, bottom: this.top + 50, left: 0, right: 100, width: 100, height: 50 }; }
  scrollIntoView() { this.scrolled += 1; }
}

const sections = new Map<string, FakeElement>();
let modalOpen = false;
const svgNode = () => ({ setAttribute() {}, appendChild() {}, replaceChildren() {}, remove() {}, style: {} as Record<string, string> });
Object.assign(globalThis, {
  document: {
    querySelectorAll: (selector: string) => selector === "dialog[open]" ? (modalOpen ? [{ matches: () => true }] : []) : (sections.has(selector) ? [sections.get(selector)] : []),
    createElementNS: svgNode,
    body: { appendChild() {} },
    documentElement: { clientHeight: 800, clientWidth: 1200 },
  },
  window: Object.assign(globalThis, {
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: true }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, innerHeight: 800, innerWidth: 1200,
  }),
});

const { flashSections, focusSection, resetSectionFocus, SECTION_FLASH_CLASS } = await import("../client/lib/section-flash.ts");
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const lit = () => [...sections.values()].filter(element => element.classes.has(SECTION_FLASH_CLASS)).map(element => element.name);

test("sections asked for together light one at a time, and each is scrolled into view", async () => {
  resetSectionFocus();
  sections.clear();
  sections.set(".a", new FakeElement("a", false, 1200));
  sections.set(".b", new FakeElement("b"));
  flashSections([[".a"], [".b"]], 300);
  await wait(30);
  assert.deepEqual(lit(), ["a"], "only the first is in focus");
  assert.equal(sections.get(".a")!.scrolled, 1, "an off-screen section is brought into view");
  await wait(1000);
  assert.deepEqual(lit(), ["b"], "the next takes its turn after the first fades");
  assert.equal(sections.get(".b")!.scrolled, 0, "a section already on screen is not scrolled");
});

test("a locked section is never pointed at, and nothing lights while a popup is open", async () => {
  resetSectionFocus();
  sections.clear();
  sections.set(".locked", new FakeElement("locked", true));
  flashSections([[".locked"]], 100);
  await wait(1500);
  assert.deepEqual(lit(), [], "locked sections are skipped");
  sections.set(".open", new FakeElement("open"));
  modalOpen = true;
  flashSections([[".open"]], 3000);
  await wait(200);
  assert.deepEqual(lit(), [], "waits while a popup has the player's attention");
  modalOpen = false;
  await wait(600);
  assert.deepEqual(lit(), ["open"], "lights once the screen is free");
});

test("a section the player asked for replaces whatever is waiting or lit", async () => {
  resetSectionFocus();
  sections.clear();
  sections.set(".slow", new FakeElement("slow"));
  sections.set(".asked", new FakeElement("asked"));
  flashSections([[".slow"]], 5000);
  await wait(30);
  assert.deepEqual(lit(), ["slow"]);
  focusSection([".asked"], 3000);
  await wait(100);
  assert.deepEqual(lit(), ["asked"], "the asked-for section takes focus at once");
  resetSectionFocus();
});
