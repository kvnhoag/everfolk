import { useId, useRef, useState } from "react";
import type { PlantingCheck } from "../models/planting-check.ts";
import type { TradeItem } from "../../src/demo/types.ts";
import type { DemoScreen } from "./screen.ts";
import "./resource-bar.css";
import PixelIcon from "../components/PixelIcon.tsx";
import { RESOURCES, type ResourceId } from "./resources.ts";
import SectionHelp from "../components/SectionHelp.tsx";
import { SectionStep } from "../components/YearChecklist.tsx";
import { sectionStep } from "../models/section-steps.ts";
import YearCondition from "./YearCondition.tsx";
import InventoryDrawer from "./InventoryDrawer.tsx";
import type { StorehouseRow } from "./storehouse-model.ts";

interface ResourceCell {
  key: string;
  /** One short word under the icons, so each is readable at a glance. */
  word: string;
  parts: { glyph: string; value: string; small?: string }[];
  title: string;
  extraClass?: string;
}

interface ResourceBarProps {
  screen: DemoScreen;
  cashText: string;
  rows?: StorehouseRow[] | null;
  onPlan?(flaxPlots: number): string | null;
  checkPlan?(flaxPlots: number): PlantingCheck;
  plantingLockedUntil?: number | null;
  /** The year's flood, army and road; drawn once the fields are the player's to plan. */
  showConditions?: boolean;
  /** Opens the market with this item chosen from the full inventory. */
  onSelectTradeItem?(item: TradeItem): void;
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

export default function ResourceBar({ screen, cashText, rows = null, onPlan, checkPlan, plantingLockedUntil = null, showConditions = true, onSelectTradeItem }: ResourceBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();
  const viewFullRef = useRef<HTMLButtonElement>(null);
  const grainPlots = Math.max(0, screen.household.plots - screen.household.flaxPlots);
  const overCapacity = screen.household.grain > screen.household.capacity;
  const hasLegacyGranary = (screen.legacyHelp?.length ?? 0) > 0;

  // Every resource stays visible, including empty holdings. These cells only display quantities.
  const cells: ResourceCell[] = [
    { key: "grain", word: "Grain", parts: [{ glyph: "grain", value: String(screen.household.grain), small: `/${screen.household.capacity}` }],
      extraClass: `${overCapacity ? " is-warn" : ""}${hasLegacyGranary ? " is-blessed" : ""}`,
      title: overCapacity
        ? `Grain: ${screen.household.grain}, over the store's limit of ${screen.household.capacity}. The extra spoils fast.`
        : `Grain: ${screen.household.grain} of ${screen.household.capacity} the store holds (harvest +${screen.household.expectedHarvest}, spoilage −${screen.household.expectedSpoilage})` },
    { key: "cash", word: "Cash", parts: [{ glyph: "cash", value: cashText }], title: `Cash on hand: ${cashText}. Cash pays for lessons, tools and market buys, and for food when the store runs short. Paid work and selling at the market bring it in.` },
    { key: "flax", word: "Flax", parts: [{ glyph: "flax", value: String(holdingOf(screen, "flax")) }], title: `Flax: ${holdingOf(screen, "flax")} bundles` },
    { key: "linen", word: "Linen", parts: [{ glyph: "linen", value: String(holdingOf(screen, "linen")) }], title: `Linen: ${holdingOf(screen, "linen")} bolts` },
    ...(["silver", "gold", "silk"] as const).map(item => ({
      key: item, word: item === "silk" ? "Silk" : RESOURCES[item].label,
      parts: [{ glyph: item, value: String(holdingOf(screen, item)) }], title: `${RESOURCES[item].label}: ${holdingOf(screen, item)}`,
    })),
    { key: "herd", word: "Herd", parts: [{ glyph: "ox", value: String(holdingOf(screen, "ox")) }, { glyph: "donkey", value: String(holdingOf(screen, "donkey")) }],
      title: `Herd: ${holdingOf(screen, "ox")} oxen, ${holdingOf(screen, "donkey")} donkeys` },
    { key: "fields", word: "Fields", parts: [{ glyph: "plots", value: String(grainPlots) }, { glyph: "flax-plots", value: String(screen.household.flaxPlots) }],
      title: `Fields: ${grainPlots} grain plots, ${screen.household.flaxPlots} flax plots (of ${screen.household.plots})` },
    { key: "labour", word: "Labour", parts: [{ glyph: "labour", value: String(screen.household.labour) }], title: `Household labour: ${screen.household.labour} (100 = one adult worker)` },
    { key: "reputation", word: "Standing", parts: [{ glyph: "reputation", value: String(screen.works.reputation) }], title: `Reputation in town: ${screen.works.reputation}` },
  ];
  const conditions = [
    { kind: "flood", icon: "flood", level: screen.year.flood, detail: screen.year.lines[0] },
    { kind: "army", icon: "military", level: screen.year.army, detail: screen.year.lines[1] },
    { kind: "road", icon: "road", level: screen.year.road, detail: screen.year.lines[2] },
  ] as const;

  return (
    <section className="aoe-resource-hud has-section-help" aria-label="Household resources and inventory">
      <SectionHelp hint="resources" />
      <div className="aoe-resource-bar">
        <SectionStep step={sectionStep("household")} />
        <div className="aoe-staples" role="list" aria-label="Pinned household resources">
          {cells.map(cell => <div key={cell.key} role="listitem"
            className={`aoe-cell is-icon-only${cell.extraClass ?? ""}`}
            title={cell.title} aria-label={cell.title}>
            <span className="aoe-cell-parts">{cell.parts.map(part => <span key={part.glyph} className="aoe-cell-part">
              <ResourceGlyph id={part.glyph} />
              <strong className="aoe-cell-value">{part.value}{part.small && <small>{part.small}</small>}</strong>
            </span>)}</span>
            <span className="aoe-cell-word" aria-hidden="true">{cell.word}</span>
          </div>)}
        </div>

        {showConditions && <div className="aoe-world-strip" aria-label="This year's conditions">
          {conditions.map(condition => <YearCondition key={condition.kind} {...condition} />)}
        </div>}

        <button type="button" className="aoe-inventory-toggle" ref={viewFullRef}
          aria-expanded={drawerOpen} aria-controls={drawerId} onClick={() => setDrawerOpen(open => !open)}>
          {drawerOpen ? "View less" : "View full"}
          <span className="aoe-inventory-chevron" aria-hidden="true">{drawerOpen ? "▴" : "▾"}</span>
        </button>
      </div>
      <div id={drawerId} hidden={!drawerOpen}>
        {drawerOpen && <InventoryDrawer screen={screen} rows={rows} selectedItem={null} holding={item => holdingOf(screen, item)}
          onClose={() => { setDrawerOpen(false); viewFullRef.current?.focus(); }}
          onPlan={onPlan} checkPlan={checkPlan} plantingLockedUntil={plantingLockedUntil} onTrade={onSelectTradeItem} />}
      </div>
    </section>
  );
}
