import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import ChoiceImpact from "./ChoiceImpact.tsx";
import { practiceBlockReason } from "../models/skill-tree.ts";
import { formatMoney, getWealthSummary } from "../models/wealth.ts";
import { formatWealthPercentile, formatWealthStanding } from "../models/wealth-comparison.ts";
import MoneylenderPanel from "./MoneylenderPanel.tsx";
import { isLoanAction } from "../models/loan-summary.ts";
import { activityLoanOffer } from "../models/loan-access.ts";
import MarketPanel from "./MarketPanel.tsx";
import type { MarketActions } from "../types/market.ts";
import "../styles/wealth.css";

/** The same read-only view and accepted activities are used in game and draft preview. */
export default function WealthPanel({ life, world, activities, onActivity, onMarketOrder, onCancelMarketOrder }: {
  life: LifeState; world: WorldPack; activities: readonly ActivityAvailability[]; onActivity: (id: string) => void;
} & MarketActions) {
  const summary = getWealthSummary(world, life);
  if (!summary || !world.economy) return <p className="character-empty">This life uses its original Resources score.</p>;
  const money = (amount: number) => formatMoney(amount, world);
  const finance = activities.filter(activity => activity.category === "finance" && !isLoanAction(activity) && life.age >= (activity.minAge ?? 0));
  const hasFreePayments = finance.some(activity => activity.usesYearlyActivity === false);
  return <section className="wealth-panel" aria-label="Your household wealth">
    <div className="character-section-heading"><span>{life.age < 18 ? "Household funds" : "Finances"}</span><h3>Wealth</h3><p>{life.age < 18 ? "Your family manages these funds while you grow up." : "Your household’s cash, possessions and debts."}</p></div>
    <div className="wealth-overview">
      <div className="wealth-net-worth"><span>TOTAL WEALTH</span><strong className={summary.netWorth < 0 ? "wealth-negative" : ""}>{money(summary.netWorth)}</strong><p>Estimated net worth · Cash + possessions{summary.committedValue > 0 ? " + market orders" : ""} − debt</p></div>
      {summary.comparison && <div className="wealth-comparison"><span>ASSETS RANK AMONG HOUSEHOLDS</span><strong>{formatWealthStanding(summary.comparison.percentile)}</strong><p>Wealthier than {formatWealthPercentile(summary.comparison.percentile)} of {summary.benchmark.kind === "recorded-lives" ? "recorded lives" : "households"}.</p><div className="wealth-percentile-track" role="meter" aria-label="Society wealth percentile" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.comparison.percentile} aria-valuetext={`${formatWealthStanding(summary.comparison.percentile)} · Wealthier than ${formatWealthPercentile(summary.comparison.percentile)} of ${summary.benchmark.kind === "recorded-lives" ? "recorded lives" : "benchmark households"}`}><span style={{ width: `${summary.comparison.percentile}%` }} /></div><small>{summary.benchmark.kind === "recorded-lives" ? `Recorded-lives estimate (${summary.benchmark.sampleCount})` : "Game estimate"}</small></div>}
    </div>
    {summary.comparison && <div className="wealth-benchmark"><p>Median {summary.benchmark.kind === "recorded-lives" ? "recorded" : "household"} wealth <strong>{money(summary.comparison.medianWealth)}</strong><span>{summary.netWorth === summary.comparison.medianWealth ? "You are at the median." : `${money(Math.abs(summary.netWorth - summary.comparison.medianWealth))} ${summary.netWorth > summary.comparison.medianWealth ? "above" : "below"} the median.`}</span></p><small>{summary.benchmark.description} {summary.benchmark.kind === "recorded-lives" ? "Updates as lives progress and complete in this world revision." : "Weighted by background until enough recorded lives accumulate in this revision."} Equal wealth is not counted below yours.</small></div>}
    <dl className="wealth-breakdown"><div><dt>Available cash</dt><dd>{money(summary.cash)}</dd><p>Ready to spend</p></div><div><dt>Possessions</dt><dd>{money(summary.assetTotal)}</dd><p>Estimated sale value</p></div><div><dt>Debt</dt><dd className={summary.debt ? "wealth-negative" : ""}>{money(summary.debt)}</dd><p>{life.economy?.loan ? `Includes ${money(summary.normalDebt)} household debt` : "Still owed"}</p></div></dl>
    {summary.committedValue > 0 && <p className="wealth-summary-line">Committed to market orders: <strong>{money(summary.committedValue)}</strong>. Included in total wealth; unavailable to spend or sell until settlement or cancellation.</p>}
    <p className="wealth-muted">{world.economy.autoDebtRepayment ? world.economy.moneylender ? "Each year, spare cash repays ordinary household debt. Moneylender loans have their own payment controls below." : "Each year, cash left after regular living costs automatically repays debt. Possessions are kept." : "Debt payments are manual in this life."}</p>
    <MoneylenderPanel life={life} world={world} activities={activities} onActivity={onActivity} />
    <MarketPanel life={life} world={world} onMarketOrder={onMarketOrder} onCancelMarketOrder={onCancelMarketOrder} />
    <div className="wealth-budget"><h4>Yearly budget</h4><dl><div><dt>{summary.job ? `${summary.job.title} · income` : "Job income"}</dt><dd>{money(summary.jobCash)}</dd></div>{summary.assetIncome > 0 && <div><dt>Asset income</dt><dd>{money(summary.assetIncome)}</dd></div>}{summary.fixedYearlyCash > 0 && <div><dt>Other income</dt><dd>{money(summary.fixedYearlyCash)}</dd></div>}<div><dt>Living expenses · age {life.age}</dt><dd>{money(summary.currentCosts)}</dd></div></dl><p>{summary.trading ? "Trading puts paid work aside this year. Income comes from your settled sales." : summary.job?.production ? "This work earns through selling finished goods. Materials limit production; sale receipts arrive when contracts settle." : "Paid each year. Events and activities can change your balance."}</p>{summary.conditionalCosts.some(cost => !cost.active) && <p className="wealth-future-cost">Additional yearly costs: {summary.conditionalCosts.filter(cost => !cost.active).map(cost => `${money(cost.amount)}${cost.fromAge !== undefined ? ` from age ${cost.fromAge}` : " when your household changes"}`).join("; ")}.</p>}</div>
    {summary.lessonPrices.length > 0 && <div className="wealth-price-guide"><h4>Training costs</h4><p>Lessons cost {summary.lessonPrices.map(money).join(" or ")}. At the lowest fee, your cash covers <strong>{summary.affordableLessons} {summary.affordableLessons === 1 ? "lesson" : "lessons"}</strong> before living expenses.</p><small>One activity per year. Age, skills and other requirements still apply.</small></div>}
    <div className="wealth-possessions"><h4>Possessions</h4>{summary.assets.length ? <ul>{summary.assets.map(asset => <li key={asset.id}><div><strong>{asset.title}{asset.quantity > 1 ? ` × ${asset.quantity}` : ""}</strong><p>{asset.description}</p>{(asset.yearlyIncome ?? 0) > 0 && <small>Annual income {money(asset.yearlyIncome! * asset.quantity)}</small>}</div><span>{money(asset.value * asset.quantity)}</span></li>)}</ul> : <p className="wealth-muted">No possessions recorded.</p>}</div>
    {finance.length > 0 && <div className="wealth-finance"><h4>Manage finances</h4><p className="wealth-muted">{world.economy.market ? "Market orders and debt payments do not use your yearly activity." : hasFreePayments ? "Buying or selling uses your yearly activity. Debt payments do not." : "Money management uses your yearly activity."}</p><div className="wealth-actions">{finance.map(activity => {
      const reason = practiceBlockReason(activity, life);
      const loanOffer = reason && activityLoanOffer(world, life, activity);
      return <button className="wealth-action" type="button" key={activity.id} disabled={Boolean(reason) && !loanOffer} onClick={() => onActivity(activity.id)}><span className="wealth-action-title">{activity.text}<span aria-hidden="true">↗</span></span><ChoiceImpact choice={activity} world={world} life={life} />{reason && <span className="wealth-action-reason">{reason}</span>}{loanOffer && <span className="loan-funding-hint">Ask moneylender to fund this · View terms</span>}</button>;
    })}</div></div>}
    <p className="wealth-model-note">{world.economy.description}</p>
  </section>;
}
