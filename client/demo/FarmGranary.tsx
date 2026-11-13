import type { TradeItem } from "../../src/demo/types.ts";
import type { WorldPack } from "../../src/types.ts";
import { tuning } from "../../src/demo/market-rules.ts";
import PixelIcon from "../components/PixelIcon.tsx";
import type { PlantingCheck } from "../models/planting-check.ts";
import { grainStoreAlert, spoilageNote } from "./grain-store-alert.ts";
import { Holdings, PlantingTask } from "./InventoryDrawer.tsx";
import { levelLabel } from "./labels.ts";
import { PLANTING_HINT_AGE } from "../models/tutorial-triggers.ts";
import type { DemoScreen } from "./screen.ts";
import "./farm-granary.css";

/**
 * Farm & Granary: the year's conditions, the household's grain, fields and animals as icon tiles (the same icons as
 * the household bar and the store ledger), then the shared field plan and goods. Every number has its picture.
 */

type Tone = "gain" | "loss" | "neutral" | "warn";

interface Tile { key: string; icon: string; label: string; value: string; note?: string; tone?: Tone }

function Tiles({ tiles, label }: { tiles: readonly Tile[]; label: string }) {
  return <ul className="farm-tiles" aria-label={label}>
    {tiles.map(tile => <li key={tile.key} className={`farm-tile is-${tile.tone ?? "neutral"}`} title={tile.note ? `${tile.label}: ${tile.value}. ${tile.note}` : `${tile.label}: ${tile.value}`}>
      <PixelIcon name={tile.icon} size={18} />
      <span className="farm-tile-label">{tile.label}</span>
      <strong className="farm-tile-value">{tile.value}</strong>
      {tile.note && <small className="farm-tile-note">{tile.note}</small>}
    </li>)}
  </ul>;
}

/** Ordinary years read as neutral; anything that changes the harvest, prices or the road reads as a warning. */
const ORDINARY = new Set(["normal", "quiet", "safe"]);

function conditionTiles(screen: DemoScreen): Tile[] {
  const rows: [string, string, string][] = [["flood", "flood", screen.year.flood], ["army", "military", screen.year.army], ["road", "road", screen.year.road]];
  return rows.map(([key, icon, level], index) => ({
    key, icon, label: key === "flood" ? "Nile flood" : key === "army" ? "Army" : "Road",
    value: levelLabel(level), note: screen.year.lines[index], tone: ORDINARY.has(level) ? "neutral" : "warn",
  }));
}

function grainTiles(screen: DemoScreen, cashText: string): Tile[] {
  const h = screen.household;
  return [
    { key: "store", icon: "res-grain", label: "Store", value: `${h.grain} / ${h.capacity}`, tone: h.grain > h.capacity ? "loss" : "neutral", note: h.grain > h.capacity ? "Over the store's limit" : "Grain now / what the store holds" },
    { key: "mouths", icon: "people", label: "Mouths", value: String(h.mouths), note: "People eating from the store" },
    { key: "harvest", icon: "res-grain", label: "Next harvest", value: `+${h.expectedHarvest}`, tone: "gain" },
    { key: "rent", icon: "home", label: "Rent", value: `−${h.expectedRent}`, tone: "loss" },
    { key: "eating", icon: "flow-eat", label: "Eating", value: `−${h.expectedEating}`, tone: "loss" },
    { key: "spoilage", icon: "flow-spoil", label: "Spoilage", value: `−${h.expectedSpoilage}`, tone: "loss" },
    { key: "cash", icon: "res-drachmas", label: "Cash", value: cashText },
  ];
}

function fieldTiles(screen: DemoScreen): Tile[] {
  const h = screen.household;
  return [
    { key: "grain-plots", icon: "res-fields", label: "Grain plots", value: String(h.plots - h.flaxPlots) },
    { key: "flax-plots", icon: "res-flax-plots", label: "Flax plots", value: String(h.flaxPlots) },
    { key: "flax", icon: "res-flax", label: "Flax stored", value: String(h.flax) },
    { key: "linen", icon: "res-linen", label: "Linen", value: String(h.linen) },
    { key: "ox", icon: "res-ox", label: "Oxen", value: String(h.animals.ox) },
    { key: "donkey", icon: "res-donkey", label: "Donkeys", value: String(h.animals.donkey) },
  ];
}

export interface FarmGranaryProps {
  screen: DemoScreen;
  world?: WorldPack;
  age: number;
  cashText: string;
  holding(item: TradeItem): number;
  onPlan(flaxPlots: number): string | null;
  checkPlan?(flaxPlots: number): PlantingCheck;
  plantingLockedUntil?: number | null;
  onTrade?(item: TradeItem): void;
}

export default function FarmGranary({ screen, world, age, cashText, holding, onPlan, checkPlan, plantingLockedUntil = null, onTrade }: FarmGranaryProps) {
  const h = screen.household;
  const rates = world?.demo ? { capacity: h.capacity, spoilageBps: world.demo.household.spoilageBps, overCapacitySpoilageBps: world.demo.household.overCapacitySpoilageBps } : null;
  const alert = rates && world?.demo ? grainStoreAlert({ ...rates, grain: h.grain, expectedHarvest: h.expectedHarvest, expectedRent: h.expectedRent,
    expectedEating: h.expectedEating, age, tradeAge: tuning(world.demo.market).minTradeAge, plantingAge: PLANTING_HINT_AGE }) : null;
  return <div className="farm-granary">
    <section aria-label="This year's conditions">
      <h3 className="farm-heading">This year</h3>
      <Tiles tiles={conditionTiles(screen)} label="Flood, army and road" />
    </section>
    <section aria-label="Household grain">
      <h3 className="farm-heading">Household grain</h3>
      {alert && <p className={`storehouse-alert is-${alert.tone}`} role="status"><PixelIcon name="warn" size={12} label="Store warning" />{alert.text}</p>}
      <Tiles tiles={grainTiles(screen, cashText)} label="Grain in, out and stored" />
      {rates && <p className="farm-note">{spoilageNote(rates)}</p>}
      {h.grain === 0 && <p className="farm-note is-loss">The store is empty.</p>}
      {h.shortfallBps > 0 && <p className="farm-note is-loss">The household went short last year.</p>}
    </section>
    <section aria-label="Fields and animals">
      <h3 className="farm-heading">Fields and animals</h3>
      <Tiles tiles={fieldTiles(screen)} label="Plots, flax, linen and animals" />
      <PlantingTask screen={screen} onPlan={onPlan} checkPlan={checkPlan} lockedUntil={plantingLockedUntil} />
    </section>
    <Holdings screen={screen} holding={holding} selectedItem={null} onTrade={onTrade} />
  </div>;
}
