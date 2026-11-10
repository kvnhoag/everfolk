// A skill can earn a small commission before becoming the person's occupation.
// Prices, thresholds and access are authored game balance, not ancient wage data.
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const cash = delta => ({ type: "cash", delta });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const all = (...conditions) => ({ type: "all", conditions });

export function applyInterestCareers(world) {
  const gigs = [
    {
      id: "small-pottery-order", text: "Make a small pottery order", minAge: 14,
      requirements: { pottery: 20, craft: 15 }, materials: 10, payment: 30,
      outcome: "You use a workshop's kiln to finish a few small vessels. After paying for clay and firing, you earn 20 drachmas.",
      effects: [skill("pottery", 2), stat("health", -1)],
    },
    {
      id: "small-carving-order", text: "Carve a small wooden fitting", minAge: 14,
      requirements: { carving: 20, craft: 15 }, materials: 10, payment: 30,
      outcome: "You borrow bench space, shape the fitting and check it against the measurements. After materials and tool use, you earn 20 drachmas.",
      effects: [skill("carving", 2), stat("health", -1)],
    },
    {
      id: "small-figure-order", text: "Make a small figure for a customer", minAge: 16,
      requirements: { sculpture: 25, carving: 15 }, materials: 20, payment: 50,
      outcome: "You finish a small figure to the customer's design. After materials and workshop use, you earn 30 drachmas.",
      effects: [skill("sculpture", 2), stat("health", -1)],
    },
    {
      id: "teach-a-reading-lesson", text: "Teach a reading and discussion lesson", minAge: 16,
      requirements: { philosophy: 20, literacy: 20, oratory: 10 }, materials: 0, payment: 20,
      outcome: "You read a short passage with a learner and help them explain its argument. The household pays you 20 drachmas for the lesson.",
      effects: [skill("philosophy", 2), skill("oratory", 1), stat("knowledge", 1)],
    },
    {
      id: "copy-a-sky-table", text: "Copy and check a sky table", minAge: 16,
      requirements: { astronomy: 20, reckoning: 20, literacy: 15 }, materials: 10, payment: 30,
      outcome: "You copy a table and check the positions and arithmetic with an experienced reader. After writing materials, you earn 20 drachmas.",
      effects: [skill("astronomy", 2), skill("reckoning", 1), stat("knowledge", 1)],
    },
    {
      id: "prepare-a-chart-reading", text: "Prepare a traditional chart reading", minAge: 18,
      requirements: { astrology: 25, astronomy: 15, reckoning: 20, literacy: 15 }, materials: 10, payment: 30,
      outcome: "You prepare the chart and explain its traditional interpretation. After writing materials, you earn 20 drachmas. The reading records a belief, not a reliable prediction.",
      effects: [skill("astrology", 2), skill("astronomy", 1)],
      when: { type: "year", op: "gte", value: -29 },
    },
  ];
  for (const gig of gigs) {
    const conditions = Object.entries(gig.requirements).map(([id, minimum]) => trained(id, minimum));
    if (gig.materials) conditions.push({ type: "cash", op: "gte", value: gig.materials });
    if (gig.when) conditions.push(gig.when);
    world.character.activities.push({
      id: gig.id, text: gig.text, category: "career", minAge: gig.minAge, cooldownYears: 2,
      when: all(...conditions),
      outcomes: [{ id: `${gig.id}-result`, text: gig.outcome, weight: 1,
        effects: [...(gig.materials ? [cash(-gig.materials)] : []), cash(gig.payment), ...gig.effects] }],
    });
  }

  // Qualified interests also appear at the existing career crossroads. Joining
  // an occupation is an explicit choice; commissions above never change jobs.
  const offers = world.events.find(event => event.id === "a-place-on-the-manifest");
  offers.text = "Workshops, merchant crews and local teachers are looking for help. Your skills decide which offers you can take. You can also keep your current work.";
  const careers = {
    "ceramic-decorator": "Make pottery decoration your regular work",
    "wood-carver": "Make wood carving your regular work",
    sculptor: "Make sculpture your regular work",
    "philosophy-tutor": "Make teaching philosophy your regular work",
    "sky-table-calculator": "Make sky-table work your regular occupation",
    astrologer: "Make chart reading your regular work",
  };
  for (const [id, text] of Object.entries(careers)) {
    const occupation = world.character.jobs.find(job => job.id === id);
    const start = world.character.activities.find(activity => activity.id === `work-${id}`);
    if (!occupation || !start) throw new Error(`Missing interest career: ${id}`);
    offers.choices.push({
      id: `interest-career-${id}`, text,
      when: all({ type: "age", op: "gte", value: occupation.minAge }, ...(start.when ? [structuredClone(start.when)] : [])),
      outcomes: start.outcomes.map(outcome => ({ ...structuredClone(outcome), id: `interest-career-${id}-${outcome.id}` })),
    });
  }
  return world;
}
