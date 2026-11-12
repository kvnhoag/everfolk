import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { lifeStageView } from "../src/life-stages/index.ts";
import { buildLifeStageWorld } from "../src/vocations/life-stage-world.ts";
import { LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import shipped from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import type { LifeState, WorldPack } from "../src/types.ts";

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const scopeOf = new Map(world.events.map(event => [event.id, event.scope ?? "personal"]));
const SCOPE_START = { personal: 3, work: 12, community: 14, household: 16 } as const;

interface Played { state: LifeState; offered: Array<[number, string]> }

/** Plays a whole life with a rotating choice, recording every decision offered and its age. */
function live(seed: string, pick = 0): Played {
  let state = engine.start(seed);
  const offered: Array<[number, string]> = [];
  for (let guard = 0; state.phase !== "ended" && guard < 600; guard++) {
    if (state.phase === "choice") {
      offered.push([state.age, state.pendingEventId!]);
      const choices = engine.getChoices(state);
      state = engine.choose(state, choices[(pick + guard) % choices.length].id);
    } else state = engine.advance(state);
  }
  return { state, offered };
}

const lives = Array.from({ length: 80 }, (_, i) => live(`stage-world-${i}`, i));

test("the shipped free-play world is the current build with life stages", () => {
  assert.equal(LIVES_WORLD_VERSION, "alexandria-lives-7");
  assert.equal(world.version, "alexandria-lives-7");
  assert.deepEqual(buildLifeStageWorld(base as unknown as WorldPack), world);
  assert.ok(world.lifeStages);
  assert.equal((retained as unknown as WorldPack).version, "alexandria-lives-3");
  assert.equal((retained as unknown as WorldPack).lifeStages, undefined, "lives-3 saves keep their exact rules");
});

test("both the new and the retained free-play revisions load for their saves", async () => {
  assert.equal((await loadLifeWorld("alexandria-lives-7")).version, "alexandria-lives-7");
  assert.equal((await loadLifeWorld("alexandria-lives-3")).version, "alexandria-lives-3");
});

test("no decision is offered in infancy, and none below its scope's first stage", () => {
  let decisions = 0;
  for (const { offered } of lives) {
    for (const [age, id] of offered) {
      decisions++;
      assert.ok(age >= 3, `${id} offered in infancy at age ${age}`);
      const scope = scopeOf.get(id)!;
      assert.ok(age >= SCOPE_START[scope], `${scope} decision ${id} offered at age ${age}`);
    }
  }
  assert.ok(decisions > 1000, `enough decisions were sampled (${decisions})`);
});

test("a child in a failed-flood year lives with the household's response, without a choice", () => {
  const children = lives.flatMap(({ state }) => state.journal
    .map((entry, i) => ({ entry, next: state.journal[i + 1] }))
    .filter(({ entry }) => entry.type === "event" && entry.id === "flood-failure" && entry.age < 16));
  assert.ok(children.length > 0, "some sampled childhoods include a failed flood");
  for (const { entry, next } of children) {
    assert.match(entry.text, /grown-ups of your household decide/);
    assert.equal(next.type, "outcome");
    assert.match(next.id, /^household-(shares-grain|sells-silver|cuts-portions)$/);
  }
  const adults = lives.flatMap(({ offered }) => offered.filter(([age, id]) => id === "flood-failure" && age >= 16));
  assert.ok(adults.length > 0, "adults still decide the flood");
});

test("a child in a levy year is affected by the household's answer to the levy", () => {
  const children = lives.flatMap(({ state }) => state.journal
    .map((entry, i) => ({ entry, next: state.journal[i + 1] }))
    .filter(({ entry }) => entry.type === "event" && entry.id === "levy-call" && entry.age < 16));
  assert.ok(children.length > 0, "some sampled childhoods include a levy");
  for (const { next } of children) assert.match(next.id, /^(household-sends-provisions|household-pays-substitute|relative-taken-for-drill)$/);
});

test("a sick child's care is arranged by the household", () => {
  const cared = lives.flatMap(({ state }) => state.journal.filter(entry => entry.type === "outcome" && /^household-(pays-healer|nurses-at-home)$/.test(entry.id)));
  assert.ok(cared.length > 0);
  for (const entry of cared) assert.ok(entry.age < 16);
});

test("every event outside dated history and interrupts has a time frame", () => {
  const interrupts = new Set([world.health?.careDecision, ...Object.values(world.economy?.moneylender?.events ?? {})]);
  for (const event of world.events) {
    if (event.trigger.type === "year" || interrupts.has(event.id)) continue;
    assert.ok(event.stages?.length, `${event.id} has stages`);
  }
});

test("household responses have world-unique IDs, so screens can attribute them", () => {
  const ids = world.events.flatMap(event => [
    ...event.choices.flatMap(choice => choice.outcomes.map(outcome => outcome.id)),
    ...(event.dependent?.responses.map(response => response.id) ?? []),
  ]);
  const responses = world.events.flatMap(event => event.dependent?.responses.map(response => response.id) ?? []);
  for (const id of responses) assert.equal(ids.filter(other => other === id).length, 1, `${id} is unique`);
});

test("the stage view tells screens what the player decides", () => {
  assert.deepEqual(lifeStageView(world, 1), { id: "infancy", title: "Infancy", decides: [] });
  assert.deepEqual(lifeStageView(world, 9)?.decides, ["personal"]);
  assert.deepEqual(lifeStageView(world, 30)?.decides, ["personal", "work", "community", "household"]);
});

test("staged lives replay exactly", () => {
  const { state } = lives[3];
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
});
