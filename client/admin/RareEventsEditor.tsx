import type { WorldPack } from "../../src/types.ts";

export default function RareEventsEditor({ world, onChange }: {
  world: WorldPack; onChange(patch: Partial<WorldPack>): void;
}) {
  const pacing = world.eventPacing;
  if (!pacing) return null;
  const rare = pacing.rareEvents;
  return <div className="admin-card">
    <div className="admin-card-title"><div><h2>Rare encounters</h2><p>A separate chance for unusual events, with a shared cooldown.</p></div>
      <label className="admin-switch"><input type="checkbox" checked={!!rare} onChange={event => {
        const { rareEvents: _rareEvents, ...rest } = pacing;
        onChange({ eventPacing: event.target.checked ? { ...rest, rareEvents: { annualChance: 0.012, cooldownYears: Math.min(12, world.maxAge) } } : rest });
      }} /><span>Allow rare encounters</span></label>
    </div>
    {rare && <div className="admin-form-grid">
      <label className="admin-field"><span>Chance per eligible year (%)</span><input type="number" min="0" max="100" step="0.1" value={Number((rare.annualChance * 100).toFixed(8))} onChange={event => onChange({ eventPacing: { ...pacing, rareEvents: { ...rare, annualChance: Number(event.target.value) / 100 } } })} /><small>Checked only when an eligible rare encounter can occur. Authored game odds.</small></label>
      <label className="admin-field"><span>Years between rare encounters</span><input type="number" min="1" max={world.maxAge} step="1" value={rare.cooldownYears} onChange={event => onChange({ eventPacing: { ...pacing, rareEvents: { ...rare, cooldownYears: Number(event.target.value) } } })} /><small>Shared across all rare events, in addition to each event's own limits.</small></label>
    </div>}
    <p className="admin-hint">Mark events as Rare encounter in the Events editor. Their draw weights select within the rare pool. Repeat penalties cannot increase the shared chance. When this is off, marked rare events do not appear.</p>
  </div>;
}
