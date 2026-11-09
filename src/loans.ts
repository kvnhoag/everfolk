import type { Effect, LifeState, WorldPack } from "./types.ts";

type LoanEffect = Extract<Effect, { type: "loan" }>;
const LIMIT = 1_000_000_000_000;
const validMoney = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= LIMIT;

/** Read-only guard shared by voluntary activities, event choices and the ledger. */
export function loanEffectReason(world: WorldPack, state: LifeState, effect: LoanEffect): string | undefined {
  const model = world.economy?.moneylender, economy = state.economy;
  if (!model || !economy || !world.character || !state.character) return "This world has no moneylender contract.";
  if (state.phase === "ended") return "This life has ended.";
  if (!validMoney(economy.cash) || !validMoney(economy.debt) || (economy.loan && (!validMoney(economy.loan.balance) || economy.loan.balance > economy.debt))) return "The loan ledger is inconsistent.";
  const loan = economy.loan;
  if (effect.action === "borrow") {
    if (state.age < 18) return "Borrowing from this lender requires age 18.";
    if (loan && loan.balance > 0) return "Repay your existing moneylender loan first.";
    if (!validMoney(economy.cash + model.principal) || !validMoney(economy.debt + model.principal + model.fee)) return "The loan would exceed the ledger limit.";
    if (!Number.isSafeInteger(state.age + model.termYears)) return "The repayment age is outside the supported range.";
    return;
  }
  if (!loan || loan.balance <= 0) return "You have no unpaid moneylender loan.";
  if (effect.action === "repay") {
    const payment = effect.amount ?? loan.balance;
    if (!validMoney(payment) || payment <= 0) return "A loan payment must be a positive whole amount.";
    if (payment > loan.balance) return `You owe only ${loan.balance} ${world.economy!.currency.short} to the moneylender.`;
    if (payment > economy.cash) return `Needs ${payment} ${world.economy!.currency.short} in cash (you have ${economy.cash}).`;
    return;
  }
  if (state.age < loan.dueAge) return `An extension can be requested when the loan is due at age ${loan.dueAge}.`;
  if (loan.extensions >= model.maxExtensions) return "The lender will not extend this loan again.";
  if (!validMoney(economy.debt + model.extensionFee) || !validMoney(loan.balance + model.extensionFee)) return "The extension would exceed the ledger limit.";
  if (!Number.isSafeInteger(Math.max(state.age, loan.dueAge) + model.extensionYears)) return "The extended repayment age is outside the supported range.";
}

/** Called only on a detached engine/projection snapshot after the shared guard. */
export function applyLoanEffect(world: WorldPack, state: LifeState, effect: LoanEffect): void {
  const reason = loanEffectReason(world, state, effect);
  if (reason) throw new Error(reason);
  const model = world.economy!.moneylender!, economy = state.economy!;
  if (effect.action === "borrow") {
    const balance = model.principal + model.fee;
    economy.cash += model.principal;
    economy.debt += balance;
    economy.loan = { balance, borrowedAge: state.age, dueAge: state.age + model.termYears, extensions: 0 };
  } else if (effect.action === "repay") {
    const payment = effect.amount ?? economy.loan!.balance;
    economy.cash -= payment;
    economy.debt -= payment;
    economy.loan!.balance -= payment;
    if (economy.loan!.balance === 0) delete economy.loan;
  } else {
    economy.debt += model.extensionFee;
    economy.loan!.balance += model.extensionFee;
    economy.loan!.extensions++;
    economy.loan!.dueAge = Math.max(state.age, economy.loan!.dueAge) + model.extensionYears;
  }
}

/** Contract interrupts are deterministic and cannot be selected as random stories. */
export function loanCollectionEventId(world: WorldPack, state: LifeState): string | undefined {
  const model = world.economy?.moneylender, loan = state.economy?.loan;
  if (!model || !loan || loan.balance <= 0 || state.phase === "ended" || state.age < loan.dueAge || loan.lastCollectionAge === state.age) return;
  const overdue = state.age - loan.dueAge;
  return overdue >= model.attackAfterYears ? model.events.attack : overdue >= model.threatAfterYears ? model.events.threat : model.events.due;
}
