// Fictional households and personal scenes. Their weights, ranges and rewards
// are authored game rules, not a reconstruction of Alexandrian demographics.
export function applyBackgroundVariety(world) {
  world.character.playerNames.push(
    "Ammonios", "Andronikos", "Athenodoros", "Diodoros", "Doros", "Eirenaios", "Epimachos", "Hermias",
    "Horus", "Imouthes", "Pachrates", "Panebchounis", "Petosiris", "Psenamounis", "Psais", "Tesenouphis",
  );

  const householdCopy = {
    "merchant-household": "You are born above a small shop near the harbor. Your family sells goods downstairs and sleeps in rooms above it. A relative watches you while the shop is open.",
    "artisan-household": "You are born into a family of pottery workers. Your home shares a courtyard with their workshop. Adults take turns caring for you while clay dries and orders are finished.",
    "harbor-household": "You are born into a family of quay laborers. Your household rents crowded rooms a few streets from the water. Neighbors help with your care when several adults are called to unload a ship.",
  };
  for (const origin of world.origins) origin.text = householdCopy[origin.id] ?? origin.text;
  world.origins.find(origin => origin.id === "artisan-household").title = "A pottery-worker household";
  world.origins.find(origin => origin.id === "harbor-household").title = "A quay-laborer household";

  const origin = (id, title, text, weight, health, knowledge, wealth, bonds, sourceIds) => ({
    id, title, text, weight,
    statRanges: { health: { min: health[0], max: health[1] }, knowledge: { min: knowledge[0], max: knowledge[1] }, wealth: { min: wealth[0], max: wealth[1] }, bonds: { min: bonds[0], max: bonds[1] } },
    effects: [], evidence: "historically-inspired", sourceIds,
  });
  world.origins.push(
    origin("fishing-household", "A fishing household", "You are born near the shore into a family that catches and sells fish. Nets hang outside the doorway. A grandparent cares for you during the early morning trips.", 2,
      [61, 81], [0, 2], [1, 7], [62, 82], ["strabo-alexandria"]),
    origin("bakery-household", "A bakery household", "You are born into a family working in a rented bakery. The ovens are lit before dawn. You sleep in a quieter room with an aunt while the first loaves are made.", 2,
      [60, 80], [0, 3], [4, 12], [57, 77], ["alexandrian-bakery-lease"]),
    origin("clerk-household", "A clerk's household", "You are born into a household supported by paid writing and record keeping. Work tablets and documents are kept out of your reach. Your parents share your care with a nearby relative.", 1,
      [60, 80], [0, 5], [8, 20], [52, 72], ["augustan-alexandria-documents", "education-apprenticeship"]),
    origin("weaver-household", "A weaving household", "You are born into a household that prepares thread and weaves cloth for customers. Work fills part of the main room. Older relatives care for you while the adults finish orders.", 2,
      [60, 80], [0, 2], [2, 9], [60, 80], ["education-apprenticeship", "augustan-alexandria-documents"]),
    origin("delta-newcomers", "Newcomers from the Delta", "You are born in Alexandria shortly after your family moves from a Delta village. They rent a room with relatives and look for steady city work. Food and childcare are shared while they settle in.", 2,
      [62, 82], [0, 2], [2, 8], [64, 84], ["strabo-alexandria", "augustan-alexandria-documents"]),
  );

  const stat = (stat, delta) => ({ type: "stat", stat, delta });
  const skill = (skill, delta) => ({ type: "skill", skill, delta });
  const cash = delta => ({ type: "cash", delta });
  const choice = (id, text, outcome, effects) => ({ id, text, outcomes: [{ id: `${id}-result`, text: outcome, weight: 1, effects }] });
  const scene = (id, title, text, effects, sourceIds = []) => ({ id, title, text, effects, sourceIds });

  const backgrounds = [
    {
      origin: "merchant-household",
      childhood: scene("childhood", "Under the shop counter", "You play with a basket of empty containers while a relative serves customers. They bring you upstairs when the shop gets crowded.", [stat("bonds", 1)], ["augustan-alexandria-documents"]),
      practice: scene("practice", "Counting a small delivery", "Your family lets you count a delivery of jars. You check the total twice and point out one that is cracked.", [skill("reckoning", 3), stat("knowledge", 1)], ["education-apprenticeship"]),
      opportunity: {
        title: "A busy week at the family shop", text: "A relative expects more customers than usual and asks for help. They can pay you for covering the counter or checking deliveries. You can also keep your usual plans.", sourceIds: ["augustan-alexandria-documents"],
        choices: [
          choice("cover-counter", "Cover the counter for extra pay", "You serve customers through the busy part of the day and receive 30 drachmas.", [cash(30), skill("reckoning", 2), stat("bonds", -1)]),
          choice("check-deliveries", "Check the deliveries and accounts", "You compare the delivered goods with the records. Your relative pays you 10 drachmas and shows you how they keep the accounts.", [cash(10), skill("reckoning", 5), skill("literacy", 2)]),
          choice("visit-after-work", "Keep your plans and visit afterward", "Your relative finds someone else to help. You stop by after closing and share a meal.", [stat("bonds", 3)]),
        ],
      },
    },
    {
      origin: "artisan-household",
      childhood: scene("childhood", "Clay in the courtyard", "A relative gives you a lump of spare clay. You flatten it, start again and leave the small shape beside the workshop wall.", [stat("knowledge", 1)], ["alexandrian-terracottas"]),
      practice: scene("practice", "A row of small pots", "You help smooth the rims of small pots. A worker checks each one before it goes onto the drying shelf.", [skill("craft", 2), skill("pottery", 3)], ["education-apprenticeship", "alexandrian-terracottas"]),
      opportunity: {
        title: "A pottery order at home", text: "The family workshop has an order of plain vessels to finish. Your relatives offer paid preparation work or a chance to learn more careful finishing. Neither option changes your regular occupation.", sourceIds: ["education-apprenticeship", "alexandrian-terracottas"],
        choices: [
          choice("prepare-clay", "Prepare the clay for 30 drachmas", "You prepare material and clean the benches. The family pays you 30 drachmas for the extra work.", [cash(30), skill("craft", 2), stat("bonds", -1)]),
          choice("finish-vessels", "Learn to finish the vessels", "You work beside an experienced potter, correcting rims and handles. Most of the time goes into practice.", [skill("pottery", 6), skill("craft", 3), stat("knowledge", 2)]),
          choice("keep-current-work", "Keep to your current work", "You cannot fit in the order. You help put the tools away when you visit later.", [stat("bonds", 2)]),
        ],
      },
    },
    {
      origin: "harbor-household",
      childhood: scene("childhood", "Waiting by the doorway", "You wait with a neighbor while your caregivers finish unloading a ship. They return dusty and bring you something to eat.", [stat("bonds", 1)], ["strabo-alexandria"]),
      practice: scene("practice", "Knots on a spare rope", "A relative shows you a simple knot using a short piece of rope. You practise at home, away from the moving cargo.", [skill("seamanship", 3), skill("craft", 1)], ["strabo-alexandria", "education-apprenticeship"]),
      opportunity: {
        title: "An extra unloading shift", text: "A relative knows a crew that needs help with a delivery. You can carry loads for pay, learn the tally work or turn down the extra shift.", sourceIds: ["strabo-alexandria", "augustan-alexandria-documents"],
        choices: [
          choice("carry-loads", "Carry the loads for 40 drachmas", "You finish the unloading shift and receive 40 drachmas. It leaves less time for your household that day.", [cash(40), skill("craft", 2), stat("bonds", -2)]),
          choice("check-cargo", "Help check the cargo tallies", "You compare marks and quantities with an experienced worker. You earn 10 drachmas while learning the task.", [cash(10), skill("reckoning", 4), skill("literacy", 2)]),
          choice("decline-shift", "Decline the shift and stay home", "You decline the extra work and finish several jobs around the household.", [stat("bonds", 4)]),
        ],
      },
    },
    {
      origin: "fishing-household",
      childhood: scene("childhood", "Nets outside the door", "You sit beside a grandparent while they mend a net. They keep the needles away from you and let you gather the loose pieces of cord.", [stat("bonds", 1)], ["strabo-alexandria"]),
      practice: scene("practice", "Sorting the morning catch", "You help sort fish on shore and count the baskets for sale. A relative shows you which damaged net sections need repair.", [skill("seamanship", 3), skill("reckoning", 1)], ["strabo-alexandria", "education-apprenticeship"]),
      opportunity: {
        title: "The family's fish delivery", text: "Your family has a large catch to sell. They offer you a share for helping at the stall, or you can stay near home and work on the nets.", sourceIds: ["strabo-alexandria"],
        choices: [
          choice("sell-catch", "Help sell the catch for 30 drachmas", "You sort baskets and serve customers until the fish are sold. Your share is 30 drachmas.", [cash(30), skill("reckoning", 2), stat("bonds", -1)]),
          choice("mend-nets", "Mend the nets with a relative", "You replace damaged cord and practise the knots that keep the net even.", [skill("seamanship", 5), skill("craft", 3), stat("bonds", 2)]),
          choice("keep-plans", "Keep your existing plans", "The family divides the work among the people already available. You visit after the delivery.", [stat("bonds", 1)]),
        ],
      },
    },
    {
      origin: "bakery-household",
      childhood: scene("childhood", "The first loaves of the day", "You wake while the bakery is already working. An aunt takes you into the courtyard with breakfast while the ovens are busy.", [stat("bonds", 1)], ["alexandrian-bakery-lease"]),
      practice: scene("practice", "Counting loaves on a tray", "You count finished loaves and help clear a cool work surface. The adults keep you away from the hot oven.", [skill("reckoning", 2), skill("craft", 2)], ["alexandrian-bakery-lease", "education-apprenticeship"]),
      opportunity: {
        title: "A larger bakery order", text: "The bakery has accepted a larger order. A relative offers you paid delivery work or a slower session learning how quantities and orders are checked.", sourceIds: ["alexandrian-bakery-lease"],
        choices: [
          choice("deliver-loaves", "Deliver the loaves for 30 drachmas", "You make several deliveries and return the baskets. The bakery pays you 30 drachmas.", [cash(30), skill("reckoning", 2), stat("bonds", -1)]),
          choice("check-orders", "Learn the measurements and order lists", "You compare measures and quantities with a relative, then help check the written orders.", [skill("reckoning", 5), skill("literacy", 2), stat("knowledge", 2)]),
          choice("share-meal", "Visit after the order is finished", "You keep your usual work and join the family for food after the bakery closes.", [stat("bonds", 3)]),
        ],
      },
    },
    {
      origin: "clerk-household",
      childhood: scene("childhood", "A space beside the writing table", "You sit beside a relative working on a document. They give you a blank scrap to draw on and move the finished pages out of reach.", [stat("knowledge", 1)], ["augustan-alexandria-documents"]),
      practice: scene("practice", "Copying a short list", "A relative writes a short list for you to copy. They check the letters and let you try again when you reverse one.", [skill("literacy", 3), skill("reckoning", 1)], ["education-apprenticeship"]),
      opportunity: {
        title: "Extra documents at home", text: "A relative has more documents to prepare than they can finish alone. You can help carry completed pages, practise checking a simple copy or leave them to arrange other help.", sourceIds: ["augustan-alexandria-documents", "education-apprenticeship"],
        choices: [
          choice("deliver-documents", "Deliver the documents for 20 drachmas", "You deliver the pages to the named recipients and bring back acknowledgments. Your relative pays you 20 drachmas.", [cash(20), skill("oratory", 2), stat("bonds", -1)]),
          choice("check-copy", "Practise checking a simple copy", "You compare two short copies with a relative. They explain the mistakes you missed.", [skill("literacy", 5), skill("reckoning", 3), stat("knowledge", 2)]),
          choice("keep-own-work", "Keep to your own work", "Your relative asks another reader for help. You bring food when you visit in the evening.", [stat("bonds", 3)]),
        ],
      },
    },
    {
      origin: "weaver-household",
      childhood: scene("childhood", "Thread across the room", "You watch a relative prepare thread. They give you a short offcut to play with and lift you away when you reach for the working loom.", [stat("bonds", 1)], ["education-apprenticeship"]),
      practice: scene("practice", "Preparing the next bundle", "You help sort thread and wind a small bundle. A relative checks the tension and shows you how to undo a tangle without pulling it tight.", [skill("craft", 3), skill("reckoning", 1)], ["education-apprenticeship"]),
      opportunity: {
        title: "A cloth order to finish", text: "Your relatives have cloth to prepare for a customer. They offer paid finishing work, or you can spend time learning how the pieces are measured and checked.", sourceIds: ["education-apprenticeship", "augustan-alexandria-documents"],
        choices: [
          choice("finish-order", "Help finish the order for 30 drachmas", "You trim loose threads, fold the finished cloth and prepare it for delivery. Your share is 30 drachmas.", [cash(30), skill("craft", 2), stat("bonds", -1)]),
          choice("measure-cloth", "Practise measuring and checking the cloth", "A relative helps you measure the pieces and find flaws before they are packed.", [skill("craft", 5), skill("reckoning", 3), stat("knowledge", 1)]),
          choice("keep-time-home", "Keep the time for your household", "Your relatives arrange other help. You use the time for repairs and errands at home.", [stat("bonds", 3)]),
        ],
      },
    },
    {
      origin: "delta-newcomers",
      childhood: scene("childhood", "Relatives arriving from the Delta", "Relatives visit from your family's old village. The rented room fills with bags, food and people finding places to sit. You stay close to the adults you know.", [stat("bonds", 2)], ["strabo-alexandria"]),
      practice: scene("practice", "Learning the city errands", "An older cousin takes you to the market and the quays. On the return trip, they let you lead the way and check a small purchase.", [skill("reckoning", 2), stat("knowledge", 2)], ["strabo-alexandria"]),
      opportunity: {
        title: "A delivery for relatives", text: "Relatives from the Delta need help getting a delivery to a city buyer. They offer a payment for handling the sale, or you can use the visit to learn their delivery records.", sourceIds: ["strabo-alexandria", "augustan-alexandria-documents"],
        choices: [
          choice("handle-delivery", "Help complete the delivery for 30 drachmas", "You meet the buyer, check the delivered goods and return the containers. Your relatives give you 30 drachmas.", [cash(30), skill("reckoning", 2), stat("bonds", -1)]),
          choice("learn-records", "Help with the delivery records", "A relative explains the measures and marks used for the shipment. You practise checking the quantities.", [skill("reckoning", 5), skill("literacy", 2), stat("knowledge", 1)]),
          choice("host-relatives", "Help host the visiting relatives", "Someone else handles the delivery. You find sleeping space, collect food and spend the evening with the visitors.", [stat("bonds", 4)]),
        ],
      },
    },
  ];

  const backgroundEvents = [];
  for (const background of backgrounds) {
    const when = { type: "origin", origin: background.origin };
    for (const [field, at] of [["childhood", 4], ["practice", 9]]) {
      const event = background[field];
      backgroundEvents.push({ id: `background-${background.origin}-${event.id}`, title: event.title, text: event.text,
        trigger: { type: "age", at }, when, mode: "automatic", effects: event.effects, choices: [],
        evidence: "fictional", sourceIds: event.sourceIds });
    }
    const event = background.opportunity;
    backgroundEvents.push({ id: `background-${background.origin}-opportunity`, title: event.title, text: event.text,
      trigger: { type: "age", at: 22 }, when, choices: event.choices,
      evidence: "fictional", sourceIds: event.sourceIds });
  }
  // Personal scheduled decisions use declaration order. Put the origin's adult
  // contact before the old personal queue so it is offered in early adulthood,
  // rather than waiting behind unrelated milestones. Political anchors retain
  // their existing leading position, and old events retain their relative order.
  const firstPersonalEvent = world.events.findIndex(event => event.id === "the-first-household");
  world.events.splice(firstPersonalEvent < 0 ? 0 : firstPersonalEvent, 0, ...backgroundEvents);
}
