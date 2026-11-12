/** Late life: funded work from finite accounts, and passing a craft on. Nothing here creates money. */
import type { Comparison, LifeState } from "../types.ts";
import type { AccountId, FieldId, Successor } from "./types.ts";

/** What a payer holds, or 0 when the life has no such account. */
export function accountBalance(life: LifeState, account: AccountId): number {
  return account === "army" ? life.demo?.town.army.purse ?? 0 : life.vocations?.accounts[account] ?? 0;
}

export function compareAccount(life: LifeState, account: AccountId, op: Comparison, value: number): boolean {
  const held = accountBalance(life, account);
  switch (op) {
    case "eq": return held === value;
    case "ne": return held !== value;
    case "gt": return held > value;
    case "gte": return held >= value;
    case "lt": return held < value;
    case "lte": return held <= value;
  }
}

/** Takes `amount` out of the payer's account and returns it, or returns 0 and takes nothing when the account cannot fund it. */
export function drawFromAccount(life: LifeState, account: AccountId, amount: number): number {
  if (accountBalance(life, account) < amount) return 0;
  if (account === "army") life.demo!.town.army.purse -= amount;
  else life.vocations!.accounts[account] -= amount;
  return amount;
}

/** A child this old can learn a craft; the event's child choice uses the same range. */
export const CHILD_FROM = 8, CHILD_TO = 40;

/** The first child old enough to learn, by name, else a generic apprentice. Pure. */
function successorName(life: LifeState, relation: Successor["relation"]): string {
  if (relation === "apprentice") return "an apprentice";
  const child = life.character?.children.find(item => life.age - item.birthAge >= CHILD_FROM && life.age - item.birthAge <= CHILD_TO);
  return child?.name ?? "a child";
}

/** Records who will carry the craft on; returns the journal line. */
export function recordSuccessor(life: LifeState, field: FieldId, relation: Successor["relation"], cause: string): string {
  const name = successorName(life, relation);
  const entry: Successor = { field, relation, name, age: life.age, year: life.year };
  life.paths!.successors = [...life.paths!.successors ?? [], entry];
  return `You pass the craft on: ${name} is trained as your successor (${cause}).`;
}
