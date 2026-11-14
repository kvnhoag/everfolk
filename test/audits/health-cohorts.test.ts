import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../../src/index.ts";
import type { WorldPack } from "../../src/types.ts";
import current from "../../worlds/alexandria-sample.json" with { type: "json" };

const load = (name: string): WorldPack => JSON.parse(readFileSync(new URL(`../../worlds/demo/${name}.json`, import.meta.url), "utf8"));

test("in the new world no severe illness kills within two years of its onset, whatever care is chosen", () => {
  const world = load("alexandria-lives-8"), engine = createEngine(world);
  let onsets = 0, deaths = 0;
  for (const choice of ["rest-and-care", "carry-on"]) {
    for (let index = 0; index < 40; index++) {
      let life = engine.start(`mild-${choice}-${index}`);
      while (life.phase !== "ended") {
        if (life.phase === "choice") {
          const options = engine.getChoices(life);
          life = engine.choose(life, (options.find(option => option.id === choice) ?? options[0]).id);
        } else life = engine.advance(life);
      }
      const onset = life.journal.filter(entry => entry.id.startsWith("health-severe-onset-"));
      onsets += onset.length;
      const death = life.journal.find(entry => entry.id.startsWith("health-severe-deterioration-"));
      if (!death) continue;
      deaths++;
      const began = onset.filter(entry => entry.age <= death.age).at(-1)!;
      assert.ok(death.age - began.age >= 2, `${life.seed}: onset at ${began.age}, fatal at ${death.age}`);
    }
  }
  assert.ok(onsets > 0 && deaths > 0, "the cohort sees both onsets and deaths");
});

test("a current-world cohort attributes every safe-path death to a previously warned active condition", t => {
  const engine = createEngine(current);
  const totals = { rest: { years: 0, deaths: 0, records: 0, prompts: 0 }, ignore: { years: 0, deaths: 0, records: 0, prompts: 0 } };
  for (const policy of ["rest", "ignore"] as const) for (let seed = 0; seed < 40; seed++) {
    let state = engine.start(`causal-health-audit-${seed}`);
    for (let step = 0; step < 700 && state.phase !== "ended"; step++) {
      if (state.phase === "choice") {
        const choices = engine.getChoices(state);
        const isCare = state.pendingEventId === current.health.careDecision;
        if (isCare) totals[policy].prompts++;
        const choice = isCare ? choices.find(choice => choice.id === (policy === "rest" ? "rest-and-care" : "carry-on"))
          : choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end")));
        assert.ok(choice, `A safe or free-care choice must exist at ${state.pendingEventId}.`);
        state = engine.choose(state, choice.id);
      } else {
        const before = state;
        state = engine.advance(state);
        if (state.phase === "ended" && engine.world.endings.find(ending => ending.id === state.endingId)?.kind === "death") {
          assert.equal(state.deathCauseKind, "condition", state.seed);
          const cause = before.health!.conditions.map(active => current.health.conditions.find(condition => condition.id === active.id)!)
            .find(condition => condition.deathCause === state.deathCauseId);
          assert.ok(cause, `${state.seed}: a death cause must already be active before the fatal advance.`);
          const onsetIndex = state.journal.findIndex(entry => entry.id === `health-onset-${cause.id}`);
          const endingIndex = state.journal.findIndex(entry => entry.type === "ending");
          assert.ok(onsetIndex >= 0 && onsetIndex < endingIndex, state.seed);
          assert.ok(before.journal.some(entry => entry.id === `health-onset-${cause.id}`), `${state.seed}: the warning must precede the fatal command.`);
          assert.ok(state.deathCauseContext!.includes(cause.title), state.seed);
          assert.ok(state.stats.health <= cause.fatalHealthThreshold, state.seed);
          totals[policy].deaths++;
        }
      }
    }
    assert.equal(state.phase, "ended", state.seed);
    totals[policy].years += state.age;
    if (state.endingId === "end-of-record") {
      totals[policy].records++;
      assert.equal(state.deathCauseId, undefined);
    }
    assert.deepEqual(engine.replay(state.seed, state.commands), state);
  }
  assert.ok(totals.rest.deaths > 0 && totals.ignore.deaths > 0, "The audit must exercise actual condition deaths.");
  // A fixed synthetic-play cohort checks attribution and records behavior; it
  // is not a historical mortality estimate or a calibrated treatment effect.
  t.diagnostic(`40 fixed seeds per policy: ${JSON.stringify(totals)}`);
});
