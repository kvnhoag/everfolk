/** Track D — seeded year conditions (flood, army, road). Pure; demo random stream only. */
import type {
  ArmyLevel, ConditionFamily, DemoContext, DemoDefinition, Episode, FloodLevel, LifeStateWithDemo, RoadLevel, YearConditions,
} from "./contracts.ts";

const FAMILIES: readonly ConditionFamily[] = ["flood", "army", "road"];
const BPS = 10_000;
const DEFAULT_WAR_MIN_YEARS = 4;
const DEFAULT_GAP_YEARS = 1;

/** Journal line when a family moves to a new level. */
const CHANGE_TEXT: { flood: Record<FloodLevel, string>; army: Record<ArmyLevel, string>; road: Record<RoadLevel, string> } = {
  flood: {
    low: "The Nile flood falls short this year.",
    normal: "The Nile flood returns to its usual height.",
    high: "The Nile rises high this year and waters every field.",
  },
  army: {
    quiet: "The army stops recruiting in the district.",
    recruiting: "Army officers are recruiting men and buying grain in the district.",
    war: "The army marches to war and needs every measure of grain it can buy.",
  },
  road: {
    safe: "The supply road is safe again.",
    uneasy: "Travellers say the supply road is uneasy this year.",
    dangerous: "Bandits make the supply road dangerous.",
  },
};

/** One plain line about what each level does this year. */
const EFFECT_TEXT: typeof CHANGE_TEXT = {
  flood: {
    low: "Low flood: plots yield far less grain than usual.",
    normal: "Normal flood: plots yield their usual harvest.",
    high: "High flood: plots yield more grain than usual.",
  },
  army: {
    quiet: "The army is quiet: it buys little grain and pays ordinary wages.",
    recruiting: "The army is recruiting: it buys more grain and pays higher wages.",
    war: "War: the army buys the most grain and pays the highest wages.",
  },
  road: {
    safe: "The road is safe: transport is cheap and cargo arrives.",
    uneasy: "The road is uneasy: transport costs more and cargo is at some risk.",
    dangerous: "The road is dangerous: cargo is at serious risk and fewer goods arrive.",
  },
};

function draw(ctx: DemoContext, min: number, max: number): number {
  return min + Math.floor(ctx.random() * (max - min + 1));
}

/**
 * One family's episodes: a seeded window inside the life span, a seeded number of episodes with seeded
 * durations, spread by sorted seeded offsets so they never overlap and keep a calm gap between them.
 */
function scheduleFamily(ctx: DemoContext, family: ConditionFamily): Episode[] {
  const spec = ctx.def.timeline.families[family];
  const gap = ctx.def.timeline.episodeGapYears ?? DEFAULT_GAP_YEARS;
  // Episodes must be playable, not scheduled after a typical life has ended.
  const span = Math.max(1, Math.min(ctx.world.maxAge, 70));
  const window = Math.min(span, draw(ctx, spec.windowYears.min, spec.windowYears.max));
  const windowStart = draw(ctx, 0, span - window);
  const wanted = draw(ctx, spec.episodes.min, spec.episodes.max);
  const durations = Array.from({ length: wanted }, () => Math.min(window, draw(ctx, spec.durationYears.min, spec.durationYears.max)));
  const kept = durations.reduce<{ years: number[]; used: number }>((acc, years) => {
    const used = acc.used + years + (acc.years.length ? gap : 0);
    return used > window ? acc : { years: [...acc.years, years], used };
  }, { years: [], used: 0 });
  const slack = window - kept.used;
  const offsets = kept.years.map(() => draw(ctx, 0, slack)).sort((a, b) => a - b);
  return kept.years.map((years, index) => ({
    startAge: windowStart + offsets[index] + kept.years.slice(0, index).reduce((sum, value) => sum + value, 0) + index * gap,
    years,
  }));
}

/** At birth: seeded episodes for each family inside its 50–100-year window. */
export function scheduleConditions(ctx: DemoContext): Record<ConditionFamily, Episode[]> {
  const flood = scheduleFamily(ctx, "flood");
  const army = scheduleFamily(ctx, "army");
  const road = scheduleFamily(ctx, "road");
  return { flood, army, road };
}

function episodeAt(episodes: readonly Episode[], age: number): Episode | undefined {
  return episodes.find(episode => age >= episode.startAge && age < episode.startAge + episode.years);
}

/**
 * Conditions for the life's current age, from the schedule plus causal pressure (road).
 * Always two draws per call (high flood, uneasy road), so replay never depends on the levels.
 */
export function conditionsAt(ctx: DemoContext): YearConditions {
  const { age } = ctx.life;
  const { schedule } = ctx.demo;
  const timeline = ctx.def.timeline;
  const highDraw = ctx.random() * BPS, roadDraw = ctx.random() * BPS;
  const floodEpisode = episodeAt(schedule.flood, age);
  const armyEpisode = episodeAt(schedule.army, age);
  const flood: FloodLevel = floodEpisode ? timeline.families.flood.level as FloodLevel
    : highDraw < (timeline.highFloodBps ?? 0) ? "high" : "normal";
  const warYear = armyEpisode !== undefined && armyEpisode.years >= (timeline.warMinYears ?? DEFAULT_WAR_MIN_YEARS)
    && age === armyEpisode.startAge + Math.floor(armyEpisode.years / 2);
  const army: ArmyLevel = !armyEpisode ? "quiet" : warYear ? "war" : timeline.families.army.level as ArmyLevel;
  const pressure = army !== "quiet" || episodeAt(schedule.flood, age - 1) !== undefined;
  const road: RoadLevel = episodeAt(schedule.road, age) ? timeline.families.road.level as RoadLevel
    : pressure && roadDraw < timeline.roadPressureBps ? "uneasy" : "safe";
  const fresh = FAMILIES.filter(family => schedule[family].some(episode => episode.startAge === age));
  return { flood, army, road, fresh };
}

/** After a year settles: set `demo.year` for the new age and journal what changed. */
export function rollYear(ctx: DemoContext): void {
  const previous = ctx.demo.year;
  const next = conditionsAt(ctx);
  ctx.demo.year = next;
  for (const family of FAMILIES) {
    if (next[family] === previous[family]) continue;
    const level = next[family];
    ctx.journal(`year-${family}-${level}`, (CHANGE_TEXT[family] as Record<string, string>)[level]);
  }
}

export interface YearView { flood: string; army: string; road: string; lines: string[] }
/** Read-only "This year" card. */
export function yearView(def: DemoDefinition, life: LifeStateWithDemo): YearView {
  void def;
  const { flood, army, road } = life.demo.year;
  return { flood, army, road, lines: [EFFECT_TEXT.flood[flood], EFFECT_TEXT.army[army], EFFECT_TEXT.road[road]] };
}
