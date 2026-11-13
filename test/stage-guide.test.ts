import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { WorldPack } from "../src/types.ts";
import { lifeRoadmap } from "../client/models/life-roadmap.ts";
import { stageGuide } from "../client/models/stage-guide.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const stages = lifeRoadmap(world, 9);
const guide = (id: string) => stageGuide(world, stages.find(stage => stage.id === id)!);

test("every stage opens a guide with its role, ages and what opens there", () => {
  for (const stage of stages) {
    const g = stageGuide(world, stage);
    assert.equal(g.title, stage.title);
    assert.ok(g.role.length > 0, `${stage.id} says what your role is`);
    assert.match(g.ages, /^Ages? \d+/);
  }
});

test("childhood lists real yearly actions by kind, and turning points with their actual choices", () => {
  const childhood = guide("childhood");
  const training = childhood.actions.find(group => group.id === "training")!;
  assert.ok(training.count > 0 && training.examples.includes("Read and practise writing"));
  assert.ok(childhood.turningPoints.count > 0);
  for (const example of childhood.turningPoints.examples) {
    assert.ok(example.age >= 6 && example.age <= 11, `${example.title} happens in childhood`);
    assert.ok(example.choices.length >= 2, `${example.title} shows its choices`);
  }
});

test("jobs appear in the stage they open in, and examples never carry price tails", () => {
  const adulthood = guide("adulthood");
  assert.ok(adulthood.jobs.count > 0);
  const firstJobAge = Math.min(...world.character!.jobs.map(job => job.minAge ?? 0));
  assert.ok(stages.some(stage => stage.fromAge <= firstJobAge && (stage.toAge ?? 999) >= firstJobAge && stageGuide(world, stage).jobs.count > 0));
  for (const stage of stages) for (const group of stageGuide(world, stage).actions) {
    for (const example of group.examples) assert.doesNotMatch(example, /[—-]\s+\d+\s+drachmas$/);
  }
});
