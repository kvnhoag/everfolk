import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { applyCapability } from "../src/capabilities/engine.ts";
import { practiceBonus } from "../src/paths/index.ts";
import type { FieldId } from "../src/paths/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);

function sixteen(seed: string): LifeState {
  let life = engine.start(seed);
  while (life.age < 16 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

function drawn(life: LifeState, field: FieldId, affinity: number): LifeState {
  const copy = structuredClone(life) as LifeState;
  copy.paths!.affinity = { ...copy.paths!.affinity, [field]: affinity };
  return copy;
}

const bases = Array.from({ length: 24 }, (_, i) => sixteen(`practice-${i}`)).filter(life => life.phase !== "ended");

test("small practice gains still grow with affinity, on average by the stated share", () => {
  const base = drawn(bases[0], "ceramics", 100);
  let total = 0;
  for (let age = 16; age < 216; age++) total += practiceBonus(world, { ...base, age }, "pottery", 3) - 3;
  const mean = total / 200;
  assert.ok(mean > 0.45 && mean < 0.75, `mean bonus on +3 at full affinity: ${mean}`);
  assert.equal(practiceBonus(world, base, "pottery", 3), practiceBonus(world, base, "pottery", 3), "deterministic");
  assert.equal(practiceBonus(world, drawn(bases[0], "ceramics", 0), "pottery", 3), 3);
});

test("deliberate practice actions grow faster in a field the life is drawn to", () => {
  let drawnTotal = 0, plainTotal = 0, trials = 0;
  for (const life of bases) {
    const strong = drawn(life, "ceramics", 100), plain = drawn(life, "ceramics", 0);
    const available = engine.getActivities(plain).find(activity => activity.id === "v-practice-pottery")?.available;
    if (!available) continue;
    trials++;
    drawnTotal += engine.act(strong, "v-practice-pottery").character!.skills.pottery - strong.character!.skills.pottery;
    plainTotal += engine.act(plain, "v-practice-pottery").character!.skills.pottery - plain.character!.skills.pottery;
  }
  assert.ok(trials >= 10, `${trials} trials`);
  assert.ok(drawnTotal > plainTotal, `drawn ${drawnTotal} vs plain ${plainTotal}`);
});

test("skill-atlas work grows faster in a field the life is drawn to, and counts as practice", () => {
  let drawnTotal = 0, plainTotal = 0, trials = 0;
  for (const life of bases) {
    const strong = drawn(life, "clothing", 100), plain = drawn(life, "clothing", 0);
    try {
      applyCapability(world, strong, "A1");
      applyCapability(world, plain, "A1");
    } catch { continue; }
    trials++;
    drawnTotal += strong.character!.skills.craft;
    plainTotal += plain.character!.skills.craft;
    assert.equal(strong.paths!.lastPractice.clothing, strong.age, "work marks the field as practised");
  }
  assert.ok(trials >= 10, `${trials} trials`);
  assert.ok(drawnTotal > plainTotal, `drawn ${drawnTotal} vs plain ${plainTotal}`);
});
