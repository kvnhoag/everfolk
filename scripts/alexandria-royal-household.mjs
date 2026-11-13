// Royal-household governance is authored fiction, not a reconstruction of a
// dynasty's finances or a claim that minor royal kin inherited Egypt's throne.
const all = (...conditions) => ({ type: "all", conditions });
const age = (op, value) => ({ type: "age", op, value });
const royal = (metric, delta) => ({ type: "royal", metric, delta });
const atLeast = (metric, value) => ({ type: "royal", metric, op: "gte", value });
const below = (metric, value) => ({ type: "royal", metric, op: "lt", value });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const outcome = (id, text, effects = [], weight = 1) => ({ id, text, weight, effects });
const choice = (id, text, result, effects = [], when) => ({ id, text, ...(when ? { when } : {}), outcomes: [outcome(`${id}-result`, result, effects)] });
const event = (id, title, text, trigger, choices, when, extra = {}) => ({
  id, title, text, trigger, choices, audience: "royal", evidence: "fictional", sourceIds: [], ...(when ? { when } : {}), ...extra,
});

export function applyRoyalHousehold(world) {
  world.version = "0.44.0";
  world.royalty = {
    originId: "royal-household", minAge: 16,
    metrics: {
      treasury: { label: "House treasury", min: 0, max: 1000000, initial: 900 },
      influence: { label: "Court influence", min: 0, max: 100, initial: 55 },
      stability: { label: "Household stability", min: 0, max: 100, initial: 65 },
      security: { label: "Household security", min: 0, max: 100, initial: 60 },
      succession: { label: "Succession readiness", min: 0, max: 100, initial: 15 },
    },
    // Net annual estate receipts after staff and ordinary court obligations.
    yearlyEffects: [royal("treasury", 20), royal("influence", -1), royal("stability", -1), royal("security", -1), royal("succession", -0.5)].map(({ metric, delta }) => ({ metric, delta })),
  };

  // Personal health, family and the historical calendar remain shared. Daily
  // commerce, paid errands, apprenticeships and ordinary work have their own lane.
  const sharedEvents = new Set([
    "the-first-household", "first-steps", "medical-care-needed", "relationship-strain",
    "a-shared-household", "a-new-generation", "the-weight-of-years", "names-remembered",
    "a-later-season", "an-extraordinary-age", "a-quiet-room", "an-unwell-week",
    "family-shared-routines", "family-a-child-growing", "the-people-who-return", "what-you-will-keep",
  ]);
  for (const item of world.events) {
    const history = item.id.startsWith("classical-") && item.mode === "automatic" && item.trigger.type === "year";
    const personalFollowup = /^(date|teacher-offer|disciple-offer|enmity-offer)-person-/.test(item.id);
    item.audience = sharedEvents.has(item.id) || history || personalFollowup ? undefined : "common";
  }
  for (const item of world.character.activities) {
    const personal = ["training", "family", "relationship"].includes(item.category);
    const business = /^(form-business|joint-order|end-business)-/.test(item.id);
    item.audience = personal && !business ? undefined : "common";
  }
  for (const rule of world.yearlyRules) {
    if (["adult-household-cost", "later-household-resources"].includes(rule.id)) rule.audience = "common";
  }
  const natal = world.origins.find(origin => origin.id === "royal-household");
  natal.text += " Your life follows the affairs of the royal house: its council, treasury, alliances, protection and succession. You belong to a minor branch; birth does not make you the reigning monarch.";
  for (const id of ["background-royal-household-childhood", "background-royal-household-practice", "household-royal-patronage-changes"]) {
    world.events.find(item => item.id === id).audience = "royal";
  }
  const patronage = world.events.find(item => item.id === "household-royal-patronage-changes");
  patronage.effects = [royal("treasury", -180), royal("influence", -12), royal("security", -5), stat("bonds", -1)];
  const practice = world.events.find(item => item.id === "background-royal-household-practice");
  practice.title = "Listening to the household council";
  practice.text = "An elder explains why the family must keep its agreements after the conquest. You listen as household officers discuss visitors, estate obligations and the safety of relatives.";
  practice.effects = [skill("literacy", 2), skill("oratory", 2), stat("knowledge", 1)];

  function action(id, text, result, effects, cost = 0, minAge = 16) {
    return { ...choice(id, text, result, effects, cost ? atLeast("treasury", cost) : undefined), audience: "royal", category: "career", minAge, cooldownYears: 1 };
  }
  world.character.activities.push(
    action("royal-hold-council", "Hold a household council", "You hear the household officers, settle the next priorities and explain your decisions to your relatives.", [royal("influence", 3), royal("stability", 5), royal("succession", 2)]),
    action("royal-review-tribute", "Call in outstanding estate dues", "Your steward collects 70 drachmas already owed to the house. The firmer demand strains relations with its dependants.", [royal("treasury", 70), royal("stability", -5), royal("influence", -2)]),
    action("royal-send-envoys", "Send envoys to influential households", "You spend 40 drachmas on travel and hospitality. Your envoys renew agreements and return with useful introductions.", [royal("treasury", -40), royal("influence", 10), royal("stability", 1)], 40),
    action("royal-inspect-guard", "Review the household guard", "You allocate 35 drachmas to equipment and guard training, then inspect access to the estate and the escorts for your relatives.", [royal("treasury", -35), royal("security", 12)], 35),
    action("royal-hear-petitions", "Hear petitions and fund relief", "You hear disputes through your household officers and spend 30 drachmas resolving urgent needs among the house's dependants.", [royal("treasury", -30), royal("stability", 12), royal("influence", 2)], 30),
    action("royal-plan-succession", "Agree the house's succession arrangements", "You spend 25 drachmas bringing relatives together to record responsibilities and the future custody of family property. This concerns your branch of the family, not Egypt's throne.", [royal("treasury", -25), royal("succession", 14), royal("stability", 2)], 25),
    action("royal-study-statecraft", "Study statecraft with a household tutor", "Your tutor helps you read a petition, explain its competing claims and practise a reply. The house provides the lesson.", [skill("literacy", 3), skill("oratory", 2), stat("knowledge", 1)], 0, 8),
  );

  world.yearlyRules.push(
    { id: "royal-unsettled-estates", audience: "royal", when: all(age("gte", 16), below("stability", 25)), effects: [royal("treasury", -15), royal("influence", -2)] },
    { id: "royal-unprotected-estates", audience: "royal", when: all(age("gte", 16), below("security", 25)), effects: [royal("treasury", -20), royal("stability", -2)] },
    { id: "royal-isolated-house", audience: "royal", when: all(age("gte", 16), below("influence", 20)), effects: [royal("treasury", -10)] },
    { id: "royal-uncertain-succession", audience: "royal", when: all(age("gte", 40), below("succession", 25)), effects: [royal("stability", -2), royal("influence", -1)] },
    { id: "royal-empty-coffers", audience: "royal", when: all(age("gte", 16), below("treasury", 30)), effects: [royal("security", -2), royal("stability", -2)] },
  );
  world.events.push(
    event("royal-first-audience", "A greeting before the elders", "A caregiver brings you into a quiet family gathering. Your relatives give you time to greet the visitors.", { type: "age", at: 3 }, [
      choice("royal-greet-visitors", "Greet the visitors with your caregiver", "You repeat the greeting and stay close to a familiar hand.", [stat("bonds", 2)]),
      choice("royal-watch-gathering", "Watch from a quiet corner", "You watch people take turns speaking while your caregiver explains their names.", [stat("knowledge", 1)]),
    ]),
    event("royal-first-tutor", "A tutor in the household", "Your family sets aside time for lessons in writing and speaking. The tutor asks what you would like to try first.", { type: "age", at: 6 }, [
      choice("royal-first-writing", "Begin with a short written message", "You copy the message with the tutor's help.", [skill("literacy", 5), stat("knowledge", 2)]),
      choice("royal-first-speaking", "Practise greeting an important guest", "You rehearse the greeting, then explain whom it is meant for.", [skill("oratory", 5), stat("bonds", 2)]),
    ]),
    event("royal-council-observer", "A place beside the council", "The elders let you listen to a discussion of the house's future. You can ask one officer to explain their responsibilities afterward.", { type: "age", at: 12 }, [
      choice("royal-listen-envoy", "Ask about alliances", "An envoy explains how promises between households are kept.", [skill("oratory", 4), royal("influence", 3)]),
      choice("royal-listen-guard", "Ask about protecting the house", "The guard captain explains escorts and access to the estate.", [skill("warfare", 3), royal("security", 3)]),
      choice("royal-listen-steward", "Ask about obligations to dependants", "A steward explains why reliable agreements matter to both the house and its dependants.", [skill("reckoning", 3), royal("stability", 3)]),
    ]),
    event("royal-household-responsibility", "Your first council responsibility", "The elders entrust you with a voice in the management of your branch of the royal family. Household officers handle ordinary purchases and labour; you decide the house's priorities.", { type: "age", at: 16 }, [
      choice("royal-priority-agreements", "Renew the house's agreements", "You begin by hearing the envoys and confirming outstanding promises.", [royal("influence", 6)]),
      choice("royal-priority-family", "Bring the family into agreement", "You invite the relatives to explain what they need from the house's leadership.", [royal("stability", 6), royal("succession", 3)]),
      choice("royal-priority-protection", "Review the household's protection", "You begin with the guards and the safety of people travelling on the house's business.", [royal("security", 6)]),
    ]),
  );

  const adult = age("gte", 16);
  const recurring = (id, title, text, choices, when = adult) => event(id, title, text, { type: "random", weight: 3 }, choices, when, { maxOccurrences: 12, cooldownYears: 5 });
  world.events.push(
    recurring("royal-rival-house", "An invitation from a rival house", "A household with competing connections offers a meeting. Your council sees both an opportunity and a demand on your resources.", [
      choice("royal-rival-host", "Host talks for 45 drachmas", "Your guests leave with an agreement to keep the channels open.", [royal("treasury", -45), royal("influence", 10), royal("security", 2)], atLeast("treasury", 45)),
      choice("royal-rival-letter", "Send a carefully worded reply", "You preserve a polite relationship while postponing the meeting.", [royal("influence", 2), skill("oratory", 1)]),
      choice("royal-rival-decline", "Decline the invitation", "You keep your reserves, but the other house grows more distant.", [royal("influence", -4)]),
    ]),
    recurring("royal-guard-dispute", "The guards bring a dispute", "Two household officers disagree over escorts and gate duties. Both ask the council to settle their responsibilities.", [
      choice("royal-guard-fund", "Fund a new rota for 30 drachmas", "A written rota and fresh equipment help the officers carry out the agreement.", [royal("treasury", -30), royal("security", 10), royal("stability", 2)], atLeast("treasury", 30)),
      choice("royal-guard-mediate", "Mediate without new spending", "You hear both officers and divide the duties more clearly.", [royal("security", 3), royal("influence", -2)]),
    ]),
    recurring("royal-estate-petition", "A petition to the house", "Your steward brings a request for relief from households that depend on the estate. The decision will affect trust and the treasury.", [
      choice("royal-relief-grant", "Grant 40 drachmas of relief", "The steward distributes the agreed support and records the house's response.", [royal("treasury", -40), royal("stability", 10), royal("influence", 3)], atLeast("treasury", 40)),
      choice("royal-relief-hear", "Hear their representatives first", "You arrange a hearing and correct a disputed obligation without promising money.", [royal("stability", 3)]),
      choice("royal-relief-refuse", "Keep the current obligations", "The treasury is protected for now. The petitioners leave dissatisfied.", [royal("stability", -8), royal("influence", -2)]),
    ]),
    recurring("royal-family-precedence", "A disagreement among relatives", "Relatives dispute who should speak for the house and who will hold its records. The quarrel could outlast the present generation.", [
      choice("royal-family-settle", "Record an agreed division of duties", "The family accepts a written account of responsibilities and how they should pass on.", [royal("succession", 8), royal("stability", 4), royal("influence", -2)]),
      choice("royal-family-defer", "Defer the decision", "You avoid a confrontation, but leave the future arrangement uncertain.", [royal("stability", 2), royal("succession", -6)]),
    ]),
    recurring("royal-thin-reserves", "The council warns of thin reserves", "The steward cannot meet every proposed commitment from the house treasury. Your council needs a way to restore reserves.", [
      choice("royal-austerity", "Reduce hospitality and discretionary support", "The house recovers 80 drachmas by cancelling commitments. Its dependants and allies notice the reduction.", [royal("treasury", 80), royal("stability", -12), royal("influence", -8)]),
      choice("royal-emergency-support", "Seek emergency help from allies", "Allies provide 55 drachmas, but you owe them concessions over the house's guard arrangements.", [royal("treasury", 55), royal("influence", -4), royal("security", -5)]),
    ], all(adult, below("treasury", 60))),
    recurring("royal-continuity-question", "Who will keep the house together?", "The elders ask for clearer arrangements for the house's records, property and duties after the current leadership is gone.", [
      choice("royal-continuity-convene", "Convene the relatives for 25 drachmas", "You record an agreed plan for your family's responsibilities. This does not settle the succession to Egypt's throne.", [royal("treasury", -25), royal("succession", 12), royal("stability", 4)], atLeast("treasury", 25)),
      choice("royal-continuity-consult", "Consult each branch of the family", "Private conversations clarify what remains to be agreed.", [royal("succession", 4), royal("influence", -2)]),
    ], all(age("gte", 35), below("succession", 60))),
  );

  // Court introductions use the existing, fictional procedural-person system.
  // Subsequent friendship and romance still require the player's own choices.
  for (const [id, title, text] of [
    ["person-accounts", "A visitor after the council", "An accounts officer from a visiting household stays after the council. Away from the formal session, you have time to introduce yourselves."],
    ["person-library", "A reader at the family gathering", "A reader invited by your relatives joins a family gathering. They ask about the ideas you have been studying."],
    ["person-music", "A guest at the household celebration", "A musician invited to the household celebration sits with the family afterward. You can stay and begin a conversation."],
  ]) {
    world.events.push(event(`royal-meet-${id}`, title, text, { type: "random", weight: 2 }, [
      choice(`royal-greet-${id}`, "Stay and introduce yourself", "You introduce yourselves and make time to talk.", [{ type: "introduce", partner: id }]),
      choice(`royal-leave-${id}`, "Leave the gathering for now", "You leave the introductions for another occasion."),
    ], all(age("gte", 18), { type: "not", condition: { type: "known-partner", partner: id } }), { maxOccurrences: 4, cooldownYears: 4 }));
  }
  world.description = "Live a fictional life near Rhakotis in 350 BCE. Your birth shapes your path: learn a livelihood, build relationships, or guide the council, alliances and succession of a minor royal house.";
  return world;
}
