import { useEffect, useId, useRef } from "react";
import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { formatYear, yearAtAge } from "../../src/calendar.ts";
import { formatMoney } from "../models/wealth.ts";
import { requiredCash } from "../models/loan-access.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import "../styles/loan-offer.css";

export interface LoanRequest {
  kind: "activity" | "choice" | "fund-activity";
  id: string;
  snapshot: LifeState;
}

/** This dialog explains a contract; it never accepts one on mount or dismissal. */
export default function LoanOfferDialog({ request, choice, life, world, onCancel, onConfirm }: {
  request: LoanRequest;
  choice: Choice;
  life: LifeState;
  world: WorldPack;
  onCancel(): void;
  onConfirm(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    heading.current?.focus({ preventScroll: true });
    return () => { dialog?.close(); document.body.style.overflow = overflow; previousFocus?.focus({ preventScroll: true }); };
  }, []);
  const lender = world.economy?.moneylender;
  if (!lender || !life.economy) return null;
  const cost = requiredCash(choice, world);
  const shortfall = Math.max(0, cost - life.economy.cash);
  const dueAge = life.age + lender.termYears;
  return <dialog ref={ref} className="loan-offer-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onCancel(); }}>
    <header><span>OPTIONAL LOAN</span><span>Age {life.age} · {formatYear(life.year)}</span></header>
    <div className="loan-offer-content">
      <h2 id={titleId} ref={heading} tabIndex={-1}>{shortfall > 0 ? "Short of cash?" : "Borrow from the moneylender?"}</h2>
      {shortfall > 0 ? <p>You have <strong>{formatMoney(life.economy.cash, world)}</strong>. This opportunity needs <strong>{formatMoney(cost, world)}</strong>, leaving you <strong>{formatMoney(shortfall, world)}</strong> short.</p> : <p>The {lender.title.toLocaleLowerCase()} offers ready cash on these terms.</p>}
      <p className="loan-offer-target">{choice.text}</p>
      <dl className="loan-offer-terms">
        <div><dt>Cash received</dt><dd>{formatMoney(lender.principal, world)}</dd></div>
        <div><dt>Lender’s fee</dt><dd>{formatMoney(lender.fee, world)}</dd></div>
        <div><dt>Total to repay</dt><dd>{formatMoney(lender.principal + lender.fee, world)}</dd></div>
        <div><dt>Repay by</dt><dd>Age {dueAge} · {formatYear(yearAtAge(world.startYear, dueAge))}</dd></div>
      </dl>
      {shortfall > 0 && <p>The loan covers the upfront cash requirement. Any additional earnings or costs depend on the result.</p>}
      <p className="loan-offer-risk">Repayment is manual. An overdue loan brings demands, threats and possible violence. Borrowing does not guarantee future earnings.</p>
      <div className="loan-offer-impact"><ChoiceImpact choice={choice} world={world} life={life} /></div>
      <div className="loan-offer-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>No, go back</button>
        <button type="button" className="primary-button" onClick={onConfirm}>{request.kind === "fund-activity" || shortfall > 0 ? "Accept loan and continue" : "Accept loan"}</button>
      </div>
      <p className="loan-offer-note">Going back accepts no loan and spends no cash.</p>
    </div>
  </dialog>;
}
