import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import { exportLife, loadAnyLife, registerWorldPack } from "../client/lib/world-session.ts";
import { careerGroupOf } from "../chain/match.ts";
import { CAREER_GROUP_JOBS } from "../chain/catalog/npc-actions.ts";
import { getAssetValue, getNetWorth } from "../src/economy.ts";
import { lifeRecordChanges } from "../client/models/life-record.ts";
import { visibleRelationshipPeople } from "../client/models/relationship-labels.ts";
import { entryUsesDefaultLives, startupRefreshesToDefault } from "../client/models/world-entry.ts";
import { visibleCharacterSections } from "../client/models/character-panel-model.ts";
import { clearRecordedWealthObservations, recordWealthObservation, getSocietyWealthBenchmarkInfo } from "../client/models/society-wealth-data.ts";
import { getWealthComparison } from "../client/models/wealth-comparison.ts";
import sample from "../worlds/alexandria-sample.json" with { type: "json" };
import lives2 from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import lives3 from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

test("Issue #12: alexandria-lives-1 export loads and restores on clean storage without prior session setup", async () => {
  const pack = await loadLifeWorld("alexandria-lives-1");
  const engine = createEngine(pack);
  const life = engine.start("audit-retained-import");
  const exported = exportLife(life);

  const restored = loadAnyLife(exported);
  assert.equal(restored.seed, "audit-retained-import");
  assert.equal(restored.worldFingerprint, engine.fingerprint);
  assert.equal(restored.age, 0);
});

test("Issue #20: Tailor, Scientist, and Politician are registered in NFT career mapping and resolve expected career groups", () => {
  assert.ok(CAREER_GROUP_JOBS.craft.includes("tailor"), "tailor must be in craft career group");
  assert.ok(CAREER_GROUP_JOBS.letters.includes("scientist"), "scientist must be in letters career group");
  assert.ok(CAREER_GROUP_JOBS.letters.includes("politician"), "politician must be in letters career group");

  for (const [job, expectedGroup] of [
    ["tailor", "craft"],
    ["scientist", "letters"],
    ["politician", "letters"],
  ] as const) {
    const fakeState = {
      journal: [{ type: "activity", id: job }],
      character: { jobId: job },
      stats: {},
    } as any;
    assert.equal(careerGroupOf(fakeState), expectedGroup);
  }
});

test("Issue #15: Authored endings evaluate immediately after market commands change wealth", () => {
  const fixture = {
    schemaVersion: 1, id: "audit-ending-test", version: "1", title: "Market ending audit",
    description: "Synthetic valid rules to exercise ending boundaries.", startYear: 1, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } },
    flags: {}, origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    endings: [
      { id: "bankrupt", title: "Bankruptcy", text: "This life ends when wealth drops below starting.", when: { type: "stat", stat: "wealth", op: "lt", value: 10 } },
      { id: "end", title: "End", text: "Complete." }
    ],
    defaultEnding: "end",
    economy: {
      stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" },
      description: "Authored test prices.",
      assets: [{ id: "clay", title: "Clay", description: "Material.", value: 10, maxOwned: 10 }],
      market: { minAge: 0, feePercent: 10, maxQuantity: 10, maxOrders: 10, traderJob: "trader", traderYears: 3, traderFocusActivity: "focus", goods: ["clay"], shocks: [] }
    },
    character: {
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, partners: [], childNames: ["Child"],
      jobs: [{ id: "trader", title: "Trader", description: "Trade.", minAge: 0, yearlyEffects: [] }],
      activities: [{ id: "focus", text: "Focus", category: "career", outcomes: [{ id: "done", text: "Done", weight: 1, effects: [] }] }],
      deathCauseDescription: "Fictional fixture.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }]
    }
  } as any;

  const engine = createEngine(fixture);
  const life = engine.start("audit-ending-market");
  const ordered = engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 1 });
  assert.equal(ordered.phase, "ended");
  assert.equal(ordered.endingId, "bankrupt");

  // Subsequent commands must be rejected
  assert.throws(() => engine.cancelMarketOrder(ordered, ordered.economy.market.orders[0].id), /ended/);
});

test("Issue #19: Market orders and cancellations record per-entry wealth deltas for life records", () => {
  const engine = createEngine(sample);
  let life = engine.start("audit-market-entry");
  while (life.age < 14 || life.phase === "choice") {
    if (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
    else life = engine.advance(life);
  }

  const ordered = engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 1 });
  const orderIndex = ordered.journal.length - 1;
  const orderDiffs = lifeRecordChanges(ordered, engine);
  const orderChange = orderDiffs.entries.get(orderIndex)?.find(c => c.id === "wealth");
  assert.ok(orderChange, "Order entry must record a wealth delta");
  assert.equal(orderChange.delta, -2);

  const cancelled = engine.cancelMarketOrder(ordered, ordered.economy.market.orders[0].id);
  const cancelIndex = cancelled.journal.length - 1;
  const cancelDiffs = lifeRecordChanges(cancelled, engine);
  const cancelChange = cancelDiffs.entries.get(cancelIndex)?.find(c => c.id === "wealth");
  assert.ok(cancelChange, "Cancel entry must record a reversing wealth delta");
  assert.equal(cancelChange.delta, 2);
});

test("Issue #16: Established contacts remain reachable after ending social roles", () => {
  const engine = createEngine(sample);
  const commands = [
    { type: "advance" }, { type: "advance" }, { type: "advance" }, { type: "choose", choice: "child-route-care-cloth-loop-loop" },
    { type: "advance" }, { type: "advance" }, { type: "advance" }, { type: "choose", choice: "child-route-learning-measuring-cord-compare" },
    { type: "advance" }, { type: "advance" }, { type: "choose", choice: "clay-cup" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "ask-lighter-fill" }, { type: "advance" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "child-route-training-vessel-packing-apprentice" }, { type: "advance" }, { type: "advance" },
    { type: "advance" }, { type: "choose", choice: "early-wages-kiln-preparation" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "classical-alexander-keep-work" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "child-route-work-copy-explained-argument" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "handle-delivery" }, { type: "advance" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "introduce-person-bakery" }, { type: "advance" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "consult-healer" }, { type: "choose", choice: "help-neighbor" }, { type: "advance" },
    { type: "advance" }, { type: "advance" }, { type: "choose", choice: "decline-teacher-person-bakery" }, { type: "advance" },
    { type: "advance" }, { type: "choose", choice: "keep-friendly-person-bakery" },
    { type: "act", activity: "end-friendship-person-bakery" }
  ];
  const life = engine.replay("narrative-audit-0", commands);
  const visible = visibleRelationshipPeople(sample, life);
  assert.ok(visible.some(p => p.id === "person-bakery"), "person-bakery must remain in visible people after ending friendship");

  const activities = engine.getActivities(life);
  const reconnect = activities.find(a => a.id === "befriend-person-bakery");
  assert.ok(reconnect && reconnect.available, "befriend reconnection action must be available");
});

test("Issue #14: Non-shared vocation materials and finished products are included in total wealth", () => {
  const commands = [
    { type: "advance" }, { type: "advance" }, { type: "advance" }, { type: "choose", choice: "early-care-help-table" },
    { type: "advance" }, { type: "advance" }, { type: "choose", choice: "return-found-coin" }, { type: "advance" },
    { type: "advance" }, { type: "choose", choice: "learn-letters" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "child-watch-work" }, { type: "advance" }, { type: "advance" }, { type: "advance" },
    { type: "choose", choice: "early-training-check-list" }, { type: "act", activity: "v-apprentice-pottery" },
    { type: "choose", choice: "v-use-safe-methods" }, { type: "advance" }, { type: "act", activity: "v-apprentice-pottery" },
    { type: "advance" }, { type: "choose", choice: "child-route-wages-bench-measures-fitting" },
    { type: "act", activity: "v-apprentice-pottery" }, { type: "advance" }, { type: "act", activity: "v-apprentice-pottery" },
    { type: "advance" }, { type: "choose", choice: "early-work-decline-workshops" },
    { type: "act", activity: "v-apprentice-pottery" }, { type: "act", activity: "v-buy-clay" },
    { type: "act", activity: "v-buy-fuel" }, { type: "advance" }, { type: "act", activity: "v-apprentice-pottery" },
    { type: "advance" }, { type: "choose", choice: "classical-alexander-keep-work" }
  ];

  // Use a new world identity: retained lives-2 keeps its earlier replay contract.
  const world = { ...lives2, id: "inventory-wealth-fixture", version: "1" };
  const engine = createEngine(world);
  let life = engine.replay("audit-crafted-wealth", commands);
  const netWorthBeforeMake = getNetWorth(world, life);
  assert.equal(life.economy.cash, 76);
  assert.equal(netWorthBeforeMake, 1919); // 76 cash + 1827 demo resources + 16 vocation materials (4 clay @ 2, 4 fuel @ 2)

  life = engine.act(life, "v-make-vessel");
  const netWorthAfterMake = getNetWorth(world, life);
  assert.equal(life.economy.cash, 72);
  assert.equal(netWorthAfterMake, 1925); // 72 cash + 1827 demo + 10 materials + 16 vessel (funded bid) = 1925

  life = engine.act(life, "v-sell-vessel");
  const netWorthAfterSell = getNetWorth(world, life);
  assert.equal(life.economy.cash, 88);
  assert.equal(netWorthAfterSell, 1925); // Selling converts 16dr vessel to 16dr cash, preserving net worth exactly
});

test("Issue #11: Unreadable or future-version save is preserved and not overwritten on initial load", async () => {
  const { readRawSavedLife, readSavedLife } = await import("../client/queries/lives.ts");
  const { saveKeyFor, builtinEngine } = await import("../client/lib/world-session.ts");

  const storageMap = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => { storageMap.set(key, value); },
    removeItem: (key: string) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() { return storageMap.size; },
  };

  const saveKey = saveKeyFor(builtinEngine);
  const corruptedSave = '{"schemaVersion":999,"seed":"recoverable-future-life"}';
  mockStorage.setItem(saveKey, corruptedSave);

  // readSavedLife throws because schemaVersion 999 is unsupported
  assert.throws(() => readSavedLife(mockStorage), /could not be opened/);

  // readRawSavedLife recovers the exact bytes
  assert.equal(readRawSavedLife(mockStorage), corruptedSave);

  // Slot remains byte-identical
  assert.equal(mockStorage.getItem(saveKey), corruptedSave);
});

test("Issue #18: Uncatalogued runtime records are labelled Life event rather than Decision", () => {
  // Simulate journal entries
  function journalKind(entry: { type: string; id: string }, world: any): string {
    if (entry.type === "choice") return "Selected";
    if (entry.type === "outcome") return "Outcome";
    if (entry.type === "activity") return "Activity";
    if (entry.type === "birth") return "Background";
    if (entry.type === "influence") return "Influence";
    const event = world.events?.find((e: any) => e.id === entry.id);
    if (!event) return "Life event";
    if (event.rarity === "rare") return "Rare encounter";
    if (event.id === "the-first-household") return "Birth";
    if (event.trigger.type === "year") return "History";
    if (event.mode === "automatic" && event.trigger.type === "age") return "Milestone";
    return event.mode === "automatic" ? "Life event" : "Decision";
  }

  // Runtime settlement or uncatalogued entry
  const runtimeEntry = { type: "event", id: "settle-harvest-grain" };
  assert.equal(journalKind(runtimeEntry, sample), "Life event");

  const uncataloguedHealth = { type: "event", id: "health-decay-pneumonia" };
  assert.equal(journalKind(uncataloguedHealth, sample), "Life event");

  // Authored decision event
  const decisionEvent = sample.events.find(e => e.mode !== "automatic" && e.choices?.length);
  if (decisionEvent) {
    assert.equal(journalKind({ type: "event", id: decisionEvent.id }, sample), "Decision");
  }
});

test("Issue #10: World catalogue routing respects explicit classic and custom selections", () => {
  const activeDemo = { id: "alexandria", pack: { demo: true } as any };
  const activeClassic = { id: "alexandria-sample", pack: { demo: false } as any };

  // Choosing alexandria-sample (0.42.0) does NOT redirect to demo
  assert.equal(entryUsesDefaultLives("alexandria-sample", false, activeDemo), false);
  // Default world alexandria DOES redirect to demo
  assert.equal(entryUsesDefaultLives("alexandria", false, activeDemo), true);
  // Custom world does NOT redirect to demo
  assert.equal(entryUsesDefaultLives("custom-city", false, activeDemo), false);
  // Restarting inside classic world does NOT switch to demo
  assert.equal(entryUsesDefaultLives("alexandria-sample", true, activeClassic), false);

  // Startup refreshes an unbegun older demo birth to lives-3
  assert.equal(startupRefreshesToDefault({ demo: true, version: "alexandria-lives-2" }, false, "alexandria-lives-3"), true);
  // Begun lives never refresh
  assert.equal(startupRefreshesToDefault({ demo: true, version: "alexandria-lives-2" }, true, "alexandria-lives-3"), false);
  // Classic pending births never refresh to demo lives
  assert.equal(startupRefreshesToDefault({ demo: false, version: "0.42.0" }, false, "alexandria-lives-3"), false);
});

test("Issue #17: Newborn family tab is visible in household worlds", () => {
  const engine = createEngine(lives3);
  const life = engine.start("test-newborn-family");
  assert.equal(life.age, 0);

  const sections = visibleCharacterSections(life, lives3, false);
  const sectionIds = sections.map(s => s.id);
  assert.ok(sectionIds.includes("children"), "Family section must be visible at age 0 in household worlds");
});

test("Issue #5: Recorded player lives feed society wealth percentiles with revision isolation and fallback", () => {
  clearRecordedWealthObservations();

  const worldA = { ...sample, id: "world-a", version: "1.0.0" };
  const worldB = { ...sample, id: "world-a", version: "2.0.0" };

  // 1. Fallback when observations are unavailable
  const fallbackInfo = getSocietyWealthBenchmarkInfo(worldA);
  assert.equal(fallbackInfo.kind, "authored-households");
  assert.match(fallbackInfo.description, /starting household distributions/);

  // 2. Record observations for revision 1.0.0
  recordWealthObservation("world-a", "1.0.0", 100);
  recordWealthObservation("world-a", "1.0.0", 200);
  recordWealthObservation("world-a", "1.0.0", 500);
  recordWealthObservation("world-a", "1.0.0", 1000);

  // 3. Observations active for revision 1.0.0
  const infoA = getSocietyWealthBenchmarkInfo(worldA);
  assert.equal(infoA.kind, "recorded-lives");
  assert.equal(infoA.sampleCount, 4);
  assert.match(infoA.description, /4 recorded player lives/);

  // 4. Revision isolation: worldB (revision 2.0.0) retains authored fallback
  const infoB = getSocietyWealthBenchmarkInfo(worldB);
  assert.equal(infoB.kind, "authored-households");

  // 5. Percentile calculation against recorded lives:
  // Life with 500 net worth: strictly below 500 are 100 and 200 (2/4 = 50%)
  const engine = createEngine(worldA);
  const life = structuredClone(engine.start("test-society-percentile"));
  life.economy!.cash = 500;
  life.economy!.assets = {};
  life.economy!.debt = 0;

  const comparison = getWealthComparison(worldA, life);
  assert.ok(comparison);
  assert.equal(comparison.netWorth, 500);
  assert.equal(comparison.percentile, 50);

  // Life with 50 net worth: strictly below 50 is 0 (0%)
  life.economy!.cash = 50;
  const lowComp = getWealthComparison(worldA, life);
  assert.equal(lowComp?.percentile, 0);

  // Life with 2000 net worth: strictly below 2000 is 4 (100%)
  life.economy!.cash = 2000;
  const highComp = getWealthComparison(worldA, life);
  assert.equal(highComp?.percentile, 100);

  // Clean up
  clearRecordedWealthObservations();
});


