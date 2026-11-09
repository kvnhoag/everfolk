import { readFileSync } from "node:fs";

// Fictional households on the 350 BCE coast. Relative draw weights, resources
// and rewards are game balance, not estimates of ancient population shares.
const contextSources = JSON.parse(readFileSync(new URL("../research/household-origin-sources.json", import.meta.url), "utf8"));
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const cash = delta => ({ type: "cash", delta });
const choice = (origin, id, text, outcome, effects = []) => ({ id: `${origin}-${id}`, text,
  outcomes: [{ id: `${origin}-${id}-result`, text: outcome, weight: 1, effects }] });
const scene = (title, text, effects = []) => ({ title, text, effects });

const households = [
  {
    id: "royal-household", title: "Royal kin on a coastal estate", weight: 1,
    text: "You are born into a fictional minor branch of Egypt’s native royal family, on a coastal estate near Rhakotis. Relatives and household staff share your care. Your family’s resources depend on lands, obligations and its connections with the ruling house.",
    health: [62, 82], knowledge: [0, 5], wealth: [70, 100], bonds: [45, 70],
    sourceIds: ["household-royal-kin", "household-late-period", "classical-rhakotis"],
    childhood: scene("Visitors at the estate", "A relative receives visitors in the shaded courtyard. You sit with a caregiver behind the gathering and are called forward for a brief greeting.", [stat("bonds", 1)]),
    practice: scene("The family accounts after the conquest", "Egypt’s old royal house has lost power. Your relatives now check the estate’s smaller income closely. An adult lets you count a few deliveries and explains the marks beside each entry.", [skill("reckoning", 3), skill("literacy", 1)]),
    opportunity: {
      title: "A household finding its footing", text: "Your relatives are finding ways to support the estate after the old dynasty’s fall. They offer you a place checking records or a paid errand. You can also make your own plans.",
      choices: [
        choice("royal-household", "check-records", "Learn to check the estate records", "You compare a short list with the deliveries. A relative checks your work and explains each correction.", [skill("reckoning", 5), skill("literacy", 1), stat("knowledge", 1)]),
        choice("royal-household", "carry-messages", "Carry household messages for 20 drachmas", "You deliver the messages and return with the replies. The household pays you for the errand.", [cash(20), skill("oratory", 2)]),
        choice("royal-household", "another-path", "Keep your own plans and help later", "You keep your plans, then help your relatives arrange the next day’s work.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "estate-household", title: "A landowning estate household", weight: 3,
    text: "You are born into a family that owns fields and storage buildings near the coast. Your home has room for visiting relatives, and a caregiver stays with you while adults travel to check supplies and rents.",
    health: [61, 83], knowledge: [0, 4], wealth: [25, 60], bonds: [48, 75],
    sourceIds: ["household-late-period", "household-farming-context", "classical-rhakotis"],
    childhood: scene("A shaded corner of the storeyard", "You play in a shaded corner while adults move sacks into storage. Your caregiver brings you inside before the yard fills with carts.", [stat("bonds", 1)]),
    practice: scene("Checking the stored grain", "A relative lets you count a small row of grain measures. You compare your count with theirs before the containers are closed.", [skill("reckoning", 3), stat("knowledge", 1)]),
    opportunity: {
      title: "An estate delivery to prepare", text: "A delivery needs checking and packing. Your relatives offer a small payment for preparing it, or time learning the accounts. You can leave the work to the regular staff.",
      choices: [
        choice("estate-household", "prepare-delivery", "Prepare the delivery for 30 drachmas", "You check the containers and help prepare the load. Your relative pays you when the delivery leaves.", [cash(30), skill("reckoning", 2)]),
        choice("estate-household", "learn-accounts", "Practise checking the accounts", "You compare quantities with the written list, then review the mistakes with a relative.", [skill("reckoning", 4), skill("literacy", 2), stat("knowledge", 1)]),
        choice("estate-household", "another-path", "Keep your own plans", "You leave the delivery to the household’s regular workers and join your family later.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "temple-household", title: "A temple-service household", weight: 4,
    text: "You are born into a household with relatives who serve a local temple and keep some of its records. Your home is nearby. A grandparent looks after you when duties keep the adults away.",
    health: [60, 81], knowledge: [0, 5], wealth: [8, 22], bonds: [55, 81],
    sourceIds: ["household-temple-family", "household-late-period", "classical-rhakotis"],
    childhood: scene("Waiting for the family meal", "A grandparent keeps you close while relatives finish their temple duties. You help set out cups before everyone gathers for food.", [stat("bonds", 1)]),
    practice: scene("A short list of supplies", "A relative copies a short supply list for you to practise. You compare the marks with the counted items and ask about the ones you do not recognize.", [skill("literacy", 3), skill("reckoning", 1)]),
    opportunity: {
      title: "Supplies for the temple household", text: "Your relatives need help checking supplies and carrying messages. They can pay for an errand or spend time helping you practise a short copy. You can keep to other work.",
      choices: [
        choice("temple-household", "carry-supplies", "Carry the supplies for 20 drachmas", "You bring the supplies to the named recipient and return with the empty containers. Your relative pays you for the task.", [cash(20), skill("reckoning", 2)]),
        choice("temple-household", "practise-copy", "Practise a short supply record", "You copy the list slowly, then check it against the original with an experienced reader.", [skill("literacy", 5), skill("reckoning", 1), stat("knowledge", 1)]),
        choice("temple-household", "another-path", "Keep your own plans and visit afterward", "Another helper takes the supplies. You return in the evening and help prepare food at home.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "soldier-household", title: "A garrison family", weight: 5,
    text: "You are born into a family supported partly by a relative’s military service. Your household rents rooms near the coastal road. Family and neighbors share your care when service keeps an adult away.",
    health: [62, 84], knowledge: [0, 3], wealth: [4, 16], bonds: [50, 79],
    sourceIds: ["household-late-period", "classical-rhakotis"],
    childhood: scene("A relative comes home", "A relative returns after time away on service. You watch them unpack, then sit close while the household shares a meal.", [stat("bonds", 1)]),
    practice: scene("Sorting the household equipment", "An adult lets you sort straps and count pieces of equipment at home. You learn how to check a fastening before putting it away.", [skill("craft", 2), skill("reckoning", 2)]),
    opportunity: {
      title: "Equipment to put in order", text: "Your family has equipment to sort and repair. A relative offers paid preparation work or a supervised practice session with worn straps. You can choose another use for your time.",
      choices: [
        choice("soldier-household", "sort-equipment", "Sort the equipment for 20 drachmas", "You count the pieces and separate the damaged fittings. Your relative pays you for clearing the task.", [cash(20), skill("reckoning", 2)]),
        choice("soldier-household", "repair-straps", "Practise repairing worn straps", "You work on discarded straps while a relative checks the joins and shows you where they are weak.", [skill("craft", 5), stat("knowledge", 1)]),
        choice("soldier-household", "another-path", "Keep your own plans", "Your family arranges other help. You return later and share the evening meal.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "tenant-farming-household", title: "A tenant-farming household", weight: 7,
    text: "You are born into a family cultivating rented land beside the western Delta. Your household also sells produce on the coast near Rhakotis. Relatives take turns watching you while the adults work the fields and make deliveries.",
    health: [61, 83], knowledge: [0, 2], wealth: [0, 7], bonds: [60, 85],
    sourceIds: ["household-farming-context", "classical-rhakotis"],
    childhood: scene("Under the courtyard awning", "You sit with an older relative while baskets are cleaned for the next delivery. They give you a small empty basket to carry across the courtyard.", [stat("bonds", 1)]),
    practice: scene("Measuring a small harvest share", "Your family lets you fill and count a few measures of grain. An adult checks the total before the household sets its share aside.", [skill("reckoning", 3), stat("knowledge", 1)]),
    opportunity: {
      title: "Produce to take to the coast", text: "A relative has produce to deliver near Rhakotis. You can earn a small payment helping with the load, practise checking the measures, or keep your own plans.",
      choices: [
        choice("tenant-farming-household", "help-delivery", "Help with the delivery for 30 drachmas", "You help pack the produce and return the baskets after the sale. Your relative gives you a share of the payment.", [cash(30), skill("reckoning", 2)]),
        choice("tenant-farming-household", "check-measures", "Practise checking the measures", "You compare the filled measures and count them again with a relative before the load leaves.", [skill("reckoning", 5), stat("knowledge", 1)]),
        choice("tenant-farming-household", "another-path", "Keep your own plans and help at home later", "Someone else joins the delivery. You help clean the containers when they return.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "domestic-service-household", title: "A household of hired domestic workers", weight: 5,
    text: "You are born into a family earning wages through cooking, cleaning and other household work. You share a small rented room near your relatives’ employers. A neighbor cares for you when their work hours overlap.",
    health: [60, 80], knowledge: [0, 2], wealth: [0, 5], bonds: [58, 83],
    sourceIds: ["household-late-period", "classical-rhakotis"],
    childhood: scene("Waiting with the neighbor", "You spend the afternoon with a neighbor while your relatives finish their work. They come for you with food saved from their meal.", [stat("bonds", 1)]),
    practice: scene("Checking the household purchases", "A relative takes you on a small purchase and lets you count the change. Back home, you compare the bought items with the list of errands.", [skill("reckoning", 2), skill("literacy", 1)]),
    opportunity: {
      title: "Help with a busy household", text: "A relative’s employer needs extra help preparing a meal. You can take a paid task, practise organizing the purchases, or leave the work to someone else.",
      choices: [
        choice("domestic-service-household", "prepare-meal", "Help prepare the meal for 20 drachmas", "You wash containers, carry supplies and help clear the work space. You receive the agreed payment afterward.", [cash(20), skill("craft", 2)]),
        choice("domestic-service-household", "organize-purchases", "Practise checking the purchases", "You compare the items and costs with your relative, correcting the count before anything is put away.", [skill("reckoning", 4), skill("literacy", 1), stat("knowledge", 1)]),
        choice("domestic-service-household", "another-path", "Keep your own plans and visit later", "Your relative finds another helper. You return later and take care of a few tasks in your own home.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "boatbuilder-household", title: "A boatbuilding household", weight: 4,
    text: "You are born into a family repairing and building small working boats on the coast. Your home stands beside a shared workyard. An older relative keeps you away from the tools while the adults fit timber and mend hulls.",
    health: [62, 84], knowledge: [0, 3], wealth: [3, 12], bonds: [56, 82],
    sourceIds: ["household-late-period", "classical-rhakotis"],
    childhood: scene("Shavings outside the workyard", "You sit with a relative outside the boatyard. They give you a smooth offcut and sweep the sharp shavings away from your feet.", [stat("bonds", 1)]),
    practice: scene("A wooden fitting to check", "A relative shows you how two wooden pieces meet. You practise smoothing a spare fitting and compare its edges with the example.", [skill("craft", 3), skill("carving", 1)]),
    opportunity: {
      title: "A small boat repair", text: "Your family needs help preparing a boat repair. They offer a payment for sorting material or time learning to shape a spare fitting. You can leave the repair to the regular workers.",
      choices: [
        choice("boatbuilder-household", "prepare-materials", "Prepare the materials for 30 drachmas", "You sort the timber and lay out the required pieces. Your relative pays you when the repair is ready to begin.", [cash(30), skill("craft", 2)]),
        choice("boatbuilder-household", "shape-fitting", "Practise shaping a spare fitting", "You shape an offcut under supervision, checking it against the pattern before making another cut.", [skill("carving", 4), skill("craft", 2), stat("knowledge", 1)]),
        choice("boatbuilder-household", "another-path", "Keep your own plans", "The regular workers handle the repair. You stop by later and help put the workyard in order.", [stat("bonds", 2)]),
      ],
    },
  },
  {
    id: "musician-household", title: "A household of traveling musicians", weight: 3,
    text: "You are born into a family earning small payments by performing at gatherings along the coast. Your relatives keep rented rooms near Rhakotis as a home base. Family and trusted neighbors care for you when some adults travel to perform.",
    health: [60, 82], knowledge: [0, 3], wealth: [1, 10], bonds: [57, 84],
    sourceIds: ["household-late-period", "classical-rhakotis"],
    childhood: scene("A tune before the journey", "A relative repeats a tune while packing for a performance. You clap along from your caregiver’s lap and stop when everyone begins to laugh.", [stat("bonds", 1)]),
    practice: scene("Keeping a steady rhythm", "Your relatives let you practise a short rhythm at home. They slow it down and begin again whenever you lose the beat.", [skill("music", 3), stat("knowledge", 1)]),
    opportunity: {
      title: "A family performance to prepare", text: "Your relatives are preparing for a small gathering. You can earn a payment helping carry and arrange their things, rehearse a short part, or keep to your own plans.",
      choices: [
        choice("musician-household", "prepare-gathering", "Help prepare the gathering for 20 drachmas", "You carry the family’s things and help put them in order. Your relatives give you the agreed payment after the gathering.", [cash(20), skill("oratory", 2)]),
        choice("musician-household", "rehearse-part", "Rehearse a short part with the family", "You repeat your part with the group until its entrances are clearer. A relative helps you work through the missed notes.", [skill("music", 5), stat("knowledge", 1)]),
        choice("musician-household", "another-path", "Keep your own plans and hear them afterward", "You keep your plans, then sit with your relatives while they talk about the gathering.", [stat("bonds", 2)]),
      ],
    },
  },
];

export function applyHouseholdOrigins(world) {
  const originalIds = ["merchant-household", "artisan-household", "harbor-household", "fishing-household", "bakery-household", "clerk-household", "weaver-household", "delta-newcomers"];
  for (const id of originalIds) {
    const original = world.origins.find(origin => origin.id === id);
    if (!original) throw new Error(`Household origin expansion is missing ${id}`);
    original.weight *= 4;
  }
  world.version = "0.33.0";
  world.sources ??= [];
  world.sources.push(...contextSources);
  const backgroundEvents = [];
  for (const household of households) {
    if (world.origins.some(origin => origin.id === household.id)) throw new Error(`Household origin already exists: ${household.id}`);
    const { id, title, text, weight, health, knowledge, wealth, bonds, sourceIds } = household;
    world.origins.push({ id, title, text, weight, statRanges: {
      health: { min: health[0], max: health[1] }, knowledge: { min: knowledge[0], max: knowledge[1] },
      wealth: { min: wealth[0], max: wealth[1] }, bonds: { min: bonds[0], max: bonds[1] },
    }, effects: [], evidence: "fictional", sourceIds });
    const when = { type: "origin", origin: id };
    for (const [field, at] of [["childhood", 4], ["practice", 9]]) {
      const event = household[field];
      backgroundEvents.push({ id: `background-${id}-${field}`, title: event.title, text: event.text,
        trigger: { type: "age", at }, when, mode: "automatic", effects: event.effects, choices: [],
        evidence: "fictional", sourceIds });
    }
    const event = household.opportunity;
    backgroundEvents.push({ id: `background-${id}-opportunity`, title: event.title, text: event.text,
      trigger: { type: "age", at: 14 }, when, choices: event.choices, evidence: "fictional", sourceIds });
  }
  const familyTransition = {
    id: "household-royal-patronage-changes", title: "The family’s patronage changes",
    text: "News reaches the estate that Persia has taken Egypt and the old royal house has lost power. Your relatives lose a regular contribution and reduce the household’s spending. The adults explain only part of what has happened; you notice fewer visitors at the courtyard gate.",
    trigger: { type: "year", at: -343 }, when: { type: "origin", origin: "royal-household" },
    mode: "automatic", effects: [cash(-80), stat("bonds", -1)], choices: [], evidence: "fictional",
    sourceIds: ["household-royal-kin", "household-late-period", "classical-egypt-transitions"],
  };
  // Preserve the chronology's leading position and the relative order of old
  // personal events. Each life receives only its own origin's scenes.
  const firstPersonal = world.events.findIndex(event => event.id === "the-first-household");
  world.events.splice(firstPersonal < 0 ? 0 : firstPersonal, 0, familyTransition, ...backgroundEvents.filter(event => event.mode === "automatic"));
  // Keep family offers alongside the existing household queue, after the
  // apprenticeship and ordinary-work decisions rather than ahead of them.
  const lastFamilyOffer = world.events.findLastIndex(event => event.id.startsWith("background-") && event.id.endsWith("-opportunity"));
  world.events.splice(lastFamilyOffer < 0 ? world.events.length : lastFamilyOffer + 1, 0, ...backgroundEvents.filter(event => event.mode !== "automatic"));
}
