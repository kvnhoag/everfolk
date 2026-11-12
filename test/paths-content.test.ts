import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { FIELD_IDS } from "../src/paths/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };

const world = shipped as unknown as WorldPack;
const engine = createEngine(world);
const byId = new Map(world.events.map(event => [event.id, event]));

interface Played { life: LifeState; offered: Array<[number, string]> }

function live(seed: string, pick: number): Played {
  let life = engine.start(seed);
  const offered: Array<[number, string]> = [];
  for (let guard = 0; life.phase !== "ended" && guard < 600; guard++) {
    if (life.phase === "choice") {
      offered.push([life.age, life.pendingEventId!]);
      const choices = engine.getChoices(life);
      life = engine.choose(life, choices[(pick + guard) % choices.length].id);
    } else life = engine.advance(life);
  }
  return { life, offered };
}

const lives = Array.from({ length: 300 }, (_, i) => live(`paths-content-${i}`, i));
const adults = lives.filter(({ life }) => life.age >= 18);

test("inspiration events exist for every field and stage band, with the right stages and scopes", () => {
  const expected: Record<string, { stages: string[]; scope?: string; automatic: boolean }> = {
    child: { stages: ["early-childhood", "childhood"], automatic: true },
    young: { stages: ["adolescence", "youth"], scope: "personal", automatic: false },
    adult: { stages: ["adulthood"], scope: "work", automatic: false },
    elder: { stages: ["later-life"], automatic: true },
  };
  for (const field of FIELD_IDS) for (const [band, rule] of Object.entries(expected)) {
    const event = byId.get(`inspire-${field}-${band}`);
    assert.ok(event, `inspire-${field}-${band}`);
    assert.deepEqual(event.stages, rule.stages);
    assert.equal(event.scope, rule.scope);
    assert.equal(event.mode === "automatic", rule.automatic);
    assert.deepEqual(event.fields, [field]);
  }
});

test("lives meet people from every field their districts have", () => {
  for (const field of FIELD_IDS) {
    const reachable = adults.filter(({ life }) => life.paths!.people[field].some(count => count > 0) ||
      life.paths!.practitioners.some(person => person.field === field));
    const met = reachable.filter(({ life }) => life.paths!.practitioners.some(person => person.field === field));
    assert.ok(reachable.length > 0, `${field} is reachable somewhere`);
    assert.ok(met.length >= reachable.length * 0.25, `${field}: met in ${met.length} of ${reachable.length} lives that could`);
  }
});

test("renowned people are rare in a village and common at court", () => {
  const renowned = (district: string) => {
    const group = lives.filter(({ life }) => life.paths!.home === district);
    return { share: group.filter(({ life }) => life.paths!.practitioners.some(person => person.tier === "renowned")).length / Math.max(1, group.length), count: group.length };
  };
  const village = renowned("delta-village"), court = renowned("court-quarter");
  assert.ok(village.share < 0.1, `village ${village.share}`);
  assert.ok(court.count >= 5, `court lives sampled: ${court.count}`);
  assert.ok(court.share > 0.3, `court ${court.share}`);
});

const HOLDINGS: Record<string, { stages: string[]; scope?: string }> = {
  "holdings-harvest-carrying": { stages: ["early-childhood", "childhood"] },
  "holdings-full-granary": { stages: ["adulthood", "later-life"], scope: "household" },
  "holdings-seed-lending": { stages: ["adulthood", "later-life"], scope: "household" },
  "holdings-spare-flax": { stages: ["childhood"] },
  "holdings-flax-choice": { stages: ["adolescence", "youth", "adulthood"], scope: "work" },
  "holdings-linen-bolt": { stages: ["adulthood"], scope: "household" },
  "holdings-clay-play": { stages: ["early-childhood", "childhood"], scope: "personal" },
  "holdings-kiln-share": { stages: ["adolescence", "youth", "adulthood"], scope: "work" },
  "holdings-papyrus-letters": { stages: ["childhood"], scope: "personal" },
  "holdings-old-tablets": { stages: ["childhood", "adolescence"], scope: "personal" },
  "holdings-copy-accounts": { stages: ["adolescence", "youth", "adulthood"], scope: "work" },
  "holdings-silver-heirloom": { stages: ["adulthood"], scope: "household" },
  "holdings-savings-plan": { stages: ["adulthood"], scope: "household" },
  "holdings-ox-ploughing": { stages: ["adolescence", "youth", "adulthood"], scope: "work" },
  "holdings-donkey-hauling": { stages: ["adolescence", "youth", "adulthood"], scope: "work" },
  "holdings-stone-offcut": { stages: ["adolescence", "youth", "adulthood"], scope: "work" },
  "holdings-army-kit": { stages: ["childhood"] },
  "holdings-drill-yard": { stages: ["adolescence", "youth"], scope: "personal" },
  "holdings-market-stall": { stages: ["adulthood", "later-life"], scope: "household" },
  "holdings-gift-of-tools-ceramics": { stages: ["adolescence", "youth", "adulthood"] },
  "holdings-gift-of-tools-clothing": { stages: ["adolescence", "youth", "adulthood"] },
  "holdings-gift-of-tools-sculpture": { stages: ["adolescence", "youth", "adulthood"] },
};

test("holdings events exist with their time frames, scopes and fields", () => {
  for (const [id, rule] of Object.entries(HOLDINGS)) {
    const event = byId.get(id);
    assert.ok(event, id);
    assert.deepEqual(event.stages, rule.stages, id);
    assert.equal(event.scope, rule.scope, id);
    assert.ok(event.fields?.length, `${id} has fields`);
    assert.ok(event.when, `${id} has a cause`);
  }
});

test("holdings events never create money", () => {
  for (const id of Object.keys(HOLDINGS)) {
    const event = byId.get(id)!;
    const effects = [...(event.effects ?? []), ...event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))];
    for (const effect of effects) {
      assert.ok(!(effect.type === "cash" && effect.delta > 0), `${id} creates cash`);
      assert.ok(!(effect.type === "demo" && (effect.effect.kind === "grain" || effect.effect.kind === "item") && effect.effect.delta > 0), `${id} creates goods`);
    }
  }
});

test("what a household holds is felt: holdings events pull many lives toward their field", () => {
  // Household stores converge after a few harvests, so holdings are read when an event fires, not from the birth roll.
  const village = adults.filter(({ life }) => life.paths!.home === "delta-village");
  const pulledByHarvest = village.filter(({ life }) => life.journal.some((entry, i) => entry.id === "holdings-harvest-carrying" &&
    life.journal.slice(i + 1, i + 4).some(next => next.id === "paths-affinity-farming")));
  assert.ok(village.length >= 50, `${village.length} village lives`);
  assert.ok(pulledByHarvest.length >= village.length * 0.2, `${pulledByHarvest.length} of ${village.length} village lives pulled by a harvest`);
  const holdingsFired = lives.filter(({ life }) => Object.keys(life.eventCounts).some(id => id.startsWith("holdings-"))).length;
  assert.ok(holdingsFired >= lives.length * 0.5, `${holdingsFired} of ${lives.length} lives had a holdings event`);
});

const NEEDS_AND_MOVES: Record<string, { stages: string[]; scope?: string }> = {
  ...Object.fromEntries(FIELD_IDS.map(field => [`need-scarce-${field}`, { stages: ["youth", "adulthood", "later-life"], scope: "work" }])),
  ...Object.fromEntries(FIELD_IDS.map(field => [`need-master-offer-${field}`, { stages: ["adolescence", "youth"], scope: "work" }])),
  ...Object.fromEntries(["ceramics", "clothing", "sculpture"].map(field => [`need-commission-${field}`, { stages: ["adulthood"], scope: "work" }])),
  "need-war-recruiting": { stages: ["adulthood"], scope: "community" },
  "need-flood-trade": { stages: ["adulthood"], scope: "household" },
  "move-city-apprenticeship": { stages: ["adolescence", "youth"], scope: "work" },
  "move-court-study": { stages: ["youth", "adulthood"], scope: "work" },
  "move-garrison-posting": { stages: ["adulthood"] },
  "move-return-home": { stages: ["adulthood", "later-life"], scope: "personal" },
  "move-letter-from-home": { stages: ["youth", "adulthood", "later-life"] },
};

test("world-need and move events exist with their time frames and scopes", () => {
  for (const [id, rule] of Object.entries(NEEDS_AND_MOVES)) {
    const event = byId.get(id);
    assert.ok(event, id);
    assert.deepEqual(event.stages, rule.stages, id);
    assert.equal(event.scope, rule.scope, id);
    assert.ok(event.when, `${id} has a cause`);
  }
});

test("new events never create money or goods", () => {
  for (const id of Object.keys(NEEDS_AND_MOVES)) {
    const event = byId.get(id)!;
    const effects = [...(event.effects ?? []), ...event.choices.flatMap(choice => choice.outcomes.flatMap(outcome => outcome.effects))];
    for (const effect of effects) {
      assert.ok(!(effect.type === "cash" && effect.delta > 0), `${id} creates cash`);
      assert.ok(!(effect.type === "demo" && (effect.effect.kind === "grain" || effect.effect.kind === "item") && effect.effect.delta > 0), `${id} creates goods`);
    }
  }
});

test("a scarce-field offer is only made while that field is scarce", () => {
  let offers = 0;
  for (let i = 0; i < 120; i++) {
    let life = engine.start(`scarce-${i}`);
    for (let guard = 0; life.phase !== "ended" && guard < 600; guard++) {
      if (life.phase !== "choice") { life = engine.advance(life); continue; }
      const id = life.pendingEventId!;
      if (id.startsWith("need-scarce-")) {
        offers++;
        const field = id.slice("need-scarce-".length) as keyof NonNullable<LifeState["paths"]>["needs"];
        assert.equal(life.paths!.needs[field].label, "scarce", `${id} at age ${life.age}`);
      }
      life = engine.choose(life, engine.getChoices(life)[0].id);
    }
  }
  assert.ok(offers > 0, "some scarce-field offers were made");
});

test("lives move for apprenticeships and study, and only the player moves", () => {
  const moved = lives.filter(({ life }) => life.paths!.moves.length > 0);
  assert.ok(moved.length > 0, "some lives moved");
  for (const { life } of moved) {
    const homeOrigins = world.paths!.districts[life.paths!.home].origins;
    assert.ok(homeOrigins.includes(life.originId), "home stays the birth district");
  }
});

test("at the height of a war, recruiters make an offer that some lives accept", () => {
  const offered = lives.filter(({ offered }) => offered.some(([, id]) => id === "need-war-recruiting"));
  const enlisted = lives.filter(({ life }) => life.journal.some(entry => entry.id === "need-war-recruiting-enlist-done"));
  assert.ok(offered.length > 0, "recruiting offers were made");
  assert.ok(enlisted.length > 0, "some lives enlisted");
});

test("a recruiting offer only comes when the life can act on it", () => {
  let offers = 0;
  for (let i = 0; i < 200; i++) {
    let life = engine.start(`recruit-${i}`);
    for (let guard = 0; life.phase !== "ended" && guard < 600; guard++) {
      if (life.phase !== "choice") { life = engine.advance(life); continue; }
      const choices = engine.getChoices(life);
      if (life.pendingEventId === "need-war-recruiting") {
        offers++;
        assert.ok(life.age >= 18, `offered at ${life.age}`);
        assert.ok(choices.some(choice => !choice.id.endsWith("-stay")), `only "stay" is open at age ${life.age}`);
      }
      life = engine.choose(life, choices[0].id);
    }
  }
  assert.ok(offers > 10, `${offers} recruiting offers`);
});
