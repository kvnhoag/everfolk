import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { checkRankedObligations } from "../chain/ranked-rules.ts";
import { GRANARY_GRAIN } from "../chain/catalog/demo-deeds.ts";
import { demoScreen } from "../client/demo/screen.ts";
import { DEMO_LIFE_A_OWNER, DEMO_NEXT_OWNER, WEAVE_PRESETS, fastForwardFarmer, openGranary, prepareGranaryScenario, prepareWeavePreset, settleGranaryYear, withoutGranary } from "../client/chain/demo-scenario.ts";
import type { SaveFile } from "../src/types.ts";

test("the prefilled legacy test mints a real farmer, applies its granary once, and pays that source in the next life", async () => {
  const scenario = await prepareGranaryScenario();
  const { source, next, ledger, world } = scenario;
  const token = await ledger.token(source.minted.token_id);
  assert.equal(source.state.phase, "ended");
  assert.equal(source.signed.evidence.career_group, "farming");
  assert.equal(token?.owner_id, DEMO_LIFE_A_OWNER);
  assert.equal(token?.extra.action_id, "farming.stock-granary");
  assert.equal(next.state.journal.some(entry => entry.source?.tokenId === source.minted.token_id), false);
  await openGranary(scenario);
  assert.equal(next.state.pendingEventId, "flood-failure");
  const without = withoutGranary(world, next.state, source.minted.token_id);
  assert.equal(next.state.demo!.household.grain - without.demo!.household.grain, GRANARY_GRAIN);
  assert.equal(next.state.journal.filter(entry => entry.type === "influence" && entry.id === "farming.stock-granary").length, 1);
  await assert.rejects(openGranary(scenario), /already open/);
  assert.equal(demoScreen(world, next.state)?.legacyHelp[0].tokenId, source.minted.token_id);
  const beforeYear = next.state.age;
  await settleGranaryYear(scenario);
  assert.equal(next.state.age, beforeYear + 1);
  assert.doesNotThrow(() => withoutGranary(world, next.state, source.minted.token_id));
  const engine = createEngine(world);
  assert.deepEqual(engine.load(next.save()), next.state);
  const recorded = await ledger.getLife(next.life.life_id);
  assert.ok(recorded);
  assert.equal(checkRankedObligations(engine, recorded, JSON.parse(next.save()) as SaveFile).ok, true);
  await fastForwardFarmer(next, world);
  const signed = await next.finish();
  assert.ok(signed.evidence.sources.some(item => item.token_id === source.minted.token_id && item.impact > 0));
  const minted = await next.mint(signed, "farming.stock-granary");
  assert.ok((await ledger.childrenOf(source.minted.token_id)).includes(minted.token_id));
  assert.ok(BigInt(await ledger.balanceOf(DEMO_LIFE_A_OWNER)) > 0n);
});

test("resetting the scenario rebuilds the same checkpoint with a fresh isolated ledger", async () => {
  const first = await prepareGranaryScenario();
  await openGranary(first);
  const reset = await prepareGranaryScenario();
  assert.equal(reset.next.state.seed, first.beforeFlood.seed);
  assert.deepEqual(reset.next.state, first.beforeFlood);
  assert.notEqual(reset.ledger, first.ledger);
  assert.equal((await reset.ledger.tokenStats(reset.source.minted.token_id)).lives_influenced, 0);
});

test("prepareWeavePreset prepares every Weave feature preset with real playable ranked sessions and ledger state", async () => {
  assert.equal(WEAVE_PRESETS.length, 6);

  const weave = await prepareWeavePreset("weave");
  assert.equal(weave.session.state.pendingEventId, "flood-failure");
  assert.ok((demoScreen(weave.world, weave.session.state)?.legacyHelp.length ?? 0) > 0);

  const career = await prepareWeavePreset("career");
  assert.equal(career.session.state.phase, "ready");
  assert.ok((career.session.state.character?.skills.farming ?? 0) >= 25);
  assert.ok((career.session.state.character?.skills.reckoning ?? 0) >= 25);
  assert.ok((career.session.state.character?.skills.warfare ?? 0) >= 20);

  const economy = await prepareWeavePreset("economy");
  assert.equal(economy.session.state.phase, "ready");
  assert.ok((economy.session.state.demo?.household.grain ?? 0) > 0);
  assert.ok((economy.session.state.demo?.household.flax ?? 0) > 0);

  const convoy = await prepareWeavePreset("convoy");
  assert.equal(convoy.session.state.pendingEventId, "demo-convoy-road");
  assert.equal(convoy.session.state.character?.jobId, "soldier");
  assert.equal(demoScreen(convoy.world, convoy.session.state)?.service.serving, true);

  const pack = await prepareWeavePreset("nft-pack");
  assert.equal(pack.session.state.phase, "ended");
  const openedPack = await pack.ledger.mintPack(pack.session.life.life_id);
  assert.equal(openedPack?.cards.length, 3);

  const market = await prepareWeavePreset("nft-market");
  assert.equal(market.initialHash, "#token/1");
  const owned = await market.ledger.tokensOf(DEMO_NEXT_OWNER);
  assert.ok(owned.some(t => t.token_id === "1"));
  assert.ok(BigInt(await market.ledger.balanceOf(DEMO_NEXT_OWNER)) > 0n);
  assert.ok((await market.ledger.listings()).length >= 3);
});
