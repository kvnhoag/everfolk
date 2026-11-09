// These are fictional encounter situations, not a catalog of pre-existing
// partners. A named person is generated only after an accepted introduction.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const not = condition => ({ type: "not", condition });
const known = partner => ({ type: "known-partner", partner });
const status = (status, partner) => ({ type: "relationship", status, ...(partner ? { partner } : {}) });
const single = any(status("single"), status("divorced"));
const adult = { type: "age", op: "gte", value: 18 };
const cash = delta => ({ type: "cash", delta });
const bonds = delta => ({ type: "stat", stat: "bonds", delta });
const close = (partner, delta) => ({ type: "closeness", target: "partner", partner, delta });
const one = (id, text, result, effects = [], when) => ({ id, text, ...(when ? { when } : {}), outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }] });

export const PEOPLE_ENCOUNTERS = [
  ["harbor", "A pause on the quay", "A harbor worker shares the shade while a load is being checked. The conversation turns from the waiting boats to the errands that brought you both here.", "Harbor worker", "Keeps a steady eye on the quay and enjoys quiet conversation between loads.", 1],
  ["market", "The last place beneath the awning", "A market seller makes room beneath an awning during a brief shower. You compare the goods you were looking for while the lane clears.", "Market seller", "Knows the market's regular customers and likes hearing about unfamiliar places.", 2],
  ["workshop", "A repaired handle to collect", "A workshop worker is finishing a repaired handle when you arrive. There is time to talk while the binding dries.", "Workshop worker", "Enjoys careful handwork and takes pleasure in finding a practical repair.", 0],
  ["linen", "Sorting the linen bundles", "A linen worker asks you to hold a bundle while two labels are compared. The mistake is small, and you finish with time for a friendly conversation.", "Linen worker", "Works patiently with cloth and often finds a useful way to help with a shared task.", 3],
  ["copies", "Waiting for the reader", "Another visitor is waiting outside a copying workshop. You compare the messages you need checked without showing each other private details.", "Document copyist", "Likes checking uncertain wording and listening to the explanation behind a request.", 1],
  ["bakery", "An early loaf is delayed", "A bakery worker explains that the first loaves need longer in the oven. You wait together near the doorway and exchange news about the neighborhood.", "Bakery worker", "Keeps early hours, notices small changes in the neighborhood and enjoys a shared meal.", 0],
  ["well", "A place in the water queue", "Someone helps steady a jar as the water queue moves forward. You have a few unhurried minutes before your turns arrive.", "Household provisioner", "Organizes everyday supplies and finds humor in the little delays of city life.", 2],
  ["festival", "After the music in the courtyard", "As a neighborhood gathering breaks up, another guest stays to help stack the stools. You finish the last row together.", "Garland maker", "Enjoys celebrations, small craftwork and making newcomers feel included.", 1],
  ["library", "A question after the reading", "A listener asks a thoughtful question after a public reading. You stay behind to compare what each of you understood.", "Reader's assistant", "Enjoys discussing an argument and checking it against a concrete example.", 4, { type: "skill", skill: "literacy", op: "gte", value: 10 }],
  ["music", "Keeping the rehearsal beat", "A performer pauses beside you after a neighborhood rehearsal. You compare the entry that made the group laugh and the one that finally came together.", "Musician", "Enjoys rehearsing with others and noticing the moment a group finds the same rhythm.", 0, { type: "skill", skill: "music", op: "gte", value: 5 }],
  ["boat", "A rope returned to its owner", "You carry a borrowed rope back to a small landing. A boat worker checks its coil, thanks you and asks about your day.", "Boat worker", "Likes working beside the water and hearing how other people learned their skills.", 2, { type: "skill", skill: "seamanship", op: "gte", value: 5 }],
  ["drill", "Packing away the practice gear", "After a practice session, another participant stays to count the worn equipment. You put away the last pieces and compare the instructions you found difficult.", "Equipment keeper", "Values clear instructions, patient practice and looking after shared equipment.", 3, { type: "skill", skill: "warfare", op: "gte", value: 5 }],
  ["garden", "A seat beside a planted courtyard", "A neighbor makes room on a low wall beside a planted courtyard. You talk while a household finishes the work inside.", "Garden attendant", "Enjoys plants, patient routines and conversations that do not have to be hurried.", 1],
  ["accounts", "A count checked twice", "Another worker notices that you have checked a quantity twice. You compare your methods and find that both arrive at the same total.", "Accounts assistant", "Likes clear records, practical puzzles and explaining a useful shortcut.", 0, { type: "skill", skill: "reckoning", op: "gte", value: 5 }],
  ["pottery", "The vessel that sits unevenly", "A pottery worker shows you why a small vessel rocks on the bench. You help compare its base with the flat edge of a board.", "Pottery worker", "Enjoys shaping useful objects and can laugh at a piece that needs another attempt.", 2, { type: "skill", skill: "craft", op: "gte", value: 5 }],
  ["neighbors", "A neighbor returns a basket", "Someone from a nearby household returns a borrowed basket. Neither household is in a hurry, and the conversation continues by the doorway.", "Cloth seller", "Knows nearby households, likes swapping news and makes time for familiar people.", 4],
];

export function applyPeople(world) {
  const previousIds = new Set(world.character.partners.map(person => person.id));
  const referencesOldPerson = value => {
    if (!value || typeof value !== "object") return false;
    if (typeof value.partner === "string" && previousIds.has(value.partner)) return true;
    return Object.values(value).some(child => Array.isArray(child) ? child.some(referencesOldPerson) : referencesOldPerson(child));
  };
  world.events = world.events.filter(event => !referencesOldPerson(event));
  world.character.activities = world.character.activities.filter(activity => !referencesOldPerson(activity));
  world.character.identity = { namePools: {
    male: [...world.character.playerNames],
    female: ["Demetria", "Thais", "Berenike", "Tyche", "Isidora", "Apollonia", "Dionysia", "Kleopatra", "Artemisia", "Eirene", "Myrine", "Philainis", "Kleio", "Ptolemais", "Charis", "Doris", "Herais", "Thermuthis", "Taesis", "Tanouphis", "Senamounis", "Taphis", "Didyme", "Heliodora", "Theodora", "Timarete", "Melitta", "Philista", "Kallisto", "Nikaia", "Olympias", "Sostrata"],
  }, avatarVariants: 3 };
  world.character.proceduralPartners = true;
  world.character.encounterPacing = { firstMeetingChance: 0.7, meetingChance: 0.3, dateChance: 0.75, cooldownYears: 2 };
  world.character.requireIntroductions = true;
  world.character.exclusiveCourtship = true;
  world.character.partners = PEOPLE_ENCOUNTERS.map(([key, , , occupation, description, ageOffset]) => ({
    id: `person-${key}`, name: "An acquaintance", ageOffset, occupation, description,
  }));

  for (const [key, title, text, , , , context] of PEOPLE_ENCOUNTERS) {
    const id = `person-${key}`, person = `{person:${id}}`;
    world.events.push({ id: `meet-${id}`, title, text, trigger: { type: "random", weight: 2 }, maxOccurrences: 1,
      when: all(adult, not(known(id)), ...(context ? [context] : [])), evidence: "fictional", sourceIds: [],
      choices: [one(`leave-${id}`, "Finish your errand and go", "You finish what brought you here and go on your way."),
        one(`introduce-${id}`, "Stay and introduce yourself", "You introduce yourself and spend a little time talking. You agree that it would be pleasant to meet again.", [{ type: "introduce", partner: id }])],
    });
    world.events.push({ id: `date-${id}`, title: "An invitation to spend time together",
      text: `You meet ${person} again during an ordinary day. There is time to talk about meeting somewhere together, if you would like to ask.`,
      trigger: { type: "random", weight: 6 }, maxOccurrences: 1,
      when: all(adult, known(id), single), evidence: "fictional", sourceIds: [],
      choices: [one(`keep-friendly-${id}`, "Keep the meeting friendly", `You and ${person} enjoy the conversation without making romantic plans.`),
        { id: `invite-date-${id}`, text: `Ask ${person} on a date`, when: all(known(id), single), outcomes: [
          { id: `date-${id}-accepted`, text: `${person} agrees. You spend time together by choice and decide to begin dating.`, weight: 65, effects: [{ type: "relationship", status: "courting", partner: id }, close(id, 5), bonds(2)] },
          { id: `date-${id}-declined`, text: `${person} appreciates the invitation but does not want to begin dating. You accept the answer and part on friendly terms.`, weight: 35, effects: [] },
        ] }],
    });
    const activity = (choice, cooldownYears = 1) => ({ ...choice, category: "relationship", minAge: 18, cooldownYears });
    const together = any(status("courting", id), status("married", id));
    world.character.activities.push(
      activity({ id: `court-${id}`, text: `Ask ${person} to date again`, when: all(known(id), single, { type: "cash", op: "gte", value: 10 }), outcomes: [
        { id: `court-${id}-accepted`, text: `${person} agrees to begin dating again. You arrange to spend more time together.`, weight: 65, effects: [cash(-10), { type: "relationship", status: "courting", partner: id }, close(id, 5), bonds(2)] },
        { id: `court-${id}-declined`, text: `${person} declines. You accept the answer and return to your usual plans.`, weight: 35, effects: [cash(-10)] },
      ] }, 2),
      activity(one(`marry-${id}`, `Plan a wedding with ${person}`, `You and ${person} marry, share a modest meal and set up a household together.`,
        [cash(-30), { type: "relationship", status: "married", partner: id }, close(id, 5), bonds(2)], all(known(id), status("courting", id), { type: "cash", op: "gte", value: 30 })), 5),
      activity(one(`time-with-${id}`, `Make time for ${person}`, `You and ${person} share a meal and talk about the past few days.`,
        [cash(-10), close(id, 6), bonds(3), { type: "stat", stat: "health", delta: 1 }], all(known(id), together, { type: "cash", op: "gte", value: 10 })), 2),
      activity(one(`talk-with-${id}`, `Spend time talking with ${person}`, `You and ${person} put the remaining tasks aside and listen to each other's news.`,
        [cash(-10), close(id, 6), bonds(1)], all(known(id), { type: "cash", op: "gte", value: 10 }))),
    );
  }
  const child = world.character.activities.find(activity => activity.id === "grow-household");
  if (child) {
    child.text = "Make plans to welcome a child";
    for (const outcome of child.outcomes) outcome.text = outcome.effects.some(effect => effect.type === "child")
      ? "A child joins your household. You and your spouse arrange their care and make room in your daily routines."
      : "No child joins your household this year. You and your spouse keep talking about the plans.";
  }
  world.relationships.description = "People become known through accepted encounters. A successful date begins a relationship; dating history is retained separately from acquaintances. Contact, conflict and neglect affect individual closeness. Close household members can help with recovery. These fictional gameplay rules apply to characters of either sex and are not reconstructed ancient relationship practices.";
  return world;
}
