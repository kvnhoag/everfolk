import { useEffect, useId, useRef, useState } from "react";
import { activityPartnerIds } from "../../src/character.ts";
import type { TradeCommand, TradeItem } from "../../src/demo/types.ts";
import { TRADE_ITEMS } from "../../src/demo/types.ts";
import { resolvePartner } from "../../src/people.ts";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import ChoiceImpact from "../ChoiceImpact.tsx";
import { visibleFamilyActivities } from "../character-panel-model.ts";
import { displayProse } from "../display-prose.ts";
import { getLoanSummary } from "../loan-summary.ts";
import PixelPortrait from "../PixelPortrait.tsx";
import { relationshipLabels, visibleRelationshipPeople } from "../relationship-labels.ts";
import { beginOrder, releaseOrder } from "./screen.ts";
import type { DemoScreen } from "./screen.ts";
import { itemLabel, levelLabel } from "./labels.ts";
import PriceChart, { AssetSparkline } from "./PriceChart.tsx";
import { ResourceGlyph } from "./ResourceBar.tsx";
import "./economy-panels.css";

export interface ComparisonSide {
  label: string;
  grainReceived: number;
  hungerAvoided: boolean;
  sourceName: string | null;
  ownerShare: string | null;
}

export type EconomyTabId = "market" | "farm" | "service" | "people" | "works";

interface Props {
  screen: DemoScreen;
  cashText: string;
  autoPlay: boolean;
  pending?: boolean;
  comparison?: { withDeed: ComparisonSide; withoutDeed: ComparisonSide } | null;
  scenario?: { title: string; seed: string; summary: string } | null;
  externalTradeItem?: { item: TradeItem; seq: number } | null;
  externalTab?: { tab: EconomyTabId; seq: number } | null;
  life?: LifeState;
  world?: WorldPack;
  activities?: readonly ActivityAvailability[];
  onTrade(order: TradeCommand): string | null;
  onPlan(flaxPlots: number): string | null;
  onAutoPlay(on: boolean): void;
  onDelegate(agent: string | null): string | null;
  onOccupation?(id: string): void;
  onActivity?(id: string): void;
  onOpenCharacterSection?(section: "career" | "wealth" | "children" | "skills"): void;
  training?: { id: string; label: string; reason: string | null }[];
  occupations?: { id: string; label: string; unavailable: boolean; reason: string | null }[];
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function heldQuantity(screen: DemoScreen, item: TradeItem): number {
  if (screen.holdings) return screen.holdings[item] ?? 0;
  if (item === "grain") return screen.household.grain;
  if (item === "flax") return screen.household.flax;
  if (item === "linen") return screen.household.linen;
  if (item === "ox") return screen.household.animals.ox;
  if (item === "donkey") return screen.household.animals.donkey;
  return 0;
}

export default function EconomyPanels({
  screen,
  cashText,
  autoPlay,
  pending = false,
  comparison = null,
  scenario = null,
  externalTradeItem = null,
  externalTab = null,
  life,
  world,
  activities = [],
  onTrade,
  onPlan,
  onAutoPlay,
  onDelegate,
  onOccupation,
  onActivity,
  onOpenCharacterSection,
  training = [],
  occupations = [],
}: Props) {
  const titleId = useId();
  const slot = useRef(false);
  const [activeTab, setActiveTab] = useState<EconomyTabId>("market");
  const [item, setItem] = useState<TradeItem>("grain");
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [quantity, setQuantity] = useState(1);
  const [counterparty, setCounterparty] = useState<"merchant" | "army">("merchant");
  const [notice, setNotice] = useState("");
  const [flaxPlots, setFlaxPlots] = useState(screen.household.flaxPlots);
  const [agentName, setAgentName] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<"all" | "friends" | "business" | "romance" | "family">("all");
  const [openDropdown, setOpenDropdown] = useState<"good" | "side" | "with" | null>(null);

  const quote = screen.market.quotes.find(entry => entry.item === item);
  const order: TradeCommand = { type: "trade", item, side, quantity, counterparty };
  const held = heldQuantity(screen, item);
  const unitPrice =
    counterparty === "army" && item === "grain"
      ? screen.market.armyGrainPrice
      : side === "buy"
        ? (quote?.sell ?? 1)
        : (quote?.buy ?? 1);
  const orderTotal = quantity * unitPrice;

  useEffect(() => {
    slot.current = false;
  }, [screen.market.visitUsed, pending]);

  useEffect(() => {
    if (!externalTradeItem) return;
    setItem(externalTradeItem.item);
    setActiveTab("market");
  }, [externalTradeItem?.seq]);

  useEffect(() => {
    if (!externalTab) return;
    setActiveTab(externalTab.tab);
  }, [externalTab?.seq]);

  const knownPeople = life && world ? visibleRelationshipPeople(world, life).filter(p => life.age + p.ageOffset >= 18) : [];
  const children = life?.character?.children ?? [];
  const loanSummary = life && world ? getLoanSummary(world, life) : null;
  const canActThisYear = life?.phase === "ready" && life.character?.lastActivityAge !== life.age;
  const offerFigure = screen.activeOffer
    ? screen.townFigures?.find(fig => fig.role === screen.activeOffer?.role)
    : undefined;

  function confirmTrade() {
    if (screen.market.visitUsed || pending) return;
    if (!beginOrder(slot)) return;
    const reason = onTrade(order);
    if (reason) {
      releaseOrder(slot);
      setNotice(reason);
    } else {
      setNotice("");
    }
  }

  function setMaxQuantity() {
    if (side === "sell") {
      const cap = counterparty === "army" ? held : Math.min(held, quote?.merchantCanBuy ?? held);
      setQuantity(Math.max(1, Math.min(500, cap)));
    } else {
      const stock = quote?.merchantStock ?? 1;
      setQuantity(Math.max(1, Math.min(500, stock)));
    }
  }

  const history = screen.priceHistory ?? [];
  const basePrices = screen.basePrices;

  return (
    <div className="demo-economy" aria-labelledby={titleId}>
      <header className="demo-deck-header">
        <div>
          <span className="demo-deck-eyebrow">HOUSEHOLD &amp; TOWN COMMAND DECK</span>
          <h2 id={titleId} className="demo-economy-title">This year in the fields</h2>
        </div>
        <div className="demo-deck-tabs" role="tablist" aria-label="Economy command deck">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "market"}
            className={`demo-deck-tab${activeTab === "market" ? " is-active" : ""}`}
            onClick={() => setActiveTab("market")}
          >
            Market &amp; Trade
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "farm"}
            className={`demo-deck-tab${activeTab === "farm" ? " is-active" : ""}`}
            onClick={() => setActiveTab("farm")}
          >
            Farm &amp; Granary
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "service"}
            className={`demo-deck-tab${activeTab === "service" ? " is-active" : ""}`}
            onClick={() => setActiveTab("service")}
          >
            Career &amp; Army
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "people"}
            className={`demo-deck-tab${activeTab === "people" ? " is-active" : ""}`}
            onClick={() => setActiveTab("people")}
          >
            People &amp; Town
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "works"}
            className={`demo-deck-tab${activeTab === "works" ? " is-active" : ""}`}
            onClick={() => setActiveTab("works")}
          >
            Works &amp; Stewards
          </button>
        </div>
      </header>

      {/* ACTIVE CHARACTERIZED TOWN OFFER CARD */}
      {screen.activeOffer && (
        <aside className="demo-town-offer-card" aria-label="Town counterparty offer">
          {offerFigure && (
            <PixelPortrait
              age={offerFigure.age}
              name={offerFigure.name}
              sex={offerFigure.sex}
              originId={offerFigure.originId}
              avatarVariant={offerFigure.avatarVariant}
              seed={`town:${offerFigure.role}`}
              className="demo-town-figure-avatar"
            />
          )}
          <div className="demo-town-offer-body">
            <span className="demo-deck-eyebrow">
              OPEN CONTRACT OFFER · {(offerFigure?.title ?? screen.activeOffer.role).toUpperCase()}
              {screen.activeOffer.agent ? ` (AGENT ${screen.activeOffer.agent})` : " (FIXED RULES)"}
            </span>
            <strong>
              {offerFigure?.name ?? screen.activeOffer.role} proposes a {screen.activeOffer.kind.replace("-", " ")}
            </strong>
            <p>
              {screen.activeOffer.quantity} {itemLabel(screen.activeOffer.item).toLowerCase()} at{" "}
              <strong>{screen.activeOffer.price} drachmas</strong> each (total{" "}
              <strong>{screen.activeOffer.total} drachmas</strong>).
            </p>
          </div>
          <button
            type="button"
            className="demo-offer-inspect-btn"
            onClick={() => setActiveTab("people")}
          >
            View Counterparty →
          </button>
        </aside>
      )}

      {screen.legacyHelp?.map(help => (
        <aside className="demo-legacy-arrival demo-legacy-figure-card" key={`${help.tokenId}:${help.age}`} aria-label="Granary from a past life">
          <PixelPortrait
            age={56}
            name={`Life NFT #${help.tokenId}`}
            sex="male"
            originId="artisan-household"
            avatarVariant={1}
            seed={`legacy:${help.tokenId}`}
            className="demo-town-figure-avatar"
          />
          <div className="demo-legacy-figure-copy">
            <strong>A past life kept a granary for you</strong>
            <p>{help.text}</p>
            <a href={`#token/${help.tokenId}`}>Meet the farmer · Life NFT #{help.tokenId}</a>
            <small>Arrived at age {help.age}. Recorded in your life history.</small>
          </div>
        </aside>
      ))}

      {(scenario || comparison) && (
        <section aria-label="Demo scenario">
          <h3>Demo scenario</h3>
          {scenario ? (
            <p>
              <strong>{scenario.title}</strong> · seed {scenario.seed}. {scenario.summary}
            </p>
          ) : !comparison ? (
            <p>The prepared demo scenario is not loaded yet.</p>
          ) : null}
          {comparison ? (
            <div className="demo-compare">
              <article>
                <h4>{comparison.withDeed.label}</h4>
                <p>
                  Grain received {comparison.withDeed.grainReceived}. Hunger avoided:{" "}
                  {comparison.withDeed.hungerAvoided ? "yes" : "no"}.
                </p>
                <p>
                  Source: {comparison.withDeed.sourceName ?? "none"}. Owner share:{" "}
                  {comparison.withDeed.ownerShare ?? "none"}.
                </p>
              </article>
              <article>
                <h4>{comparison.withoutDeed.label}</h4>
                <p>
                  Grain received {comparison.withoutDeed.grainReceived}. Hunger avoided:{" "}
                  {comparison.withoutDeed.hungerAvoided ? "yes" : "no"}.
                </p>
                <p>
                  Source: {comparison.withoutDeed.sourceName ?? "none"}. Owner share:{" "}
                  {comparison.withoutDeed.ownerShare ?? "none"}.
                </p>
              </article>
            </div>
          ) : (
            <p>After a flood, the same life with and without an earlier farmer&apos;s deed will be compared here.</p>
          )}
        </section>
      )}

      {/* TAB 1: MARKET & TRADE + ASSET PRICE GRAPHS */}
      <section aria-label="Grain market" hidden={activeTab !== "market"}>
        <div className="demo-market-top">
          <div>
            <h3>Grain market</h3>
            <p className="demo-market-sub">One visit this year. This is not the NFT Market.</p>
          </div>
          <span className={`demo-visit-badge${screen.market.visitUsed ? " is-used" : ""}`}>
            {screen.market.visitUsed ? "Market visit used this year" : "1 market visit available"}
          </span>
        </div>

        {screen.market.visitUsed && <p>You have already visited the market this year.</p>}
        {screen.market.reasons.map(reason => (
          <p key={reason} className="demo-market-reason">{reason}</p>
        ))}

        <PriceChart
          item={item}
          onSelectItem={setItem}
          history={history}
          basePrices={basePrices}
          currentBuy={quote?.buy ?? 1}
          currentSell={quote?.sell ?? 1}
          armyGrainPrice={screen.market.armyGrainPrice}
        />

        <div className="demo-commodity-table-wrap">
          <table className="demo-commodity-table" aria-label="Commodity prices and holdings">
            <thead>
              <tr>
                <th>Commodity</th>
                <th>You Hold</th>
                <th>Merchant Pays (Sell)</th>
                <th>Merchant Asks (Buy)</th>
                <th>Merchant Stock</th>
                <th>Trend</th>
                <th>Quick Action</th>
              </tr>
            </thead>
            <tbody>
              {screen.market.quotes.map(entry => {
                const isSelected = entry.item === item;
                const playerHeld = heldQuantity(screen, entry.item);
                const base = basePrices?.[entry.item] ?? entry.sell;
                return (
                  <tr
                    key={entry.item}
                    className={isSelected ? "is-selected" : undefined}
                    onClick={() => setItem(entry.item)}
                  >
                    <td>
                      <span className="demo-commodity-cell">
                        <ResourceGlyph id={entry.item} />
                        <strong>{itemLabel(entry.item)}</strong>
                      </span>
                    </td>
                    <td className="num">{playerHeld}</td>
                    <td className="num">{entry.buy} dr</td>
                    <td className="num">{entry.sell} dr</td>
                    <td className="num">{entry.merchantStock}</td>
                    <td>
                      <AssetSparkline item={entry.item} history={history} basePrice={base} currentSell={entry.sell} />
                    </td>
                    <td>
                      <div className="demo-row-btns">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setItem(entry.item);
                            setSide("sell");
                            setCounterparty("merchant");
                          }}
                        >
                          Sell
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setItem(entry.item);
                            setSide("buy");
                            setCounterparty("merchant");
                          }}
                        >
                          Buy
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <dl className="demo-facts demo-market-summary-facts">
          {screen.market.quotes
            .filter(entry => entry.item === "grain" || entry.item === item)
            .map(entry => (
              <Field key={entry.item} label={itemLabel(entry.item) + " buy / sell"} value={entry.buy + " / " + entry.sell} />
            ))}
          <Field label="Merchant can buy" value={String(quote?.merchantCanBuy ?? 0)} />
          <Field label="Merchant holds" value={String(quote?.merchantStock ?? 0)} />
          <Field label="Army grain price" value={String(screen.market.armyGrainPrice)} />
          <Field label="Army contract" value={screen.market.armyOpen ? "Open" : "Not offered"} />
        </dl>

        <div className="demo-trade-ticket">
          <div className="demo-actions">
            {/* Styled Asset (Good) Dropdown with Icons & Text */}
            <div className="demo-dropdown-field">
              <span className="demo-dropdown-label">Good</span>
              <div className="demo-dropdown-wrap">
                <button
                  type="button"
                  className={`demo-dropdown-trigger${openDropdown === "good" ? " is-open" : ""}`}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === "good"}
                  onClick={() => setOpenDropdown(prev => (prev === "good" ? null : "good"))}
                >
                  <ResourceGlyph id={item} />
                  <span className="demo-dropdown-trigger-text">
                    <strong>{itemLabel(item)}</strong>
                    <small>Held: {held}</small>
                  </span>
                  <span className="demo-dropdown-caret" aria-hidden="true">▾</span>
                </button>
                {openDropdown === "good" && (
                  <ul className="demo-dropdown-menu" role="listbox" aria-label="Choose asset to trade">
                    {TRADE_ITEMS.map(id => {
                      const q = screen.market.quotes.find(entry => entry.item === id);
                      const h = heldQuantity(screen, id);
                      return (
                        <li key={id} role="option" aria-selected={item === id}>
                          <button
                            type="button"
                            className={`demo-dropdown-option${item === id ? " is-selected" : ""}`}
                            onClick={() => {
                              setItem(id);
                              setOpenDropdown(null);
                            }}
                          >
                            <ResourceGlyph id={id} />
                            <span className="demo-dropdown-opt-main">
                              <strong>{itemLabel(id)}</strong>
                              <small>Held: {h}</small>
                            </span>
                            <span className="demo-dropdown-opt-meta">
                              {q?.buy ?? 1} / {q?.sell ?? 1} dr
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Styled Side (Sell / Buy) Dropdown */}
            <div className="demo-dropdown-field">
              <span className="demo-dropdown-label">Side</span>
              <div className="demo-dropdown-wrap">
                <button
                  type="button"
                  className={`demo-dropdown-trigger${openDropdown === "side" ? " is-open" : ""}`}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === "side"}
                  onClick={() => setOpenDropdown(prev => (prev === "side" ? null : "side"))}
                >
                  <ResourceGlyph id="cash" />
                  <span className="demo-dropdown-trigger-text">
                    <strong>{side === "sell" ? "Sell" : "Buy"}</strong>
                    <small>{unitPrice} dr each</small>
                  </span>
                  <span className="demo-dropdown-caret" aria-hidden="true">▾</span>
                </button>
                {openDropdown === "side" && (
                  <ul className="demo-dropdown-menu" role="listbox" aria-label="Choose trade side">
                    {(["sell", "buy"] as const).map(s => {
                      const p =
                        counterparty === "army" && item === "grain"
                          ? screen.market.armyGrainPrice
                          : s === "buy"
                            ? (quote?.sell ?? 1)
                            : (quote?.buy ?? 1);
                      return (
                        <li key={s} role="option" aria-selected={side === s}>
                          <button
                            type="button"
                            className={`demo-dropdown-option${side === s ? " is-selected" : ""}`}
                            onClick={() => {
                              setSide(s);
                              setOpenDropdown(null);
                            }}
                          >
                            <ResourceGlyph id="cash" />
                            <span className="demo-dropdown-opt-main">
                              <strong>{s === "sell" ? "Sell to counterparty" : "Buy from counterparty"}</strong>
                              <small>{s === "sell" ? `You hold ${held}` : `Merchant stock ${quote?.merchantStock ?? 0}`}</small>
                            </span>
                            <span className="demo-dropdown-opt-meta">{p} dr</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Styled Counterparty (Merchant / Army) Dropdown */}
            <div className="demo-dropdown-field">
              <span className="demo-dropdown-label">With</span>
              <div className="demo-dropdown-wrap">
                <button
                  type="button"
                  className={`demo-dropdown-trigger${openDropdown === "with" ? " is-open" : ""}`}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === "with"}
                  onClick={() => setOpenDropdown(prev => (prev === "with" ? null : "with"))}
                >
                  <ResourceGlyph id={counterparty} />
                  <span className="demo-dropdown-trigger-text">
                    <strong>{counterparty === "merchant" ? "Merchant" : "Army"}</strong>
                    <small>{counterparty === "merchant" ? "Harbor market" : "Levy contract"}</small>
                  </span>
                  <span className="demo-dropdown-caret" aria-hidden="true">▾</span>
                </button>
                {openDropdown === "with" && (
                  <ul className="demo-dropdown-menu" role="listbox" aria-label="Choose counterparty">
                    {(
                      [
                        ["merchant", "Merchant", "Harbor market"],
                        ["army", "Army", `Grain levy (${screen.market.armyOpen ? "Open" : "Closed"})`],
                      ] as const
                    ).map(([cp, label, sub]) => (
                      <li key={cp} role="option" aria-selected={counterparty === cp}>
                        <button
                          type="button"
                          className={`demo-dropdown-option${counterparty === cp ? " is-selected" : ""}`}
                          onClick={() => {
                            setCounterparty(cp);
                            setOpenDropdown(null);
                          }}
                        >
                          <ResourceGlyph id={cp} />
                          <span className="demo-dropdown-opt-main">
                            <strong>{label}</strong>
                            <small>{sub}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <label>
              Quantity
              <input
                inputMode="numeric"
                min={1}
                type="number"
                value={quantity}
                onChange={event => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <button
              type="button"
              className="demo-trade-submit"
              disabled={screen.market.visitUsed || pending || slot.current}
              onClick={confirmTrade}
            >
              Preview and confirm ({orderTotal} dr)
            </button>
          </div>

          <div className="demo-batch-row">
            <span>Quick quantity:</span>
            {[1, 10, 50, 100].map( presetQty => (
              <button key={presetQty} type="button" onClick={() => setQuantity(presetQty)}>
                {presetQty}
              </button>
            ))}
            <button type="button" onClick={setMaxQuantity}>
              Max ({side === "sell" ? held : (quote?.merchantStock ?? 0)})
            </button>
            <span className="demo-ticket-cash">Your cash: <strong>{cashText}</strong></span>
          </div>
        </div>

        {notice && <p className="demo-trade-notice" role="status">{notice}</p>}
      </section>

      {/* TAB 2: FARM & GRANARY */}
      <section aria-label="This year" hidden={activeTab !== "farm"}>
        <h3>This year</h3>
        <dl className="demo-facts">
          <Field label="Flood" value={levelLabel(screen.year.flood)} />
          <Field label="Army" value={levelLabel(screen.year.army)} />
          <Field label="Road" value={levelLabel(screen.year.road)} />
        </dl>
        {screen.year.lines.length > 0 ? (
          <ul>
            {screen.year.lines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>The year has not added a further effect.</p>
        )}
      </section>

      <section aria-label="Household grain" hidden={activeTab !== "farm"}>
        <h3>Household grain</h3>
        <dl className="demo-facts">
          <Field label="Store" value={String(screen.household.grain)} />
          <Field label="Capacity" value={String(screen.household.capacity)} />
          <Field label="Mouths" value={String(screen.household.mouths)} />
          <Field label="Expected harvest" value={String(screen.household.expectedHarvest)} />
          <Field label="Expected spoilage" value={String(screen.household.expectedSpoilage)} />
          <Field label="Rent" value={String(screen.household.expectedRent)} />
          <Field label="Cash" value={cashText} />
        </dl>
        {screen.household.grain === 0 && <p>The store is empty.</p>}
        {screen.household.shortfallBps > 0 && <p>The household was short last year.</p>}
      </section>

      <section aria-label="Wider life" hidden={activeTab !== "farm"}>
        <h3>Fields, animals and stores</h3>
        <dl className="demo-facts">
          <Field label="Grain plots" value={String(screen.household.plots - screen.household.flaxPlots)} />
          <Field label="Flax plots" value={String(screen.household.flaxPlots)} />
          <Field label="Flax stored" value={String(screen.household.flax)} />
          <Field label="Linen" value={String(screen.household.linen)} />
          <Field label="Oxen" value={String(screen.household.animals.ox)} />
          <Field label="Donkeys" value={String(screen.household.animals.donkey)} />
        </dl>
        <div className="demo-actions">
          <label>
            Flax plots next year
            <input
              inputMode="numeric"
              min={0}
              max={screen.household.plots}
              type="number"
              value={flaxPlots}
              onChange={event => setFlaxPlots(Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
          <button type="button" onClick={() => setNotice(onPlan(flaxPlots) ?? "Planting plan sent.")}>
            Set planting
          </button>
        </div>
        <h3>Holdings</h3>
        <ul>
          {screen.market.quotes
            .filter(entry => entry.item !== "grain" && entry.item !== "flax")
            .map(entry => (
              <li key={entry.item}>
                {itemLabel(entry.item)}: held {heldQuantity(screen, entry.item)} · buy {entry.buy}, sell {entry.sell}.
              </li>
            ))}
        </ul>
      </section>

      {/* TAB 3: CAREER & ARMY */}
      <section aria-label="Service" hidden={activeTab !== "service"}>
        <h3>Farm or serve</h3>
        <p>
          {screen.service.serving
            ? "You are serving. Your labour is off the plot."
            : "You are on the farm. Serving would take your labour off the plot."}
        </p>
        <dl className="demo-facts">
          <Field label="Wages" value={String(screen.service.wage)} />
          <Field label="Rations" value={String(screen.service.ration)} />
          <Field label="Army purse" value={String(screen.service.purse)} />
          <Field label="Reputation" value={String(screen.service.reputation)} />
        </dl>
        {screen.service.purse <= 0 && <p>The army purse is short.</p>}
        {screen.service.readiness.length > 0 ? (
          <ul>
            {screen.service.readiness.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>Convoy readiness has not been set.</p>
        )}
        {screen.service.shipment && (
          <p>
            A convoy is waiting: {screen.service.shipment.cargo} measures of grain, stage {screen.service.shipment.stage}.
          </p>
        )}
        <h4>Practice for your career</h4>
        <div className="demo-actions">
          {training.map(activity => (
            <button
              key={activity.id}
              type="button"
              disabled={Boolean(activity.reason) || pending}
              title={activity.reason ?? undefined}
              data-activity={activity.id}
              onClick={() => onActivity?.(activity.id)}
            >
              {activity.label}
            </button>
          ))}
        </div>
        {training.some(activity => activity.reason) && (
          <p>Training uses your activity for the year. Age and skill requirements apply.</p>
        )}
        {occupations.length > 0 && (
          <div className="demo-actions">
            {occupations.map(job => (
              <button
                key={job.id}
                type="button"
                aria-disabled={job.unavailable || undefined}
                onClick={() => {
                  if (!job.unavailable) onOccupation?.(job.id);
                }}
              >
                {job.label}
                {job.unavailable ? " · Unavailable" : ""}
              </button>
            ))}
            {occupations
              .filter(job => job.unavailable)
              .map(job => (
                <p key={job.id + "-reason"}>
                  {job.label}: {job.reason}
                </p>
              ))}
          </div>
        )}
      </section>

      {/* TAB 4: PEOPLE & TOWN FIGURES */}
      <section aria-label="People and town figures" hidden={activeTab !== "people"}>
        <div className="demo-people-header">
          <div>
            <h3>People &amp; Town Counterparties</h3>
            <p className="demo-market-sub">
              Interact with your household, friends, business partners, and Alexandria’s town counterparties.
            </p>
          </div>
          {onOpenCharacterSection && (
            <button type="button" className="demo-open-char-btn" onClick={() => onOpenCharacterSection("children")}>
              Open Full Character Sheet ↗
            </button>
          )}
        </div>

        {/* Town Figures & Economic Counterparties */}
        {screen.townFigures && screen.townFigures.length > 0 && (
          <div className="demo-town-figures-block">
            <h4 className="demo-people-subhead">Town Counterparties &amp; Stewards</h4>
            <div className="demo-town-figures-grid">
              {screen.townFigures.map(fig => {
                const figureOffer = screen.activeOffer?.role === fig.role ? screen.activeOffer : null;
                return (
                  <article key={fig.role} className={`demo-town-figure-card${figureOffer ? " has-offer" : ""}`}>
                    <div className="demo-town-figure-top">
                      <PixelPortrait
                        age={fig.age}
                        name={fig.name}
                        sex={fig.sex}
                        originId={fig.originId}
                        avatarVariant={fig.avatarVariant}
                        seed={`town:${fig.role}`}
                        className="demo-town-figure-avatar"
                      />
                      <div className="demo-town-figure-meta">
                        <div className="demo-town-figure-badges">
                          <span className="demo-figure-role-tag">{fig.title}</span>
                          <span className="demo-figure-gov-tag">
                            {fig.agent ? `Agent: ${fig.agent}` : "Fixed rules"}
                          </span>
                        </div>
                        <strong>{fig.name}</strong>
                        <small>{fig.statusLine}</small>
                      </div>
                    </div>

                    <dl className="demo-figure-stats">
                      <div>
                        <dt>Purse</dt>
                        <dd>{fig.cash} dr</dd>
                      </div>
                      <div>
                        <dt>Grain store</dt>
                        <dd>{fig.grain} measures</dd>
                      </div>
                      {fig.role === "merchant" && (
                        <div>
                          <dt>Flax store</dt>
                          <dd>{fig.flax} bundles</dd>
                        </div>
                      )}
                    </dl>

                    {figureOffer && (
                      <div className="demo-figure-inline-offer">
                        <strong>Active {figureOffer.kind.replace("-", " ")}:</strong> {figureOffer.quantity}{" "}
                        {itemLabel(figureOffer.item).toLowerCase()} @ {figureOffer.price} dr ({figureOffer.total} dr)
                      </div>
                    )}

                    <div className="demo-figure-actions">
                      {fig.role === "merchant" && (
                        <button
                          type="button"
                          onClick={() => {
                            setCounterparty("merchant");
                            setActiveTab("market");
                          }}
                        >
                          Trade with Merchant →
                        </button>
                      )}
                      {fig.role === "army" && (
                        <button
                          type="button"
                          onClick={() => {
                            setItem("grain");
                            setSide("sell");
                            setCounterparty("army");
                            setActiveTab("market");
                          }}
                        >
                          Supply Army Grain →
                        </button>
                      )}
                      {fig.role === "grower" && (
                        <button
                          type="button"
                          onClick={() => {
                            setItem("grain");
                            setActiveTab("market");
                          }}
                        >
                          Check Grain Market →
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* Alexandria Moneylender Card */}
              {world?.economy?.moneylender && (
                <article className={`demo-town-figure-card${loanSummary?.dueSoon || loanSummary?.due ? " has-offer" : ""}`}>
                  <div className="demo-town-figure-top">
                    <PixelPortrait
                      age={52}
                      name="Syros the Banker"
                      sex="male"
                      originId="merchant-household"
                      avatarVariant={2}
                      seed="town:moneylender"
                      className="demo-town-figure-avatar"
                    />
                    <div className="demo-town-figure-meta">
                      <div className="demo-town-figure-badges">
                        <span className="demo-figure-role-tag">{world.economy.moneylender.title}</span>
                        <span className="demo-figure-gov-tag">Harbor Credit</span>
                      </div>
                      <strong>Syros the Banker</strong>
                      <small>
                        {loanSummary
                          ? `Owed ${loanSummary.balance} dr · ${loanSummary.status}`
                          : `Loans ${world.economy.moneylender.principal} dr (repay ${world.economy.moneylender.principal + world.economy.moneylender.fee} dr in ${world.economy.moneylender.termYears} yrs)`}
                      </small>
                    </div>
                  </div>
                  <div className="demo-figure-actions">
                    {onOpenCharacterSection && (
                      <button type="button" onClick={() => onOpenCharacterSection("wealth")}>
                        {loanSummary ? "Manage / Repay Loan ↗" : "View Loan Terms ↗"}
                      </button>
                    )}
                  </div>
                </article>
              )}
            </div>
          </div>
        )}

        {/* Personal Relationships & Household Circle */}
        {life && world && (
          <div className="demo-personal-circle-block">
            <div className="demo-personal-circle-head">
              <h4 className="demo-people-subhead">Household, Friends &amp; Relationships</h4>
              <div className="demo-people-filters" role="group" aria-label="Filter people">
                {(
                  [
                    ["all", "All"],
                    ["family", "Family"],
                    ["romance", "Romance"],
                    ["friends", "Friends"],
                    ["business", "Business"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={peopleFilter === key}
                    className={peopleFilter === key ? "is-active" : undefined}
                    onClick={() => setPeopleFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {knownPeople.length === 0 && children.length === 0 ? (
              <p className="demo-people-empty">
                You have not established close relationships or a family yet. Live through more years or choose social opportunities as you grow.
              </p>
            ) : (
              <div className="demo-personal-cards-grid">
                {(peopleFilter === "all" || peopleFilter === "family") &&
                  children.map(child => {
                    const childAge = life.age - child.birthAge;
                    const tie = life.character?.relationships?.children[child.id];
                    const otherParent = resolvePartner(world, life, child.otherParentId);
                    const famActs =
                      canActThisYear && onActivity
                        ? visibleFamilyActivities(life, activities).filter(a => a.available).slice(0, 2)
                        : [];
                    return (
                      <article key={`child:${child.id}`} className="demo-person-card is-family">
                        <div className="demo-town-figure-top">
                          <PixelPortrait
                            age={Math.max(0, childAge)}
                            name={child.name}
                            seed={`${life.seed}:child:${child.id}`}
                            originId={life.originId}
                            className="demo-town-figure-avatar"
                          />
                          <div className="demo-town-figure-meta">
                            <div className="demo-town-figure-badges">
                              <span className="demo-figure-role-tag">Child</span>
                            </div>
                            <strong>{child.name}</strong>
                            <small>
                              {childAge === 0 ? "Newborn" : `Age ${childAge}`}
                              {otherParent ? ` · Other parent: ${otherParent.name}` : ""}
                            </small>
                          </div>
                        </div>
                        {tie && (
                          <div className="demo-person-closeness">
                            <span>Closeness: <strong>{tie.closeness}/100</strong></span>
                            <div className="demo-person-closeness-bar">
                              <span style={{ width: `${Math.max(0, Math.min(100, tie.closeness))}%` }} />
                            </div>
                          </div>
                        )}
                        {onActivity && famActs.length > 0 && (
                          <div className="demo-person-actions">
                            {famActs.map(act => (
                              <button key={act.id} type="button" onClick={() => onActivity(act.id)}>
                                {displayProse(act.text)}
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}

                {knownPeople
                  .filter(person => {
                    const tags = relationshipLabels(world, life, person.id);
                    const isRomantic =
                      life.character?.partnerId === person.id ||
                      life.character?.datedPartnerIds?.includes(person.id);
                    if (peopleFilter === "all") return true;
                    if (peopleFilter === "family") return life.character?.partnerId === person.id && life.character?.relationshipStatus === "married";
                    if (peopleFilter === "romance") return Boolean(isRomantic);
                    if (peopleFilter === "friends") return tags.includes("Friend");
                    if (peopleFilter === "business") return tags.includes("Business partner");
                    return true;
                  })
                  .map(person => {
                    const tags = relationshipLabels(world, life, person.id);
                    const tie = life.character?.relationships?.partners[person.id];
                    const personActs =
                      canActThisYear && onActivity
                        ? activities.filter(
                            act =>
                              act.category === "relationship" &&
                              act.available &&
                              activityPartnerIds(act).includes(person.id),
                          )
                        : [];
                    return (
                      <article key={person.id} className="demo-person-card">
                        <div className="demo-town-figure-top">
                          {"sex" in person && (
                            <PixelPortrait
                              age={life.age + person.ageOffset}
                              name={person.name}
                              sex={person.sex}
                              originId={person.originId}
                              avatarVariant={person.avatarVariant}
                              seed={`${life.seed}:${person.id}`}
                              className="demo-town-figure-avatar"
                            />
                          )}
                          <div className="demo-town-figure-meta">
                            <div className="demo-town-figure-badges">
                              {tags.map(tag => (
                                <span key={tag} className="demo-figure-role-tag">{tag}</span>
                              ))}
                            </div>
                            <strong>{person.name}</strong>
                            <small>
                              {person.occupation} · Age {life.age + person.ageOffset}
                            </small>
                          </div>
                        </div>
                        <p className="demo-person-desc">{displayProse(person.description)}</p>
                        {tie && (
                          <div className="demo-person-closeness">
                            <span>
                              Closeness: <strong>{tie.closeness}/100</strong> · Last contact age {tie.lastContactAge}
                            </span>
                            <div className="demo-person-closeness-bar">
                              <span style={{ width: `${Math.max(0, Math.min(100, tie.closeness))}%` }} />
                            </div>
                          </div>
                        )}
                        {onActivity && personActs.length > 0 && (
                          <div className="demo-person-actions">
                            {personActs.map(act => (
                              <button key={act.id} type="button" onClick={() => onActivity(act.id)}>
                                <strong>{displayProse(act.text)}</strong>
                                <ChoiceImpact choice={act} life={life} world={world} hideSkills />
                              </button>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* TAB 5: WORKS & STEWARDS */}
      <section aria-label="Community works" hidden={activeTab !== "works"}>
        <h3>Community works</h3>
        <ul>
          {screen.works.works.map(work => (
            <li key={work.id}>
              <strong>{work.title}</strong> · {work.built ? "Finished" : work.progress + " of " + work.needed} · costs{" "}
              {work.cash} drachmas and {work.grain} grain{work.built ? " · effect is in place" : ""}
            </li>
          ))}
        </ul>
        <p>Reputation {screen.works.reputation}. Changes are listed in the life record when they happen.</p>
      </section>

      <section aria-label="Townspeople" hidden={activeTab !== "works"}>
        <h3>Who decided</h3>
        <ul>
          {screen.agents.map(agent => (
            <li key={agent.role}>{agent.text}</li>
          ))}
        </ul>
        {screen.offerText && <p>{screen.offerText} It is shown here until it arrives as a decision.</p>}
        <div className="demo-actions">
          <button type="button" aria-pressed={autoPlay} onClick={() => onAutoPlay(!autoPlay)}>
            {autoPlay ? "Auto-play is on" : "Auto-play is off"}
          </button>
          {autoPlay && (
            <button type="button" onClick={() => onAutoPlay(false)}>
              Take back
            </button>
          )}
          <label>
            Agent account
            <input value={agentName} onChange={event => setAgentName(event.target.value)} placeholder="account.testnet" />
          </label>
          <button type="button" onClick={() => setNotice(onDelegate(agentName.trim() || null) ?? "Delegation sent.")}>
            Hand decisions over
          </button>
          <button
            type="button"
            onClick={() => {
              setAgentName("");
              setNotice(onDelegate(null) ?? "You took the decisions back.");
            }}
          >
            Take the decisions back
          </button>
        </div>
      </section>

      <section aria-label="Future paths" hidden={activeTab !== "works"}>
        <h3>Future paths</h3>
        {screen.futurePaths.length === 0 ? (
          <p>No future paths are listed for this world.</p>
        ) : (
          <ul>
            {screen.futurePaths.map(path => (
              <li key={path.id}>
                <strong>{path.title}</strong> <span className="demo-badge">Unavailable</span>
                <p>{path.description}</p>
                {path.prerequisites && <p>{path.prerequisites}</p>}
                <p>Not available in this demo.</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
