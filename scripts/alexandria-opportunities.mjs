// Fictional career openings in historically supported settings. All thresholds,
// weights and origin modifiers are authored game balance, not ancient rates.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const not = condition => ({ type: "not", condition });
const age = value => ({ type: "age", op: "gte", value });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const attribute = (stat, value) => ({ type: "stat", stat, op: "gte", value });
const job = job => ({ type: "job", job });
const origin = origin => ({ type: "origin", origin });
const flag = flag => ({ type: "flag", flag, value: true });
const fact = flag => ({ type: "flag", flag, value: true });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const cash = delta => ({ type: "cash", delta });
const royalEra = { type: "year", op: "lt", value: -30 };
const accountsOrigin = any(origin("clerk-household"), origin("merchant-household"));
const workshopOrigin = any(origin("artisan-household"), origin("weaver-household"));
const writingJob = any(job("clerk"), job("copyist"), job("philosophy-tutor"), job("patron-supported-reader"));
const armyJob = any(job("soldier"), job("officer"), job("general"));
const modifier = (when, multiplier, reason) => ({ when, multiplier, reason });
const illnessPenalty = modifier({ type: "has-condition" }, .75, "Illness or injury makes the extra work harder");

function addFactToActivity(world, id, factId) {
  const activity = world.character.activities.find(item => item.id === id);
  if (!activity) throw new Error(`Missing activity for career experience: ${id}`);
  for (const outcome of activity.outcomes) outcome.effects.push(fact(factId));
}

export function applyCareerOpportunities(world) {
  world.version = "0.19.0";
  for (const [id, label] of Object.entries({
    "court-recommendation": "A clerk has recommended your petition work",
    "officer-recommendation": "An officer has recommended your supply work",
    "scholar-recommendation": "A patron has offered you paid scholarly work",
    "workshop-recommendation": "A customer has recommended your workshop work",
    "petition-presented": "Presented a district petition",
    "sky-table-commission": "Completed a paid sky-table copy",
    "workshop-commission": "Completed a paid craft order",
  })) world.flags[id] = { label, initial: false };
  addFactToActivity(world, "present-a-district-petition", "petition-presented");
  addFactToActivity(world, "copy-a-sky-table", "sky-table-commission");
  for (const id of ["small-pottery-order", "small-carving-order", "small-figure-order", "decorate-pottery-order", "carve-door-fitting", "finish-sculpture-commission"]) {
    addFactToActivity(world, id, "workshop-commission");
  }

  const routes = [
    {
      id: "prepare-official-petition", eventId: "career-petition-opening", title: "A petition needs a writer",
      text: "A local clerk needs help checking names and explaining a petition. Good work could earn a recommendation for service with royal officials.",
      action: "Help prepare the petition", flag: "court-recommendation", label: "Earn a court recommendation", minAge: 16,
      when: all(royalEra, trained("literacy", 15), not(flag("court-recommendation"))), weight: 20,
      success: "You check the names, rewrite the request and answer the clerk's questions. The clerk agrees to recommend you. You still need the skills and age required for a court appointment.",
      failure: "The clerk corrects several passages and files the petition. No recommendation follows. You are paid for the copying.",
      effects: [cash(10), skill("literacy", 1), skill("oratory", 1)],
      modifiers: [modifier(accountsOrigin, 1.35, "Your household knows written accounts"), modifier(trained("literacy", 30), 1.5, "Practised writing"), modifier(trained("oratory", 25), 1.5, "Experience explaining requests"), modifier(writingJob, 1.5, "Your current work uses written records"), modifier(flag("petition-presented"), 2, "You have presented a district petition"), illnessPenalty],
      sources: ["strabo-alexandria", "plutarch-antony-areius", "augustan-alexandria-documents"],
    },
    {
      id: "organise-unit-supplies", eventId: "career-unit-supply-opening", title: "The unit's supply lists",
      text: "Your unit's equipment and supply lists need checking. You can offer to sort the records and explain the shortages to an officer.",
      action: "Take charge of the supply lists", flag: "officer-recommendation", label: "Earn an officer's recommendation", minAge: 18,
      when: all(royalEra, armyJob, trained("warfare", 15), not(flag("officer-recommendation"))), weight: 25,
      success: "The records match the stores, and your officer accepts the revised list. They agree to recommend you for more responsibility. This helps future applications; it does not change your rank.",
      failure: "You find missing entries, but another soldier has to help finish the count. You return to ordinary duties with more practice.",
      effects: [skill("reckoning", 1), skill("warfare", 1)],
      modifiers: [modifier(accountsOrigin, 1.2, "Household experience with lists and accounts"), modifier(trained("reckoning", 20), 1.6, "You can check supply totals"), modifier(trained("warfare", 35), 1.5, "You understand the unit's equipment"), modifier(trained("oratory", 20), 1.3, "You can explain the shortages"), modifier(flag("joined-alexandrian-war"), 1.5, "You have wartime supply experience"), illnessPenalty],
      sources: ["alexandrian-war"],
    },
    {
      id: "show-sky-calculations", eventId: "career-reader-opening", title: "A reader checks your calculations",
      text: "An experienced reader is checking copied sky tables for a paying household. You can show your own work and ask to help with the next set.",
      action: "Show your copied tables and calculations", flag: "scholar-recommendation", label: "Receive a scholarly work offer", minAge: 16,
      when: all(trained("literacy", 20), trained("reckoning", 15), trained("astronomy", 15), not(flag("scholar-recommendation"))), weight: 25,
      success: "The reader checks your arithmetic and offers to recommend you to the paying household. A regular post is open once you meet its skill requirements. You keep your current work until you accept it.",
      failure: "The reader points out a copied position and a calculation to correct. There is no work offer, but you leave with useful corrections.",
      effects: [skill("astronomy", 1), skill("reckoning", 1), stat("knowledge", 1)],
      modifiers: [modifier(accountsOrigin, 1.3, "Household experience with writing and accounts"), modifier(trained("astronomy", 30), 1.8, "You have practised sky-table work"), modifier(trained("reckoning", 30), 1.5, "Your arithmetic is well practised"), modifier(writingJob, 1.4, "Your current work involves written records"), modifier(flag("sky-table-commission"), 2, "You have completed a paid sky-table copy"), illnessPenalty],
      sources: ["strabo-alexandria", "louvre-dendera-zodiac"],
    },
    {
      id: "show-workshop-sample", eventId: "career-workshop-opening", title: "An order for a larger household",
      text: "A customer is looking for someone who can finish a larger workshop order and organise the smaller tasks. You can show a sample of your pottery, carving or sculpture.",
      action: "Show a finished piece and explain the work", flag: "workshop-recommendation", label: "Earn a workshop recommendation", minAge: 16,
      when: all(trained("craft", 15), any(trained("pottery", 20), trained("carving", 20), trained("sculpture", 25)), not(flag("workshop-recommendation"))), weight: 25,
      success: "The customer accepts your sample and recommends you to a workshop owner. You can apply to lead work in your trained trade once you meet the requirements. You keep your current job for now.",
      failure: "The customer asks for a different finish and places the larger order elsewhere. You correct the sample and sell it as an ordinary piece.",
      effects: [cash(10), skill("craft", 1)],
      modifiers: [modifier(workshopOrigin, 1.35, "Your household has workshop contacts"), modifier(any(trained("pottery", 40), trained("carving", 40), trained("sculpture", 40)), 1.8, "You have an experienced specialism"), modifier(any(job("potter"), job("ceramic-decorator"), job("wood-carver"), job("sculptor")), 1.5, "You already work in a skilled workshop"), modifier(flag("workshop-commission"), 2, "You have completed a paid craft order"), modifier(trained("reckoning", 20), 1.3, "You can explain quantities and costs"), illnessPenalty],
      sources: ["alexandrian-terracottas", "met-wood-carving", "education-apprenticeship"],
    },
  ];
  for (const route of routes) {
    const successId = `${route.id}-recommended`;
    const opportunity = {
      id: route.id, text: route.action, when: route.when,
      opportunity: { label: route.label, outcomeIds: [successId] },
      outcomes: [
        { id: successId, text: route.success, weight: route.weight, weightModifiers: route.modifiers, effects: [fact(route.flag), ...structuredClone(route.effects)] },
        { id: `${route.id}-not-selected`, text: route.failure, weight: 100 - route.weight, effects: structuredClone(route.effects) },
      ],
    };
    world.character.activities.push({ ...structuredClone(opportunity), category: "career", minAge: route.minAge, cooldownYears: 3 });
    world.events.push({
      id: route.eventId, title: route.title, text: route.text,
      trigger: { type: "random", weight: 2 }, when: all(age(route.minAge), route.when), maxOccurrences: 4, cooldownYears: 5,
      evidence: "historically-inspired", sourceIds: route.sources,
      choices: [structuredClone(opportunity), {
        id: `${route.id}-decline`, text: "Keep to your usual work",
        outcomes: [{ id: `${route.id}-declined`, text: "You leave the extra task to someone else and keep to your usual work.", weight: 1, effects: [] }],
      }],
    });
  }

  const civilianJobs = [
    { id: "patron-supported-reader", title: "Patron-supported reader", minAge: 18, requirements: { literacy: 35, reckoning: 25, astronomy: 30 },
      description: "Check copied sky tables and prepare notes for a household that pays for your work.",
      yearlyEffects: [cash(30), stat("knowledge", 1), skill("astronomy", 1), skill("literacy", 1)], flag: "scholar-recommendation" },
    ...[
      ["pottery-workshop-lead", "Pottery workshop lead", "pottery", "Organise kiln loads, check finished pots and divide tasks for larger orders."],
      ["carving-workshop-lead", "Wood-carving workshop lead", "carving", "Measure larger orders, divide bench work and check finished wooden fittings."],
      ["sculpture-workshop-lead", "Sculpture workshop lead", "sculpture", "Plan small figure and relief orders, organise preparation and check the carving."],
    ].map(([id, title, specialism, description]) => ({ id, title, description, minAge: 20,
      requirements: { craft: 30, reckoning: 15, [specialism]: 40 },
      yearlyEffects: [cash(40), skill(specialism, 1), skill("reckoning", 1), stat("health", -1)], flag: "workshop-recommendation" })),
  ];
  for (const { flag: opening, ...definition } of civilianJobs) {
    world.character.jobs.push(definition);
    world.character.activities.push({
      id: `work-${definition.id}`, text: `Take the ${definition.title.toLowerCase()} post`, category: "career", minAge: definition.minAge, cooldownYears: 1,
      when: all(flag(opening), not(job(definition.id)), ...Object.entries(definition.requirements).map(([id, minimum]) => trained(id, minimum))),
      outcomes: [{ id: `work-${definition.id}-accepted`, text: `You accept regular work as a ${definition.title.toLowerCase()}. You leave your previous job and agree on the tasks and payment.`, weight: 1,
        effects: [job(definition.id), { type: "flag", flag: "retired", value: false }] }],
    });
  }

  const appointments = {
    "seek-officer-commission": { text: "Apply for an officer's post", success: "officer-appointed", label: "Receive an officer's commission", modifiers: [
      modifier(flag("officer-recommendation"), 2, "An officer has recommended your work"), modifier(trained("warfare", 50), 1.5, "Experienced military training"), modifier(trained("oratory", 30), 1.3, "Practised leadership speeches"), modifier(trained("reckoning", 25), 1.2, "You can keep unit accounts"), modifier(flag("joined-alexandrian-war"), 1.25, "Wartime service"), illnessPenalty,
    ] },
    "seek-general-command": { text: "Seek an army command", success: "general-appointed", label: "Receive a senior command", modifiers: [
      modifier(flag("officer-recommendation"), 2, "Your supply work has an officer's backing"), modifier(trained("warfare", 70), 1.5, "Advanced military experience"), modifier(trained("oratory", 45), 1.5, "Experienced public speaking"), modifier(flag("joined-alexandrian-war"), 1.5, "Wartime service"), illnessPenalty,
    ] },
    "seek-court-appointment": { text: "Seek a court appointment", success: "court-appointed", label: "Receive a court appointment", modifiers: [
      modifier(accountsOrigin, 1.35, "Your household knows written accounts"), modifier(flag("court-recommendation"), 3, "A clerk has recommended your petition work"), modifier(writingJob, 1.5, "You currently work with written records"), modifier(trained("literacy", 50), 1.5, "Experienced writing"), modifier(trained("oratory", 45), 1.5, "Experienced public speaking"), modifier(attribute("bonds", 60), 1.25, "Strong local contacts"), illnessPenalty,
    ] },
    "propose-royal-grain-order": { text: "Propose a grain-delivery change", success: "grain-proposal-adopted", label: "Have the delivery proposal adopted", modifiers: [
      modifier(trained("reckoning", 35), 1.5, "You can check delivery totals"), modifier(trained("oratory", 60), 1.5, "You can explain the proposal clearly"), modifier(flag("petition-presented"), 1.5, "Experience presenting district needs"), illnessPenalty,
    ] },
  };
  for (const [id, config] of Object.entries(appointments)) {
    const activity = world.character.activities.find(item => item.id === id);
    if (!activity) throw new Error(`Missing appointment: ${id}`);
    activity.text = config.text;
    activity.opportunity = { label: config.label, outcomeIds: [config.success] };
    const success = activity.outcomes.find(outcome => outcome.id === config.success);
    if (!success) throw new Error(`Missing appointment success: ${config.success}`);
    success.weightModifiers = config.modifiers;
  }
  return world;
}
