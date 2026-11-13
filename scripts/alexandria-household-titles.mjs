// Local household distinctions are authored fiction, earned through recorded
// service. They confer neither a historical office nor a claim to Egypt's throne.
const all = (...conditions) => ({ type: "all", conditions });
const earned = (achievement, minYears = 0) => ({ type: "accomplishment", achievement, ...(minYears ? { minYears } : {}) });
const gain = (skill, delta) => ({ type: "skill", skill, delta });
const stageIds = ["first-service", "tested-project", "completed-duty", "title"];

export const householdTitlePlans = [
  {
    id: "royal-diplomacy", audience: "royal", title: "Ambassador of the House", age: 28,
    description: "Represent the household through an agreed message, a difficult negotiation and a later review of the settlement.",
    flags: ["royal-envoys-sent"], skills: ["oratory", "literacy"], people: ["Damon", "Philista"], costs: [15, 35, 45, 25],
    gates: [{ influence: 50, stability: 40 }, { influence: 60, stability: 50 }, { influence: 70, stability: 55 }, { influence: 75, stability: 60, security: 45 }],
    steps: [
      ["An agreed household message", "Deliver an agreed household message", "You compare the instructions with the household's earlier correspondence, deliver the agreed message and return with the receiver's acknowledgement."],
      ["A disputed agreement negotiated", "Negotiate the disputed household agreement", "You hear both accounts, record the limits of the household's promise and obtain an agreement acknowledged by both parties."],
      ["A diplomatic settlement upheld", "Review the settlement after its first seasons", "You return to the parties after the agreement has been used. You resolve a disputed clause and obtain confirmation that the settlement remains workable."],
    ],
  },
  {
    id: "royal-guardianship", audience: "royal", title: "Guardian of the House", age: 30,
    description: "Turn a guard inspection into a tested supply plan and a completed escort duty with an accountable review.",
    flags: ["royal-guard-reviewed"], skills: ["warfare", "reckoning"], people: ["Menon", "Damon"], costs: [20, 50, 65, 30],
    gates: [{ security: 55, stability: 40 }, { security: 65, influence: 40 }, { security: 70, stability: 55 }, { security: 80, stability: 65, influence: 50 }],
    steps: [
      ["The household guard's stores checked", "Check the guard's duty roster and stores", "You check the roster against the actual guard and stores, correct a shortage and submit a bounded protection plan."],
      ["A protection plan tested", "Run a supervised guard and supply exercise", "You test the roster, supply checks and reporting chain in a supervised exercise. The officers accept the corrected protection plan."],
      ["A household escort safely completed", "Oversee an escort and review its return", "You oversee a household escort within its agreed limits, reconcile the returned stores and answer the officers' review of the completed duty."],
    ],
  },
  {
    id: "royal-stewardship", audience: "royal", title: "Unifier of the House", age: 32,
    description: "Build a family agreement, settle competing claims and show that the succession arrangement can endure.",
    flags: ["royal-council-held", "royal-succession-planned"], skills: ["literacy", "oratory"], people: ["Philista", "Thais"], costs: [15, 30, 40, 25],
    gates: [{ succession: 35, stability: 50 }, { succession: 50, stability: 55 }, { succession: 65, stability: 65, influence: 50 }, { succession: 80, stability: 75, influence: 60 }],
    steps: [
      ["A family council's terms recorded", "Record the family council's agreed terms", "You compare the succession plan with the council's promises. Relatives acknowledge the written limits of their responsibilities."],
      ["Competing family claims reconciled", "Mediate the competing family claims", "You hear the competing claims separately, bring the records to a joint hearing and obtain an acknowledged allocation of responsibilities."],
      ["The family agreement sustained", "Review the agreement after later family councils", "You return to the agreement after later councils, correct an unresolved obligation and obtain renewed commitments from the family representatives."],
    ],
  },
  {
    id: "estate-restoration", audience: "aristocrat", title: "Restorer of the Estate", age: 28,
    description: "Repair estate infrastructure, complete a larger improvement and verify its benefits with the people using it.",
    flags: ["estate-improvement-funded"], skills: ["reckoning", "literacy"], people: ["Hori", "Philista"], costs: [20, 60, 70, 25],
    gates: [{ prosperity: 60, loyalty: 40 }, { prosperity: 70, loyalty: 50 }, { prosperity: 75, standing: 45 }, { prosperity: 80, loyalty: 65, standing: 50 }],
    steps: [
      ["Estate repairs surveyed and checked", "Survey the funded repairs with the stewards", "You compare the funded work with the channels and stores, check the quantities and record what remains to be repaired."],
      ["A major estate improvement completed", "Complete the next irrigation and storage project", "You agree a bounded improvement with stewards and tenant representatives, fund its materials and inspect the completed work before accepting it."],
      ["Restoration benefits verified", "Review the improvements after later harvests", "You compare later delivery records with the repaired stores and channels. Tenant representatives confirm the repairs are usable and the upkeep is agreed."],
    ],
  },
  {
    id: "estate-patronage", audience: "aristocrat", title: "Trusted Patron", age: 28,
    description: "Make patronage accountable through a shared hearing, a funded undertaking and a review of who benefited.",
    flags: ["estate-tenants-heard", "estate-gathering-sponsored"], skills: ["oratory", "philosophy"], people: ["Thais", "Hori"], costs: [20, 35, 40, 25],
    gates: [{ loyalty: 60, standing: 45 }, { loyalty: 65, standing: 55 }, { loyalty: 70, standing: 60, prosperity: 50 }, { loyalty: 80, standing: 75, prosperity: 55 }],
    steps: [
      ["A shared patronage hearing completed", "Hear the gathering's accounts and local requests", "You bring the gathering's accounts to an open hearing, listen to tenant requests and record a limited commitment the estate can meet."],
      ["A local undertaking supported", "Fund and oversee the agreed local undertaking", "You agree the beneficiaries and costs before funding the undertaking. Local representatives acknowledge the completed contribution and its limits."],
      ["Patronage obligations honoured", "Review the undertaking and honour its remaining duties", "You hear from the people who used the undertaking, correct an unmet promise and show that support was delivered without adding a hidden tenant obligation."],
    ],
  },
  {
    id: "estate-inheritance", audience: "aristocrat", title: "Keeper of the Family Lands", age: 35,
    description: "Check the family lands, reconcile inheritance claims and preserve an accepted plan through later reviews.",
    flags: ["estate-inheritance-recorded"], skills: ["literacy", "reckoning"], people: ["Damon", "Hori"], costs: [15, 30, 45, 25],
    gates: [{ inheritance: 35, loyalty: 50 }, { inheritance: 50, standing: 45 }, { inheritance: 65, loyalty: 60, prosperity: 50 }, { inheritance: 80, loyalty: 70, prosperity: 60 }],
    steps: [
      ["The family lands and duties inventoried", "Check the inheritance record against the family lands", "You compare the written plan with field boundaries, stores and tenant agreements. Family representatives acknowledge the checked inventory."],
      ["Inheritance claims reconciled", "Reconcile the family's competing inheritance claims", "You hear competing claims against the checked inventory, record the agreed responsibilities and obtain the representatives' acknowledgements."],
      ["A lasting inheritance agreement reviewed", "Review the inheritance plan with the next generation", "You review the plan with younger relatives and tenant representatives. The family confirms the agreed boundaries and duties after correcting an unresolved claim."],
    ],
  },
];

export function applyHouseholdTitles(world) {
  const serviceFlags = [
    ["royal-send-envoys", "royal-envoys-sent", "Sent household envoys", [gain("oratory", 1), gain("literacy", 1)]],
    ["royal-inspect-guard", "royal-guard-reviewed", "Reviewed the household guard", [gain("warfare", 2), gain("reckoning", 1)]],
    ["royal-hold-council", "royal-council-held", "Held a household council", [gain("oratory", 1), gain("literacy", 1)]],
    ["royal-plan-succession", "royal-succession-planned", "Recorded the household's succession plan", [gain("literacy", 1), gain("reckoning", 1)]],
    ["aristocrat-improve-irrigation", "estate-improvement-funded", "Funded estate improvements", [gain("reckoning", 2)]],
    ["aristocrat-settle-tenancy", "estate-tenants-heard", "Heard and settled tenant claims", [gain("oratory", 1)]],
    ["aristocrat-sponsor-festival", "estate-gathering-sponsored", "Sponsored a local gathering", [gain("oratory", 1)]],
    ["aristocrat-plan-inheritance", "estate-inheritance-recorded", "Recorded the estate inheritance plan", [gain("literacy", 2)]],
  ];
  for (const [id, flag, label, skills] of serviceFlags) {
    world.flags[flag] = { label, initial: false };
    const activity = world.character.activities.find(item => item.id === id);
    if (!activity) throw new Error(`Household title service is missing: ${id}`);
    for (const outcome of activity.outcomes) outcome.effects.push({ type: "flag", flag, value: true }, ...skills);
  }
  world.character.activities.find(item => item.id === "royal-study-statecraft").outcomes[0].effects.push(gain("reckoning", 2));
  world.character.activities.find(item => item.id === "aristocrat-study-estates").outcomes[0].effects.push(gain("oratory", 1));
  world.character.activities.find(item => item.id === "aristocrat-host-patrons").outcomes[0].effects.push(gain("philosophy", 1), gain("oratory", 1));

  for (const plan of householdTitlePlans) {
    const metric = (id, delta) => ({ type: plan.audience, metric: id, delta });
    const threshold = (id, value) => ({ type: plan.audience, metric: id, op: "gte", value });
    const ids = stageIds.map(stage => `${plan.id}-${stage}`);
    world.legacy.routes.push({
      id: plan.id, title: plan.title, description: `${plan.description} Earned recognition adds 5 drachmas to the household treasury each year.`,
      skillIds: plan.skills, jobIds: [], achievementIds: ids,
      stages: ids.slice(1).map((id, index) => ({ title: index === 2 ? plan.title : plan.steps[index + 1][0], achievementIds: [id] })),
    });
    ids.forEach((achievement, index) => {
      const final = index === 3;
      const title = final ? plan.title : plan.steps[index][0];
      world.legacy.achievements.push({
        id: achievement, routeId: plan.id, title,
        description: final ? `${plan.description} The local household distinction adds 5 drachmas to the household treasury each year.` : plan.steps[index][2],
        kind: final ? "ultimate" : "ordinary", nameTemplate: final ? `{name}, ${plan.title}` : `{name}'s ${title}`,
        people: plan.people, evidence: "fictional", sourceIds: [],
      });
      const cost = plan.costs[index], main = Object.keys(plan.gates[index])[0];
      const prerequisites = index ? [earned(ids[index - 1], index === 1 ? 1 : 2)] : plan.flags.map(flag => ({ type: "flag", flag, value: true }));
      const requirements = all(
        { type: "age", op: "gte", value: final ? plan.age : [18, 20, 23][index] },
        ...prerequisites, { type: "not", condition: earned(achievement) },
        ...Object.entries(plan.gates[index]).map(([id, value]) => threshold(id, value)), threshold("treasury", cost),
      );
      const effects = [metric("treasury", -cost), metric(main, final ? 3 : 4), gain(plan.skills[0], final ? 2 : 3), gain(plan.skills[1], 2),
        ...(final ? [{ type: "stat", stat: "bonds", delta: 2 }] : []), { type: "accomplishment", achievement }];
      const expense = ` The ${plan.audience === "royal" ? "household" : "estate"} treasury pays ${cost} drachmas.`;
      const success = {
        id: `household-title-${achievement}-accepted`, weight: index === 1 ? 3 : index === 2 ? 4 : 1,
        text: final ? `${plan.people.join(" and ")} review your three completed duties and recognize {name} as ${plan.title}. This household distinction adds 5 drachmas to the treasury each year.${expense}` : `${plan.steps[index][2]} ${plan.people.join(" and ")} accept the completed duty under your name.${expense}`,
        effects,
      };
      const uncertain = index === 1 || index === 2;
      if (uncertain) success.weightModifiers = [{ when: threshold(main, Math.min(95, plan.gates[index][main] + 15)), multiplier: 1.5, reason: "Stronger household conditions support the undertaking" }];
      world.character.activities.push({
        id: `household-title-${achievement}`, text: final ? `Present the completed record for ${plan.title}` : plan.steps[index][1],
        audience: plan.audience, category: "career", minAge: final ? plan.age : [18, 20, 23][index], cooldownYears: uncertain ? 2 : 1, when: requirements,
        ...(uncertain ? { opportunity: { label: title, outcomeIds: [success.id] } } : {}),
        outcomes: [success, ...(uncertain ? [{
          id: `household-title-${achievement}-unfinished`, weight: 1,
          text: `The review finds an unresolved obligation. The project remains incomplete and earns no duty card. You can prepare a corrected undertaking after two years.${expense}`,
          effects: [metric("treasury", -cost), metric(main, -4)],
        }] : [])],
      });
    });
    world.yearlyRules.push({ id: `${plan.id}-recognized-service`, audience: plan.audience, when: earned(ids[3]), effects: [metric("treasury", 5)] });
  }
  return world;
}
