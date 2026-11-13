import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { activityPartnerIds } from "../../src/character.ts";
import type { TradeCommand, TradeItem } from "../../src/demo/types.ts";
import { TRADE_ITEMS } from "../../src/demo/types.ts";
import { resolvePartner } from "../../src/people.ts";
import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import ChoiceImpact from "../components/ChoiceImpact.tsx";
import { visibleFamilyActivities } from "../models/character-panel-model.ts";
import { displayProse } from "../models/display-prose.ts";
import { getLoanSummary } from "../models/loan-summary.ts";
import PixelPortrait from "../components/PixelPortrait.tsx";
import { childPortraitState, personPortraitState, resolvePortraitState } from "../models/portrait-state.ts";
import { relationshipLabels, visibleRelationshipPeople } from "../models/relationship-labels.ts";
import { beginOrder, releaseOrder } from "./screen.ts";
import type { DemoScreen, TownFigureView } from "./screen.ts";
import { itemLabel, levelLabel } from "./labels.ts";
import PriceChart, { AssetSparkline } from "./PriceChart.tsx";
import { ResourceGlyph } from "./ResourceBar.tsx";
import "./economy-panels.css";
import SectionHelp from "../components/SectionHelp.tsx";
import { focusSection } from "../lib/section-flash.ts";
import WorksPanel from "./WorksPanel.tsx";
import { tuning } from "../../src/demo/market-rules.ts";
import PixelIcon from "../components/PixelIcon.tsx";
import { SectionStep } from "../components/YearChecklist.tsx";
import { LockedArea } from "../components/Locked.tsx";
import { sectionStep } from "../models/section-steps.ts";
import type { TradePreview } from "../models/trade-preview.ts";
import type { PlantingCheck } from "../models/planting-check.ts";
import FarmGranary from "./FarmGranary.tsx";

/** A small lock on a tab that has not opened yet, with the age it opens. */
function TabLock({ age }: { age: number }) {
  return <span className="tab-lock" title={`Opens at age ${age}`}><PixelIcon name="lock" size={11} />Age {age}</span>;
}

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
  /** What an order would do, tried on a copy of the life; Confirm sends it. */
  previewTrade?(order: TradeCommand): TradePreview;
  /** What a field plan would do, checked before Set planting. */
  checkPlan?(flaxPlots: number): PlantingCheck;
  /** The age planting opens for the player; null once open. */
  plantingLockedUntil?: number | null;
  onPlan(flaxPlots: number): string | null;
  onAutoPlay(on: boolean): void;
  onDelegate(agent: string | null): string | null;
  onOccupation?(id: string): void;
  onActivity?(id: string): void;
  onOpenCharacterSection?(section: "career" | "wealth" | "children" | "skills"): void;
  training?: { id: string; label: string; reason: string | null }[];
  occupations?: { id: string; label: string; unavailable: boolean; reason: string | null }[];
}

function Field({ label, value }: { label: ReactNode; value: string }) {
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

function townFigurePortrait(figure: TownFigureView) {
  const jobId = { merchant: "merchant", grower: "farmer", army: "quartermaster" }[figure.role];
  return resolvePortraitState({ personKey: `town:${figure.role}`, age: figure.age, sex: figure.sex,
    avatarVariant: figure.avatarVariant, jobId });
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
  previewTrade,
  checkPlan,
  plantingLockedUntil = null,
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
  // Opens on a tab the player can use: Farm & Granary while the market is still closed to them.
  const [activeTab, setActiveTab] = useState<EconomyTabId>(() => life && world?.demo && life.age < tuning(world.demo.market).minTradeAge ? "farm" : "market");
  const [item, setItem] = useState<TradeItem>("grain");
  const [side, setSide] = useState<"buy" | "sell">("sell");
  const [quantity, setQuantity] = useState(1);
  const [reserveOverride, setReserveOverride] = useState(false);
  const [counterparty, setCounterparty] = useState<"merchant" | "army">("merchant");
  const [notice, setNotice] = useState("");
  const [peopleFilter, setPeopleFilter] = useState<"all" | "friends" | "business" | "romance" | "family">("all");
  const [openDropdown, setOpenDropdown] = useState<"good" | "side" | "with" | null>(null);

  const quote = screen.market.quotes.find(entry => entry.item === item);
  const order: TradeCommand = { type: "trade", item, side, quantity, counterparty, ...(reserveOverride ? { reserveOverride: true } : {}) };
  const held = heldQuantity(screen, item);
  const unitPrice =
    counterparty === "army" && item === "grain"
      ? screen.market.armyGrainPrice
      : side === "buy"
        ? (quote?.sell ?? 1)
        : (quote?.buy ?? 1);

  useEffect(() => { setReserveOverride(false); }, [item, side, counterparty, life?.age]);
  // The preview always shows the order on screen; any change to it closes the preview.
  const [preview, setPreview] = useState<TradePreview | null>(null);
  // Any change to the life (cash spent, a decision, a new year) also closes it, so it never shows stale numbers.
  useEffect(() => { setPreview(null); }, [item, side, quantity, counterparty, reserveOverride, life, screen.market.visitUsed]);
  function openPreview() {
    if (!previewTrade) { setNotice("This life has no market."); return; }
    setNotice("");
    setPreview(previewTrade(order));
  }

  useEffect(() => {
    slot.current = false;
  }, [screen.market.visitUsed, pending]);

  // A Trade button elsewhere (Inventory & Granary) opens the market here with that good chosen, scrolls the
  // order ticket into view and lights it up, so the click visibly lands somewhere.
  const marketRef = useRef<HTMLElement>(null);
  const [tradeJump, setTradeJump] = useState(0);
  useEffect(() => {
    if (!externalTradeItem) return;
    setItem(externalTradeItem.item);
    setSide(heldQuantity(screen, externalTradeItem.item) > 0 ? "sell" : "buy");
    setCounterparty("merchant");
    setActiveTab("market");
    setTradeJump(externalTradeItem.seq);
  }, [externalTradeItem?.seq]);
  useEffect(() => {
    if (!tradeJump) return;
    const frame = requestAnimationFrame(() => focusSection({ selectors: [".demo-economy .demo-trade-ticket"], label: "Your order: set the quantity, then Preview order" }));
    return () => cancelAnimationFrame(frame);
  }, [tradeJump]);

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
    if (screen.market.visitUsed || pending || !preview?.confirmLabel) return;
    if (!beginOrder(slot)) return;
    const reason = onTrade(order);
    setPreview(null);
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

  // Tabs that open later carry their opening age, so nothing looks broken before it is meant to work.
  const age = life?.age ?? 0;
  const tradeAge = world?.demo ? tuning(world.demo.market).minTradeAge : undefined;
  const tradeLockedUntil = tradeAge !== undefined && age < tradeAge ? tradeAge : null;
  const firstJobAge = Math.min(...(world?.character?.jobs ?? []).map(job => job.minAge ?? 0));
  const careerLockedUntil = Number.isFinite(firstJobAge) && age < firstJobAge ? firstJobAge : null;

  const history = screen.priceHistory ?? [];
  const basePrices = screen.basePrices;

  return (
    <div className="demo-economy" aria-labelledby={titleId}>
      <header className="demo-deck-header has-section-help">
        <SectionHelp hint="command-deck" />
        <div>
          <span className="demo-deck-eyebrow"><SectionStep step={sectionStep("town")} />HOUSEHOLD &amp; TOWN COMMAND DECK</span>
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
            Market &amp; Trade{tradeLockedUntil !== null && <TabLock age={tradeLockedUntil} />}
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
            Career &amp; Army{careerLockedUntil !== null && <TabLock age={careerLockedUntil} />}
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
              portrait={townFigurePortrait(offerFigure)}
              name={offerFigure.name}
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
            portrait={resolvePortraitState({ age: 56, sex: "male", avatarVariant: 1,
              personKey: `legacy:${help.tokenId}`, occupation: "Independent farmer" })}
            name={`Life NFT #${help.tokenId}`}
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
        <section className="demo-scenario-section" aria-label="Demo scenario">
          <details className="demo-scenario-drawer">
            <summary>
              <h3>Demo scenario</h3>
              <span className="demo-scenario-toggle">Compare flood outcomes ▾</span>
            </summary>
            <div className="demo-scenario-body">
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
            </div>
          </details>
        </section>
      )}

      {/* TAB 1: MARKET & TRADE + ASSET PRICE GRAPHS */}
      <section ref={marketRef} className="has-section-help" aria-label="Grain market" hidden={activeTab !== "market"}>
        <SectionHelp hint="market" />
        <LockedArea locked={tradeLockedUntil !== null} title="Market & Trade" unlock={`Unlocks at age ${tradeLockedUntil ?? 0}`} note="Then buy and sell grain and goods once a year.">
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
                        {/* A row's Sell or Buy fills the order below and takes the player there, labelled. */}
                        <button
                          type="button"
                          disabled={heldQuantity(screen, entry.item) <= 0}
                          title={heldQuantity(screen, entry.item) <= 0 ? `You hold no ${itemLabel(entry.item).toLowerCase()} to sell` : undefined}
                          onClick={e => {
                            e.stopPropagation();
                            setItem(entry.item);
                            setSide("sell");
                            setCounterparty("merchant");
                            setTradeJump(seq => seq + 1);
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
                            setTradeJump(seq => seq + 1);
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

        {/* The chart follows the row chosen in the list above and sits above the buy/sell ticket. */}
        <PriceChart
          item={item}
          history={history}
          basePrices={basePrices}
          currentBuy={quote?.buy ?? 1}
          currentSell={quote?.sell ?? 1}
          armyGrainPrice={screen.market.armyGrainPrice}
        />

        <dl className="demo-facts demo-market-summary-facts">
          {screen.market.quotes
            .filter(entry => entry.item === "grain" || entry.item === item)
            .map(entry => (
              <Field key={entry.item} label={<><ResourceGlyph id={entry.item} /> {itemLabel(entry.item)} buy / sell</>} value={entry.buy + " / " + entry.sell} />
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
              aria-expanded={preview !== null}
              onClick={openPreview}
            >
              Preview order
            </button>
          </div>

          {preview && <div className="demo-trade-preview" role="region" aria-label="Order preview">
            <strong>{preview.blocked ? "This order cannot go through" : "Check before you confirm"}</strong>
            {preview.blocked && <p className="demo-trade-preview-blocked">{preview.blocked}</p>}
            <ul>{preview.lines.map(line => <li key={line}>{line}</li>)}</ul>
            {preview.warnings.length > 0 && <ul className="demo-trade-preview-warnings">
              {preview.warnings.map(line => <li key={line}><PixelIcon name="warn" size={12} label="Warning" />{line}</li>)}
            </ul>}
            <div className="demo-trade-preview-actions">
              {preview.confirmLabel && <button type="button" className="demo-trade-confirm" disabled={pending || slot.current} onClick={confirmTrade}>{preview.confirmLabel}</button>}
              <button type="button" className="demo-trade-cancel" onClick={() => setPreview(null)}>{preview.confirmLabel ? "Change order" : "Close"}</button>
            </div>
          </div>}

          {world?.capabilities && item === "grain" && side === "sell" && <label className="demo-reserve-override"><input type="checkbox" checked={reserveOverride} onChange={event => setReserveOverride(event.target.checked)} /> Allow this sale to use grain reserved for household food or seed.</label>}
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

        </LockedArea>
      </section>

      {/* TAB 2: FARM & GRANARY */}
      <section aria-label="Farm and granary" hidden={activeTab !== "farm"}>
        <FarmGranary screen={screen} world={world} age={life?.age ?? 0} cashText={cashText} cash={life?.economy?.cash ?? 0} holding={entry => heldQuantity(screen, entry)}
          onPlan={onPlan} checkPlan={checkPlan} plantingLockedUntil={plantingLockedUntil}
          onTrade={tradeItem => { setItem(tradeItem); setSide(heldQuantity(screen, tradeItem) > 0 ? "sell" : "buy"); setCounterparty("merchant"); setActiveTab("market"); setTradeJump(seq => seq + 1); }} />
      </section>

      {/* TAB 3: CAREER & ARMY */}
      <section aria-label="Service" hidden={activeTab !== "service"}>
        <LockedArea locked={careerLockedUntil !== null} title="Career & Army" unlock={`Unlocks at age ${careerLockedUntil ?? 0}`} note="Then take your first work, train for a career or serve in the army.">
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
        </LockedArea>
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
                        portrait={townFigurePortrait(fig)}
                        name={fig.name}
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
                      portrait={resolvePortraitState({ age: 52, sex: "male", avatarVariant: 2,
                        personKey: "town:moneylender", occupation: world.economy.moneylender.title })}
                      name="Syros the Banker"
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
                            portrait={childPortraitState(world, life, child)}
                            name={child.name}
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
                              portrait={personPortraitState(world, life, person)}
                              name={person.name}
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
      <WorksPanel screen={screen} hidden={activeTab !== "works"} autoPlay={autoPlay} onAutoPlay={onAutoPlay} onDelegate={onDelegate} onNotice={setNotice} />
    </div>
  );
}
