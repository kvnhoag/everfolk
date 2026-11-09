import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { getNetWorth } from "../src/economy.ts";
import type { BirthRollStat } from "../client/birth-stat-roll.ts";
import {
  BIRTH_DIGIT_FRAME_MS, BIRTH_ROLL_DURATION_MS,
  canRepresentBirthReelValue, getBirthDigitReels, getBirthReelLayout, getBirthRollFrame,
  getBirthRollStats, getBirthRollTiming, getCosmeticBirthDigits,
} from "../client/birth-stat-roll.ts";
import {
  hasBirthStatsBeenRevealed, hasLifeBegun, persistBirthStatsReveal,
} from "../client/session.ts";
import type { StorageLike } from "../client/session.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import fixedStart from "../worlds/alexandria-0.5.1.json" with { type: "json" };

function memoryStorage(): StorageLike {
  const entries = new Map<string, string>();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: key => { entries.delete(key); },
  };
}

test("every reel contains decimal digits and a valid independent travel direction", () => {
  const stat: BirthRollStat = { id: "money", label: "Wealth", value: 120, range: { min: 20, max: 200 }, currency: "dr" };
  assert.ok(BIRTH_DIGIT_FRAME_MS > 0 && BIRTH_DIGIT_FRAME_MS < BIRTH_ROLL_DURATION_MS);
  for (let frame = 0; frame < 80; frame++) {
    const digits = getCosmeticBirthDigits(stat, "decimal-reels", frame);
    assert.equal(digits.length, 3, "The known currency envelope reserves three independent places.");
    for (const digit of digits) {
      assert.ok(Number.isInteger(digit.digit) && digit.digit >= 0 && digit.digit <= 9);
      assert.ok(Number.isInteger(digit.previous) && digit.previous >= 0 && digit.previous <= 9);
      assert.ok(digit.direction === "up" || digit.direction === "down");
    }
  }
});

test("fixed zero, fixed decimal and missing ranges still produce moving cosmetic digits", () => {
  const stats: BirthRollStat[] = [
    { id: "zero", label: "Knowledge", value: 0, range: { min: 0, max: 0 } },
    { id: "decimal", label: "Decimal", value: 70.5, range: { min: 70.5, max: 70.5 } },
    { id: "without-range", label: "Resources", value: 5 },
  ];
  for (const stat of stats) {
    const patterns = new Set<string>();
    const seen = new Set<number>();
    for (let frame = 0; frame < 50; frame++) {
      const digits = getCosmeticBirthDigits(stat, "fixed-values-must-roll", frame);
      assert.ok(digits.length >= 2);
      patterns.add(digits.map(item => item.digit).join(""));
      digits.forEach(item => seen.add(item.digit));
    }
    assert.equal(patterns.size, 10, `${stat.id} cycles through the ten adjacent positions without random jumps.`);
    assert.ok(seen.size >= 8, `${stat.id} should cycle through many digits.`);
  }
});

test("cosmetic reels are reproducible and independent of the official stat value", () => {
  const stat: BirthRollStat = { id: "health", label: "Health", value: 61, range: { min: 60, max: 80 } };
  for (let frame = 0; frame < 60; frame++) {
    const expected = getCosmeticBirthDigits(stat, "same-reel-seed", frame);
    assert.deepEqual(getCosmeticBirthDigits(stat, "same-reel-seed", frame), expected);
    assert.deepEqual(getCosmeticBirthDigits({ ...stat, value: 80 }, "same-reel-seed", frame), expected);
    assert.deepEqual(getCosmeticBirthDigits({ ...stat, value: 987654321 }, "same-reel-seed", frame), expected,
      "Even the number of final-value digits must not affect the cosmetic sequence.");
  }
  const noRange: BirthRollStat = { id: "unknown", label: "Unknown", value: 0 };
  assert.deepEqual(getCosmeticBirthDigits(noRange, "no-range", 8),
    getCosmeticBirthDigits({ ...noRange, value: -987654321.5 }, "no-range", 8));
});

test("individual places keep their own direction for the entire roll", () => {
  const stat: BirthRollStat = { id: "four-places", label: "Amount", value: 1234, range: { min: 0, max: 9999 } };
  const frames = Array.from({ length: 80 }, (_, frame) => getCosmeticBirthDigits(stat, "independent-places", frame));
  assert.equal(frames[0].length, 4);
  for (let index = 0; index < 4; index++) {
    assert.ok(new Set(frames.map(frame => frame[index].digit)).size >= 8, `Place ${index} should move independently.`);
    assert.equal(new Set(frames.map(frame => frame[index].direction)).size, 1, "A reel must never reverse direction.");
  }
  assert.ok(frames.some(frame => new Set(frame.map(item => item.direction)).size > 1),
    "Different places can turn in opposite directions while each keeps its own direction.");
  assert.ok(frames.some(frame => new Set(frame.map(item => item.digit)).size > 1),
    "The result must not copy one changing digit across all positions.");
});

test("each moving reel starts from its own preceding displayed digit", () => {
  const stat: BirthRollStat = { id: "continuity", label: "Wealth", value: 90, range: { min: 10, max: 200 }, currency: "dr" };
  for (let frame = 1; frame < 40; frame++) {
    const before = getCosmeticBirthDigits(stat, "continuous-reel", frame - 1);
    const next = getCosmeticBirthDigits(stat, "continuous-reel", frame);
    assert.deepEqual(next.map(item => item.previous), before.map(item => item.digit));
    for (let place = 0; place < next.length; place++) {
      const step = next[place].direction === "up" ? 1 : -1;
      assert.equal(next[place].digit, (before[place].digit + step + 10) % 10,
        "Every transition uses the neighboring digit, including 9-to-0 wraps.");
    }
  }
});

test("continuous reels retain direction and slow monotonically into their final digit", () => {
  const stat: BirthRollStat = { id: "settling", label: "Health", value: 70, range: { min: 0, max: 100 } };
  for (let card = 0; card < 4; card++) {
    const { startsAt, settlesAt } = getBirthRollTiming(card, 4);
    const frames = Array.from({ length: 11 }, (_, step) =>
      getBirthDigitReels(stat, "spins-into-result", startsAt + (settlesAt - startsAt) * step / 10, card, 4));
    for (let place = 0; place < frames[0].length; place++) {
      const initial = frames[0][place];
      let previousSpeed = Infinity;
      for (let step = 1; step < frames.length; step++) {
        const before = frames[step - 1][place], next = frames[step][place];
        assert.equal(next.direction, initial.direction);
        const travel = next.position - before.position;
        assert.ok(initial.direction === "up" ? travel > 0 : travel < 0, "No reverse step is permitted.");
        assert.ok(Math.abs(travel) <= previousSpeed + 1e-10, "Equal-time travel decreases as the reel slows.");
        previousSpeed = Math.abs(travel);
        assert.ok(next.fraction >= 0 && next.fraction < 1);
        assert.equal(next.glyphs[0], (next.glyphs[1] + 9) % 10);
        assert.equal(next.glyphs[2], (next.glyphs[1] + 1) % 10);
      }
      const last = frames.at(-1)![place];
      assert.ok(Math.abs(last.position - initial.position) >= 20, "A spin includes at least two full rotations.");
      assert.equal(last.fraction, 0);
      assert.equal(last.glyphs[1], last.finalDigit);
    }
    assert.deepEqual(getBirthDigitReels(stat, "spins-into-result", settlesAt + 1_000, card, 4), frames.at(-1));
  }
});

test("reels wait for their existing staggered starts and land at their settlement boundaries", () => {
  const stat: BirthRollStat = { id: "stagger", label: "Knowledge", value: 0, range: { min: 0, max: 0 } };
  for (const [card, expected] of [1475, 2050, 2625, 3200].entries()) {
    const timing = getBirthRollTiming(card, 4);
    assert.equal(timing.settlesAt, expected);
    assert.deepEqual(getBirthDigitReels(stat, "timed-reels", timing.startsAt - 100, card, 4),
      getBirthDigitReels(stat, "timed-reels", timing.startsAt, card, 4));
    const final = getBirthDigitReels(stat, "timed-reels", timing.settlesAt, card, 4);
    assert.ok(final.every(reel => reel.glyphs[1] === 0 && reel.fraction === 0));
    assert.notDeepEqual(getBirthDigitReels(stat, "timed-reels", timing.startsAt + 100, card, 4), final);
  }
});

test("public reel layouts preserve leading places, decimal positions and signs without using the final value", () => {
  for (const stat of [
    { id: "zero", label: "Zero", value: 0, range: { min: 0, max: 0 } },
    { id: "decimal", label: "Decimal", value: 70.5, range: { min: 70.5, max: 70.5 } },
    { id: "signed", label: "Signed", value: -70, range: { min: -100, max: 10 } },
    { id: "unknown", label: "Unknown", value: 3 },
  ] as BirthRollStat[]) {
    assert.deepEqual(getBirthReelLayout(stat), getBirthReelLayout({ ...stat, value: -9876543210.75 }));
  }
  assert.deepEqual(getBirthReelLayout({ id: "decimal", label: "Decimal", value: 70.5, range: { min: 70.5, max: 70.5 } }),
    { integerPlaces: 2, fractionPlaces: 1, hasSign: false, digitCount: 3 });
  assert.deepEqual(getBirthReelLayout({ id: "signed", label: "Signed", value: -70, range: { min: -100, max: 10 } }),
    { integerPlaces: 3, fractionPlaces: 0, hasSign: true, digitCount: 3 });
});

test("zero, padded money, signed values and fixed decimals land on their exact magnitude digits", () => {
  const cases: BirthRollStat[] = [
    { id: "zero", label: "Knowledge", value: 0, range: { min: 0, max: 0 } },
    { id: "two", label: "Health", value: 70, range: { min: 0, max: 100 } },
    { id: "hundred", label: "Health", value: 100, range: { min: 0, max: 100 } },
    { id: "money", label: "Wealth", value: 120, range: { min: 20, max: 200 }, currency: "dr" },
    { id: "negative", label: "Signed", value: -70, range: { min: -100, max: 10 } },
    { id: "decimal", label: "Fixed", value: 70.5, range: { min: 70.5, max: 70.5 } },
    { id: "fraction", label: "Fraction", value: .05, range: { min: .05, max: .05 } },
  ];
  for (const stat of cases) {
    const layout = getBirthReelLayout(stat);
    assert.equal(canRepresentBirthReelValue(stat, layout), true, stat.id);
    const expected = Math.abs(stat.value).toFixed(layout.fractionPlaces).replace(".", "").padStart(layout.digitCount, "0");
    const reels = getBirthDigitReels(stat, "exact-landing", BIRTH_ROLL_DURATION_MS, 3, 4);
    assert.equal(reels.map(reel => reel.glyphs[1]).join(""), expected, stat.id);
    assert.equal(reels.map(reel => reel.finalDigit).join(""), expected, stat.id);
  }
  const outside = { id: "unknown", label: "Unknown", value: -9876543210.75 };
  assert.equal(canRepresentBirthReelValue(outside), false, "An unknown oversized format uses the exact settled formatter.");
  assert.equal(canRepresentBirthReelValue({ ...outside, value: 70.5 }), false, "An unreserved decimal does not get rounded.");
});

test("public range envelopes bound reel width without exposing final-value formatting", () => {
  const cases: BirthRollStat[] = [
    { id: "zero", label: "Zero", value: 0, range: { min: 0, max: 0 } },
    { id: "negative", label: "Signed", value: -70, range: { min: -100, max: 10 } },
    { id: "wide", label: "Wide", value: 0, range: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } },
    { id: "no-range", label: "No range", value: 9876543210 },
  ];
  for (const stat of cases) {
    const digits = getCosmeticBirthDigits(stat, "safe-width", 1);
    assert.ok(digits.length >= 2 && digits.length <= 16);
    assert.deepEqual(digits, getCosmeticBirthDigits({ ...stat, value: 1 }, "safe-width", 1));
  }
});

test("each card reveals at its settlement boundary and the last card finishes the reveal", () => {
  for (const [index, settlesAt] of [1475, 2050, 2625, 3200].entries()) {
    assert.equal(getBirthRollFrame(settlesAt - 1, 4).phases[index], "rolling");
    assert.equal(getBirthRollFrame(settlesAt, 4).phases[index], "settled");
  }
  assert.equal(getBirthRollFrame(BIRTH_ROLL_DURATION_MS - 1, 4).complete, false);
  assert.equal(getBirthRollFrame(BIRTH_ROLL_DURATION_MS, 4).complete, true);
});

test("cosmetic frames never change exact final stats, economy, RNG or saved commands", () => {
  for (const pack of [current, fixedStart]) {
    const engine = createEngine(pack);
    const life = engine.start("exact-value-after-reels");
    const before = engine.save(life);
    for (const stat of getBirthRollStats(engine.world, life)) {
      for (let frame = 0; frame < 60; frame++) getCosmeticBirthDigits(stat, life.seed, frame);
      for (let elapsed = 0; elapsed <= BIRTH_ROLL_DURATION_MS; elapsed += 16) getBirthDigitReels(stat, life.seed, elapsed, 0, 4);
      assert.equal(stat.value, engine.world.economy?.stat === stat.id ? getNetWorth(engine.world, life) : life.stats[stat.id]);
    }
    assert.equal(engine.save(life), before);
    assert.deepEqual(engine.load(before), life);
    assert.equal(life.commands.length, 0);
  }
});

test("restoring a completed roll persists presentation without beginning or rerolling the life", () => {
  const engine = createEngine(current);
  const life = engine.start("automatic-reveal-reload");
  const storage = memoryStorage();
  const saved = engine.save(life);
  assert.equal(hasBirthStatsBeenRevealed(storage, life), false);
  for (const stat of getBirthRollStats(engine.world, life)) getCosmeticBirthDigits(stat, life.seed, 12);
  assert.equal(hasBirthStatsBeenRevealed(storage, life), false, "Animating alone does not mark a reveal complete.");
  persistBirthStatsReveal(storage, life, true);
  const restored = engine.load(saved);
  assert.equal(hasBirthStatsBeenRevealed(storage, restored), true);
  assert.equal(hasLifeBegun(storage, restored), false);
  assert.deepEqual(restored, life);
  assert.equal(hasBirthStatsBeenRevealed(storage, engine.start("different-automatic-reveal")), false);
});
