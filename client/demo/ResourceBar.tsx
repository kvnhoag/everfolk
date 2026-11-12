import { useState } from "react";
import { TRADE_ITEMS, type TradeItem } from "../../src/demo/types.ts";
import { itemLabel, levelLabel } from "./labels.ts";
import type { DemoScreen } from "./screen.ts";
import "./resource-bar.css";
import PixelIcon from "../components/PixelIcon.tsx";
import { RESOURCES, type ResourceId } from "./resources.ts";
import ResourceYearDetails from "./Storehouse.tsx";
import type { StorehouseRow } from "./storehouse-model.ts";

interface ResourceBarProps {
  screen: DemoScreen;
  cashText: string;
  rows?: StorehouseRow[] | null;
  onPlan?(flaxPlots: number): string | null;
  onSelectTradeItem?(item: TradeItem): void;
}

const RESOURCE_PIXELS: Record<string, string[]> = {
  plots: [
    "####.####",
    "####.####",
    "####.####",
    ".........",
    "####.####",
    "####.####",
    "####.####",
  ],
  merchant: [
    "...###...",
    ".#######.",
    "#.#.#.#.#",
    ".#######.",
    "..#...#..",
    "..#####..",
    ".#######.",
  ],
  army: [
    "....#....",
    "...###...",
    "..#####..",
    "..#####..",
    "...###...",
    "....#....",
    "...###...",
  ],
};

export function ResourceGlyph({ id }: { id: string }) {
  const resource = id === "cash" ? "drachmas" : id;
  if (Object.hasOwn(RESOURCES, resource)) return <span className={`aoe-glyph aoe-glyph-${id}`} aria-hidden="true"><PixelIcon name={RESOURCES[resource as ResourceId].icon} size={14} /></span>;
  const rows = RESOURCE_PIXELS[id] ?? RESOURCE_PIXELS.plots;
  return (
    <span className={`aoe-glyph aoe-glyph-${id}`} aria-hidden="true">
      <svg width={14} height={14} viewBox="0 0 11 11" fill="currentColor" shapeRendering="crispEdges" focusable="false">
        {rows.flatMap((row, y) =>
          [...row].flatMap((cell, x) =>
            cell === "#" ? <rect x={x + 1} y={y + 2} width={1} height={1} key={`${x}-${y}`} /> : [],
          ),
        )}
      </svg>
    </span>
  );
}

function holdingOf(screen: DemoScreen, item: TradeItem): number {
  if (screen.holdings) return screen.holdings[item] ?? 0;
  if (item === "grain") return screen.household.grain;
  if (item === "flax") return screen.household.flax;
  if (item === "linen") return screen.household.linen;
  if (item === "ox") return screen.household.animals.ox;
  if (item === "donkey") return screen.household.animals.donkey;
  return 0;
}

export default function ResourceBar({ rows = null, screen, cashText, onPlan, onSelectTradeItem }: ResourceBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TradeItem | null>(null);
  const [flaxPlots, setFlaxPlots] = useState(screen.household.flaxPlots);
  const [planNotice, setPlanNotice] = useState("");

  const grainPlots = Math.max(0, screen.household.plots - screen.household.flaxPlots);
  const netGrain =
    screen.household.expectedHarvest -
    screen.household.expectedRent -
    (screen.household.expectedEating ?? 0) -
    screen.household.expectedSpoilage;
  const overCapacity = screen.household.grain > screen.household.capacity;
  const luxuryHeld = holdingOf(screen, "silver") + holdingOf(screen, "gold") + holdingOf(screen, "silk");
  const hasLegacyGranary = (screen.legacyHelp?.length ?? 0) > 0;

  function openItemInDrawer(item: TradeItem) {
    setSelectedItem(item);
    setDrawerOpen(true);
  }

  return (
    <section className="aoe-resource-hud" aria-label="Household resources and inventory">
      <div className="aoe-resource-bar">
        <div className="aoe-staples" role="list" aria-label="Pinned household resources">
          <button
            type="button"
            role="listitem"
            className={`aoe-cell${selectedItem === "grain" && drawerOpen ? " is-selected" : ""}${overCapacity ? " is-warn" : ""}${hasLegacyGranary ? " is-blessed" : ""}`}
            title={`Grain in store: ${screen.household.grain} / ${screen.household.capacity} capacity (Expected harvest +${screen.household.expectedHarvest}, spoilage -${screen.household.expectedSpoilage})`}
            onClick={() => openItemInDrawer("grain")}
          >
            <ResourceGlyph id="grain" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Grain</span>
              <strong className="aoe-cell-value">
                {screen.household.grain}
                <small>/{screen.household.capacity}</small>
              </strong>
            </span>
          </button>

          <button
            type="button"
            role="listitem"
            className="aoe-cell"
            title={`Cash on hand: ${cashText}`}
            onClick={() => setDrawerOpen(v => !v)}
          >
            <ResourceGlyph id="cash" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Cash</span>
              <strong className="aoe-cell-value">{cashText}</strong>
            </span>
          </button>

          <button
            type="button"
            role="listitem"
            className={`aoe-cell${selectedItem === "flax" && drawerOpen ? " is-selected" : ""}`}
            title={`Flax bundles stored: ${holdingOf(screen, "flax")}`}
            onClick={() => openItemInDrawer("flax")}
          >
            <ResourceGlyph id="flax" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Flax</span>
              <strong className="aoe-cell-value">{holdingOf(screen, "flax")}</strong>
            </span>
          </button>

          <button
            type="button"
            role="listitem"
            className={`aoe-cell${selectedItem === "linen" && drawerOpen ? " is-selected" : ""}`}
            title={`Spun linen bolts: ${holdingOf(screen, "linen")}`}
            onClick={() => openItemInDrawer("linen")}
          >
            <ResourceGlyph id="linen" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Linen</span>
              <strong className="aoe-cell-value">{holdingOf(screen, "linen")}</strong>
            </span>
          </button>

          <button
            type="button"
            role="listitem"
            className={`aoe-cell${(selectedItem === "ox" || selectedItem === "donkey") && drawerOpen ? " is-selected" : ""}`}
            title={`Livestock: ${holdingOf(screen, "ox")} oxen, ${holdingOf(screen, "donkey")} donkeys`}
            onClick={() => openItemInDrawer("ox")}
          >
            <ResourceGlyph id="ox" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Herd</span>
              <strong className="aoe-cell-value">
                {holdingOf(screen, "ox")}
                <small>ox</small> · {holdingOf(screen, "donkey")}
                <small>dk</small>
              </strong>
            </span>
          </button>

          <button
            type="button"
            role="listitem"
            className="aoe-cell"
            title={`Plots: ${grainPlots} grain, ${screen.household.flaxPlots} flax (of ${screen.household.plots} total)`}
            onClick={() => setDrawerOpen(v => !v)}
          >
            <ResourceGlyph id="plots" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Fields</span>
              <strong className="aoe-cell-value">
                {grainPlots}
                <small> grain</small> · {screen.household.flaxPlots}
                <small> flax</small>
              </strong>
            </span>
          </button>

          <button
            type="button"
            role="listitem"
            className="aoe-cell"
            title={`Community reputation: ${screen.works.reputation}`}
            onClick={() => setDrawerOpen(v => !v)}
          >
            <ResourceGlyph id="reputation" />
            <span className="aoe-cell-copy">
              <span className="aoe-cell-label">Rep</span>
              <strong className="aoe-cell-value">{screen.works.reputation}</strong>
            </span>
          </button>
        </div>

        <div className="aoe-world-strip" aria-label="This year's conditions">
          <span className={`aoe-cond aoe-cond-flood-${screen.year.flood}`} title={screen.year.lines[0] ?? levelLabel(screen.year.flood)}>
            {levelLabel(screen.year.flood)}
          </span>
          <span className={`aoe-cond aoe-cond-army-${screen.year.army}`} title={screen.year.lines[1] ?? levelLabel(screen.year.army)}>
            {levelLabel(screen.year.army)}
          </span>
          <span className={`aoe-cond aoe-cond-road-${screen.year.road}`} title={screen.year.lines[2] ?? levelLabel(screen.year.road)}>
            {levelLabel(screen.year.road)}
          </span>
        </div>

        <button
          type="button"
          className={`aoe-inventory-toggle${drawerOpen ? " is-open" : ""}`}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(v => !v)}
        >
          <span>Inventory &amp; Granary</span>
          {luxuryHeld > 0 && <span className="aoe-inventory-badge">+{luxuryHeld}</span>}
          <span className="aoe-inventory-chevron" aria-hidden="true">▾</span>
        </button>
      </div>

      {drawerOpen && (
        <div className="aoe-inventory-drawer" role="region" aria-label="Inventory and granary details">
          {rows && <ResourceYearDetails rows={rows} />}
          <div className="aoe-drawer-section">
            <header className="aoe-drawer-header">
              <div>
                <span className="aoe-drawer-eyebrow">HOUSEHOLD INVENTORY</span>
                <h3>All Goods, Crops &amp; Livestock</h3>
              </div>
              <button type="button" className="aoe-drawer-close" onClick={() => setDrawerOpen(false)}>
                Close ×
              </button>
            </header>
            <div className="aoe-holdings-grid">
              {TRADE_ITEMS.map(item => {
                const held = holdingOf(screen, item);
                const quote = screen.market.quotes.find(q => q.item === item);
                const active = selectedItem === item;
                return (
                  <div key={item} className={`aoe-holding-card${active ? " is-selected" : ""}${held > 0 ? " has-stock" : ""}`}>
                    <div className="aoe-holding-top">
                      <ResourceGlyph id={item} />
                      <span className="aoe-holding-name">{itemLabel(item)}</span>
                      <strong className="aoe-holding-qty">{held}</strong>
                    </div>
                    {quote && (
                      <div className="aoe-holding-meta">
                        <span>Sell {quote.buy} dr · Buy {quote.sell} dr</span>
                        {onSelectTradeItem && (
                          <button
                            type="button"
                            className="aoe-holding-trade"
                            onClick={() => {
                              onSelectTradeItem(item);
                              setSelectedItem(item);
                            }}
                          >
                            Trade →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="aoe-drawer-section aoe-granary-breakdown">
            <header className="aoe-drawer-header">
              <div>
                <span className="aoe-drawer-eyebrow">GRANARY &amp; PLOTS</span>
                <h3>Annual Store Projection</h3>
              </div>
              <span className={`aoe-net-pill ${netGrain >= 0 ? "is-pos" : "is-neg"}`}>
                {netGrain >= 0 ? `+${netGrain}` : netGrain} est. net grain
              </span>
            </header>

            {screen.legacyHelp?.map(help => (
              <aside className="aoe-legacy-banner" key={`${help.tokenId}:${help.age}`}>
                <strong>A past life kept a granary for you</strong>
                <p>{help.text}</p>
                <a href={`#token/${help.tokenId}`}>Meet the farmer · Life NFT #{help.tokenId}</a>
              </aside>
            ))}

            <dl className="aoe-granary-stats">
              <div>
                <dt>Stored / Capacity</dt>
                <dd>{screen.household.grain} / {screen.household.capacity}</dd>
              </div>
              <div>
                <dt>Expected harvest</dt>
                <dd className="is-pos">+{screen.household.expectedHarvest} grain</dd>
              </div>
              <div>
                <dt>Landowner rent</dt>
                <dd className="is-neg">−{screen.household.expectedRent} grain</dd>
              </div>
              <div>
                <dt>Expected spoilage</dt>
                <dd className="is-neg">−{screen.household.expectedSpoilage} grain</dd>
              </div>
              <div>
                <dt>Mouths fed</dt>
                <dd>{screen.household.mouths} ({screen.service.serving ? "you are with the army" : "at the farm"})</dd>
              </div>
              <div>
                <dt>Plot allocation</dt>
                <dd>{grainPlots} grain · {screen.household.flaxPlots} flax</dd>
              </div>
            </dl>

            {onPlan && (
              <div className="aoe-planting-row">
                <label>
                  <span>Flax plots next year (0–{screen.household.plots})</span>
                  <input
                    inputMode="numeric"
                    type="number"
                    min={0}
                    max={screen.household.plots}
                    value={flaxPlots}
                    onChange={e => setFlaxPlots(Math.max(0, Math.min(screen.household.plots, Number(e.target.value) || 0)))}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setPlanNotice(onPlan(flaxPlots) ?? "Planting plan updated.")}
                >
                  Set planting
                </button>
                {planNotice && <span className="aoe-plan-notice" role="status">{planNotice}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
