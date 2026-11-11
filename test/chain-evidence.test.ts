import assert from "node:assert/strict";
import test from "node:test";
import { FIGURES, influenceFor } from "../chain/catalog/index.ts";
import { buildEvidence, serializeEvidence } from "../chain/evidence.ts";
import { sha256Hex } from "../chain/hash.ts";
import { computeImpacts } from "../chain/impact.ts";
import { careerGroupOf, matchFigures, peakJobOf } from "../chain/match.ts";
import type { LifeView } from "../chain/types.ts";
import { canonicalJson } from "../src/random.ts";
import type { AccomplishmentRecord, Command, InfluenceCommand, JournalEntry, LifeState, SaveFile } from "../src/types.ts";

const CONTRACT = "everfolk-lives.testnet";
const source = (tokenId: string) => ({ contractId: CONTRACT, tokenId });
const influence = (tokenId: string, entry: string, power: number, mode: InfluenceCommand["mode"]): InfluenceCommand =>
  ({ type: "influence", source: source(tokenId), entry, power, mode });
const eventOf = (entry: string) => influenceFor(entry).event!.id;
const sourced = (type: "influence" | "event", id: string, tokenId: string, age = 1): JournalEntry =>
  ({ type, id, text: id, age, year: -350 + age, source: source(tokenId), ...(type === "influence" ? { deltas: {} } : {}) });
const plain = (type: JournalEntry["type"], id: string, age: number): JournalEntry => ({ type, id, text: id, age, year: -350 + age });
const weight = (entry: string) => influenceFor(entry).baseWeight;

function ranked(powers: { lyceum: number; school: number; teach: number; levy: number; levyAgain: number }) {
  const commands: Command[] = [
    influence("1", "aristotle.lyceum", powers.lyceum, "activate"),
    influence("2", "euclid.school", powers.school, "activate"),
    { type: "advance" },
    influence("7", "letters.teach", powers.teach, "apply"),
    { type: "choose", choice: "x" },
    influence("9", "alexander.levy", powers.levy, "apply"),
    influence("11", "alexander.levy", powers.levyAgain, "apply"),
  ];
  const journal: JournalEntry[] = [
    plain("birth", "artisan-household", 0),
    sourced("event", eventOf("aristotle.lyceum"), "1", 9),     // the activated figure event fired
    sourced("influence", "letters.teach", "7", 12),
    sourced("influence", "alexander.levy", "9", 20),
    sourced("event", eventOf("alexander.levy"), "9", 20),     // its queued event fired after the decision
    sourced("influence", "alexander.levy", "11", 30),         // queued but the life ended before it fired
    plain("ending", "old-age", 30),
  ];
  return { commands, journal };
}

test("impact sums fired influences only", () => {
  const { commands, journal } = ranked({ lyceum: 1.5, school: 3, teach: 1.25, levy: 1, levyAgain: 2 });
  assert.deepEqual(computeImpacts(commands, journal), [
    { token_id: "9", impact: 2 * weight("alexander.levy") * 10000 },
    { token_id: "11", impact: weight("alexander.levy") * 20000 },
    { token_id: "1", impact: weight("aristotle.lyceum") * 15000 },
    { token_id: "7", impact: weight("letters.teach") * 12500 },
  ]);
  assert.equal(weight("alexander.levy"), 5);
  assert.ok(!computeImpacts(commands, journal).some(item => item.token_id === "2"), "an activation whose event never fired earns nothing");
  assert.deepEqual(computeImpacts(commands, []), []);
});

test("impact scales by rarity power", () => {
  const common = ranked({ lyceum: 1, school: 1, teach: 1, levy: 1, levyAgain: 1 });
  const legendary = ranked({ lyceum: 3, school: 3, teach: 3, levy: 3, levyAgain: 3 });
  const byToken = (items: { token_id: string; impact: number }[]) => new Map(items.map(item => [item.token_id, item.impact]));
  const low = byToken(computeImpacts(common.commands, common.journal));
  const high = byToken(computeImpacts(legendary.commands, legendary.journal));
  for (const [token, impact] of low) assert.equal(high.get(token), impact * 3, token);
  // round(power × 10000): 1.00005 rounds to 10001, not truncated.
  const odd = ranked({ lyceum: 1.00005, school: 1, teach: 1, levy: 1, levyAgain: 1 });
  assert.equal(byToken(computeImpacts(odd.commands, odd.journal)).get("1"), weight("aristotle.lyceum") * 10001);
});

test("impact rejects a sourced entry without a matching command", () => {
  const { commands, journal } = ranked({ lyceum: 1, school: 1, teach: 1, levy: 1, levyAgain: 1 });
  assert.throws(() => computeImpacts(commands, [...journal, sourced("influence", "letters.teach", "99")]), /no matching influence command/);
  assert.throws(() => computeImpacts(commands, [...journal, sourced("event", "a-place-to-learn", "1")]), /names no influence entry/);
});

interface StateInput {
  origin?: string; jobId?: string | null; heldJobs?: string[]; skills?: Record<string, number>; stats?: Record<string, number>;
  accomplishments?: { achievementId: string; age: number }[]; commands?: Command[]; journal?: JournalEntry[];
}

function state(input: StateInput = {}): LifeState {
  const journal = input.journal ?? [
    plain("birth", input.origin ?? "artisan-household", 0),
    ...(input.heldJobs ?? []).map((job, index) => plain("activity", job, 20 + index)),
    plain("ending", "old-age", 61),
  ];
  return {
    schemaVersion: 1, worldId: "alexandria", worldVersion: "ranked-1", worldFingerprint: "fnv1a64-test", seed: "ab12",
    rngState: 1, age: 61, year: -289, originId: input.origin ?? "artisan-household",
    stats: { health: 20, wealth: 30, knowledge: 50, bonds: 40, ...input.stats },
    flags: {}, phase: "ended", pendingEventId: null, endingId: "old-age", eventCounts: {}, lastEventAge: {},
    character: {
      skills: { literacy: 60, reckoning: 60, philosophy: 10, warfare: 0, oratory: 0, ...input.skills },
      jobId: input.jobId ?? null, partnerId: null, relationshipStatus: "single", children: [], lastActivityAge: null, lastActivityAges: {},
    },
    accomplishments: (input.accomplishments ?? []).map(({ achievementId, age }) => ({ id: `${achievementId}:${age}`, achievementId, age }) as AccomplishmentRecord),
    journal, commands: input.commands ?? [],
  } as LifeState;
}

test("matches Euclid on a qualifying state and not on a near miss", () => {
  const euclid = {
    heldJobs: ["copyist", "sky-table-calculator"], skills: { reckoning: 80, literacy: 70 }, stats: { knowledge: 60 },
    accomplishments: [{ achievementId: "astronomy-calendar-first-work", age: 40 }],
  };
  assert.deepEqual(matchFigures(state(euclid)), ["euclid"], "a job held earlier in life counts after retirement");
  assert.deepEqual(matchFigures(state({ ...euclid, heldJobs: [], jobId: "sky-table-calculator" })), ["euclid"], "the current job counts");
  assert.deepEqual(matchFigures(state({ ...euclid, skills: { reckoning: 79, literacy: 70 } })), []);
  assert.deepEqual(matchFigures(state({ ...euclid, stats: { knowledge: 59 } })), []);
  assert.deepEqual(matchFigures(state({ ...euclid, heldJobs: ["copyist"] })), []);
  assert.deepEqual(matchFigures(state({ ...euclid, accomplishments: [{ achievementId: "commerce-first-work", age: 40 }] })), []);
});

test("matches Alexander only for royal kin with a young accomplishment", () => {
  const alexander = {
    origin: "royal-household", heldJobs: ["soldier", "officer", "general"], skills: { warfare: 70, oratory: 50 },
    accomplishments: [{ achievementId: "military-first-work", age: 32 }],
  };
  assert.deepEqual(matchFigures(state(alexander)), ["alexander"]);
  assert.deepEqual(matchFigures(state({ ...alexander, accomplishments: [{ achievementId: "military-first-work", age: 33 }] })), []);
  assert.deepEqual(matchFigures(state({ ...alexander, origin: "artisan-household" })), []);
  const custom = [{ ...FIGURES[0], maxAgeAtAccomplishment: undefined }];
  assert.deepEqual(matchFigures(state({ ...alexander, accomplishments: [{ achievementId: "military-first-work", age: 50 }] }), custom), ["alexander"]);
});

test("matches Aristotle via philosophy-tutor", () => {
  const aristotle = {
    jobId: "philosophy-tutor", skills: { literacy: 76, philosophy: 76, oratory: 50, reckoning: 10 }, stats: { knowledge: 60 },
    accomplishments: [{ achievementId: "philosophy-first-work", age: 50 }],
  };
  assert.deepEqual(matchFigures(state(aristotle)), ["aristotle"]);
  assert.deepEqual(matchFigures(state({ ...aristotle, skills: { literacy: 76, philosophy: 75, oratory: 50, reckoning: 10 } })), []);
  // Euclid also accepts philosophy-tutor with a philosophy prestige work, so both can match one life.
  assert.deepEqual(matchFigures(state({ ...aristotle, skills: { literacy: 76, philosophy: 76, oratory: 50, reckoning: 80 },
    accomplishments: [{ achievementId: "philosophy-prestige", age: 50 }] })), ["aristotle", "euclid"]);
});

test("career group from peak job", () => {
  assert.equal(peakJobOf(state()), null);
  assert.equal(careerGroupOf(state()), "performance", "a life without work defaults to performance");
  const clerk = state({ heldJobs: ["copyist", "clerk", "porter"], jobId: "soldier" });
  assert.equal(peakJobOf(clerk), "clerk");
  assert.equal(careerGroupOf(clerk), "letters");
  const officer = state({ heldJobs: ["clerk", "soldier", "officer"] });
  assert.equal(peakJobOf(officer), "officer", "equal tiers go to the most recently held job");
  assert.equal(careerGroupOf(officer), "military");
  const workshop = state({ heldJobs: ["apprentice", "potter", "pottery-workshop-lead"], jobId: "potter" });
  assert.equal(peakJobOf(workshop), "pottery-workshop-lead");
  assert.equal(careerGroupOf(workshop), "craft");
  assert.equal(careerGroupOf(state({ jobId: "sky-table-calculator" })), "sky");
});

const LIFE: LifeView = {
  life_id: "42", account_id: "reader.testnet", seed: "ab12", world_version: "alexandria-ranked-1", status: "alive",
  figure_picks: [{ figure_id: "aristotle", token_id: "1", action_id: "aristotle.lyceum", rarity: 2 }],
  draws: [], checkpoints: [], started_at_ms: 1,
};

function finished() {
  const { commands, journal } = ranked({ lyceum: 1.5, school: 1, teach: 1.25, levy: 1, levyAgain: 2 });
  const life = state({
    commands, jobId: "clerk", accomplishments: [{ achievementId: "commerce-first-work", age: 40 }],
    journal: [plain("birth", "artisan-household", 0), plain("activity", "copyist", 18), ...journal.slice(1)],
  });
  const save: SaveFile = { schemaVersion: 1, worldId: life.worldId, worldVersion: life.worldVersion, worldFingerprint: life.worldFingerprint, seed: life.seed, commands };
  return { life, save };
}

test("evidence serialization is canonical and stable", async () => {
  const { life, save } = finished();
  const evidence = await buildEvidence({ life: LIFE, save, state: life, worldFingerprint: life.worldFingerprint });
  assert.deepEqual(Object.keys(evidence).sort(), [
    "account_id", "accomplishments", "birth_year", "career_group", "death_age", "death_year", "life_id", "matched_figures",
    "origin_id", "peak_job_id", "save_hash", "seed", "skills", "sources", "stats", "v", "world_fingerprint", "world_version",
  ].sort());
  assert.equal(evidence.v, 1);
  assert.equal(evidence.seed, LIFE.seed);
  assert.equal(evidence.life_id, "42");
  assert.equal(evidence.account_id, "reader.testnet");
  assert.equal(evidence.world_version, "alexandria-ranked-1");
  assert.equal(evidence.world_fingerprint, "fnv1a64-test");
  assert.equal(evidence.save_hash, await sha256Hex(canonicalJson(save)));
  assert.equal(evidence.origin_id, "artisan-household");
  assert.equal(evidence.peak_job_id, "clerk");
  assert.equal(evidence.career_group, "letters");
  assert.deepEqual(evidence.accomplishments, [{ id: "commerce-first-work", age: 40 }]);
  assert.equal(evidence.death_age, 61);
  assert.equal(evidence.birth_year, -350);
  assert.equal(evidence.death_year, -289);
  assert.deepEqual(evidence.stats, life.stats);
  assert.deepEqual(evidence.skills, life.character!.skills);
  assert.deepEqual(evidence.sources, computeImpacts(save.commands, life.journal));
  assert.deepEqual(evidence.sources.map(item => item.token_id), ["9", "11", "1", "7"]);

  const json = serializeEvidence(evidence);
  assert.equal(json, canonicalJson(evidence));
  const reordered = Object.fromEntries(Object.entries(evidence).reverse()) as typeof evidence;
  assert.equal(serializeEvidence(reordered), json, "key order does not change the signed bytes");
  const again = await buildEvidence({ life: LIFE, save: structuredClone(save), state: structuredClone(life), worldFingerprint: life.worldFingerprint });
  assert.equal(serializeEvidence(again), json);
  assert.deepEqual(JSON.parse(json), evidence);
});

test("evidence refuses mismatched or unfinished lives", async () => {
  const { life, save } = finished();
  const build = (overrides: { life?: LifeView; save?: SaveFile; state?: LifeState; worldFingerprint?: string }) => buildEvidence({
    life: LIFE, save, state: life, worldFingerprint: life.worldFingerprint, ...overrides,
  });
  await assert.rejects(build({ life: { ...LIFE, seed: "cd34" } }), /seed/);
  await assert.rejects(build({ state: { ...life, phase: "ready" } }), /not ended/);
  await assert.rejects(build({ save: { ...save, commands: save.commands.slice(1) } }), /commands/);
  await assert.rejects(build({ worldFingerprint: "fnv1a64-other" }), /world/);
});
