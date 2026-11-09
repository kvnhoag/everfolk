import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const sources = JSON.parse(readFileSync(new URL("research/sources.json", root), "utf8"));
const model = JSON.parse(readFileSync(new URL("research/mortality-model.json", root), "utf8"));
const stat = (id, delta) => ({ type: "stat", stat: id, delta });
const flag = (id, value = true) => ({ type: "flag", flag: id, value });
const has = (id, value = true) => ({ type: "flag", flag: id, value });
const age = (op, value) => ({ type: "age", op, value });
const all = (...conditions) => ({ type: "all", conditions });
const result = (id, text, effects = [], weight = 1) => ({ id, text, weight, effects });
const option = (id, text, outcomes, when) => ({ id, text, ...(when ? { when } : {}), outcomes });
const one = (id, text, outcome, effects, when) => option(id, text, [result(`${id}-result`, outcome, effects)], when);
const at = (id, title, text, atAge, choices, sourceIds = [], when) => ({
  id, title, text, trigger: { type: "age", at: atAge },
  evidence: sourceIds.length ? "historically-inspired" : "fictional", sourceIds,
  ...(when ? { when } : {}), choices,
});
const automatic = (id, title, text, trigger, effects = [], sourceIds = [], evidence = "historically-inspired") => ({
  id, title, text, trigger, mode: "automatic", effects, choices: [], sourceIds,
  evidence: sourceIds.length ? evidence : "fictional",
});
const note = (id, title, text, atAge, effects = [], sourceIds = []) => automatic(id, title, text, { type: "age", at: atAge }, effects, sourceIds);
const dated = (id, title, text, year, effects, sourceIds) => automatic(id, title, text, { type: "year", at: year }, effects, sourceIds, "documented-history");
const ambient = (id, title, text, minAge, maxAge, effects = [], when) => ({
  ...automatic(id, title, text, { type: "random", weight: 1 }, effects),
  when: all(age("gte", minAge), age("lt", maxAge), ...(when ? [when] : [])),
  maxOccurrences: 100, cooldownYears: 3,
});
const recurring = (id, title, text, minAge, maxAge, choices, when) => ({
  ...at(id, title, text, minAge, choices), trigger: { type: "random", weight: 1 },
  when: all(age("gte", minAge), age("lt", maxAge), ...(when ? [when] : [])),
  maxOccurrences: 8, cooldownYears: 9,
});

const events = [
  // Political anchors are ordered before personal events due in the same year.
  dated("caesar-in-alexandria", "The city drawn into war", "In 48 BCE, Caesar's arrival becomes entangled with the struggle over Egypt's throne. Fighting follows in Alexandria, reaching streets and quays that once felt familiar.", -48, [flag("experienced-war"), stat("wealth", -2)], ["alexandrian-war", "caesar-chronology"]),
  dated("water-and-war", "A struggle over water", "The Alexandrian War continues into 47 BCE. A Roman account describes attempts to disrupt Caesar's water supply and the digging of wells. The city's water and harbors have become part of the struggle.", -47, [], ["alexandrian-war", "caesar-chronology"]),
  dated("news-of-actium", "News from Actium", "In 31 BCE, Antony and Cleopatra's forces are defeated at Actium. Egypt's political future is becoming tied to Octavian's victory.", -31, [], ["ptolemaic-period"]),
  dated("roman-rule", "A kingdom becomes a province", "Ptolemaic rule ends in 30 BCE and Egypt comes under Roman rule. Augustus later lists the addition of Egypt among his achievements. For people making their living in the city, a different political world is taking shape.", -30, [flag("roman-rule")], ["ptolemaic-period", "augustus-res-gestae"]),

  at("the-first-household", "A small world of voices", "You are born in Alexandria in 66 BCE. For now, your world is a household: hands that carry you, voices you will learn to recognize, and adults deciding how to care for you. This first choice belongs to them.", 0, [
    one("family-care", "Your family shares the care", "Different hands take turns holding you. The household makes room for its newest member.", [stat("bonds", 4)]),
    one("seek-help", "Your household asks a trusted neighbor for help", "Help arrives in small, ordinary ways. Your earliest story is one of dependence on others.", [stat("bonds", 3), stat("wealth", -1)]),
  ], ["alexandrian-wetnursing"]),
  note("first-steps", "A wider room", "Before long, the space between one familiar face and another becomes a journey you can begin on your own. Your household remembers the first unsteady steps.", 1, [stat("bonds", 2)]),
  at("a-child-in-the-courtyard", "The courtyard beyond the door", "As you grow, you begin to spend more time around the other children. Your caregivers decide how much of the busy neighborhood to let into your small world.", 3, [
    one("close-to-home", "Stay close to the household", "Familiar routines give the days a shape. You learn names, tasks and places at your own pace.", [stat("bonds", 4)]),
    one("play-with-neighbors", "Spend time with the neighbors' children", "You return with dusty feet and a little more confidence among other people.", [stat("knowledge", 3), stat("bonds", 2)]),
  ]),
  at("the-first-letters", "Marks that mean something", "A literate neighbor offers to show you a few letters. Your household must weigh this unusual opportunity against the work and care that already fill its days. Learning will have to find a place among those responsibilities.", 6, [
    one("learn-letters", "Make time to learn the letters", "Repeated marks become familiar words. You have gained an opportunity to learn, not a guarantee of an easy life.", [flag("literate"), stat("knowledge", 12), stat("wealth", -2)]),
    one("learn-by-doing", "Learn through the household's work", "You learn by watching hands at work and trying small tasks for yourself. Practical knowledge has its own value.", [flag("apprenticed"), stat("knowledge", 7), stat("bonds", 3)]),
  ], ["education-apprenticeship"]),
  note("the-shape-of-the-city", "A city of many kinds of work", "The quays, workshops and streets become less mysterious as you grow. There are traders to watch, useful tasks to learn and names for places that once seemed far away.", 9, [stat("knowledge", 2)], ["strabo-alexandria"]),
  at("a-place-to-learn", "A place to learn", "Your household looks for a way to prepare you for adult work. There is no single path shared by every child; training depends on opportunity, status and the people around you.", 12, [
    one("practice-reading", "Continue learning to read and reckon", "You practise with a patient reader, fitting lessons around other responsibilities.", [flag("literate"), stat("knowledge", 9), stat("wealth", -2)]),
    one("join-workbench", "Learn beside an experienced craft worker", "Tools and materials begin to make sense in your hands. Repetition teaches what a hurried glance cannot.", [flag("apprenticed"), stat("knowledge", 7), stat("wealth", 2)]),
    one("help-household", "Give more of your time to the household", "Your work makes an immediate difference at home, even while other opportunities remain out of reach.", [stat("bonds", 6), stat("wealth", 3)]),
  ], ["education-apprenticeship"]),
  at("the-first-wages", "The first work of your own", "You are old enough to be trusted with more demanding tasks. The people around you begin to see both what you can do and what you still need to learn.", 16, [
    one("steady-work", "Take the steady work available nearby", "The pay is modest, but the familiar work gives you a beginning.", [stat("wealth", 4), stat("bonds", 2)]),
    one("seek-experience", "Look for a task that teaches you more", "You choose a demanding beginning. Some days bring more experience than pay.", [stat("knowledge", 6), stat("wealth", 1)]),
  ], ["augustan-alexandria-documents", "education-apprenticeship"]),
  at("a-place-on-the-manifest", "A name on the manifest", "There is work close to home and a place for willing hands aboard a merchant ship. If you have learned your letters, a copyist's workshop offers another possibility. Which way will you begin your adult life?", 18, [
    option("stay", "Stay and build a life here", [result("a-familiar-door", "You choose the familiar streets. Small jobs and useful introductions begin to give your days a shape.", [flag("stayed"), stat("bonds", 7), stat("wealth", 4)], 3), result("a-slow-beginning", "You stay, though regular work takes time to find. Your household makes room while you look.", [flag("stayed"), stat("bonds", 5), stat("wealth", -2)])]),
    option("sail", "Take a place with the ship's crew", [result("beyond-the-breakwater", "Your name goes onto the manifest. As the harbor slips behind you, excitement and homesickness arrive together.", [flag("sailed"), stat("knowledge", 6), stat("wealth", 5), stat("bonds", -5)], 3), result("a-hard-first-crossing", "The first crossing is tiring. You learn the work slowly and depend on the patience of the crew.", [flag("sailed"), stat("knowledge", 7), stat("health", -4), stat("bonds", -3)])]),
    option("study", "Learn in a copyist's workshop", [result("a-new-bench", "You find a place at a long workbench. The pay is small, but each page offers something to learn.", [flag("studied"), stat("knowledge", 10), stat("wealth", -3)])], has("literate")),
  ], ["strabo-alexandria", "education-apprenticeship", "augustan-alexandria-documents"]),
  at("letters-across-the-water", "Letters across the water", "A returning sailor can carry a message to your household. You can ask a writer to help if you need one. There is room for a few words and a small parcel.", 19, [
    one("write-home", "Send a long message home", "You describe ordinary things: the light, the work, the people you miss. A thread between two parts of your life stays unbroken.", [flag("kept-letters"), stat("bonds", 7), stat("wealth", -1)]),
    one("learn-port", "Spend the day learning the port", "You follow the quays and listen to unfamiliar voices. The place becomes a little easier to navigate.", [stat("knowledge", 5), stat("bonds", -2)]),
  ], ["alexandrian-letter", "strabo-alexandria"], has("sailed")),
  at("the-unfamiliar-page", "The unfamiliar page", "A damaged page arrives at the workshop. Some words are beyond you, but someone must begin the patient work.", 19, [
    one("work-together", "Work beside an experienced copyist", "Looking carefully and asking questions teaches you more than working in silence.", [stat("knowledge", 7), stat("bonds", 2)]),
    one("extra-work", "Take paid work instead", "Extra work puts a little money aside. Your own learning waits for quieter hours.", [stat("wealth", 5), stat("health", -2)]),
  ], ["education-apprenticeship"], has("studied")),
  at("the-neighbors-request", "The neighbor's request", "A neighbor asks for help arranging a small piece of work. You are beginning to be known as someone who can be relied upon.", 19, [
    one("help-neighbor", "Make time for your neighbor", "A small kindness becomes part of the trust people place in you.", [stat("bonds", 6), stat("knowledge", 2)]),
    one("fair-payment", "Agree on a fair payment", "You find a way to help while being paid for your time.", [stat("wealth", 5), stat("bonds", 2)]),
  ], ["augustan-alexandria-documents"], has("stayed")),
  at("room-for-one-more", "Room for one more", "A traveler needs a little help finding their feet. Your time and money are limited, but you remember starting out.", 20, [
    one("share-meal", "Share a meal and a little time", "An unhurried meal turns a stranger into someone you may meet again.", [stat("bonds", 6), stat("wealth", -2)]),
    one("share-skill", "Teach something useful", "Explaining your work makes you understand it more clearly.", [stat("knowledge", 4), stat("bonds", 3)]),
    one("make-introduction", "Introduce the traveler to someone with work", "A practical introduction helps someone else begin.", [stat("wealth", 2), stat("bonds", 2)]),
  ], ["alexandrian-letter"]),
  at("the-uneven-accounts", "The uneven accounts", "An agreement does not quite match what was promised. Settling the matter will take time, and someone is eager to finish quickly.", 22, [
    one("check-carefully", "Ask for a careful reading of the agreement", "The missing detail is found before anyone agrees. Patience protects your work.", [stat("knowledge", 4), stat("wealth", 3)]),
    one("seek-mediator", "Ask someone trusted to help settle it", "A familiar voice helps both sides find an arrangement they can accept.", [stat("bonds", 4), stat("wealth", 1)]),
    one("walk-away", "Leave the work and keep your time", "You give up the payment rather than a longer dispute.", [stat("health", 2), stat("wealth", -2)]),
  ], ["alexandrian-bakery-lease", "augustan-alexandria-documents"]),
  at("a-shared-household", "The possibility of a shared life", "You have grown close to someone. Joining households would mean affection, responsibility and conversations about property and obligations. A shared life will need more than a single promise.", 25, [
    one("share-life", "Make a household together", "Two sets of routines become one shared life. There are adjustments, and someone to come home to.", [flag("partnered"), stat("bonds", 10), stat("wealth", -3)]),
    one("remain-independent", "Keep your independence", "You choose a life shaped around your own work and friendships. Your household remains your own.", [stat("knowledge", 3), stat("wealth", 3)]),
  ], ["alexandrian-marriage"]),
  at("a-new-generation", "A new generation", "A child joins your household. There is delight, interrupted sleep and a new set of responsibilities. How will you make room for them?", 28, [
    one("share-parenting", "Share the work of care", "Time and care are rearranged around someone who depends on you.", [flag("parent"), stat("bonds", 9), stat("wealth", -3)]),
    one("ask-kin", "Ask relatives and neighbors to help", "The child grows within a circle wider than one pair of hands.", [flag("parent"), stat("bonds", 7), stat("wealth", -2)]),
  ], ["alexandrian-wetnursing", "family-care"], has("partnered")),
  at("a-younger-friend", "Someone beginning again", "A younger friend asks you how to find their place. You recognize the uncertainty in the question.", 28, [
    one("be-a-guide", "Offer time and practical guidance", "You become one of the people whose experience helps someone else begin.", [stat("bonds", 6), stat("knowledge", 3)]),
    one("make-space", "Give them a chance to work beside you", "A small opportunity becomes a beginning for another person.", [stat("bonds", 4), stat("wealth", 1)]),
  ], ["education-apprenticeship"], has("partnered", false)),
  at("an-unreliable-season", "A difficult season upriver", "Reports of an uneven harvest bring concern to the city. The household must decide what to keep in reserve and whom it can help.", 32, [
    one("keep-reserve", "Keep a small reserve for the household", "What you set aside makes an uncertain season easier to face.", [stat("wealth", -3), stat("bonds", 2)]),
    one("help-circle", "Share with the people closest to you", "Resources are stretched, but so are the ties that help people through.", [stat("wealth", -4), stat("bonds", 6)]),
  ], ["nile-floods", "strabo-alexandria"]),
  at("after-the-transition", "Learning the new arrangements", "Political rule has changed, but daily responsibilities continue. People still need work, food and agreements they can trust. You must find your own way through the new arrangements.", 36, [
    one("learn-new-forms", "Learn how the new arrangements work", "You listen, ask questions and slowly learn what has changed for your work.", [stat("knowledge", 6), stat("wealth", 2)]),
    one("rely-on-neighbors", "Stay close to your established network", "People who know your work help you navigate an uncertain transition.", [stat("bonds", 6), stat("wealth", 1)]),
  ], ["augustan-alexandria-documents", "augustus-res-gestae"]),
  note("the-weight-of-years", "A life with some weight to it", "At forty, the years behind you contain work, people and choices that no longer feel new. The shape of your life is clearer, though much remains unwritten.", 40, [stat("knowledge", 2)]),
  at("care-between-generations", "Care between generations", "An older relative needs more help. Work and care compete for the same hours, and there is no single answer that makes the difficulty disappear.", 43, [
    one("give-time", "Give more of your own time", "Your days become more crowded, and your presence matters to someone who needs it.", [stat("bonds", 7), stat("wealth", -3)]),
    one("share-care", "Arrange help across the household", "Care becomes a shared responsibility instead of one person's task.", [stat("bonds", 5), stat("wealth", -2)]),
  ], ["family-care"]),
  at("a-different-kind-of-work", "A different kind of work", "You notice that some tasks take longer than they once did. Experience still helps, even when strength and patience need to be spent more carefully.", 49, [
    one("work-with-experience", "Take work that depends on experience", "What you know begins to matter more than how much you can carry.", [stat("knowledge", 4), stat("health", 2)]),
    one("keep-pace", "Keep the familiar pace for now", "Familiar work continues to provide, though you feel its cost more clearly.", [stat("wealth", 4), stat("health", -3)]),
  ], ["family-care", "education-apprenticeship"]),
  at("a-trade-to-pass-on", "A trade to pass on", "Someone younger asks to learn from you. A skill can travel further than the hands that first practised it. You remember the people who once had patience for your own uncertain hands.", 53, [
    one("teach-patiently", "Make room for a learner", "You repeat lessons you once struggled to understand. Another person begins to carry the work forward.", [stat("knowledge", 4), stat("bonds", 7), stat("wealth", -1)]),
    one("keep-independent", "Keep working independently", "You continue the work in your own way, making a record of what you know when time permits.", [stat("wealth", 4), stat("knowledge", 2)]),
  ], ["alexandrian-apprenticeship", "education-apprenticeship"]),
  at("the-cost-of-rest", "The cost of rest", "Recovery takes longer than it once did. You must decide how much work to exchange for a little more time and ease.", 58, [
    one("take-rest", "Make more room for rest", "The days grow less crowded. You have a little less income and a little more energy for the people around you.", [stat("health", 5), stat("wealth", -3), stat("bonds", 2)]),
    one("reduce-a-little", "Reduce the work a little at a time", "You keep a place in familiar work while allowing yourself to slow down.", [stat("health", 2), stat("wealth", 1)]),
  ], ["family-care"]),
  at("stepping-back", "Stepping back", "Decades of work have made some things easier to understand and others harder to do. There is no modern pension waiting here; stepping back depends on resources, relationships and help.", 60, [
    one("step-back", "Let others carry more of the work", "You accept a different place in the household, with more time for advice, company and the smaller tasks.", [flag("retired"), stat("health", 4), stat("wealth", -4), stat("bonds", 4)]),
    one("continue-light-work", "Keep a little regular work", "A lighter rhythm keeps you involved without pretending the years have not changed you.", [stat("wealth", 2), stat("health", -1)]),
  ], ["family-care"]),
  at("putting-things-in-order", "Putting things in order", "You think about the belongings, obligations and knowledge that others may one day need to sort out. Some things can be written down; others need a conversation.", 65, [
    one("write-arrangements", "Arrange for your wishes to be recorded", "A careful conversation leaves fewer questions for the people who may have to act for you.", [flag("legacy-arranged"), stat("bonds", 5), stat("wealth", -2)]),
    one("speak-with-household", "Talk through what matters with your household", "People hear what you hope will be remembered, and what should happen to the things you leave.", [flag("legacy-arranged"), stat("bonds", 6)]),
  ], ["alexandrian-inheritance", "funerary-rituals"]),
  at("what-you-will-keep", "What you will keep", "The longest-lasting part of your work may be something you can give away. You decide where a little of your remaining energy should go.", 70, [
    one("guide-beginner", "Guide someone at the beginning of their life", "A lesson you once needed becomes useful to someone who will remember it.", [stat("bonds", 6), stat("knowledge", 3)]),
    one("gather-letters", "Gather your letters and memories", "You put names and words in order, keeping a record of a life that was larger than its work.", [flag("kept-letters"), stat("bonds", 4)]),
  ], ["alexandrian-letter", "education-apprenticeship"]),
  at("the-people-who-return", "The people who return", "A familiar person comes to sit with you. The visit is not an achievement to earn; it is a small part of the life you still share with others.", 75, [
    one("tell-old-stories", "Tell a story they have not heard", "One ordinary memory becomes new to someone else.", [stat("bonds", 5)]),
    one("listen", "Ask about their life instead", "For a while, you are simply together, each with something to give.", [stat("bonds", 5)]),
  ], ["family-care"]),
  at("the-small-pleasures", "The small pleasures", "In this later part of your life, the pace of a day is different. There are still choices about how to spend the time within it.", 80, [
    one("sit-in-light", "Find a quiet place in the afternoon light", "You let the day be small, noticing what once passed without your attention.", [stat("health", 2)]),
    one("welcome-company", "Welcome a little company", "Voices fill a familiar room. The world reaches you through other people's stories.", [stat("bonds", 4)]),
  ], ["family-care"]),
  note("names-remembered", "Names remembered", "You speak names that fewer people now recognize. Someone listens and repeats one back to you, keeping a small part of the past in the present.", 85, [stat("bonds", 2)]),
  note("a-later-season", "A later season", "Ninety years lie behind you. The days are quieter, and help from other people has become part of their shape.", 90, [], ["life-expectancy-egyptology"]),
  note("an-extraordinary-age", "An extraordinary age", "You have lived through more seasons than you once could imagine. The remaining days are lived one at a time, among familiar things and the people who know you.", 95, [], ["life-expectancy-egyptology"]),
  note("a-quiet-room", "A quiet room", "There is light at the doorway and the sound of a world continuing beyond it. Your life is still here, in this day.", 99),

  { ...at("a-letter-from-a-friend", "A letter from a friend", "A message brings news from someone whose life has taken a different course from yours. A writer can help with the words if needed.", 20, [
    one("send-reply", "Send a reply", "Your reply keeps an ordinary friendship alive across distance.", [stat("bonds", 4), stat("wealth", -1)]),
    one("keep-message", "Keep the message for another day", "You hold onto the words, though other responsibilities need your attention now.", [stat("bonds", 1)]),
  ], ["alexandrian-letter"]), trigger: { type: "random", weight: 2 }, when: all(age("gte", 20), age("lt", 65)), maxOccurrences: 3, cooldownYears: 12 },
  { ...at("an-unwell-week", "An unwell week", "For a while, ordinary work feels unusually difficult. The household must make room for a person who needs care. You have to decide which tasks can wait.", 15, [
    one("accept-care", "Accept help and rest", "Someone takes on a little of your work while you recover.", [stat("health", 3), stat("wealth", -2), stat("bonds", 2)]),
    one("work-more-slowly", "Do what you can at a slower pace", "You do less, and leave some tasks for another day.", [stat("health", -1), stat("wealth", 1)]),
  ]), trigger: { type: "random", weight: 1 }, when: all(age("gte", 15), age("lt", 75)), maxOccurrences: 2, cooldownYears: 18 },

  // Yearly briefs are authored personal fiction. Each age band has a broad pool;
  // historical anchors remain in their own dated lane above.
  ambient("small-familiar-voices", "A year of familiar voices", "The household's voices become easier to recognize. A face at the doorway, a song repeated, a hand reaching down: small things give your year its shape.", 1, 5),
  ambient("small-doorway", "The world beyond the doorway", "You spend more time watching the busy space outside. Sandals pass, people call to one another, and someone always brings you back from the edge of the doorway.", 1, 5),
  ambient("small-household-rhythm", "The rhythm of the household", "Your year follows other people's routines: work beginning, food being prepared, a quieter room at the end of the day. Familiar sounds tell you who is nearby.", 1, 5),
  ambient("small-new-words", "Words for small things", "A few more sounds become words you can use. The people around you begin to understand what you are asking for, even when patience runs short.", 1, 5, [stat("knowledge", 1)]),
  ambient("small-shared-shade", "Afternoons in the shade", "On warm afternoons, someone finds a cooler place for you to sit. There is company nearby and a view of feet, baskets and the small workings of a household.", 1, 5),
  ambient("small-returning-faces", "People who return", "Some visitors become familiar enough that you wait for them. Your small world grows through people who remember your name and stop to speak to you.", 1, 5, [stat("bonds", 1)]),

  ambient("child-neighborhood-paths", "Paths you know", "You learn another little part of the neighborhood this year. A doorway that once looked like every other doorway now belongs to someone you know.", 5, 12),
  ambient("child-useful-hands", "Small useful hands", "You are trusted with a few more small tasks. Carrying something carefully, remembering an instruction and returning on time all feel like important work.", 5, 12, [stat("knowledge", 1)]),
  ambient("child-found-treasure", "A small treasure", "A smooth stone becomes something worth keeping. You show it to another child, lose it for a while and find that the story of finding it matters almost as much.", 5, 12),
  ambient("child-shared-laughter", "A joke that lasts", "Something ordinary becomes a joke among the children. For days, the slightest reminder starts the laughter again, though the adults never quite understand it.", 5, 12, [stat("bonds", 1)]),
  ambient("child-watching-work", "Watching and trying", "You spend time watching a familiar task being done. This year someone lets you try a small part yourself, then patiently puts right what you have made awkward.", 5, 12),
  ambient("child-beyond-the-corner", "Beyond the next corner", "An errand takes you a little farther than usual. You return with the task done and a better picture of how the streets near home fit together.", 5, 12),

  ambient("youth-stronger-hands", "Stronger hands", "You notice the difference a year makes when a familiar task feels lighter. There are still awkward moments, but people begin asking for your help more often.", 12, 18),
  ambient("youth-learning-patience", "Learning patience", "A task refuses to go well the first time. Repeating it slowly teaches you something that a quick explanation did not.", 12, 18, [stat("knowledge", 1)]),
  ambient("youth-evening-conversation", "At the edge of the conversation", "You listen while older people discuss work and obligations. This year you find that you understand more of what worries them, even when you have little to add.", 12, 18),
  ambient("youth-changing-friendships", "Friendships finding new shapes", "Friends are given different tasks and begin keeping different hours. You learn to make room for one another as the old routines change.", 12, 18),
  ambient("youth-a-trusted-errand", "An errand entrusted to you", "Someone relies on you to remember a message accurately. You repeat it to yourself on the way and feel the quiet satisfaction of being trusted.", 12, 18, [stat("bonds", 1)]),
  ambient("youth-questions-about-work", "Questions about the years ahead", "Watching people work makes you think about the work you might do. Some possibilities seem close enough to touch; others still belong to an unfamiliar world.", 12, 18),

  ambient("adult-work-and-return", "Work, and the way home", "The year gathers around familiar journeys: leaving for work, meeting people along the way and returning with some part of the day still on your mind.", 18, 45),
  ambient("adult-a-repaired-belonging", "Something repaired", "A worn belonging is made useful again. The repair is small, but it saves the household from finding a replacement and gives someone a story to tell over the work.", 18, 45),
  ambient("adult-shared-meal", "A meal that runs long", "Company keeps a meal going longer than expected. News becomes conversation, and conversation becomes the sort of ordinary memory that belongs to a place.", 18, 45, [stat("bonds", 1)]),
  ambient("adult-the-busy-season", "A crowded stretch of days", "Work and household tasks arrive close together this year. Some things are finished, some are postponed, and you learn which promises need the most care.", 18, 45),
  ambient("adult-an-unhurried-hour", "An unhurried hour", "You find a little time with no task immediately waiting. Watching the movement around you, it is possible to feel part of the city without hurrying through it.", 18, 45),
  ambient("adult-someone-remembers", "Known by your work", "Someone remembers a piece of work you did and calls you by name. Being known brings small obligations, but also the comfort of having a place among people.", 18, 45),

  ambient("middle-familiar-work", "The value of familiar work", "Experience saves you a little effort this year. You recognize a problem before it grows and remember a way around it that once took time to learn.", 45, 65, [stat("knowledge", 1)]),
  ambient("middle-a-slower-morning", "A slower morning", "You allow a little more time before beginning a demanding task. The work gets done, though the order of the day is different from the one you once kept.", 45, 65),
  ambient("middle-a-younger-voice", "A younger voice", "Someone younger brings an unfamiliar suggestion. Listening to it reminds you that experience is useful without making every old habit the best one.", 45, 65),
  ambient("middle-household-rearranged", "A household rearranged", "Space and responsibilities are adjusted again. What belongs where, who can help and which task can wait become small conversations through the year.", 45, 65),
  ambient("middle-the-long-view", "A longer view", "A difficulty that once would have filled your thoughts now looks smaller. You have lived through enough changing years to know that a troubled week is not the whole story.", 45, 65),
  ambient("middle-an-old-acquaintance", "An old acquaintance", "You cross paths with someone whose face belongs to an earlier part of your life. There are changes to notice and familiar things neither of you needs to explain.", 45, 65, [stat("bonds", 1)]),

  ambient("later-company-at-the-door", "Company at the door", "A visit brings the life of another household into your room. You hear about small troubles and small successes, and the afternoon passes in company.", 65, 100, [stat("bonds", 1)]),
  ambient("later-familiar-things", "Familiar things", "You spend time among belongings that carry their own memories. A mark, a repair or a worn edge recalls the person who once helped make it useful.", 65, 100),
  ambient("later-a-helpful-hand", "A helpful hand", "Someone notices a task that has become awkward and helps before you have to ask. Accepting it makes room for a less hurried conversation.", 65, 100),
  ambient("later-news-from-outside", "News from outside", "People bring you pieces of a changing city: a new acquaintance, work found, a familiar doorway occupied by someone else. Your world still reaches beyond the room.", 65, 100),
  ambient("later-an-old-story", "An old story, told again", "You return to a memory you have told before. This time someone asks a different question, and a detail you had almost forgotten becomes part of the story.", 65, 100),
  ambient("later-the-light-changes", "The light changes", "The pattern of light in a familiar place marks the passing days. There are quieter pleasures now, and time to notice something that once passed unseen.", 65, 100),

  ambient("path-a-port-remembered", "A port remembered", "A name in conversation brings back another shore: the work, the unfamiliar voices and the first people who helped you find your way. That part of your life has not disappeared.", 20, 80, [], has("sailed")),
  ambient("path-a-careful-line", "A careful line", "You notice a well-made piece of writing and remember the patience needed to make words clear. Even away from the workbench, that habit of looking closely stays with you.", 20, 80, [], has("studied")),
  ambient("path-familiar-streets", "Familiar streets", "People you have known for years give familiar streets their meaning. A brief greeting is enough to remind you how much of your life has taken place close to home.", 20, 80, [], has("stayed")),
  ambient("family-shared-routines", "Routines you share", "You and your companion adjust the household's small routines again. There is no grand occasion, only the ongoing work of making a life with another person.", 26, 85, [], has("partnered")),
  ambient("family-a-child-growing", "Another person's beginning", "Someone you have helped care for can do a little more without you. Pride and the work of letting go arrive together, while another kind of help is still needed.", 29, 55, [], has("parent")),

  recurring("child-a-friend-needs-help", "A friend needs help", "Another child is struggling with a small task while your own play is waiting. Your caregivers let you decide how to spend this little part of the day.", 5, 12, [
    one("child-help-friend", "Stay and help", "You finish together. The task takes longer, but there is company in it.", [stat("bonds", 3)]),
    one("child-explain-task", "Show them what you know, then return to play", "You find a way to explain the task and leave them to try it.", [stat("knowledge", 2)]),
  ]),
  recurring("child-the-spare-afternoon", "A spare afternoon", "For once there is a little time with no errand waiting. You can spend it near a busy workbench or with the children outside.", 5, 12, [
    one("child-watch-work", "Watch how something is made", "An adult lets you watch closely and answers a few questions.", [stat("knowledge", 3)]),
    one("child-find-company", "Find the other children", "The afternoon is spent in company, with a new story to tell at home.", [stat("bonds", 3)]),
  ]),
  recurring("youth-the-extra-task", "An extra task", "Someone offers you an extra task. It will take time you had hoped to spend with familiar people, but it could teach you something useful.", 12, 18, [
    one("youth-try-task", "Try the unfamiliar work", "The task asks more of you than expected. You finish knowing something new.", [stat("knowledge", 3), stat("wealth", 1)]),
    one("youth-keep-time", "Keep the time you promised to others", "You keep your word and spend the time with the people expecting you.", [stat("bonds", 3)]),
  ]),
  recurring("youth-someone-to-ask", "Someone to ask", "You have a question about work that no longer feels small. A more experienced person has time to talk, if you are willing to admit what you do not know.", 12, 18, [
    one("youth-ask-question", "Ask the question openly", "A patient explanation makes the next attempt easier.", [stat("knowledge", 3)]),
    one("youth-watch-first", "Watch carefully before trying again", "You learn by looking closely and testing a small part for yourself.", [stat("knowledge", 2), stat("health", 1)]),
  ]),
  recurring("adult-the-loaned-tool", "A borrowed tool", "Someone you know asks to borrow a useful belonging. You need it too, and lending it will mean arranging your own work differently.", 18, 65, [
    one("adult-lend-tool", "Lend it and rearrange your tasks", "The belonging returns with thanks. Your own work takes a little longer.", [stat("bonds", 3), stat("wealth", -1)]),
    one("adult-share-time", "Offer a time when you can use it together", "You find a practical arrangement that leaves room for both sets of work.", [stat("bonds", 2), stat("knowledge", 1)]),
  ]),
  recurring("adult-an-extra-payment", "A little extra work", "A small piece of paid work is available, but the household has been waiting for your attention. Neither need will disappear on its own.", 18, 65, [
    one("adult-take-payment", "Take the work this time", "You bring home a little more, and some household tasks wait for another day.", [stat("wealth", 3), stat("health", -1)]),
    one("adult-make-time", "Keep the time for home", "You put your attention where you had promised it. The small payment goes to someone else.", [stat("bonds", 3), stat("health", 1)]),
  ]),
  recurring("adult-the-unfamiliar-method", "A different way to work", "Someone suggests a different way to do a familiar task. Trying it would cost time now, with no promise that it will suit you better.", 18, 65, [
    one("adult-try-method", "Give the new method a careful try", "Some parts are useful and some are not. You keep what helps.", [stat("knowledge", 3), stat("wealth", -1)]),
    one("adult-keep-method", "Use the method you know well", "The task is finished in a familiar way, with time left for other work.", [stat("wealth", 2)]),
  ]),
  recurring("adult-an-invitation", "An invitation", "An acquaintance invites you to spend a little time with people you do not yet know. You could go, or use the time to catch up with an old friend.", 18, 65, [
    one("adult-meet-people", "Accept the invitation", "New faces become names. One conversation gives you something to think about on the way home.", [stat("knowledge", 2), stat("bonds", 2)]),
    one("adult-old-friend", "Make time for an old friend", "A familiar conversation strengthens a connection that could easily have been left waiting.", [stat("bonds", 3)]),
  ]),
  recurring("later-a-question-of-energy", "Where your energy goes", "There are more things you could do today than you have energy for. Someone asks for advice while a small task of your own remains unfinished.", 65, 100, [
    one("later-give-advice", "Spend the time with the person asking", "The task can wait. You help someone see a difficulty a little more clearly.", [stat("bonds", 3)]),
    one("later-finish-task", "Finish your own task first", "Completing it brings a quiet satisfaction. You arrange to talk another day.", [stat("health", 1), stat("knowledge", 1)]),
  ]),
  recurring("later-a-memory-to-share", "A memory to share", "Someone asks about a place from your earlier life. You can tell the story yourself or ask a visitor to help put a few words in order.", 65, 100, [
    one("later-tell-memory", "Tell the story in your own time", "A memory becomes something shared between the people in the room.", [stat("bonds", 3)]),
    one("later-record-memory", "Ask for help recording the memory", "A few carefully chosen words keep a piece of your story within reach.", [flag("kept-letters"), stat("knowledge", 2), stat("wealth", -1)]),
  ]),
  recurring("later-a-small-outing", "A small outing", "Someone offers to accompany you on a short visit. It would be a change of scene, though a quiet day at home has its own appeal.", 65, 100, [
    one("later-take-outing", "Go together, at an easy pace", "The visit is short and unhurried. You return with news and a little more to talk about.", [stat("bonds", 2), stat("knowledge", 1)]),
    one("later-invite-instead", "Invite a visitor to come to you", "Company arrives at your door, bringing a piece of the outside world into a familiar room.", [stat("bonds", 3)]),
  ]),
  recurring("later-the-useful-belonging", "Something still useful", "You come across a belonging you seldom use now. Someone younger could make good use of it, though you have reasons to keep it nearby.", 65, 100, [
    one("later-give-belonging", "Pass it to someone who needs it", "The belonging begins another part of its story in different hands.", [stat("bonds", 3), stat("wealth", -1)]),
    one("later-keep-belonging", "Keep it, and explain what it means to you", "Telling its story helps another person understand why a small thing can matter.", [stat("knowledge", 1), stat("bonds", 1)]),
  ]),
];

const endingFor = age => age === 0 ? "death-in-infancy" : age < 15 ? "death-in-childhood" : age < 60 ? "death-in-adulthood" : "death-in-later-life";
const bands = model.intervals.map(row => ({ minAge: row.minAge, maxAge: row.nextAge - 1, annualProbability: 1 - (1 - row.deathProbability) ** (1 / (row.nextAge - row.minAge)), ending: endingFor(row.minAge) }));
bands.push({ minAge: 95, maxAge: 99, annualProbability: 1 - Math.exp(-1 / model.oldestAgeTail.sourceRemainingLifeExpectancy), ending: "death-in-later-life" });

const world = {
  schemaVersion: 1, id: "alexandria-sample", version: "0.3.0", title: "A life in Alexandria",
  description: "A complete fictional life in a free urban household, born in Alexandria in 66 BCE, through Ptolemaic and Roman rule. Historical anchors and inspired personal stories carry source links. Household weights, opportunities and stat effects are game assumptions. Mortality uses a disclosed later Roman Egyptian female comparison model, not measured male Alexandrian rates. This is not a representative simulation of every status, sex or population in ancient Egypt.",
  startYear: -66, maxAge: model.maxAge,
  stats: {
    health: { label: "Health", min: 0, max: 100, initial: 70 },
    knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0 },
    wealth: { label: "Resources", min: 0, max: 100, initial: 5 },
    bonds: { label: "Bonds", min: 0, max: 100, initial: 65 },
  },
  flags: Object.fromEntries([
    ["sailed", "Worked aboard a merchant ship"], ["studied", "Joined a copyist's workshop"], ["stayed", "Made a home in the city"],
    ["kept-letters", "Kept letters and memories"], ["literate", "Learned to read"], ["apprenticed", "Learned through practical training"],
    ["partnered", "Joined a shared household"], ["parent", "Cared for a child"], ["retired", "Stepped back from regular work"],
    ["experienced-war", "Lived during the Alexandrian War"], ["roman-rule", "Lived under Roman rule"], ["legacy-arranged", "Discussed wishes with the household"],
  ].map(([id, label]) => [id, { label, initial: false }])),
  origins: [
    { id: "merchant-household", title: "A merchant household", text: "You are born into a household whose work is tied to a small shop and the harbor. The sounds of work and the footsteps of neighbors surround your earliest days.", weight: 2, effects: [stat("wealth", 8)], evidence: "historically-inspired", sourceIds: ["strabo-alexandria", "augustan-alexandria-documents"] },
    { id: "artisan-household", title: "An artisan household", text: "You are born among people who earn their living through practiced hands and useful work. People work close together, sharing space, tools and the care of a new child.", weight: 3, effects: [stat("bonds", 3)], evidence: "historically-inspired", sourceIds: ["alexandrian-bakery-lease"] },
    { id: "harbor-household", title: "A harbor household", text: "Your household's work follows the needs of the quays. Other people, changing cargoes and the sound of ropes will be part of your earliest world.", weight: 3, effects: [stat("health", 3), stat("bonds", 6)], evidence: "historically-inspired", sourceIds: ["strabo-alexandria"] },
  ],
  yearlyEffects: [],
  eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3 },
  yearlyRules: [
    { id: "growing-child", when: all(age("gte", 1), age("lt", 15)), effects: [stat("health", 1)] },
    { id: "practical-experience", when: all(age("gte", 12), age("lt", 50)), effects: [stat("knowledge", 1)] },
    { id: "learning-through-words", when: all(age("gte", 6), age("lt", 60), has("literate")), effects: [stat("knowledge", 1)] },
    { id: "adult-livelihood", when: all(age("gte", 18), age("lt", 60), has("retired", false)), effects: [stat("wealth", 1)] },
    { id: "later-life-strength", when: age("gte", 45), effects: [stat("health", -1)] },
    { id: "later-household-resources", when: age("gte", 65), effects: [stat("wealth", -1)] },
  ],
  mortality: {
    description: "Annual death risks are derived from a Roman Egyptian female model table reproduced by Zakrzewski (2015), Table 1, after Bagnall and Frier. It is a later-period, different-sex comparison used for this fictional life—not measured death rates for a male born in Alexandria in 66 BCE. Annual interpolation, the 95+ tail and age 100 cap are modeling assumptions. The health/resources scores do not alter these all-cause risks; no exact cause of death is inferred.",
    sourceIds: model.sourceIds, bands,
  },
  events,
  endings: [
    { id: "death-in-infancy", kind: "death", title: "A life, however brief", text: "You die before your first birthday. Your life was brief, but you were here: held, named and part of a household's story. The years you did not live remain unwritten.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
    { id: "death-in-childhood", kind: "death", title: "The years left unwritten", text: "Your life ends in childhood. The places you knew and the people who cared for you carry a memory of the time you had. Your story was short; it was still a life.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
    { id: "death-in-adulthood", kind: "death", title: "The life you leave behind", text: "Your life comes to an end. Work is left unfinished, familiar voices continue without yours, and the people whose lives crossed yours remember you in their own ways.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
    { id: "death-in-later-life", kind: "death", title: "A life becomes a memory", text: "Your life comes to an end after many seasons. What remains is scattered among people, work, stories and small acts that once seemed ordinary. The harbor goes on, and you become part of its past.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
  ],
  defaultEnding: "death-in-later-life", sources,
};

const output = new URL("worlds/alexandria-sample.json", root);
writeFileSync(output, `${JSON.stringify(world, null, 2)}\n`);
console.log(`Built ${world.events.length} events, ${world.sources.length} sources and ${bands.length} mortality bands: ${fileURLToPath(output)}`);
