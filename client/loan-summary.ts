import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import { formatYear, yearAtAge } from "../src/calendar.ts";

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
  if (actions.every(effect => effect.action === "borrow")) return [`Due ${formatYear(yearAtAge(world.startYear, life.age + model.termYears))}`];
  const loan = life.economy?.loan;
  if (!loan) return [];
  if (actions.every(effect => effect.action === "extend")) return [`New deadline ${formatYear(yearAtAge(world.startYear, Math.max(life.age, loan.dueAge) + model.extensionYears))}`];
  if (actions.every(effect => effect.action === "repay" && (effect.amount ?? loan.balance) === loan.balance)) return ["Loan settled"];
  return [];
}

export function getLoanSummary(world: WorldPack, life: LifeState) {
  const lender = world.economy?.moneylender;
  const loan = life.economy?.loan;
  if (!lender || !loan || loan.balance <= 0) return;
  const yearsLeft = loan.dueAge - life.age;
  const overdueYears = Math.max(0, -yearsLeft);
  const dueYear = formatYear(yearAtAge(world.startYear, loan.dueAge));
  const status = life.phase === "ended" ? "Outstanding at life end" : yearsLeft > 0 ? `Due in ${yearsLeft} ${yearsLeft === 1 ? "year" : "years"}`
    : yearsLeft === 0 ? "Payment due this year" : `${overdueYears} ${overdueYears === 1 ? "year" : "years"} overdue`;
  return {
    ...loan, title: lender.title, dueYear, status, overdueYears,
    dangerous: life.phase !== "ended" && overdueYears >= lender.attackAfterYears,
    threatened: life.phase !== "ended" && overdueYears >= lender.threatAfterYears,
    description: yearsLeft > 0 ? `Repay by age ${loan.dueAge}, in ${dueYear}.` : yearsLeft === 0 ? `The balance is due this year, ${dueYear}.` : `The balance was due in ${dueYear}.`,
    extensionsLeft: Math.max(0, lender.maxExtensions - loan.extensions),
  };
}
