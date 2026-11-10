import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, Effect, WorldPack } from "../src/types.ts";
import previous from "../worlds/alexandria-0.25.0.json" with { type: "json" };
import { activeEarlyInfluences, earlyInfluences, practiceBonus, previewEarlyInfluences } from "../client/early-influences.ts";
import { compactSkillPreview, choiceProgressFeedback } from "../client/compact-skill.ts";
import { getSkillImpact } from "../client/skill-impact.ts";

const CLAY = "remembered-clay";
const MUSIC = "remembered-music";
const memory = (flag = CLAY, value = true): Effect => ({ type: "flag", flag, value });
function option(branches: Effect[][]): Choice {
  return { id: "remember", text: "Try something new", outcomes: branches.map((effects, i) => ({ id: `memory-${i}`, text: "A fictional childhood experience.", weight: 1, effects })) };
}

/** Synthetic paid-training rules make the display promises independently
 * comparable with accepted engine results, without depending on content counts. */
function fixture(choice = option([[memory()]])): WorldPack {
  return {
    schemaVersion: 1, id: "early-influence-ui", version: "1", title: "Early influence fixture", description: "Fictional UI integration fixture.", startYear: -66, maxAge: 80,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 }, wealth: { label: "Wealth", min: 0, max: 100, initial: 20 } },
    flags: { [CLAY]: { label: "A little clay figure", initial: false }, [MUSIC]: { label: "A familiar rhythm", initial: false } },
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "childhood", title: "A childhood memory", text: "Choose an experience.", trigger: { type: "age", at: 0 }, choices: [choice] }],
    endings: [{ id: "end", title: "The record ends", text: "Life ends.", kind: "death" }], defaultEnding: "end",
    character: {
      skills: {
        craft: { label: "Tools", min: 0, max: 100, initial: 30, branch: "Crafts" },
        carving: { label: "Carving", min: 0, max: 100, initial: 15, branch: "Crafts", prerequisites: { craft: 10 } },
        sculpture: { label: "Sculpture", min: 0, max: 100, initial: 0, branch: "Crafts", prerequisites: { carving: 10 } },
        music: { label: "Music", min: 0, max: 100, initial: 0, branch: "Performance" },
        letters: { label: "Letters", min: 0, max: 100, initial: 0, branch: "Letters" },
      }, jobs: [], partners: [], childNames: ["Child"],
      deathCauses: [{ id: "old-age", title: "Old age", text: "Life ends.", weight: 1 }], deathCauseDescription: "Fictional fixture.",
      activities: [
        { id: "train-sculpture", text: "Pay for sculpture practice", category: "training", minAge: 0, when: { type: "stat", stat: "wealth", op: "gte", value: 2 }, outcomes: [{ id: "sculpture-practice", text: "You practise.", weight: 1, effects: [
          { type: "stat", stat: "wealth", delta: -2 },
          { type: "skill", skill: "sculpture", delta: 4, gainModifiers: [{ flag: CLAY, multiplier: 1.2, reason: "Remembered clay work" }, { flag: MUSIC, multiplier: 1.1, reason: "Remembered rhythm" }] },
          { type: "skill", skill: "carving", delta: 2, gainModifiers: [{ flag: CLAY, multiplier: 1.1, reason: "Remembered clay work" }] },
        ] }] },
        { id: "train-music", text: "Pay for music practice", category: "training", minAge: 0, when: { type: "stat", stat: "wealth", op: "gte", value: 2 }, outcomes: [{ id: "music-practice", text: "You practise.", weight: 1, effects: [
          { type: "stat", stat: "wealth", delta: -2 }, { type: "skill", skill: "music", delta: 5, gainModifiers: [{ flag: MUSIC, multiplier: 1.2, reason: "Remembered rhythm" }] },
        ] }] },
        { id: "uncompleted-lesson", text: "An interrupted lesson", category: "training", outcomes: [{ id: "interrupted", text: "The record ends before the lesson.", weight: 1, effects: [
          { type: "stat", stat: "wealth", delta: -2 }, { type: "end", ending: "end" },
          { type: "skill", skill: "letters", delta: 5, gainModifiers: [{ flag: CLAY, multiplier: 1.2, reason: "Unreached effect" }] },
        ] }] },
      ],
    },
    legacy: {
      routes: [
        { id: "sculpture", title: "Sculpture", description: "Make figures.", skillIds: ["craft", "carving", "sculpture"], jobIds: [], achievementIds: ["a-figure"], earlyInterestFlag: CLAY },
        { id: "music-performance", title: "Music", description: "Perform music.", skillIds: ["music"], jobIds: [], achievementIds: ["a-performance"], earlyInterestFlag: MUSIC },
      ],
      achievements: [
        { id: "a-figure", routeId: "sculpture", title: "A figure", description: "A completed figure.", kind: "ordinary", nameTemplate: "The little figure", people: ["Niko"], evidence: "fictional" },
        { id: "a-performance", routeId: "music-performance", title: "A performance", description: "A completed performance.", kind: "ordinary", nameTemplate: "The little song", people: ["Niko"], evidence: "fictional" },
      ],
    },
  };
}

test("memory previews identify actual future paid-training gains, not every skill in a route", () => {
  const world = fixture(), engine = createEngine(world), life = engine.start("new-memory");
  const influences = earlyInfluences(world), clay = influences.find(item => item.flag === CLAY)!;
  assert.equal(clay.title, "Sculpture");
  assert.equal(clay.memory, "A little clay figure");
  assert.deepEqual(clay.skills, [
    { id: "carving", label: "Carving", multiplier: 1.1 },
    { id: "sculpture", label: "Sculpture", multiplier: 1.2 },
  ]);
  assert.equal(practiceBonus(clay.multiplier), "+20%");
  assert.deepEqual(activeEarlyInfluences(world, life), []);
  const preview = previewEarlyInfluences(engine.getChoices(life)[0], world, life);
  assert.deepEqual(preview.map(({ flag, possible, reinforced }) => ({ flag, possible, reinforced })), [{ flag: CLAY, possible: false, reinforced: false }]);
  assert.ok(!clay.skills.some(skill => ["craft", "letters"].includes(skill.id)), "unmodified and post-ending effects must not be advertised");
});

test("an accepted memory matches its preview and the advertised multiplier matches an actual paid practice", () => {
  const world = fixture(), engine = createEngine(world), before = engine.start("earned-memory");
  const choice = engine.getChoices(before)[0];
  const preview = previewEarlyInfluences(choice, world, before);
  const after = engine.choose(before, choice.id);
  assert.deepEqual(activeEarlyInfluences(world, after).map(item => item.flag), preview.map(item => item.flag));
  const feedback = choiceProgressFeedback(before, after, world)!;
  assert.deepEqual(feedback.influences?.map(item => item.flag), [CLAY]);
  const lesson = engine.getActivities(after).find(activity => activity.id === "train-sculpture")!;
  assert.equal(lesson.available, true);
  const gains = getSkillImpact(lesson, after, world);
  const trained = engine.act(after, lesson.id);
  for (const gain of gains) assert.ok(Math.abs(gain.min - (trained.character!.skills[gain.id] - after.character!.skills[gain.id])) < 1e-12);
  assert.ok(Math.abs(trained.character!.skills.sculpture - 4 * preview[0].skills.find(skill => skill.id === "sculpture")!.multiplier) < 1e-12);
  assert.equal(trained.stats.wealth, after.stats.wealth - 2);
  assert.deepEqual(engine.replay(trained.seed, trained.commands), trained);
});

test("reading influence and future-branch projections does not mutate state, world or RNG", () => {
  const world = fixture(), engine = createEngine(world), life = engine.start("pure-projections");
  const choice = engine.getChoices(life)[0], saved = engine.save(life), snapshot = structuredClone(life), pack = structuredClone(world);
  for (let i = 0; i < 4; i++) {
    earlyInfluences(world); activeEarlyInfluences(world, life); previewEarlyInfluences(choice, world, life); compactSkillPreview(world, life, choice);
  }
  assert.deepEqual(life, snapshot);
  assert.deepEqual(world, pack);
  assert.equal(engine.save(life), saved);
  const detached = previewEarlyInfluences(choice, world, life);
  detached[0].skills[0].label = "Changed UI copy";
  assert.equal(world.character!.skills.carving.label, "Carving");
});

test("flag-only choices highlight future skills and prerequisites without inventing immediate proficiency gains", () => {
  const world = fixture(), life = createEngine(world).start("future-highlight");
  const preview = compactSkillPreview(world, life, world.events[0].choices[0]);
  assert.deepEqual(preview.changes, []);
  assert.deepEqual(preview.earlyInfluences.map(item => item.flag), [CLAY]);
  assert.equal(preview.futureSkills.get("carving"), 1.1);
  assert.equal(preview.futureSkills.get("sculpture"), 1.2);
  assert.equal(preview.futureSkills.has("music"), false);
  assert.ok(preview.affected.has("carving") && preview.affected.has("sculpture"));
  assert.ok(preview.context.has("craft"), "the existing prerequisite remains visible");
  assert.equal(life.character!.skills.sculpture, 0);
});

test("false clearing and ending effects suppress unreached future influences", () => {
  for (const effects of [
    [memory(), memory(CLAY, false)],
    [{ type: "end", ending: "end" } as Effect, memory()],
    [memory(), { type: "end", ending: "end" } as Effect],
  ]) {
    const world = fixture(option([effects])), engine = createEngine(world), life = engine.start("no-future-influence");
    assert.deepEqual(previewEarlyInfluences(world.events[0].choices[0], world, life), []);
    assert.equal(compactSkillPreview(world, life, world.events[0].choices[0]).futureSkills.size, 0);
  }
  const clearing = fixture(option([[memory(CLAY, false)]]));
  clearing.flags[CLAY].initial = true;
  const engine = createEngine(clearing), before = engine.start("clear-existing");
  assert.equal(activeEarlyInfluences(clearing, before).length, 1);
  assert.deepEqual(previewEarlyInfluences(engine.getChoices(before)[0], clearing, before), []);
  assert.deepEqual(activeEarlyInfluences(clearing, engine.choose(before, "remember")), []);
});

test("branch-dependent memories remain possible and reinforcing a memory is distinguished from learning it", () => {
  const world = fixture(option([[memory()], []])), engine = createEngine(world);
  const before = engine.start("possible-memory");
  const preview = previewEarlyInfluences(engine.getChoices(before)[0], world, before);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].possible, true);
  assert.equal(preview[0].reinforced, false);
  const seen = new Set<boolean>();
  for (let i = 0; i < 32; i++) {
    const life = engine.start(`possible-memory-${i}`), after = engine.choose(life, "remember");
    seen.add(after.flags[CLAY]);
    assert.equal(activeEarlyInfluences(world, after).length, Number(after.flags[CLAY]));
  }
  assert.deepEqual([...seen].sort(), [false, true]);
  const known = { ...before, flags: { ...before.flags, [CLAY]: true } };
  assert.equal(previewEarlyInfluences(world.events[0].choices[0], world, known)[0].reinforced, true);
  assert.deepEqual(previewEarlyInfluences(option([[]]), world, known), [], "an untouched existing flag is not a newly offered memory");
});

test("overlapping memories show the strongest future multiplier and do not stack the actual training gain", () => {
  const world = fixture(option([[memory(), memory(MUSIC)]])), engine = createEngine(world), before = engine.start("overlapping-memories");
  const projection = compactSkillPreview(world, before, engine.getChoices(before)[0]);
  assert.equal(projection.futureSkills.get("sculpture"), 1.2);
  assert.equal(practiceBonus(projection.futureSkills.get("sculpture")!), "+20%");
  const remembered = engine.choose(before, "remember");
  assert.equal(activeEarlyInfluences(world, remembered).length, 2);
  const trained = engine.act(remembered, "train-sculpture");
  assert.ok(Math.abs(trained.character!.skills.sculpture - 4.8) < 1e-12);
  assert.notEqual(trained.character!.skills.sculpture, 4 * 1.2 * 1.1);
});

test("old packs and unannotated routes produce no childhood-influence UI", () => {
  const old = previous as WorldPack, life = createEngine(old).start("old-influence-ui");
  assert.deepEqual(earlyInfluences(old), []);
  assert.deepEqual(activeEarlyInfluences(old, life), []);
  assert.deepEqual(previewEarlyInfluences(option([[]]), old, life), []);
  const unannotated = fixture();
  for (const route of unannotated.legacy!.routes) delete route.earlyInterestFlag;
  const currentLife = createEngine(unannotated).start("unannotated-ui");
  assert.deepEqual(earlyInfluences(unannotated), []);
  assert.deepEqual(previewEarlyInfluences(option([[memory()]]), unannotated, currentLife), []);
  const characterless = structuredClone(unannotated);
  delete characterless.character;
  delete characterless.legacy;
  createEngine(characterless);
  assert.deepEqual(earlyInfluences(characterless), []);
});
