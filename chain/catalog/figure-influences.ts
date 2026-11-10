import type { InfluenceEntry } from "./influence-entry.ts";
import {
  LEVY_SERVICE, MILITARY_JOBS, age, ageBetween, all, cash, cashAtLeast, flag, hasFlag, hasSkill, inJob, not,
  origin, skill, stat, statAtLeast, statAtMost, WHEN_ELIGIBLE,
} from "./content.ts";

/**
 * Figure actions are activated at birth: each event joins the life's event pool
 * and fires once its conditions hold. Dated history comes from the pack's own
 * flags (Alexander reaches Egypt in 332 BCE, dies in 323 BCE) where it matters.
 */
const alexanderLevy: InfluenceEntry = {
  id: "alexander.levy",
  label: "Alexander levies the city: people of military age must serve, flee or pay.",
  baseWeight: 5,
  event: {
    id: "influence-alexander-levy",
    title: "A levy in the king's name",
    text: "Officers acting for Alexander are filling garrison and supply posts in Egypt. Your name is on the district list of people fit to serve. The recruiting officer will accept a substitute's fee, and some on the list have already left for relatives in the Delta.",
    trigger: { type: "year", at: -332 },
    when: all(...ageBetween(18, 30), hasFlag("ptolemy-governs-egypt", false), not(inJob(...MILITARY_JOBS))),
    sourceIds: ["classical-alexander", "fischer-bovet-2013-army"],
    evidence: "fictional",
    choices: [
      {
        id: "alexander-levy-serve",
        text: "Answer the levy and report for service",
        outcomes: [
          {
            id: "alexander-levy-serve-garrison",
            text: "You serve a season in a coastal garrison and learn drill under a Macedonian officer. The pay is small and the days are long. When your term ends you return to your household.",
            weight: 70,
            effects: [...LEVY_SERVICE, skill("warfare", 5), stat("health", -2), stat("bonds", -2)],
          },
          {
            id: "alexander-levy-serve-noticed",
            text: "Your file leader notices that you keep the others in step and the supply tallies honest. He sends your name to an officer with his report before your term ends.",
            weight: 15,
            weightModifiers: [
              { when: hasSkill("warfare", 15), multiplier: 2, reason: "You already know basic drill" },
              { when: hasSkill("reckoning", 20), multiplier: 1.5, reason: "You can keep a supply tally" },
            ],
            effects: [...LEVY_SERVICE, skill("warfare", 5), skill("oratory", 1), flag("officer-recommendation"), stat("health", -1)],
          },
          {
            id: "alexander-levy-serve-injured",
            text: "A fall on a supply march leaves you lame. You finish your term in the stores and carry the injury home.",
            weight: 15,
            weightModifiers: [{ when: statAtLeast("health", 70), multiplier: 0.5, reason: "Good health carries you through the marches" }],
            effects: [...LEVY_SERVICE, skill("warfare", 3), stat("health", -8)],
          },
        ],
      },
      {
        id: "alexander-levy-flee",
        text: "Leave for relatives in the Delta until the officers move on",
        outcomes: [
          {
            id: "alexander-levy-flee-hidden",
            text: "You spend the season in a relative's village, working for your keep. When you come back the officers have moved on, but your neighbours remember that you were gone.",
            weight: 65,
            weightModifiers: [
              { when: statAtLeast("bonds", 60), multiplier: 1.5, reason: "Relatives are willing to hide you" },
              { when: hasSkill("seamanship", 20), multiplier: 1.3, reason: "You can find passage on a river boat" },
            ],
            effects: [stat("bonds", -3), stat("wealth", -1)],
          },
          {
            id: "alexander-levy-flee-caught",
            text: "Officers are checking the boats at the canal. You are brought back, fined and made to serve a season in the garrison after all.",
            weight: 35,
            effects: [...LEVY_SERVICE, skill("warfare", 2), stat("health", -3), stat("wealth", -2), stat("bonds", -1)],
          },
        ],
      },
      {
        id: "alexander-levy-pay",
        text: "Pay the 60-drachma substitute fee",
        when: cashAtLeast(60),
        outcomes: [
          {
            id: "alexander-levy-pay-result",
            text: "The officer takes the fee and enters a hired man in your place. Your household keeps its work, and your name comes off the roll.",
            weight: 1,
            effects: [cash(-60)],
          },
        ],
      },
    ],
  },
};

const alexanderFound: InfluenceEntry = {
  id: "alexander.found",
  label: "Alexander founds and builds: new work and building plots open in the city.",
  baseWeight: 3,
  event: {
    id: "influence-alexander-founding-work",
    title: "Work on the new city",
    text: "Surveyors have marked the streets of Alexander's new city beside Rhakotis. Contractors are hiring for walls, quays and houses, and plots along the new streets are being let to anyone who can pay toward the building.",
    trigger: WHEN_ELIGIBLE,
    // Two years after the foundation, so it does not crowd the levy and grain decisions.
    when: all(...ageBetween(21, 50), hasFlag("alexandria-founded")),
    sourceIds: ["classical-foundation-chronology", "classical-rhakotis"],
    evidence: "fictional",
    choices: [
      {
        id: "alexander-found-labour",
        text: "Take paid work on the building sites",
        outcomes: [
          {
            id: "alexander-found-labour-result",
            text: "You carry stone, mix mortar and learn how the builders set a line. The pay is steady while the work lasts.",
            weight: 80,
            effects: [cash(30), skill("craft", 3), stat("health", -1), flag("assisted-alexander-foundation")],
          },
          {
            id: "alexander-found-labour-tallies",
            text: "A foreman sees that you can keep count and puts you in charge of a work gang's tallies. You finish the season with better pay and a name the contractors know.",
            weight: 20,
            weightModifiers: [{ when: hasSkill("reckoning", 20), multiplier: 2, reason: "You can keep a work tally" }],
            effects: [cash(50), skill("craft", 2), skill("reckoning", 2), stat("bonds", 2), flag("assisted-alexander-foundation")],
          },
        ],
      },
      {
        id: "alexander-found-plot",
        text: "Put 40 drachmas toward a share in a building plot",
        when: cashAtLeast(40),
        outcomes: [
          {
            id: "alexander-found-plot-let",
            text: "The street fills faster than the surveyors expected. Your share is let to newcomers, and the rent comes in before the year is out.",
            weight: 60,
            weightModifiers: [{ when: hasSkill("reckoning", 25), multiplier: 1.3, reason: "You can judge the contractor's accounts" }],
            effects: [cash(-40), cash(90), stat("bonds", 1)],
          },
          {
            id: "alexander-found-plot-stalled",
            text: "Building stalls when the contractor is called away to the harbour works. You sell the share and recover part of your money.",
            weight: 40,
            effects: [cash(-40), cash(25)],
          },
        ],
      },
      {
        id: "alexander-found-keep",
        text: "Keep to your own work",
        outcomes: [
          {
            id: "alexander-found-keep-result",
            text: "You keep to your existing work and watch the new streets fill from a distance.",
            weight: 1,
            effects: [],
          },
        ],
      },
    ],
  },
};

const aristotleLyceum: InfluenceEntry = {
  id: "aristotle.lyceum",
  label: "Aristotle founds the Lyceum: young people study notes from his lectures.",
  baseWeight: 3,
  event: {
    id: "influence-aristotle-lyceum-notes",
    title: "Notes from the Lyceum",
    text: "A reader back from Athens has copied notes from Aristotle's lectures at the Lyceum: what things are made of, why they change and how to argue about them. He offers to go through them with any young person who can keep up.",
    trigger: WHEN_ELIGIBLE,
    when: all(...ageBetween(12, 22)),
    sourceIds: ["classical-aristotle"],
    evidence: "fictional",
    choices: [
      {
        id: "aristotle-lyceum-study",
        text: "Work through the notes with him",
        outcomes: [
          {
            id: "aristotle-lyceum-study-result",
            text: "Week after week you test the questions against things you can see: a seed, a tide, a broken pot. You begin to ask why as readily as what.",
            weight: 75,
            weightModifiers: [{ when: hasSkill("literacy", 15), multiplier: 1.5, reason: "You can already read the notes yourself" }],
            effects: [stat("knowledge", 4), skill("philosophy", 3), skill("literacy", 2), flag("early-interest-philosophy")],
          },
          {
            id: "aristotle-lyceum-study-hard",
            text: "Most of the notes are beyond you this year, but the reader leaves you one question to keep: what makes a thing what it is.",
            weight: 25,
            effects: [stat("knowledge", 2), skill("philosophy", 1), flag("early-interest-philosophy")],
          },
        ],
      },
      {
        id: "aristotle-lyceum-decline",
        text: "Keep to your household work",
        outcomes: [
          {
            id: "aristotle-lyceum-decline-result",
            text: "You thank the reader and keep to your work. Others in the street borrow the notes.",
            weight: 1,
            effects: [],
          },
        ],
      },
    ],
  },
};

const aristotleTutorCourt: InfluenceEntry = {
  id: "aristotle.tutor-court",
  label: "Aristotle tutors the court: royal children learn argument and composure.",
  baseWeight: 3,
  event: {
    id: "influence-aristotle-court-tutor",
    title: "A tutor for the royal household",
    text: "Your family has engaged a tutor trained in Aristotle's school, as Philip of Macedon once engaged Aristotle for his son. The lessons cover reading, argument, the conduct of rulers and keeping a clear head when others lose theirs.",
    trigger: WHEN_ELIGIBLE,
    when: all(origin("royal-household"), ...ageBetween(13, 18)),
    sourceIds: ["classical-aristotle", "household-royal-kin"],
    evidence: "fictional",
    choices: [
      {
        id: "aristotle-court-tutor-attend",
        text: "Attend the lessons and argue back",
        outcomes: [
          {
            id: "aristotle-court-tutor-attend-result",
            text: "The tutor makes you defend every claim and answer calmly when pressed. As an exercise he has you check the household guard's supply lists, then writes to their officer commending your work.",
            weight: 1,
            effects: [stat("knowledge", 4), stat("bonds", 2), skill("philosophy", 3), skill("oratory", 3), flag("officer-recommendation")],
          },
        ],
      },
      {
        id: "aristotle-court-tutor-ride",
        text: "Spend the hours riding and hunting instead",
        outcomes: [
          {
            id: "aristotle-court-tutor-ride-result",
            text: "You keep to the stables and the hunting grounds. The tutor teaches your cousins, though some of his questions reach you at meals.",
            weight: 1,
            effects: [stat("health", 2), stat("knowledge", 1), skill("warfare", 2)],
          },
        ],
      },
    ],
  },
};

const euclidSchool: InfluenceEntry = {
  id: "euclid.school",
  label: "Euclid opens a school: children learn letters and figures.",
  baseWeight: 3,
  event: {
    id: "influence-euclid-school",
    title: "A school of demonstrations",
    text: "A teacher following Euclid's method has opened a school near the harbour. Children draw figures in sand trays and must say why each step follows from the last. The fee is small, and some pupils pay in errands.",
    trigger: WHEN_ELIGIBLE,
    when: all(...ageBetween(7, 13)),
    sourceIds: ["classical-euclid"],
    evidence: "fictional",
    choices: [
      {
        id: "euclid-school-attend",
        text: "Go to the lessons",
        outcomes: [
          {
            id: "euclid-school-attend-result",
            text: "You learn letters from the written propositions and numbers from the figures. By the end of the year you can prove a small thing and say why it holds.",
            weight: 1,
            effects: [stat("knowledge", 4), skill("literacy", 3), skill("reckoning", 3)],
          },
        ],
      },
      {
        id: "euclid-school-errands",
        text: "Run errands for the school and listen at the door",
        outcomes: [
          {
            id: "euclid-school-errands-result",
            text: "You carry water and messages for the teacher and pick up what you can between errands.",
            weight: 1,
            effects: [stat("knowledge", 2), stat("bonds", 1), skill("reckoning", 2)],
          },
        ],
      },
    ],
  },
};

const euclidMuseum: InfluenceEntry = {
  id: "euclid.museum",
  label: "Euclid keeps to the Museum: gifted readers may be offered a scholar's post.",
  baseWeight: 3,
  event: {
    id: "influence-euclid-museum",
    title: "A place among the Museum's scholars",
    text: "Scholars working beside Euclid at the Museum need a capable reader to check figures and copy proofs. The post carries a stipend and use of the collected books, but the work is exacting and careless help is soon dismissed.",
    trigger: WHEN_ELIGIBLE,
    when: all(...ageBetween(18, 45), hasSkill("literacy", 35), hasSkill("reckoning", 35)),
    sourceIds: ["classical-euclid", "classical-library"],
    evidence: "fictional",
    choices: [
      {
        id: "euclid-museum-accept",
        text: "Accept the post and work through the proofs",
        opportunity: { label: "Work among the Museum's scholars", outcomeIds: ["euclid-museum-accepted"] },
        outcomes: [
          {
            id: "euclid-museum-accepted",
            text: "You check constructions line by line and copy the corrected proofs. At the end of the season the scholars keep your name among those they recommend for paid work.",
            weight: 70,
            weightModifiers: [{ when: hasSkill("reckoning", 50), multiplier: 1.5, reason: "Your reckoning is already strong" }],
            effects: [cash(40), stat("knowledge", 5), skill("reckoning", 3), skill("astronomy", 2), flag("scholar-recommendation")],
          },
          {
            id: "euclid-museum-dismissed",
            text: "An error in your first copied figure costs you the scholars' trust, and the post goes to another reader. You keep what you learned checking their work.",
            weight: 30,
            effects: [stat("knowledge", 2), skill("reckoning", 1)],
          },
        ],
      },
      {
        id: "euclid-museum-decline",
        text: "Decline and keep your present work",
        outcomes: [
          {
            id: "euclid-museum-decline-result",
            text: "You decline the post. The scholars find another reader, and your own work goes on as before.",
            weight: 1,
            effects: [],
          },
        ],
      },
    ],
  },
};

const cleomenesCornerGrain: InfluenceEntry = {
  id: "cleomenes.corner-grain",
  label: "Cleomenes corners the grain: merchants profit while poor households go short.",
  baseWeight: 5,
  event: {
    id: "influence-cleomenes-grain-corner",
    title: "Grain held for the export price",
    text: "Cleomenes, who manages Egypt's revenues for the king, has bought up the district's grain to sell to famine-struck Greek cities at a high price. Bread in the market now costs twice what it did. Merchants with silver are buying shares in the cargoes; everyone else must pay or go short.",
    trigger: { type: "year", at: -330 },
    when: all(age("gte", 14), hasFlag("ptolemy-governs-egypt", false)),
    sourceIds: ["classical-egypt-transitions"],
    evidence: "fictional",
    choices: [
      {
        id: "cleomenes-grain-invest",
        text: "Put 40 drachmas into a share of an export cargo",
        when: cashAtLeast(40),
        outcomes: [
          {
            id: "cleomenes-grain-invest-profit",
            text: "The cargo sells in a hungry Greek port at the price Cleomenes set. Your share comes back nearly doubled, though your neighbours know where the profit came from.",
            weight: 60,
            weightModifiers: [
              { when: hasSkill("reckoning", 30), multiplier: 1.5, reason: "You can check the cargo accounts" },
              { when: inJob("shopkeeper", "clerk", "sailor"), multiplier: 1.3, reason: "You already work in the trade" },
            ],
            effects: [cash(-40), cash(75), stat("bonds", -2)],
          },
          {
            id: "cleomenes-grain-invest-held",
            text: "The ship is held at the harbour while officials argue over the export duty. When the share is finally settled, you recover only part of your money.",
            weight: 40,
            effects: [cash(-40), cash(20)],
          },
        ],
      },
      {
        id: "cleomenes-grain-pay",
        text: "Pay the high price to keep the household fed",
        when: cashAtLeast(20),
        outcomes: [
          {
            id: "cleomenes-grain-pay-result",
            text: "You pay what the sellers ask. The household eats as before, but your savings are thinner by the end of the season.",
            weight: 1,
            effects: [cash(-20)],
          },
        ],
      },
      {
        id: "cleomenes-grain-short",
        text: "Eat less until the price falls",
        outcomes: [
          {
            id: "cleomenes-grain-short-result",
            text: "Meals shrink to bread and a little oil. The household gets through the season weaker and short-tempered.",
            weight: 75,
            effects: [stat("health", -5), stat("bonds", -1)],
          },
          {
            id: "cleomenes-grain-short-shared",
            text: "Neighbours pool what they have and share it out. The season is lean, but nobody in the street goes entirely without bread.",
            weight: 25,
            weightModifiers: [{ when: statAtLeast("bonds", 60), multiplier: 2, reason: "Neighbours share with people they trust" }],
            effects: [stat("health", -2), stat("bonds", 2)],
          },
        ],
      },
    ],
  },
};

/** Alexandria is founded in 331 BCE: Cleomenes' administration and its grain crisis begin. */
const GRAIN_CRISIS_START_YEAR = -331;
/** Calibrated so the rations reach roughly one life in six (test/chain-figure-calibration.test.ts). */
const GRANARIES_MAX_HEALTH = 45;

const cleomenesGranaries: InfluenceEntry = {
  id: "cleomenes.granaries",
  label: "Cleomenes fills the granaries: rations reach households weakened in the famine years.",
  baseWeight: 3,
  event: {
    id: "influence-cleomenes-granaries",
    title: "The granaries open",
    text: "The grain shortage that has struck the Greek cities reaches your district, and you are already weak. Officials open the royal granaries that Cleomenes had filled and issue measured rations. Clerks write each household's name against its share.",
    trigger: { type: "year", at: GRAIN_CRISIS_START_YEAR },
    // Famine-only: the grain crisis of Cleomenes' administration (Alexandria's founding until
    // Ptolemy takes over, 331-324 BCE; the same shortage the corner-grain decision names), and
    // only for a life already in poor health, well below the 60-80 starting range.
    when: all(hasFlag("alexandria-founded"), hasFlag("ptolemy-governs-egypt", false), statAtMost("health", GRANARIES_MAX_HEALTH)),
    mode: "automatic",
    effects: [stat("health", 6), stat("bonds", 1)],
    sourceIds: ["classical-egypt-transitions"],
    evidence: "fictional",
    choices: [],
  },
};

export const FIGURE_INFLUENCES: readonly InfluenceEntry[] = [
  alexanderLevy, alexanderFound, aristotleLyceum, aristotleTutorCourt,
  euclidSchool, euclidMuseum, cleomenesCornerGrain, cleomenesGranaries,
];
