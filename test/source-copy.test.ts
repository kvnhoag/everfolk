import assert from "node:assert/strict";
import test from "node:test";
import { modelNote, sourceScope, sourceSummary } from "../client/source-copy.ts";
import pack from "../worlds/alexandria-0.33.0.json" with { type: "json" };
import { contentFingerprint } from "../src/random.ts";

test("shared game note is removed only from the end of a source's scope", () => {
  const note = "Characters, accomplishment titles, wages, prices and probabilities in the game are authored fiction.";
  const limitation = "Berenike is on the Red Sea, not Alexandria.";
  assert.equal(sourceScope(`${limitation} ${note}`), limitation);
  assert.equal(sourceScope(limitation), limitation);
  assert.equal(sourceScope(`${note} This later qualification is specific.`), `${note} This later qualification is specific.`);
});

test("reviewed summaries do not override custom wording or change source records", () => {
  const before = JSON.stringify(pack);
  const fingerprint = contentFingerprint(pack);
  const rendered = pack.sources.map(source => ({ ...source, summary: sourceSummary(source.summary), limitations: sourceScope(source.limitations) }));
  assert.ok(rendered.some((source, i) => source.summary !== pack.sources[i].summary));
  assert.ok(rendered.some((source, i) => source.limitations !== pack.sources[i].limitations));
  rendered.forEach((source, i) => {
    const original = pack.sources[i];
    assert.deepEqual([source.id, source.title, source.url, source.period, source.geography, source.publisher], [original.id, original.title, original.url, original.period, original.geography, original.publisher]);
  });
  const custom = "A revised source note: 13 BCE, 25 years and uncertain provenance.";
  assert.equal(sourceSummary(custom), custom);
  assert.equal(JSON.stringify(pack), before);
  assert.equal(contentFingerprint(pack), fingerprint);
});

test("health explanations keep the age threshold and the limits of the comparison data", () => {
  const current = pack.health.description;
  const retained = current.replace("Exact mortality for the Egyptian coast in this era is unknown.", "Exact mortality for Ptolemaic Alexandria is unknown.");
  for (const original of [current, retained]) {
    const rewritten = modelNote(original);
    assert.notEqual(rewritten, original);
    assert.deepEqual(rewritten.match(/\d+/g), original.match(/\d+/g));
    assert.ok(rewritten.includes(original.match(/Exact mortality[^.]+\./)![0]));
    assert.match(rewritten, /Roman Egyptian female/);
    assert.match(rewritten, /game rules/);
  }
  const custom = "Custom mortality model: from age 21, risks are unknown.";
  assert.equal(modelNote(custom), custom);
});
