import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { buildLifeEvents } from "../client/models/life-events.ts";
import { buildImportantLifeEvents } from "../client/models/important-life-events.ts";
import { resolveLifeScenes } from "../client/models/scene-model.ts";
import shipped from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import type { LifeState, WorldPack } from "../src/types.ts";

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);

/** The first sampled life in which a failed flood reaches a child, stopped in that year. */
function childInFlood(): LifeState {
  for (let i = 0; i < 200; i++) {
    let state = engine.start(`screen-flood-${i}`);
    while (state.phase !== "ended" && state.age < 12) {
      if (state.journal.some(entry => entry.id === "flood-failure" && entry.age === state.age)) return state;
      state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
    }
  }
  throw new Error("No sampled childhood had a failed flood.");
}

const life = childInFlood();
const response = life.journal.find(entry => entry.type === "outcome" && entry.age === life.age && entry.id.startsWith("household-"))!;

test("the life feed shows the household's response under the event's title", () => {
  const rows = buildLifeEvents(life, world).flatMap(year => year.events);
  const row = rows.find(item => item.text === response.text);
  assert.ok(row, "the response is in the feed");
  assert.equal(row.title, "The flood fails");
});

test("the year scene shows the household's response as this year's result", () => {
  const scenes = resolveLifeScenes(life, world);
  assert.ok(scenes.some(scene => scene.kind === "outcome" && scene.eventId === "flood-failure"), "a result scene for the flood");
});

test("the important-events summary builds with household responses", () => {
  assert.doesNotThrow(() => buildImportantLifeEvents(life, world));
});
