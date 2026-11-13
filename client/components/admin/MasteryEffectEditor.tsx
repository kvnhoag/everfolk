import type { Effect, WorldPack } from "../../../src/types.ts";

export default function MasteryEffectEditor({ effect, world, onChange }: {
  effect: Extract<Effect, { type: "mastery" }>; world: WorldPack; onChange(effect: Effect): void;
}) {
  const stats = Object.entries(world.stats).filter(([id]) => id !== world.economy?.stat);
  const skills = Object.entries(world.character?.skills ?? {});
  const targets = effect.target === "stat" ? stats : skills;
  const selected = targets.find(([id]) => id === effect.id)?.[1];
  return <>
    <select aria-label="Mastery target kind" value={effect.target} onChange={event => {
      const target = event.target.value === "skill" ? "skill" : "stat";
      onChange({ type: "mastery", target, id: (target === "stat" ? stats : skills)[0]?.[0] ?? "" });
    }}><option value="stat">Attribute</option>{skills.length > 0 && <option value="skill">Skill</option>}</select>
    <select aria-label="Mastery target" value={effect.id} onChange={event => onChange({ ...effect, id: event.target.value })}>
      {targets.map(([id, definition]) => <option value={id} key={id}>{definition.label} · cap {definition.max}</option>)}
    </select>
    <small className="admin-hint">Reaches {selected?.max ?? "the existing cap"} on this outcome. Requires a rare encounter; does not raise the cap.</small>
  </>;
}
