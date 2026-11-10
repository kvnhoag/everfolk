import type { WorldPack } from "../../src/types.ts";
import RareEventsEditor from "./RareEventsEditor.tsx";

export default function EventVarietyEditor({ world, onChange }: {
  world: WorldPack; onChange(patch: Partial<WorldPack>): void;
}) {
  const pacing = world.eventPacing;
  if (!pacing) return null;
  const variety = pacing.variety;
  const update = (patch: Partial<NonNullable<typeof variety>>) => {
    if (variety) onChange({ eventPacing: { ...pacing, variety: { ...variety, ...patch } } });
  };
  return <><div className="admin-card">
    <div className="admin-card-title"><div><h2>Event variety</h2><p>Make previously seen random events less likely to repeat.</p></div>
      <label className="admin-switch"><input type="checkbox" checked={!!variety} onChange={event => {
        const { variety: _variety, ...rest } = pacing;
        onChange({ eventPacing: event.target.checked ? { ...rest, variety: { recentWindow: 6, recentWeight: 0.08, repeatWeight: 0.35 } } : rest });
      }} /><span>Favor fresh events</span></label>
    </div>
    {variety && <div className="admin-form-grid">
      <label className="admin-field"><span>Recent stories to remember</span><input type="number" min="1" max="1000" step="1" value={variety.recentWindow} onChange={event => update({ recentWindow: Number(event.target.value) })} /><small>Background stories and decisions have separate histories.</small></label>
      <label className="admin-field"><span>Recent event weight</span><input type="number" min="0.001" max="1" step="0.001" value={variety.recentWeight} onChange={event => update({ recentWeight: Number(event.target.value) })} /><small>0.08 gives recent events 8% of their usual weight. Lower means fewer repeats.</small></label>
      <label className="admin-field"><span>Seen event weight</span><input type="number" min="0.001" max="1" step="0.001" value={variety.repeatWeight} onChange={event => update({ repeatWeight: Number(event.target.value) })} /><small>0.35 gives an event seen once 35% of its usual weight. Further repeats reduce it again.</small></label>
    </div>}
    <p className="admin-hint">Individual event cooldowns and occurrence limits still apply. Dated history, medical care and moneylender collections keep their own rules.</p>
  </div><RareEventsEditor world={world} onChange={onChange} /></>;
}
