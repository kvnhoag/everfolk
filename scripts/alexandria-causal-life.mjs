// This is an authored play model. The source records support historical context,
// not reconstructed disease incidence, treatment efficacy or relationship scores.
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const cash = delta => ({ type: "cash", delta });
const care = amount => ({ type: "care", amount });
const closeness = (delta, partner) => ({ type: "closeness", target: "partner", ...(partner ? { partner } : {}), delta });
const hasCondition = { type: "has-condition" };
const cashAtLeast = value => ({ type: "cash", op: "gte", value });
const ageAtLeast = value => ({ type: "age", op: "gte", value });
const all = (...conditions) => ({ type: "all", conditions });
const one = (id, text, result, effects, when) => ({
  id, text, ...(when ? { when } : {}), outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }],
});

export function applyCausalLife(world) {
  world.health = {
    description: "Deaths in new lives follow an active named illness, injury or prolonged physical decline, or an explicitly dangerous choice. There is no separate age-band death roll. Condition onset, recovery, Health loss and care effects are authored gameplay values, not measured Ptolemaic disease rates or clinical advice. Annual steps organize playable episodes; they do not claim that an acute infection went untreated for a full year. Historical comparison mortality bands remain recorded separately.",
    sourceIds: ["family-care", "alexandrian-wetnursing", "roman-model-life-table", "demography-evidence-limits"],
    stat: "health", criticalHealth: 20, declineCondition: "physical-decline", careDecision: "medical-care-needed",
    supportRecoveryBonus: 0.15,
    incidenceBands: [
      { minAge: 0, maxAge: 4, annualProbability: 0.01 },
      { minAge: 5, maxAge: 14, annualProbability: 0.008 },
      { minAge: 15, maxAge: 44, annualProbability: 0.02 },
      { minAge: 45, maxAge: 64, annualProbability: 0.035 },
      { minAge: 65, maxAge: 79, annualProbability: 0.05 },
      { minAge: 80, maxAge: 99, annualProbability: 0.06 },
    ],
    declineBands: [
      { minAge: 0, maxAge: 44, healthLoss: 0 },
      { minAge: 45, maxAge: 64, healthLoss: 1 },
      { minAge: 65, maxAge: 79, healthLoss: 2 },
      { minAge: 80, maxAge: 94, healthLoss: 3 },
      { minAge: 95, maxAge: 99, healthLoss: 5 },
    ],
    conditions: [
      { id: "pneumonia", title: "Pneumonia", deathCause: "early-illness", kind: "illness", weight: 3, healthLoss: 8, recoveryChance: 0.35, careRecoveryBonus: 0.4, fatalHealthThreshold: 5 },
      { id: "malaria", title: "Malaria", deathCause: "severe-fever", kind: "illness", weight: 2, healthLoss: 6, recoveryChance: 0.4, careRecoveryBonus: 0.35, fatalHealthThreshold: 5 },
      { id: "dysentery", title: "Dysentery", deathCause: "abdominal-illness", kind: "illness", weight: 2, healthLoss: 10, recoveryChance: 0.35, careRecoveryBonus: 0.4, fatalHealthThreshold: 5 },
      { id: "tuberculosis", title: "Tuberculosis", deathCause: "breathing-illness", kind: "illness", weight: 1, when: ageAtLeast(15), healthLoss: 7, recoveryChance: 0.1, careRecoveryBonus: 0.2, fatalHealthThreshold: 5 },
      { id: "infected-wound", title: "An infected wound", deathCause: "sudden-illness", kind: "illness", weight: 1, when: ageAtLeast(12), healthLoss: 12, recoveryChance: 0.25, careRecoveryBonus: 0.4, fatalHealthThreshold: 5 },
      { id: "open-leg-fracture", title: "An open tibial fracture", deathCause: "fracture-sepsis", kind: "injury", weight: 0, healthLoss: 12, recoveryChance: 0.25, careRecoveryBonus: 0.35, fatalHealthThreshold: 5 },
      { id: "physical-decline", title: "Prolonged physical decline", deathCause: "physical-decline-failure", kind: "frailty", weight: 0, healthLoss: 5, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 0 },
    ],
  };
  world.yearlyRules = world.yearlyRules.filter(rule => rule.id !== "later-life-strength");
  world.mortality.description = "These age bands preserve the earlier game's Roman-Egyptian female comparison and easier-play conversion for inspection and legacy context. The source is not a measured life table for a Ptolemaic Alexandrian man. New 0.15.0 lives use active health conditions and explicit dangerous outcomes rather than independently sampling these death probabilities. Earlier survival percentages therefore do not describe the new causal-health model. Reaching the age-100 record limit does not itself assign a death.";
  world.character.deathCauseDescription = "For new causal-health lives, a natural death names the actual unresolved condition that depleted Health. Explicit dangerous choices retain their authored fatal outcomes and record the choice that caused death. Disease and injury names are modern labels for clarity, not diagnoses reconstructed from ancient individuals or calibrated cause-specific rates. Condition onset, progression, recovery, care and relationship effects are authored gameplay. The comparative mortality data does not supply these values.";
  world.character.deathCauses.push(
    { id: "fracture-sepsis", title: "Sepsis following an open tibial fracture", text: "The open fracture becomes infected. Sepsis develops, and the injury becomes fatal.", weight: 1 },
    { id: "physical-decline-failure", title: "Multiple organ failure following prolonged physical decline", text: "Your health has steadily deteriorated. Prolonged physical decline leads to multiple organ failure.", weight: 1 },
  );

  const medicalChoices = [
    one("rest-and-care", "Rest and ask for help", "The household makes time for rest and helps with water, food and everyday tasks. Recovery is not certain.", [care(0.55), stat("health", 3)]),
    one("consult-healer", "Consult a healer for 10 drachmas", "You arrange a healer's visit and set aside time for care. The visit does not guarantee recovery.", [cash(-10), care(0.9), stat("health", 5)], cashAtLeast(10)),
    one("carry-on", "Keep the usual routine", "The household keeps to its usual routine without arranging extra care. Your health suffers.", [stat("health", -2)]),
  ];
  world.events.push({
    id: "medical-care-needed", title: "Care is needed",
    text: "An illness or injury is affecting your health. You and the people caring for you must decide what extra help to arrange.",
    trigger: { type: "random", weight: 1 }, when: hasCondition,
    maxOccurrences: 100, cooldownYears: 1, evidence: "fictional", sourceIds: ["family-care"], choices: medicalChoices,
  });
  const recoveryActivity = (id, text, amount, gain, cost = 0, when) => ({
    ...one(id, text, cost ? "You arrange a healer's visit and make time for care. You may still need further recovery." : "You make time for rest and practical help while you recover.",
      [...(cost ? [cash(-cost)] : []), care(amount), stat("health", gain)], all(hasCondition, ...(cost ? [cashAtLeast(cost)] : []), ...(when ? [when] : []))),
    category: "family", minAge: 0, cooldownYears: 1, usesYearlyActivity: false,
  });
  world.character.activities.push(
    recoveryActivity("rest-for-recovery", "Rest while recovering", 0.5, 3),
    recoveryActivity("seek-a-healer", "Ask a healer for care — 10 drachmas", 0.9, 5, 10),
    recoveryActivity("ask-household-care", "Ask the household for help with care", 0.7, 4, 0, { type: "stat", stat: "bonds", op: "gte", value: 30 }),
  );

  const unwell = world.events.find(event => event.id === "an-unwell-week");
  unwell.when = all(unwell.when, hasCondition);
  unwell.text = "You are still recovering from an illness or injury. Everyday tasks take longer, and some work has to wait.";
  unwell.mode = "automatic";
  unwell.effects = [];
  unwell.choices = [];
  const outcomes = [...world.events.flatMap(event => event.choices), ...world.character.activities].flatMap(choice => choice.outcomes);
  const legInjury = outcomes.find(outcome => outcome.id === "night-cargo-injury");
  legInjury.text = "A shifting cargo load causes an open tibial fracture. You cannot finish the shift and need care.";
  legInjury.effects.push({ type: "condition", condition: "open-leg-fracture" });
  const cargoActivity = world.character.activities.find(activity => activity.outcomes.includes(legInjury));
  cargoActivity.when = all(cargoActivity.when, { type: "not", condition: { type: "has-condition", condition: "open-leg-fracture" } });
  const dirtyWater = outcomes.find(outcome => outcome.id === "dirty-water-illness");
  dirtyWater.text = "You develop dysentery after drinking the stored water. Diarrhoea and dehydration stop you working, and you need care.";
  dirtyWater.effects.push({ type: "condition", condition: "dysentery" });
  const dirtyWaterEvent = world.events.find(event => event.choices.some(choice => choice.outcomes.includes(dirtyWater)));
  dirtyWaterEvent.when = all(dirtyWaterEvent.when, { type: "not", condition: { type: "has-condition", condition: "dysentery" } });

  world.relationships = {
    description: "Each introduced partner and born child has an individual closeness score. Contact can improve it, conflict can reduce it and prolonged neglect slowly erodes it. Close household members can help with recovery. These values and their effects are authored gameplay, not historical relationship measurements.",
    initialCloseness: 50, childCloseness: 65, decayAfterYears: 3, yearlyDecay: 2,
    marriageMinimum: 40, supportThreshold: 60, maxHealthSupport: 1,
  };
  const activities = world.character.activities;
  for (const partner of world.character.partners) {
    const court = activities.find(activity => activity.id === `court-${partner.id}`);
    for (const outcome of court.outcomes) {
      const accepted = outcome.effects.some(effect => effect.type === "relationship" && effect.status === "courting");
      outcome.effects.push(closeness(accepted ? 5 : -3, partner.id));
    }
    activities.find(activity => activity.id === `marry-${partner.id}`).outcomes[0].effects.push(closeness(5, partner.id));
    activities.find(activity => activity.id === `time-with-${partner.id}`).outcomes[0].effects.push(closeness(6, partner.id));
    activities.push({
      ...one(`talk-with-${partner.id}`, `Spend time talking with ${partner.name}`, `You and ${partner.name} share a meal and talk about work and home. You learn a little more about each other.`,
        [cash(-10), closeness(6, partner.id), stat("bonds", 1)], all({ type: "known-partner", partner: partner.id }, cashAtLeast(10))),
      category: "relationship", minAge: 18, cooldownYears: 1,
    });
  }
  for (const id of ["care-for-children", "support-child-learning"]) {
    activities.find(activity => activity.id === id).outcomes[0].effects.push({ type: "closeness", target: "children", delta: 4 });
  }
  world.events.push({
    id: "relationship-strain", title: "Time to talk",
    text: "You and your spouse argue over work, time and household responsibilities. You need to decide what to do.",
    trigger: { type: "random", weight: 2 },
    when: all({ type: "relationship", status: "married" }, { type: "closeness", op: "lte", value: 35 }),
    maxOccurrences: 20, cooldownYears: 5, evidence: "fictional", sourceIds: ["alexandrian-marriage", "family-care"],
    choices: [
      one("repair-relationship", "Listen and arrange a meal together", "You discuss what has been difficult and agree on a few changes at home.", [cash(-10), closeness(8), stat("bonds", 3)], cashAtLeast(10)),
      one("make-time-for-partner", "Set aside time to talk", "You put other tasks aside and talk through the household responsibilities together.", [closeness(5), stat("bonds", 2)]),
      one("discuss-separation", "Agree to end the marriage", "You agree to separate and divide the household belongings. Your children and their other-parent records remain.", [{ type: "divorce" }, stat("bonds", -5)]),
    ],
  });

  world.endings.push({
    id: "end-of-record", title: "Record complete", kind: "chapter",
    text: "The record stops at age 100. This is the end of the simulation record, not a recorded death.",
    evidence: "fictional", sourceIds: [],
  });
  world.defaultEnding = "end-of-record";
  return world;
}
