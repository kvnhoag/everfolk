import type { Condition, Effect, LifeEvent, WorldPack } from "../types.ts";
import type { VocationAction, VocationDefinition } from "./types.ts";
import design from "../../design/skill-tree/catalog.json" with { type: "json" };

/** A new free-play revision. Contract-backed lives retain their deployed demo revision. */
import { LIVES_WORLD_VERSION } from "./ids.ts";
export { LIVES_WORLD_VERSION } from "./ids.ts";
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const skill = (id: string, value: number): Condition => ({ type: "skill", skill: id, op: "gte", value });
const proof = (action: string, count = 1): Condition => ({ type: "vocation", action, count });
const stat = (id: string, delta: number): Effect => ({ type: "stat", stat: id, delta });
const vocation = (action: string): Effect => ({ type: "vocation", action });

export function buildVocationWorld(base: WorldPack): WorldPack {
  const world = structuredClone(base), character = world.character!;
  world.version = LIVES_WORLD_VERSION;
  world.title = "Alexandria — Handmade work and public life";
  world.description = "Grow up in a farming household, buy materials and make useful things, or pursue inquiry and public service. Work changes your skills, health, knowledge, bonds and household economy.";
  const definition: VocationDefinition = { materials: {}, recipes: {}, actions: {}, accounts: { merchant: 20000, workshop: 6000, school: 4000, council: 4000 }, demand: {} };
  world.vocations = definition;
  // Explicit material quantities and integer prices; the supplier has finite stock.
  const prices: Record<string, number> = { flax: 3, linen: 25, thread: 4, clay: 2, fuel: 2, timber: 5, stone: 30, pigment: 6, papyrus: 2, ink: 1 };
  for (const [id, price] of Object.entries(prices)) definition.materials[id] = { price, stock: 200 };
  const supportedSkills = ["craft", "pottery", "carving", "sculpture", "philosophy", "literacy", "reckoning", "oratory"];
  for (const id of supportedSkills) {
    // The new work templates define learning gates. Do not inherit old skill prerequisites.
    delete character.skills[id].prerequisites;
    delete character.skills[id].trainingActivity;
    delete character.skills[id].gainCurve;
  }
  const newJobs: { id: string; title: string; requirements: Record<string, number> }[] = [
    { id: "apprentice", title: "Artisan apprentice", requirements: {} },
    { id: "tailor", title: "Tailor", requirements: { craft: 32, reckoning: 16 } },
    { id: "potter", title: "Potter", requirements: { craft: 32, pottery: 24 } },
    { id: "sculptor", title: "Sculptor", requirements: { craft: 32, sculpture: 24 } },
    { id: "philosophy-tutor", title: "Philosopher and tutor", requirements: { philosophy: 32, literacy: 24, oratory: 16 } },
    { id: "scientist", title: "Scientist", requirements: { philosophy: 72, literacy: 48, reckoning: 56 } },
    { id: "politician", title: "Politician", requirements: { philosophy: 72, oratory: 64, reckoning: 40 } },
  ];
  const enabled = new Set(newJobs.map(j => j.id));
  for (const job of newJobs) {
    const next = { ...job, minAge: job.id === "apprentice" ? 12 : 18, description: "Qualification opens work opportunities; earnings come from completed paid work or sales.", yearlyEffects: [] };
    const at = character.jobs.findIndex(j => j.id === job.id);
    if (at >= 0) character.jobs[at] = next; else character.jobs.push(next);
  }
  // These old activities bypass recorded production/inquiry. New offers below replace them.
  character.activities = character.activities.filter(a => !a.outcomes.some(o => o.effects.some(e => e.type === "job" && e.job && enabled.has(e.job))));
  // Legacy career stories used different entry ages and skill gates. Their job
  // offers must not bypass this revision's demonstrated-work qualifications.
  world.events = world.events.map(event => ({ ...event,
    choices: event.choices.filter(choice => !choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job" && effect.job && enabled.has(effect.job)))),
  })).filter(event => event.mode === "automatic" || event.choices.length > 0);
  const addAction = (id: string, title: string, action: VocationAction, options: { when?: Condition; effects?: Effect[]; minAge?: number } = {}): void => {
    definition.actions[id] = action;
    const major = action.kind === "make" || action.kind === "work";
    character.activities.push({ id: `v-${id}`, text: title, category: action.kind === "work" && action.practice ? "training" : "career", minAge: options.minAge ?? (major ? 12 : 16), usesYearlyActivity: major,
      ...(options.when ? { when: options.when } : {}), outcomes: [{ id: `v-${id}-done`, text: title, weight: 1, effects: [vocation(id), ...(options.effects ?? [])] }] });
  };
  for (const id of Object.keys(prices)) {
    const quantity = id === "thread" ? 4 : id === "stone" ? 6 : id === "papyrus" || id === "ink" ? 2 : 4;
    addAction(`buy-${id}`, `Buy ${quantity} ${id} (${prices[id] * quantity} dr)`, { kind: "buy", item: id, quantity });
  }
  for (const recipe of design.recipes) {
    const output = ["dyed-garment", "decorated-vessel"].includes(recipe.id) ? recipe.id : Object.keys(recipe.output)[0];
    const inputs = Object.fromEntries(Object.entries(recipe.inputs).filter((entry): entry is [string, number] => typeof entry[1] === "number"));
    // A single decorated vessel needs one pigment unit; batch discounts remain a later feature.
    if (output === "decorated-vessel") inputs.pigment = 1;
    const minimum = recipe.requires === "A3" ? 24 : recipe.requires.endsWith("9") ? 64 : recipe.requires.endsWith("7") ? 48 : recipe.requires.endsWith("6") ? 40 : 32;
    definition.recipes[recipe.id] = { title: recipe.name ?? recipe.id.replaceAll("-", " "), inputs, output, outputQuantity: Object.values(recipe.output).find((n): n is number => typeof n === "number")!, fee: recipe.fee, workYears: recipe.workYears ?? 1,
      skills: { craft: minimum }, primary: recipe.workProficiencies.primary, supports: recipe.workProficiencies.supports, baseAsk: recipe.baseAsk };
    definition.demand[output] = 30;
    addAction(`make-${recipe.id}`, `Make ${output} (${recipe.fee} dr workshop fee; ${recipe.workYears ?? 1} work year${recipe.workYears === 2 ? "s" : ""})`, { kind: "make", recipe: recipe.id }, { effects: [stat("knowledge", 1)] });
    addAction(`sell-${output}`, `Sell one ${output} to a funded buyer`, { kind: "sell", item: output });
  }
  const work = (id: string, title: string, primary: string, supports: string[], fee: number, pay: number, payer: "workshop" | "school" | "council", when?: Condition, effects: Effect[] = []): void =>
    addAction(id, title, { kind: "work", fee, pay, payer, primary, supports, practice: false }, { when, effects });
  work("apprentice-textiles", "Work a year with a textile maker (12 dr)", "craft", ["reckoning"], 0, 12, "workshop", undefined, [stat("knowledge", 1)]);
  work("apprentice-pottery", "Work a year with a potter (12 dr)", "craft", ["pottery", "reckoning"], 0, 12, "workshop", undefined, [stat("knowledge", 1)]);
  work("apprentice-sculpture", "Work a year with a sculptor (12 dr)", "craft", ["carving", "sculpture"], 0, 12, "workshop", undefined, [stat("knowledge", 1)]);
  for (const id of supportedSkills) addAction(`practice-${id}`, `Practice ${character.skills[id].label} (2 dr)`, { kind: "work", primary: id, supports: [], fee: 2, pay: 0, payer: "workshop", practice: true }, { effects: [stat("knowledge", 1)] });
  work("study-argument", "Study arguments and compare evidence (3 dr)", "philosophy", ["literacy", "oratory"], 3, 0, "school", undefined, [stat("knowledge", 2)]);
  work("measure-observations", "Record a year of measurements (3 dr)", "philosophy", ["reckoning", "literacy"], 3, 0, "school", skill("philosophy", 24), [stat("knowledge", 2)]);
  work("test-explanation", "Test an explanation against observations (4 dr)", "philosophy", ["reckoning", "literacy"], 4, 0, "school", all(skill("philosophy", 40), proof("measure-observations", 2)), [stat("knowledge", 2)]);
  work("independent-check", "Repeat an inquiry and check its result (4 dr)", "philosophy", ["reckoning", "literacy"], 4, 0, "school", all(skill("philosophy", 56), proof("test-explanation", 2)), [stat("knowledge", 2)]);
  work("original-inquiry", "Complete an original inquiry (6 dr)", "philosophy", ["reckoning", "literacy"], 6, 0, "school", all(skill("philosophy", 64), proof("independent-check", 2)), [stat("knowledge", 3)]);
  work("public-address", "Present an evidence-based public argument", "philosophy", ["oratory", "literacy"], 0, 0, "council", skill("philosophy", 24), [stat("bonds", 1), stat("knowledge", 1)]);
  work("negotiate-agreement", "Negotiate and fulfil a neighbourhood agreement", "philosophy", ["oratory", "reckoning"], 0, 0, "council", all(skill("philosophy", 40), proof("public-address", 2)), [stat("bonds", 2)]);
  work("audit-accounts", "Reconcile public accounts with receipts", "philosophy", ["reckoning", "literacy"], 0, 0, "council", all(skill("philosophy", 48), proof("negotiate-agreement", 2)), [stat("knowledge", 1), stat("bonds", 1)]);
  work("policy-review", "Implement a district policy and review its costs", "philosophy", ["oratory", "reckoning"], 0, 0, "council", all(skill("philosophy", 64), proof("audit-accounts", 2)), [stat("bonds", 2), stat("knowledge", 1)]);
  work("paid-tutoring", "Teach a year of reasoning (24 dr)", "philosophy", ["oratory", "literacy"], 0, 24, "school", { type: "job", job: "philosophy-tutor" }, [stat("knowledge", 1), stat("bonds", 1)]);
  work("paid-research", "Complete a funded research year (36 dr)", "philosophy", ["reckoning", "literacy"], 0, 36, "school", { type: "job", job: "scientist" }, [stat("knowledge", 2)]);
  work("public-service", "Complete a funded public-service year (30 dr)", "philosophy", ["oratory", "reckoning"], 0, 30, "council", { type: "job", job: "politician" }, [stat("bonds", 1)]);
  const appointmentProof: Record<string, Condition> = {
    apprentice: { type: "any", conditions: [proof("apprentice-textiles"), proof("apprentice-pottery"), proof("apprentice-sculpture")] },
    tailor: proof("make-garment", 2), potter: proof("make-vessel", 2), sculptor: proof("make-small-relief", 2),
    "philosophy-tutor": proof("study-argument", 3), scientist: proof("original-inquiry", 2), politician: proof("policy-review", 2),
  };
  for (const job of newJobs) character.activities.push({ id: `v-qualify-${job.id}`, text: `Take up work as ${job.title.toLowerCase()}`, category: "career", minAge: job.id === "apprentice" ? 12 : 18,
    when: appointmentProof[job.id], outcomes: [{ id: `v-appointed-${job.id}`, text: `Your demonstrated work qualifies you as ${job.title.toLowerCase()}. Earnings require actual work or product sales.`, weight: 1, effects: [{ type: "job", job: job.id }] }] });
  for (const [id, label] of Object.entries({ "v-workshop-safe": "Adopted safe workshop practice", "v-research-credit": "Credited the source of a discovery", "v-public-accounts": "Published the district accounts" })) world.flags[id] = { label, initial: false };
  const event = (id: string, title: string, text: string, when: Condition, choices: { id: string; text: string; effects: Effect[] }[]): LifeEvent => ({ id, title, text, trigger: { type: "year", at: world.startYear }, when, choices: choices.map(c => ({ id: c.id, text: c.text, outcomes: [{ id: `${c.id}-result`, text: c.text, weight: 1, effects: c.effects }] })), evidence: "fictional" });
  world.events.push(
    event("v-workshop-safety", "Dust in the workshop", "After a year of making, a mentor asks how you will handle dust and sharp tools. Better habits protect your health; rushing leaves injuries that linger.", { type: "any", conditions: Object.entries(definition.actions).filter(([id, a]) => a.kind === "make" || id.startsWith("apprentice-")).map(([id]) => proof(id)) }, [
      { id: "v-use-safe-methods", text: "Slow down and adopt the safe working method", effects: [{ type: "flag", flag: "v-workshop-safe", value: true }, stat("knowledge", 1)] },
      { id: "v-rush-the-work", text: "Keep rushing the work", effects: [stat("health", -4)] },
    ]),
    event("v-evidence-dispute", "Whose observation?", "Your written explanation draws on another worker's observation. A colleague asks you to give them credit. The choice affects trust, not the measured result.", proof("test-explanation"), [
      { id: "v-credit-observer", text: "Name the observer and share the credit", effects: [{ type: "flag", flag: "v-research-credit", value: true }, stat("bonds", 3), stat("knowledge", 1)] },
      { id: "v-withhold-credit", text: "Claim the observation as your own", effects: [stat("bonds", -4)] },
    ]),
    event("v-public-ledger", "The accounts are questioned", "Families who contributed grain want to see the district accounts. A clear record can build trust, while hiding the figures leaves them doubtful.", proof("audit-accounts"), [
      { id: "v-publish-ledger", text: "Publish the receipts and explain the costs", effects: [{ type: "flag", flag: "v-public-accounts", value: true }, stat("bonds", 4), stat("knowledge", 1)] },
      { id: "v-hide-ledger", text: "Keep the accounts private", effects: [stat("bonds", -5)] },
    ]),
  );
  const available = world.demo!.availability;
  available.playableJobs.push(...newJobs.map(j => j.id).filter(id => !available.playableJobs.includes(id)));
  available.unavailableJobs = available.unavailableJobs.filter(id => !enabled.has(id));
  available.unavailableSkills = available.unavailableSkills.filter(id => !supportedSkills.includes(id));
  // Keep unrelated older training/career shortcuts unavailable; only these authored new activities activate.
  available.unavailableActivities = available.unavailableActivities.filter(id => character.activities.some(a => a.id === id));
  available.futurePaths = available.futurePaths.filter(p => p.id !== "crafts").map(p => p.id === "scholarship" ? { ...p, title: "Astronomy and astrology", description: "Dedicated astronomical and astrological careers." } : p);
  return world;
}
