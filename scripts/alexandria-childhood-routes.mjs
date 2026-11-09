// Authored fictional childhood choices and remembered interests. No new claim
// about ancient childhood, schooling, wages or psychological effect sizes.
import { EARLY_LIFE_GROUPS } from "./alexandria-early-life.mjs";

export const CHILDHOOD_GROUP_TOTALS = { "early-care": 12, "early-learning": 12, "early-training": 8, "early-wages": 8, "early-work": 8 };
export const INTEREST_ROUTES = ["sculpture", "philosophy", "seafaring", "military", "commerce", "astronomy-calendar", "music-performance"];
export const interestFlag = route => `early-interest-${route}`;
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const age = (op, value) => ({ type: "age", op, value });
const fact = flag => ({ type: "flag", flag, value: true });
const memory = route => ({ type: "flag", flag: interestFlag(route), value: true });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const cash = delta => ({ type: "cash", delta });

export function applyChildhoodRoutes(world) {
  const memoryLabels = { sculpture: "Shaping small forms", philosophy: "Asking for reasons", seafaring: "Ropes, loads and balance", military: "Coordinating a group", commerce: "Counting and exchange", "astronomy-calendar": "Shadows, intervals and records", "music-performance": "Rhythms and voices" };
  for (const route of world.legacy.routes) {
    route.earlyInterestFlag = interestFlag(route.id);
    world.flags[route.earlyInterestFlag] = { label: memoryLabels[route.id], initial: false };
  }
  const added = [];
  const one = (id, text, outcomeText, effects = [], interests = [], when) => ({ id, text, ...(when ? { when } : {}),
    outcomes: [{ id: `${id}-result`, text: outcomeText, weight: 1, effects: [...effects, ...interests.map(memory)] }] });
  const group = (name, slug, title, text, choices) => {
    const id = `child-route-${name.replace("early-", "")}-${slug}`;
    const options = choices.map(([key, label, result, effects = [], routes = []]) => one(`${id}-${key}`, label, result, effects, routes));
    options.push(one(`${id}-leave`, "Leave it for another time", "You leave the task unfinished for now. Your household keeps its existing arrangements."));
    const event = { id, title, text, exclusiveGroup: name, trigger: { type: "age", at: EARLY_LIFE_GROUPS[name].age },
      maxOccurrences: 1, evidence: "fictional", sourceIds: [], choices: options };
    added.push(event); return event;
  };
  const reading = (key, label, result, routes) => [key, label, result, [{ type: "flag", flag: "literate", value: true }, skill("literacy", 10), stat("knowledge", 6)], routes];
  const jobOffer = (event, jobId, suffix, text, result, routes) => {
    const job = world.character.jobs.find(job => job.id === jobId);
    if (!job) throw new Error(`Missing childhood offer occupation ${jobId}`);
    const conditions = [age("gte", job.minAge), { type: "not", condition: { type: "job", job: jobId } },
      ...Object.entries(job.requirements ?? {}).map(([skill, value]) => ({ type: "skill", skill, op: "gte", value }))];
    const effects = [{ type: "job", job: jobId }, { type: "flag", flag: "retired", value: false }];
    if (jobId === "apprentice") effects.push({ type: "flag", flag: "apprenticed", value: true });
    if (jobId === "sailor") effects.push({ type: "flag", flag: "sailed", value: true });
    if (["clerk", "copyist"].includes(jobId)) effects.push({ type: "flag", flag: "studied", value: true });
    event.choices.unshift(one(`${event.id}-${suffix}`, text, result, effects, routes, all(...conditions)));
  };

  // Eight new care situations: small forms, rhythm, shadows, cloth, shared
  // movement, floating objects, fairness and puppetry rather than repeated visits.
  group("early-care", "clay-animals", "An animal without ears", "A carer gives you a soft scrap of clay. The lump looks a little like an animal, but everyone sees a different one.", [
    ["shape", "Press ears and a tail into the clay", "A carer steadies the clay while you press the parts into place. You want to try making another shape.", [skill("craft", 1)], ["sculpture"]],
    ["ask", "Ask why the others see different animals", "The adults give different answers. You listen, point to the same lump and ask them again.", [stat("bonds", 2)], ["philosophy"]],
  ]);
  group("early-care", "echo-rhythm", "A rhythm answered", "Someone taps a short rhythm on an empty wooden bowl while you wait for the meal to cool.", [
    ["answer", "Tap the rhythm back", "You copy the sounds and wait for the answer. The exchange becomes a small game you want to repeat.", [skill("music", 1)], ["music-performance"]],
    ["count", "Count the taps with your fingers", "A carer helps you match a finger to each tap. You notice when an extra sound changes the count.", [skill("reckoning", 1)], ["commerce"]],
  ]);
  group("early-care", "window-shadow", "The patch that moves", "A patch of sunlight moves across the room during the afternoon. You keep returning to see where it has gone.", [
    ["mark", "Put a pebble at its edge", "Your carer helps you place a pebble without blocking the doorway. Later, the bright edge has moved past it.", [stat("knowledge", 2)], ["astronomy-calendar"]],
    ["story", "Invent a voice for the moving patch", "You give the patch a voice, and a familiar adult answers it. You keep changing the sounds of the conversation.", [stat("bonds", 2)], ["music-performance"]],
  ]);
  group("early-care", "cloth-loop", "A loop that holds", "A folded cloth keeps opening while the household puts away clean things. A carer shows you a loose loop in a spare cord.", [
    ["loop", "Try making the loose loop", "You pull on a short spare cord while a carer checks your hands. You are pleased when the loop stays together.", [skill("craft", 1)], ["seafaring"]],
    ["fold", "Arrange the corners into a shape", "You press the folded corners flat and compare the outline with another scrap. Making the shape interests you more than tying it.", [skill("craft", 1)], ["sculpture"]],
  ]);
  group("early-care", "shared-steps", "A place for each child", "The children make a pretend path out of flat scraps on the courtyard floor. They disagree about whose turn comes next.", [
    ["turns", "Help agree a turn for everyone", "A carer helps you name whose turn follows whose. The game continues when the order is clear.", [stat("bonds", 2)], ["military"]],
    ["reason", "Ask why one child should go first", "You ask the others to explain their choices. The answers matter to you even after the game changes.", [stat("knowledge", 1), stat("bonds", 1)], ["philosophy"]],
  ]);
  group("early-care", "floating-reed", "The reed that floats", "Under a carer's eye, you put a short reed into a shallow washing bowl. A small stone behaves differently.", [
    ["boat", "Try balancing a scrap on the reed", "The carer keeps the bowl steady while you see which light scraps the reed can carry. You ask to try again.", [skill("seamanship", 1)], ["seafaring"]],
    ["compare", "Keep comparing the reed and stone", "You point out the difference each time. Your carer answers as well as they can, and you return to the question.", [stat("knowledge", 2)], ["philosophy"]],
  ]);
  group("early-care", "unequal-portions", "Two cups, one portion", "A carer divides a small snack between two cups. The taller cup looks fuller even when the portions are alike.", [
    ["count", "Count the pieces in each cup", "With help, you match the pieces one by one. Counting changes your first impression.", [skill("reckoning", 1)], ["commerce"]],
    ["ask", "Ask what makes the division fair", "You ask whether size, number or taking turns matters. The adults keep talking after the snack is gone.", [stat("bonds", 2)], ["philosophy"]],
  ]);
  group("early-care", "puppet-voices", "A voice from behind the cloth", "An older child makes a cloth puppet answer questions from behind a hanging cloth. A carer stays nearby.", [
    ["voice", "Give a second puppet a different voice", "You copy the rhythm of the exchange, then try a sound of your own. The others wait for your next reply.", [skill("music", 1), stat("bonds", 1)], ["music-performance"]],
    ["make", "Help arrange the puppet's face", "You place large safe scraps where the eyes and mouth should be. The maker helps you fasten them.", [skill("craft", 1)], ["sculpture"]],
  ]);

  // Each learning variant contains a free, unconditionally available reading
  // path. Early interests never require already developed specialist skills.
  group("early-learning", "pattern-repair", "The missing part of a pattern", "A worker shows you a broken decorative pattern on an offcut. They have time to help you choose how to study it.", [
    ["shape", "Rebuild the repeated shape", "You compare the surviving parts and shape a soft replacement. The worker shows where its edges fail to line up.", [skill("craft", 6)], ["sculpture"]],
    reading("read", "Read the short notes beside the pattern", "You learn the letters in the worker's short notes, copying them until you can distinguish the marks.", ["sculpture"]),
    ["measure", "Count how many parts should repeat", "You lay out counters for the missing parts and check the count against the surviving pattern.", [skill("reckoning", 7)], ["commerce"]],
  ]);
  group("early-learning", "two-explanations", "Two answers to one question", "Two adults explain the same household rule in different ways. A reader offers to help you put their explanations into words.", [
    ["compare", "Ask each person to explain their reason", "You repeat the reasons back and discover that the adults disagree about more than the wording.", [stat("knowledge", 5), stat("bonds", 2)], ["philosophy"]],
    reading("read", "Learn to read a short story about the rule", "The reader helps you recognize the letters, then asks what the people in the story should have done.", ["philosophy"]),
    ["perform", "Act out both explanations", "You use different voices for the two speakers. The household laughs, then asks you to repeat one exchange more clearly.", [skill("music", 4), stat("bonds", 2)], ["music-performance"]],
  ]);
  group("early-learning", "cord-and-names", "A cord with several uses", "A rope worker has spare cord and a short written list of the tasks it will serve. You may study one part of the work.", [
    ["knots", "Practise tying and undoing a useful knot", "You repeat the knot with a short spare cord until it holds and can still be undone.", [skill("seamanship", 6), skill("craft", 2)], ["seafaring"]],
    reading("read", "Learn the letters in the worker's task list", "The worker finds a reader who helps you copy the task names and recognize the same letters again.", ["seafaring"]),
    ["lengths", "Count the cord lengths needed", "You count the short pieces and set aside the correct number for each task.", [skill("reckoning", 7)], ["commerce"]],
  ]);
  group("early-learning", "ordered-figures", "The little procession", "Children arrange small wooden figures into a pretend procession. Their groups keep reaching the same narrow gap together.", [
    ["organise", "Agree an order and signals for the groups", "You help the children take turns and signal when the next group should move. No one is made into a real soldier.", [skill("reckoning", 4), stat("bonds", 3)], ["military"]],
    reading("read", "Learn the letters on the figures' labels", "A reader helps you copy the labels, then recognize the names when the figures change places.", ["military"]),
    ["carve", "Make a simple stand for a loose figure", "Under supervision, you fit a broad scrap beneath the figure so it stands with the others.", [skill("craft", 6)], ["sculpture"]],
  ]);
  group("early-learning", "counter-exchange", "Enough counters for a trade", "An adult sets out a pretend exchange with counters. Two different arrangements seem to offer the same amount.", [
    ["balance", "Count each side before agreeing", "You group the counters, check the totals and notice an extra piece hidden by the arrangement.", [skill("reckoning", 8)], ["commerce"]],
    reading("read", "Learn to read a short record of the exchange", "You copy a few letters and numbers, then match the record with the counters on the mat.", ["commerce"]),
    ["question", "Ask why both sides consider it fair", "The adult changes the terms and asks whether your answer changes too. You explain what you think matters.", [stat("knowledge", 5), stat("bonds", 2)], ["philosophy"]],
  ]);
  group("early-learning", "shadow-marks", "A mark and its shadow", "A familiar adult marks where a stick's shadow falls on the ground. You can compare the marks when they return later.", [
    ["compare", "Count the space between the marks", "You use equal scraps as counters and record how the gap changes. An adult checks that the units stay alike.", [skill("reckoning", 7), stat("knowledge", 2)], ["astronomy-calendar"]],
    reading("read", "Learn the letters used in the adult's day notes", "A reader helps you recognize and copy the simple day labels without claiming that the marks predict anyone's fate.", ["astronomy-calendar"]),
    ["shape", "Make a clear marker for the next comparison", "You form a broad marker and fit it where the adult can find it again.", [skill("craft", 6)], ["sculpture"]],
  ]);
  group("early-learning", "missing-phrase", "The phrase that stops too soon", "A performer repeats a short musical phrase, leaving a space where you expect another sound.", [
    ["complete", "Try completing the phrase", "You wait for the gap and supply a sound. The performer asks you to repeat it at the same point.", [skill("music", 6), stat("bonds", 2)], ["music-performance"]],
    reading("read", "Learn the letters in a short introduction", "The performer finds a reader to help you copy the words that introduce the piece.", ["music-performance"]),
    ["count", "Count how long the gap lasts", "You count the beats with the performer and compare the spacing between each return.", [skill("reckoning", 6)], ["astronomy-calendar"]],
  ]);
  group("early-learning", "measuring-cord", "Which length is the same?", "Two workers mark a length with differently spaced knots. A reader offers a short written description of the task.", [
    ["compare", "Compare the equal intervals", "You place the marks side by side and count the intervals rather than guessing from the cord's appearance.", [skill("reckoning", 7)], ["astronomy-calendar"]],
    reading("read", "Read the task description with help", "You learn the letters in the short description and copy the words beside a sketch of the cord.", ["philosophy"]),
    ["fit", "Fit the cord to a small wooden frame", "You help cut and fit a simple frame, then check whether the cord lies straight along it.", [skill("craft", 6)], ["sculpture", "seafaring"]],
  ]);

  group("early-training", "puppet-frame", "A frame for the performance cloth", "A performer and a craft worker need a small frame repaired before a household engagement. They offer supervised tasks, not an automatic occupation.", [
    ["frame", "Fit the frame's wooden joints", "You measure the loose joints and help fit replacements while the worker checks your tool use.", [skill("craft", 7)], ["sculpture"]],
    ["rehearse", "Rehearse an entrance with the performer", "You practise waiting for the cue and repeating a phrase without rushing the others.", [skill("music", 5), stat("bonds", 2)], ["music-performance"]],
    ["list", "Read and count the required fittings", "You compare the short supply list with the fittings, checking each quantity aloud.", [skill("literacy", 5), skill("reckoning", 4)], ["commerce"]],
  ]);
  group("early-training", "unequal-tasks", "Not everyone has the same task", "A supervised group must move light supplies between two nearby rooms. The helpers disagree about the order of the work.", [
    ["coordinate", "Divide the tasks and agree simple signals", "You count the loads, ask who can take each task and change the order when two helpers block the doorway.", [skill("reckoning", 5), stat("bonds", 3)], ["military"]],
    ["reasons", "Hear the reasons for each proposed order", "You compare the helpers' reasons and explain which disagreement remains after the work is divided.", [skill("literacy", 3), stat("knowledge", 4)], ["philosophy"]],
    ["record", "Check the supply list as each load arrives", "You compare marks with actual bundles and correct a repeated count under supervision.", [skill("reckoning", 6), skill("literacy", 3)], ["commerce"]],
  ]);
  group("early-training", "two-day-lists", "Two copies of the day list", "A calculator shows you two short lists whose columns no longer align. They can supervise reading and arithmetic without promising access to a scholarly post.", [
    ["columns", "Check the intervals between entries", "You count the intervals and mark where one copy has skipped a line. The calculator checks the correction.", [skill("reckoning", 6), skill("literacy", 3)], ["astronomy-calendar"]],
    ["read", "Read the headings aloud before comparing", "You practise recognizing the headings and distinguish a copying mistake from a claim about the weather.", [skill("literacy", 6), stat("knowledge", 3)], ["astronomy-calendar", "philosophy"]],
    ["cord", "Prepare lengths of cord for the writing board", "You measure and tie spare cord so the board can be carried safely between rooms.", [skill("craft", 4), skill("seamanship", 3)], ["seafaring"]],
  ]);
  const bench = group("early-training", "vessel-packing", "A vessel that must travel", "A workshop is packing a vessel for delivery. A worker offers a place preparing materials if you meet the apprenticeship requirements.", [
    ["protect", "Shape soft supports around the vessel", "You compare the vessel's uneven outline and fit broad supports where the worker indicates.", [skill("craft", 6)], ["sculpture"]],
    ["lash", "Practise securing the light practice load", "You tie a practice bundle and check it under supervision before touching the customer's packed vessel.", [skill("seamanship", 5), skill("craft", 2)], ["seafaring"]],
    ["count", "Compare the packed items with the receipt", "You check the count and read the labels with a worker before the delivery leaves.", [skill("reckoning", 5), skill("literacy", 3)], ["commerce"]],
  ]);
  jobOffer(bench, "apprentice", "apprentice", "Take the supervised workshop apprenticeship", "You start the workshop's supervised preparation work. The existing apprenticeship requirements still apply.", ["sculpture"]);

  group("early-wages", "rehearsal-messages", "Messages before the rehearsal", "A household engagement needs a short message delivered and its spare props arranged. The performer offers small paid tasks alongside practice.", [
    ["message", "Deliver the agreed local message for 10 drachmas", "You repeat the message to its recipient and return with the reply. The performer pays your household 10 drachmas.", [cash(10), skill("music", 2)], ["music-performance"]],
    ["props", "Help fit and arrange the wooden props", "A worker checks your fittings while you prepare the props for rehearsal.", [skill("craft", 5)], ["sculpture"]],
    ["cue", "Stay to practise a sequence of musical cues", "You practise the same entrances with the performers until everyone can follow the agreed order.", [skill("music", 5), stat("bonds", 2)], ["music-performance"]],
  ]);
  const receipt = group("early-wages", "delivery-receipt", "The quantity on the receipt", "A shop needs someone to check a delivery record. Regular account work is available only to someone who meets its actual requirements.", [
    ["parcel", "Carry and count a small local delivery for 10 drachmas", "You count a light parcel with the worker, take it nearby and bring back the acknowledgement. You receive 10 drachmas.", [cash(10), skill("reckoning", 3)], ["commerce"]],
    ["knots", "Check the practice knots used in packing", "You compare the secure and loose practice knots before the worker packs the real delivery.", [skill("seamanship", 5)], ["seafaring"]],
    ["read", "Practise reading the receipt's labels", "A reader helps you distinguish the names and quantities in the short receipt.", [skill("literacy", 5), skill("reckoning", 2)], ["commerce"]],
  ]);
  jobOffer(receipt, "clerk", "clerk", "Take regular work checking the shop's accounts", "You take the clerk's regular account work after meeting its existing age and skill requirements.", ["commerce"]);
  const kiln = group("early-wages", "bench-measures", "The measure at the bench", "A workshop needs preparation help and may offer regular pottery work to someone qualified. The worker also has small supervised tasks.", [
    ["fitting", "Prepare a carefully measured wooden fitting", "You mark the wood, check its dimensions and help fit it under supervision.", [skill("craft", 6)], ["sculpture"]],
    ["packing", "Arrange a clear order for the packing tasks", "You divide the light tasks into an order the helpers can follow and check the resulting count.", [skill("reckoning", 4), stat("bonds", 2)], ["military"]],
    ["paid", "Prepare soft packing for 10 drachmas", "You prepare packing under supervision and receive the agreed 10 drachmas when the worker checks it.", [cash(10), skill("craft", 2)], ["commerce"]],
  ]);
  jobOffer(kiln, "potter", "potter", "Take the workshop's regular pottery work", "You begin regular pottery work after meeting the occupation's actual requirements.", ["sculpture"]);
  group("early-wages", "competing-records", "Two records of the same task", "Two adults have written different accounts of a short task. They ask for help checking the copies and explaining the disagreement.", [
    ["explain", "Read both accounts and compare their reasons", "You compare the wording with a reader and explain which claim needs another answer.", [skill("literacy", 5), stat("knowledge", 4)], ["philosophy"]],
    ["columns", "Check the numbered columns", "You count the gaps and find where one column has slipped against its heading.", [skill("reckoning", 6), skill("literacy", 2)], ["astronomy-calendar"]],
    ["copy", "Prepare a clean checked copy for 10 drachmas", "A reader supervises the clean copy and checks it against both accounts. The household pays 10 drachmas.", [cash(10), skill("literacy", 3)], ["commerce"]],
  ]);

  const ensemble = group("early-work", "ensemble-repertoire", "A repertoire to agree", "Performers need another person for their regular rehearsals. They can offer hired work only when your musical ability meets the job's requirements.", [
    ["practice", "Practise the agreed entries before applying", "You repeat the entrances with the ensemble and ask the others to point out the missed cues.", [skill("music", 6)], ["music-performance"]],
    ["intro", "Read the short introduction for the gathering", "You practise the words with a reader and check that the introduction agrees with the performers' plan.", [skill("literacy", 5), stat("bonds", 2)], ["music-performance"]],
    ["organise", "Help agree a clear rehearsal order", "You divide the rehearsal into short tasks and help the performers agree who enters next.", [skill("reckoning", 3), stat("bonds", 3)], ["military", "music-performance"]],
  ]);
  jobOffer(ensemble, "performer", "performer", "Take regular work as a hired musician", "You join the paid rehearsals and household engagements after meeting the hired musician's existing requirements.", ["music-performance"]);
  const cargo = group("early-work", "merchant-and-crew", "A merchant and a crew need help", "A merchant and a ship's crew are arranging different kinds of work. Their regular positions retain their usual qualifications.", [
    ["cord", "Stay ashore to practise rope handling", "You keep your present arrangements and practise with a worker before applying for shipboard work.", [skill("seamanship", 5), skill("craft", 2)], ["seafaring"]],
    ["accounts", "Check the light delivery's quantities", "You compare the quantities with a worker's list and mark the one that needs another check.", [skill("reckoning", 5), skill("literacy", 2)], ["commerce"]],
  ]);
  jobOffer(cargo, "clerk", "clerk", "Take the merchant's clerk position", "You begin checking the merchant's regular accounts after meeting the occupation's actual requirements.", ["commerce"]);
  jobOffer(cargo, "sailor", "sailor", "Take the sailor's place with the crew", "You take a sailor's place after meeting the crew's existing age and skill requirements.", ["seafaring"]);
  const copy = group("early-work", "copy-explained", "A copy someone must explain", "A reader needs a clean copy and someone willing to discuss a difficult passage. Regular copying work is an option only if you qualify.", [
    ["argument", "Work through the passage with a reader", "You compare the wording and ask which reasons support the disputed conclusion.", [skill("literacy", 5), stat("knowledge", 4)], ["philosophy"]],
    ["days", "Compare the intervals in a separate day list", "You check the arithmetic and mark which parts are copied observations rather than promises about the future.", [skill("reckoning", 5), skill("literacy", 3)], ["astronomy-calendar"]],
    ["read-aloud", "Practise reading a short introduction aloud", "You practise keeping the phrasing clear while a reader checks the words.", [skill("literacy", 4), stat("bonds", 2)], ["music-performance"]],
  ]);
  jobOffer(copy, "copyist", "copyist", "Take regular work at the copying bench", "You start the regular copying work after meeting the occupation's existing requirements.", ["philosophy"]);
  const pattern = group("early-work", "checked-pattern", "The pattern and the packing order", "A workshop has both craft work and a complicated packing order. You can ask for a qualified position or help with a smaller task.", [
    ["pattern", "Practise fitting the repeated wooden pattern", "You work on a spare fitting while the craft worker checks your cuts and measurements.", [skill("craft", 6)], ["sculpture"]],
    ["order", "Agree the order for several light packing tasks", "You help arrange the tasks so the helpers can reach what they need without crossing each other's paths.", [skill("reckoning", 4), skill("craft", 2), stat("bonds", 1)], ["military"]],
  ]);
  jobOffer(pattern, "apprentice", "apprentice", "Take the supervised workshop apprenticeship", "You take a supervised preparation place under the apprenticeship's existing requirements.", ["sculpture"]);
  jobOffer(pattern, "potter", "potter", "Take regular work as a potter", "You start regular pottery work after meeting its actual age and skill requirements.", ["sculpture"]);

  world.events.push(...added);

  // Explicit tags reflect what each retained choice actually does; declining a
  // choice never erases another remembered interest or invents one.
  const retained = {
    "close-to-home": ["commerce"], "play-with-neighbors": ["military"], "early-care-go-market": ["commerce"], "early-care-help-table": ["philosophy"],
    "early-care-stay-relative": ["sculpture"], "early-care-quiet-play": ["sculpture"], "early-care-sorting-game": ["commerce"], "early-care-outside-song": ["music-performance"],
    "learn-letters": ["philosophy"], "learn-by-doing": ["sculpture"], "early-jars-read-labels": ["commerce"], "early-jars-count-stock": ["commerce"], "early-jars-make-stoppers": ["sculpture"],
    "early-boat-knots": ["seafaring"], "early-boat-letters": ["seafaring"], "early-boat-pieces": ["commerce"], "early-clay-letter": ["sculpture"], "early-clay-counters": ["commerce"], "early-clay-container": ["sculpture"],
    "practice-reading": ["philosophy", "commerce"], "join-workbench": ["sculpture"], "early-training-check-list": ["commerce"], "early-training-preparation": ["sculpture"], "early-training-count-goods": ["commerce"],
    "early-training-cord-bench": ["seafaring"], "early-training-yard-messages": ["commerce"], "early-training-yard-errands": ["commerce"], "early-training-pottery-apprentice": ["sculpture"], "early-training-pottery-records": ["commerce"], "early-training-pottery-home": ["sculpture"],
    "steady-work": ["commerce"], "seek-experience": ["sculpture"], "early-wages-clerk": ["commerce"], "early-wages-shop-porter": ["commerce"], "early-wages-shop-parcel": ["commerce"],
    "early-wages-potter": ["sculpture"], "early-wages-kiln-apprentice": ["sculpture"], "early-wages-kiln-preparation": ["sculpture"], "early-wages-quay-porter": ["commerce"], "early-wages-cord-work": ["seafaring"], "early-wages-check-loads": ["commerce"],
    stay: ["commerce"], sail: ["seafaring"], study: ["philosophy"], "interest-career-ceramic-decorator": ["sculpture"], "interest-career-wood-carver": ["sculpture"], "interest-career-sculptor": ["sculpture"],
    "interest-career-philosophy-tutor": ["philosophy"], "interest-career-sky-table-calculator": ["astronomy-calendar"], "interest-career-astrologer": ["astronomy-calendar"],
    "early-work-join-crew": ["seafaring"], "early-work-quay-place": ["commerce"], "early-work-practise-cord": ["seafaring"], "early-work-pottery-place": ["sculpture"], "early-work-copyist-place": ["philosophy"],
    "early-work-preparation-place": ["sculpture"], "early-work-merchant-records": ["commerce"], "early-work-copying-bench": ["philosophy"], "early-work-reading-practice": ["philosophy"],
  };
  for (const event of world.events.filter(event => event.exclusiveGroup)) for (const choice of event.choices) {
    if (retained[choice.id]) for (const outcome of choice.outcomes) outcome.effects.push(...retained[choice.id].map(memory));
  }
  const retainedCareCopy = {
    "close-to-home": ["Help count and put household things away", "Beside a familiar adult, you put large household pieces away in little groups. You count along with them and ask for another handful when the first group is finished."],
    "play-with-neighbors": ["Join a group game with the neighbors' children", "You help the children agree whose turn follows whose in a courtyard game. A carer helps with the order, and you come home repeating the signals with dusty hands."],
    "early-care-go-market": ["Go along and help count the purchases", "You stay close while your carer shops. They help you count the pieces going into a basket and compare them with the trader's count."],
    "early-care-help-table": ["Stay beside the adults and ask questions", "Beside a familiar adult, you ask why each visitor does things differently at the table. The adults try out answers while you repeat the question in a new way."],
    "early-care-stay-relative": ["A relative helps you arrange little shapes at home", "A relative stays with you and brings out broad, safe pieces. You arrange them into little faces and animals, changing the shapes until the shopping is finished."],
    "early-care-quiet-play": ["Arrange little figures in the quieter room", "An older child sits with you in a quieter room. You fit broad wooden pieces into little figures while they keep the small ones out of reach."],
  };
  for (const event of world.events.filter(event => event.exclusiveGroup === "early-care")) for (const choice of event.choices) {
    const copy = retainedCareCopy[choice.id];
    if (copy) { choice.text = copy[0]; for (const outcome of choice.outcomes) outcome.text = copy[1]; }
  }

  const ambient = [
    ["unequal-sandals", "Two unequal footprints", "You compare the prints of two sandals in the dust and put your own foot beside them.", 2, 7],
    ["thread-shadow", "A thread across the light", "A loose thread casts a thin shadow. You move your hand behind it until the two shapes line up.", 3, 9],
    ["silent-entrance", "An entrance without a sound", "The children try a game in which everyone must notice the next person's signal before moving.", 4, 10],
    ["folded-reply", "A reply folded inside", "A reader unfolds a short message, reads it aloud and folds the reply differently so the household can tell them apart.", 5, 11],
    ["reed-bridge", "A bridge made of reeds", "You place light reeds over a narrow groove in the courtyard and see which arrangement holds a harmless scrap.", 4, 10],
    ["pitcher-echo", "The empty pitcher's echo", "Someone notices that a sound changes when the pitcher is empty. You take turns listening without striking the vessel.", 3, 8],
    ["opposite-view", "From the other side", "A drawing looks different from the opposite side of the mat. You change places with another child to compare it.", 4, 11],
    ["waiting-hand", "The waiting hand", "An adult holds out a hand to keep a group waiting until a narrow doorway is clear. You try the same signal in a game.", 5, 11],
    ["false-bottom", "A shallow box", "A shallow box appears to hold more counters than a deeper one. You spread them out and see the difference.", 5, 12],
    ["familiar-refrain", "The refrain everyone knows", "Several voices join a familiar refrain from different parts of the room. You listen for where each one enters.", 2, 10],
    ["long-cord", "Room for the long cord", "A worker coils a long cord before carrying it. You watch the pile take less space without becoming shorter.", 4, 11],
    ["old-correction", "The old correction", "A reader points out an earlier correction on a practice scrap. You can still see why the first mark was confusing.", 6, 13],
  ];
  for (const [slug, title, text, minAge, maxAge] of ambient) world.events.push({ id: `child-memory-ambient-${slug}`, title, text,
    trigger: { type: "random", weight: 2 }, mode: "automatic", choices: [], effects: [], maxOccurrences: 1,
    when: all(age("gte", minAge), age("lt", maxAge)), evidence: "fictional", sourceIds: [] });
  const recalled = {
    sculpture: ["A figure seen from below", "A maker sets a small figure on a high shelf and asks you to look from the floor. The face disappears into its chest. Your old interest in shaping things draws you closer; together, you turn the head until its expression can be seen.", "craft"],
    philosophy: ["The reason changes over supper", "A discussion over supper turns on a rule everyone first calls fair. You ask for the reason, as you have liked doing since childhood. One guest changes the example; another puts down their cup and begins their answer again.", "literacy"],
    seafaring: ["The bundle that keeps slipping", "A crew member struggles with a bundle whose cord slides whenever it is lifted. Your early interest in ropes and loads makes you stop to watch. You help steady the practice bundle while they show how to place the next turn under tension.", "seamanship"],
    military: ["One signal, understood", "A retired guard watches several helpers block a narrow passage, each following a different shouted instruction. Knowing your interest in coordinated tasks, they show you a clear hand signal. You try it with the group, and the next load passes through without a quarrel.", "craft"],
    commerce: ["The entry counted twice", "A stallholder compares a short list with the goods and frowns at a missing measure. You have long liked checking quantities, so you look along with them. The same entry appears twice; you separate the totals and help check the count again.", "reckoning"],
    "astronomy-calendar": ["Another mark beside the shadow", "A reader lays two sets of shadow marks side by side. Your early interest in intervals and records pulls you into the comparison. You count the spaces aloud, spot a skipped interval and help place a fresh mark for the next observation.", "reckoning"],
    "music-performance": ["They ask for the phrase again", "At a household gathering, a familiar musical phrase loses its final beat in the noise. Your childhood interest in rhythm makes the gap hard to ignore. You repeat the phrase; two listeners join at the right moment and ask you to lead it once more.", "music"],
  };
  INTEREST_ROUTES.forEach((route, i) => world.events.push({ id: `early-interest-recalled-${route}`, title: recalled[route][0], text: recalled[route][1],
    trigger: { type: "age", at: 18 + i }, mode: "automatic", choices: [], effects: [skill(recalled[route][2], 1)], maxOccurrences: 1,
    when: fact(interestFlag(route)), evidence: "fictional", sourceIds: [] }));

  const skillInterests = {
    craft: ["sculpture", "seafaring", "military"], pottery: ["sculpture"], carving: ["sculpture"], sculpture: ["sculpture"],
    literacy: ["philosophy", "astronomy-calendar"], oratory: ["philosophy"], philosophy: ["philosophy"],
    seamanship: ["seafaring"], warfare: ["military"], reckoning: ["commerce", "astronomy-calendar"],
    astronomy: ["astronomy-calendar"], astrology: ["astronomy-calendar"], music: ["music-performance"],
  };
  for (const activity of world.character.activities) {
    if (activity.category !== "training" || !activity.id.startsWith("train-")) continue;
    for (const outcome of activity.outcomes) {
      const paid = outcome.effects.some(effect => effect.type === "cash" && effect.delta < 0 || effect.type === "stat" && effect.stat === world.economy?.stat && effect.delta < 0);
      if (!paid) continue;
      for (const effect of outcome.effects) if (effect.type === "skill" && effect.delta > 0 && skillInterests[effect.skill]) {
        effect.gainModifiers = skillInterests[effect.skill].map(route => ({ flag: interestFlag(route), multiplier: 1.2,
          reason: `Your early interest in ${world.legacy.routes.find(item => item.id === route).title.toLowerCase()} supports this practice.` }));
      }
    }
  }
  const careerInterests = {
    "prepare-official-petition": ["philosophy", "commerce"], "organise-unit-supplies": ["military", "commerce"],
    "show-sky-calculations": ["astronomy-calendar"], "show-workshop-sample": ["sculpture"],
    "seek-officer-commission": ["military"], "seek-general-command": ["military"], "seek-court-appointment": ["philosophy", "commerce"],
    "propose-royal-grain-order": ["commerce", "military"],
    ...Object.fromEntries(INTEREST_ROUTES.map(route => [`attempt-${route}-prestige`, [route]])),
  };
  for (const choice of [...world.character.activities, ...world.events.flatMap(event => event.choices)]) {
    const routes = careerInterests[choice.id];
    if (!routes || !choice.opportunity || choice.outcomes.length < 2) continue;
    for (const outcome of choice.outcomes) if (choice.opportunity.outcomeIds.includes(outcome.id)) {
      outcome.weightModifiers ??= [];
      outcome.weightModifiers.push({ when: any(...routes.map(route => fact(interestFlag(route)))), multiplier: 1.2,
        reason: "A remembered early interest supports your preparation for this opportunity." });
    }
  }
  for (const [name, total] of Object.entries(CHILDHOOD_GROUP_TOTALS)) {
    const count = world.events.filter(event => event.exclusiveGroup === name).length;
    if (count !== total) throw new Error(`Expected ${total} ${name} alternatives, found ${count}`);
  }
  return world;
}
