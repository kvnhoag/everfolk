import type { Effect, WorldPack } from "../../src/types.ts";

type LoanEffect = Extract<Effect, { type: "loan" }>;

export default function LoanEffectEditor({ effect, world, onChange }: { effect: LoanEffect; world: WorldPack; onChange(effect: Effect): void }) {
  const lender = world.economy?.moneylender;
  return <>
    <select aria-label="Loan action" value={effect.action} onChange={event => onChange({ type: "loan", action: event.target.value as LoanEffect["action"] })}>
      <option value="borrow">Borrow on the configured terms</option>
      <option value="repay">Repay the moneylender</option>
      <option value="extend">Extend the repayment deadline</option>
    </select>
    {effect.action === "repay" ? <>
      <label className="admin-hint"><input type="checkbox" checked={effect.amount === undefined} onChange={event => onChange(event.target.checked ? { type: "loan", action: "repay" } : { type: "loan", action: "repay", amount: 10 })} /> Pay the full remaining balance</label>
      {effect.amount !== undefined && <input aria-label="Loan payment amount" type="number" min="1" step="1" value={effect.amount} onChange={event => onChange({ ...effect, amount: Number(event.target.value) })} />}
    </> : lender && <span className="admin-hint">{effect.action === "borrow" ? `Receive ${lender.principal}; owe ${lender.principal + lender.fee} ${world.economy!.currency.short}, due in ${lender.termYears} years.` : `Add ${lender.extensionFee} ${world.economy!.currency.short} to the balance and extend by ${lender.extensionYears} years; at most ${lender.maxExtensions} extension(s).`}</span>}
  </>;
}
