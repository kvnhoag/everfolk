import { useState } from "react";
import { TRADE_ITEMS, type TradeItem } from "../../src/demo/types.ts";
import { itemLabel, levelLabel } from "./labels.ts";
import type { PriceHistoryPoint } from "./price-history.ts";

export function AssetSparkline({
  item,
  history,
  basePrice,
  currentSell,
}: {
  item: TradeItem;
  history: readonly PriceHistoryPoint[];
  basePrice: number;
  currentSell: number;
}) {
  const values = history.length > 0 ? history.map(pt => pt.prices[item]?.sell ?? currentSell) : [basePrice, currentSell];
  const min = Math.min(basePrice, ...values);
  const max = Math.max(basePrice, ...values);
  const span = Math.max(1, max - min);
  const width = 64;
  const height = 20;
  const points = values
    .map((val, idx) => {
      const x = values.length === 1 ? width / 2 : (idx / (values.length - 1)) * (width - 4) + 2;
      const y = height - 3 - ((val - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const baseY = height - 3 - ((basePrice - min) / span) * (height - 6);
  const diffPct = basePrice > 0 ? Math.round(((currentSell - basePrice) / basePrice) * 100) : 0;

  return (
    <span className="demo-sparkline-wrap" title={`${itemLabel(item)}: current ask ${currentSell} dr (base ${basePrice} dr)`}>
      <svg className="demo-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <line x1={0} y1={baseY} x2={width} y2={baseY} stroke="#b8a98e" strokeDasharray="2 2" strokeWidth={1} />
        <polyline fill="none" stroke={diffPct > 0 ? "#a64b2a" : diffPct < 0 ? "#2e6f4e" : "#5a4630"} strokeWidth={1.75} points={points} />
      </svg>
      <span className={`demo-price-delta${diffPct > 0 ? " is-high" : diffPct < 0 ? " is-low" : ""}`}>
        {diffPct > 0 ? `+${diffPct}%` : diffPct < 0 ? `${diffPct}%` : "Base"}
      </span>
    </span>
  );
}

function causalDriverNote(item: TradeItem, latest?: PriceHistoryPoint): string {
  if (!latest) return "Prices follow town stock, the Nile flood, army demand, and road safety.";
  if (item === "grain") {
    return `Driven by merchant stock (${latest.merchantGrainStock} measures), ${levelLabel(latest.flood).toLowerCase()}, ${levelLabel(latest.army).toLowerCase()}, and ${levelLabel(latest.road).toLowerCase()}.`;
  }
  if (item === "flax" || item === "linen") {
    return `Crop & textile prices respond to the Nile flood (${levelLabel(latest.flood).toLowerCase()}).`;
  }
  if (item === "silver" || item === "gold") {
    return `Precious metals respond to military mobilization (${levelLabel(latest.army).toLowerCase()}).`;
  }
  if (item === "silk") {
    return `Imported Coan silk responds to caravan route safety (${levelLabel(latest.road).toLowerCase()}).`;
  }
  return "Draft & pack livestock keep a steady benchmark price across seasons.";
}

export default function PriceChart({
  item,
  onSelectItem,
  history,
  basePrices,
  currentBuy,
  currentSell,
  armyGrainPrice,
}: {
  item: TradeItem;
  onSelectItem?(next: TradeItem): void;
  history: readonly PriceHistoryPoint[];
  basePrices?: Partial<Record<TradeItem, number>>;
  currentBuy: number;
  currentSell: number;
  armyGrainPrice: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const base = basePrices?.[item] ?? currentSell;
  const pts: PriceHistoryPoint[] =
    history.length > 0
      ? [...history]
      : [
          {
            age: 0,
            year: -350,
            flood: "normal",
            army: "quiet",
            road: "safe",
            prices: Object.fromEntries(TRADE_ITEMS.map(id => [id, { buy: currentBuy, sell: currentSell }])) as PriceHistoryPoint["prices"],
            armyGrainPrice,
            merchantGrainStock: 3900,
          },
        ];

  const sellSeries = pts.map(p => p.prices[item]?.sell ?? currentSell);
  const buySeries = pts.map(p => p.prices[item]?.buy ?? currentBuy);
  const armySeries = item === "grain" ? pts.map(p => p.armyGrainPrice) : [];

  const allValues = [base, ...sellSeries, ...buySeries, ...armySeries];
  const minVal = Math.max(0, Math.floor(Math.min(...allValues) * 0.85));
  const maxVal = Math.ceil(Math.max(...allValues, minVal + 2) * 1.12);
  const valSpan = Math.max(1, maxVal - minVal);

  const W = 540;
  const H = 168;
  const padL = 38;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xOf = (idx: number) => (pts.length <= 1 ? padL + plotW / 2 : padL + (idx / (pts.length - 1)) * plotW);
  const yOf = (val: number) => padT + plotH - ((val - minVal) / valSpan) * plotH;

  const sellPolyline = sellSeries.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const buyPolyline = buySeries.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const armyPolyline = armySeries.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const areaPoints = `${xOf(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${sellPolyline} ${xOf(pts.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}`;
  const baseY = yOf(base);

  const activeIdx = hoverIdx !== null && hoverIdx < pts.length ? hoverIdx : pts.length - 1;
  const activePt = pts[activeIdx];
  const activeSell = activePt?.prices[item]?.sell ?? currentSell;
  const activeBuy = activePt?.prices[item]?.buy ?? currentBuy;

  const lifeMin = Math.min(...sellSeries);
  const lifeMax = Math.max(...sellSeries);

  return (
    <div className="demo-price-chart-card" aria-label={`${itemLabel(item)} price history graph`}>
      <div className="demo-price-chart-header">
        <div>
          <span className="demo-chart-eyebrow">PRICE HISTORY &amp; CAUSAL DRIVERS</span>
          <h4>{itemLabel(item)} — Market Trend (Age 0 to {pts[pts.length - 1]?.age ?? 0})</h4>
        </div>
        {onSelectItem && (
          <div className="demo-chart-asset-pills" role="tablist" aria-label="Select asset graph">
            {TRADE_ITEMS.map(id => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={item === id}
                className={`demo-chart-pill${item === id ? " is-active" : ""}`}
                onClick={() => onSelectItem(id)}
              >
                {itemLabel(id)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="demo-chart-kpis">
        <div>
          <span>Merchant Buy (You Sell)</span>
          <strong>{currentBuy} dr</strong>
        </div>
        <div>
          <span>Merchant Sell (You Buy)</span>
          <strong>{currentSell} dr</strong>
        </div>
        <div>
          <span>Base Benchmark</span>
          <strong>{base} dr</strong>
        </div>
        <div>
          <span>Lifetime Range</span>
          <strong>{lifeMin}–{lifeMax} dr</strong>
        </div>
        {item === "grain" && (
          <div>
            <span>Army Contract Levy</span>
            <strong>{armyGrainPrice} dr</strong>
          </div>
        )}
      </div>

      <div className="demo-chart-svg-wrap" onMouseLeave={() => setHoverIdx(null)}>
        <svg className="demo-chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Historical price chart for ${itemLabel(item)}`}>
          {/* Horizontal grid & Y labels */}
          {[0, 0.5, 1].map(t => {
            const val = Math.round(minVal + t * valSpan);
            const y = yOf(val);
            return (
              <g key={t}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e3d8c1" strokeWidth={1} />
                <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#786c57">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Base price benchmark line */}
          <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#9c896c" strokeDasharray="4 3" strokeWidth={1.2} />
          <text x={W - padR - 2} y={Math.max(10, baseY - 4)} textAnchor="end" fontSize={8.5} fill="#786c57">
            Base {base} dr
          </text>

          {/* Causal event highlight bands (low flood / war / dangerous road) */}
          {pts.map((pt, idx) => {
            const shock = pt.flood === "low" || pt.army === "war" || pt.road === "dangerous";
            if (!shock) return null;
            const x = xOf(idx);
            const bw = Math.max(4, plotW / Math.max(8, pts.length));
            return (
              <rect
                key={`shock-${pt.age}`}
                x={x - bw / 2}
                y={padT}
                width={bw}
                height={plotH}
                fill="#c9644a"
                opacity={0.13}
              />
            );
          })}

          {/* Area under sell price */}
          <polygon points={areaPoints} fill="#c89d54" opacity={0.18} />

          {/* Buy price line */}
          <polyline fill="none" stroke="#3d6b52" strokeWidth={1.6} strokeDasharray="3 2" points={buyPolyline} />

          {/* Sell price line */}
          <polyline fill="none" stroke="#8c3b20" strokeWidth={2.2} points={sellPolyline} />

          {/* Army grain price line */}
          {item === "grain" && armyPolyline && (
            <polyline fill="none" stroke="#4a5f8c" strokeWidth={1.5} strokeDasharray="2 2" points={armyPolyline} />
          )}

          {/* Active point marker */}
          {activePt && (
            <g>
              <line x1={xOf(activeIdx)} y1={padT} x2={xOf(activeIdx)} y2={padT + plotH} stroke="#594630" strokeWidth={1} strokeDasharray="2 2" />
              <circle cx={xOf(activeIdx)} cy={yOf(activeSell)} r={3.5} fill="#8c3b20" stroke="#fffdf7" strokeWidth={1.2} />
              <circle cx={xOf(activeIdx)} cy={yOf(activeBuy)} r={3} fill="#3d6b52" stroke="#fffdf7" strokeWidth={1} />
            </g>
          )}

          {/* X-axis age labels */}
          <text x={padL} y={H - 7} textAnchor="start" fontSize={9} fill="#786c57">
            Age {pts[0]?.age ?? 0} ({Math.abs(pts[0]?.year ?? -350)} BCE)
          </text>
          <text x={W - padR} y={H - 7} textAnchor="end" fontSize={9} fill="#786c57">
            Age {pts[pts.length - 1]?.age ?? 0} ({Math.abs(pts[pts.length - 1]?.year ?? -350)} BCE)
          </text>

          {/* Invisible hover columns */}
          {pts.map((pt, idx) => {
            const colW = plotW / Math.max(1, pts.length);
            return (
              <rect
                key={`hit-${pt.age}`}
                x={xOf(idx) - colW / 2}
                y={padT}
                width={Math.max(6, colW)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            );
          })}
        </svg>
      </div>

      <div className="demo-chart-footer">
        <div className="demo-chart-inspect">
          <strong>Age {activePt?.age ?? 0} ({Math.abs(activePt?.year ?? -350)} BCE):</strong>{" "}
          Ask <strong>{activeSell} dr</strong> · Bid <strong>{activeBuy} dr</strong>
          {item === "grain" && activePt ? <> · Army <strong>{activePt.armyGrainPrice} dr</strong></> : null}
          {activePt && (
            <span className="demo-chart-conds">
              {" "}· {levelLabel(activePt.flood)} · {levelLabel(activePt.army)} · {levelLabel(activePt.road)}
            </span>
          )}
        </div>
        <p className="demo-chart-driver-note">{causalDriverNote(item, pts[pts.length - 1])}</p>
      </div>
    </div>
  );
}
