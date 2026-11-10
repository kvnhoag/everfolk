import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/index.ts";
import { careerOpeningNotes } from "../client/career-openings.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
const world = createEngine(current).world;
const action = (id: string) => world.character!.activities.find(activity => activity.id === id)!;

test("recommendations name the actual new jobs or applications they help", () => {
  assert.match(careerOpeningNotes(action("show-workshop-sample"), world)[0], /Pottery workshop lead.*Wood-carving workshop lead.*Sculpture workshop lead/);
  assert.match(careerOpeningNotes(action("show-sky-calculations"), world)[0], /Patron-supported reader/);
  assert.match(careerOpeningNotes(action("prepare-official-petition"), world)[0], /Helps applications: Royal court adviser/);
  assert.match(careerOpeningNotes(action("organise-unit-supplies"), world)[0], /Royal army officer.*Royal army general/);
  assert.deepEqual(careerOpeningNotes(action("train-pottery"), world), []);
});
