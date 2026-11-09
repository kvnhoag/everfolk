import type { ActivityAvailability, LifeState, WorldPack } from "../src/types.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { practiceBlockReason } from "./skill-tree.ts";
import { formatMoney, getWealthSummary } from "./wealth.ts";
import "./wealth.css";

/** The same read-only view and accepted activities are used in game and draft preview. */
export default function WealthPanel({ life, world, activities, onActivity }: {
  life: LifeState; world: WorldPack; activities: readonly ActivityAvailability[]; onActivity: (id: string) => void;
}) {
  const summary = getWealthSummary(world, life);
  if (!summary || !world.economy) return <p className="character-empty">This life uses its original Resources score.</p>;
  const money = (amount: number) => formatMoney(amount, world);
  const finance = activities.filter(activity => activity.category === "finance" && life.age >= (activity.minAge ?? 0));
  const hasFreePayments = finance.some(activity => activity.usesYearlyActivity === false);
  return <section className="wealth-panel" aria-label="Your household wealth">
    <div className="character-section-heading"><span>{life.age < 18 ? "Household funds" : "Finances"}</span><h3>Wealth</h3><p>{life.age < 18 ? "Your family manages these funds while you grow up." : "Your household’s cash, possessions and debts."}</p></div>
    <div className="wealth-net-worth"><span>ESTIMATED NET WORTH</span><strong className={summary.netWorth < 0 ? "wealth-negative" : ""}>{money(summary.netWorth)}</strong><p>Cash + possessions − debt</p></div>
    <dl className="wealth-breakdown"><div><dt>Available cash</dt><dd>{money(summary.cash)}</dd><p>Ready to spend</p></div><div><dt>Possessions</dt><dd>{money(summary.assetTotal)}</dd><p>Estimated sale value</p></div><div><dt>Debt</dt><dd className={summary.debt ? "wealth-negative" : ""}>{money(summary.debt)}</dd><p>Still owed</p></div></dl>
    <p className="wealth-muted">{world.economy.autoDebtRepayment ? "Each year, cash left after regular living costs automatically repays debt. Possessions are kept." : "Debt payments are manual in this life."}</p>
    <div className="wealth-budget"><h4>Yearly budget</h4><dl><div><dt>{summary.job ? `${summary.job.title} · income` : "Job income"}</dt><dd>{money(summary.jobCash)}</dd></div>{summary.assetIncome > 0 && <div><dt>Asset income</dt><dd>{money(summary.assetIncome)}</dd></div>}{summary.fixedYearlyCash > 0 && <div><dt>Other income</dt><dd>{money(summary.fixedYearlyCash)}</dd></div>}<div><dt>Living expenses · age {life.age}</dt><dd>{money(summary.currentCosts)}</dd></div></dl><p>Paid each year. Events and activities can change your balance.</p>{summary.conditionalCosts.some(cost => !cost.active) && <p className="wealth-future-cost">Additional yearly costs: {summary.conditionalCosts.filter(cost => !cost.active).map(cost => `${money(cost.amount)}${cost.fromAge !== undefined ? ` from age ${cost.fromAge}` : " when your household changes"}`).join("; ")}.</p>}</div>
    {summary.lessonPrices.length > 0 && <div className="wealth-price-guide"><h4>Training costs</h4><p>Lessons cost {summary.lessonPrices.map(money).join(" or ")}. At the lowest fee, your cash covers <strong>{summary.affordableLessons} {summary.affordableLessons === 1 ? "lesson" : "lessons"}</strong> before living expenses.</p><small>One activity per year. Age, skills and other requirements still apply.</small></div>}
    <div className="wealth-possessions"><h4>Possessions</h4>{summary.assets.length ? <ul>{summary.assets.map(asset => <li key={asset.id}><div><strong>{asset.title}{asset.quantity > 1 ? ` × ${asset.quantity}` : ""}</strong><p>{asset.description}</p>{(asset.yearlyIncome ?? 0) > 0 && <small>Annual income {money(asset.yearlyIncome! * asset.quantity)}</small>}</div><span>{money(asset.value * asset.quantity)}</span></li>)}</ul> : <p className="wealth-muted">No possessions recorded.</p>}</div>
    {finance.length > 0 && <div className="wealth-finance"><h4>Manage finances</h4><p className="wealth-muted">{hasFreePayments ? "Buying or selling uses your yearly activity. Debt payments do not." : "Money management uses your yearly activity."}</p><div className="wealth-actions">{finance.map(activity => {
      const reason = practiceBlockReason(activity, life);
      return <button className="wealth-action" type="button" key={activity.id} disabled={Boolean(reason)} onClick={() => onActivity(activity.id)}><span className="wealth-action-title">{activity.text}<span aria-hidden="true">↗</span></span><ChoiceImpact choice={activity} world={world} life={life} />{reason && <span className="wealth-action-reason">{reason}</span>}</button>;
    })}</div></div>}
    <p className="wealth-model-note">{world.economy.description}</p>
  </section>;
}
