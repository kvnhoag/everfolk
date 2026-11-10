import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applySpecialists } from "./alexandria-specialists.mjs";
import { applyBackgroundVariety } from "./alexandria-backgrounds.mjs";
import { applyWorkTimeline } from "./alexandria-work-timeline.mjs";
import { applyInterestCareers } from "./alexandria-interest-careers.mjs";
import { applyCausalLife } from "./alexandria-causal-life.mjs";
import { applyStrictProgression } from "./alexandria-strict-progression.mjs";
import { applyCareerOpportunities } from "./alexandria-opportunities.mjs";
import { applyAdultMortality } from "./alexandria-adult-mortality.mjs";
import { applyMoneylender } from "./alexandria-moneylender.mjs";
import { applyEventVariety } from "./alexandria-event-variety.mjs";
import { applyRareEncounters } from "./alexandria-rare-encounters.mjs";
import { applyMastery } from "./alexandria-mastery.mjs";
import { applyEarlyLife } from "./alexandria-early-life.mjs";
import { applyLegacy } from "./alexandria-legacy.mjs";
import { applyChildhoodRoutes } from "./alexandria-childhood-routes.mjs";
import { applyCreditOpportunities } from "./alexandria-credit-opportunities.mjs";
import { applySkillCeiling } from "./alexandria-skill-ceiling.mjs";
import { applyPeople } from "./alexandria-people.mjs";
import { applySocialRoles } from "./alexandria-social-roles.mjs";
import { applyLifeProse } from "./alexandria-prose-life.mjs";
import { applyCareerProse } from "./alexandria-prose-careers.mjs";
import { applyClassicalEra } from "./alexandria-classical-era.mjs";
import { applyHouseholdOrigins } from "./alexandria-household-origins.mjs";
import { applyLateRoutes } from "./alexandria-late-routes.mjs";

const root = new URL("../", import.meta.url);
const sources = JSON.parse(readFileSync(new URL("research/sources.json", root), "utf8"));
const model = JSON.parse(readFileSync(new URL("research/mortality-model.json", root), "utf8"));
const balance = JSON.parse(readFileSync(new URL("research/adult-mortality-balance.json", root), "utf8")).mortality;
const stat = (id, delta) => ({ type: "stat", stat: id, delta });
const flag = (id, value = true) => ({ type: "flag", flag: id, value });
const skill = (id, delta) => ({ type: "skill", skill: id, delta });
const fatal = deathCause => ({ type: "end", ending: "death-in-adulthood", deathCause });
const trained = (id, value) => ({ type: "skill", skill: id, op: "gte", value });
const job = id => ({ type: "job", job: id });
const relationship = (status, partner) => ({ type: "relationship", status, ...(partner ? { partner } : {}) });
const knownPartner = partner => ({ type: "known-partner", partner });
const children = (op, value) => ({ type: "children", op, value });
const not = condition => ({ type: "not", condition });
const any = (...conditions) => ({ type: "any", conditions });
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
const physicalWork = any(...["porter", "potter", "sailor", "ceramic-decorator", "wood-carver", "sculptor", "soldier"].map(job));

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
    one("learn-letters", "Make time to learn the letters", "Repeated marks become familiar words. You have gained an opportunity to learn, not a guarantee of an easy life.", [flag("literate"), skill("literacy", 12), stat("knowledge", 12), stat("wealth", -2)]),
    one("learn-by-doing", "Learn through the household's work", "You learn by watching hands at work and trying small tasks for yourself. Practical knowledge has its own value.", [flag("apprenticed"), skill("craft", 8), stat("knowledge", 7), stat("bonds", 3)]),
  ], ["education-apprenticeship"]),
  note("the-shape-of-the-city", "A city of many kinds of work", "The quays, workshops and streets become less mysterious as you grow. There are traders to watch, useful tasks to learn and names for places that once seemed far away.", 9, [stat("knowledge", 2)], ["strabo-alexandria"]),
  at("a-place-to-learn", "A place to learn", "Your household looks for a way to prepare you for adult work. There is no single path shared by every child; training depends on opportunity, status and the people around you.", 12, [
    one("practice-reading", "Continue learning to read and reckon", "You practise with a patient reader, fitting lessons around other responsibilities.", [flag("literate"), skill("literacy", 12), skill("reckoning", 8), stat("knowledge", 9), stat("wealth", -2)]),
    one("join-workbench", "Learn beside an experienced craft worker", "Tools and materials begin to make sense in your hands. Repetition teaches what a hurried glance cannot.", [flag("apprenticed"), skill("craft", 14), stat("knowledge", 7), stat("wealth", 2)]),
    one("help-household", "Give more of your time to the household", "Your work makes an immediate difference at home, even while other opportunities remain out of reach.", [stat("bonds", 6), stat("wealth", 3)]),
  ], ["education-apprenticeship"]),
  at("the-first-wages", "The first work of your own", "You are old enough to be trusted with more demanding tasks. The people around you begin to see both what you can do and what you still need to learn.", 16, [
    one("steady-work", "Take porter work on the quays", "You take a porter's place carrying and sorting loads. The work is modest and tiring, but it is a beginning you can build on.", [job("porter"), stat("wealth", 4), stat("bonds", 2)], not(job("porter"))),
    one("seek-experience", "Look for a task that teaches you more", "You choose a demanding beginning. Some days bring more experience than pay.", [skill("craft", 5), stat("knowledge", 6), stat("wealth", 1)]),
    one("keep-first-job", "Keep your current job", "You turn down the offer and continue your current work.", [], not(job(null))),
  ], ["augustan-alexandria-documents", "education-apprenticeship"]),
  at("a-place-on-the-manifest", "A name on the manifest", "Porter work is available close to home. With Seamanship 15, a merchant ship offers a sailor's place; with Literacy 30, a copyist's workshop offers another possibility. Training in Your life can prepare you for these routes. Which way will you go?", 18, [
    option("stay", "Take porter work close to home", [result("a-familiar-door", "You choose porter work in familiar streets. Useful introductions begin to give your days a shape.", [flag("stayed"), job("porter"), stat("bonds", 7), stat("wealth", 4)], 3), result("a-slow-beginning", "You take porter work close to home, though the first payments are small. Your household makes room while you settle in.", [flag("stayed"), job("porter"), stat("bonds", 5), stat("wealth", -2)])], not(job("porter"))),
    option("sail", "Take a sailor's place with the ship's crew", [result("beyond-the-breakwater", "Your name goes onto the manifest. As the harbor slips behind you, excitement and homesickness arrive together.", [flag("sailed"), job("sailor"), skill("seamanship", 3), stat("knowledge", 6), stat("wealth", 5), stat("bonds", -5)], 3), result("a-hard-first-crossing", "The first crossing is tiring. You learn the work slowly and depend on the patience of the crew.", [flag("sailed"), job("sailor"), skill("seamanship", 4), stat("knowledge", 7), stat("health", -4), stat("bonds", -3)])], all(trained("seamanship", 15), not(job("sailor")))),
    option("study", "Become a copyist in the workshop", [result("a-new-bench", "You find a place at a long workbench. The pay is small, but each page offers something to learn.", [flag("studied"), job("copyist"), skill("literacy", 3), stat("knowledge", 10), stat("wealth", -3)])], all(trained("literacy", 30), not(job("copyist")))),
    one("keep-regular-job", "Keep your current job", "You pass on the offers and continue your current job.", [], not(job(null))),
  ], ["strabo-alexandria", "education-apprenticeship", "augustan-alexandria-documents"]),
  at("letters-across-the-water", "Letters across the water", "A returning sailor can carry a message to your household. You can ask a writer to help if you need one. There is room for a few words and a small parcel.", 19, [
    one("write-home", "Send a long message home", "You describe ordinary things: the light, the work, the people you miss. A thread between two parts of your life stays unbroken.", [flag("kept-letters"), stat("bonds", 7), stat("wealth", -1)]),
    one("learn-port", "Spend the day learning the port", "You follow the quays and listen to unfamiliar voices. The place becomes a little easier to navigate.", [stat("knowledge", 5), stat("bonds", -2)]),
  ], ["alexandrian-letter", "strabo-alexandria"], job("sailor")),
  at("the-unfamiliar-page", "The unfamiliar page", "A damaged page arrives at the workshop. Some words are beyond you, but someone must begin the patient work.", 19, [
    one("work-together", "Work beside an experienced copyist", "Looking carefully and asking questions teaches you more than working in silence.", [stat("knowledge", 7), stat("bonds", 2)]),
    one("extra-work", "Take paid work instead", "Extra work puts a little money aside. Your own learning waits for quieter hours.", [stat("wealth", 5), stat("health", -2)]),
  ], ["education-apprenticeship"], job("copyist")),
  at("the-neighbors-request", "The neighbor's request", "A neighbor asks for help arranging a small piece of work. You are beginning to be known as someone who can be relied upon.", 19, [
    one("help-neighbor", "Make time for your neighbor", "A small kindness becomes part of the trust people place in you.", [stat("bonds", 6), stat("knowledge", 2)]),
    one("fair-payment", "Agree on a fair payment", "You find a way to help while being paid for your time.", [stat("wealth", 5), stat("bonds", 2)]),
  ], ["augustan-alexandria-documents"], all(not(job(null)), not(job("sailor")), not(job("copyist")))),
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
  { ...note("a-shared-household", "Talk of marriage", "Friends mention people you might like to meet. You have room to start a relationship if you want one.", 25, [], ["alexandrian-marriage"]), when: any(relationship("single"), relationship("divorced")) },
  { ...note("a-new-generation", "Family plans", "You and your spouse talk about having a child and how you would share the care.", 28, [], ["alexandrian-wetnursing", "family-care"]), when: all(relationship("married"), children("eq", 0), age("lte", 43)) },
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
  ], ["family-care", "education-apprenticeship"], physicalWork),
  at("a-trade-to-pass-on", "A trade to pass on", "Someone younger asks to learn from you. A skill can travel further than the hands that first practised it. You remember the people who once had patience for your own uncertain hands.", 53, [
    one("teach-patiently", "Make room for a learner", "You repeat lessons you once struggled to understand. Another person begins to carry the work forward.", [stat("knowledge", 4), stat("bonds", 7), stat("wealth", -1)]),
    one("keep-independent", "Keep working independently", "You continue the work in your own way, making a record of what you know when time permits.", [stat("wealth", 4), stat("knowledge", 2)]),
  ], ["alexandrian-apprenticeship", "education-apprenticeship"]),
  at("the-cost-of-rest", "The cost of rest", "Recovery takes longer than it once did. You must decide how much work to exchange for a little more time and ease.", 58, [
    one("take-rest", "Make more room for rest", "The days grow less crowded. You have a little less income and a little more energy for the people around you.", [stat("health", 5), stat("wealth", -3), stat("bonds", 2)]),
    one("reduce-a-little", "Reduce the work a little at a time", "You keep a place in familiar work while allowing yourself to slow down.", [stat("health", 2), stat("wealth", 1)]),
  ], ["family-care"], not(job(null))),
  at("stepping-back", "Stepping back", "Decades of work have made some things easier to understand and others harder to do. There is no modern pension waiting here; stepping back depends on resources, relationships and help.", 60, [
    one("step-back", "Leave your regular job and let others carry more work", "You leave regular employment and accept a different place in the household, with more time for advice, company and the smaller tasks.", [flag("retired"), job(null), stat("health", 4), stat("wealth", -4), stat("bonds", 4)]),
    one("continue-light-work", "Keep a little regular work", "A lighter rhythm keeps you involved without pretending the years have not changed you.", [stat("wealth", 2), stat("health", -1)]),
  ], ["family-care"], not(job(null))),
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

  ambient("adult-work-and-return", "Work, and the way home", "The year gathers around familiar journeys: leaving for work, meeting people along the way and returning with some part of the day still on your mind.", 18, 45, [], not(job(null))),
  ambient("adult-a-repaired-belonging", "Something repaired", "A worn belonging is made useful again. The repair is small, but it saves the household from finding a replacement and gives someone a story to tell over the work.", 18, 45),
  ambient("adult-shared-meal", "A meal that runs long", "Company keeps a meal going longer than expected. News becomes conversation, and conversation becomes the sort of ordinary memory that belongs to a place.", 18, 45, [stat("bonds", 1)]),
  ambient("adult-the-busy-season", "A crowded stretch of days", "Work and household tasks arrive close together this year. Some things are finished, some are postponed, and you learn which promises need the most care.", 18, 45),
  ambient("adult-an-unhurried-hour", "An unhurried hour", "You find a little time with no task immediately waiting. Watching the movement around you, it is possible to feel part of the city without hurrying through it.", 18, 45),
  ambient("adult-someone-remembers", "Known by your work", "Someone remembers a piece of work you did and calls you by name. Being known brings small obligations, but also the comfort of having a place among people.", 18, 45),

  ambient("middle-familiar-work", "The value of familiar work", "Experience saves you a little effort this year. You recognize a problem before it grows and remember a way around it that once took time to learn.", 45, 65, [stat("knowledge", 1)], not(job(null))),
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
  ambient("family-shared-routines", "Routines you share", "You and your spouse adjust the household's small routines again. There is no grand occasion, only the ongoing work of making a life with another person.", 20, 85, [], relationship("married")),
  ambient("family-a-child-growing", "Another person's beginning", "One of your children can do a little more without you. Pride and the work of letting go arrive together, while another kind of help is still needed.", 21, 75, [], children("gte", 1)),

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

// New everyday stories are fictional, with no claim that a particular player
// experienced them. Dangerous options are voluntary and labelled before choosing.
const originalEventIds = new Set(events.map(event => event.id));
const originalOutcomeIds = new Set(events.flatMap(event => event.choices.flatMap(choice => choice.outcomes.map(outcome => outcome.id))));
events.push(
  ambient("small-spilled-porridge", "Porridge on the floor", "You knock over your bowl. Someone cleans the floor and gives you a smaller serving.", 1, 5),
  ambient("small-new-blanket", "A patched blanket", "A relative patches your blanket. You pull at the new stitching until they move your hand.", 1, 5),
  ambient("small-noisy-visitor", "A noisy visitor", "A visitor makes you laugh by copying animal sounds. You keep asking for the goat again.", 1, 5, [stat("bonds", 1)]),
  ambient("child-chipped-cup", "A chipped cup", "You chip a cup while clearing a meal. An adult shows you how to carry fewer things at once.", 5, 12, [skill("craft", 1)]),
  ambient("child-missing-goat", "The missing goat", "A neighbor's goat gets loose. You spot it chewing a basket and call for its owner.", 5, 12, [stat("bonds", 1)]),
  ambient("child-market-change", "Counting the change", "You bring home the right change from an errand. Your household lets you check the coins yourself.", 5, 12, [skill("reckoning", 1)]),
  ambient("child-rooftop-pigeons", "Pigeons on the roof", "You and a friend watch pigeons crowd around a rooftop. The owner comes out and chases them away.", 5, 12),
  ambient("youth-bakery-queue", "A queue at the bakery", "The bakery opens late. You wait with the other customers and get home after your household expected you.", 12, 18),
  ambient("youth-borrowed-tablet", "A borrowed writing tablet", "A neighbor lends you a tablet for an afternoon. You copy a short list and wipe it clean before returning it.", 12, 18, [skill("literacy", 1)]),
  ambient("youth-cart-wheel", "A cart blocks the lane", "A cart loses a wheel in a narrow lane. You help shift its baskets so people can get past.", 12, 18, [stat("bonds", 1)]),
  ambient("adult-bread-price", "Dearer bread", "Bread costs more at your usual stall. You buy a smaller loaf and add beans to the meal.", 18, 65, [stat("wealth", -1)]),
  ambient("adult-cloudy-water", "Cloudy water", "The water in a household jar looks dirty. You empty it, scrub the jar and fetch another load.", 18, 65),
  ambient("adult-misplaced-tools", "A missing tool", "You spend a morning looking for a tool. It turns up under a folded cloth where you left it.", 18, 65),
  ambient("adult-roof-leak", "A leak after rain", "Rain gets through a crack in the roof. You move a basket and patch the gap before the next shower.", 18, 65, [skill("craft", 1)]),
  ambient("adult-harbor-queue", "Waiting at the quay", "Several ships arrive together. The quay stays crowded while porters argue over where to put the cargo.", 18, 65),
  ambient("middle-loose-hinge", "A loose hinge", "A door scrapes the floor. You tighten its fittings and ask someone to lift it while you check the gap.", 45, 65, [skill("craft", 1)]),
  ambient("middle-new-measures", "Checking a measure", "A seller's grain measure looks smaller than yours. You compare them before agreeing on the price.", 45, 65, [skill("reckoning", 1)]),
  ambient("middle-late-payment", "A late payment", "Someone pays you later than agreed. You spend less for a few days until the money arrives.", 45, 65, [], not(job(null))),
  ambient("later-mended-sandals", "Mended sandals", "A strap comes loose from your sandal. A neighbor repairs it while you wait nearby.", 65, 100),
  ambient("later-borrowed-stool", "A better seat", "A visitor brings a low stool so you can sit outside more comfortably. You return it after the afternoon meal.", 65, 100, [stat("bonds", 1)]),
  ambient("later-misplaced-key", "The key turns up", "You cannot find a small key. After checking the room twice, you find it inside a bowl.", 65, 100),
  ambient("later-temple-visit", "A short visit", "A relative walks with you to a nearby temple. You rest in the shade before heading home.", 65, 100, [stat("bonds", 1)]),

  recurring("child-a-lost-coin", "A coin in the dust", "You find a coin where a seller has just packed up. They are still close enough to call.", 5, 12, [
    one("return-found-coin", "Call the seller back", "The seller thanks you and checks the rest of the purse.", [stat("bonds", 3)]),
    one("keep-found-coin", "Take the coin home", "You bring the coin home. Nobody comes looking for it.", [stat("wealth", 1), stat("bonds", -1)]),
  ]),
  recurring("child-a-clay-toy", "A broken clay toy", "A toy breaks during a game. You can try to mend it or ask the other children to play something else.", 5, 12, [
    one("mend-clay-toy", "Try to mend it", "The toy looks crooked, but the pieces hold together.", [skill("craft", 2), stat("knowledge", 1)]),
    one("change-the-game", "Start another game", "You leave the pieces aside and get everyone playing again.", [stat("bonds", 3)]),
  ]),
  recurring("youth-a-paid-errand", "An errand across town", "A trader offers a small payment for a delivery. It will take most of the afternoon.", 12, 18, [
    one("carry-paid-errand", "Take the delivery", "You get the parcel there on time and collect your payment.", [stat("wealth", 2), stat("health", -1)]),
    one("decline-paid-errand", "Keep your afternoon free", "The trader finds someone else. You spend the afternoon with friends.", [stat("bonds", 2), stat("health", 1)]),
  ]),
  recurring("youth-an-old-tool", "A cheap used tool", "A worker offers to sell you an old tool. It needs cleaning, but it could be useful for practice.", 12, 18, [
    one("buy-used-tool", "Buy and repair it", "You clean the tool and replace a worn fitting before using it.", [skill("craft", 4), stat("wealth", -2)], { type: "stat", stat: "wealth", op: "gte", value: 2 }),
    one("borrow-a-tool", "Borrow one when you need it", "A neighbor agrees to lend you a tool for short tasks.", [stat("bonds", 2)]),
  ]),
  recurring("adult-a-market-space", "Space at a market stall", "A seller has room on a stall for a few extra goods. You can pay for the space or help carry the stock instead.", 18, 60, [
    one("rent-market-space", "Pay for space and sell a small batch", "Some goods sell quickly and some come home with you.", [stat("wealth", 2), skill("reckoning", 2)]),
    one("help-market-seller", "Help the seller for a day's pay", "You carry stock, pack the stall and receive the agreed payment.", [stat("wealth", 1), stat("health", -1), stat("bonds", 1)]),
  ]),
  recurring("adult-a-noisy-neighbor", "Work next door", "A neighbor starts noisy repairs before sunrise. You have a long day ahead and want more sleep.", 18, 65, [
    one("agree-quieter-hours", "Ask them to start later", "You agree on quieter hours for the next few mornings.", [stat("bonds", 2), stat("health", 1)]),
    one("sleep-away-from-noise", "Move your sleeping place for now", "You shift your bedding to a quieter corner until the repairs finish.", [stat("health", 2), stat("bonds", -1)]),
  ]),
  recurring("adult-a-warehouse-fire", "Smoke from a warehouse", "Smoke comes from a warehouse doorway. Someone inside calls for help. Going through the smoke could kill you; people outside are forming a bucket line.", 18, 60, [
    one("join-fire-bucket-line", "Stay outside and pass water", "You pass buckets while others clear the nearby buildings.", [stat("bonds", 3), stat("health", -1)]),
    option("enter-burning-warehouse", "Go inside to help — risk of death", [
      result("fire-rescue-success", "You reach the person and help them out. You spend days coughing after the smoke.", [stat("bonds", 6), stat("health", -6)], 97),
      result("fire-rescue-injury", "Heat forces you back. Burns keep you away from work while others care for you.", [stat("health", -15), stat("wealth", -3)], 2),
      result("fire-rescue-fatal", "Carbon monoxide from the fire smoke makes you collapse before you reach the warehouse door. You do not survive the poisoning.", [fatal("warehouse-fire")], 1),
    ]),
  ]),
  recurring("adult-a-rough-crossing", "A rough crossing", "Bad weather is approaching. The master offers extra pay to sail now, but the crew could wait in port. Leaving in this weather could be fatal.", 18, 60, [
    one("wait-out-the-weather", "Wait in port", "The ship stays moored until the weather improves. You lose the extra payment.", [stat("health", 1), stat("wealth", -1)]),
    option("take-rough-crossing", "Sail for extra pay — risk of death", [
      result("rough-crossing-paid", "The crossing is rough, but the ship reaches port. You collect the extra pay and need a long rest.", [stat("wealth", 7), stat("health", -5), skill("seamanship", 2)], 97),
      result("rough-crossing-fatal", "A wave sweeps you overboard during the crossing. You drown before the crew can reach you.", [fatal("rough-sea-drowning")], 3),
    ]),
  ], job("sailor")),
  recurring("adult-robbers-in-a-lane", "Robbers in a narrow lane", "Two people block your path and demand your purse. You can hand it over and leave. Trying to fight them could be fatal.", 18, 60, [
    one("hand-over-purse", "Hand over the purse and leave", "They take the purse and let you go. You reach home unhurt.", [stat("wealth", -3), stat("health", 1)]),
    option("fight-the-robbers", "Try to fight them — risk of death", [
      result("robbers-driven-off", "You shout and push past them. Other people arrive before they can follow.", [stat("health", -4), stat("bonds", 1)], 98),
      result("robbers-fatal-wound", "One of the robbers stabs you in the abdomen. Blood loss from the wound proves fatal.", [fatal("street-assault")], 2),
    ]),
  ]),
  recurring("adult-water-from-a-dirty-jar", "Water in a dirty jar", "Your stored water smells wrong. Replacing it will cost time and money. Drinking it could cause a serious, sometimes fatal illness.", 18, 60, [
    one("replace-dirty-water", "Empty the jar and fetch fresh water", "You scrub the jar and replace the water before the next meal.", [stat("wealth", -1), stat("health", 2)]),
    option("use-dirty-water", "Use it anyway — risk of fatal illness", [
      result("dirty-water-no-illness", "You use the water and notice no illness afterward.", [stat("wealth", 1)], 94),
      result("dirty-water-illness", "You fall ill after using the water and miss several days of work.", [stat("health", -10), stat("wealth", -2)], 5),
      result("dirty-water-fatal", "After drinking the stored water, you develop dysentery with severe dehydration. You do not recover.", [fatal("unsafe-water")], 1),
    ]),
  ]),
  recurring("later-a-roof-repair", "A repair overhead", "A roof tile is loose. A worker can repair it, or a relative can help you arrange a cheaper patch from inside.", 65, 100, [
    one("pay-roof-worker", "Pay a worker to fix it", "The worker secures the tile and checks the tiles beside it.", [stat("wealth", -2), stat("health", 2)]),
    one("arrange-inside-patch", "Ask for help with an inside patch", "You and a relative stop the drip until a full repair can be made.", [stat("bonds", 2), stat("wealth", -1)]),
  ]),
  recurring("later-a-shared-chore", "Vegetables to prepare", "A neighbor brings vegetables to prepare for a meal. You could help with the cutting or contribute some ingredients.", 65, 100, [
    one("help-prepare-vegetables", "Help prepare the meal", "You sit together and finish the vegetables before the pot is ready.", [stat("bonds", 3), stat("health", -1)]),
    one("contribute-ingredients", "Contribute ingredients instead", "You add a few things from your stores and rest while the others cook.", [stat("wealth", -1), stat("health", 2)]),
  ]),
);

const endingFor = age => age === 0 ? "death-in-infancy" : age < 15 ? "death-in-childhood" : age < 60 ? "death-in-adulthood" : "death-in-later-life";
const sourceBands = model.intervals.map(row => ({ minAge: row.minAge, maxAge: row.nextAge - 1, annualProbability: 1 - (1 - row.deathProbability) ** (1 / (row.nextAge - row.minAge)), ending: endingFor(row.minAge) }));
sourceBands.push({ minAge: 95, maxAge: 99, annualProbability: 1 - Math.exp(-1 / model.oldestAgeTail.sourceRemainingLifeExpectancy), ending: "death-in-later-life" });
const bands = [];
for (let currentAge = 0; currentAge < model.maxAge; currentAge++) {
  const sourceBand = sourceBands.find(band => currentAge >= band.minAge && currentAge <= band.maxAge);
  const multiplier = balance.ageMultipliers.find(band => currentAge >= band.minAge && currentAge <= band.maxAge)?.multiplier ?? balance.defaultMultiplier;
  const annualProbability = sourceBand.annualProbability * multiplier;
  const previous = bands.at(-1);
  if (previous && previous.annualProbability === annualProbability && previous.ending === sourceBand.ending) previous.maxAge = currentAge;
  else bands.push({ minAge: currentAge, maxAge: currentAge, annualProbability, ending: sourceBand.ending });
}

// Report the actual generated gameplay curve, without changing source claims.
const survivalTo = birthday => {
  let survival = 1;
  for (let currentAge = 0; currentAge < birthday; currentAge++) {
    survival *= 1 - bands.find(band => currentAge >= band.minAge && currentAge <= band.maxAge).annualProbability;
  }
  return survival;
};
const percent = probability => `${(probability * 100).toFixed(2)}%`;
const playSurvivalSummary = `For new lives, about ${percent(1 - survivalTo(1))} die before their first birthday; ${percent(survivalTo(18))} reach age 18, ${percent(survivalTo(40))} reach age 40, and ${percent(survivalTo(60))} reach age 60. These calculated gameplay probabilities describe background mortality only and exclude optional fatal choices.`;

// The people, thresholds, annual returns and cause weights below are authored
// gameplay. The source registry supports context, not these numerical balances.
const characterJobs = [
  { id: "porter", title: "Quay porter", description: "Carry and sort cargo near the harbor. Open to a beginner, with tiring work and a modest return.", minAge: 16, yearlyEffects: [stat("wealth", 2), stat("health", -1), skill("seamanship", 1)] },
  { id: "potter", title: "Potter", description: "Shape and finish everyday vessels in a workshop. Practical training brings steadier work.", minAge: 16, requirements: { craft: 15 }, yearlyEffects: [stat("wealth", 3), stat("health", -1), skill("craft", 2)] },
  { id: "clerk", title: "Merchant's clerk", description: "Keep lists and check small accounts. Reading and practical numeracy both matter.", minAge: 18, requirements: { literacy: 20, reckoning: 20 }, yearlyEffects: [stat("wealth", 3), stat("knowledge", 1), skill("literacy", 1), skill("reckoning", 1)] },
  { id: "copyist", title: "Workshop copyist", description: "Copy and check written work patiently. There is more learning than immediate wealth.", minAge: 18, requirements: { literacy: 30 }, yearlyEffects: [stat("wealth", 2), stat("knowledge", 2), skill("literacy", 2)] },
  { id: "sailor", title: "Merchant sailor", description: "Work aboard a merchant ship. The return comes with hard work and time away from familiar people.", minAge: 18, requirements: { seamanship: 15 }, yearlyEffects: [stat("wealth", 3), stat("health", -1), stat("bonds", -1), skill("seamanship", 2)] },
  { id: "shopkeeper", title: "Small-shop keeper", description: "Manage goods, customers and accounts. Experience helps, but responsibilities leave less time for company.", minAge: 22, requirements: { reckoning: 35, craft: 10 }, yearlyEffects: [stat("wealth", 4), stat("bonds", -1), skill("reckoning", 1)] },
];
const characterPartners = [
  { id: "demetria", name: "Demetria", ageOffset: 0, occupation: "Potter", description: "Demetria makes everyday pottery in a workshop. She is patient at work and often jokes with the other workers." },
  { id: "thais", name: "Thais", ageOffset: 2, occupation: "Market trader", description: "Thais sells goods at the market and knows many of the regular customers. She likes hearing news from travelers." },
  { id: "berenike", name: "Berenike", ageOffset: -1, occupation: "Linen worker", description: "Berenike works with linen and often shares meals with friends after work. She is quick to offer help with a task." },
  { id: "tyche", name: "Tyche", ageOffset: 1, occupation: "Copyist", description: "Tyche copies documents in a workshop. She enjoys reading unfamiliar material and asking how things work." },
];
const activity = (id, text, category, minAge, outcome, effects, when, cooldownYears = 1) => ({
  ...one(id, text, outcome, effects, when), category, minAge, cooldownYears,
});
const enoughResources = value => ({ type: "stat", stat: "wealth", op: "gte", value });
const skillBelow = (id, value) => ({ type: "skill", skill: id, op: "lt", value });
const characterActivities = [
  activity("train-literacy", "Practise letters with a reader", "training", 6, "You pay for time with a patient reader and practise the marks until they become a little more familiar.", [skill("literacy", 10), flag("literate"), stat("knowledge", 1), stat("wealth", -2)], all(enoughResources(2), skillBelow("literacy", 100))),
  activity("train-reckoning", "Practise counting and accounts", "training", 8, "A trader lets you work through small counts and check them again. The lesson costs time and resources.", [skill("reckoning", 10), stat("knowledge", 1), stat("wealth", -2)], all(enoughResources(2), skillBelow("reckoning", 100))),
  activity("train-craft", "Practise at a workshop bench", "training", 10, "You work through a small task under supervision. Tired hands and a little spoiled material are part of the lesson.", [skill("craft", 10), flag("apprenticed"), stat("knowledge", 1), stat("wealth", -1), stat("health", -1)], all(enoughResources(1), skillBelow("craft", 100))),
  activity("train-seamanship", "Learn ropes and shipboard tasks", "training", 14, "You practise knots, loads and the movements expected aboard a ship. Repetition teaches more than watching from the quay.", [skill("seamanship", 10), stat("knowledge", 1), stat("wealth", -1), stat("health", -1)], all(enoughResources(1), skillBelow("seamanship", 100))),
  ...characterJobs.map(definition => activity(`work-${definition.id}`, `Become a ${definition.title.toLowerCase()}`, "career", definition.minAge,
    `You arrange to start work as a ${definition.title.toLowerCase()} and pay for a few initial supplies.`,
    [job(definition.id), flag("retired", false), flag(definition.id === "sailor" ? "sailed" : ["clerk", "copyist"].includes(definition.id) ? "studied" : "stayed"), stat("wealth", -1)],
    all(not(job(definition.id)), ...Object.entries(definition.requirements ?? {}).map(([id, minimum]) => trained(id, minimum))))),
  activity("careful-copy", "Accept a difficult copying task", "career", 18, "Your practiced eye helps you prepare a clear copy of a difficult page. The extra payment comes after long, tiring hours.", [stat("wealth", 2), stat("knowledge", 2), stat("health", -1)], all(job("copyist"), trained("literacy", 50)), 3),
  activity("check-cargo-accounts", "Check a complicated set of accounts", "career", 18, "You work patiently through counts and payments until the figures agree. Extra responsibility brings a return and a long day.", [stat("wealth", 3), stat("knowledge", 2), stat("health", -1)], all(any(job("clerk"), job("shopkeeper")), trained("reckoning", 40)), 3),
  activity("pottery-order", "Accept a demanding pottery order", "career", 18, "Experience helps you finish a demanding order. The work pays, but leaves tired hands and less time for company.", [stat("wealth", 4), stat("health", -2), stat("bonds", -1)], all(job("potter"), trained("craft", 40)), 3),
  activity("shipboard-watch", "Take responsibility for a shipboard watch", "career", 18, "Your experience earns you a more responsible watch. You learn from the work, though the hours leave you weary.", [stat("wealth", 3), stat("knowledge", 1), stat("health", -2)], all(job("sailor"), trained("seamanship", 40)), 3),
  activity("leave-regular-work", "Leave your regular job", "career", 16, "You step away from regular work. There is time to recover and reconsider, while the household must manage with less.", [job(null), stat("health", 2), stat("bonds", 1), stat("wealth", -2)], not(job(null))),
  ...characterPartners.flatMap(partner => [
    { ...option(`court-${partner.id}`, `Ask ${partner.name} to begin a courtship`, [
      result(`court-${partner.id}-accepted`, `${partner.name} agrees to begin a courtship. You arrange to spend more time together.`, [{ type: "relationship", status: "courting", partner: partner.id }, stat("bonds", 3), stat("wealth", -1)], 3),
      result(`court-${partner.id}-declined`, `${partner.name} declines the courtship. You return home without making plans together.`, [stat("bonds", -1), stat("wealth", -1)]),
    ], all(knownPartner(partner.id), any(relationship("single"), relationship("divorced")))), category: "relationship", minAge: 20, cooldownYears: 2 },
    activity(`marry-${partner.id}`, `Plan a wedding with ${partner.name}`, "relationship", 20,
      `You and ${partner.name} marry. You pay for a modest meal and set up a shared household.`,
      [{ type: "relationship", status: "married", partner: partner.id }, stat("bonds", 5), stat("wealth", -3)], all(knownPartner(partner.id), relationship("courting", partner.id), enoughResources(3)), 5),
    activity(`time-with-${partner.id}`, `Make time for ${partner.name}`, "relationship", 20,
      `You and ${partner.name} share a meal and talk about the past few days.`,
      [stat("bonds", 3), stat("wealth", -1), stat("health", 1)], all(knownPartner(partner.id), any(relationship("courting", partner.id), relationship("married", partner.id)), enoughResources(1)), 2),
  ]),
  activity("end-courtship", "End your courtship", "relationship", 18, "You agree to stop courting and go your separate ways.", [{ type: "end-courtship" }, stat("bonds", -2)], relationship("courting")),
  activity("divorce", "Agree to end your marriage", "relationship", 20, "You and your spouse separate and divide the household belongings. Any children you have remain listed as your children.", [{ type: "divorce" }, stat("bonds", -6), stat("wealth", -3), stat("health", 1)], relationship("married"), 5),
  { ...option("grow-household", "Try to grow your household", [
    result("grow-household-birth", "A child is born. Your household buys supplies and shares the care.", [{ type: "child" }, stat("bonds", 5), stat("wealth", -4), stat("health", -2)], 3),
    result("grow-household-wait", "You do not have a child this year. You spend a little on preparations.", [stat("wealth", -1), stat("bonds", 1)]),
  ], all(relationship("married"), age("lte", 43), enoughResources(4), children("lt", 8))), category: "family", minAge: 20, cooldownYears: 2 },
  activity("family-time", "Spend an evening with the household", "family", 18, "You put the remaining tasks aside and share a meal with the household.", [stat("bonds", 3), stat("health", 1), stat("wealth", -1)], all(any(relationship("married"), children("gte", 1)), enoughResources(1)), 2),
  activity("care-for-children", "Help your children with their tasks", "family", 20, "You set work aside to help your children and pay for a few things they need.", [stat("bonds", 4), stat("wealth", -2)], all(children("gte", 1), enoughResources(2)), 2),
  activity("support-child-learning", "Pay for your children's learning", "family", 20, "You buy learning materials and arrange for someone to explain the parts your children find difficult.", [stat("bonds", 3), stat("knowledge", 1), stat("wealth", -3)], all(children("gte", 1), enoughResources(3)), 3),
  activity("take-a-rest-day", "Take a day off", "family", 12, "You leave paid tasks for another day, sleep longer and eat at home.", [stat("health", 5), stat("wealth", -1)], undefined, 2),
  activity("take-an-easy-walk", "Walk at an easy pace", "training", 8, "You take a short walk, stop in the shade and return before you are tired.", [stat("health", 2), stat("bonds", 1)], undefined, 2),
  activity("visit-a-friend", "Visit the neighbors", "family", 12, "You bring a little food and spend the afternoon with neighbors.", [stat("bonds", 4), stat("wealth", -1)], enoughResources(1), 2),
  activity("take-market-errands", "Take paid market errands", "career", 16, "You make deliveries for several stalls and collect small payments.", [stat("wealth", 2), stat("knowledge", 1), stat("health", -1)], undefined, 2),
  activity("mend-household-sandals", "Mend sandals and straps", "training", 12, "You replace worn straps and practise a stronger fastening. A repaired pair can be used again.", [skill("craft", 4), stat("wealth", 1), stat("health", -1)], skillBelow("craft", 100), 2),
  activity("help-count-stock", "Help count a seller's stock", "training", 14, "You count jars and baskets, then check the total with the seller. They pay you a little for the help.", [skill("reckoning", 4), stat("wealth", 1), stat("health", -1)], skillBelow("reckoning", 100), 2),
  activity("cook-a-shared-meal", "Cook a meal for the household", "family", 16, "You buy ingredients, prepare the meal and eat with the household.", [stat("bonds", 3), stat("health", 2), stat("wealth", -2)], enoughResources(2), 2),
  activity("clean-the-water-jars", "Clean and refill the water jars", "family", 12, "You scrub the jars, rinse them and fetch fresh water. The work takes most of the morning.", [stat("health", 3), stat("wealth", -1)], enoughResources(1), 2),
  activity("take-day-cargo-work", "Take an extra daytime cargo shift", "career", 18, "You move cargo with a crew in daylight. The extra pay comes with sore arms and less rest.", [stat("wealth", 4), stat("health", -2)], all(age("lt", 60), any(job("porter"), job("sailor"))), 2),
  activity("join-an-evening-song", "Join an evening of songs", "relationship", 16, "You share food, listen to songs and learn a verse that the others know.", [stat("bonds", 3), stat("knowledge", 1), stat("wealth", -1)], enoughResources(1), 3),
  { ...option("take-night-cargo-work", "Move heavy cargo at night (risk of death)", [
    result("night-cargo-paid", "The load is moved without an accident. You collect extra pay and sleep through most of the next morning.", [stat("wealth", 8), stat("health", -3), stat("bonds", -1)], 97),
    result("night-cargo-injury", "A load shifts in the dark and injures your leg. You miss work while it heals.", [stat("health", -12), stat("wealth", -3)], 2),
    result("night-cargo-fatal", "A heavy cargo load slips from its ropes and falls onto your chest. The chest crush injury is fatal.", [fatal("cargo-crush")], 1),
  ], all(age("lt", 60), any(job("porter"), job("sailor")))), category: "career", minAge: 18, cooldownYears: 4 },
  { ...option("swim-offshore", "Swim beyond the harbor steps (risk of drowning)", [
    result("offshore-swim-complete", "You swim out from the steps and return. The current is stronger than you expected, and you need a long rest.", [stat("health", -3), skill("seamanship", 3)], 98),
    result("offshore-swim-fatal", "A current carries you away from the harbor steps. You drown before anyone reaches you.", [fatal("swimming-drowning")], 2),
  ], all(age("lt", 60), trained("seamanship", 15), { type: "stat", stat: "health", op: "gte", value: 30 })), category: "training", minAge: 18, cooldownYears: 6 },
];
const character = {
  skills: Object.fromEntries([["literacy", "Literacy"], ["reckoning", "Reckoning"], ["craft", "Craft"], ["seamanship", "Seamanship"]].map(([id, label]) => [id, { label, min: 0, max: 100, initial: 0 }])),
  // Fictional name choices for the setting, not population frequencies.
  playerNames: ["Damon", "Apollonios", "Demetrios", "Dionysios", "Herakleides", "Isidoros", "Kallias", "Leon", "Lysimachos", "Menandros", "Nikandros", "Ptolemaios", "Sarapion", "Soter", "Theon", "Tryphon"],
  requireIntroductions: true,
  exclusiveCourtship: true,
  jobs: characterJobs, partners: characterPartners, activities: characterActivities,
  childNames: ["Dion", "Myrine", "Heron", "Niko", "Philainis", "Heliodoros", "Eirene", "Sarapion", "Kleio", "Ptolemais", "Isidora", "Apollonios", "Melas", "Charis", "Theron", "Doris"],
  deathCauseDescription: "Specific disease and injury labels are modern names authored for clarity; they are not diagnoses inferred from the mortality sources. Natural-death cause labels are fictional explanations selected after the comparative all-cause mortality draw; they add no extra annual hazard. Causes marked choiceOnly are used only when an explicitly dangerous choice or activity draws its fatal outcome. Those outcome weights are authored game risks, not measured historical rates. Neither cause labels nor risk weights come from the cited mortality sources. Family-planning ages, job returns and skill thresholds are also authored game balances.",
  deathCauses: [
    { id: "early-illness", title: "Pneumonia", text: "Pneumonia makes breathing difficult. Your household cares for you, but the infection worsens and you die.", weight: 6, when: age("lt", 5) },
    { id: "severe-fever", title: "Malaria", text: "Malaria causes repeated fever and severe weakness. You do not recover.", weight: 4, when: age("gte", 5) },
    { id: "abdominal-illness", title: "Dysentery", text: "Dysentery causes persistent diarrhoea and dehydration. You grow weaker and die.", weight: 3, when: age("gte", 1) },
    { id: "breathing-illness", title: "Tuberculosis", text: "Tuberculosis causes a persistent cough and severe weakness. The infection becomes fatal.", weight: 3, when: age("gte", 1) },
    { id: "work-injury", title: "Traumatic brain injury after a fall", text: "You fall while moving materials at work and hit your head. The traumatic brain injury is fatal.", weight: 1, when: any(job("porter"), job("potter")) },
    { id: "sea-accident", title: "Drowning after falling overboard", text: "You fall overboard while working on a ship and drown before the crew can reach you.", weight: 2, when: job("sailor") },
    { id: "war-violence", title: "Penetrating chest wound", text: "You suffer a penetrating chest wound during the fighting in Alexandria. The injury is fatal.", weight: 2, when: any({ type: "year", op: "eq", value: -48 }, { type: "year", op: "eq", value: -47 }) },
    { id: "later-decline", title: "Stroke", text: "A stroke causes sudden weakness and difficulty speaking. Your condition worsens and you die.", weight: 5, when: age("gte", 60) },
    { id: "sudden-illness", title: "Sepsis", text: "An infection leads to sepsis and organ failure. Your condition worsens quickly, and you die.", weight: 1 },
    { id: "warehouse-fire", title: "Carbon monoxide poisoning", text: "You enter a burning warehouse. Carbon monoxide poisoning makes you collapse before you can get out.", weight: 1, choiceOnly: true },
    { id: "rough-sea-drowning", title: "Drowning", text: "A wave sweeps you overboard during the crossing. You drown before the crew can reach you.", weight: 1, choiceOnly: true },
    { id: "cargo-crush", title: "Chest crush injury", text: "A suspended cargo load falls onto your chest. The chest crush injury is fatal.", weight: 1, choiceOnly: true },
    { id: "street-assault", title: "Stab wound to the abdomen", text: "One of the robbers stabs you in the abdomen. Blood loss from the wound proves fatal.", weight: 1, choiceOnly: true },
    { id: "unsafe-water", title: "Dysentery with severe dehydration", text: "After drinking the stored water, you develop dysentery with severe dehydration. You do not recover.", weight: 1, choiceOnly: true },
    { id: "swimming-drowning", title: "Drowning", text: "A current carries you away from the harbor steps. You drown before anyone reaches you.", weight: 1, choiceOnly: true },
  ],
};

const world = {
  schemaVersion: 1, id: "alexandria-sample", version: "0.18.0", title: "A life in Alexandria",
  description: "A fictional life born in Alexandria in 66 BCE. Learn a trade, study, build a household or try rare military and court careers. Childhood and adult background death risks are reduced for playability from a disclosed later Roman Egyptian female comparison model. Personal events, career odds and stat effects are authored game rules, not measured historical frequencies.",
  startYear: -66, maxAge: model.maxAge,
  stats: {
    health: { label: "Health", min: 0, max: 100, initial: 70, initialRange: { min: 60, max: 80 } },
    knowledge: { label: "Knowledge", min: 0, max: 100, initial: 0, initialRange: { min: 0, max: 2 } },
    wealth: { label: "Resources", min: 0, max: 100, initial: 5, initialRange: { min: 2, max: 8 } },
    bonds: { label: "Bonds", min: 0, max: 100, initial: 65, initialRange: { min: 55, max: 75 } },
  },
  flags: Object.fromEntries([
    ["sailed", "Worked aboard a merchant ship"], ["studied", "Joined a copyist's workshop"], ["stayed", "Made a home in the city"],
    ["kept-letters", "Kept letters and memories"], ["literate", "Learned to read"], ["apprenticed", "Learned through practical training"],
    ["partnered", "Joined a shared household"], ["parent", "Cared for a child"], ["retired", "Stepped back from regular work"],
    ["experienced-war", "Lived during the Alexandrian War"], ["roman-rule", "Lived under Roman rule"], ["legacy-arranged", "Discussed wishes with the household"],
  ].map(([id, label]) => [id, { label, initial: false }])),
  origins: [
    { id: "merchant-household", title: "A merchant household", text: "You are born into a household whose work is tied to a small shop and the harbor. The sounds of work and the footsteps of neighbors surround your earliest days.", weight: 2, statRanges: { health: { min: 60, max: 80 }, knowledge: { min: 0, max: 3 }, wealth: { min: 8, max: 18 }, bonds: { min: 55, max: 75 } }, effects: [], evidence: "historically-inspired", sourceIds: ["strabo-alexandria", "augustan-alexandria-documents"] },
    { id: "artisan-household", title: "An artisan household", text: "You are born among people who earn their living through practiced hands and useful work. People work close together, sharing space, tools and the care of a new child.", weight: 3, statRanges: { health: { min: 60, max: 80 }, knowledge: { min: 0, max: 2 }, wealth: { min: 2, max: 8 }, bonds: { min: 58, max: 78 } }, effects: [], evidence: "historically-inspired", sourceIds: ["alexandrian-bakery-lease"] },
    { id: "harbor-household", title: "A harbor household", text: "Your household's work follows the needs of the quays. Other people, changing cargoes and the sound of ropes will be part of your earliest world.", weight: 3, statRanges: { health: { min: 63, max: 83 }, knowledge: { min: 0, max: 2 }, wealth: { min: 1, max: 9 }, bonds: { min: 61, max: 81 } }, effects: [], evidence: "historically-inspired", sourceIds: ["strabo-alexandria"] },
  ],
  yearlyEffects: [],
  eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3 },
  yearlyRules: [
    { id: "growing-child", when: all(age("gte", 1), age("lt", 15)), effects: [stat("health", 1)] },
    { id: "practical-experience", when: all(age("gte", 12), age("lt", 50)), effects: [stat("knowledge", 1)] },
    { id: "learning-through-words", when: all(age("gte", 6), age("lt", 60), has("literate")), effects: [stat("knowledge", 1)] },
    { id: "adult-household-cost", when: age("gte", 18), effects: [stat("wealth", -1)] },
    { id: "later-life-strength", when: age("gte", 45), effects: [stat("health", -1)] },
    { id: "later-household-resources", when: age("gte", 65), effects: [stat("wealth", -1)] },
  ],
  mortality: {
    description: `Background death risks begin with the Roman Egyptian female comparison table in Zakrzewski (2015), Table 1. The source's stated life expectancy at birth of 22.5 years describes that comparison, not this easier game curve or a male born in Alexandria in 66 BCE. ${balance.description} ${playSurvivalSummary} The 95+ tail assumption and age-100 cap retain the prior rules. Health and Resources do not alter background risk. Explicitly dangerous choices can add their stated fatal outcome.`,
    sourceIds: model.sourceIds, bands,
  },
  character, events,
  endings: [
    { id: "death-in-infancy", kind: "death", title: "A life, however brief", text: "You die before your first birthday. Your life was brief, but you were here: held, named and part of a household's story. The years you did not live remain unwritten.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
    { id: "death-in-childhood", kind: "death", title: "The years left unwritten", text: "Your life ends in childhood. The places you knew and the people who cared for you carry a memory of the time you had. Your story was short; it was still a life.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
    { id: "death-in-adulthood", kind: "death", title: "The life you leave behind", text: "Your life comes to an end. Work is left unfinished, familiar voices continue without yours, and the people whose lives crossed yours remember you in their own ways.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
    { id: "death-in-later-life", kind: "death", title: "A life becomes a memory", text: "Your life comes to an end after many seasons. What remains is scattered among people, work, stories and small acts that once seemed ordinary. The harbor goes on, and you become part of its past.", evidence: "historically-inspired", sourceIds: ["life-expectancy-egyptology", "funerary-rituals"] },
  ],
  defaultEnding: "death-in-later-life", sources,
};

// Keep copy edits separate from rules and IDs so older saves remain pinned to
// their original pack. Player-facing prose describes what happened directly.
const plainEventCopy = {
  "caesar-in-alexandria": ["Fighting in Alexandria", "Caesar arrives in 48 BCE during the struggle for Egypt's throne. Fighting breaks out in Alexandria and reaches streets near the harbor."],
  "water-and-war": ["The city's water during the war", "The war continues into 47 BCE. A Roman account describes attempts to cut Caesar's water supply and the digging of wells."],
  "news-of-actium": ["News from Actium", "News arrives that Antony and Cleopatra's forces lost at Actium in 31 BCE. Octavian now has the advantage in the war."],
  "roman-rule": ["Egypt under Roman rule", "Ptolemaic rule ends in 30 BCE and Egypt comes under Roman control. Augustus later lists the addition of Egypt among his achievements."],
  "the-first-household": ["You are born", "You are born in Alexandria in 66 BCE. The adults in your household decide how to share your care."],
  "first-steps": ["Your first steps", "You take a few steps between two adults. They keep their hands close when you start to wobble."],
  "a-child-in-the-courtyard": ["Playing in the courtyard", "Other children play outside your door. Your caregivers decide whether to let you join them or keep you close to home."],
  "the-first-letters": ["Learning a few letters", "A neighbor offers to teach you a few letters. Lessons cost time and a little money, and your household still needs help with its work."],
  "the-shape-of-the-city": ["Around the neighborhood", "You learn the routes to nearby shops, workshops and quays. You can now finish a few errands without asking for directions."],
  "a-place-to-learn": ["Training for work", "Your household looks for someone to teach you. Reading, workshop training and helping at home are the options available."],
  "the-first-wages": ["A work offer", "A crew on the quays is looking for help. You can take porter work, try a short paid task or keep any work you already have."],
  "a-place-on-the-manifest": ["Job offers", "You hear about jobs on the quays, aboard a merchant ship and in a copyist's workshop. You can take an offer or keep your current work."],
  "letters-across-the-water": ["A message home", "A returning sailor can carry a message home. You can pay a writer to help or spend the day looking around the port."],
  "the-unfamiliar-page": ["A damaged page", "A damaged page reaches the workshop. An experienced copyist offers to work through it with you, but other paid work is also available."],
  "the-neighbors-request": ["A neighbor needs help", "A neighbor asks you to arrange a small job. You can help for free or agree on a payment."],
  "room-for-one-more": ["A traveler needs help", "A traveler asks for help finding work. You can offer a meal, teach a task or introduce them to someone hiring."],
  "the-uneven-accounts": ["An agreement does not add up", "The payment in an agreement is lower than you expected. Someone wants you to accept it quickly."],
  "a-shared-household": ["Talk of marriage", "Friends mention people you might like to meet. You have room to start a relationship if you want one."],
  "a-new-generation": ["Family plans", "You and your spouse talk about having a child and how you would share the care."],
  "a-younger-friend": ["A friend asks about work", "A younger friend wants help finding work. You could explain a few tasks or let them work beside you."],
  "an-unreliable-season": ["A poor harvest", "Reports of a poor harvest reach the city. Your household decides whether to store more food or share some supplies with relatives."],
  "after-the-transition": ["New rules for work", "Roman officials have changed some arrangements for work and agreements. You can ask about the new rules or get help from neighbors."],
  "the-weight-of-years": ["At forty", "You turn forty. You have handled enough jobs and household problems to recognize some of them quickly."],
  "care-between-generations": ["An older relative needs help", "An older relative needs help with meals and daily tasks. You must fit their care around paid work."],
  "a-different-kind-of-work": ["Changing your workload", "Carrying and lifting leave you tired for longer. You can take lighter tasks or keep working at the same pace."],
  "a-trade-to-pass-on": ["Teaching a learner", "A younger worker asks you to teach them. Lessons will take time away from your own orders."],
  "the-cost-of-rest": ["Taking more rest", "You have been slow to recover after work. You can take more days off or reduce your workload a little."],
  "stepping-back": ["Leaving regular work", "Your regular job is getting harder to manage. Leaving it will reduce your income, so your household will need to adjust."],
  "putting-things-in-order": ["Arranging your belongings", "You decide who should receive your belongings and settle your remaining obligations. You can record the arrangements or discuss them at home."],
  "what-you-will-keep": ["Sorting papers and letters", "You have a little time to help a younger person or sort the letters and papers you have kept."],
  "the-people-who-return": ["A visitor calls", "A familiar visitor sits with you for a while. You can tell them a story or ask for their news."],
  "the-small-pleasures": ["An afternoon at home", "You have a free afternoon. You can rest outside or ask someone to visit."],
  "names-remembered": ["An old neighbor's name", "You mention an old neighbor. Someone asks where they lived, and you describe the house."],
  "a-later-season": ["More help at home", "At ninety, you need more help with meals, washing and moving around the house."],
  "an-extraordinary-age": ["Your ninety-fifth year", "You turn ninety-five. Your household helps with most daily tasks and makes sure you have company."],
  "a-quiet-room": ["Resting at home", "You spend much of the day resting. Someone brings water and leaves the door open for air."],
  "a-letter-from-a-friend": ["A letter from a friend", "A friend sends news from another town. You can pay to send a reply or put the letter aside for now."],
  "an-unwell-week": ["An unwell week", "You feel ill and have trouble finishing your work. You can ask someone to cover your tasks or do less until you recover."],
  "small-familiar-voices": ["Recognizing voices", "You recognize the people who care for you and turn when they call. They repeat the same names and songs through the day."],
  "small-doorway": ["At the doorway", "You watch people pass the doorway. An adult brings you back inside whenever you wander too far."],
  "small-household-rhythm": ["Meals and naps", "Your caregivers fit meals and naps around their work. You object loudly when a meal is late."],
  "small-new-words": ["More words", "You learn a few more words and use them to ask for food, water and familiar people."],
  "small-shared-shade": ["Sitting in the shade", "Someone moves your seat out of the sun. You watch people carry baskets through the courtyard."],
  "small-returning-faces": ["A familiar visitor", "You recognize a visitor and reach toward them. They stop to talk and carry you for a while."],
  "child-neighborhood-paths": ["Knowing the way", "You learn a shorter route to a nearby shop. You get there and back before the household starts looking for you."],
  "child-useful-hands": ["Helping with small jobs", "You carry small items, clear dishes and repeat messages. Adults still check the jobs before letting you go."],
  "child-found-treasure": ["A smooth stone", "You find a smooth stone and keep it in a pouch. Another child offers to trade for it, but you keep it."],
  "child-shared-laughter": ["A running joke", "A friend makes everyone laugh during a game. You keep repeating the joke until the adults ask you to stop."],
  "child-watching-work": ["Trying a task", "An adult lets you try part of a familiar task. They correct your grip and help you finish."],
  "child-beyond-the-corner": ["A longer errand", "An errand takes you farther from home than usual. You find the right doorway and return with the delivery done."],
  "youth-stronger-hands": ["Heavier loads", "You can carry more than you could last year. People start asking you to help with heavier loads."],
  "youth-learning-patience": ["Trying again", "You get a task wrong several times. After someone shows you slowly, you manage to finish it."],
  "youth-evening-conversation": ["Talk after work", "You listen while adults discuss prices and work. You ask about one detail and get a long explanation."],
  "youth-changing-friendships": ["Different working hours", "Your friends start keeping different working hours. You arrange to meet when everyone is free."],
  "youth-a-trusted-errand": ["Delivering a message", "Someone sends you with a message. You repeat it on the way so you will not forget part of it."],
  "youth-questions-about-work": ["Asking about jobs", "You ask workers how they learned their jobs. Some offer advice; others are too busy to stop."],
  "adult-work-and-return": ["The walk to work", "You take the usual route to your job. A blocked lane makes you walk around the market on the way home."],
  "adult-a-repaired-belonging": ["Repairing a worn item", "You repair a worn household item instead of replacing it. The repair holds after a few adjustments."],
  "adult-shared-meal": ["A long meal", "Visitors stay after a meal to exchange news. You clear the dishes later than planned."],
  "adult-the-busy-season": ["A busy week", "Several jobs and household tasks need doing at once. You finish the urgent ones and leave the rest for later."],
  "adult-an-unhurried-hour": ["An hour off", "You finish a task early and sit outside for a while. A neighbor stops to ask how the work went."],
  "adult-someone-remembers": ["Asked to help again", "Someone you helped before asks for another job. They give your name to a neighbor who also needs help."],
  "middle-familiar-work": ["Spotting a mistake", "You notice a mistake before it causes more work. You show a younger worker what to check next time."],
  "middle-a-slower-morning": ["Starting later", "You start a heavy task later and take an extra break. It is finished before evening."],
  "middle-a-younger-voice": ["A worker's suggestion", "A younger worker suggests a different way to arrange a task. You try it and keep the part that saves time."],
  "middle-household-rearranged": ["Moving things around", "Your household moves bedding and storage jars to free some space. Everyone has to learn where things are now."],
  "middle-the-long-view": ["A delayed order", "An order is delayed for several days. You work on smaller tasks until the materials arrive."],
  "middle-an-old-acquaintance": ["Meeting an old acquaintance", "You meet someone you have not seen for years. You exchange news about work and people you both know."],
  "later-company-at-the-door": ["An afternoon visitor", "A visitor tells you about their household and stays for a drink. You ask them to come again next week."],
  "later-familiar-things": ["Sorting a storage box", "You sort a box of old belongings. Some are still useful, and some need cleaning or repair."],
  "later-a-helpful-hand": ["Help with a task", "Someone offers to carry something that has become difficult for you. You let them take it and explain where it belongs."],
  "later-news-from-outside": ["News from the street", "A visitor reports that a shop nearby has changed hands. You ask who is running it now."],
  "later-an-old-story": ["Telling an old story", "You tell a story about an old job. A listener asks a question, and you stop to explain the missing part."],
  "later-the-light-changes": ["Moving your chair", "The sun reaches your usual seat earlier this season. Someone moves the chair into the shade."],
  "path-a-port-remembered": ["News from another port", "Someone mentions a port where you once worked. You ask whether the landing place is still used."],
  "path-a-careful-line": ["Checking some writing", "You notice an unclear line on a page. You ask the writer to read it back before anyone copies it."],
  "path-familiar-streets": ["Greetings in the street", "You stop several times on a short errand because neighbors want to talk. The errand takes longer than expected."],
  "family-shared-routines": ["Sharing household tasks", "You and your spouse divide the week's household tasks. One of you swaps a task to fit around paid work."],
  "family-a-child-growing": ["Your child needs different help", "One of your children brings you a problem you have not handled before. You ask a few questions and work out how to help."],
  "child-a-friend-needs-help": ["A friend needs help", "A friend cannot finish a task. You can help, explain how to do it or return to your game."],
  "child-the-spare-afternoon": ["A free afternoon", "There is no errand waiting this afternoon. You can watch a worker or find the other children."],
  "youth-the-extra-task": ["An extra task", "Someone offers you an extra task for a small payment. You had planned to meet people during the same hours."],
  "youth-someone-to-ask": ["A question about work", "You are stuck on part of a task. An experienced worker has time to explain it if you ask."],
  "adult-the-loaned-tool": ["Lending a tool", "A neighbor asks to borrow a tool you also need. You could rearrange your work or agree on a time to use it together."],
  "adult-an-extra-payment": ["Extra paid work", "A small paid job is available. Taking it will leave less time for household tasks."],
  "adult-the-unfamiliar-method": ["Trying another method", "Someone suggests a different way to finish a task. Trying it will take time and some material."],
  "adult-an-invitation": ["An invitation", "An acquaintance invites you to a gathering. You could go or visit an old friend instead."],
  "later-a-question-of-energy": ["Two tasks at once", "Someone asks for advice while you are finishing a task. You have enough energy to do one of them today."],
  "later-a-memory-to-share": ["A question about an old place", "A visitor asks about a place where you once lived. You can describe it or ask someone to write down the details."],
  "later-a-small-outing": ["A short outing", "Someone offers to walk with you on a short visit. You could go or invite a visitor to come to your home."],
  "later-the-useful-belonging": ["An item you no longer use", "You find an item you seldom use. Someone else could use it, but you might still want to keep it."],
};
const plainOutcomeCopy = {
  "family-care-result": "Your relatives take turns feeding, holding and settling you.",
  "seek-help-result": "A trusted neighbor helps with feeding and care. Your household pays for a few supplies.",
  "close-to-home-result": "You play near the adults and help put small things away.",
  "play-with-neighbors-result": "You play with the other children and come home with dusty feet.",
  "learn-letters-result": "You practise until you can recognize and copy a few letters.",
  "learn-by-doing-result": "You watch a worker, try a few small tasks and learn how to handle the tools.",
  "practice-reading-result": "You practise reading short passages and checking simple counts.",
  "join-workbench-result": "You spend time at a workbench, preparing materials and practising basic tasks.",
  "help-household-result": "You take over more errands and household tasks. The extra help saves money.",
  "steady-work-result": "You start carrying and sorting cargo on the quays. You are paid, but the loads leave you tired.",
  "seek-experience-result": "You help with an unfamiliar task. The pay is small, but you get more practice.",
  "keep-first-job-result": "You turn down the offer and continue your current work.",
  "a-familiar-door": "You take regular porter work nearby. A few useful contacts help you find more jobs.",
  "a-slow-beginning": "You take porter work nearby. The first payments are lower than you expected.",
  "beyond-the-breakwater": "You join the crew and sail out of the harbor. The work pays, but you spend less time at home.",
  "a-hard-first-crossing": "You join the crew. The first crossing leaves you tired, and other sailors help you learn the tasks.",
  "a-new-bench": "You start at a copyist's workshop. You copy short passages and check them with another worker.",
  "keep-regular-job-result": "You pass on the offers and continue your current job.",
  "write-home-result": "You send news about the work, the port and the people you have met.",
  "learn-port-result": "You walk the quays and find the shops and landing places you need.",
  "work-together-result": "The copyist shows you how to check the damaged words. You finish part of the page together.",
  "extra-work-result": "You finish the paid task and put the money aside. You leave the damaged page for another day.",
  "help-neighbor-result": "You arrange the job without charging. Your neighbor thanks you and offers help in return.",
  "fair-payment-result": "You agree on a price, arrange the work and receive the payment.",
  "share-meal-result": "You share food with the traveler and explain where they might find work.",
  "share-skill-result": "You demonstrate a useful task and let the traveler try it.",
  "make-introduction-result": "You introduce the traveler to someone hiring. They arrange a time to meet.",
  "check-carefully-result": "A reader spots the missing payment before you accept the agreement.",
  "seek-mediator-result": "A trusted person helps both sides agree on a revised payment.",
  "walk-away-result": "You leave without the payment and spend the time on other tasks.",
  "share-life-result": "You set aside time to meet people. You have not started a courtship yet.",
  "remain-independent-result": "You decide against looking for a partner for now and focus on work and friends.",
  "share-parenting-result": "You and your spouse discuss feeding, care and how to divide the work.",
  "ask-kin-result": "You decide not to try for a child now and keep your current household plans.",
  "be-a-guide-result": "You explain where to ask for work and how to handle a few common tasks.",
  "make-space-result": "Your friend works beside you for a while and helps finish an order.",
  "keep-reserve-result": "You buy a small reserve of food and store it at home.",
  "help-circle-result": "You divide some supplies among relatives and keep less for your household.",
  "learn-new-forms-result": "You ask about the new forms and learn which arrangements affect your work.",
  "rely-on-neighbors-result": "Neighbors explain the new arrangements and help you find the right person to ask.",
  "give-time-result": "You miss some paid work to help your relative with meals and daily tasks.",
  "share-care-result": "Several household members agree on times to help with the care.",
  "work-with-experience-result": "You take lighter tasks that need checking and advice rather than lifting.",
  "keep-pace-result": "You keep taking the same jobs and earn more, but need longer to recover afterward.",
  "teach-patiently-result": "You show the learner each step and check their first attempts. Your own work takes longer.",
  "keep-independent-result": "You finish your own orders and make notes on the parts that need care.",
  "take-rest-result": "You take more days off. You earn less and recover some energy.",
  "reduce-a-little-result": "You drop a few demanding tasks and keep the lighter paid work.",
  "step-back-result": "You leave your regular job. You rest more and help with smaller household tasks.",
  "continue-light-work-result": "You keep some regular work and turn down the heavier tasks.",
  "write-arrangements-result": "You pay for your instructions about belongings and obligations to be recorded.",
  "speak-with-household-result": "You tell the household who should receive your belongings and how to settle your obligations.",
  "guide-beginner-result": "You show a beginner how to handle a task and correct their first attempt.",
  "gather-letters-result": "You sort your letters and label the ones you want to keep.",
  "tell-old-stories-result": "You tell your visitor about an old job and answer a few questions.",
  "listen-result": "Your visitor tells you about work and the people at home.",
  "sit-in-light-result": "You sit outside for a while and return indoors when you get tired.",
  "welcome-company-result": "A visitor joins you for a drink and stays through the afternoon.",
  "send-reply-result": "You send a reply with your news and a few questions.",
  "keep-message-result": "You store the letter and leave the reply for another day.",
  "accept-care-result": "Someone covers your tasks while you rest. You miss some pay but start to recover.",
  "work-more-slowly-result": "You finish a few smaller tasks and leave the rest until you feel better.",
  "child-help-friend-result": "You help your friend finish the task before returning to play.",
  "child-explain-task-result": "You explain the next step and leave your friend to try it.",
  "child-watch-work-result": "A worker shows you the tools and answers your questions.",
  "child-find-company-result": "You find the other children and spend the afternoon playing.",
  "youth-try-task-result": "You complete the unfamiliar task and collect a small payment.",
  "youth-keep-time-result": "You turn down the task and meet the people who were expecting you.",
  "youth-ask-question-result": "The worker explains the step you missed. Your next attempt goes better.",
  "youth-watch-first-result": "You watch another attempt and practise the part that gave you trouble.",
  "adult-lend-tool-result": "Your neighbor returns the tool. You finish your own work later than planned.",
  "adult-share-time-result": "You and your neighbor agree on a time to use the tool together.",
  "adult-take-payment-result": "You finish the job and bring home the payment. The household tasks wait.",
  "adult-make-time-result": "You turn down the payment and finish the tasks at home.",
  "adult-try-method-result": "You try the new method and keep the steps that save work.",
  "adult-keep-method-result": "You use the method you know and finish without wasting material.",
  "adult-meet-people-result": "You meet several people at the gathering and exchange news about work.",
  "adult-old-friend-result": "You visit your old friend and stay for a meal.",
  "later-give-advice-result": "You put your task aside and explain how you would handle the problem.",
  "later-finish-task-result": "You finish your task and arrange to talk another day.",
  "later-tell-memory-result": "You describe the place and answer questions about who lived there.",
  "later-record-memory-result": "Someone writes down the place names and details you want to keep.",
  "later-take-outing-result": "You make the short visit, take a break and return home together.",
  "later-invite-instead-result": "You stay at home and ask your visitor to come over instead.",
  "later-give-belonging-result": "You give the item to someone who can use it.",
  "later-keep-belonging-result": "You keep the item and explain when you still use it.",
};
for (const event of world.events) {
  const copy = plainEventCopy[event.id];
  if (copy) [event.title, event.text] = copy;
  for (const choice of event.choices) for (const outcome of choice.outcomes) {
    if (plainOutcomeCopy[outcome.id]) outcome.text = plainOutcomeCopy[outcome.id];
  }
}
for (const id of originalEventIds) if (!plainEventCopy[id]) throw new Error(`Missing plain event copy: ${id}`);
for (const id of originalOutcomeIds) if (!plainOutcomeCopy[id]) throw new Error(`Missing plain outcome copy: ${id}`);
const plainChoiceLabels = {
  "family-care": "Share the care within the family", "seek-help": "Ask a trusted neighbor to help",
  "learn-letters": "Take reading lessons", "learn-by-doing": "Help with practical work",
  "practice-reading": "Practise reading and counting", "help-household": "Help more at home",
  "be-a-guide": "Explain where to look for work", "make-space": "Let your friend work beside you",
  "work-with-experience": "Take lighter tasks that need experience", "keep-pace": "Keep taking the same jobs",
  "teach-patiently": "Teach the learner", "keep-independent": "Finish your own orders",
  "take-rest": "Take more days off", "reduce-a-little": "Drop some demanding tasks",
  "step-back": "Leave your regular job", "continue-light-work": "Keep some lighter work",
  "write-arrangements": "Have the arrangements written down", "speak-with-household": "Discuss the arrangements at home",
  "guide-beginner": "Show a beginner how to do a task", "gather-letters": "Sort your letters",
  "tell-old-stories": "Tell a story about an old job", "listen": "Ask for the visitor's news",
  "sit-in-light": "Rest outside", "welcome-company": "Invite someone to visit",
  "later-give-advice": "Help with the question", "later-finish-task": "Finish your task first",
  "later-tell-memory": "Describe the place", "later-record-memory": "Have the details written down",
  "later-give-belonging": "Give the item away", "later-keep-belonging": "Keep it for your own use",
};
for (const event of world.events) for (const choice of event.choices) {
  if (plainChoiceLabels[choice.id]) choice.text = plainChoiceLabels[choice.id];
}
const originCopy = {
  "merchant-household": "You are born into a household that runs a small shop near the harbor. Relatives and neighbors help with your care.",
  "artisan-household": "You are born into a household of craft workers. The family shares workspace, tools and the care of a new child.",
  "harbor-household": "You are born into a household that earns money from work on the quays. Adults fit your care around shifts and deliveries.",
};
for (const origin of world.origins) origin.text = originCopy[origin.id];
const endingCopy = {
  "death-in-infancy": ["Death in infancy", "You die before your first birthday. Your household arranges your funeral."],
  "death-in-childhood": ["Death in childhood", "You die during childhood. Your household arranges your funeral."],
  "death-in-adulthood": ["Death in adulthood", "You die as an adult. Your household arranges your funeral and deals with your unfinished work."],
  "death-in-later-life": ["Death in later life", "You die in later life. Your household arranges your funeral and sorts your belongings."],
};
for (const ending of world.endings) [ending.title, ending.text] = endingCopy[ending.id];

// Meeting someone adds a person to this life, without creating a romance.
// These authored ages space encounters out; they are not marriage-age data.
for (const [partner, atAge, title, text] of [
  ["demetria", 18, "A potter at the workshop", "While collecting a repaired jar, you meet Demetria, a potter. You talk while she finishes the handle and learn that she works nearby."],
  ["thais", 21, "A conversation at the market", "You meet Thais while buying supplies at the market. She is a trader and helps you compare two sellers' prices."],
  ["berenike", 24, "Help with a linen order", "A linen order brings you to Berenike's workshop. She helps sort out the measurements, and you spend a little time talking after the work is done."],
  ["tyche", 26, "Waiting for a copied document", "While waiting for a document, you meet Tyche, a copyist. She explains a missing line and asks where your household lives."],
]) {
  events.push({ ...note(`meet-${partner}`, title, text, atAge, [{ type: "introduce", partner }]), when: not(knownPartner(partner)) });
}

applySpecialists(world);
// Learning paths are authored game rules, not a historical curriculum. Keeping
// them here leaves earlier specialist fixture packs and saved worlds unchanged.
const skillPaths = {
  craft: { branch: "Crafts", tier: 0, description: "Learn to use tools, mend small items and work at a bench." },
  pottery: { branch: "Crafts", tier: 1, prerequisites: { craft: 15 }, description: "Build on workshop practice to shape and finish clay vessels." },
  carving: { branch: "Crafts", tier: 1, prerequisites: { craft: 15 }, description: "Use controlled cuts to make wooden fittings and small figures." },
  sculpture: { branch: "Crafts", tier: 2, prerequisites: { carving: 20, pottery: 10 }, description: "Combine carving and clay work to make figures and reliefs." },
  literacy: { branch: "Letters & ideas", tier: 0, description: "Practise letters, reading and clear copies." },
  oratory: { branch: "Letters & ideas", tier: 1, prerequisites: { literacy: 10 }, description: "Prepare a short argument and explain it to other people." },
  philosophy: { branch: "Letters & ideas", tier: 2, prerequisites: { literacy: 20, oratory: 10 }, description: "Read arguments, compare objections and explain your reasons." },
  reckoning: { branch: "Numbers & sky", tier: 0, description: "Count goods, check totals and keep simple accounts." },
  astronomy: { branch: "Numbers & sky", tier: 1, prerequisites: { reckoning: 15, literacy: 10 }, description: "Record observations and compare positions and calendar calculations." },
  astrology: { branch: "Numbers & sky", tier: 2, prerequisites: { astronomy: 10, reckoning: 10 }, description: "Study traditional chart interpretations after learning observation and arithmetic. These beliefs do not provide reliable predictions." },
  seamanship: { branch: "Practical service", tier: 0, description: "Practise ropes, loads and everyday shipboard tasks." },
  warfare: { branch: "Practical service", tier: 1, prerequisites: { craft: 10 }, description: "Build on equipment handling with drills, guard duties and unit movements." },
};
for (const [id, path] of Object.entries(skillPaths)) {
  Object.assign(world.character.skills[id], path, { trainingActivity: `train-${id}` });
}

// An intentionally small household ledger gives money and possessions a common
// game value. The currency name is historical; every price and return is authored.
world.stats.wealth.label = "Wealth";
world.economy = {
  stat: "wealth",
  currency: { singular: "drachma", plural: "drachmas", short: "dr" },
  unitsPerPoint: 10,
  description: "Household accounts use drachmas (dr). Net worth includes cash and the estimated sale value of possessions, less debt. Unpaid unavoidable costs can become debt. Amounts are fixed game values, not reconstructed historical prices or wages. There is no modern-currency conversion or automatic interest. The same simplified unit continues after Roman rule.",
  sourceIds: ["ucl-ptolemaic-coins"],
  assets: [
    { id: "tool-chest", title: "Tool chest", description: "Unlocks small repair jobs at Craft 15. Sell for 30 drachmas.", value: 30, maxOwned: 1, yearlyIncome: 0 },
    { id: "workshop-share", title: "Workshop share", description: "Earn 10 drachmas each year you survive. Sell for 120 drachmas.", value: 120, maxOwned: 1, yearlyIncome: 10 },
  ],
};
const cashAtLeast = value => ({ type: "cash", op: "gte", value });
const assetAmount = (asset, op, value) => ({ type: "asset", asset, op, value });
for (const asset of world.economy.assets) {
  world.character.activities.push(
    activity(`buy-${asset.id}`, `Buy a ${asset.title.toLowerCase()}`, "finance", 18,
      `You pay ${asset.value} drachmas for a ${asset.title.toLowerCase()}. It is now recorded among your household's possessions.`,
      [{ type: "cash", delta: -asset.value }, { type: "asset", asset: asset.id, delta: 1 }],
      all(cashAtLeast(asset.value), assetAmount(asset.id, "eq", 0))),
    activity(`sell-${asset.id}`, `Sell your ${asset.title.toLowerCase()}`, "finance", 18,
      `You sell your ${asset.title.toLowerCase()} for ${asset.value} drachmas. The sale turns its recorded value into spendable cash.`,
      [{ type: "asset", asset: asset.id, delta: -1 }, { type: "cash", delta: asset.value }],
      assetAmount(asset.id, "gte", 1)),
  );
}
world.character.activities.push({ ...activity("repay-household-debt", "Repay 10 drachmas of debt", "finance", 18,
  "You pay 10 drachmas toward the household's unpaid costs. Cash and debt both fall by the same amount.",
  [{ type: "cash", delta: -10 }, { type: "debt", delta: -10 }],
  all(cashAtLeast(10), { type: "debt", op: "gte", value: 10 })), usesYearlyActivity: false });
world.character.activities.push(activity("take-small-repair-jobs", "Take small repair jobs", "career", 18,
  "You use your tools to repair hinges, straps and small household fittings. The customers pay when the work is done.",
  [stat("wealth", 2), skill("craft", 2), stat("health", -1)],
  all(assetAmount("tool-chest", "gte", 1), trained("craft", 15))));
applyBackgroundVariety(world);
applyWorkTimeline(world);
applyInterestCareers(world);
applyCausalLife(world);
// Real accepted learning refreshes Knowledge; a literacy flag alone no longer
// creates permanent annual increases. These rates are authored game balance.
world.yearlyRules = world.yearlyRules.filter(rule => !["practical-experience", "learning-through-words"].includes(rule.id));
world.economy.autoDebtRepayment = true;
const continuedReading = world.character.activities.find(activity => activity.id === "train-literacy");
// Mastering the skill does not prevent continued reading or the Study focus.
continuedReading.when = { type: "cash", op: "gte", value: 20 };
continuedReading.text = "Read and practise writing";
continuedReading.outcomes[0].text = "You spend time reading and writing with a reader. The practice keeps your knowledge fresh.";
world.knowledge = {
  stat: "knowledge", minAge: 12, idleGraceYears: 2, idleLoss: 1,
  ageBands: [
    { minAge: 0, maxAge: 49, loss: 0 },
    { minAge: 50, maxAge: 64, loss: 0.5 },
    { minAge: 65, maxAge: 79, loss: 1 },
    { minAge: 80, maxAge: 99, loss: 1.5 },
  ],
  description: "Knowledge needs continued use. From age 12, two full years without a recorded learning gain lead to a loss of 1 point per year. Lessons, research, work and events with positive Knowledge effects refresh practice, including at the stat cap. Ageing also reduces Knowledge by 0.5 per year from 50, 1 from 65 and 1.5 from 80. These are authored game rules, not measured cognitive ageing rates. Skill proficiencies are separate.",
};

// Name the material and task instead of presenting every practical activity as
// generic Craft. The foundation still covers tool use across several trades.
world.character.skills.craft.label = "Tool handling";
world.character.skills.craft.description = "Measure materials, control hand tools and repair everyday objects. These basics support several trades.";
world.character.skills.carving.label = "Wood carving";
function specificCraftCopy(id, text, outcomeText) {
  const action = world.character.activities.find(activity => activity.id === id);
  if (!action || action.outcomes.length !== 1) throw new Error(`Expected one craft outcome for ${id}`);
  action.text = text;
  if (outcomeText) action.outcomes[0].text = outcomeText;
}
specificCraftCopy("train-craft", "Practise cutting and joining wood",
  "You measure a piece of wood, cut a joint and fit the pieces together. A workshop worker checks your work.");
specificCraftCopy("train-pottery", "Shape and fire clay pots",
  "You shape small clay pots, leave them to dry and help load a kiln.");
specificCraftCopy("train-carving", "Carve a wooden fitting",
  "You mark a pattern on wood and carve the fitting. A worker checks the cuts and helps you correct uneven parts.");
specificCraftCopy("train-sculpture", "Carve a small stone relief",
  "You mark a design on a scrap of stone and cut a shallow relief. A sculptor checks the depth and shape.");
specificCraftCopy("take-small-repair-jobs", "Repair hinges, straps and household fittings");
specificCraftCopy("pottery-order", "Finish a large order of clay pots",
  "You shape and finish the clay pots for a large order. The customer pays when the work is done, but the long hours leave you tired.");
world.economy.assets.find(asset => asset.id === "tool-chest").description = "Unlocks hinge, strap and fitting repairs at Tool handling 15. Sell for 30 drachmas.";

// Paid actions use cash, not the net-worth index retained for legacy stat effects.
// This also prevents debt or an illiquid possession from misreporting affordability.
function cashRequirement(condition) {
  if (!condition) return condition;
  if (condition.type === "stat" && condition.stat === world.economy.stat) {
    return { type: "cash", op: condition.op, value: condition.value * world.economy.unitsPerPoint };
  }
  if (condition.type === "all" || condition.type === "any") return { ...condition, conditions: condition.conditions.map(cashRequirement) };
  if (condition.type === "not") return { ...condition, condition: cashRequirement(condition.condition) };
  return condition;
}
for (const item of [...world.events, ...world.events.flatMap(event => event.choices), ...world.character.activities, ...world.character.deathCauses, ...world.endings, ...world.yearlyRules]) {
  if (item.when) item.when = cashRequirement(item.when);
}

// Main attributes open a few specialist opportunities. Basic learning, ordinary
// work, social activities and recovery remain available without these thresholds.
const statAtLeast = (stat, value) => ({ type: "stat", stat, op: "gte", value });
function requireAttribute(ids, statId, value) {
  for (const id of ids) {
    const action = world.character.activities.find(activity => activity.id === id);
    if (!action) throw new Error(`Missing activity for ${statId} requirement: ${id}`);
    action.when = all(...(action.when ? [action.when] : []), statAtLeast(statId, value));
  }
}
requireAttribute(["take-day-cargo-work", "take-night-cargo-work", "shipboard-watch", "drill-a-unit"], "health", 20);
requireAttribute(["train-philosophy", "train-astronomy", "train-astrology"], "knowledge", 15);
requireAttribute(["research-astrological-readings"], "knowledge", 25);
requireAttribute(["seek-officer-commission", "seek-court-appointment", "present-a-district-petition"], "bonds", 20);
world.description = "Live a fictional life in Alexandria, starting in 66 BCE. Learn a trade, start a family or pursue a career in scholarship, the army or the royal court.";
// Birth is a recorded situation, not a decision made by the newborn player.
const birthEvent = world.events.find(event => event.id === "the-first-household");
Object.assign(birthEvent, {
  title: "You are born",
  text: "You are born in Alexandria. Your household looks after you.",
  mode: "automatic",
  choices: [],
  effects: [],
});
const output = new URL("worlds/alexandria-sample.json", root);
applyStrictProgression(world);
applyCareerOpportunities(world);
applyAdultMortality(world);
applyMoneylender(world);
applyEventVariety(world);
applyRareEncounters(world);
applyMastery(world);
applyEarlyLife(world);
applyLegacy(world);
applyChildhoodRoutes(world);
applyCreditOpportunities(world);
applySkillCeiling(world);
applyPeople(world);
applySocialRoles(world);
applyLifeProse(world);
applyCareerProse(world);
world.version = "0.31.0";
world.eventPacing.variety = { recentWindow: 6, recentWeight: 0.08, repeatWeight: 0.35 };
world.eventPacing.rareEvents = { annualChance: 0.012, cooldownYears: 12 };
applyClassicalEra(world);
applyHouseholdOrigins(world);
applyLateRoutes(world);
writeFileSync(output, `${JSON.stringify(world, null, 2)}\n`);
console.log(`Built ${world.events.length} events, ${world.sources.length} sources, ${bands.length} mortality bands and ${world.character.activities.length} character activities: ${fileURLToPath(output)}`);
