// All projects, contacts, titles, prices and outcome weights below are authored
// fiction. Historical career models are research references, not prerequisites
// or evidence that these particular accomplishments or title ceremonies existed.
const all = (...conditions) => ({ type: "all", conditions });
const any = (...conditions) => ({ type: "any", conditions });
const not = condition => ({ type: "not", condition });
const skill = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const gain = (skill, delta) => ({ type: "skill", skill, delta });
const earned = (achievement, minYears = 0) => ({ type: "accomplishment", achievement, ...(minYears ? { minYears } : {}) });
const cash = delta => ({ type: "cash", delta });
const award = achievement => ({ type: "accomplishment", achievement });

export const lateRoutePlans = [
  {
    id: "sculpture", main: "sculpture", support: "carving", title: "Master Sculptor",
    specializations: [
      { id: "monumental-work", title: "A balanced monumental figure", main: "sculpture", support: "carving",
        text: "Plan and finish a large figure for a shared courtyard",
        accepted: "Your collaborators check the figure's balance, joins and finished surface. The customer accepts the completed commission and credits you for its design." },
      { id: "workshop-method", title: "A reliable workshop method", main: "pottery", support: "craft",
        text: "Develop and test a repeatable moulding and firing method",
        accepted: "The workshop repeats your tested process on a new batch. The pieces survive firing and the workers record the method with your name." },
    ],
    signatureTitle: "A workshop's signature collection", signatureName: "{name}'s Courtyard Collection",
    signatureText: "You complete {name}'s Courtyard Collection, record the difficult methods and teach the workshop to maintain the finished pieces. Your collaborators accept the collection under your name.",
    finalText: "The workshop and its customers review your completed commissions and the collection that remains in their care. They recognize you as Master Sculptor and retain your name with the work.",
  },
  {
    id: "philosophy", main: "philosophy", support: "oratory", title: "Keeper of a Living School",
    specializations: [
      { id: "defended-argument", title: "An argument that survives criticism", main: "philosophy", support: "oratory",
        text: "Revise an argument after a public discussion",
        accepted: "Readers test your premises with counterexamples. You answer the strongest objection and revise the argument before they accept the written discussion." },
      { id: "comparative-inquiry", title: "A checked comparative inquiry", main: "philosophy", support: "literacy",
        text: "Compare observations and write down their limits",
        accepted: "Your readers check the recorded observations against your explanation. You distinguish the cases that support it from those that remain uncertain, and the inquiry is accepted." },
    ],
    signatureTitle: "An independent course of inquiry", signatureName: "{name}'s Questions and Replies",
    signatureText: "You finish {name}'s Questions and Replies, credit the arguments you borrowed and teach a group through the remaining objections. The readers accept the work as your own connected inquiry.",
    finalText: "Former pupils return with questions and their own teaching notes. They recognize the school you have sustained around your accepted work, calling you Keeper of a Living School.",
  },
  {
    id: "seafaring", main: "seamanship", support: "reckoning", title: "Master of Safe Passages",
    specializations: [
      { id: "charted-passage", title: "A passage checked on the water", main: "seamanship", support: "reckoning",
        text: "Check a coastal passage and its water stops",
        accepted: "Your crew completes the passage and checks the landfalls, supplies and stopping places against your account. The accepted record distinguishes the route you sailed from hearsay." },
      { id: "crew-plan", title: "A crew plan tested at sea", main: "seamanship", support: "oratory",
        text: "Lead a crew through an agreed difficult passage",
        accepted: "The crew follows the agreed watches and responds to a damaged sail without abandoning the entrusted cargo. At the quay, the returning crew confirms your responsibility for the completed passage." },
    ],
    signatureTitle: "A useful book of passages", signatureName: "{name}'s Coastal Passages",
    signatureText: "You complete {name}'s Coastal Passages after checking its instructions on another voyage. Crew and customer accept both the completed delivery and the corrected account.",
    finalText: "Crews review the voyages you completed and the instructions they have used since. They recognize you as Master of Safe Passages; this distinction records past work and cannot promise a risk-free voyage.",
  },
  {
    id: "military", main: "warfare", support: "oratory", title: "Veteran Strategist",
    specializations: [
      { id: "supply-exercise", title: "A completed supply exercise", main: "warfare", support: "reckoning",
        text: "Plan and lead a bounded escort and supply exercise",
        accepted: "Your group completes the agreed escort exercise with its supplies accounted for. The observers record the route, decisions and shortages you actually resolved." },
      { id: "unit-exercise", title: "A unit exercise brought to order", main: "warfare", support: "oratory",
        text: "Lead a group through a difficult formation exercise",
        accepted: "Your group completes the exercise under the agreed limits. The observers accept your account of the orders, reserves and withdrawal, without conferring a royal commission." },
    ],
    signatureTitle: "A tested account of command", signatureName: "{name}'s Exercises in Command",
    signatureText: "Veterans test {name}'s Exercises in Command against the exercises you completed. You revise the supply and withdrawal sections before they accept the finished account.",
    finalText: "Veterans review your recorded service, completed exercises and the account others have used. They recognize you as Veteran Strategist. This distinction grants no army, territory or new office.",
  },
  {
    id: "commerce", main: "reckoning", support: "oratory", title: "Master of the Trading House",
    specializations: [
      { id: "audited-accounts", title: "A set of reconciled trading accounts", main: "reckoning", support: "literacy",
        text: "Reconcile a trading partnership's accounts and receipts",
        accepted: "The partners compare your completed accounts with their receipts and deliveries. You resolve the discrepancies and they accept the settled record." },
      { id: "supply-settlement", title: "A fulfilled negotiated supply agreement", main: "reckoning", support: "oratory",
        text: "Negotiate and fulfil a multi-party supply agreement",
        accepted: "You agree quantities, delivery and payment with the suppliers and customer. After the goods arrive and the accounts are settled, all parties accept the fulfilled agreement." },
    ],
    signatureTitle: "A trading house's completed ledger", signatureName: "{name}'s Settled Ledger",
    signatureText: "You finish {name}'s Settled Ledger after another trading season, settling the recorded obligations and retaining the supporting receipts. The partners accept the ledger and your responsibility for it.",
    finalText: "Customers and partners review your fulfilled orders, settled agreements and the ledger used over the following seasons. They recognize you as Master of the Trading House.",
  },
  {
    id: "astronomy-calendar", main: "astronomy", support: "reckoning", title: "Mathematical Author of Renown",
    specializations: [
      { id: "compared-calculations", title: "A set of independently checked calculations", main: "astronomy", support: "reckoning",
        text: "Compare the calculations behind two sets of sky tables",
        accepted: "Readers repeat your calculations and trace the differences between the two tables. They accept your corrected comparison while retaining its stated limits." },
      { id: "geometrical-exposition", title: "A demonstration another reader can reproduce", main: "reckoning", support: "literacy",
        text: "Write and defend a connected geometrical demonstration",
        accepted: "A reader reconstructs your figure and follows each justified step. You correct an unclear premise before the demonstration is accepted under your name." },
    ],
    signatureTitle: "A connected mathematical work", signatureName: "{name}'s Methods and Demonstrations",
    signatureText: "You complete {name}'s Methods and Demonstrations. Independent readers reproduce its examples, check the reasoning and accept the revised work with its debts to earlier authors credited.",
    finalText: "Readers bring copies used in their own lessons and compare them with your accepted work. They recognize you as Mathematical Author of Renown for the contribution they can reproduce.",
  },
  {
    id: "music-performance", main: "music", support: "oratory", title: "Master of the Ensemble",
    specializations: [
      { id: "ensemble-direction", title: "A difficult ensemble engagement", main: "music", support: "oratory",
        text: "Prepare and direct a demanding ensemble engagement",
        accepted: "The performers complete the agreed programme with your entries and changes clearly understood. The host accepts the engagement and credits your direction." },
      { id: "repertoire-teaching", title: "A repertoire passed to new performers", main: "music", support: "literacy",
        text: "Prepare a repertoire and teach it to new performers",
        accepted: "New performers learn the agreed repertoire from your rehearsals and notes. Their completed engagement confirms that they can perform it together, with earlier melodies properly credited." },
    ],
    signatureTitle: "An ensemble's lasting repertoire", signatureName: "{name}'s Rehearsal Collection",
    signatureText: "You complete {name}'s Rehearsal Collection and lead a further engagement from it. Performers accept the practical instructions and credit your arrangement and teaching.",
    finalText: "Performers review the engagements you led and the repertoire others have learned since. They recognize you as Master of the Ensemble and keep your name with the collection.",
  },
];

function prepared(plan, level, support) {
  if (plan.id !== "astronomy-calendar") return all(skill(plan.main, level), skill(plan.support, support));
  return any(
    all(earned(`${plan.id}-compared-calculations`), skill("astronomy", level), skill("reckoning", support)),
    all(earned(`${plan.id}-geometrical-exposition`), skill("reckoning", level), skill("literacy", support)),
  );
}

export function applyLateRoutes(world) {
  world.version = "0.34.0";
  for (const plan of lateRoutePlans) {
    const route = world.legacy.routes.find(route => route.id === plan.id);
    const firstId = `${plan.id}-first-work`;
    const first = world.legacy.achievements.find(item => item.id === firstId);
    const signature = `${plan.id}-signature-work`, title = `${plan.id}-ultimate-title`;
    const assessed = `late-${plan.id}-assessed`;
    world.flags[assessed] = { label: `${route.title}: final assessment completed`, initial: false };
    const specializations = plan.specializations.map(item => `${plan.id}-${item.id}`);
    const geometryEntry = `${plan.id}-geometry-first-work`;
    const entry = () => plan.id === "astronomy-calendar" ? any(earned(firstId), earned(geometryEntry)) : earned(firstId);
    if (plan.id === "astronomy-calendar") {
      route.achievementIds.push(geometryEntry);
      world.legacy.achievements.push({ id: geometryEntry, routeId: plan.id, title: "A checked measurement plan", kind: "ordinary",
        nameTemplate: "{name}'s Measured Courtyard", description: "A completed practical measurement whose recorded dimensions another reader has checked.",
        people: [...first.people], evidence: "fictional", sourceIds: [] });
      world.character.activities.push({ id: "complete-measured-plan", text: "Complete a checked courtyard measurement (5 drachmas)", category: "career", minAge: 16,
        when: all(skill("reckoning", 20), skill("literacy", 10), { type: "cash", op: "gte", value: 5 }, not(earned(geometryEntry))),
        outcomes: [{ id: "measured-plan-accepted", text: `${first.people.join(" and ")} check the dimensions in {name}'s Measured Courtyard against the completed measurement. They accept your practical plan and keep the record under your name. You spend 5 drachmas on measuring cord and writing materials.`, weight: 1,
          effects: [cash(-5), gain("reckoning", 2), gain("literacy", 1), award(geometryEntry)] }],
      });
    }
    route.achievementIds.push(...specializations, signature, title);
    route.stages = [
      { title: "Specialize", achievementIds: specializations },
      { title: "Signature work", achievementIds: [signature] },
      { title: "Ultimate title", achievementIds: [title] },
    ];
    const definition = (id, title, kind, nameTemplate, description) => {
      world.legacy.achievements.push({ id, routeId: plan.id, title, kind, nameTemplate, description,
        people: [...first.people], evidence: "fictional", sourceIds: [] });
    };
    function undertaking(id, text, minAge, conditions, cost, accepted, effects, failed, final = false) {
      world.character.activities.push({ id: `undertake-${id}`, text: `${text} (${cost} drachmas)`, category: "career", minAge,
        ...(final ? {} : { cooldownYears: 3 }),
        when: all(...conditions, { type: "cash", op: "gte", value: cost }, not(earned(id))),
        opportunity: { label: final ? plan.title : text, outcomeIds: [`${id}-accepted`] },
        outcomes: [
          { id: `${id}-accepted`, text: `${accepted} ${first.people.join(" and ")} confirm the accepted work and its credit. You spend ${cost} drachmas on the undertaking.`, weight: final ? 15 : 70,
            ...(final ? { weightModifiers: [
              { when: prepared(plan, 75, 40), multiplier: 1.5, reason: "Highly developed technique supports the review" },
              { when: prepared(plan, 65, 50), multiplier: 1.2, reason: "Strong supporting skill helps the review" },
            ] } : {}), effects: [cash(-cost), ...effects, award(id), ...(final ? [{ type: "flag", flag: assessed, value: true }] : [])] },
          { id: `${id}-unfinished`, text: `${failed} You spend ${cost} drachmas on the undertaking.${final ? " This route's final assessment is now complete; it cannot be repeated in this life." : " You can revise the work and attempt it again after three years."}`,
            weight: final ? 85 : 30,
            effects: [cash(-cost), ...(final ? [{ type: "flag", flag: assessed, value: true }] : [])] },
        ],
      });
    }
    plan.specializations.forEach((item, index) => {
      const id = specializations[index];
      definition(id, item.title, "ordinary", `{name}'s ${item.title.replace(/^A |^An /, "")}`, item.accepted);
      undertaking(id, item.text, 24, [entry(), skill(item.main, 40), skill(item.support, 20)], 10,
        item.accepted, [gain(item.main, 2), gain(item.support, 1)], "The reviewers find an unresolved problem and return your work with corrections.");
    });
    definition(signature, plan.signatureTitle, "prestige", plan.signatureName,
      "A substantial connected work, independently checked and retained under its maker's name.");
    undertaking(signature, `Complete ${plan.signatureTitle.toLowerCase()}`, 30,
      [entry(), any(...specializations.map(id => earned(id, 2))), prepared(plan, 55, 30)], 20,
      plan.signatureText, [{ type: "stat", stat: "bonds", delta: 2 }], "The readers identify a weakness that prevents acceptance of the complete work.");
    definition(title, plan.title, "ultimate", `{name}, ${plan.title}`, "An earned late-career distinction following accepted work and a later review.");
    undertaking(title, `Seek recognition as ${plan.title}`, 36,
      [entry(), earned(signature, 3), prepared(plan, 65, 40), { type: "flag", flag: assessed, value: false }], 10,
      plan.finalText, [{ type: "stat", stat: "bonds", delta: 3 }], "The reviewers acknowledge your earlier work but do not grant the final distinction.", true);
  }
  return world;
}
