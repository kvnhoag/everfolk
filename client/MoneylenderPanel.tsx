import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import { formatMoney } from "./wealth.ts";
import { practiceBlockReason } from "./skill-tree.ts";
import { getLoanSummary, isLoanAction } from "./loan-summary.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import "./moneylender.css";

export function MoneylenderNotice({ life, world, onManage }: { life: LifeState; world: WorldPack; onManage(): void }) {
  const loan = getLoanSummary(world, life);
  if (!loan || life.phase === "ended") return null;
  return <aside className={`moneylender-notice${loan.dueSoon ? " lender-due-soon" : ""}${loan.due ? " lender-overdue" : ""}`} aria-label="Moneylender loan" role={loan.dueSoon || loan.due ? "status" : undefined}>
    <div><strong>{loan.yearsLeft === 1 ? "Repayment next year · " : loan.yearsLeft === 0 ? "Repayment due · " : ""}{formatMoney(loan.balance, world)} owed to the moneylender</strong><span>{loan.status} · Deadline {loan.dueYear}{loan.dangerous ? " · Collectors may attack" : loan.threatened ? " · Collectors are demanding payment" : loan.dueSoon ? " · Repay manually from Wealth" : ""}</span></div>
    <button type="button" onClick={onManage}>Manage loan <span aria-hidden="true">↗</span></button>
  </aside>;
}

export default function MoneylenderPanel({ life, world, activities, onActivity }: {
  life: LifeState; world: WorldPack; activities: readonly ActivityAvailability[]; onActivity(id: string): void;
}) {
  const lender = world.economy?.moneylender;
  if (!lender || life.age < 18) return null;
  const loan = getLoanSummary(world, life);
  if (!loan && life.phase === "ended") return null;
  const actions = activities.filter(activity => isLoanAction(activity) && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "loan" && (loan ? effect.action !== "borrow" : effect.action === "borrow"))));
  return <section className={`moneylender-panel${loan?.threatened ? " lender-overdue" : ""}`} aria-labelledby="moneylender-title">
    <header><span>{loan ? "LOAN AGREEMENT" : "RISKY LOAN"}</span><h4 id="moneylender-title">{lender.title}</h4></header>
    {loan ? <>
      <div className="lender-balance"><strong>{formatMoney(loan.balance, world)}</strong><span>still owed</span><b>{loan.status}</b></div>
      <p>{loan.description} {loan.extensionsLeft > 0 ? `${loan.extensionsLeft === 1 ? "One extension remains" : `${loan.extensionsLeft} extensions remain`}. An extension adds ${formatMoney(lender.extensionFee, world)} to the balance and gives you ${lender.extensionYears} more ${lender.extensionYears === 1 ? "year" : "years"}.` : "No further extension available."}</p>
      {life.phase !== "ended" && <p className="lender-risk">{loan.dangerous ? "Collectors may use force. A confrontation can cause injury or death." : "Leaving this loan overdue leads to demands, threats and possible violence."}</p>}
    </> : <>
      <p>Receive <strong>{formatMoney(lender.principal, world)}</strong>. Repay <strong>{formatMoney(lender.principal + lender.fee, world)}</strong> within {lender.termYears} {lender.termYears === 1 ? "year" : "years"}.</p>
      <p className="lender-risk">This loan requires manual repayment. If it stays overdue, collectors can threaten, injure or kill you.</p>
    </>}
    {life.phase !== "ended" && <div className="wealth-actions">{actions.map(activity => {
      const reason = practiceBlockReason(activity, life);
      return <button type="button" className="wealth-action" key={activity.id} disabled={Boolean(reason)} onClick={() => onActivity(activity.id)}>
        <span className="wealth-action-title">{activity.text}<span aria-hidden="true">↗</span></span>
        <ChoiceImpact choice={activity} life={life} world={world} />
        {reason && <span className="wealth-action-reason">{reason}</span>}
      </button>;
    })}</div>}
  </section>;
}
