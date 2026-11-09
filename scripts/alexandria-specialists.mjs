// Specialist careers and rare appointments are authored gameplay, not measured
// ancient promotion rates. This extension uses only the shared world-pack rules.
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const fact = (flag, value = true) => ({ type: "flag", flag, value });
const job = job => ({ type: "job", job });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const flag = (flag, value = true) => ({ type: "flag", flag, value });
const age = (op, value) => ({ type: "age", op, value });
const year = (op, value) => ({ type: "year", op, value });
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const not = condition => ({ type: "not", condition });
const resources = value => ({ type: "stat", stat: "wealth", op: "gte", value });
const royalEra = year("lt", -30);
const armyJob = any(job("soldier"), job("officer"), job("general"));
const warYears = any(year("eq", -48), year("eq", -47));
const result = (id, text, effects = [], weight = 1) => ({ id, text, effects, weight });
const choice = (id, text, outcomes, when) => ({ id, text, outcomes, ...(when ? { when } : {}) });
const simple = (id, text, outcome, effects, when) => choice(id, text, [result(`${id}-result`, outcome, effects)], when);
const activity = (id, text, category, minAge, outcome, effects, when, cooldownYears = 1) => ({
  ...simple(id, text, outcome, effects, when), category, minAge, cooldownYears,
});
const automatic = (id, title, text, when, effects, sourceIds, trigger = { type: "random", weight: 1 }) => ({
  id, title, text, when, effects, sourceIds, trigger, evidence: "historically-inspired",
  mode: "automatic", choices: [], ...(trigger.type === "random" ? { maxOccurrences: 15, cooldownYears: 4 } : {}),
});
const decision = (id, title, text, when, choices, sourceIds, trigger = { type: "random", weight: 1 }) => ({
  id, title, text, when, choices, sourceIds, trigger, evidence: "historically-inspired",
  ...(trigger.type === "random" ? { maxOccurrences: 5, cooldownYears: 8 } : {}),
});

export const SPECIALIST_SKILLS = {
  pottery: "Pottery", carving: "Carving", sculpture: "Sculpture", philosophy: "Philosophy",
  astronomy: "Astronomy", astrology: "Astrology", warfare: "Warfare", oratory: "Oratory",
};

export function applySpecialists(world) {
  if (!world.character || world.character.skills.pottery) return world;
  for (const [id, label] of Object.entries(SPECIALIST_SKILLS)) world.character.skills[id] = { label, min: 0, max: 100, initial: 0 };
  for (const [id, label] of Object.entries({
    "army-service": "Has served in the royal army", "officer-commission": "Received an officer's commission",
    "general-appointed": "Received an army command", "court-appointed": "Received a royal court appointment",
    "grain-policy-adopted": "A grain-delivery proposal was adopted", "district-grain-delivered": "The new grain order was carried out",
    "protected-granary": "Assigned troops to protect grain stores", "escorted-supplies": "Assigned troops to escort supplies",
    "royal-service-ended": "Royal service ended under Roman rule", "joined-alexandrian-war": "Took part in the Alexandrian War",
  })) world.flags[id] = { label, initial: false };

  const jobs = [
    { id: "ceramic-decorator", title: "Ceramic decorator", description: "Finish and decorate pots and mould-made figures in a workshop.", minAge: 16, requirements: { craft: 15, pottery: 20 }, yearlyEffects: [stat("wealth", 3), skill("pottery", 2), skill("craft", 1), stat("health", -1)] },
    { id: "wood-carver", title: "Wood carver", description: "Carve small figures, fittings and patterns in wood.", minAge: 16, requirements: { craft: 15, carving: 20 }, yearlyEffects: [stat("wealth", 3), skill("carving", 2), stat("health", -1)] },
    { id: "sculptor", title: "Sculptor", description: "Make small figures and carved reliefs for customers. Larger commissions need more experience.", minAge: 18, requirements: { carving: 15, sculpture: 25 }, yearlyEffects: [stat("wealth", 3), skill("sculpture", 2), skill("carving", 1), stat("health", -1)] },
    { id: "philosophy-tutor", title: "Philosophy tutor", description: "Teach small groups, read arguments and help pupils explain their reasoning.", minAge: 22, requirements: { literacy: 20, philosophy: 30, oratory: 15 }, yearlyEffects: [stat("wealth", 2), stat("knowledge", 1), skill("philosophy", 2), skill("oratory", 1)] },
    { id: "sky-table-calculator", title: "Sky-table calculator", description: "Copy observation tables and check calendar calculations. Access to texts depends on personal contacts.", minAge: 22, requirements: { literacy: 25, reckoning: 25, astronomy: 30 }, yearlyEffects: [stat("wealth", 2), stat("knowledge", 2), skill("astronomy", 2), skill("reckoning", 1)] },
    { id: "astrologer", title: "Astrologer", description: "Prepare charts and explain traditional interpretations. These are historical beliefs, not reliable predictions.", minAge: 22, requirements: { literacy: 25, reckoning: 20, astrology: 30 }, yearlyEffects: [stat("wealth", 2), skill("astrology", 2), skill("astronomy", 1)] },
    { id: "soldier", title: "Royal army soldier", description: "Drill, guard stores and carry out orders in the Ptolemaic army. Service is available before Roman rule.", minAge: 18, requirements: { warfare: 10 }, yearlyEffects: [stat("wealth", 2), skill("warfare", 3), stat("health", -1), stat("bonds", -1)] },
    { id: "officer", title: "Royal army officer", description: "Organise a small unit and keep its equipment and supply records. A commission requires a separate appointment.", minAge: 22, requirements: { warfare: 35, oratory: 15 }, yearlyEffects: [stat("wealth", 3), skill("warfare", 3), skill("oratory", 1), stat("health", -1)] },
    { id: "general", title: "Royal army general", description: "Hold a senior field command. This is an exceptional appointment; training alone does not secure it.", minAge: 28, requirements: { warfare: 60, oratory: 30 }, yearlyEffects: [stat("wealth", 4), skill("warfare", 1), skill("oratory", 1), stat("bonds", 1)] },
    { id: "court-adviser", title: "Royal court adviser", description: "Prepare petitions and proposals for royal officials. Appointment depends on rare patronage, not just qualifications.", minAge: 24, requirements: { literacy: 35, philosophy: 25, oratory: 35 }, yearlyEffects: [stat("wealth", 3), stat("knowledge", 1), skill("oratory", 2), skill("philosophy", 1)] },
  ];
  world.character.jobs.push(...jobs);
  // Pottery is a specialism alongside general Craft, not a retroactive new gate
  // on the previously available beginner potter trade.
  world.character.jobs.find(item => item.id === "potter")?.yearlyEffects.push(skill("pottery", 2));

  const training = [
    ["pottery", "Practise shaping and firing clay", 10, "You shape a few small vessels, dry them and help check a kiln load.", [skill("pottery", 8), skill("craft", 3), stat("knowledge", 1), stat("wealth", -1)], undefined],
    ["carving", "Practise carving a wooden fitting", 10, "You mark a pattern and carve it slowly. A worker helps you correct the uneven parts.", [skill("carving", 8), skill("craft", 2), stat("health", -1), stat("wealth", -1)], undefined],
    ["sculpture", "Model a figure and practise a relief", 14, "You model a small figure and practise cutting a shallow relief in spare material.", [skill("sculpture", 8), skill("carving", 2), stat("health", -1), stat("wealth", -2)], trained("craft", 10)],
    ["philosophy", "Study an argument with a teacher", 14, "You listen to an argument, ask questions and try to explain the reply in your own words.", [skill("philosophy", 8), stat("knowledge", 2), stat("wealth", -1)], undefined],
    ["astronomy", "Record the Moon and compare sky tables", 14, "You record a position of the Moon and compare the entry with a copied table. You stay up late to finish.", [skill("astronomy", 8), skill("reckoning", 2), stat("knowledge", 2), stat("health", -1), stat("wealth", -1)], undefined],
    ["astrology", "Compare zodiac signs and traditional readings", 16, "You copy a sky diagram and compare several traditional interpretations. The exercise does not establish that the predictions work.", [skill("astrology", 8), stat("knowledge", 1), stat("wealth", -1)], all(trained("astronomy", 10), trained("reckoning", 10))],
    ["warfare", "Learn drill and equipment handling", 14, "You practise formation changes and equipment care under supervision. Your arms ache afterward.", [skill("warfare", 8), stat("health", -1), stat("wealth", -1)], royalEra],
    ["oratory", "Practise making a short speech", 14, "You prepare a short speech, deliver it to a small group and answer their questions.", [skill("oratory", 8), stat("knowledge", 1), stat("bonds", 1), stat("wealth", -1)], undefined],
  ];
  const additions = training.map(([id, text, minAge, outcome, effects, when]) => activity(`train-${id}`, text, "training", minAge, outcome, effects,
    all(resources(id === "sculpture" ? 2 : 1), { type: "skill", skill: id, op: "lt", value: 100 }, ...(when ? [when] : []))));
  for (const definition of jobs.slice(0, 6)) additions.push(activity(`work-${definition.id}`, `Become a ${definition.title.toLowerCase()}`, "career", definition.minAge,
    `You arrange work as a ${definition.title.toLowerCase()} and buy a few supplies.`, [job(definition.id), fact("retired", false), stat("wealth", -1)],
    all(not(job(definition.id)), resources(1), ...Object.entries(definition.requirements).map(([id, value]) => trained(id, value)), ...(definition.id === "astrologer" ? [year("gte", -29)] : []))));
  additions.push(
    activity("enlist-royal-army", "Enlist in the royal army", "career", 18, "You enlist, receive equipment and begin guard duties and drill.", [job("soldier"), fact("army-service"), fact("retired", false), stat("wealth", 1), stat("health", -1)], all(royalEra, not(armyJob), trained("warfare", 10))),
    { ...choice("seek-officer-commission", "Apply for an officer's post (15% appointment chance)", [
      result("officer-appointed", "An officer recommends you for a vacant post. You receive a commission and take charge of a small unit.", [job("officer"), fact("officer-commission"), stat("bonds", 2)], 15),
      result("officer-refused", "No commission is offered. You return to your current duties.", [stat("wealth", -1)], 85),
    ], all(royalEra, job("soldier"), trained("warfare", 35), trained("oratory", 15))), category: "career", minAge: 22, cooldownYears: 3 },
    { ...choice("seek-general-command", "Seek an army command (2% appointment chance)", [
      result("general-appointed", "A patron backs your appointment to a senior field command. You receive written orders and a staff to organise.", [job("general"), fact("general-appointed"), stat("bonds", 4)], 2),
      result("general-refused", "The command goes to someone else. You keep your officer's post.", [stat("wealth", -2)], 98),
    ], all(royalEra, job("officer"), flag("officer-commission"), trained("warfare", 60), trained("oratory", 30))), category: "career", minAge: 28, cooldownYears: 6 },
    { ...choice("seek-court-appointment", "Seek a court appointment (3% appointment chance)", [
      result("court-appointed", "A patron recommends your petition. You receive a post preparing proposals for royal officials.", [job("court-adviser"), fact("court-appointed"), stat("bonds", 3)], 3),
      result("court-refused", "Your petition is received, but no appointment follows. You keep your present work.", [stat("wealth", -2)], 97),
    ], all(royalEra, not(job("court-adviser")), trained("literacy", 35), trained("philosophy", 25), trained("oratory", 35))), category: "career", minAge: 24, cooldownYears: 5 },
    activity("decorate-pottery-order", "Finish a decorated pottery order", "career", 18, "You finish the painted vessels, check the firing and deliver the order.", [stat("wealth", 4), skill("pottery", 3), stat("health", -1)], all(any(job("potter"), job("ceramic-decorator")), trained("pottery", 35)), 3),
    activity("carve-door-fitting", "Carve a replacement door fitting", "career", 18, "You measure the damaged fitting and carve a replacement that fits the opening.", [stat("wealth", 4), skill("carving", 3), stat("health", -1)], all(job("wood-carver"), trained("carving", 35)), 3),
    activity("finish-sculpture-commission", "Finish a small sculpture commission", "career", 20, "The customer approves the figure after you adjust its surface and repair a chipped edge.", [stat("wealth", 5), skill("sculpture", 3), stat("health", -2)], all(job("sculptor"), trained("sculpture", 45)), 4),
    activity("moderate-philosophy-discussion", "Lead a discussion of competing arguments", "career", 22, "You ask each speaker to explain their argument, then compare their reasons with the group.", [stat("wealth", 2), stat("knowledge", 3), skill("philosophy", 3), skill("oratory", 2)], all(job("philosophy-tutor"), trained("philosophy", 45), trained("oratory", 20)), 3),
    activity("check-calendar-tables", "Check a copied calendar table", "career", 22, "You find a copying error, check the arithmetic and prepare a corrected table.", [stat("wealth", 3), stat("knowledge", 2), skill("astronomy", 3), skill("reckoning", 2)], all(job("sky-table-calculator"), trained("astronomy", 40)), 3),
    activity("research-astrological-readings", "Compare conflicting astrological readings", "training", 18, "You compare two readings with the same chart. Their claims differ, and you record the disagreement rather than treating either as a proven prediction.", [skill("astrology", 4), skill("astronomy", 2), stat("knowledge", 2), stat("wealth", -1)], all(trained("astrology", 25), trained("astronomy", 20), resources(1)), 3),
    activity("drill-a-unit", "Practise drill with your unit", "training", 18, "You run through changes of formation, check equipment and repeat the parts that went wrong.", [skill("warfare", 5), skill("oratory", 2), stat("health", -1), stat("bonds", -1)], all(royalEra, armyJob), 2),
    activity("organise-war-supplies", "Help organise wartime supplies", "career", 18, "You check loads and direct carts to the right stores while other troops guard the route.", [fact("joined-alexandrian-war"), skill("warfare", 3), skill("reckoning", 2), stat("wealth", 2), stat("health", -1)], all(warYears, armyJob), 2),
    { ...choice("propose-royal-grain-order", "Propose a grain-delivery change (10% adoption chance)", [
      result("grain-proposal-adopted", "Officials accept your delivery schedule and issue an order to move grain to the district you named.", [fact("grain-policy-adopted"), stat("bonds", 6), stat("wealth", -2)], 10),
      result("grain-proposal-refused", "The officials leave the existing schedule in place. You keep your notes for another proposal.", [stat("wealth", -2), skill("oratory", 1)], 90),
    ], all(royalEra, job("court-adviser"), trained("oratory", 45), trained("philosophy", 35), not(flag("grain-policy-adopted")), resources(2))), category: "career", minAge: 25, cooldownYears: 5 },
    activity("present-a-district-petition", "Present a district petition to a clerk", "relationship", 20, "You explain a blocked access lane, present the residents' names and obtain a date for an inspection.", [stat("bonds", 3), skill("oratory", 3), stat("wealth", -1)], all(trained("oratory", 25), trained("philosophy", 15), resources(1)), 4),
  );
  world.character.activities.push(...additions);
  world.character.deathCauses.push({ id: "alexandrian-battle-wound", title: "Spear wound to the abdomen", text: "A spear strikes your abdomen while you hold the forward post. Blood loss from the wound proves fatal.", weight: 1, choiceOnly: true });

  const newEvents = [
    automatic("specialist-kiln-load", "Checking a kiln load", "You inspect a cooled kiln load. A few pieces are cracked; the rest can be finished for sale.", all(age("gte", 16), any(job("potter"), job("ceramic-decorator"))), [skill("pottery", 1)], ["alexandrian-terracottas"]),
    automatic("specialist-carved-repair", "A fitting that works", "A repaired wooden fitting holds when you test it. The customer asks you to make another.", all(age("gte", 16), trained("carving", 15)), [skill("carving", 1), stat("wealth", 1)], ["met-wood-carving"]),
    decision("specialist-sculpture-detail", "A customer changes the design", "A customer asks for another detail on a small figure. It will take extra time and material.", all(age("gte", 18), trained("sculpture", 20)), [
      simple("sculpture-extra-detail", "Agree on extra pay and add the detail", "You agree on the price, revise the figure and finish later than planned.", [stat("wealth", 3), skill("sculpture", 2), stat("health", -1)]),
      simple("sculpture-original-order", "Finish the original order", "You finish the design that was agreed and deliver it on time.", [stat("wealth", 1), skill("sculpture", 1)]),
    ], ["alexandrian-terracottas"]),
    decision("specialist-philosophy-objection", "An objection at a discussion", "Someone challenges a claim you have made. They ask you to show how you reached it.", all(age("gte", 16), trained("philosophy", 15)), [
      simple("explain-philosophy-reasons", "Explain the steps and accept questions", "You explain the steps. A question exposes a gap, and you revise part of the argument.", [skill("philosophy", 3), skill("oratory", 2), stat("knowledge", 2)]),
      simple("review-argument-later", "Write down the objection and review it later", "You record the objection and compare it with the text after the meeting.", [skill("philosophy", 2), stat("knowledge", 2)]),
    ], ["strabo-alexandria", "plutarch-antony-areius"]),
    automatic("specialist-sky-record", "A clear night", "The sky clears after several cloudy evenings. You add an observation to your record and compare it with the last entry.", all(age("gte", 14), trained("astronomy", 10)), [skill("astronomy", 1), stat("knowledge", 1)], ["louvre-dendera-zodiac"]),
    decision("specialist-conflicting-charts", "Two different chart readings", "Two readers give different interpretations of the same sky diagram. You can compare their calculations or ask how they chose their rules.", all(age("gte", 18), trained("astrology", 20)), [
      simple("compare-chart-calculations", "Check the positions and arithmetic", "You find a copied position that differs between the charts and record the correction.", [skill("astronomy", 3), skill("reckoning", 2), stat("knowledge", 2)]),
      simple("compare-interpretation-rules", "Compare the interpretation rules", "You list the rules each reader used. The exercise records their beliefs without proving either prediction.", [skill("astrology", 3), skill("philosophy", 1), stat("knowledge", 1)]),
    ], ["louvre-dendera-zodiac", "berlin-early-horoscope"]),
    decision("royal-campaign-muster", "Orders during the Alexandrian War", "Fighting has reached Alexandria. Your unit needs people to protect stores and a smaller group for a forward post. The forward post carries a risk of death.", all(armyJob, year("eq", -48)), [
      simple("guard-army-stores", "Guard the stores and move supplies", "You guard the stores and help move supplies away from a threatened lane.", [fact("joined-alexandrian-war"), skill("warfare", 3), stat("health", -2), stat("wealth", 1)]),
      choice("volunteer-forward-post", "Volunteer for the forward post (risk of death)", [
        result("forward-post-return", "You return from the post with a damaged shield and a better understanding of the unit's movements.", [fact("joined-alexandrian-war"), skill("warfare", 7), skill("oratory", 1), stat("health", -7)], 98),
        result("forward-post-fatal", "A spear strikes your abdomen while you hold the forward post. Blood loss from the wound proves fatal.", [{ type: "end", ending: "death-in-adulthood", deathCause: "alexandrian-battle-wound" }], 2),
      ]),
    ], ["alexandrian-war", "caesar-chronology"], { type: "year", at: -48 }),
    automatic("royal-garrison-reorganisation", "The unit checks its equipment", "During the continuing fighting, your unit guards a storehouse. You check equipment and count incoming supply loads.", all(armyJob, year("eq", -47)), [fact("joined-alexandrian-war"), skill("warfare", 2), skill("reckoning", 1)], ["alexandrian-war"], { type: "year", at: -47 }),
    automatic("royal-officer-first-orders", "Your first unit orders", "You write a guard rota, check the equipment list and explain the next day's tasks to your unit.", all(royalEra, flag("officer-commission")), [skill("oratory", 2), stat("knowledge", 1)], ["alexandrian-war"], { type: "age", at: 0 }),
    decision("royal-general-supply-order", "A command decision about supplies", "Your staff cannot provide the same escort for every route. You must decide whether to protect the district's grain stores or escort the next supply convoy.", all(royalEra, job("general"), flag("general-appointed")), [
      simple("protect-grain-stores", "Assign troops to protect the grain stores", "Your troops take posts at the stores. Clerks report that deliveries can be unloaded there without interruption.", [fact("protected-granary"), stat("bonds", 6), skill("warfare", 2)]),
      simple("escort-army-convoy", "Assign troops to escort the supply convoy", "Your escort brings the convoy through. Other units receive their loads on the planned day.", [fact("escorted-supplies"), stat("wealth", 2), skill("warfare", 3)]),
    ], ["alexandrian-war"], { type: "year", at: world.startYear }),
    automatic("royal-grain-order-carried-out", "The new grain order is carried out", "Clerks use the schedule you proposed. Grain is delivered to the district storehouses you named, and the delivery lists are checked against your plan.", all(royalEra, flag("grain-policy-adopted")), [fact("district-grain-delivered"), stat("bonds", 3)], ["strabo-alexandria"], { type: "age", at: 0 }),
    automatic("royal-service-transition", "Your royal appointment ends", "Roman rule replaces the Ptolemaic administration. Your royal army or court appointment ends. You keep your training and contacts, but must find other work.", all(year("gte", -30), any(armyJob, job("court-adviser"))), [job(null), fact("royal-service-ended"), stat("wealth", -2)], ["ptolemaic-period", "augustus-res-gestae"], { type: "year", at: -30 }),
    automatic("specialist-dendera-chart", "Comparing a temple sky diagram", "A copied sky diagram is brought for study. You compare its zodiacal signs with other notes and record the differences. Access to this copy is part of the fictional story.", all(year("eq", -50), any(trained("astronomy", 10), trained("astrology", 10))), [skill("astronomy", 1), skill("astrology", 1)], ["louvre-dendera-zodiac"], { type: "year", at: -50 }),
  ];
  world.events.push(...newEvents);
  world.sources ??= [];
  for (const source of SPECIALIST_SOURCES) if (!world.sources.some(existing => existing.id === source.id)) world.sources.push(structuredClone(source));
  return world;
}

// Institutional catalogue sources are recorded by source ID in the world pack.
export const SPECIALIST_SOURCES = [
  {
    "id": "louvre-dendera-zodiac",
    "title": "Zodiaque de Dendéra (E 13482)",
    "url": "https://collections.louvre.fr/en/ark:/53355/cl010028871",
    "publisher": "Musée du Louvre, Egyptian Antiquities collection",
    "kind": "museum",
    "period": "50 BCE; catalogue dates the relief to June–August",
    "geography": "Hathor temple, Dendera, Upper Egypt",
    "summary": "Catalogues a sandstone ceiling relief with zodiacal signs, decans and constellations, providing a contemporary example of Egyptian astral imagery.",
    "limitations": "A temple object from Dendera, not an Alexandrian teaching manual. It supplies neither access probabilities nor evidence that astrological predictions were reliable.",
    "accessed": "2026-11-06"
  },
  {
    "id": "alexandrian-terracottas",
    "title": "Alexandrian terracottas",
    "url": "https://www.museivaticani.va/content/museivaticani/en/collezioni/musei/museo-gregoriano-egizio/sala-vii--alessandria-e-palmira/terrecotte-alessandrine.html",
    "publisher": "Vatican Museums, Gregorian Egyptian Museum",
    "kind": "museum",
    "period": "Ptolemaic and Roman periods",
    "geography": "Alexandria; collection objects have varied acquisition histories",
    "summary": "Describes Alexandrian figurative terracottas, including mould-made examples and a range of decorative and religious subjects.",
    "limitations": "The collection spans multiple periods and some objects entered through the antiquities market. It does not measure workshop employment, wages or apprenticeship access.",
    "accessed": "2026-11-06"
  },
  {
    "id": "met-wood-carving",
    "title": "Statuette of an ancestral king (2003.154)",
    "url": "https://www.metmuseum.org/art/collection/search/547689",
    "publisher": "The Metropolitan Museum of Art",
    "kind": "museum",
    "period": "Late Period–Early Ptolemaic Period, 380–246 BCE",
    "geography": "Egypt; exact workshop not established in this catalogue entry",
    "summary": "Documents a carved wooden ritual figure associated with temple equipment, illustrating skilled Egyptian wood carving.",
    "limitations": "Earlier than the player's lifetime and not specifically Alexandrian. The object's interpretation is debated; it does not establish a universal carving curriculum or job ladder.",
    "accessed": "2026-11-06"
  },
  {
    "id": "berlin-early-horoscope",
    "title": "An enigmatic early horoscope: BKT X 29 (P. 11831)",
    "url": "https://berlpap.smb.museum/ein-raetselhaftes-fruehes-horoskop/?lang=en",
    "publisher": "Berlin Papyrus Database, Egyptian Museum and Papyrus Collection; Marius Gerhardt, Andreas Winkler and Michael Zellmann-Rohrer",
    "kind": "museum",
    "period": "Late Ptolemaic or early Roman handwriting; astronomical reconstruction best fits 5 June 29 BCE",
    "geography": "Egypt; no Alexandrian workshop identified",
    "summary": "Examines a Greek horoscope listing astral positions, abbreviations, the ascendant and midheaven, with possible professional or client use.",
    "limitations": "The papyrus lacks a personal name and explicit date, and its solar position conflicts with the proposed reconstruction. Its use is uncertain, and no accompanying interpretation survives.",
    "accessed": "2026-11-06"
  },
  {
    "id": "plutarch-antony-areius",
    "title": "Plutarch, Life of Antony 80: Areius and Octavian at Alexandria",
    "url": "https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Plutarch/Lives/Antony*.html",
    "publisher": "LacusCurtius, University of Chicago; Bernadotte Perrin, Loeb translation",
    "kind": "primary",
    "period": "Later biography describing the Roman takeover of Alexandria in 30 BCE",
    "geography": "Alexandria",
    "summary": "Depicts the philosopher Areius receiving public favour from Octavian and interceding for others, illustrating elite intellectual patronage and political access.",
    "limitations": "A retrospective literary account, not an administrative record or promotion dataset. It concerns an exceptional elite figure and does not prove ordinary access to Cleopatra's court.",
    "accessed": "2026-11-06"
  }
];
