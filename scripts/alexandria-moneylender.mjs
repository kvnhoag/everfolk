// Voluntary risky credit. Terms and violent encounters are authored fiction;
// the loan contract source supports lending and default clauses, not murder.
const loan = action => ({ type: "loan", action });
const activeLoan = { type: "loan", status: "active" };
const dueLoan = { type: "loan", status: "due" };
const noLoan = { type: "loan", status: "none" };
const all = (...conditions) => ({ type: "all", conditions });
const ageAtLeast = value => ({ type: "age", op: "gte", value });
const stat = (stat, delta) => ({ type: "stat", stat, delta });
const skill = (skill, delta) => ({ type: "skill", skill, delta });
const result = (id, text, effects = [], weight = 1, weightModifiers) => ({ id, text, weight, effects, ...(weightModifiers ? { weightModifiers } : {}) });
const choice = (id, text, outcomes, when) => ({ id, text, outcomes, ...(when ? { when } : {}) });
const one = (id, text, outcome, effects = [], when) => choice(id, text, [result(`${id}-result`, outcome, effects)], when);
const repay = (id = "pay-moneylender-balance") => one(id, "Pay the remaining balance", "You pay the remaining balance. The lender marks the loan settled. You owe them nothing.", [loan("repay")], activeLoan);
const part = (id = "pay-moneylender-instalment") => one(id, "Pay 10 drachmas toward the loan", "You pay 10 drachmas toward the loan. The remaining balance keeps its existing deadline.", [{ type: "loan", action: "repay", amount: 10 }], activeLoan);
const extend = (id = "extend-moneylender-deadline") => one(id, "Ask for an extension", "The lender adds the agreed extension charge to the balance and gives you a new deadline.", [loan("extend")], dueLoan);
const delay = (id = "delay-moneylender-payment") => one(id, "Leave the loan unpaid for now", "You leave the balance unpaid. The deadline has not changed, and the collectors may return.");
const collection = (id, title, text, choices, sources = ["alexandrian-loan-contract"]) => ({
  id, title, text, trigger: { type: "random", weight: 1 }, when: all(ageAtLeast(18), dueLoan),
  maxOccurrences: 100, cooldownYears: 1, evidence: "fictional", sourceIds: sources, choices,
});

export function applyMoneylender(world) {
  world.version = "0.21.0";
  world.economy.moneylender = {
    title: "Harbor moneylender", principal: 100, fee: 30, termYears: 3,
    threatAfterYears: 1, attackAfterYears: 3,
    extensionYears: 2, extensionFee: 20, maxExtensions: 1,
    events: { due: "lender-payment-due", threat: "lender-threat", attack: "lender-confrontation" },
  };
  world.economy.description += " A voluntarily accepted moneylender loan has its own balance and deadline. Ordinary household debt keeps automatic repayment; this loan must be paid deliberately. Its upfront charge and optional extension charge are fixed game terms, not measured ancient prices. Collectors pursue only that accepted loan.";
  const borrow = one("borrow-moneylender", "Borrow from the moneylender — dangerous loan",
    "You accept the moneylender's cash and repayment terms. You must pay this loan yourself. If it stays unpaid after the deadline, the collectors can threaten, injure or kill you.",
    [loan("borrow")], all(ageAtLeast(18), noLoan));
  world.character.activities.push(
    { ...borrow, category: "finance", minAge: 18, cooldownYears: 1, usesYearlyActivity: false },
    { ...repay("repay-moneylender"), category: "finance", minAge: 18, cooldownYears: 1, usesYearlyActivity: false },
    { ...part("repay-moneylender-part"), category: "finance", minAge: 18, cooldownYears: 1, usesYearlyActivity: false },
    { ...extend("extend-moneylender"), category: "finance", minAge: 18, cooldownYears: 1, usesYearlyActivity: false },
  );

  const wound = { type: "condition", condition: "open-leg-fracture" };
  const fatal = { type: "end", ending: "death-by-collector", deathCause: "moneylender-stabbing" };
  const plead = choice("ask-neighbors-to-intercede", "Ask the neighbors to speak for you", [
    result("neighbors-persuade-collectors", "Neighbors speak with the collectors. They leave without hurting you, but the balance remains overdue.", [stat("bonds", -1), skill("oratory", 1)], 60, [
      { when: { type: "stat", stat: "bonds", op: "gte", value: 60 }, multiplier: 1.5, reason: "People nearby are willing to speak for you" },
      { when: { type: "skill", skill: "oratory", op: "gte", value: 25 }, multiplier: 1.5, reason: "You can explain your request clearly" },
    ]),
    result("neighbors-cannot-stop-beating", "The collectors shove your neighbors aside and beat you before leaving. You are hurt, and the loan remains unpaid.", [stat("health", -8), stat("bonds", -2)], 35),
    result("collectors-break-leg", "A collector strikes your lower leg. You suffer an open tibial fracture and need care. The loan remains unpaid.", [stat("health", -10), wound, stat("bonds", -2)], 5),
  ]);
  plead.opportunity = { label: "Leave without an assault", outcomeIds: ["neighbors-persuade-collectors"] };

  world.events.push(
    {
      id: "lender-offer", title: "A moneylender offers cash",
      text: "A moneylender offers ready cash on the stated repayment terms. This loan is paid manually. Missing the deadline can lead to threats, assault or death.",
      trigger: { type: "random", weight: 1 }, when: all(ageAtLeast(18), noLoan, { type: "cash", op: "lt", value: 50 }),
      maxOccurrences: 2, cooldownYears: 8, evidence: "fictional", sourceIds: ["alexandrian-loan-contract"],
      choices: [one("decline-moneylender-offer", "Turn down the loan", "You turn down the loan. You owe this lender nothing."), { ...structuredClone(borrow), id: "accept-moneylender-offer" }],
    },
    collection("lender-payment-due", "Your loan is due", "The moneylender asks for the remaining balance. Leaving it unpaid can bring threats and, after a longer delay, a dangerous confrontation.", [repay(), part(), extend(), delay()]),
    collection("lender-threat", "Collectors at your door", "Two collectors demand payment. They threaten to hurt you if you keep delaying. The balance and deadline remain in force.", [repay("settle-lender-threat"), part("part-pay-lender-threat"), extend("extend-after-lender-threat"), delay("ignore-lender-threat")]),
    collection("lender-confrontation", "The collectors corner you", "The loan has been overdue for years. Collectors stop you on your way home and threaten violence. Refusing or trying to run can be fatal.", [
      repay("settle-lender-confrontation"), part("part-pay-lender-confrontation"), extend("extend-at-lender-confrontation"), plead,
      choice("run-from-collectors", "Try to get past them and run", [
        result("escape-collectors", "You get past the collectors and reach a crowded street. You escape for now, but the loan is still overdue.", [stat("health", -2), stat("bonds", -1)], 85),
        result("escape-collectors-leg-injury", "A collector catches you and strikes your lower leg. You suffer an open tibial fracture and need care.", [stat("health", -12), wound], 12),
        result("escape-collectors-fatal", "A collector stabs you in the chest as you try to pass. The wound proves fatal.", [fatal], 3),
      ]),
      choice("refuse-collectors", "Refuse to pay or go with them", [
        result("collectors-beat-you", "The collectors beat you and leave. You are badly hurt, and the loan remains overdue.", [stat("health", -12), stat("bonds", -3)], 70),
        result("collectors-break-leg-after-refusal", "The collectors strike your lower leg. An open tibial fracture stops you walking, and you need care.", [stat("health", -15), wound, stat("bonds", -3)], 25),
        result("collectors-stab-you", "A collector stabs you in the chest during the confrontation. The wound proves fatal.", [fatal], 5),
      ]),
    ], []),
  );
  world.character.deathCauses.push({
    id: "moneylender-stabbing", title: "Stab wound to the chest",
    text: "A collector stabs you during a confrontation over your unpaid moneylender loan. The chest wound proves fatal.",
    weight: 1, choiceOnly: true,
  });
  world.endings.push({
    id: "death-by-collector", title: "Killed by a collector", kind: "death", evidence: "fictional", sourceIds: [],
    text: "A collector stabs you during a confrontation over the unpaid loan. The chest wound proves fatal.",
  });
  if (!world.sources.some(source => source.id === "alexandrian-loan-contract")) world.sources.push({
    id: "alexandrian-loan-contract", title: "BGU 4.1151.2: Loan agreement",
    url: "https://classics.uc.edu/users/vanminnen/Alexandria/BGU_4.1151.2.html",
    publisher: "University of Cincinnati; Peter van Minnen translation", kind: "primary",
    period: "12 April 13 BCE, early Roman period", geography: "Alexandria",
    summary: "Records a money loan with scheduled instalments, default penalties and enforcement claims against debtors and workshop property.",
    limitations: "One early Roman contract, later than the Ptolemaic beginning of the game. Contractual enforcement clauses do not establish how frequently they were exercised or support violent collectors, murder, or the game's loan terms and risks.",
    accessed: "2026-11-07",
  });
  return world;
}
