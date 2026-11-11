import assert from "node:assert/strict";
import test from "node:test";
import world from "../worlds/alexandria-0.33.0.json" with { type: "json" };
import { CAREER_GROUP_JOBS, FIGURES, INFLUENCES, influenceFor } from "../chain/catalog/index.ts";
import { CAREER_GROUPS, FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS } from "../chain/ids.ts";
import { WORLD_START_YEAR } from "../chain/catalog/content.ts";
import { createEngine } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import type { LifeEvent, LifeState } from "../src/types.ts";

const actionIds: string[] = [
  ...Object.values(FIGURE_ACTIONS).flat(),
  ...Object.values(NPC_ACTIONS).flatMap(group => [...group.actions]),
];
const jobIds = new Set(world.character.jobs.map(job => job.id));
const originIds = new Set(world.origins.map(origin => origin.id));
const skillIds = new Set(Object.keys(world.character.skills));
const statIds = new Set(Object.keys(world.stats));
const achievementIds = new Set(world.legacy.achievements.map(achievement => achievement.id));

test("every action id has exactly one influence entry", () => {
  const entryIds = INFLUENCES.map(entry => entry.id);
  assert.equal(new Set(entryIds).size, entryIds.length, "influence ids are unique");
  assert.deepEqual([...entryIds].sort(), [...actionIds].sort());
  for (const id of actionIds) assert.equal(influenceFor(id).id, id);
  assert.throws(() => influenceFor("nobody.nothing"), /Unknown influence entry/);
});

test("every job id in CAREER_GROUP_JOBS exists in alexandria-0.33.0", () => {
  assert.deepEqual(Object.keys(CAREER_GROUP_JOBS).sort(), [...CAREER_GROUPS].sort());
  const mapped = Object.values(CAREER_GROUP_JOBS).flat();
  for (const job of mapped) assert.ok(jobIds.has(job), `unknown job ${job}`);
  assert.deepEqual([...mapped].sort(), [...jobIds].sort(), "every pack job belongs to a group");
});

test("every figure requirement references real origins, jobs, skills and accomplishments", () => {
  assert.deepEqual(FIGURES.map(figure => figure.figure), [...FIGURE_IDS]);
  for (const figure of FIGURES) {
    assert.equal(figure.supplyCap, 5, figure.figure);
    assert.ok(figure.title.trim() && figure.summary.trim(), figure.figure);
    for (const origin of figure.origins ?? []) assert.ok(originIds.has(origin), `${figure.figure}: origin ${origin}`);
    for (const job of figure.jobsAny ?? []) assert.ok(jobIds.has(job), `${figure.figure}: job ${job}`);
    for (const [skill, value] of Object.entries(figure.minSkills ?? {})) {
      assert.ok(skillIds.has(skill), `${figure.figure}: skill ${skill}`);
      assert.ok(value > 0 && value <= 100, `${figure.figure}: ${skill} threshold`);
    }
    for (const [stat, value] of Object.entries(figure.minStats ?? {})) {
      assert.ok(statIds.has(stat), `${figure.figure}: stat ${stat}`);
      assert.ok(value > 0 && value <= 100, `${figure.figure}: ${stat} threshold`);
    }
    for (const id of figure.accomplishmentsAny ?? []) assert.ok(achievementIds.has(id), `${figure.figure}: accomplishment ${id}`);
    assert.ok((figure.jobsAny ?? []).length > 0, `${figure.figure} needs a career`);
    assert.ok((figure.accomplishmentsAny ?? []).length > 0, `${figure.figure} needs an accomplishment`);
  }
  const alexander = FIGURES.find(figure => figure.figure === "alexander")!;
  assert.deepEqual(alexander.origins, ["royal-household"]);
  const aristotle = FIGURES.find(figure => figure.figure === "aristotle")!;
  assert.deepEqual([...aristotle.jobsAny!].sort(), ["court-adviser", "philosophy-tutor"]);
});

test("every job maps to at most one career group", () => {
  const seen = new Map<string, string>();
  for (const [group, jobs] of Object.entries(CAREER_GROUP_JOBS)) {
    for (const job of jobs) {
      assert.ok(!seen.has(job), `${job} is in ${seen.get(job)} and ${group}`);
      seen.set(job, group);
    }
  }
});

test("base weights are 1, 3 or 5", () => {
  for (const entry of INFLUENCES) assert.ok([1, 3, 5].includes(entry.baseWeight), entry.id);
  for (const id of ["alexander.levy", "cleomenes.corner-grain"]) {
    const entry = influenceFor(id);
    assert.equal(entry.baseWeight, 5, id);
    assert.ok(entry.event && entry.event.mode !== "automatic" && entry.event.choices.length >= 2, `${id} is a forced decision`);
  }
  assert.equal(influenceFor("aristotle.lyceum").baseWeight, 3);
  assert.equal(influenceFor("aristotle.tutor-court").baseWeight, 3);
  for (const entry of INFLUENCES) {
    assert.ok(entry.effects?.length || entry.event, `${entry.id} does something`);
    assert.ok(entry.label.trim().length > 0 && entry.label.length <= 300, entry.id);
  }
});

test("figure actions carry events and NPC actions carry immediate effects", () => {
  for (const id of Object.values(FIGURE_ACTIONS).flat()) assert.ok(influenceFor(id).event, `${id} activates an event`);
  for (const id of Object.values(NPC_ACTIONS).flatMap(group => [...group.actions])) {
    const effects = influenceFor(id).effects ?? [];
    assert.ok(effects.some(effect => effect.type === "stat"), `${id} has a stat effect that power can scale`);
  }
});

test("every influence event and effect list validates as world content", () => {
  const packEventIds = new Set(world.events.map(event => event.id));
  const events: LifeEvent[] = [];
  for (const entry of INFLUENCES) {
    if (entry.event) {
      assert.ok(!packEventIds.has(entry.event.id), `${entry.event.id} collides with a pack event`);
      events.push(entry.event);
    }
    if (entry.effects?.length) {
      // Wrap immediate effects in an automatic event so the engine validates their shape and references.
      events.push({
        id: `catalog-effects-${entry.id.replace(".", "-")}`, title: entry.label, text: entry.label,
        trigger: { type: "random", weight: 1 }, mode: "automatic", effects: entry.effects, choices: [],
      });
    }
  }
  const pack = structuredClone(world) as unknown as { events: unknown[] };
  pack.events = [...pack.events, ...structuredClone(events)];
  assert.doesNotThrow(() => validateWorld(pack));
});

test("figure events fire and every choice resolves in the engine", () => {
  assert.equal(world.startYear, WORLD_START_YEAR);
  const influenceEvents = INFLUENCES.flatMap(entry => entry.event ? [entry.event] : []);
  const pack = { ...structuredClone(world), events: [...structuredClone(world.events), ...structuredClone(influenceEvents)] };
  const engine = createEngine(pack);
  const ids = new Set(influenceEvents.map(event => event.id));
  const fired = new Set<string>();
  const resolved = new Set<string>();
  // Plays a life, branching into every available choice of each catalog event so a runtime
  // rejection (for example a job effect whose requirements are unmet) fails the test.
  const play = (seed: string, train: readonly string[] = [], accept?: string): LifeState => {
    let state = engine.start(seed);
    for (let steps = 0; state.phase !== "ended" && steps < 3_000; steps++) {
      if (state.phase === "choice") {
        const choices = engine.getChoices(state);
        if (ids.has(state.pendingEventId!)) {
          fired.add(state.pendingEventId!);
          for (const choice of choices) {
            assert.doesNotThrow(() => engine.choose(state, choice.id), `${state.pendingEventId}: ${choice.id}`);
            resolved.add(choice.id);
          }
        }
        const preferred = choices.find(choice => choice.id === accept);
        state = engine.choose(state, (preferred ?? choices[steps % choices.length]).id);
        continue;
      }
      const activity = train.length ? engine.getActivities(state).find(item => item.id === train[state.age % train.length] && item.available) : undefined;
      if (activity) state = engine.act(state, activity.id);
      if (state.phase === "ready") state = engine.advance(state);
    }
    for (const entry of state.journal) if (entry.type === "event" && ids.has(entry.id)) fired.add(entry.id);
    return state;
  };
  for (let i = 0; i < 4; i++) play(`catalog-${i}`);
  let royal = 0;
  while (engine.start(`catalog-royal-${royal}`).originId !== "royal-household") royal++;
  play(`catalog-royal-${royal}`);
  for (let i = 0; !fired.has("influence-euclid-museum") && i < 20; i++) play(`catalog-scholar-${i}`, ["train-literacy", "train-reckoning"], "euclid-museum-accept");

  assert.deepEqual([...fired].sort(), [...ids].sort(), "every figure event fires in some life");
  const choiceIds = influenceEvents.flatMap(event => event.choices.map(choice => choice.id));
  assert.deepEqual([...resolved].sort(), [...choiceIds].sort(), "every choice was available and resolved");
});
