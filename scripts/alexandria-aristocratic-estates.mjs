// Fictional landowning households: authored estate gameplay, not measured class
// frequencies, historical rent schedules, or a claim to royal ancestry.
const all = (...conditions) => ({ type: "all", conditions });
const age = (op, value) => ({ type: "age", op, value });
const estate = (metric, delta) => ({ type: "aristocrat", metric, delta });
const threshold = (metric, op, value) => ({ type: "aristocrat", metric, op, value });
const cash = value => threshold("treasury", "gte", value);
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const choice = (id, text, result, effects = [], when) => ({ id, text, ...(when ? { when } : {}), outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }] });
const event = (id, title, text, trigger, choices, when, extra = {}) => ({
  id, title, text, trigger, choices, audience: "aristocrat", evidence: "fictional", sourceIds: [], ...(when ? { when } : {}), ...extra,
});

export function applyAristocraticEstates(world) {
  world.version = "0.45.0";
  world.aristocracy = {
    originId: "estate-household", minAge: 16,
    metrics: {
      treasury: { label: "Estate treasury", min: 0, max: 1000000, initial: 600 },
      standing: { label: "Local standing", min: 0, max: 100, initial: 45 },
      prosperity: { label: "Estate prosperity", min: 0, max: 100, initial: 55 },
      loyalty: { label: "Tenant loyalty", min: 0, max: 100, initial: 60 },
      inheritance: { label: "Inheritance readiness", min: 0, max: 100, initial: 20 },
    },
    yearlyEffects: [
      { metric: "treasury", delta: 25 }, { metric: "standing", delta: -1 },
      { metric: "prosperity", delta: -1 }, { metric: "loyalty", delta: -1 }, { metric: "inheritance", delta: -0.5 },
    ],
  };
  // Integer weights retain the relative balance among all ordinary origins.
  // 96 ordinary units * 23 + 144 aristocratic + 48 royal = 2400 units.
  for (const origin of world.origins) origin.weight = origin.id === "royal-household" ? 48 : origin.id === "estate-household" ? 144 : origin.weight * 23;
  const natal = world.origins.find(origin => origin.id === "estate-household");
  natal.title = "An aristocratic estate household";
  natal.text = "You are born into a fictional landowning aristocratic household with fields and storage buildings near the coast. Relatives and household staff share your care. As you grow, you will guide estate improvements, tenant agreements, patronage and the family's inheritance. Aristocratic birth does not make you royal.";
  for (const suffix of ["childhood", "practice"]) world.events.find(item => item.id === `background-estate-household-${suffix}`).audience = "aristocrat";
  const practice = world.events.find(item => item.id === "background-estate-household-practice");
  practice.title = "The steward explains the estate";
  practice.text = "A steward shows you a small map of the fields and explains the agreements with tenant households. You compare the marks with the places you have visited, then listen as your relatives ask what needs repairing.";
  practice.effects = [skill("reckoning", 3), skill("literacy", 1), stat("knowledge", 1)];

  function action(id, text, result, effects, cost = 0, minAge = 16) {
    return { ...choice(id, text, result, effects, cost ? cash(cost) : undefined), audience: "aristocrat", category: "career", minAge, cooldownYears: 1 };
  }
  world.character.activities.push(
    action("aristocrat-meet-stewards", "Review the estate with your stewards", "You hear the stewards' reports and agree which repairs and tenant concerns need attention first.", [estate("prosperity", 3), estate("loyalty", 3)]),
    action("aristocrat-improve-irrigation", "Invest in irrigation and storage", "You allocate 60 drachmas to clearing water channels and repairing storage. Stewards oversee the work on your behalf.", [estate("treasury", -60), estate("prosperity", 12)], 60),
    action("aristocrat-settle-tenancy", "Settle tenancy disputes and grant relief", "You spend 25 drachmas resolving a disputed obligation and supporting tenant households through an immediate difficulty.", [estate("treasury", -25), estate("loyalty", 12), estate("standing", 2)], 25),
    action("aristocrat-host-patrons", "Host neighbouring patrons", "You spend 40 drachmas hosting influential neighbours. The gathering strengthens local ties without creating a royal court appointment.", [estate("treasury", -40), estate("standing", 10)], 40),
    action("aristocrat-collect-rents", "Press for outstanding rents", "Your steward collects 60 drachmas already owed. The firmer demand strains tenant loyalty and leaves less for improvements.", [estate("treasury", 60), estate("loyalty", -6), estate("prosperity", -2)]),
    action("aristocrat-plan-inheritance", "Record the family's inheritance agreements", "You allocate 25 drachmas to a family meeting and written agreements about property and responsibilities. The plan helps keep the estate together.", [estate("treasury", -25), estate("inheritance", 14), estate("loyalty", 2)], 25),
    action("aristocrat-study-estates", "Study estate affairs with a tutor", "Your tutor helps you compare a field record with its written obligations and explain a disagreement. The household provides the lesson.", [skill("reckoning", 3), skill("literacy", 2), stat("knowledge", 1)], 0, 8),
    action("aristocrat-sponsor-festival", "Sponsor a local gathering", "You contribute 35 drachmas to a gathering supported by neighbouring households. Your estate's dependants see the family taking part in local obligations.", [estate("treasury", -35), estate("loyalty", 6), estate("standing", 5)], 35),
  );
  world.yearlyRules.push(
    { id: "aristocrat-prosperous-estate", audience: "aristocrat", when: all(age("gte", 16), threshold("prosperity", "gte", 70)), effects: [estate("treasury", 20)] },
    { id: "aristocrat-neglected-estate", audience: "aristocrat", when: all(age("gte", 16), threshold("prosperity", "lt", 25)), effects: [estate("treasury", -20), estate("loyalty", -2)] },
    { id: "aristocrat-unsettled-tenants", audience: "aristocrat", when: all(age("gte", 16), threshold("loyalty", "lt", 25)), effects: [estate("treasury", -15), estate("prosperity", -2)] },
    { id: "aristocrat-isolated-family", audience: "aristocrat", when: all(age("gte", 16), threshold("standing", "lt", 20)), effects: [estate("treasury", -10)] },
    { id: "aristocrat-divided-inheritance", audience: "aristocrat", when: all(age("gte", 40), threshold("inheritance", "lt", 25)), effects: [estate("loyalty", -2), estate("standing", -1)] },
    { id: "aristocrat-empty-reserves", audience: "aristocrat", when: all(age("gte", 16), threshold("treasury", "lt", 30)), effects: [estate("prosperity", -2), estate("loyalty", -2)] },
  );
  world.events.push(
    event("aristocrat-family-visitors", "Neighbours visit the estate", "Your caregiver brings you to a quiet family gathering. The visitors greet you before the adults return to their conversation.", { type: "age", at: 3 }, [
      choice("aristocrat-greet-neighbours", "Greet the visitors with your caregiver", "You repeat the greeting and listen as familiar people introduce the visitors.", [stat("bonds", 2)]),
      choice("aristocrat-listen-neighbours", "Watch the gathering quietly", "You watch the visitors take turns speaking and ask your caregiver about them afterward.", [stat("knowledge", 1)]),
    ]),
    event("aristocrat-first-tutor", "Lessons at the family estate", "Your relatives arrange lessons in reading and counting. Your tutor offers two short exercises to begin with.", { type: "age", at: 6 }, [
      choice("aristocrat-copy-record", "Copy a short family record", "You practise the names and marks with your tutor's help.", [skill("literacy", 5), stat("knowledge", 1)]),
      choice("aristocrat-count-measures", "Compare two sets of measures", "You count carefully, then explain where the two sets differ.", [skill("reckoning", 5), stat("knowledge", 1)]),
    ]),
    event("aristocrat-listen-stewards", "Listening to the estate's reports", "You sit beside a relative while the stewards explain their work. Your family asks what you would like to understand better.", { type: "age", at: 12 }, [
      choice("aristocrat-ask-fields", "Ask what the fields and stores need", "The steward explains which repairs protect the next season's resources.", [estate("prosperity", 3), skill("reckoning", 3)]),
      choice("aristocrat-ask-tenants", "Ask about the tenant households", "You hear how families understand their obligations and what they need from the estate.", [estate("loyalty", 3), skill("oratory", 3)]),
    ]),
    event("aristocrat-first-responsibility", "A voice in the estate council", "Your family gives you responsibility for choosing estate priorities. Stewards handle ordinary purchases and labour; you guide investment, tenant agreements and family obligations.", { type: "age", at: 16 }, [
      choice("aristocrat-priority-repairs", "Start with the estate's repairs", "You ask the stewards to explain the most important improvements.", [estate("prosperity", 6)]),
      choice("aristocrat-priority-tenants", "Start by hearing tenant concerns", "You arrange a hearing and clarify the agreements under dispute.", [estate("loyalty", 6)]),
      choice("aristocrat-priority-patrons", "Start with local patrons", "You renew introductions with neighbouring families.", [estate("standing", 6)]),
    ]),
  );
  const adult = age("gte", 16);
  const recurring = (id, title, text, choices, when = adult) => event(id, title, text, { type: "random", weight: 3 }, choices, when, { maxOccurrences: 12, cooldownYears: 5 });
  world.events.push(
    recurring("aristocrat-water-agreement", "A water agreement needs renewing", "Neighbouring landholders and tenant representatives disagree about the clearing of a shared channel. Your stewards ask what support the estate should provide.", [
      choice("aristocrat-fund-channel", "Contribute 50 drachmas to repairs", "The estate funds its share of the work and records an agreement for future upkeep.", [estate("treasury", -50), estate("prosperity", 10), estate("loyalty", 4)], cash(50)),
      choice("aristocrat-negotiate-channel", "Negotiate duties before committing funds", "You clarify responsibilities and arrange a smaller first stage of work.", [estate("prosperity", 3), estate("standing", -2)]),
    ]),
    recurring("aristocrat-tenant-petition", "Tenants ask for a hearing", "A group of tenant households petitions the estate over obligations they say were counted twice. Both sides bring records.", [
      choice("aristocrat-hear-records", "Hear both sides and correct the record", "You ask the steward to compare the accounts openly and remove the duplicated demand.", [estate("loyalty", 7), estate("standing", 2)]),
      choice("aristocrat-demand-payment", "Uphold the steward's demand", "The steward collects 30 drachmas, but the unresolved complaint spreads among tenant households.", [estate("treasury", 30), estate("loyalty", -8)]),
    ]),
    recurring("aristocrat-patron-request", "A patron asks for your support", "A neighbouring family asks your household to help fund a local gathering. Your name would be recorded among its supporters.", [
      choice("aristocrat-support-patron", "Contribute 35 drachmas", "Your family shares the cost and strengthens its standing among its neighbours.", [estate("treasury", -35), estate("standing", 8), estate("loyalty", 3)], cash(35)),
      choice("aristocrat-attend-patron", "Attend without promising money", "You maintain the acquaintance while keeping the estate's reserves.", [estate("standing", 2)]),
    ]),
    recurring("aristocrat-storage-damage", "The steward reports damaged storage", "Rain has exposed a weak section of an estate storehouse. Your officers propose repairs before more goods are damaged.", [
      choice("aristocrat-repair-storage", "Approve 45 drachmas for repairs", "The repairs protect the stores and make the next deliveries easier to handle.", [estate("treasury", -45), estate("prosperity", 9)], cash(45)),
      choice("aristocrat-move-stores", "Move the goods and delay repairs", "The goods are sheltered temporarily, but the estate remains harder to manage.", [estate("prosperity", -5), estate("loyalty", -2)]),
    ]),
    recurring("aristocrat-inheritance-dispute", "Relatives disagree over the estate", "Two branches of your family expect different arrangements for the fields and household records. An unresolved dispute could divide the estate.", [
      choice("aristocrat-inheritance-meeting", "Bring the family together for 25 drachmas", "You record agreed responsibilities and clarify what remains to be decided.", [estate("treasury", -25), estate("inheritance", 12), estate("loyalty", 3)], cash(25)),
      choice("aristocrat-inheritance-consult", "Consult each branch separately", "The relatives explain their expectations before you draft a fuller agreement.", [estate("inheritance", 4), estate("standing", -2)]),
    ], all(age("gte", 35), threshold("inheritance", "lt", 60))),
    recurring("aristocrat-thin-reserves", "The estate has little in reserve", "Your stewards cannot fund every obligation from the estate treasury. You must choose where to restore reserves.", [
      choice("aristocrat-cut-hospitality", "Reduce hospitality and patronage", "The estate recovers 70 drachmas by cancelling discretionary commitments. Local standing suffers.", [estate("treasury", 70), estate("standing", -8)]),
      choice("aristocrat-demand-arrears", "Collect more outstanding rents", "The stewards recover 60 drachmas, at a cost to tenant trust and the estate's working resources.", [estate("treasury", 60), estate("loyalty", -10), estate("prosperity", -4)]),
    ], all(adult, threshold("treasury", "lt", 60))),
  );
  for (const [id, title, text] of [
    ["person-accounts", "A neighbouring steward visits", "A steward from a neighbouring household stays after the estate meeting. You can introduce yourselves away from the formal reports."],
    ["person-garden", "A visitor walks through the estate", "A guest with an interest in growing plants joins the family in the shaded garden. There is time to talk before they leave."],
    ["person-music", "Company after the local gathering", "A musician invited by a neighbouring patron joins the household after the gathering. You can introduce yourselves over the evening meal."],
  ]) world.events.push(event(`aristocrat-meet-${id}`, title, text, { type: "random", weight: 2 }, [
    choice(`aristocrat-introduce-${id}`, "Stay and introduce yourself", "You introduce yourselves and make time for a conversation.", [{ type: "introduce", partner: id }]),
    choice(`aristocrat-leave-${id}`, "Leave the conversation for another time", "You take your leave without making a new acquaintance."),
  ], all(age("gte", 18), { type: "not", condition: { type: "known-partner", partner: id } }), { maxOccurrences: 4, cooldownYears: 4 }));
  world.description = "Live a fictional life near Rhakotis in 350 BCE. Birth shapes your path: build a livelihood, guide an aristocratic estate, or manage the council and alliances of a minor royal house.";
  return world;
}
