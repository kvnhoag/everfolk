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
  const finance = activities.filter(activity => activity.category === "finance");
  return <section className="wealth-panel" aria-label="Your household wealth">
    <div className="character-section-heading"><span>{life.age < 18 ? "Your household’s money" : "Money and possessions"}</span><h3>Your wealth</h3><p>{life.age < 18 ? "These are your household’s funds and possessions. Adults manage them while you grow up." : "See what you can spend, what you own and what you owe. Amounts cover the household you manage."}</p></div>
    <div className="wealth-net-worth"><span>ESTIMATED NET WORTH</span><strong className={summary.netWorth < 0 ? "wealth-negative" : ""}>{money(summary.netWorth)}</strong><p>Cash + possessions − debt</p></div>
    <dl className="wealth-breakdown"><div><dt>Available cash</dt><dd>{money(summary.cash)}</dd><p>Ready to spend</p></div><div><dt>Possessions</dt><dd>{money(summary.assetTotal)}</dd><p>Estimated sale value</p></div><div><dt>Debt</dt><dd className={summary.debt ? "wealth-negative" : ""}>{money(summary.debt)}</dd><p>Still owed</p></div></dl>
    <div className="wealth-budget"><h4>A year’s money</h4><dl><div><dt>{summary.job ? `${summary.job.title} · regular work` : "No regular occupation"}</dt><dd>{money(summary.jobCash)}</dd></div>{summary.assetIncome > 0 && <div><dt>Income from possessions</dt><dd>{money(summary.assetIncome)}</dd></div>}{summary.fixedYearlyCash > 0 && <div><dt>Other regular cash</dt><dd>{money(summary.fixedYearlyCash)}</dd></div>}<div><dt>Living costs at age {life.age}</dt><dd>{money(summary.currentCosts)}</dd></div></dl><p>Applied once for each year you survive. Events, work changes and personal choices can add other costs or income.</p>{summary.conditionalCosts.some(cost => !cost.active) && <p className="wealth-future-cost">Later costs: {summary.conditionalCosts.filter(cost => !cost.active).map(cost => `${money(cost.amount)}${cost.fromAge !== undefined ? ` a year from age ${cost.fromAge}` : " when household conditions change"}`).join("; ")}.</p>}</div>
    {summary.lessonPrices.length > 0 && <div className="wealth-price-guide"><h4>What your cash can cover</h4><p>A paid practice costs {summary.lessonPrices.map(money).join(" or ")}. Your cash covers <strong>{summary.affordableLessons} {summary.affordableLessons === 1 ? "practice" : "practices"}</strong> at the lowest price, before living costs.</p><small>You still have one personal activity each year. Skill, age and other requirements apply.</small></div>}
    <div className="wealth-possessions"><h4>What you own</h4>{summary.assets.length ? <ul>{summary.assets.map(asset => <li key={asset.id}><div><strong>{asset.title}{asset.quantity > 1 ? ` × ${asset.quantity}` : ""}</strong><p>{asset.description}</p>{(asset.yearlyIncome ?? 0) > 0 && <small>Annual income {money(asset.yearlyIncome! * asset.quantity)}</small>}</div><span>{money(asset.value * asset.quantity)}</span></li>)}</ul> : <p className="wealth-muted">No separately valued possessions are recorded yet.</p>}</div>
    {finance.length > 0 && <div className="wealth-finance"><h4>Manage money and possessions</h4><p className="wealth-muted">Buying, selling or repaying debt uses your personal activity for the year.</p><div className="wealth-actions">{finance.map(activity => {
      const reason = practiceBlockReason(activity, life);
      return <button className="wealth-action" type="button" key={activity.id} disabled={Boolean(reason)} onClick={() => onActivity(activity.id)}><span className="wealth-action-title">{activity.text}<span aria-hidden="true">↗</span></span><ChoiceImpact choice={activity} world={world} life={life} />{reason && <span className="wealth-action-reason">{reason}</span>}</button>;
    })}</div></div>}
    <p className="wealth-model-note">{world.economy.description}</p>
  </section>;
}
