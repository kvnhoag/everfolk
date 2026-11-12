import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { birthYearOf, formatYear, yearAtAge } from "../../src/calendar.ts";

export function isLoanAction(choice: Choice): boolean {
  return choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan"));
}

/** Deadline notes for the simple contract actions, alongside their money quote. */
export function loanEffectNotes(choice: Choice, life: LifeState, world: WorldPack): string[] {
  const model = world.economy?.moneylender;
  if (!model) return [];
  const branches = choice.outcomes.map(outcome => outcome.effects.filter(effect => effect.type === "loan"));
  if (!branches.length || branches.some(effects => effects.length !== 1)) return [];
  const actions = branches.map(effects => effects[0]);
  if (actions.every(effect => effect.action === "borrow")) return [`Due ${formatYear(yearAtAge(birthYearOf(world, life), life.age + model.termYears))}`];
  const loan = life.economy?.loan;
  if (!loan) return [];
  if (actions.every(effect => effect.action === "extend")) return [`New deadline ${formatYear(yearAtAge(birthYearOf(world, life), Math.max(life.age, loan.dueAge) + model.extensionYears))}`];
  if (actions.every(effect => effect.action === "repay" && (effect.amount ?? loan.balance) === loan.balance)) return ["Loan settled"];
  return [];
}

export function getLoanSummary(world: WorldPack, life: LifeState) {
  const lender = world.economy?.moneylender;
  const loan = life.economy?.loan;
  if (!lender || !loan || loan.balance <= 0) return;
  const yearsLeft = loan.dueAge - life.age;
  const overdueYears = Math.max(0, -yearsLeft);
  const dueYear = formatYear(yearAtAge(birthYearOf(world, life), loan.dueAge));
  const status = life.phase === "ended" ? "Outstanding at life end" : yearsLeft > 0 ? `Due in ${yearsLeft} ${yearsLeft === 1 ? "year" : "years"}`
    : yearsLeft === 0 ? "Payment due this year" : `${overdueYears} ${overdueYears === 1 ? "year" : "years"} overdue`;
  return {
    ...loan, title: lender.title, dueYear, status, yearsLeft, overdueYears,
    dueSoon: life.phase !== "ended" && yearsLeft >= 0 && yearsLeft <= 1,
    due: life.phase !== "ended" && yearsLeft <= 0,
    dangerous: life.phase !== "ended" && overdueYears >= lender.attackAfterYears,
    threatened: life.phase !== "ended" && overdueYears >= lender.threatAfterYears,
    description: yearsLeft > 0 ? `Repay by age ${loan.dueAge}, in ${dueYear}.` : yearsLeft === 0 ? `The balance is due this year, ${dueYear}.` : `The balance was due in ${dueYear}.`,
    extensionsLeft: Math.max(0, lender.maxExtensions - loan.extensions),
  };
}

/** A presentation reminder only: it never collects cash or advances a life. */
export function loanDeadlineWarning(world: WorldPack, life: LifeState) {
  const loan = getLoanSummary(world, life);
  if (!loan || life.phase === "ended" || loan.yearsLeft > 1) return;
  return {
    key: JSON.stringify([life.worldFingerprint, life.seed, loan.borrowedAge, loan.dueAge, life.age]),
    title: loan.yearsLeft === 1 ? "Your loan is due next year" : loan.yearsLeft === 0 ? "Your loan is due this year" : "Your loan is overdue",
    urgency: loan.yearsLeft > 0 ? "soon" as const : loan.yearsLeft === 0 ? "due" as const : "overdue" as const,
    balance: loan.balance,
    cash: life.economy?.cash ?? 0,
    dueAge: loan.dueAge,
    dueYear: loan.dueYear,
    yearsLeft: loan.yearsLeft,
    overdueYears: loan.overdueYears,
    threatened: loan.threatened,
    dangerous: loan.dangerous,
    description: loan.description,
  };
}
