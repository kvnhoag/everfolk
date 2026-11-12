import { useId, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { marketOrderCapacity, marketOrderReason, marketQuote, productionPlan } from "../../src/market.ts";
import { formatMoney } from "../models/wealth.ts";
import { getMarketCatalogue, productionWithDeliveries } from "../models/market.ts";
import type { MarketActions } from "../types/market.ts";
import "../styles/market.css";

/** Orders remain in the engine ledger until a year is completed or cancelled. */
export default function MarketPanel({ life, world, onMarketOrder, onCancelMarketOrder }: {
  life: LifeState; world: WorldPack;
} & MarketActions) {
  const formId = useId();
  const market = world.economy?.market;
  const ledger = life.economy?.market;
  const [selectedAsset, setSelectedAsset] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantityText, setQuantityText] = useState("1");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  if (!market || !ledger || !life.economy) return null;
  const money = (amount: number) => formatMoney(amount, world);
  const catalogue = getMarketCatalogue(world, life, { query, category });
  const canBrowseAll = catalogue.canBrowseAll;
  const goods = catalogue.goods;
  const asset = goods.find(good => good.id === selectedAsset) ?? goods[0];
  const quote = asset ? marketQuote(world, life, asset.id) : undefined;
  const quantity = Number(quantityText);
  const unitPrice = quote ? side === "buy" ? quote.buy : quote.sell : 0;
  const total = quantity * unitPrice;
  const capacity = marketOrderCapacity(world, life);
  const quantityLimit = Math.max(0, Math.min(capacity.perOrder, capacity.remaining ?? capacity.perOrder));
  const phaseReason = life.phase === "ended" ? "This life has ended."
    : life.phase === "choice" ? "Resolve your pending decision before changing orders."
    : life.age < market.minAge ? `Market orders become available at age ${market.minAge}.` : undefined;
  const orderReason = asset ? marketOrderReason(world, life, { side, asset: asset.id, quantity }) : "Choose goods to arrange a contract.";
  const signals = [...new Map(goods.flatMap(good => marketQuote(world, life, good.id).signals.map(signal => [signal.eventId, signal] as const))).values()];
  const job = world.character?.jobs.find(job => job.id === life.character?.jobId);
  const plan = job?.production ? productionPlan(world, life, job) : undefined;
  const nextPlan = job?.production ? productionWithDeliveries(world, life, job) : undefined;
  const title = (id: string) => world.economy!.assets.find(asset => asset.id === id)?.title ?? id;
  const materials = (amounts: Record<string, number>) => Object.entries(amounts).map(([id, amount]) => `${amount} ${title(id).toLowerCase()}`).join(", ");
  const trader = world.character?.jobs.find(job => job.id === market.traderJob);
  return <section className="market-panel" aria-labelledby={`${formId}-heading`}>
    <div className="market-heading"><div><span>ORDERS FOR THE COMING YEAR</span><h4 id={`${formId}-heading`}>The market</h4></div><span>Age {life.age} → {life.age + 1}</span></div>
    <p>Agree quantities now. Prices are fixed when you place an order; deliveries and sale receipts arrive when you complete the year. Buying reserves cash and selling reserves goods. You can cancel before settlement.</p>
    <div className="market-capacity" id={`${formId}-limits`} aria-label="Market order limits">
      <strong>{capacity.professional ? "Purchasing role limits" : "Household order limits"}</strong>
      <p>Up to {capacity.perOrder.toLocaleString("en-GB")} units per order{capacity.perYear === undefined ? "." : ` and ${capacity.perYear.toLocaleString("en-GB")} units in total each year.`}</p>
      {capacity.perYear !== undefined && <><p><strong>{capacity.committed.toLocaleString("en-GB")} / {capacity.perYear.toLocaleString("en-GB")} units committed</strong> · {capacity.remaining!.toLocaleString("en-GB")} units remaining.</p><small>Purchases and sales share this yearly allowance. Cancelling an order releases capacity; completing the year starts a new allowance.</small>{quantityLimit === 0 && <p className="market-capacity-full">No capacity remains for new orders. Cancel an order or complete the year to make room. Existing orders can still settle.</p>}</>}
    </div>
    <div className="market-catalogue-heading"><div><strong>{canBrowseAll ? "All market goods" : "Useful to you now"}</strong><p>{canBrowseAll ? `Your work as ${job?.title.toLowerCase() ?? "a trader"} gives you access to the full market.` : "Supplies for your current work and household, plus goods you hold or have ordered."}</p></div></div>
    {canBrowseAll && <div className="market-catalogue-filters"><label htmlFor={`${formId}-search`}>Search goods<input id={`${formId}-search`} type="search" placeholder="Name or use" value={query} onChange={event => setQuery(event.target.value)} /></label>{catalogue.categories.length > 0 && <label htmlFor={`${formId}-category`}>Category<select id={`${formId}-category`} value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{catalogue.categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}</div>}
    {canBrowseAll && <p className="market-catalogue-count" role="status" aria-live="polite">{goods.length} of {catalogue.all.length} goods shown.</p>}
    {signals.length > 0 && <div className="market-signals"><strong>Market news for these goods</strong><ul>{signals.map(signal => <li key={signal.eventId}>{signal.title}</li>)}</ul><small>Quotes follow events that have happened in your life.</small></div>}
    <div className="market-table-scroll" id={`${formId}-catalogue`}>{goods.length ? <table><caption>Current quotes per unit and uncommitted stock · market fees included</caption><thead><tr><th scope="col">Goods</th><th scope="col">Held</th><th scope="col">Buy</th><th scope="col">Sell</th></tr></thead><tbody>{goods.map(good => {
      const prices = marketQuote(world, life, good.id);
      const reasons = catalogue.relevance.get(good.id);
      return <tr key={good.id}><th scope="row">{good.title}<small className="market-resource-context">{reasons?.length ? reasons.slice(0, 2).join(" · ") : good.category ?? "Available to trade"}</small>{prices.signals.length > 0 && <small>{prices.signals.map(signal => `${signal.title}: ×${signal.multiplier}`).join(" · ")}</small>}</th><td>{(life.economy!.assets[good.id] ?? 0).toLocaleString("en-GB")}</td><td>{money(prices.buy)}</td><td>{money(prices.sell)}</td></tr>;
    })}</tbody></table> : <p className="market-catalogue-empty">{canBrowseAll ? "No goods match these filters. Try another search or category." : "No market supplies are needed for your current situation."}</p>}</div>
    {asset && <form className="market-order-form" onSubmit={event => { event.preventDefault(); if (!orderReason && onMarketOrder) onMarketOrder({ side, asset: asset.id, quantity }); }}>
      <label htmlFor={`${formId}-good`}>Goods<select id={`${formId}-good`} value={asset.id} onChange={event => setSelectedAsset(event.target.value)}>{goods.map(good => <option key={good.id} value={good.id}>{good.title}</option>)}</select></label>
      <label htmlFor={`${formId}-side`}>Order<select id={`${formId}-side`} value={side} onChange={event => setSide(event.target.value as "buy" | "sell")}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
      <label htmlFor={`${formId}-quantity`}>Quantity<input id={`${formId}-quantity`} type="number" inputMode="numeric" min="1" max={quantityLimit} step="1" disabled={quantityLimit === 0} aria-describedby={`${formId}-limits ${formId}-order-note`} value={quantityText} onChange={event => setQuantityText(event.target.value)} /></label>
      <p className="market-order-total">{side === "buy" ? "Cash reserved now" : "Receipt at year end"}<strong>{Number.isSafeInteger(total) && quantity > 0 ? money(total) : "—"}</strong></p>
      <button type="submit" disabled={Boolean(orderReason) || !onMarketOrder}>Place {side} order</button>
      <p className="market-order-note" id={`${formId}-order-note`} aria-live="polite">{orderReason ?? "Orders do not use your yearly activity."}</p>
    </form>}
    <div className="market-pending"><h5>Pending orders <span>{ledger.orders.length}/{market.maxOrders}</span></h5>{ledger.orders.length ? <ul>{ledger.orders.map(order => <li key={order.id}><div><strong>{order.side === "buy" ? "Buy" : "Sell"} {order.quantity.toLocaleString("en-GB")} {title(order.asset).toLowerCase()}</strong><span>{money(order.unitPrice)} each · {money(order.total)} total · settles at age {order.settlesAtAge}</span></div><button type="button" disabled={Boolean(phaseReason) || !onCancelMarketOrder} aria-label={`Cancel ${order.side} order for ${order.quantity} ${title(order.asset).toLowerCase()}`} onClick={() => onCancelMarketOrder?.(order.id)}>Cancel</button></li>)}</ul> : <p>No outstanding orders.</p>}</div>
    {ledger.lastSettlement && <p className="market-settlement">Last settlement, age {ledger.lastSettlement.age}: {ledger.lastSettlement.bought} units delivered, {ledger.lastSettlement.sold} sold; {money(ledger.lastSettlement.revenue)} received from sales.</p>}
    {job?.production && plan && nextPlan && <div className="market-production"><h5>{job.title} · yearly production</h5><p>Capacity: up to <strong>{plan.capacity} batches</strong> per year. Each batch uses {materials(job.production.inputs)} and makes {materials(job.production.outputs)}.</p><p>From stock now: {plan.batches} batches. At next settlement, including pending deliveries: <strong>{nextPlan.batches} batches</strong>{nextPlan.batches > 0 && ` → ${materials(nextPlan.outputs)}`}. Buy materials to use more of your capacity, then sell finished goods through market orders.</p><small>Deliveries arrive before production. Finished goods become available to order for sale in the following year. A Trading focus puts this work aside.</small></div>}
    <p className="market-trader-progress"><strong>{trader?.title ?? "Trader"}</strong>{life.character?.jobId === market.traderJob ? " · Your current occupation. Earnings come from selling goods." : ` · ${ledger.tradingYears}/${market.traderYears} qualifying trading years.`} Focus on Trading and complete sales to build a trading livelihood. No automatic trading orders are placed for you.</p>
  </section>;
}
