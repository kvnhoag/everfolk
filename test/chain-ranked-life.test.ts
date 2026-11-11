import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { influenceFor, keyDecisionCategory } from "../chain/catalog/index.ts";
import { buildEvidence, serializeEvidence } from "../chain/evidence.ts";
import { commandsHash } from "../chain/hash.ts";
import { NPC_ACTIONS, RANKED_WORLD_VERSION, RARITY_POWER_BPS } from "../chain/ids.ts";
import type { Category } from "../chain/ids.ts";
import { activationCommand, applyCommand, rankedWorldVersion, validateRankedSave } from "../chain/validate-ranked.ts";
import type { Draw, FigurePick, LifeView } from "../chain/types.ts";
import { createEngine } from "../src/engine.ts";
import type { LifeState, SaveFile, WorldPack } from "../src/types.ts";

const CONTRACT = "everfolk-lives.testnet";
const SEED = "5eed0000000000000000000000000000000000000000000000000000000000a1";
// Corner-grain is a dated decision for every life alive in 330 BCE; the granaries open only for weakened lives in famine years.
const FIGURE: FigurePick = { figure_id: "cleomenes", token_id: "3", action_id: "cleomenes.corner-grain", rarity: 2 };
const NPC_TOKEN = "17";
const NPC_RARITY = 1;
const world = JSON.parse(readFileSync(new URL("../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);
const npcAction = (category: Category) => Object.values(NPC_ACTIONS).find(group => group.category === category)!.actions[0];

/** Plays a whole ranked life the way the client does: activation first, a draw at key decisions, a checkpoint every 5 years. */
async function playRankedLife(): Promise<{ life: LifeView; state: LifeState }> {
  const life: LifeView = {
    life_id: "8", account_id: "player.testnet", seed: SEED, world_version: RANKED_WORLD_VERSION, status: "alive",
    figure_picks: [FIGURE], draws: [], checkpoints: [], started_at_ms: 0,
  };
  let state = engine.influence(engine.start(SEED), activationCommand(FIGURE, CONTRACT));
  let applied = false;
  const drawnEvents = new Set<string>();
  while (state.phase !== "ended") {
    const category = state.phase === "choice" ? keyDecisionCategory(state.pendingEventId!) : null;
    if (category && !drawnEvents.has(state.pendingEventId!)) {
      drawnEvents.add(state.pendingEventId!);
      const step = state.commands.length;
      const hash = await commandsHash(state.commands, step);
      // The first key decision draws an NPC; later ones draw nobody.
      const draw: Draw = applied
        ? { step, category, token_id: null, action_id: null, rarity: null, commands_hash: hash }
        : { step, category, token_id: NPC_TOKEN, action_id: npcAction(category), rarity: NPC_RARITY, commands_hash: hash };
      life.draws.push(draw);
      if (draw.token_id) state = engine.influence(state, applyCommand(draw, CONTRACT));
      applied = true;
    }
    const age = state.age;
    state = state.phase === "choice" ? engine.choose(state, engine.getChoices(state)[0].id) : engine.advance(state);
    if (state.phase !== "ended" && state.age !== age && state.age % 5 === 0) {
      const step = state.commands.length;
      life.checkpoints.push({ step, commands_hash: await commandsHash(state.commands, step) });
    }
  }
  return { life, state };
}

test("a full ranked life validates and its evidence credits the influences that fired", async () => {
  assert.equal(rankedWorldVersion({ worldId: world.id, worldVersion: world.version }), RANKED_WORLD_VERSION);
  const { life, state } = await playRankedLife();
  const save = JSON.parse(engine.save(state)) as SaveFile;
  assert.deepEqual(await validateRankedSave(life, save, CONTRACT), { ok: true });
  assert.ok(life.draws.some(draw => draw.token_id) && life.draws.some(draw => !draw.token_id), "one NPC draw and at least one empty draw");
  assert.ok(life.checkpoints.length > 0);

  const replayed = engine.replay(save.seed, save.commands);
  assert.deepEqual(replayed, state);
  const evidence = await buildEvidence({ life, save, state: replayed, worldFingerprint: engine.fingerprint });
  assert.equal(evidence.seed, life.seed);
  assert.equal(evidence.world_version, RANKED_WORLD_VERSION);
  assert.equal(evidence.birth_year, world.startYear);
  assert.equal(evidence.death_year, state.year);

  // Expected impacts, counted independently from the journal.
  const npc = life.draws.find(draw => draw.token_id)!;
  const figureEvent = influenceFor(FIGURE.action_id).event!.id;
  const figureFirings = state.journal.filter(entry => entry.type === "event" && entry.id === figureEvent && entry.source?.tokenId === FIGURE.token_id).length;
  assert.ok(figureFirings > 0, "the activated figure event fired in this life");
  const npcEntries = state.journal.filter(entry => entry.type === "influence" && entry.source?.tokenId === NPC_TOKEN).length;
  assert.equal(npcEntries, 1);
  const expected = [
    { token_id: FIGURE.token_id, impact: figureFirings * influenceFor(FIGURE.action_id).baseWeight * RARITY_POWER_BPS[FIGURE.rarity] },
    { token_id: NPC_TOKEN, impact: influenceFor(npc.action_id!).baseWeight * RARITY_POWER_BPS[NPC_RARITY] },
  ].sort((a, b) => b.impact - a.impact || a.token_id.length - b.token_id.length || (a.token_id < b.token_id ? -1 : 1));
  assert.deepEqual(evidence.sources, expected);
  assert.equal(JSON.parse(serializeEvidence(evidence)).sources.length, 2);
});
