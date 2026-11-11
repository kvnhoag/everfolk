import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { matchFigures } from "../chain/match.ts";
import type { FigureId } from "../chain/ids.ts";
import { YEARLY_FOCUSES } from "../client/yearly-focus.ts";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { playToEnd, playUnfocusedToEnd } from "../scripts/ranked/path-policies.ts";

/*
 * Figure calibration (spec §6.7: thresholds are calibrated on real playthroughs).
 * A deliberate life follows its figure's path from scripts/ranked/path-policies.ts; an unfocused
 * life keeps one yearly focus and mostly takes Auto mode's safe pick, like the genesis lives.
 * Alexander's deliberate lives are royal-household births only: the origin is a 1-in-100 roll.
 *
 * CI plays a small fixed seed set. For the full table:
 *   FIGURE_CALIBRATION_LIVES=200 node --test test/chain-figure-calibration.test.ts
 */
const ranked = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(ranked);
const FULL_RUN = Number(process.env.FIGURE_CALIBRATION_LIVES ?? 0);
const FIGURES: readonly FigureId[] = ["alexander", "aristotle", "euclid", "cleomenes"];
const FOCUSES = YEARLY_FOCUSES.map(focus => focus.id);
const GRANARIES_EVENT = "influence-cleomenes-granaries";
/** Alexandria's founding to Ptolemy's takeover: the famine years the granaries answer. */
const FAMINE_YEARS = { from: -331, to: -324 };
/** Small fixed seed sets keep CI under a few seconds; the rates below hold for exactly these seeds. */
const CI_DELIBERATE_LIVES = 20;
const CI_UNFOCUSED_LIVES = 40;
/** Targets: a deliberate run qualifies in a meaningful share, an unfocused life almost never. */
const DELIBERATE_RANGE = { min: 0.1, max: 0.45 };
const GRANARIES_RANGE = { min: 0.12, max: 0.28 };

function start(seed: string, activations: readonly string[] = []): LifeState {
  let state = engine.start(seed);
  for (const entry of activations) {
    state = engine.influence(state, { type: "influence", mode: "activate", entry, power: 1, source: { contractId: "calibration.test", tokenId: entry } });
  }
  return state;
}

const range = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}-${i}`);

/** Seeds whose birth roll lands in `origin`, scanned in order from a prefix. */
function seedsBornInto(origin: string, prefix: string, count: number): string[] {
  const seeds: string[] = [];
  for (let i = 0; seeds.length < count && i < count * 1_000; i++) {
    if (engine.start(`${prefix}-${i}`).originId === origin) seeds.push(`${prefix}-${i}`);
  }
  assert.equal(seeds.length, count, `found ${count} ${origin} seeds`);
  return seeds;
}

function deliberateLives(figure: FigureId, prefix: string, count: number): LifeState[] {
  const seeds = figure === "alexander" ? seedsBornInto("royal-household", prefix, count) : range(prefix, count);
  return seeds.map(seed => playToEnd(engine, start(seed), figure));
}

function unfocusedLives(prefix: string, count: number, activations: readonly string[] = []): LifeState[] {
  return range(prefix, count).map((seed, i) => playUnfocusedToEnd(engine, start(seed, activations), FOCUSES[i % FOCUSES.length]));
}

const rate = (lives: readonly LifeState[], check: (life: LifeState) => boolean) => lives.filter(check).length / lives.length;
const qualifiesAs = (figure: FigureId) => (life: LifeState) => matchFigures(life).includes(figure);
const granariesFired = (life: LifeState) => life.journal.some(entry => entry.type === "event" && entry.id === GRANARIES_EVENT);
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

if (FULL_RUN > 0) {
  test(`calibration table (${FULL_RUN} lives per policy)`, () => {
    const unfocused = unfocusedLives("calibration-unfocused", FULL_RUN);
    console.log("figure      deliberate  unfocused   (alexander deliberate: royal-household births only)");
    for (const figure of FIGURES) {
      const deliberate = rate(deliberateLives(figure, `calibration-${figure}`, FULL_RUN), qualifiesAs(figure));
      console.log(`${figure.padEnd(11)} ${percent(deliberate).padStart(9)}  ${percent(rate(unfocused, qualifiesAs(figure))).padStart(9)}`);
    }
    const granaries = rate(unfocusedLives("calibration-granaries", FULL_RUN, ["cleomenes.granaries"]), granariesFired);
    console.log(`cleomenes.granaries fired in ${percent(granaries)} of unfocused lives`);
  });
}

// One shared set: the granaries activation only feeds the already weak, and these lives also
// stand in for unfocused play when checking that figures stay out of reach.
let ciUnfocused: LifeState[] | undefined;
const unfocusedWithGranaries = () => ciUnfocused ??= unfocusedLives("ci-unfocused", CI_UNFOCUSED_LIVES, ["cleomenes.granaries"]);

for (const figure of FIGURES) {
  test(`a deliberate ${figure} run qualifies in a meaningful share of lives`, () => {
    const lives = deliberateLives(figure, `ci-${figure}`, CI_DELIBERATE_LIVES);
    const share = rate(lives, qualifiesAs(figure));
    assert.ok(share >= DELIBERATE_RANGE.min && share <= DELIBERATE_RANGE.max,
      `${figure}: ${percent(share)} of deliberate lives qualified (want ${percent(DELIBERATE_RANGE.min)}-${percent(DELIBERATE_RANGE.max)})`);
  });
}

test("unfocused lives never qualify as a figure on the CI seed set", () => {
  const lives = unfocusedWithGranaries();
  for (const life of lives) assert.deepEqual(matchFigures(life), [], `${life.seed} qualified`);
});

test("cleomenes.granaries fires only for weakened lives in the famine years, in about one life in six", () => {
  const lives = unfocusedWithGranaries();
  const share = rate(lives, granariesFired);
  assert.ok(share >= GRANARIES_RANGE.min && share <= GRANARIES_RANGE.max,
    `granaries fired in ${percent(share)} of lives (want ${percent(GRANARIES_RANGE.min)}-${percent(GRANARIES_RANGE.max)})`);
  for (const life of lives) {
    for (const entry of life.journal.filter(item => item.type === "event" && item.id === GRANARIES_EVENT)) {
      assert.ok(entry.year >= FAMINE_YEARS.from && entry.year <= FAMINE_YEARS.to, `${life.seed}: granaries in ${entry.year}`);
      assert.equal(entry.source?.tokenId, "cleomenes.granaries");
    }
  }
});
