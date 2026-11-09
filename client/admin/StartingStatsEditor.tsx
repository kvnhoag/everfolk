import type { ReactNode } from "react";
import type { Effect, Origin, StatDefinition, StatRange, WorldPack } from "../../src/types.ts";

function RangeField({ label, accessibleLabel, value, min, max, onChange, invalid = false }: {
  label: string; accessibleLabel: string; value: number; min: number; max: number;
  onChange(value: number): void; invalid?: boolean;
}) {
  return <label className="admin-field"><span>{label}</span><input aria-label={accessibleLabel} aria-invalid={invalid || undefined} type="number" step="1" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function defaultRange(stat: StatDefinition): StatRange { return stat.initialRange ?? { min: stat.initial, max: stat.initial }; }
function rangeText(range: StatRange): string { return `${range.min} - ${range.max}`; }
function rangeIssue(range: StatRange, stat: StatDefinition): string {
  if (!Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max)) return "Use whole numbers for both ends of the range.";
  if (range.min > range.max) return "The starting minimum must be no greater than the maximum.";
  if (range.min < stat.min || range.max > stat.max) return `Keep the starting range within ${stat.min} - ${stat.max}.`;
  return "";
}

function referencesOrigin(value: unknown, id: string): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(entry => referencesOrigin(entry, id));
  const entry = value as Record<string, unknown>;
  if (entry.type === "origin" && entry.origin === id) return true;
  return Object.values(entry).some(child => referencesOrigin(child, id));
}

export default function StartingStatsEditor({ world, onChange, renderEffects }: {
  world: WorldPack; onChange(patch: Partial<WorldPack>): void;
  renderEffects(effects: Effect[], onChange: (effects: Effect[]) => void): ReactNode;
}) {
  const stats = Object.entries(world.stats);
  const moneyRange = (id: string, range: StatRange): string => world.economy?.stat === id
    ? `${range.min * world.economy.unitsPerPoint} - ${range.max * world.economy.unitsPerPoint} ${world.economy.currency.short}`
    : rangeText(range);
  const totalWeight = world.origins.reduce((total, origin) => total + origin.weight, 0);
  const updateStat = (id: string, patch: Partial<StatDefinition>) => onChange({ stats: { ...world.stats, [id]: { ...world.stats[id], ...patch } } });
  const updateOrigin = (id: string, patch: Partial<Origin>) => onChange({ origins: world.origins.map(origin => origin.id === id ? { ...origin, ...patch } : origin) });
  function setOriginRange(origin: Origin, id: string, range: StatRange | undefined) {
    const statRanges = { ...origin.statRanges };
    if (range) statRanges[id] = range;
    else delete statRanges[id];
    const next = { ...origin };
    if (Object.keys(statRanges).length) next.statRanges = statRanges;
    else delete next.statRanges;
    onChange({ origins: world.origins.map(candidate => candidate.id === origin.id ? next : candidate) });
  }
  function addOrigin() {
    let id = "new-household", suffix = 2;
    while (world.origins.some(origin => origin.id === id)) id = `new-household-${suffix++}`;
    onChange({ origins: [...world.origins, { id, title: "A new household", text: "You are born into a household in this world.", weight: 1, effects: [], evidence: "fictional", sourceIds: [] }] });
  }
  return <div className="admin-starting-stats">
    <div className="admin-section-label"><h3>Starting stat ranges</h3><span>World defaults for origins without their own range.</span></div>
    <p className="admin-starting-note">Each new life draws a whole number for every stat. Both ends are included; equal values give a fixed start. The same seed reproduces the same origin and rolls.</p>
    {world.economy && <p className="admin-starting-note">Wealth range inputs use resource points: one point gives {world.economy.unitsPerPoint} {world.economy.currency.short} of starting cash. The summaries show money amounts. Net worth can grow beyond the internal stat limit during play.</p>}
    <div className="admin-start-range-list">{stats.map(([id, stat]) => {
      const range = defaultRange(stat), issue = stat.initialRange ? rangeIssue(range, stat) : "";
      return <div className="admin-start-range-row" key={id}>
        <div className="admin-range-name"><strong>{stat.label}</strong><span>{moneyRange(id, range)}</span></div>
        <RangeField label="Starting min" accessibleLabel={`${stat.label} starting minimum`} value={range.min} min={stat.min} max={stat.max} invalid={!!issue} onChange={min => updateStat(id, { initialRange: { ...range, min } })} />
        <RangeField label="Starting max" accessibleLabel={`${stat.label} starting maximum`} value={range.max} min={stat.min} max={stat.max} invalid={!!issue} onChange={max => updateStat(id, { initialRange: { ...range, max } })} />
        {issue && <p className="admin-range-error" role="alert">{stat.label}: {issue}</p>}
      </div>;
    })}</div>
    <details className="admin-stat-limits"><summary>Allowed stat limits</summary><p>These bounds apply throughout the life. Starting ranges must fit inside them.</p><div className="admin-start-range-list">{stats.map(([id, stat]) => <div className="admin-start-range-row" key={id}><div className="admin-range-name"><strong>{stat.label}</strong></div><label className="admin-field"><span>Allowed min</span><input aria-label={`${stat.label} allowed minimum`} type="number" step="any" value={stat.min} onChange={event => { const min = Number(event.target.value); updateStat(id, { min, initial: Math.max(min, Math.min(stat.max, stat.initial)) }); }} /></label><label className="admin-field"><span>Allowed max</span><input aria-label={`${stat.label} allowed maximum`} type="number" step="any" value={stat.max} onChange={event => { const max = Number(event.target.value); updateStat(id, { max, initial: Math.min(max, Math.max(stat.min, stat.initial)) }); }} /></label></div>)}</div></details>
    <div className="admin-section-label"><h3>Origins & starting stats</h3><button className="admin-link" type="button" onClick={addOrigin}>+ Add an origin</button></div>
    <p className="admin-starting-note">Origins are drawn by relative weight. Give each household its own starting ranges or use the world defaults. These ranges are authored game settings.</p>
    <div className="admin-origin-list">{world.origins.map((origin, index) => {
      const validWeight = Number.isFinite(origin.weight) && origin.weight > 0;
      const chance = validWeight && Number.isFinite(totalWeight) && totalWeight > 0 ? `${Number((origin.weight / totalWeight * 100).toFixed(1))}%` : "—";
      const referenced = referencesOrigin(world, origin.id);
      const removalReason = world.origins.length <= 1 ? "Keep at least one origin." : referenced ? "This origin is used by a rule. Update those rules in advanced settings before removing it." : "";
      return <details className="admin-origin-card" key={origin.id} open={index === 0 ? true : undefined}>
        <summary><span><strong>{origin.title}</strong><small>Weight {origin.weight} · {chance} of new lives</small></span><span className="admin-origin-range-summary">{stats.map(([id, stat]) => <span key={id}>{stat.label} <b>{moneyRange(id, origin.statRanges?.[id] ?? defaultRange(stat))}</b></span>)}</span></summary>
        <div className="admin-origin-body"><div className="admin-form-grid"><label className="admin-field"><span>Origin name</span><input aria-label={`${origin.id} origin name`} value={origin.title} onChange={event => updateOrigin(origin.id, { title: event.target.value })} /></label><label className="admin-field"><span>Relative weight</span><input aria-label={`${origin.title} relative weight`} aria-invalid={!validWeight || undefined} type="number" min="0.001" step="any" value={origin.weight} onChange={event => updateOrigin(origin.id, { weight: Number(event.target.value) })} /><small>{chance} of new lives at the current weights.</small></label><label className="admin-field admin-field-wide"><span>Birth description</span><textarea aria-label={`${origin.title} birth description`} rows={3} value={origin.text} onChange={event => updateOrigin(origin.id, { text: event.target.value })} /></label></div>
          {!validWeight && <p className="admin-range-error" role="alert">Use a positive relative weight.</p>}
          <div className="admin-origin-stat-list">{stats.map(([id, stat]) => {
            const custom = origin.statRanges?.[id], range = custom ?? defaultRange(stat), issue = custom ? rangeIssue(range, stat) : "";
            return <div className="admin-origin-stat" key={id}><div className="admin-origin-stat-heading"><strong>{stat.label}</strong><label className="admin-switch"><input aria-label={`${origin.title} ${stat.label} use world default`} type="checkbox" checked={!custom} onChange={event => setOriginRange(origin, id, event.target.checked ? undefined : { ...range })} /><span>Use world default</span></label></div>{custom ? <div className="admin-origin-bound-inputs"><RangeField label="Starting min" accessibleLabel={`${origin.title} ${stat.label} starting minimum`} value={range.min} min={stat.min} max={stat.max} invalid={!!issue} onChange={min => setOriginRange(origin, id, { ...range, min })} /><span aria-hidden="true">-</span><RangeField label="Starting max" accessibleLabel={`${origin.title} ${stat.label} starting maximum`} value={range.max} min={stat.min} max={stat.max} invalid={!!issue} onChange={max => setOriginRange(origin, id, { ...range, max })} /></div> : <p className="admin-origin-inherited">World default: <strong>{moneyRange(id, range)}</strong></p>}{issue && <p className="admin-range-error" role="alert">{stat.label}: {issue}</p>}</div>;
          })}</div>
          <details className="admin-origin-effects"><summary>Additional birth effects ({origin.effects.length})</summary><p>These effects apply after the starting rolls. Stat effects can change the values shown in the ranges above, within the allowed limits.</p>{renderEffects(origin.effects, effects => updateOrigin(origin.id, { effects }))}</details>
          <div className="admin-origin-footer"><span className="admin-mono">{origin.id}</span><button className="admin-link admin-danger" type="button" disabled={!!removalReason} title={removalReason || undefined} onClick={() => onChange({ origins: world.origins.filter(candidate => candidate.id !== origin.id) })}>Remove origin</button></div>{removalReason && <p className="admin-starting-note">{removalReason}</p>}
        </div>
      </details>;
    })}</div>
  </div>;
}
