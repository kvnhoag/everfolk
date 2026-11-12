import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, WorldPack } from "../src/types.ts";
import { compactSkillPreview, compactSkillView, choiceProgressFeedback } from "../client/models/compact-skill.ts";

function fixture(choice: Choice): WorldPack {
  return {
    schemaVersion: 1, id: "compact-skill-fixture", version: "1", title: "Skill fixture", description: "Synthetic UI rules.", startYear: -66, maxAge: 100,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "A beginning.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "opening", title: "A chance", text: "Choose.", trigger: { type: "age", at: 0 }, choices: [choice] }],
    endings: [{ id: "end", title: "Life complete", text: "A life.", kind: "death" }], defaultEnding: "end",
    character: {
      skills: {
        craft: { label: "Craft", min: 0, max: 100, initial: 25, branch: "Crafts" },
        sculpture: { label: "Sculpture", min: 0, max: 100, initial: 98, prerequisites: { craft: 20 }, branch: "Crafts" },
        music: { label: "Music", min: 0, max: 100, initial: 0, branch: "Performance" },
      }, jobs: [], partners: [], activities: [{ id: "rest", text: "Rest", category: "family", outcomes: [{ id: "rested", text: "Rested.", weight: 1, effects: [] }] }], childNames: ["Child"],
      deathCauses: [{ id: "old", title: "Old age", text: "Life ends.", weight: 1 }], deathCauseDescription: "Fictional fixture.",
    },
  };
}

test("choice previews retain the same training ages and locks as the full activity panel", () => {
  const choice: Choice = { id: "shape", text: "Try shaping", outcomes: [{ id: "shaped", text: "You try a shape.", weight: 1, effects: [{ type: "skill", skill: "sculpture", delta: 1 }] }] };
  const world = fixture(choice);
  world.character!.skills.sculpture.trainingActivity = "train-sculpture";
  world.character!.activities.push({ id: "train-sculpture", text: "Practise sculpture", category: "training", minAge: 12,
    outcomes: [{ id: "practised", text: "You practise.", weight: 1, effects: [{ type: "skill", skill: "sculpture", delta: 2 }] }] });
  const engine = createEngine(world), life = engine.start("preview-age-gate");
  const popup = compactSkillPreview(world, life, choice);
  const full = compactSkillPreview(world, life, choice, engine.getActivities(life));
  const selected = popup.nodes.find(node => node.id === "sculpture")!;
  assert.equal(selected.minAge, 12);
  assert.equal(selected.state, "locked");
  assert.equal(selected.ageMet, false);
  assert.deepEqual(popup.nodes.map(node => [node.id, node.minAge, node.state, node.requirements]), full.nodes.map(node => [node.id, node.minAge, node.state, node.requirements]));
});
const option = (effects: Choice["outcomes"][number]["effects"]): Choice => ({ id: "make", text: "Make a figure", outcomes: [{ id: "made", text: "A figure is made.", weight: 1, effects }] });

test("ordinary choice skill previews match bounded accepted results and illuminate prerequisite context without changing the life", () => {
  const choice = option([{ type: "skill", skill: "sculpture", delta: 8 }]);
  const world = fixture(choice), engine = createEngine(world), before = engine.start("ordinary-skill");
  const snapshot = structuredClone(before);
  const preview = compactSkillPreview(world, before, choice);
  assert.deepEqual([...preview.affected], ["sculpture"]);
  assert.deepEqual([...preview.context].sort(), ["craft", "sculpture"]);
  assert.equal(preview.changes[0].min, 2);
  assert.deepEqual(before, snapshot);
  const after = engine.choose(before, choice.id);
  assert.equal(preview.changes[0].min, after.character!.skills.sculpture - before.character!.skills.sculpture);
  const feedback = choiceProgressFeedback(before, after, world)!;
  assert.equal(feedback.skills[0].delta, 2);
  assert.equal(feedback.skills[0].value, 100);
});

test("skill effects after an ending never light up a branch or appear in observed feedback", () => {
  const choice = option([{ type: "end", ending: "end" }, { type: "skill", skill: "music", delta: 10 }]);
  const world = fixture(choice), engine = createEngine(world), before = engine.start("terminal-preview");
  assert.deepEqual(compactSkillPreview(world, before, choice).changes, []);
  assert.equal(choiceProgressFeedback(before, engine.choose(before, choice.id), world), null);
});

test("feedback ignores a fresh seed and ordinary yearly progression", () => {
  const choice = option([{ type: "skill", skill: "music", delta: 4 }]);
  const world = fixture(choice), engine = createEngine(world), before = engine.start("first-life");
  assert.equal(choiceProgressFeedback(before, engine.choose(engine.start("other-life"), choice.id), world), null);
  const after = engine.choose(before, choice.id);
  assert.equal(choiceProgressFeedback(after, engine.advance(after), world), null);
});

test("the compact view defaults to one developed branch, honors a manual selection, and follows an existing occupation", () => {
  const choice = option([]), world = fixture(choice);
  world.character!.jobs.push({ id: "performer", title: "Performer", description: "Perform music.", minAge: 0, requirements: { music: 10 }, yearlyEffects: [] });
  const engine = createEngine(world), life = engine.start("one-branch");
  const model = compactSkillPreview(world, life);
  assert.equal(compactSkillView(model, life).branch, "Crafts");
  assert.deepEqual(compactSkillView(model, life).branches, ["Crafts"]);
  assert.deepEqual(compactSkillView(model, life, "Performance").nodes.map(node => node.id), ["music"]);
  assert.equal(compactSkillView(model, life, "removed-branch").branch, "Crafts");
  const employed = { ...life, character: { ...life.character!, jobId: "performer" } };
  assert.equal(compactSkillView(compactSkillPreview(world, employed), employed).branch, "Performance");
  assert.equal(life.character!.jobId, null);
});

function gatedFixture(): WorldPack {
  const world = fixture(option([]));
  for (const [id, definition] of Object.entries(world.character!.skills)) {
    definition.initial = 0;
    definition.trainingActivity = `train-${id}`;
    world.character!.activities.push({ id: `train-${id}`, text: `Practice ${id}`, category: "training", minAge: id === "craft" ? 6 : id === "sculpture" ? 12 : 15,
      outcomes: [{ id: `learn-${id}`, text: "You practice.", weight: 1, effects: [{ type: "skill", skill: id, delta: 2 }] }] });
  }
  return world;
}

test("ordinary compact skills omit age and prerequisite locks and fall back from a hidden branch", () => {
  const world = gatedFixture(), engine = createEngine(world), life = structuredClone(engine.start("compact-current-locks"));
  const snapshot = structuredClone(life);
  let view = compactSkillView(compactSkillPreview(world, life), life, "Performance");
  assert.deepEqual(view.nodes, []);
  assert.deepEqual(view.selectableBranches, []);
  assert.equal(view.branch, undefined);
  assert.deepEqual(life, snapshot);

  life.age = 6;
  let model = compactSkillPreview(world, life);
  view = compactSkillView(model, life, "Performance");
  assert.deepEqual(view.nodes.map(node => node.id), ["craft"]);
  assert.deepEqual(view.selectableBranches, ["Crafts"]);
  assert.equal(view.branch, "Crafts");
  assert.equal(model.nodes.length, 3, "The complete wiki model remains available.");

  life.age = 12;
  model = compactSkillPreview(world, life);
  assert.deepEqual(compactSkillView(model, life).nodes.map(node => node.id), ["craft"], "An age-qualified skill still needs its prerequisites.");
  life.character!.skills.craft = 20;
  assert.deepEqual(compactSkillView(compactSkillPreview(world, life), life).nodes.map(node => node.id), ["craft", "sculpture"]);
});

test("current compact skills retain earned locked proficiency and survive temporary action blocks", () => {
  const world = gatedFixture(), engine = createEngine(world), life = structuredClone(engine.start("compact-earned-locks"));
  life.character!.skills.music = 1;
  let view = compactSkillView(compactSkillPreview(world, life), life);
  assert.deepEqual(view.nodes.map(node => node.id), ["music"]);
  assert.equal(view.nodes[0].state, "locked");
  assert.deepEqual(view.selectableBranches, ["Performance"]);

  life.age = 6;
  life.phase = "ready";
  life.pendingEventId = null;
  const baseline = compactSkillView(compactSkillPreview(world, life, undefined, engine.getActivities(life)), life, "Crafts");
  assert.equal(baseline.nodes[0].canPractice, true);
  life.character!.lastActivityAge = life.age;
  view = compactSkillView(compactSkillPreview(world, life, undefined, engine.getActivities(life)), life, "Crafts");
  assert.deepEqual(view.nodes.map(node => node.id), baseline.nodes.map(node => node.id));
  assert.equal(view.nodes[0].canPractice, false);
  assert.deepEqual(view.selectableBranches, ["Crafts", "Performance"]);

  life.phase = "choice";
  view = compactSkillView(compactSkillPreview(world, life), life, "Crafts");
  assert.deepEqual(view.nodes.map(node => node.id), ["craft"]);
});

test("choice previews show affected branches and cross-branch prerequisites while the dialog omits unrelated siblings", () => {
  const choice = option([{ type: "skill", skill: "music", delta: 4 }]), world = fixture(choice);
  world.character!.skills.music.prerequisites = { craft: 20 };
  world.character!.skills.singing = { label: "Singing", min: 0, max: 100, initial: 0, branch: "Performance", prerequisites: { music: 10 } };
  const life = createEngine(world).start("branch-preview"), snapshot = structuredClone(life);
  const model = compactSkillPreview(world, life, choice);
  assert.deepEqual(compactSkillView(model, life).nodes.map(node => node.id), ["craft", "music", "singing"]);
  assert.deepEqual(compactSkillView(model, life, undefined, true).nodes.map(node => node.id), ["craft", "music"]);
  const craft = compactSkillPreview(world, life, option([{ type: "skill", skill: "craft", delta: 2 }]));
  assert.deepEqual(compactSkillView(craft, life).branches, ["Crafts"], "unlocking a prerequisite is not a direct gain in another branch");
  assert.deepEqual(life, snapshot);
});

test("an option with no direct skill effects shows an empty preview instead of the full tree", () => {
  const choice = option([{ type: "stat", stat: "health", delta: 1 }]), world = fixture(choice), life = createEngine(world).start("no-skill-preview");
  const preview = compactSkillPreview(world, life, choice);
  assert.deepEqual(compactSkillView(preview, life).nodes, []);
  assert.deepEqual(compactSkillView(preview, life, "Crafts", true).nodes, []);
});
