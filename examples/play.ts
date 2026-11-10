import { createEngine } from "../src/index.ts";
import sandbox from "../worlds/sandbox.json" with { type: "json" };

const seed = process.argv[2] ?? "demo-life";
const engine = createEngine(sandbox);
let state = engine.start(seed);
let printedEntries = 0;
let steps = 0;

function printNewEntries(): void {
  for (const entry of state.journal.slice(printedEntries)) {
    const date = entry.year < 0 ? `${-entry.year} BCE` : `${entry.year} CE`;
    console.log(`[age ${entry.age} | ${date}] ${entry.type}: ${entry.text}`);
  }
  printedEntries = state.journal.length;
}

console.log(`${engine.world.title} — seed: ${seed}`);
console.log("Fictional engine test content; no historical probabilities are claimed.\n");
printNewEntries();

while (state.phase !== "ended") {
  if (++steps > 200) throw new Error("Example exceeded its safety limit.");
  if (state.phase === "ready") {
    state = engine.advance(state);
  } else {
    const choice = engine.getChoices(state)[0];
    if (!choice) throw new Error("Pending event has no eligible choice.");
    state = engine.choose(state, choice.id);
  }
  printNewEntries();
}

const save = engine.save(state);
const restored = engine.load(save);
const replayed = engine.replay(seed, state.commands);
if (JSON.stringify(restored) !== JSON.stringify(state)) {
  throw new Error("Save/load did not restore the same life.");
}
if (JSON.stringify(replayed) !== JSON.stringify(state)) {
  throw new Error("Replay did not reconstruct the same life.");
}

console.log(`\nEnding: ${state.endingId}`);
console.log(`Final stats: ${JSON.stringify(state.stats)}`);
console.log(`Verified save/load and replay equality (${state.commands.length} accepted commands).`);
