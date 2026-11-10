import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import { loadAnyLife } from "../client/session.ts";
import { getBuiltinCatalog, compileWorld, getArchivedBuiltinWorld } from "../server/content.ts";
import { getChoiceImpact } from "../client/choice-impact.ts";
import { selectAutomaticChoice } from "../client/yearly-focus.ts";
import type { Choice } from "../src/types.ts";
import previous from "../worlds/alexandria-0.18.0.json" with { type: "json" };

test("0.18 lives retain the exact pack and replay after new career openings", () => {
  assert.equal(contentFingerprint(previous), "fnv1a64-240a61f57608b721");
  const engine = createEngine(previous);
  let life = engine.start("opportunity-legacy");
  while (life.phase !== "ended" && life.age < 20) life = life.phase === "choice"
    ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id) : engine.advance(life);
  assert.deepEqual(loadAnyLife(engine.save(life)), life);
  const retained = getArchivedBuiltinWorld(`pack-${engine.fingerprint}`);
  assert.equal(retained?.pack.version, "0.18.0");
});

test("admin route switches close both random and deliberate recommendation entry points", () => {
  const world = getBuiltinCatalog().worlds[0];
  assert.equal(world.routes.length, 7);
  world.routes.find(route => route.flag === "workshop-recommendation")!.enabled = false;
  const pack = compileWorld(world);
  assert.equal(pack.character!.activities.some(activity => activity.id === "show-workshop-sample"), false);
  const opening = pack.events.find(event => event.id === "career-workshop-opening")!;
  assert.equal(opening.choices.length, 1);
  assert.match(opening.choices[0].text, /usual work/);
  assert.ok(pack.character!.activities.some(activity => activity.id === "train-pottery"));
});

test("fatal previews and automatic decisions use the same contextual probabilities", () => {
  const engine = createEngine(previous), life = structuredClone(engine.start("context-risk"));
  life.originId = "clerk-household";
  const risky: Choice = { id: "risky", text: "An authored hazard", outcomes: [
    { id: "fatal", text: "Fatal.", weight: 10, weightModifiers: [{ when: { type: "origin", origin: "clerk-household" }, multiplier: 3, reason: "Greater exposure" }], effects: [{ type: "end", ending: "death-in-adulthood", deathCause: "alexandrian-battle-wound" }] },
    { id: "safe", text: "Survived.", weight: 90, effects: [] },
  ] };
  const alternative: Choice = { ...risky, id: "alternative", outcomes: risky.outcomes.map(outcome => ({ ...outcome, weight: outcome.id === "fatal" ? 20 : 80, weightModifiers: undefined })) };
  assert.equal(getChoiceImpact(risky, life, engine.world).deathRisk, .25);
  assert.equal(selectAutomaticChoice([risky, alternative], engine.world, life)!.id, "alternative");
});
