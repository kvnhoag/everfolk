// Exceptional game rewards for an already developed life. These invented
// encounters are not historical qualifications or measured breakthrough odds.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const age = value => ({ type: "age", op: "gte", value });
const stat = (stat, op, value) => ({ type: "stat", stat, op, value });
const skill = (skill, op, value) => ({ type: "skill", skill, op, value });
const jobs = (...ids) => any(...ids.map(job => ({ type: "job", job })));
const factor = (when, multiplier, reason) => ({ when, multiplier, reason });
const gain = (target, id, delta) => target === "stat" ? { type: "stat", stat: id, delta } : { type: "skill", skill: id, delta };
const result = (id, text, effects, weight, weightModifiers) => ({ id, text, weight, effects, ...(weightModifiers ? { weightModifiers } : {}) });
const decline = (id, text, outcome) => ({ id, text, outcomes: [result(`${id}-result`, outcome, [], 1)] });

export function applyMastery(world) {
  const eligible = (target, id, minimum) => all(
    target === "stat" ? stat(id, "gte", minimum) : skill(id, "gte", minimum),
    target === "stat" ? stat(id, "lt", world.stats[id].max) : skill(id, "lt", world.character.skills[id].max),
  );
  const attempt = (id, text, target, key, minimum, success, ordinary, modifiers) => ({
    id, text, when: eligible(target, key, minimum),
    opportunity: { label: `${target === "stat" ? world.stats[key].label : world.character.skills[key].label} reaches its cap`, outcomeIds: [`${id}-mastered`] },
    outcomes: [
      result(`${id}-mastered`, success, [{ type: "mastery", target, id: key }], 40, modifiers),
      result(`${id}-practised`, ordinary, [gain(target, key, 2)], 60),
    ],
  });
  const encounter = (id, title, text, minimumAge, when, choices) => ({
    id, title, text, rarity: "rare", trigger: { type: "random", weight: 1.5 },
    when: all(age(minimumAge), stat("health", "gte", 35), when),
    maxOccurrences: 1, evidence: "fictional", sourceIds: [], choices,
  });

  const crafts = [
    { id: "pottery", text: "Make the workshop's finest clay vessel", jobs: ["potter", "ceramic-decorator", "pottery-workshop-lead"],
      success: "You shape, decorate and fire the vessel without a fault. Other workers use the finished piece to judge their own work. Pottery reaches its cap.",
      ordinary: "The vessel is accepted, but a small flaw remains in the rim. You practise correcting that part before the next firing." },
    { id: "carving", text: "Carve a matching set of wooden fittings", jobs: ["wood-carver", "carving-workshop-lead"],
      success: "Every fitting matches the pattern and fits its opening on the first check. Wood carving reaches its cap.",
      ordinary: "You finish the fittings, then rework two that sit unevenly. The corrections give you more practice." },
    { id: "sculpture", text: "Finish a demanding stone relief", jobs: ["sculptor", "sculpture-workshop-lead"],
      success: "You finish the shallow cuts and fine detail without damaging the stone. The workshop accepts the relief as its example for future work. Stone sculpture reaches its cap.",
      ordinary: "You finish the relief, but simplify a detail you cannot cut cleanly. Another worker helps you practise that cut on scrap stone." },
    { id: "craft", text: "Build and fit a precise wooden assembly", jobs: ["apprentice", "pottery-workshop-lead", "carving-workshop-lead", "sculpture-workshop-lead"],
      success: "You measure, cut and fit every joint without a gap. The assembly works on the first test. Tool handling reaches its cap.",
      ordinary: "The assembly works after several adjustments. You identify which measurements caused the extra work." },
  ];
  world.events.push(encounter("rare-masterwork", "A masterwork commission",
    "A demanding customer asks for a piece that will be checked against the best work in the workshop. Your years of practice have prepared you to attempt it.",
    24, all(stat("bonds", "gte", 40), any(...crafts.map(item => eligible("skill", item.id, 60)))), [
      ...crafts.map(item => attempt(`masterwork-${item.id}`, item.text, "skill", item.id, 60, item.success, item.ordinary, [
        factor(skill(item.id, "gte", 75), 1.6, "Your technique is already highly developed"),
        factor(jobs(...item.jobs), 1.3, "You use these techniques in your regular work"),
        factor(stat("knowledge", "gte", 50), 1.2, "You can plan and check the difficult parts"),
      ])),
      decline("masterwork-decline", "Leave the commission to another worker", "You decline the commission and continue your own work."),
    ]));

  const studies = [
    { id: "literacy", text: "Prepare an exact copy of a difficult text", jobs: ["copyist", "clerk", "patron-supported-reader"],
      success: "You compare the surviving copies, explain each correction and deliver a clean text. Literacy reaches its cap.",
      ordinary: "Your copy is useful, but the reader finds passages that need another comparison. You work through them together." },
    { id: "philosophy", text: "Defend an argument before the readers", jobs: ["philosophy-tutor", "court-adviser"],
      success: "You answer the objections, correct a weak example and carry the argument through every step. Philosophy reaches its cap.",
      ordinary: "One objection exposes a weak step. You revise the argument after the discussion and test it against another example." },
    { id: "astronomy", text: "Recalculate and check a difficult sky table", jobs: ["sky-table-calculator", "patron-supported-reader"],
      success: "You recalculate the table, explain the method and catch every copied error in the final check. Astronomy reaches its cap.",
      ordinary: "The reader finds a mismatch in one column. You trace it to an earlier calculation and work it through again." },
    { id: "astrology", text: "Explain the methods in several traditional charts", jobs: ["astrologer"],
      success: "You reconstruct the chart methods and explain where the traditional readings disagree. Astrology reaches its cap; the exercise establishes no prediction about the future.",
      ordinary: "One chart uses a convention you do not recognize. You compare examples with the reader before finishing your explanation." },
  ];
  world.events.push(encounter("rare-scholarly-mastery", "An exacting demonstration",
    "Experienced readers invite you to present work in your strongest subject. They will check the details and ask you to explain your method.",
    24, all(stat("knowledge", "gte", 45), any(...studies.map(item => eligible("skill", item.id, 55)))), [
      ...studies.map(item => attempt(`scholarly-mastery-${item.id}`, item.text, "skill", item.id, 55, item.success, item.ordinary, [
        factor(skill(item.id, "gte", 75), 1.6, "Your subject knowledge is already advanced"),
        factor(stat("knowledge", "gte", 65), 1.4, "You can connect the details of the work"),
        factor(jobs(...item.jobs), 1.2, "You practise this subject in your regular work"),
      ])),
      decline("scholarly-mastery-decline", "Keep the work private for now", "You turn down the demonstration and continue studying on your own."),
    ]));

  world.events.push(encounter("rare-knowledge-breakthrough", "The missing part of the method",
    "A reader shares a difficult collection of worked examples. You recognize most of the methods, and a connection between them may resolve questions you have studied for years.",
    26, all(eligible("stat", "knowledge", 60), skill("literacy", "gte", 40),
      any(skill("philosophy", "gte", 40), skill("astronomy", "gte", 40), skill("reckoning", "gte", 50))), [
      attempt("knowledge-breakthrough-study", "Work through the examples and explain the connection", "stat", "knowledge", 60,
        "You work through each example and use the same method to solve the remaining questions. You can explain every step without the reader's help. Knowledge reaches its cap.",
        "You resolve some of the questions, but the general method still needs work. The reader leaves you another example to check.", [
          factor(stat("knowledge", "gte", 75), 1.5, "Your existing knowledge covers most of the problem"),
          factor(skill("literacy", "gte", 65), 1.3, "You can compare the difficult passages directly"),
          factor(skill("reckoning", "gte", 65), 1.3, "You can verify the calculations yourself"),
        ]),
      decline("knowledge-breakthrough-decline", "Leave the examples for another time", "You put the examples aside and return to your ordinary tasks."),
    ]));

  world.events.push(encounter("rare-community-recognition", "The neighborhood puts its trust in you",
    "Several households ask you to settle a shared supply agreement. They know your past work, but each has different needs. Getting everyone to accept one arrangement would strengthen your standing across the neighborhood.",
    30, all(eligible("stat", "bonds", 75), skill("oratory", "gte", 40)), [
      attempt("community-recognition-agreement", "Hear each household and arrange a shared agreement", "stat", "bonds", 75,
        "Every household accepts the terms and follows the same arrangement. People who rarely worked together now bring their requests through you. Bonds reaches its cap.",
        "Most households accept the terms, but two keep separate arrangements. You settle the immediate dispute and agree which details still need discussion.", [
          factor(skill("oratory", "gte", 65), 1.5, "You can keep the discussion clear and practical"),
          factor(stat("bonds", "gte", 85), 1.4, "The households already place great trust in you"),
          factor(stat("knowledge", "gte", 55), 1.2, "You can check how the different terms fit together"),
        ]),
      decline("community-recognition-decline", "Ask the households to choose another representative", "You explain that you cannot take on the agreement. The households find another person to arrange it."),
    ]));
  return world;
}
