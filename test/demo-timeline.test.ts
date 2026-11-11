import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEngine, demoWorld, withDemo } from "./fixtures/demo/world.ts";
import { demoContext } from "../src/demo/state.ts";
import { demoSeed } from "../src/demo/rng.ts";
import { conditionsAt, rollYear, scheduleConditions, yearView } from "../src/demo/timeline.ts";
import type { ConditionFamily, DemoContext, DemoState, Episode } from "../src/demo/types.ts";

const FAMILIES: readonly ConditionFamily[] = ["flood", "army", "road"];
const world = demoWorld();
const def = world.demo!;
const base = demoEngine().start("timeline-base");

interface Probe { ctx: DemoContext; lines: { id: string; text: string }[]; draws: () => number }

/** A detached draft with its own demo stream, so module calls never touch an engine life. */
function probe(seed: string, age = 0, patch: (demo: DemoState) => void = () => {}): Probe {
  const life = withDemo(base, demo => { demo.rng = demoSeed(seed); patch(demo); });
  life.age = age;
  const lines: Probe["lines"] = [];
  const ctx = demoContext(world, life, () => {}, (id, text) => lines.push({ id, text }));
  let count = 0;
  const random = ctx.random;
  return { ctx: { ...ctx, random: () => { count++; return random(); } }, lines, draws: () => count };
}

const inEpisode = (episodes: readonly Episode[], age: number): Episode | undefined =>
  episodes.find(episode => age >= episode.startAge && age < episode.startAge + episode.years);

test("the same seed gives the same schedule, and births record it", () => {
  assert.deepEqual(scheduleConditions(probe("same").ctx), scheduleConditions(probe("same").ctx));
  const engine = demoEngine();
  assert.deepEqual(engine.start("same-birth").demo!.schedule, engine.start("same-birth").demo!.schedule);
  assert.ok(FAMILIES.some(family => engine.start("same-birth").demo!.schedule[family].length > 0));
});

test("different seeds vary the timing", () => {
  const schedules = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(scheduleConditions(probe(`vary-${i}`).ctx))));
  assert.ok(schedules.size >= 25, `only ${schedules.size} distinct schedules`);
  const firstFloods = new Set(Array.from({ length: 30 }, (_, i) => scheduleConditions(probe(`vary-${i}`).ctx).flood[0]?.startAge));
  assert.ok(firstFloods.size >= 10);
});

test("episodes stay inside the window and the life span, sorted and apart", () => {
  for (let i = 0; i < 200; i++) {
    const schedule = scheduleConditions(probe(`span-${i}`).ctx);
    for (const family of FAMILIES) {
      const spec = def.timeline.families[family];
      const episodes = schedule[family];
      assert.ok(episodes.length >= 1 && episodes.length <= spec.episodes.max, `${family} count ${episodes.length}`);
      for (const [index, episode] of episodes.entries()) {
        assert.ok(Number.isInteger(episode.startAge) && episode.startAge >= 0);
        assert.ok(episode.years >= spec.durationYears.min && episode.years <= spec.durationYears.max);
        assert.ok(episode.startAge + episode.years <= world.maxAge, `${family} ends after the life span`);
        if (index > 0) {
          const previous = episodes[index - 1];
          assert.ok(episode.startAge > previous.startAge + previous.years, `${family} episodes overlap or touch`);
        }
      }
      const span = episodes.at(-1)!.startAge + episodes.at(-1)!.years - episodes[0].startAge;
      assert.ok(span <= Math.min(spec.windowYears.max, world.maxAge), `${family} spans ${span} years`);
    }
  }
});

test("levels follow the schedule and fresh marks only an episode's first year", () => {
  for (let i = 0; i < 20; i++) {
    const schedule = scheduleConditions(probe(`levels-${i}`).ctx);
    for (let age = 0; age < world.maxAge; age++) {
      const year = conditionsAt(probe(`levels-${i}-${age}`, age, demo => { demo.schedule = schedule; }).ctx);
      const flood = inEpisode(schedule.flood, age), army = inEpisode(schedule.army, age), road = inEpisode(schedule.road, age);
      assert.equal(year.flood === "low", Boolean(flood));
      assert.equal(year.army !== "quiet", Boolean(army));
      if (army) {
        const war = army.years >= 4 && age === army.startAge + Math.floor(army.years / 2);
        assert.equal(year.army, war ? "war" : "recruiting");
      }
      assert.equal(year.road === "dangerous", Boolean(road));
      for (const family of FAMILIES) {
        assert.equal(year.fresh.includes(family), schedule[family].some(episode => episode.startAge === age), `${family} fresh at ${age}`);
      }
    }
  }
});

test("each year uses the same number of draws, whatever the conditions", () => {
  const schedule = { flood: [{ startAge: 10, years: 2 }], army: [{ startAge: 30, years: 4 }], road: [{ startAge: 50, years: 1 }] };
  const counts = new Set([0, 10, 11, 12, 30, 32, 50, 70].map(age => {
    const run = probe(`draws-${age}`, age, demo => { demo.schedule = schedule; });
    conditionsAt(run.ctx);
    return run.draws();
  }));
  assert.equal(counts.size, 1);
});

test("road pressure makes uneasy roads more likely in recruitment years and after a low flood", () => {
  const schedule = { flood: [{ startAge: 60, years: 1 }], army: [{ startAge: 20, years: 3 }], road: [] };
  const uneasy = (age: number): number => Array.from({ length: 400 }, (_, i) =>
    conditionsAt(probe(`pressure-${age}-${i}`, age, demo => { demo.schedule = schedule; }).ctx).road).filter(road => road === "uneasy").length;
  const recruiting = uneasy(21), afterLowFlood = uneasy(61), quiet = uneasy(40);
  assert.equal(quiet, 0);
  assert.ok(recruiting > 60 && recruiting < 200, `recruiting ${recruiting}`);
  assert.ok(afterLowFlood > 60 && afterLowFlood < 200, `after low flood ${afterLowFlood}`);
});

test("a high flood is a rare seeded outcome outside low-flood episodes", () => {
  const highs = Array.from({ length: 1000 }, (_, i) => conditionsAt(probe(`high-${i}`, 40, demo => { demo.schedule = { flood: [], army: [], road: [] }; }).ctx).flood)
    .filter(flood => flood === "high").length;
  assert.ok(highs > 20 && highs < 200, `high floods ${highs}`);
});

test("rollYear sets the year and journals a plain line only when a family changes level", () => {
  const schedule = { flood: [{ startAge: 5, years: 2 }], army: [{ startAge: 6, years: 2 }], road: [] };
  const start = probe("roll", 5, demo => { demo.schedule = schedule; demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [] }; });
  rollYear(start.ctx);
  assert.equal(start.ctx.demo.year.flood, "low");
  assert.deepEqual(start.ctx.demo.year.fresh, ["flood"]);
  assert.ok(start.lines.some(line => line.text === "The Nile flood falls short this year."));
  assert.ok(start.lines.every(line => !/army/i.test(line.text)));

  start.ctx.life.age = 6;
  const before = start.lines.length;
  rollYear(start.ctx);
  const added = start.lines.slice(before);
  assert.equal(start.ctx.demo.year.flood, "low");
  assert.ok(added.every(line => !/flood/i.test(line.text)), "no repeated flood line");
  assert.ok(added.some(line => /recruit/i.test(line.text)));
});

test("yearView describes each family in plain words and changes nothing", () => {
  const life = withDemo(base, demo => { demo.year = { flood: "low", army: "war", road: "dangerous", fresh: ["flood"] }; });
  const before = JSON.stringify(life);
  const view = yearView(def, life);
  assert.equal(JSON.stringify(life), before);
  assert.deepEqual([view.flood, view.army, view.road], ["low", "war", "dangerous"]);
  assert.equal(view.lines.length, 3);
  for (const line of view.lines) assert.match(line, /^[A-Z][^{}]+\.$/);
  assert.deepEqual(yearView(def, life), view);
});
