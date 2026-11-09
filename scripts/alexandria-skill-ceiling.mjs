// Authored skill balance. These numbers and exceptional encounters are game
// rules, not measured ability or reconstructed ancient qualifications.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const skill = (id, op, value) => ({ type: "skill", skill: id, op, value });
const earned = achievement => ({ type: "accomplishment", achievement });

const applied = [
  { id: "oratory", text: "Bring a difficult public discussion to an exact conclusion",
    works: ["philosophy-first-work", "music-performance-first-work", "commerce-first-work"],
    jobs: ["philosophy-tutor", "court-adviser", "performer"],
    success: "You hear each objection, separate the disputed points and answer without losing the thread. The listeners can repeat the agreement in the same terms. Your command of public speaking reaches its cap.",
    practice: "The listeners follow most of your case, but one unresolved objection returns. You work through that passage again and practise a clearer answer." },
  { id: "reckoning", text: "Reconcile a difficult account from independent records",
    works: ["commerce-first-work", "astronomy-calendar-first-work"],
    jobs: ["clerk", "shopkeeper", "sky-table-calculator", "patron-supported-reader"],
    success: "You trace the quantities through independently kept records, explain every discrepancy and verify the final totals by another method. Reckoning reaches its cap.",
    practice: "You reconcile the main totals, but an unexplained entry remains. Another reader helps you trace its origin and check that part of the calculation." },
  { id: "seamanship", text: "Plan and lead a demanding supervised passage",
    works: ["seafaring-first-work"], jobs: ["sailor"],
    success: "You explain the sail plan, organize each watch and adjust the work as the conditions change. The experienced hands agree that every check was completed in time. Seamanship reaches its cap.",
    practice: "The passage is completed, but an experienced hand must correct the timing of one maneuver. You practise the sequence again and discuss the earlier signs you missed." },
  { id: "warfare", text: "Demonstrate a veteran's command of a difficult field exercise",
    works: ["military-first-work"], jobs: ["soldier", "officer", "general"],
    success: "Drawing on your earlier service, you coordinate the exercise, keep the instructions clear and account for every group and piece of equipment. The veterans accept the demonstration without a correction. Warfare reaches its cap; no new rank is awarded.",
    practice: "The exercise exposes a confused instruction between two groups. You review it with the veterans, then practise a signal that avoids the same mistake." },
  { id: "music", text: "Lead an exacting performance checked by experienced musicians",
    works: ["music-performance-first-work"], jobs: ["performer"],
    success: "You carry the demanding passages cleanly, respond to the other players and bring each entrance together. The musicians accept the performance as an example for their future work. Music reaches its cap.",
    practice: "The performance holds together, but the musicians identify a rough transition. You rehearse the difficult entrance slowly before trying the passage again." },
];

export function applySkillCeiling(world) {
  for (const definition of Object.values(world.character.skills)) definition.gainCurve = [
    { from: definition.min, multiplier: 1 },
    { from: 40, multiplier: 0.5 },
    { from: 70, multiplier: 0.15 },
    { from: 85, multiplier: 0.05 },
    { from: 95, multiplier: 0.015 },
    { from: 99, multiplier: 0.003 },
  ];

  // Keep the original mastery module intact for retained content and its
  // release-specific tests. Only the current pack's skill encounters change.
  for (const id of ["rare-masterwork", "rare-scholarly-mastery"]) {
    const event = world.events.find(event => event.id === id);
    event.trigger.weight = 0.6;
    const eligibility = condition => {
      if (!condition) return;
      if (condition.type === "age" && condition.op === "gte" && condition.value === 24) condition.value = 30;
      if (condition.type === "skill" && condition.op === "gte" && [55, 60].includes(condition.value)) condition.value = 75;
      condition.conditions?.forEach(eligibility);
    };
    eligibility(event.when);
    for (const choice of event.choices) {
      eligibility(choice.when);
      for (const outcome of choice.outcomes) for (const modifier of outcome.weightModifiers ?? []) {
        if (modifier.when.type === "skill" && modifier.when.op === "gte" && modifier.when.value === 75) modifier.when.value = 85;
      }
    }
  }

  const eligible = entry => all(skill(entry.id, "gte", 75), skill(entry.id, "lt", world.character.skills[entry.id].max),
    any(...entry.works.map(earned)));
  world.events.push({ id: "rare-applied-mastery", title: "Experienced hands put your work to the test",
    text: "People who know your earlier work invite you to attempt a demanding demonstration in your strongest practical field. They will check the details, question your decisions and ask you to repeat anything uncertain. Years of practice give you a chance; acceptance is not assured.",
    rarity: "rare", trigger: { type: "random", weight: 0.6 }, maxOccurrences: 1,
    when: all({ type: "age", op: "gte", value: 30 }, { type: "stat", stat: "health", op: "gte", value: 35 }, any(...applied.map(eligible))),
    evidence: "fictional", sourceIds: [],
    choices: [
      { id: "applied-mastery-decline", text: "Keep to your present work", outcomes: [{ id: "applied-mastery-declined", text: "You decline the demonstration and continue the work you already know. No fee or new obligation is taken on.", weight: 1, effects: [] }] },
      ...applied.map(entry => ({ id: `applied-mastery-${entry.id}`, text: entry.text, when: eligible(entry),
        opportunity: { label: `${world.character.skills[entry.id].label} reaches its cap`, outcomeIds: [`applied-mastery-${entry.id}-mastered`] },
        outcomes: [
          { id: `applied-mastery-${entry.id}-mastered`, text: entry.success, weight: 40,
            effects: [{ type: "mastery", target: "skill", id: entry.id }],
            weightModifiers: [
              { when: skill(entry.id, "gte", 85), multiplier: 1.6, reason: "Your technique is already exceptionally developed" },
              { when: any(...entry.jobs.map(job => ({ type: "job", job }))), multiplier: 1.2, reason: "You use these methods in your regular work" },
            ] },
          { id: `applied-mastery-${entry.id}-practised`, text: entry.practice, weight: 60, effects: [{ type: "skill", skill: entry.id, delta: 2 }] },
        ] })),
    ] });
  return world;
}
