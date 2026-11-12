import assert from "node:assert/strict";
import test from "node:test";
import { freeLifeMoments } from "../client/models/free-life-moments.ts";
import type { StageRecord } from "../chain/stage-figures.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const record = (stageId: string, title: string, fromAge: number, toAge: number): StageRecord => ({
  stageId, title, fromAge, toAge, district: "rhakotis", field: "farming", tier: 1, jobId: null,
  topSkills: { farming: 10 }, nodes: [], reputation: 0, accomplishments: [], mentors: [],
});
const world = { version: "alexandria-lives-5" } as WorldPack;
const life = (records?: StageRecord[]) => ({
  seed: "moments", originId: "delta-newcomers", stats: { health: 50 },
  character: { name: "Herais", sex: "female" }, stageRecords: records,
}) as unknown as LifeState;

test("a free life's pack shows one moment card per stage it lived, in order", () => {
  const moments = freeLifeMoments(life([record("infancy", "Child of a farm", 0, 2), record("early-childhood", "Child of a farm", 3, 11)]), world);
  assert.deepEqual(moments.map(moment => moment.stageId), ["infancy", "early-childhood"]);
  assert.deepEqual(moments.map(moment => moment.stageTitle), ["Infancy", "Early childhood"]);
  assert.equal(moments[0].title, "Child of a farm", "A generic stage reads as what the player was, not a tier code.");
  assert.equal(moments[1].ages, "Ages 3–11");
  assert.ok(moments.every(moment => moment.media.startsWith("/")), "Every moment has a portrait.");
  assert.ok(moments.every(moment => moment.title.length > 0));
});

test("a life with no recorded stages has no moments", () => {
  assert.deepEqual(freeLifeMoments(life(undefined), world), []);
});
