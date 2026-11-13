import { useState } from "react";
import type { TradeItem } from "../../src/demo/types.ts";
import { levelLabel } from "./labels.ts";
import type { DemoScreen } from "./screen.ts";
import "./resource-bar.css";
import PixelIcon from "../components/PixelIcon.tsx";
import { RESOURCES, type ResourceId } from "./resources.ts";
import type { StorehouseRow } from "./storehouse-model.ts";
import InventoryDrawer, { type WorkStatus } from "./InventoryDrawer.tsx";
import SectionHelp from "../components/SectionHelp.tsx";
import { SectionStep } from "../components/YearChecklist.tsx";
import { sectionStep } from "../models/section-steps.ts";

interface ResourceBarProps {
  screen: DemoScreen;
  cashText: string;
  rows?: StorehouseRow[] | null;
  onPlan?(flaxPlots: number): string | null;
  /** Opens the market with this item chosen. */
  onSelectTradeItem?(item: TradeItem): void;
  /** This year's personal action, for the drawer's Work card; null hides the card. */
  work?: WorkStatus | null;
  onWork?(): void;
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

export default function ResourceBar({ rows = null, screen, cashText, onPlan, onSelectTradeItem, work = null, onWork }: ResourceBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TradeItem | null>(null);

  const grainPlots = Math.max(0, screen.household.plots - screen.household.flaxPlots);
  const overCapacity = screen.household.grain > screen.household.capacity;
  const luxuryHeld = holdingOf(screen, "silver") + holdingOf(screen, "gold") + holdingOf(screen, "silk");
  const hasLegacyGranary = (screen.legacyHelp?.length ?? 0) > 0;

  function openItemInDrawer(item: TradeItem) {
    setSelectedItem(item);
    setDrawerOpen(true);
  }

  return (
    <section className="aoe-resource-hud has-section-help" aria-label="Household resources and inventory">
      <SectionHelp hint="resources" />
      <div className="aoe-resource-bar">
        <SectionStep step={sectionStep("household")} />
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

      {drawerOpen && <InventoryDrawer screen={screen} rows={rows} selectedItem={selectedItem} holding={item => holdingOf(screen, item)} work={work}
        onClose={() => setDrawerOpen(false)} onPlan={onPlan} onWork={onWork}
        onTrade={onSelectTradeItem && (item => { onSelectTradeItem(item); setSelectedItem(item); })} />}
    </section>
  );
}
