/**
 * Turn-by-turn play of the free-play world from the command line, for play-testers (human or agent).
 *
 *   node scripts/playtest/play.ts <save.json> new <seed>            start a life
 *   node scripts/playtest/play.ts <save.json> find <origin> [from]  start the first life born into <origin>
 *   node scripts/playtest/play.ts <save.json> look                  state, pending decision, open activities
 *   node scripts/playtest/play.ts <save.json> choose <choice-id>    answer the pending decision
 *   node scripts/playtest/play.ts <save.json> act <activity-id>     take an activity this year
 *   node scripts/playtest/play.ts <save.json> advance [years]       live on (stops at decisions and endings)
 *   node scripts/playtest/play.ts <save.json> sell-grain <n>        sell grain to the merchant
 *   node scripts/playtest/play.ts <save.json> plan <flax-plots>     how many plots to sow with flax (the rest grain)
 *   node scripts/playtest/play.ts <save.json> journal [n]           the last n journal lines (default 30)
 *
 * The save holds only the seed and commands; every step replays exactly.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createEngine, lifeStageView, affinityView, fieldNeedsView } from "../../src/index.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";

const worldPath = new URL("../../worlds/demo/alexandria-lives-4.json", import.meta.url);
const world = JSON.parse(readFileSync(worldPath, "utf8")) as WorldPack;
const engine = createEngine(world);
const [savePath, command, ...args] = process.argv.slice(2);
if (!savePath || !command) { console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]); process.exit(1); }

const load = (): LifeState => {
  if (!existsSync(savePath)) throw new Error(`No save at ${savePath}. Start with: new <seed>`);
  return engine.load(readFileSync(savePath, "utf8"));
};
const store = (life: LifeState): void => writeFileSync(savePath, engine.save(life));
const seen = (life: LifeState): number => {
  const marker = `${savePath}.seen`;
  return existsSync(marker) ? Math.min(Number(readFileSync(marker, "utf8")) || 0, life.journal.length) : 0;
};
const markSeen = (life: LifeState): void => writeFileSync(`${savePath}.seen`, String(life.journal.length));

function look(life: LifeState): void {
  const from = seen(life);
  const fresh = life.journal.slice(from).filter(entry => !/^(town-year|market-prices)$/.test(entry.id));
  if (fresh.length) {
    console.log("── New in your life ──");
    for (const entry of fresh) console.log(`  [${entry.age}] ${entry.text}`);
  }
  markSeen(life);
  const origin = world.origins.find(item => item.id === life.originId);
  const stage = lifeStageView(world, life.age);
  const paths = life.paths, districts = world.paths?.districts ?? {};
  console.log("── You ──");
  console.log(`  Age ${life.age} (${stage?.title ?? "-"}; you decide: ${stage?.decides.join(", ") || "nothing yet"}), year ${life.year < 0 ? `${-life.year} BCE` : `${life.year} CE`}, born to ${origin?.title ?? life.originId}`);
  if (paths) console.log(`  Living in ${districts[paths.district]?.title}${paths.home !== paths.district ? ` (household in ${districts[paths.home]?.title})` : ""}`);
  console.log(`  Stats: ${Object.entries(life.stats).map(([id, value]) => `${id} ${Math.round(value)}`).join(", ")}`);
  console.log(`  Cash ${life.economy?.cash ?? 0} dr; grain ${life.demo?.household.grain ?? "-"}; job ${life.character?.jobId ?? "none"}; reputation ${life.demo?.reputation ?? "-"}`);
  const skills = Object.entries(life.character?.skills ?? {}).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`  Skills: ${skills.map(([id, value]) => `${id} ${Math.round(value)}`).join(", ") || "none yet"}`);
  const learned = Object.keys(life.capabilities?.learned ?? {});
  if (learned.length) console.log(`  Skill-tree nodes: ${learned.join(", ")}`);
  const pulls = affinityView(world, life).filter(entry => entry.affinity > 0).slice(0, 3);
  if (pulls.length) console.log(`  Drawn to: ${pulls.map(entry => `${entry.title} ${entry.affinity}`).join(", ")}`);
  const needs = fieldNeedsView(world, life).filter(need => need.label !== "steady");
  if (needs.length) console.log(`  Work here: ${needs.map(need => `${need.title} ${need.label} (${(need.needBps / 10_000).toFixed(1)}×)`).join("; ")}`);
  if (life.phase === "ended") { console.log("── The life has ended ──"); return; }
  if (life.phase === "choice") {
    const event = world.events.find(item => item.id === life.pendingEventId)!;
    console.log(`── Decision: ${event.title} ──\n  ${event.text}`);
    for (const choice of engine.getChoices(life)) console.log(`  choose ${choice.id}  →  ${choice.text}`);
    return;
  }
  // Skill-tree work first (it is what progresses a path), then everything else.
  const open = engine.getActivities(life).filter(activity => activity.available)
    .sort((a, b) => Number(!a.id.startsWith("cap-work-")) - Number(!b.id.startsWith("cap-work-")));
  console.log(`── This year you can (${open.length}) ── or: advance${life.demo ? `; plan <flax-plots> (now ${life.demo.household.flaxPlots} of ${life.demo.household.plots})` : ""}`);
  for (const activity of open) console.log(`  act ${activity.id}  →  ${activity.text}`);
}

function advance(life: LifeState, years: number): LifeState {
  const until = life.age + years;
  while (life.phase === "ready" && life.age < until) life = engine.advance(life);
  return life;
}

function findOrigin(origin: string, from: number): LifeState {
  if (!world.origins.some(item => item.id === origin)) throw new Error(`Unknown origin. Choose one of: ${world.origins.map(item => item.id).join(", ")}`);
  for (let i = from; i < from + 500; i++) {
    const life = engine.start(`playtest-${origin}-${i}`);
    if (life.originId === origin) return life;
  }
  throw new Error(`No ${origin} birth in 500 seeds.`);
}

let life: LifeState;
switch (command) {
  case "new": life = engine.start(args[0] ?? `playtest-${Date.now()}`); writeFileSync(`${savePath}.seen`, "0"); break;
  case "find": life = findOrigin(args[0], Number(args[1] ?? 0)); writeFileSync(`${savePath}.seen`, "0"); break;
  case "look": life = load(); break;
  case "choose": life = engine.choose(load(), args[0]); break;
  case "act": life = engine.act(load(), args[0]); break;
  case "advance": life = advance(load(), Number(args[0] ?? 1)); break;
  case "plan": life = engine.demo(load(), { type: "plan", flaxPlots: Number(args[0]) }); break;
  case "sell-grain": life = engine.demo(load(), { type: "trade", item: "grain", side: "sell", quantity: Number(args[0]), counterparty: "merchant" }); break;
  case "journal": {
    life = load();
    for (const entry of life.journal.slice(-(Number(args[0] ?? 30)))) console.log(`[${entry.age}] ${entry.id}: ${entry.text}`);
    process.exit(0);
  }
  default: throw new Error(`Unknown command ${command}`);
}
store(life);
look(life);
