import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/** The left-to-right skill tree sits on the dark map first drawn for the skill fan; only its colours change. */
const css = readFileSync(new URL("../client/styles/capability-tree-dark-map.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const DARK_MAP = "radial-gradient(circle at 50% 50%,#1b3139 0%,#122228 55%,#0b1518 100%)";
const PREFIX = ".capability-tree .capability-viewport ";
// The lightest stop of the map is the hardest one for light text and lines to stand out on.
const LIGHTEST_STOP = "#1b3139";
// The darkest paper the legend can sit on: the paper colour of the older map.
const DARKEST_PAPER = "#f3e7cc";
const TEXT_RATIO = 4.5;
const GRAPHIC_RATIO = 3;
const DIMMED_RATIO = 2;

type Rgb = readonly [number, number, number];

function declarationsFor(selector: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, selectors, body] of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    if (!selectors.split(",").some(item => item.trim() === selector)) continue;
    for (const declaration of body.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon > 0) found.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim().replace(/\s*!important$/, ""));
    }
  }
  return found;
}
function declared(selector: string, property: string): string {
  const value = declarationsFor(selector).get(property);
  assert.ok(value, `${selector} sets ${property}`);
  return value;
}
function rgb(hex: string): Rgb {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is a six-digit colour`);
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as unknown as Rgb;
}
function mix(top: Rgb, bottom: Rgb, opacity: number): Rgb {
  return top.map((channel, index) => channel * opacity + bottom[index] * (1 - opacity)) as unknown as Rgb;
}
function luminance(color: Rgb): number {
  const [r, g, b] = color.map(channel => { const unit = channel / 255; return unit <= .03928 ? unit / 12.92 : ((unit + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}
function onMap(selector: string, property: string, opacity = 1): number {
  return contrast(mix(rgb(declared(PREFIX + selector, property)), rgb(LIGHTEST_STOP), opacity), rgb(LIGHTEST_STOP));
}

test("the map uses the fan's dark background, in place of the old paper dots", () => {
  const viewport = declarationsFor(".capability-tree .capability-map-area .capability-viewport");
  assert.equal(viewport.get("background"), DARK_MAP);
  assert.equal(viewport.get("background-image"), DARK_MAP, "the dotted paper pattern from the older layout is replaced too");
  assert.equal(viewport.get("background-size"), "auto");
  assert.equal(viewport.get("border-color"), "#0b1518");
});

test("branch titles, subtitles, depth numbers and dividing rules stay readable on the dark map", () => {
  for (const selector of [".capability-band-title", ".capability-band-subtitle", ".capability-depth-label"]) {
    const ratio = onMap(selector, "fill");
    assert.ok(ratio >= TEXT_RATIO, `${selector} contrast ${ratio.toFixed(2)}:1 is at least ${TEXT_RATIO}:1`);
  }
  const rule = onMap(".capability-band-rule", "stroke", Number(declared(PREFIX + ".capability-band-rule", "opacity")));
  assert.ok(rule >= GRAPHIC_RATIO, `band rules contrast ${rule.toFixed(2)}:1`);
});

test("links stay visible: plain, learned, crossover and selected path", () => {
  for (const selector of [".capability-link", ".capability-link.is-learned", ".capability-link.is-lineage"]) {
    const ratio = onMap(selector, "stroke");
    assert.ok(ratio >= GRAPHIC_RATIO, `${selector} contrast ${ratio.toFixed(2)}:1 is at least ${GRAPHIC_RATIO}:1`);
  }
  const dimmed = onMap(".capability-link", "stroke", Number(declared(PREFIX + ".capability-link.is-off-path", "opacity")));
  assert.ok(dimmed >= DIMMED_RATIO, `links off the selected path stay legible at ${dimmed.toFixed(2)}:1`);
  const learnedStroke = rgb(declared(PREFIX + ".capability-link.is-learned", "stroke"));
  const plainStroke = rgb(declared(PREFIX + ".capability-link", "stroke"));
  assert.notDeepEqual(learnedStroke, plainStroke, "learned links look different from plain ones");
});

test("every skill name is readable in each state, including skills not yet in the game", () => {
  const names: readonly (readonly [string, number])[] = [
    [".capability-node-name", 1],
    [".capability-node.tier-learnable .capability-node-name", 1],
    [".capability-node.tier-learned .capability-node-name", 1],
    [".capability-node.is-lineage .capability-node-name", 1],
    [".capability-node.is-selected .capability-node-name", 1],
    [".capability-node.tier-unavailable .capability-node-name", Number(declared(PREFIX + ".capability-node.tier-unavailable", "opacity"))],
  ];
  for (const [selector, opacity] of names) {
    const ratio = onMap(selector, "color", opacity);
    assert.ok(ratio >= TEXT_RATIO, `${selector} contrast ${ratio.toFixed(2)}:1 is at least ${TEXT_RATIO}:1`);
  }
});

test("node outlines stand apart from the map, and the selected or focused skill is clearly marked", () => {
  const learned = onMap(".capability-node.is-learned .capability-node-shape", "stroke");
  assert.ok(learned >= GRAPHIC_RATIO, `a learned node's outline contrast ${learned.toFixed(2)}:1`);
  for (const selector of [".capability-node.is-selected .capability-node-shape", ".capability-node:focus-visible .capability-node-shape", ".capability-node:hover .capability-node-shape"]) {
    const ratio = onMap(selector, "stroke");
    assert.ok(ratio >= GRAPHIC_RATIO, `${selector} contrast ${ratio.toFixed(2)}:1`);
  }
  const focus = contrast(rgb(declared(PREFIX + ".capability-node:focus-visible", "outline-color")), rgb(LIGHTEST_STOP));
  assert.ok(focus >= GRAPHIC_RATIO, `the keyboard focus ring contrast ${focus.toFixed(2)}:1`);
  const dimmedName = onMap(".capability-node.tier-unavailable .capability-node-name", "color", Number(declared(PREFIX + ".capability-node.tier-unavailable.is-off-path", "opacity")));
  assert.ok(dimmedName >= GRAPHIC_RATIO, `a skill that is both off the selected path and not yet in the game still reads at ${dimmedName.toFixed(2)}:1`);
  const unavailable = Number(declared(PREFIX + ".capability-node.tier-unavailable", "opacity"));
  assert.ok(unavailable < 1 && unavailable >= .55, "skills not yet in the game are dimmed, not hidden");
});

test("the legend, which sits on paper above the map, stays readable", () => {
  const paper = rgb(DARKEST_PAPER);
  const legend = ".capability-tree .capability-legend";
  const text = contrast(rgb(declared(legend, "color")), paper);
  assert.ok(text >= TEXT_RATIO, `legend text contrast ${text.toFixed(2)}:1 is at least ${TEXT_RATIO}:1`);
  const dimmed = mix(rgb(declared(legend, "color")), paper, Number(declared(`${legend} .is-unavailable`, "opacity")));
  assert.ok(contrast(dimmed, paper) >= TEXT_RATIO, `the dimmed "Unavailable" key stays at ${contrast(dimmed, paper).toFixed(2)}:1`);
});

test("the Skills tab heading shrinks to one line but leaves room for the section help button", () => {
  const heading = ".character-management.is-skills .capability-tree .capability-heading";
  assert.match(declared(heading, "padding"), /^0 34px \d+px 0$/);
  assert.equal(declarationsFor(`${heading} p`).get("display"), "none");
});

test("the Skills tab still fills the screen, with the map as tall as the screen allows", () => {
  const dialog = declarationsFor(".detail-dialog.character-dialog:has(.character-management.is-skills)");
  assert.equal(dialog.get("width"), "100vw");
  assert.equal(dialog.get("height"), "100dvh");
  assert.match(declared(".character-management.is-skills .capability-tree .capability-viewport", "height"), /100dvh/);
});
