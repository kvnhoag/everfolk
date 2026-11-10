import { displayProse } from "./display-prose.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { activeEarlyInfluences, practiceBonus } from "./early-influences.ts";
import PixelIcon from "./PixelIcon.tsx";
import "./early-influences.css";

export default function EarlyInfluences({ world, life, compact = false }: { world: WorldPack; life: LifeState; compact?: boolean }) {
  const influences = activeEarlyInfluences(world, life);
  if (!influences.length) return null;
  return <details className={`early-influences${compact ? " is-compact" : ""}`}>
    <summary>Early influences <span>{influences.length}</span></summary>
    {!compact && <p>Childhood interests help with related practice. You can pursue any path; the strongest matching practice bonus applies.</p>}
    <ul>{influences.map(item => <li key={item.routeId}><PixelIcon name={item.routeId} size={compact ? 13 : 18} /><div><strong>{item.title}</strong><span>{displayProse(item.memory)}</span>{item.multiplier > 1 && <small>Practice gains up to {practiceBonus(item.multiplier)} · {item.skills.map(skill => skill.label).join(", ")}</small>}</div></li>)}</ul>
  </details>;
}
