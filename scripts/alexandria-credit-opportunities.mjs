// Optional, fictional investments in learning. Ordinary cash payment and walking
// away remain separate choices; a loan is never created by background narration.
const all = (...conditions) => ({ type: "all", conditions });
const cashAtLeast = value => ({ type: "cash", op: "gte", value });
const trained = (skill, value) => ({ type: "skill", skill, op: "gte", value });
const gain = (skill, delta) => ({ type: "skill", skill, delta });

export const CREDIT_OPPORTUNITIES = [
  { route: "sculpture", title: "A place at the relief bench", cost: 90,
    text: "A sculptor offers a place in a short supervised workshop. The fee covers a stone offcut, shared tools and the maker's time. You can practise an ambitious relief, but the place is optional and must be paid for before work begins.",
    requirements: [trained("craft", 15), trained("carving", 20), trained("pottery", 10)],
    action: "join the relief workshop", result: "You pay for the workshop place. Over several sessions you mark out a relief, test shallow cuts and revise an uneven edge with the sculptor's guidance. You keep the practice piece; no customer commission or named accomplishment has been awarded.",
    gains: [gain("sculpture", 6), gain("carving", 3)] },
  { route: "philosophy", title: "A reader opens a small study circle", cost: 80,
    text: "A reader invites you to a short study circle comparing arguments about keeping promises. The fee pays for copied extracts and guided discussions. A place is available if you can meet the fee; your ordinary reading and practice can continue without it.",
    requirements: [trained("literacy", 20), trained("oratory", 10)],
    action: "join the study circle", result: "You pay for the copied extracts and meetings. You compare two arguments, explain an objection aloud and revise your written outline. This is guided preparation, rather than a teaching post or a completed legacy work.",
    gains: [gain("philosophy", 6), gain("oratory", 3)] },
  { route: "seafaring", title: "A berth for a practice passage", cost: 100,
    text: "A crew offers a supervised place on a short practice passage. The fee covers your berth, meals and practice materials, with no wage or cargo profit promised. You can learn from an experienced hand if you can pay before departure.",
    requirements: [trained("seamanship", 10), trained("reckoning", 5)],
    action: "take the practice berth", result: "You pay for the berth and join the supervised passage. You check lashings, share a watch and compare the load list with an experienced hand. The practice gives you confidence, but is not a paid delivery or a named voyage accomplishment.",
    gains: [gain("seamanship", 6), gain("reckoning", 3)] },
  { route: "military", title: "Extra practice with a veteran", cost: 80,
    text: "A veteran offers extra instruction in clear signals and accounting for equipment. The fee covers a practice space, worn training gear and several sessions. This private practice carries no promise of enlistment, rank or a service distinction.",
    requirements: [trained("craft", 10), trained("warfare", 10), { type: "stat", stat: "health", op: "gte", value: 20 }],
    action: "arrange the veteran's sessions", result: "You pay for the practice sessions. You rehearse signals, check equipment lists and correct a confused instruction with the veteran. You improve your preparation without receiving a military appointment or a recorded campaign achievement.",
    gains: [gain("warfare", 6), gain("reckoning", 3)] },
  { route: "commerce", title: "A trader teaches the full account", cost: 90,
    text: "A trader offers guided work through a set of practice supply accounts. The fee covers copies, the trader's time and checking each disputed entry together. These are teaching accounts, with no stock purchase or future profit guaranteed.",
    requirements: [trained("reckoning", 15), trained("literacy", 10)],
    action: "study the supply accounts", result: "You pay for the instruction and work through receipts, quantities and disputed totals. The trader checks your reasoning and asks you to explain a correction. You gain practice rather than goods, a profitable order or a trading accomplishment.",
    gains: [gain("reckoning", 6), gain("oratory", 3)] },
  { route: "astronomy-calendar", title: "A place beside the measuring table", cost: 100,
    text: "A table reader offers supervised sessions comparing recorded intervals and checking arithmetic. The fee covers copied tables, measuring materials and instruction. A place is open if you can pay; the exercise offers no promise of predicting future events.",
    requirements: [trained("literacy", 15), trained("reckoning", 15)],
    action: "join the table-reading sessions", result: "You pay for the sessions, compare recorded intervals and correct an arithmetic column under supervision. You distinguish measured entries from uncertain seasonal expectations. The exercise improves your preparation without awarding a published table or legacy record.",
    gains: [gain("astronomy", 6), gain("reckoning", 3)] },
  { route: "music-performance", title: "An ensemble has a rehearsal place", cost: 80,
    text: "An ensemble invites you to a short course of guided rehearsals. The fee covers a shared practice room, borrowed equipment and the lead performer's instruction. The place gives you time to practise, without guaranteeing a paid engagement.",
    requirements: [trained("music", 10), trained("literacy", 10)],
    action: "join the ensemble rehearsals", result: "You pay for the rehearsals and practise entrances, phrasing and keeping time with the ensemble. The lead performer helps you correct a rushed passage. Your preparation improves, but no paid engagement or named performance accomplishment has been granted.",
    gains: [gain("music", 6), gain("oratory", 3)] },
];

export function applyCreditOpportunities(world) {
  const principal = world.economy.moneylender.principal;
  for (const entry of CREDIT_OPPORTUNITIES) {
    const prefix = `credit-opportunity-${entry.route}`;
    const effects = [{ type: "cash", delta: -entry.cost }, ...structuredClone(entry.gains)];
    world.events.push({ id: prefix, title: entry.title, text: `${entry.text} The upfront fee is ${entry.cost} drachmas.`,
      trigger: { type: "random", weight: 2 }, maxOccurrences: 1,
      when: all({ type: "age", op: "gte", value: 18 }, ...structuredClone(entry.requirements),
        { type: "skill", skill: entry.gains[0].skill, op: "lt", value: 70 }), evidence: "fictional", sourceIds: [],
      choices: [
        { id: `${prefix}-decline`, text: "Leave the opportunity for now", outcomes: [{ id: `${prefix}-declined`, weight: 1,
          text: "You leave the optional place for someone else. You pay nothing, take no loan and can continue your usual practice.", effects: [] }] },
        { id: `${prefix}-pay`, text: `Pay ${entry.cost} drachmas to ${entry.action}`, when: cashAtLeast(entry.cost),
          outcomes: [{ id: `${prefix}-completed`, text: entry.result, weight: 1, effects: structuredClone(effects) }] },
        { id: `${prefix}-borrow`, text: `Ask the moneylender for cash to ${entry.action}`, when: all(
          { type: "age", op: "gte", value: 18 }, { type: "loan", status: "none" },
          { type: "cash", op: "lt", value: entry.cost }, cashAtLeast(Math.max(0, entry.cost - principal))),
          outcomes: [{ id: `${prefix}-financed`, text: `You accept the moneylender's stated repayment terms and use the borrowed cash for the optional place. ${entry.result}`, weight: 1,
            effects: [{ type: "loan", action: "borrow" }, ...structuredClone(effects)] }] },
      ] });
  }
  return world;
}
