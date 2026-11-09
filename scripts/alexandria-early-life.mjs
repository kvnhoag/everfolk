// Opening alternatives are authored fiction, not a standard ancient childhood.
// Exclusive groups provide one seeded scenario per stage, rather than a queue
// containing every version of the same opportunity.
const all = (...conditions) => ({ type: "all", conditions });
const age = (op, value) => ({ type: "age", op, value });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const flag = (flag, value = true) => ({ type: "flag", flag, value });
const cash = delta => ({ type: "cash", delta });
const one = (id, text, result, effects = [], when) => ({ id, text, ...(when ? { when } : {}),
  outcomes: [{ id: `${id}-result`, text: result, weight: 1, effects }] });
const noOffer = (id, text = "Pass on these offers") => one(id, text,
  "You pass on the offers and return to the tasks already arranged for you.");

export const EARLY_LIFE_GROUPS = {
  "early-care": { age: 3, original: "a-child-in-the-courtyard" },
  "early-learning": { age: 6, original: "the-first-letters" },
  "early-training": { age: 12, original: "a-place-to-learn" },
  "early-wages": { age: 14, original: "the-first-wages" },
  "early-work": { age: 16, original: "a-place-on-the-manifest" },
};

export function applyEarlyLife(world) {
  const added = [];
  const group = (name, id, title, text, choices) => {
    added.push({ id, title, text, exclusiveGroup: name, trigger: { type: "age", at: EARLY_LIFE_GROUPS[name].age },
      maxOccurrences: 1, evidence: "fictional", sourceIds: [], choices });
  };
  // Qualifications come from the same job definitions used by the Skills and
  // Career panels. A variant never hands out a job that this person cannot do.
  const startJob = (jobId, id, text, result) => {
    const definition = world.character.jobs.find(item => item.id === jobId);
    if (!definition) throw new Error(`Missing early-life job ${jobId}`);
    const conditions = [age("gte", definition.minAge), { type: "not", condition: { type: "job", job: jobId } },
      ...Object.entries(definition.requirements ?? {}).map(([skill, value]) => ({ type: "skill", skill, op: "gte", value }))];
    const facts = jobId === "apprentice" ? [flag("apprenticed")] : jobId === "sailor" ? [flag("sailed")]
      : [flag(["clerk", "copyist"].includes(jobId) ? "studied" : "stayed")];
    return one(id, text, result, [{ type: "job", job: jobId }, flag("retired", false), ...facts], all(...conditions));
  };
  const apprentice = (id, text, result, gains = []) => {
    const choice = startJob("apprentice", id, text, result);
    choice.outcomes[0].effects.push(...gains);
    return choice;
  };

  group("early-care", "early-care-market-morning", "A morning at the market",
    "Your usual carer has a morning of shopping ahead. The household decides whether you will go along or stay with a relative nearby.", [
      one("early-care-go-market", "Your carer takes you along", "You stay close while your carer shops. They name things you point at and let you carry a small empty basket.", [stat("knowledge", 2), stat("bonds", 1)]),
      one("early-care-stay-relative", "A relative looks after you at home", "A relative stays with you and brings out a box of safe odds and ends. You sort them on the floor until the shopping is finished.", [stat("bonds", 3)]),
    ]);
  group("early-care", "early-care-visitors", "Visitors fill the room",
    "Visitors arrive while the household is getting food ready. Your caregivers need somewhere to settle you while the room is crowded.", [
      one("early-care-help-table", "Keep you beside the adults", "You pass unbreakable things to a familiar adult and repeat the visitors' names. Someone catches the cup you almost tip over.", [stat("bonds", 2), stat("knowledge", 1)]),
      one("early-care-quiet-play", "Arrange quiet play in the next room", "An older child sits with you in a quieter room. You make a row of wooden pieces while they keep the small ones out of reach.", [stat("knowledge", 2), stat("bonds", 1)]),
    ]);
  group("early-care", "early-care-restless-afternoon", "Too restless to settle",
    "You keep interrupting while the adults sort household supplies. Your caregivers try to find something that will hold your attention.", [
      one("early-care-sorting-game", "Turn the sorting into a game", "An adult gives you large empty containers to put in a row. You copy their arrangement and proudly start over when it falls down.", [stat("knowledge", 2)]),
      one("early-care-outside-song", "Take you outside for a song and a walk", "A familiar adult walks with you outside and repeats a song you like. You return tired enough to sit through the rest of the task.", [stat("bonds", 3)]),
    ]);

  group("early-learning", "early-learning-shop-marks", "The marks on the jars",
    "You ask why the jars at a nearby shop carry different marks. A worker offers to explain a few of them while the shop is quiet.", [
      one("early-jars-read-labels", "Learn to recognize and copy the letters", "You copy a few letters beside the jars and practise finding them again in a short list.", [flag("literate"), skill("literacy", 10), stat("knowledge", 8)]),
      one("early-jars-count-stock", "Learn to count what is inside", "The worker helps you count small batches and compare the numbers with the marks on the jars.", [skill("reckoning", 8), stat("knowledge", 5)]),
      one("early-jars-make-stoppers", "Help fit wooden stoppers instead", "You compare the jar openings and smooth the edges of a few spare stoppers under the worker's eye.", [skill("craft", 6), stat("knowledge", 4)]),
    ]);
  group("early-learning", "early-learning-model-boat", "A little boat on the ground",
    "A neighbor repairs a small model boat outside your door. You stop to watch, and they offer to show you one part of the work.", [
      one("early-boat-knots", "Practise the simple knots", "You tie short lengths of spare cord until the knots hold. The neighbor explains which ones come undone easily.", [skill("seamanship", 8), skill("craft", 3), stat("knowledge", 4)]),
      one("early-boat-letters", "Copy the letters on a boat name", "The neighbor finds someone who can explain the letters. You copy them and learn to recognize the same shapes elsewhere.", [flag("literate"), skill("literacy", 10), stat("knowledge", 8)]),
      one("early-boat-pieces", "Sort and count the spare pieces", "You count pegs and place the matching pieces together. The neighbor checks your piles before putting them away.", [skill("reckoning", 6), stat("bonds", 2)]),
    ]);
  group("early-learning", "early-learning-clay-scrap", "Something to make your own",
    "A workshop worker gives you a scrap of clay and offers to help with a small project. Your household can spare the afternoon.", [
      one("early-clay-letter", "Press and copy a few letters", "A reader draws a few letters for you to press into the clay. You wipe the first attempt and make a clearer copy.", [flag("literate"), skill("literacy", 10), stat("knowledge", 8)]),
      one("early-clay-counters", "Make counters and practise small sums", "You make a handful of counters. A worker uses them to show how to split a small group into equal parts.", [skill("reckoning", 8), stat("knowledge", 5)]),
      one("early-clay-container", "Shape a little container", "You pinch up a small container and smooth the thick parts. It dries unevenly, but the worker explains what to change next time.", [skill("craft", 6), skill("pottery", 2), stat("knowledge", 3)]),
    ]);

  group("early-training", "early-training-merchants-list", "A merchant needs a second pair of eyes",
    "A merchant who knows your household offers supervised work with stock and simple records. There is also a place preparing materials at a nearby workshop.", [
      one("early-training-check-list", "Learn to check the stock list", "You compare a short list with the goods, then practise writing the corrected quantities.", [flag("literate"), skill("literacy", 10), skill("reckoning", 6), stat("knowledge", 6)]),
      apprentice("early-training-preparation", "Start the workshop apprenticeship", "You begin preparing materials and checking simple measurements for a craft worker.", [skill("craft", 8), stat("knowledge", 4)]),
      one("early-training-count-goods", "Take a short stock-counting task for 10 drachmas", "You count a small group of goods with a worker checking each batch. The merchant pays your household 10 drachmas.", [cash(10), skill("reckoning", 6)]),
      noOffer("early-training-decline-list"),
    ]);
  group("early-training", "early-training-repair-yard", "Room at the repair bench",
    "A repair yard has room for someone to prepare cord, wooden pieces and small fittings. A worker offers to teach you alongside the ordinary tasks.", [
      apprentice("early-training-cord-bench", "Take the place at the bench", "You start supervised bench work, preparing cord and wooden pieces before trying small repairs.", [skill("craft", 8), skill("seamanship", 5), stat("knowledge", 3)]),
      one("early-training-yard-messages", "Learn to handle the yard's written messages", "You practise reading short requests and copying names while a reader checks your work.", [flag("literate"), skill("literacy", 10), stat("knowledge", 6)]),
      one("early-training-yard-errands", "Help with local errands instead", "You carry messages and light supplies between nearby workshops. The household saves some of the money it would have spent on other help.", [cash(10), stat("bonds", 2), skill("reckoning", 3)]),
      noOffer("early-training-decline-yard"),
    ]);
  group("early-training", "early-training-potters-bench", "A place near the potter's bench",
    "A pottery worker needs help preparing the bench and keeping orders separate. You can learn the workshop tasks or spend the time on its written records.", [
      apprentice("early-training-pottery-apprentice", "Begin an apprenticeship preparing clay and tools", "You begin with clay preparation, clean tools and small supervised pieces. The worker checks each stage before giving you another task.", [skill("craft", 8), skill("pottery", 4), stat("knowledge", 3)]),
      one("early-training-pottery-records", "Practise the order records", "You copy short order notes and check quantities with a reader. The workshop sets aside the mistakes for you to try again.", [flag("literate"), skill("literacy", 10), skill("reckoning", 4), stat("knowledge", 5)]),
      one("early-training-pottery-home", "Keep helping your household", "You leave the workshop place for someone else and take over more small purchases and household repairs.", [cash(10), stat("bonds", 2), skill("craft", 2)]),
      noOffer("early-training-decline-potter"),
    ]);

  group("early-wages", "early-wages-shop-help", "Help wanted in a busy shop",
    "A shop is taking on help with deliveries and records. The work available to you depends on the reading and counting you have learned.", [
      startJob("clerk", "early-wages-clerk", "Take regular work checking the accounts", "You begin regular work checking a merchant's lists and small accounts."),
      startJob("porter", "early-wages-shop-porter", "Take regular delivery work on the quays", "You join the quay workers carrying and sorting cargo for local deliveries."),
      one("early-wages-shop-parcel", "Carry a small parcel for 10 drachmas", "You deliver the parcel and return with the recipient's acknowledgment. The shop pays you 10 drachmas.", [cash(10), skill("reckoning", 2)]),
      noOffer("early-wages-decline-shop"),
    ]);
  group("early-wages", "early-wages-kiln-order", "A large order of everyday pots",
    "A pottery workshop has more work than its usual helpers can finish. It offers regular work to someone with the right training, or a small preparation task.", [
      startJob("potter", "early-wages-potter", "Take regular work as a potter", "You begin regular work shaping and finishing everyday vessels in the workshop."),
      apprentice("early-wages-kiln-apprentice", "Take an apprenticeship preparing materials", "You start supervised preparation work and learn the tools used around the bench.", [skill("craft", 3)]),
      one("early-wages-kiln-preparation", "Prepare packing and clear benches for 10 drachmas", "You prepare soft packing, sweep the benches and keep the finished pots separate. The workshop pays you 10 drachmas.", [cash(10), skill("craft", 2)]),
      noOffer("early-wages-decline-kiln"),
    ]);
  group("early-wages", "early-wages-quay-delivery", "A delivery crew needs help",
    "Several small deliveries are waiting at the quays. A crew offers regular porter work, while a repair worker nearby has a short task preparing cord.", [
      startJob("porter", "early-wages-quay-porter", "Join the regular porter crew", "You join the crew carrying and sorting cargo between the quays and nearby stores."),
      one("early-wages-cord-work", "Prepare cord for 10 drachmas", "You cut and coil cord under a repair worker's supervision. They pay you 10 drachmas and show you which knots to practise.", [cash(10), skill("seamanship", 4), skill("craft", 2)]),
      one("early-wages-check-loads", "Help check the delivered quantities", "A worker checks the delivered bundles with you and shows how to catch a repeated entry.", [skill("reckoning", 5), stat("knowledge", 3)]),
      noOffer("early-wages-decline-quay"),
    ]);

  group("early-work", "early-work-harbor-crew", "A crew is preparing to leave",
    "A merchant crew is preparing to sail. It can use a trained sailor; work on the quays remains available if you prefer to stay nearby.", [
      startJob("sailor", "early-work-join-crew", "Take a sailor's place with the crew", "You join the merchant crew and begin the shipboard work you have trained for."),
      startJob("porter", "early-work-quay-place", "Take regular porter work near home", "You take a place carrying and sorting cargo on the quays, close enough to return home after work."),
      one("early-work-practise-cord", "Keep learning knots before seeking shipboard work", "You stay ashore and practise the knots and rope handling used by the crew.", [skill("seamanship", 5), stat("knowledge", 2)]),
      noOffer("early-work-decline-crew", "Keep your present arrangements"),
    ]);
  group("early-work", "early-work-workshop-orders", "Two workshops are taking orders",
    "A potter and a copyist each need another worker. You can ask for a qualified place, start supervised preparation work or keep your present arrangements.", [
      startJob("potter", "early-work-pottery-place", "Take the potter's place", "You start regular pottery work, preparing and finishing vessels for the workshop's orders."),
      startJob("copyist", "early-work-copyist-place", "Take the copyist's place", "You start regular copying work. Another reader checks the first pages before they leave the workshop."),
      apprentice("early-work-preparation-place", "Take a workshop apprenticeship", "You start supervised preparation work while learning the measurements and tools needed at the bench."),
      noOffer("early-work-decline-workshops", "Keep your present arrangements"),
    ]);
  group("early-work", "early-work-reader-introduction", "A reader introduces you to employers",
    "A reader who knows your household can introduce you to a merchant or a copying workshop. Both ask about your actual reading and counting skills.", [
      startJob("clerk", "early-work-merchant-records", "Take a merchant's clerk position", "You begin checking stock lists and accounts for the merchant, with the first records reviewed by an experienced clerk."),
      startJob("copyist", "early-work-copying-bench", "Take a place at the copying bench", "You begin regular copying work and check each sheet before handing it over."),
      one("early-work-reading-practice", "Ask what to practise before applying", "The reader gives you a short passage and a few sums to work through. You go over the mistakes together.", [skill("literacy", 4), skill("reckoning", 3), stat("knowledge", 2)]),
      noOffer("early-work-decline-introductions", "Keep your present arrangements"),
    ]);

  for (const [name, definition] of Object.entries(EARLY_LIFE_GROUPS)) {
    const original = world.events.find(event => event.id === definition.original);
    if (!original) throw new Error(`Missing opening event ${definition.original}`);
    original.exclusiveGroup = name;
  }
  // Keep each original event at its existing position in the milestone queue.
  // Group siblings sit beside it, not behind every later personal milestone.
  for (const name of Object.keys(EARLY_LIFE_GROUPS)) {
    const index = world.events.findIndex(event => event.id === EARLY_LIFE_GROUPS[name].original);
    world.events.splice(index + 1, 0, ...added.filter(event => event.exclusiveGroup === name));
  }

  const annual = (id, title, text, min, max, origin) => ({ id: `early-year-${id}`, title, text,
    trigger: { type: "random", weight: 1 }, mode: "automatic", effects: [], choices: [], maxOccurrences: 1,
    when: all(age("gte", min), age("lte", max), ...(origin ? [{ type: "origin", origin }] : [])),
    evidence: "fictional", sourceIds: [] });
  world.events.push(
    annual("familiar-song", "The song you ask for", "You recognize a familiar song before the singer reaches the second line. You protest whenever they try a different one.", 1, 3),
    annual("cloth-knot", "A knot in a cloth", "A relative ties a knot in the corner of a cloth and lets you pull it loose. You bring the cloth back each time it comes undone.", 1, 3),
    annual("patch-of-light", "A bright patch on the floor", "Light falls through a gap above the doorway. You put your hand into the bright patch and watch the shadow move.", 1, 3),
    annual("visitor-hands", "A visitor holds out their hands", "A visitor offers to pick you up. You stay with your usual carer until the visitor stops reaching and starts making faces instead.", 1, 3),
    annual("painted-door", "The door has a new color", "You stop outside the wrong doorway after a neighbor repaints their door. A familiar adult calls you back before you go inside.", 3, 5),
    annual("loose-laces", "A knot below your knee", "You keep stopping to inspect a loose fastening on your clothes. An adult reties it and asks you to leave it alone until you get home.", 3, 5),
    annual("stone-row", "A row that keeps changing", "You arrange large stones beside the doorway. People stepping past disturb the row, and you spend the afternoon putting it back.", 3, 5),
    annual("friend-keeps-turn", "Waiting for your turn", "Another child keeps a toy longer than agreed. An adult helps you count a short wait before the toy changes hands.", 3, 5),
    annual("familiar-order", "An order you remember", "You remember the items on a small household errand without being prompted. The adult with you still checks them before paying.", 6, 10),
    annual("new-shortcut", "The shortcut is shut", "A passage you use for errands is blocked by stored goods. You return by a longer route and explain why the trip took more time.", 6, 10),
    annual("spare-offcut", "An offcut put to use", "You bring home a small wooden offcut with permission. An adult helps you smooth its edge and use it under a rocking stool.", 6, 10),
    annual("count-again", "One more than expected", "You count a group of empty containers twice and get different answers. One was hidden behind a hanging cloth.", 6, 10),
    annual("merchant-parcel", "A parcel above the shop", "You watch a relative wrap a small purchase for a customer. They let you hold the loose end of the cord while the knot is tied.", 3, 10, "merchant-household"),
    annual("pottery-offcut", "A mark in spare clay", "Your relatives set aside a little spare clay while preparing an order. You press a pattern into it and leave it on the edge of the bench.", 3, 10, "artisan-household"),
    annual("quay-packed-rope", "Rope at the doorway", "A relative brings home a length of worn packing rope. You help spread it out while they decide which pieces can still be used.", 3, 10, "harbor-household"),
    annual("fishing-float", "A float to check", "Your household sorts equipment after a fishing trip. A relative shows you how an intact float sits in a shallow bowl of water.", 3, 10, "fishing-household"),
    annual("bakery-flour", "Flour on your clothes", "A relative finds flour on the front of your clothes after you have watched dough being prepared. You help shake it off away from the working bench.", 3, 10, "bakery-household"),
    annual("clerk-sheets", "The blank side of a sheet", "Someone in your household turns over a used work sheet and lets you draw on the blank part. They put the important documents farther back on the shelf.", 3, 10, "clerk-household"),
    annual("weaving-thread", "A short length of thread", "A relative gives you a short piece of spare thread while they wind a working bundle. You keep comparing its color with the thread still on the bench.", 3, 10, "weaver-household"),
    annual("delta-word", "A word from the old village", "A visiting relative uses a word your household knows from the Delta. You repeat it until someone explains what it means in the city.", 3, 10, "delta-newcomers"),
  );
  return world;
}
