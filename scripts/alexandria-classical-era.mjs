import { readFileSync } from "node:fs";

// Applied after the ordinary content and prose passes. The lived encounters are
// original fiction within sourced date windows, not claims about historical
// pupils, officials, recruitment, travel costs or access to a famous person.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const age = (op, value) => ({ type: "age", op, value });
const year = (op, value) => ({ type: "year", op, value });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const has = flag => ({ type: "flag", flag, value: true });
const cashAtLeast = value => ({ type: "cash", op: "gte", value });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const cash = delta => ({ type: "cash", delta });
const flag = flag => ({ type: "flag", flag, value: true });
const outcome = (id, text, effects = [], weight = 1) => ({ id, text, effects, weight });
const simple = (id, text, result, effects = [], when) => ({ id, text,
  ...(when ? { when } : {}), outcomes: [outcome(`${id}-result`, result, effects)] });
const armyJob = any(...["soldier", "officer", "general"].map(job => ({ type: "job", job })));

function timeline(id, title, text, at, sourceIds, effects = [], approximate = false) {
  return { id, title, text, trigger: { type: "year", at }, mode: "automatic", effects, choices: [], sourceIds,
    evidence: approximate ? "historically-inspired" : "documented-history" };
}

function required(items, id) {
  const item = items.find(item => item.id === id);
  if (!item) throw new Error(`Classical-era revision is missing ${id}`);
  return item;
}

// Retain the familiar identifiers and arithmetic where their meaning survives.
// Dates are deliberate new bounds, not a blanket translation by 284 years.
function reviseRules(value) {
  if (!value || typeof value !== "object") return;
  if (value.type === "year") {
    if (value.value === -30 && value.op === "lt") value.value = -250;
    if (value.value === -29 && value.op === "gte") value.value = -350;
    if (value.value === -48 && value.op === "eq") value.value = -322;
    if (value.value === -47 && value.op === "eq") value.value = -321;
  }
  if (value.type === "flag" && value.flag === "joined-alexandrian-war") value.flag = "served-during-succession";
  if (value.type === "end" && value.deathCause === "alexandrian-battle-wound") value.deathCause = "campaign-spear-wound";
  for (const [key, child] of Object.entries(value)) if (key !== "sources" && child && typeof child === "object") reviseRules(child);
}

function neutralizeEarlierScenes(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "sourceIds" || key === "sources") continue;
    if (["text", "title", "description"].includes(key) && typeof child === "string") {
      value[key] = child.replace(/\bAlexandria\b/g, "the coast near Rhakotis")
        .replace(/\bAlexandrian\b/g, "coastal")
        .replace(/\bthe city\b/g, "the neighborhood")
        .replace(/\bThe city\b/g, "The neighborhood")
        .replace(/\bcity work\b/g, "local work")
        .replace(/\bzodiac signs\b/g, "recorded sky signs")
        .replace(/\bzodiacal signs\b/g, "recorded sky signs");
    } else if (child && typeof child === "object") neutralizeEarlierScenes(child);
  }
}

export function applyClassicalEra(world) {
  world.startYear = -350;
  world.version = "0.32.0";
  world.title = "From Rhakotis to Alexandria";
  world.description = "Begin a fictional life near Rhakotis on Egypt's Mediterranean coast in 350 BCE. Grow up before Alexandria is founded, then live through Alexander's arrival and the first generations of the new city. Work, learn and build a household; chosen journeys and skilled work may bring you into the worlds of Aristotle, Alexander and Euclid.";
  // The mortality model is deliberately retained as a later comparison, not
  // relabelled as an observed fourth-century BCE population.
  for (const model of [world.health, world.mortality]) if (model?.description) {
    model.description = model.description.replace(/\bPtolemaic Alexandria\b/g, "the Egyptian coast in this era")
      .replace(/Ptolemaic Alexandrian mortality/g, "fourth-century BCE coastal Egyptian mortality")
      .replace(/Ptolemaic Alexandrian man/g, "person born near Rhakotis in 350 BCE");
  }
  if (world.economy?.description) world.economy.description = world.economy.description
    .replace("The same simplified unit continues after Roman rule.", "The same simplified accounting unit is used across this lifetime's changes of ruler; it does not imply a fixed exchange rate or uniform historical coinage.");

  const removed = new Set(["caesar-in-alexandria", "water-and-war", "news-of-actium", "roman-rule",
    "royal-campaign-muster", "royal-garrison-reorganisation", "royal-service-transition", "specialist-dendera-chart"]);
  world.events = world.events.filter(event => !removed.has(event.id));
  reviseRules(world);
  // These passages can occur before the urban foundation. Generic households,
  // workshops, landings and neighbors do not require a fully built metropolis.
  for (const collection of [world.origins, world.events, world.character.jobs, world.character.activities,
    world.character.deathCauses, world.legacy?.routes ?? [], world.legacy?.achievements ?? []]) neutralizeEarlierScenes(collection);

  const birth = required(world.events, "the-first-household");
  birth.title = "You are born near Rhakotis";
  birth.text = "You are born near Rhakotis in 350 BCE, on the Egyptian coast where Alexandria will later grow. For now, your world is a room, familiar hands and the sounds of work outside.";
  birth.sourceIds = ["classical-rhakotis", "classical-rhakotis-archaeology"];
  birth.evidence = "historically-inspired";
  required(world.origins, "delta-newcomers").text = "You are born near Rhakotis after your family moves from a Delta village. They share rooms with relatives and look for steady work along the coast. Food and childcare are shared while they settle in.";
  for (const origin of world.origins) {
    origin.sourceIds = ["classical-rhakotis", "classical-rhakotis-archaeology"];
    origin.evidence = "historically-inspired";
  }

  world.flags["experienced-war"].label = "Lived through the Persian reconquest of Egypt";
  delete world.flags["roman-rule"];
  delete world.flags["royal-service-ended"];
  delete world.flags["joined-alexandrian-war"];
  for (const [id, label] of Object.entries({
    "served-during-succession": "Handled military supplies during the succession struggles",
    "alexander-in-egypt": "Lived through Alexander's arrival in Egypt",
    "alexandria-founded": "Lived through the foundation of Alexandria",
    "ptolemy-governs-egypt": "Lived under Ptolemy's administration in Egypt",
    "ptolemy-king": "Lived through Ptolemy's adoption of kingship",
    "heard-aristotle": "Traveled to Athens and heard Aristotle teach",
    "assisted-alexander-foundation": "Worked on supply preparations around Alexandria's foundation",
    "met-alexander": "Briefly addressed Alexander during his Egyptian stay",
    "studied-euclidean-proof": "Had a geometrical demonstration checked in Euclid's circle",
  })) world.flags[id] = { label, initial: false };

  required(world.character.jobs, "soldier").description = "Drill, guard stores and carry out orders in royal service. Officials and rulers change during your lifetime; your post belongs to the administration you actually serve.";
  const omenJob = required(world.character.jobs, "astrologer");
  omenJob.title = "Sky-omen interpreter";
  omenJob.description = "Discuss traditional interpretations of sky signs and seasonal observations. These are beliefs, not reliable predictions; this livelihood does not assume later Egyptian natal-horoscope techniques.";
  world.character.skills.astrology.label = "Sky-omen reading";
  world.character.skills.astrology.description = "Compare traditional readings of observed sky signs after learning observation and arithmetic. The interpretations are beliefs, not reliable predictions; no later natal-horoscope system is assumed.";
  const astrologyCopy = {
    "train-astrology": ["Compare sky signs and traditional omen readings", "You compare recorded sky signs with several traditional interpretations. Observation and interpretation stay in separate columns; no prediction is established by the exercise."],
    "work-astrologer": ["Seek work interpreting sky omens", "You arrange paid work discussing traditional sky signs and buy writing materials. The work records beliefs rather than established predictions."],
    "research-astrological-readings": ["Compare conflicting sky-omen readings", "You compare two interpretations of the same observed signs. Their claims differ, and you record the disagreement without treating either as a proven prediction."],
    "prepare-a-chart-reading": ["Prepare a traditional sky-omen reading", "You set down the observed signs and explain their traditional interpretations. After writing materials, you earn 20 drachmas. The reading records a belief, not a reliable prediction."],
  };
  for (const [id, [text, result]] of Object.entries(astrologyCopy)) {
    const item = required(world.character.activities, id);
    item.text = text;
    item.outcomes[0].text = result;
  }
  const manifest = required(world.events, "a-place-on-the-manifest");
  for (const choice of manifest.choices) if (choice.outcomes.some(result => result.effects.some(effect => effect.type === "job" && effect.job === "astrologer"))) {
    choice.text = "Take work interpreting traditional sky signs";
    for (const result of choice.outcomes) result.text = "You arrange work interpreting traditional sky signs. Your notes separate recorded observations from beliefs about what they mean.";
  }
  const repeatedOmen = required(world.events, "variety-trade-astrology-question");
  repeatedOmen.text = "A client asks you to repeat part of a traditional sky-omen reading. You explain what the tradition claims and where observation does not support a definite answer.";
  const conflicting = required(world.events, "specialist-conflicting-charts");
  conflicting.text = "Two readers compare records of the same sky signs and give different interpretations. One points to an observed position; the other insists on a traditional rule. You can check the arithmetic or ask each to explain the rule.";
  conflicting.choices[0].outcomes[0].text = "You find a copied position that differs between the observation records and set down the correction.";

  const administrativeChange = required(world.events, "after-the-transition");
  administrativeChange.title = "A different hand receives the accounts";
  administrativeChange.text = "A local office asks for accounts in a revised arrangement. Familiar work still has to be done, but the clerk receiving the papers has changed. You can learn the new procedure or ask neighbors who have already used it.";
  administrativeChange.sourceIds = ["classical-egypt-transitions"];
  administrativeChange.evidence = "fictional";
  const command = required(world.events, "royal-general-supply-order");
  command.trigger = { type: "year", at: -350 };
  command.sourceIds = ["classical-egypt-transitions"];
  command.evidence = "fictional";

  const wound = required(world.character.deathCauses, "war-violence");
  wound.text = "During the disorder around the Persian reconquest of Egypt, you suffer a penetrating chest wound. The injury is fatal.";
  wound.when = year("eq", -343);
  required(world.character.deathCauses, "alexandrian-battle-wound").id = "campaign-spear-wound";
  const supplies = required(world.character.activities, "organise-war-supplies");
  supplies.text = "Help organise supplies during the succession struggles";
  supplies.outcomes[0].text = "You check loads and direct carts to the assigned stores while your unit guards the route. The work answers an immediate order; it does not settle who will rule.";

  // Later artifacts and late-Ptolemaic careers cannot serve as direct evidence
  // for this lifetime. Household fiction keeps its arithmetic, but uses period
  // context or no historical citation instead of silently moving those objects.
  const replacements = {
    "alexandrian-war": "classical-egypt-transitions", "caesar-chronology": "classical-alexander",
    "ptolemaic-period": "classical-egypt-transitions", "augustus-res-gestae": "classical-egypt-transitions",
    "augustan-alexandria-documents": "classical-rhakotis", "alexandrian-bakery-lease": "classical-rhakotis",
    "plutarch-antony-areius": "classical-aristotle", "bonazzi-2013-eudorus": "classical-aristotle",
    "louvre-dendera-zodiac": null, "berlin-early-horoscope": null, "fanelli-jones-2019-almanac": null,
  };
  function reviseReferences(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.sourceIds)) {
      value.sourceIds = [...new Set(value.sourceIds.flatMap(id => Object.hasOwn(replacements, id) ? replacements[id] ? [replacements[id]] : [] : [id]))];
      if (value.evidence && value.sourceIds.length === 0) value.evidence = "fictional";
    }
    for (const [key, child] of Object.entries(value)) if (key !== "sources" && child && typeof child === "object") reviseReferences(child);
  }
  reviseReferences(world);

  const history = [
    timeline("classical-persian-reconquest", "Egypt changes hands", "In 343 BCE, Persian forces reconquer Egypt. News travels along the coast with officials, traders and people looking for relatives. Your household hears that authority has changed again.", -343, ["classical-egypt-transitions"], [flag("experienced-war")]),
    timeline("classical-alexander-accession", "A young king in Macedon", "News from the Greek world names Alexander as king of Macedon after Philip II's death in 336 BCE. For a household on the Egyptian coast, the name first arrives as distant news.", -336, ["classical-alexander"]),
    timeline("classical-alexander-crossing", "An army crosses into Asia", "In 334 BCE, Alexander takes his army across into Asia. Sailors compare the reports with the routes they know; the war is moving through lands connected to Egypt by trade and imperial rule.", -334, ["classical-alexander"]),
    timeline("classical-alexander-egypt", "Alexander arrives in Egypt", "Alexander enters Egypt in 332 BCE and replaces Persian authority. His arrival brings new officials and military demands, though it is not a battle fought in your own street. People begin asking what the king intends for this coast.", -332, ["classical-egypt-transitions", "classical-alexander"], [flag("alexander-in-egypt")]),
    timeline("classical-alexandria-founded", "Lines for a new city", "In 331 BCE, Alexander founds Alexandria beside the older settlement of Rhakotis. Marked lines and plans are a beginning: streets, houses and institutions will take years to grow around the people already living here.", -331, ["classical-foundation-chronology", "classical-rhakotis"], [flag("alexandria-founded")]),
    timeline("classical-alexander-death", "The king is dead; Egypt has a governor", "News arrives of Alexander's death at Babylon in 323 BCE. His commanders divide responsibilities while the succession remains unsettled. Ptolemy takes charge of Egypt as governor; he has not yet adopted the title of king.", -323, ["classical-alexander", "classical-egypt-transitions"], [flag("ptolemy-governs-egypt")]),
    timeline("classical-aristotle-death", "News from Euboea", "A traveler brings news that Aristotle has died in 322 BCE, after leaving Athens for Chalcis. Readers who know his arguments continue to discuss them; hearing his name is now different from having the chance to hear him teach.", -322, ["classical-aristotle"]),
    timeline("classical-ptolemy-kingship", "Ptolemy takes the royal title", "In 305 BCE, Ptolemy adopts the title of king. The man who governed Egypt after Alexander now rules in his own royal name. Accounts and commissions begin to carry the authority of a new dynasty.", -305, ["classical-egypt-transitions"], [flag("ptolemy-king")]),
    timeline("classical-euclid-teaching", "A proof must hold at every step", "Around 300 BCE, Euclid is associated with mathematical teaching in Alexandria. His exact life dates are uncertain. Readers here begin speaking of demonstrations whose steps must follow from agreed definitions, rather than from a convincing sketch alone.", -300, ["classical-euclid"], [], true),
    timeline("classical-scholarly-households", "Patrons make room for readers", "In the early third century BCE, royal support helps Alexandria's scholarly institutions develop. Their beginnings and organization are uncertain. Collections, readers and teaching circles grow over time; the finished Library of later accounts did not stand here when you were born.", -295, ["classical-library"], [], true),
    timeline("classical-pharos-completed", "A tower above the harbor", "Around 280 BCE, the great lighthouse on Pharos becomes part of Alexandria's harbor. Accounts differ on its precise completion year. Its height now gives returning crews a landmark that did not exist along the coast of your childhood.", -280, ["classical-pharos"], [], true),
  ];

  const successionGuard = {
    id: "classical-succession-guard", title: "An order during the succession struggles",
    text: "Your unit is ordered to guard a supply route while rival commanders dispute authority after Alexander's death. The assignment is local and uncertain: one post covers the stores; another stands farther along an exposed approach.",
    trigger: { type: "year", at: -322 }, when: all(armyJob, year("lte", -320)),
    sourceIds: ["classical-alexander"], evidence: "fictional", choices: [
      simple("classical-guard-stores", "Guard the stores and move supplies", "You guard the stores and help move loads into a protected yard.", [flag("served-during-succession"), skill("warfare", 3), stat("health", -2), stat("wealth", 1)]),
      { id: "classical-forward-post", text: "Volunteer for the exposed post (risk of death)", outcomes: [
        outcome("classical-forward-return", "You return from the post with a damaged shield and a clearer understanding of the unit's movements.", [flag("served-during-succession"), skill("warfare", 7), skill("oratory", 1), stat("health", -7)], 98),
        outcome("classical-forward-fatal", "A spear strikes your abdomen during the assignment. Blood loss from the wound proves fatal.", [{ type: "end", ending: "death-in-adulthood", deathCause: "campaign-spear-wound" }], 2),
      ] },
    ],
  };
  const garrison = { id: "classical-garrison-account", title: "The loads and the equipment",
    text: "The unit checks a storehouse and compares its equipment list with the incoming loads. The names at the head of the orders may change; every missing item still has to be explained.",
    trigger: { type: "year", at: -321 }, when: all(armyJob, year("lte", -320)), mode: "automatic", choices: [],
    effects: [flag("served-during-succession"), skill("warfare", 2), skill("reckoning", 1)], sourceIds: ["classical-alexander"], evidence: "fictional" };

  const figures = [
    { id: "classical-aristotle-journey", title: "A passage to Athens",
      text: "A returning trader offers to arrange a passage to Athens and a place to stay with readers there. Aristotle is teaching at the Lyceum. Taking the journey would mean a season away from your household; a place in a discussion is not promised.",
      trigger: { type: "year", at: -332 }, when: all(age("gte", 18), year("lte", -324), trained("literacy", 10), trained("philosophy", 8)),
      sourceIds: ["classical-aristotle"], evidence: "fictional", choices: [
        simple("classical-aristotle-stay", "Stay with your household and local teacher", "You ask for a copied argument instead and keep your work near home. This time you do not travel to Athens."),
        { id: "classical-aristotle-travel", text: "Pay 30 drachmas for the round trip to Athens", when: cashAtLeast(30),
          opportunity: { label: "Hear Aristotle teach", outcomeIds: ["classical-aristotle-heard"] }, outcomes: [
            outcome("classical-aristotle-heard", "In Athens, a reader brings you into a discussion at the Lyceum. Aristotle asks the group to distinguish what a thing is from why it changes. You return to Egypt with a checked set of notes and a question your own teacher cannot dismiss.", [cash(-30), flag("heard-aristotle"), skill("philosophy", 5), skill("literacy", 2), stat("knowledge", 2)], 65),
            outcome("classical-aristotle-missed", "The passage reaches Athens late, and the promised introduction does not materialize. Other readers help you examine an argument before you return to Egypt. You have made the journey, but have not heard Aristotle himself.", [cash(-30), skill("philosophy", 1), skill("literacy", 1)], 35),
          ] },
      ] },
    { id: "classical-alexander-shore-work", title: "Supplies for the king's party",
      text: "Alexander's party is inspecting the Egyptian coast. An officer needs local hands to check boat loads and clear a landing. Helping could put you near the king, but a paid task is not an introduction to him.",
      trigger: { type: "year", at: -332 }, when: all(age("gte", 18), year("lte", -331), any(trained("craft", 8), trained("seamanship", 8), trained("warfare", 8))),
      sourceIds: ["classical-alexander", "classical-rhakotis"], evidence: "fictional", choices: [
        simple("classical-alexander-keep-work", "Keep to your existing work", "You leave the officer to find other hands. The party's plans reach you through the people who took the work."),
        simple("classical-alexander-supply", "Check the loads and help prepare the landing", "You count the loads, clear the landing and receive the agreed payment. The officer keeps your name with the supply account; the work becomes part of the preparations around the new city.", [cash(15), skill("reckoning", 2), skill("seamanship", 2), flag("assisted-alexander-foundation")]),
        { id: "classical-alexander-approach", text: "Take the work and ask to present the checked account", when: trained("oratory", 8),
          opportunity: { label: "Briefly address Alexander", outcomeIds: ["classical-alexander-met"] }, outcomes: [
            outcome("classical-alexander-met", "After the loads are checked, an officer calls you forward with the account. Alexander asks whether boats can use the landing in a contrary wind. You answer from the shore you know. The exchange is brief; afterward you return to the workers and collect your pay.", [cash(15), skill("reckoning", 2), skill("oratory", 3), flag("assisted-alexander-foundation"), flag("met-alexander")], 35),
            outcome("classical-alexander-not-met", "The officer accepts the account and pays you, but the king's party moves on before you are called. Your work is recorded; you have not spoken to Alexander.", [cash(15), skill("reckoning", 2), skill("oratory", 1), flag("assisted-alexander-foundation")], 65),
          ] },
      ] },
    { id: "classical-euclid-demonstration", title: "The line that the sketch cannot prove",
      text: "A reader connected with Euclid's teaching brings you a geometrical construction. A neat drawing will not answer the question: you must explain why the steps hold. Ten drachmas would cover materials and time in the working circle.",
      trigger: { type: "year", at: -305 }, when: all(age("gte", 45), year("lte", -290), trained("literacy", 20), trained("reckoning", 20)),
      sourceIds: ["classical-euclid"], evidence: "fictional", choices: [
        simple("classical-euclid-keep-work", "Keep to the calculations you already use", "You return the construction and finish the accounts waiting on your own table."),
        { id: "classical-euclid-work-proof", text: "Pay 10 drachmas and work through the demonstration", when: cashAtLeast(10),
          opportunity: { label: "Have the demonstration accepted", outcomeIds: ["classical-euclid-proof-accepted"] }, outcomes: [
            outcome("classical-euclid-proof-accepted", "In the teaching circle, Euclid stops at the step you thought was obvious. You rebuild it from the agreed definitions and earlier results. When the demonstration is accepted, you take home a corrected copy whose margin records the point you had to prove.", [cash(-10), flag("studied-euclidean-proof"), skill("reckoning", 5), skill("literacy", 2), stat("knowledge", 2)], 70),
            outcome("classical-euclid-proof-revised", "The readers find a step your explanation does not justify. You leave with a correction to work through, rather than an accepted demonstration. The fee and the failed attempt have still bought a clearer question.", [cash(-10), skill("reckoning", 1), skill("literacy", 1), stat("knowledge", 1)], 30),
          ] },
      ] },
  ];
  // History runs before personal decisions in each year's scheduling pass.
  world.events.unshift(...history);
  world.events.push(successionGuard, garrison, ...figures);

  const raw = JSON.parse(readFileSync(new URL("../research/classical-era-sources.json", import.meta.url), "utf8"));
  const sources = Array.isArray(raw) ? raw : raw.sources;
  if (!Array.isArray(sources)) throw new Error("Classical-era sources must be an array");
  world.sources ??= [];
  for (const source of sources) if (!world.sources.some(existing => existing.id === source.id)) world.sources.push(structuredClone(source));
  return world;
}
