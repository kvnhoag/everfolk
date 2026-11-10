import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-0.33.0.json" with { type: "json" };
import { displayProse } from "../client/display-prose.ts";
import { buildLifeEvents } from "../client/life-events.ts";

test("reviewed prose changes preserve resolved names and unresolved tokens", () => {
  const excerpt = "agree that this should become a friendship, rather than another conversation snatched between bundles.";
  for (const person of ["Kleio", "{person:person-linen}"]) {
    assert.equal(displayProse(`You and ${person} ${excerpt}`), `You and ${person} agree to become friends.`);
  }
});

test("display changes keep numbers, identifiers and unedited surrounding text", () => {
  const before = "10 drachmas · {work:seafaring-first-work}. You leave with a correction to work through, rather than an accepted demonstration. The fee and the failed attempt have still bought a clearer question. Age 31 · Euclid";
  assert.equal(displayProse(before), "10 drachmas · {work:seafaring-first-work}. Your demonstration is rejected. You pay the fee and leave with a correction to work through. Age 31 · Euclid");
});

test("the display helper leaves useful vocabulary and mechanical distinctions alone", () => {
  const text = "Legacy · A journey to Athens. You quietly check the load. This berth pays no wage and carries no cargo-profit share. The sessions are preparation, rather than a teaching appointment. Health 15, 100 drachmas, 35%.";
  assert.equal(displayProse(text), text);
  assert.equal(displayProse("a small kindness becomes part of the trust people place in you."), "a small kindness becomes part of the trust people place in you.");
});

test("display prose is safe to apply at nested rendering boundaries", () => {
  const original = "The passage reaches Athens late, and the promised introduction does not materialize. You have made the journey, but have not heard Aristotle himself.";
  const result = displayProse(original);
  assert.equal(result, "Your boat reaches Athens late, and no one arranges the promised introduction. You do not get to hear Aristotle.");
  assert.equal(displayProse(result), result);
  assert.equal(original, "The passage reaches Athens late, and the promised introduction does not materialize. You have made the journey, but have not heard Aristotle himself.");
});

test("event-feed presentation changes never rewrite the saved life or its world", () => {
  const world = structuredClone(pack) as WorldPack;
  const life = structuredClone(createEngine(world).start("display-prose-fixture"));
  life.journal.push({ type: "outcome", id: "reviewed-outcome", age: 0, year: life.year, text: "A small kindness becomes part of the trust people place in you." });
  const worldBefore = JSON.stringify(world);
  const lifeBefore = JSON.stringify(life);
  const fingerprint = contentFingerprint(world);
  const rows = buildLifeEvents(life, world).flatMap(year => year.events);
  assert.ok(rows.some(row => row.text === "You help them."));
  assert.equal(JSON.stringify(life), lifeBefore);
  assert.equal(JSON.stringify(world), worldBefore);
  assert.equal(contentFingerprint(world), fingerprint);
});
