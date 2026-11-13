import { useState } from "react";
import type { PlantingCheck } from "../models/planting-check.ts";
import type { TradeItem } from "../../src/demo/types.ts";
import { levelLabel } from "./labels.ts";
import type { DemoScreen } from "./screen.ts";
import "./resource-bar.css";
import PixelIcon from "../components/PixelIcon.tsx";
import { RESOURCES, type ResourceId } from "./resources.ts";
import type { StorehouseRow } from "./storehouse-model.ts";
import InventoryDrawer from "./InventoryDrawer.tsx";
import SectionHelp from "../components/SectionHelp.tsx";
import { SectionStep } from "../components/YearChecklist.tsx";
import { sectionStep } from "../models/section-steps.ts";

interface ResourceCell {
  key: string;
  /** One short word under the icons, so each is readable at a glance. */
  word: string;
  parts: { glyph: string; value: string; small?: string }[];
  title: string;
  selected?: boolean;
  extraClass?: string;
  onClick(): void;
}

interface ResourceBarProps {
  screen: DemoScreen;
  cashText: string;
  rows?: StorehouseRow[] | null;
  onPlan?(flaxPlots: number): string | null;
  checkPlan?(flaxPlots: number): PlantingCheck;
  plantingLockedUntil?: number | null;
  /** Opens the market with this item chosen. */
  onSelectTradeItem?(item: TradeItem): void;
  /** This year's personal action, for the drawer's Work card; null hides the card. */
}

const RESOURCE_PIXELS: Record<string, string[]> = {
  "flax-plots": [
    "#.#.#.#.#",
    ".#.#.#.#.",
    "#.#.#.#.#",
    ".........",
    "#.#.#.#.#",
    ".#.#.#.#.",
    "#.#.#.#.#",
  ],
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

export default function ResourceBar({ rows = null, screen, cashText, onPlan, checkPlan, plantingLockedUntil = null, onSelectTradeItem }: ResourceBarProps) {
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

  const open = (item: TradeItem) => drawerOpen && selectedItem === item;
  const toggle = () => setDrawerOpen(v => !v);
  // Icons and numbers only: each cell's name and detail are in its tooltip and screen-reader label,
  // and Inventory & Granary spells everything out.
  const cells: ResourceCell[] = [
    { key: "grain", word: "Grain", parts: [{ glyph: "grain", value: String(screen.household.grain), small: `/${screen.household.capacity}` }], selected: open("grain"),
      extraClass: `${overCapacity ? " is-warn" : ""}${hasLegacyGranary ? " is-blessed" : ""}`, onClick: () => openItemInDrawer("grain"),
      title: overCapacity
        ? `Grain: ${screen.household.grain}, over the store's limit of ${screen.household.capacity}. The extra spoils fast; open for what to do.`
        : `Grain: ${screen.household.grain} of ${screen.household.capacity} the store holds (harvest +${screen.household.expectedHarvest}, spoilage −${screen.household.expectedSpoilage})` },
    { key: "cash", word: "Cash", parts: [{ glyph: "cash", value: cashText }], onClick: toggle, title: `Cash on hand: ${cashText}` },
    { key: "flax", word: "Flax", parts: [{ glyph: "flax", value: String(holdingOf(screen, "flax")) }], selected: open("flax"), onClick: () => openItemInDrawer("flax"), title: `Flax: ${holdingOf(screen, "flax")} bundles` },
    { key: "linen", word: "Linen", parts: [{ glyph: "linen", value: String(holdingOf(screen, "linen")) }], selected: open("linen"), onClick: () => openItemInDrawer("linen"), title: `Linen: ${holdingOf(screen, "linen")} bolts` },
    { key: "herd", word: "Herd", parts: [{ glyph: "ox", value: String(holdingOf(screen, "ox")) }, { glyph: "donkey", value: String(holdingOf(screen, "donkey")) }],
      selected: open("ox") || open("donkey"), onClick: () => openItemInDrawer("ox"), title: `Herd: ${holdingOf(screen, "ox")} oxen, ${holdingOf(screen, "donkey")} donkeys` },
    { key: "fields", word: "Fields", parts: [{ glyph: "plots", value: String(grainPlots) }, { glyph: "flax-plots", value: String(screen.household.flaxPlots) }],
      onClick: toggle, title: `Fields: ${grainPlots} grain plots, ${screen.household.flaxPlots} flax plots (of ${screen.household.plots})` },
    { key: "reputation", word: "Standing", parts: [{ glyph: "reputation", value: String(screen.works.reputation) }], onClick: toggle, title: `Reputation in town: ${screen.works.reputation}` },
  ];
  const conditionTitle = (level: string, line?: string) => line ? `${levelLabel(level)}: ${line}` : levelLabel(level);
  const conditions = [
    { kind: "flood", icon: "flood", level: screen.year.flood, title: conditionTitle(screen.year.flood, screen.year.lines[0]) },
    { kind: "army", icon: "military", level: screen.year.army, title: conditionTitle(screen.year.army, screen.year.lines[1]) },
    { kind: "road", icon: "road", level: screen.year.road, title: conditionTitle(screen.year.road, screen.year.lines[2]) },
  ];

  return (
    <section className="aoe-resource-hud has-section-help" aria-label="Household resources and inventory">
      <SectionHelp hint="resources" />
      <div className="aoe-resource-bar">
        <SectionStep step={sectionStep("household")} />
        <div className="aoe-staples" role="list" aria-label="Pinned household resources">
          {cells.map(cell => <button key={cell.key} type="button" role="listitem"
            className={`aoe-cell is-icon-only${cell.selected ? " is-selected" : ""}${cell.extraClass ?? ""}`}
            title={cell.title} aria-label={cell.title} onClick={cell.onClick}>
            <span className="aoe-cell-parts">{cell.parts.map(part => <span key={part.glyph} className="aoe-cell-part">
              <ResourceGlyph id={part.glyph} />
              <strong className="aoe-cell-value">{part.value}{part.small && <small>{part.small}</small>}</strong>
            </span>)}</span>
            <span className="aoe-cell-word" aria-hidden="true">{cell.word}</span>
          </button>)}
        </div>

        <div className="aoe-world-strip" aria-label="This year's conditions">
          {conditions.map(condition => <span key={condition.kind} className={`aoe-cond is-icon-only aoe-cond-${condition.kind}-${condition.level}`}
            title={condition.title} aria-label={condition.title} role="img">
            <PixelIcon name={condition.icon} size={15} />
            <span className="aoe-cell-word" aria-hidden="true">{condition.kind === "flood" ? "Flood" : condition.kind === "army" ? "Army" : "Road"}</span>
          </span>)}
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

      {drawerOpen && <InventoryDrawer screen={screen} rows={rows} selectedItem={selectedItem} holding={item => holdingOf(screen, item)}
        onClose={() => setDrawerOpen(false)} onPlan={onPlan} checkPlan={checkPlan} plantingLockedUntil={plantingLockedUntil}
        onTrade={onSelectTradeItem && (item => { onSelectTradeItem(item); setSelectedItem(item); })} />}
    </section>
  );
}
