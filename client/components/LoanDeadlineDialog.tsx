import { useEffect, useId, useRef } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { loanDeadlineWarning } from "../models/loan-summary.ts";
import { formatMoney } from "../models/wealth.ts";
import "../styles/moneylender.css";

interface Props {
  open: boolean;
  life: LifeState;
  world: WorldPack;
  onDismiss(): void;
  onManage(): void;
}

function OpenLoanDeadlineDialog({ life, world, onDismiss, onManage }: Omit<Props, "open">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const warning = loanDeadlineWarning(world, life);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) element.showModal();
    heading.current?.focus({ preventScroll: true });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  if (!warning) return null;
  return <dialog ref={dialog} className={`loan-deadline-dialog loan-warning-${warning.urgency}`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`} onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <header><span>REPAYMENT REMINDER</span><span>Age {life.age}</span></header>
    <div className="loan-deadline-content">
      <h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{warning.title}</h2>
      <p id={`${id}-body`}>{warning.description} This loan needs manual repayment.</p>
      <dl className="loan-deadline-facts">
        <div><dt>Still owed</dt><dd>{formatMoney(warning.balance, world)}</dd></div>
        <div><dt>Cash available</dt><dd>{formatMoney(warning.cash, world)}</dd></div>
        <div><dt>Deadline</dt><dd>{warning.dueYear} · age {warning.dueAge}</dd></div>
      </dl>
      <p className="loan-deadline-risk">{warning.dangerous ? "The loan has remained overdue. Collectors may use force, causing injury or death." : warning.threatened ? "Collectors are demanding payment. Keeping this loan overdue can lead to violence." : "Missing the deadline brings payment demands, followed by threats and possible violence if the loan stays overdue."}</p>
      <div className="loan-deadline-actions"><button type="button" className="loan-deadline-manage" onClick={onManage}>Manage loan</button><button type="button" onClick={onDismiss}>Got it</button></div>
      <p className="loan-deadline-note">This reminder does not make a payment or change your deadline.</p>
    </div>
  </dialog>;
}

export default function LoanDeadlineDialog({ open, ...props }: Props) {
  const warning = loanDeadlineWarning(props.world, props.life);
  return open && warning ? <OpenLoanDeadlineDialog key={warning.key} {...props} /> : null;
}
